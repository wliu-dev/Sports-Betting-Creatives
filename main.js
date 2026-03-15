(function () {
  'use strict';

  // =============================================================
  // CONFIGURATION — Set your API keys here
  // =============================================================
  var CONFIG = {
    // Worker URL — set this after deploying the Vercel worker
    // Example: 'https://your-project.vercel.app/api/matches'
    WORKER_URL: 'https://worker-fawn.vercel.app/api/matches',

    // Direct API keys (used ONLY if WORKER_URL is empty)
    // API-Football (https://rapidapi.com/api-sports/api/api-football)
    API_FOOTBALL_KEY: '',
    API_FOOTBALL_HOST: 'v3.football.api-sports.io',
    // The Odds API (https://the-odds-api.com)
    ODDS_API_KEY: '',
    ODDS_API_REGION: 'eu', // 'eu', 'uk', 'us', 'au'

    // Display
    MAX_FEATURED: 3,
    CAROUSEL_INTERVAL: 5000,
    MAX_MINI: 2,

    // Kayzen click macro
    CLICK_URL: '{HTML_CLICK_URL}',

    // Social proof
    USER_COUNT_BASE: 2847,
    USER_COUNT_MIN: 2400,
    USER_COUNT_MAX: 3500,
  };

  // =============================================================
  // MATCH PRIORITIZATION DATA
  // =============================================================

  // Competition tiers — higher = more prominent
  var COMP_TIERS = {
    // Tier 5: Elite
    2: 5, 3: 5, 848: 5, 1: 5, 4: 5,
    // Tier 4: Top 5 leagues
    39: 4, 140: 4, 135: 4, 78: 4, 61: 4,
    // Tier 3: Strong secondary
    88: 3, 94: 3, 262: 3, 253: 3, 71: 3, 128: 3,
    // Tier 2: Notable
    144: 2, 179: 2, 203: 2, 235: 2, 307: 2,
  };

  // Big clubs — team IDs from API-Football
  var BIG_CLUBS = {
    541: 3, 529: 3, 530: 2,                         // Real Madrid, Barcelona, Atletico
    33: 3, 40: 3, 50: 3, 42: 3, 49: 3, 47: 2,      // EPL big 6
    157: 3, 165: 2,                                  // Bayern, Dortmund
    489: 3, 505: 3, 496: 3, 492: 2,                  // Milan, Inter, Juve, Napoli
    85: 3,                                           // PSG
    211: 2, 212: 2,                                  // Benfica, Porto
  };

  // Derbies get bonus points
  var DERBIES = [
    [541, 529], [33, 40], [50, 33], [42, 47],
    [489, 505], [157, 165], [85, 91], [211, 212],
  ];

  // Map API-Football league IDs → The Odds API sport keys
  var LEAGUE_TO_ODDS = {
    39: 'soccer_epl',
    140: 'soccer_spain_la_liga',
    135: 'soccer_italy_serie_a',
    78: 'soccer_germany_bundesliga',
    61: 'soccer_france_ligue_one',
    2: 'soccer_uefa_champs_league',
    3: 'soccer_uefa_europa_league',
  };

  // =============================================================
  // MATCH SCORING ALGORITHM
  // =============================================================

  var LIVE_STATUSES = ['1H', '2H', 'HT', 'ET', 'P'];

  function scoreMatch(match) {
    var score = 0;
    var compTier = COMP_TIERS[match.league.id] || 1;
    score += compTier * 10;

    var status = match.fixture.status.short;
    if (LIVE_STATUSES.indexOf(status) !== -1) {
      score += 50; // Live = huge boost
    } else if (status === 'NS') {
      var hoursUntil = (new Date(match.fixture.date) - Date.now()) / 3600000;
      if (hoursUntil <= 1) score += 35;
      else if (hoursUntil <= 3) score += 25;
      else if (hoursUntil <= 6) score += 15;
      else score += 5;
    }

    var hId = match.teams.home.id;
    var aId = match.teams.away.id;
    score += (BIG_CLUBS[hId] || 0) * 5;
    score += (BIG_CLUBS[aId] || 0) * 5;

    for (var i = 0; i < DERBIES.length; i++) {
      var d = DERBIES[i];
      if ((hId === d[0] && aId === d[1]) || (hId === d[1] && aId === d[0])) {
        score += 25;
        break;
      }
    }

    return score;
  }

  // =============================================================
  // WORKER FETCH (preferred — pre-scored, cached on CDN)
  // =============================================================

  function fetchFromWorker() {
    if (!CONFIG.WORKER_URL) return Promise.reject('no-worker');

    return fetch(CONFIG.WORKER_URL)
      .then(function (r) {
        if (!r.ok) throw new Error('Worker ' + r.status);
        return r.json();
      })
      .then(function (data) {
        if (!data.matches || !data.matches.length) throw new Error('empty');

        // Worker returns matches with inline odds — inject into oddsMap
        var oddsMap = {};
        data.matches.forEach(function (m) {
          if (m.odds) {
            oddsMap[m.teams.home.name.toLowerCase()] = {
              bookmakers: [{
                markets: [{
                  outcomes: [
                    { name: m.teams.home.name, price: m.odds.home },
                    { name: 'Draw', price: m.odds.draw },
                    { name: m.teams.away.name, price: m.odds.away },
                  ]
                }]
              }],
              home_team: m.teams.home.name,
              away_team: m.teams.away.name,
            };
          }
        });
        state.oddsMap = oddsMap;

        return data.matches;
      });
  }

  // =============================================================
  // DIRECT API FETCHING (fallback if no Worker URL)
  // =============================================================

  function fetchFixtures() {
    if (!CONFIG.API_FOOTBALL_KEY) return Promise.reject('no-key');

    var today = new Date().toISOString().split('T')[0];
    return fetch('https://' + CONFIG.API_FOOTBALL_HOST + '/fixtures?date=' + today, {
      headers: {
        'x-rapidapi-key': CONFIG.API_FOOTBALL_KEY,
        'x-rapidapi-host': CONFIG.API_FOOTBALL_HOST,
      },
    })
      .then(function (r) {
        if (!r.ok) throw new Error('API ' + r.status);
        return r.json();
      })
      .then(function (data) {
        if (!data.response || !data.response.length) throw new Error('empty');
        return data.response
          .map(function (m) { m._score = scoreMatch(m); return m; })
          .sort(function (a, b) { return b._score - a._score; });
      });
  }

  function fetchOdds(matches) {
    if (!CONFIG.ODDS_API_KEY || !matches.length) return Promise.resolve({});

    // Find unique league sport keys for displayed matches
    var sportKeys = {};
    matches.forEach(function (m) {
      var key = LEAGUE_TO_ODDS[m.league.id];
      if (key) sportKeys[key] = true;
    });
    var keys = Object.keys(sportKeys);
    if (!keys.length) return Promise.resolve({});

    // Fetch odds for each sport key (max 3 calls)
    var promises = keys.slice(0, 3).map(function (sport) {
      return fetch(
        'https://api.the-odds-api.com/v4/sports/' + sport + '/odds' +
        '?apiKey=' + CONFIG.ODDS_API_KEY +
        '&regions=' + CONFIG.ODDS_API_REGION +
        '&markets=h2h&oddsFormat=decimal'
      )
        .then(function (r) { return r.json(); })
        .catch(function () { return []; });
    });

    return Promise.all(promises).then(function (results) {
      var map = {};
      results.forEach(function (events) {
        if (!Array.isArray(events)) return;
        events.forEach(function (ev) {
          // Index by lowercase home team for matching
          map[ev.home_team.toLowerCase()] = ev;
        });
      });
      return map;
    });
  }

  // =============================================================
  // FALLBACK DATA (used when no API key is configured)
  // =============================================================

  // Logo CDN helpers — API-Football serves these publicly
  var MEDIA_CDN = 'https://media.api-sports.io/football/';
  function teamLogo(id) { return MEDIA_CDN + 'teams/' + id + '.png'; }
  function leagueLogo(id) { return MEDIA_CDN + 'leagues/' + id + '.png'; }

  function todayAt(h, m) {
    var d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  }

  var FALLBACK = [
    {
      fixture: { id: 901, date: todayAt(21, 0), status: { short: 'NS', elapsed: null } },
      league: { id: 2, name: 'Champions League', logo: leagueLogo(2) },
      teams: {
        home: { id: 541, name: 'Real Madrid', logo: teamLogo(541) },
        away: { id: 50, name: 'Manchester City', logo: teamLogo(50) },
      },
      goals: { home: null, away: null },
      _score: 100,
    },
    {
      fixture: { id: 902, date: todayAt(17, 30), status: { short: 'NS', elapsed: null } },
      league: { id: 39, name: 'Premier League', logo: leagueLogo(39) },
      teams: {
        home: { id: 40, name: 'Liverpool', logo: teamLogo(40) },
        away: { id: 42, name: 'Arsenal', logo: teamLogo(42) },
      },
      goals: { home: null, away: null },
      _score: 90,
    },
    {
      fixture: { id: 903, date: todayAt(20, 0), status: { short: 'NS', elapsed: null } },
      league: { id: 140, name: 'La Liga', logo: leagueLogo(140) },
      teams: {
        home: { id: 529, name: 'Barcelona', logo: teamLogo(529) },
        away: { id: 530, name: 'Atletico Madrid', logo: teamLogo(530) },
      },
      goals: { home: null, away: null },
      _score: 85,
    },
    {
      fixture: { id: 904, date: todayAt(18, 45), status: { short: 'NS', elapsed: null } },
      league: { id: 78, name: 'Bundesliga', logo: leagueLogo(78) },
      teams: {
        home: { id: 157, name: 'Bayern Munich', logo: teamLogo(157) },
        away: { id: 165, name: 'Borussia Dortmund', logo: teamLogo(165) },
      },
      goals: { home: null, away: null },
      _score: 80,
    },
    {
      fixture: { id: 905, date: todayAt(20, 45), status: { short: 'NS', elapsed: null } },
      league: { id: 135, name: 'Serie A', logo: leagueLogo(135) },
      teams: {
        home: { id: 489, name: 'AC Milan', logo: teamLogo(489) },
        away: { id: 505, name: 'Inter Milan', logo: teamLogo(505) },
      },
      goals: { home: null, away: null },
      _score: 78,
    },
  ];

  var FALLBACK_ODDS = {
    'real madrid':      { home: 2.45, draw: 3.40, away: 2.80 },
    'liverpool':        { home: 2.10, draw: 3.50, away: 3.20 },
    'barcelona':        { home: 1.85, draw: 3.60, away: 4.00 },
    'bayern munich':    { home: 1.55, draw: 4.20, away: 5.50 },
    'ac milan':         { home: 2.70, draw: 3.25, away: 2.60 },
  };

  // =============================================================
  // STATE
  // =============================================================

  var state = {
    matches: [],
    oddsMap: {},         // from The Odds API
    liveOdds: {},        // current displayed odds per matchId
    countdownTarget: 0,
    countdownMatchName: '',
    userCount: CONFIG.USER_COUNT_BASE,
    carouselMatches: [],
    carouselIndex: 0,
    ctaIndex: 0,
  };

  // EN copy (switch to RU for production)
  var CTA_TEXTS = ['BET NOW', 'CLAIM BONUS', 'PLAY NOW', 'BET NOW'];
  // RU: var CTA_TEXTS = ['\u0421\u0414\u0415\u041B\u0410\u0422\u042C \u0421\u0422\u0410\u0412\u041A\u0423', '\u041F\u041E\u041B\u0423\u0427\u0418\u0422\u042C \u0411\u041E\u041D\u0423\u0421', '\u0418\u0413\u0420\u0410\u0422\u042C', '\u0421\u0414\u0415\u041B\u0410\u0422\u042C \u0421\u0422\u0410\u0412\u041A\u0423'];

  // =============================================================
  // HELPERS
  // =============================================================

  // Short display names for teams whose full name is too long
  var SHORT_NAMES = {
    'Paris Saint Germain': 'PSG',
    'Paris Saint-Germain': 'PSG',
    'Atletico Madrid': 'Atl. Madrid',
    'Borussia Dortmund': 'Dortmund',
    'Manchester United': 'Man United',
    'Manchester City': 'Man City',
    'Tottenham Hotspur': 'Tottenham',
    'Wolverhampton Wanderers': 'Wolves',
    'Nottingham Forest': "Nott'm Forest",
    'Bayer Leverkusen': 'Leverkusen',
    'RB Leipzig': 'RB Leipzig',
    'Eintracht Frankfurt': 'E. Frankfurt',
    'West Ham United': 'West Ham',
    'Newcastle United': 'Newcastle',
    'Sheffield United': 'Sheffield Utd',
    'Brighton And Hove Albion': 'Brighton',
    'Brighton and Hove Albion': 'Brighton',
  };

  function shortName(name) { return SHORT_NAMES[name] || name; }

  function abbr(name) { return name.substring(0, 3).toUpperCase(); }

  function isLive(m) { return LIVE_STATUSES.indexOf(m.fixture.status.short) !== -1; }

  function fmtTime(iso) {
    var d = new Date(iso);
    var h = d.getHours().toString().padStart(2, '0');
    var m = d.getMinutes().toString().padStart(2, '0');
    return h + ':' + m;
  }

  function esc(s) { return s.replace(/'/g, "\\'"); }

  // Get odds for a match — real API > fallback table > random
  function getOdds(match) {
    var homeKey = match.teams.home.name.toLowerCase();

    // 1. Real odds from The Odds API
    var ev = state.oddsMap[homeKey];
    if (ev && ev.bookmakers && ev.bookmakers.length) {
      var outcomes = ev.bookmakers[0].markets[0].outcomes;
      var hOdds, dOdds, aOdds;
      for (var i = 0; i < outcomes.length; i++) {
        if (outcomes[i].name === ev.home_team) hOdds = outcomes[i].price;
        else if (outcomes[i].name === ev.away_team) aOdds = outcomes[i].price;
        else if (outcomes[i].name === 'Draw') dOdds = outcomes[i].price;
      }
      if (hOdds && dOdds && aOdds) return { home: hOdds, draw: dOdds, away: aOdds };
    }

    // 2. Curated fallback
    if (FALLBACK_ODDS[homeKey]) return FALLBACK_ODDS[homeKey];

    // 3. Plausible random
    return {
      home: +(1.5 + Math.random() * 2.2).toFixed(2),
      draw: +(2.8 + Math.random() * 1.4).toFixed(2),
      away: +(1.8 + Math.random() * 2.5).toFixed(2),
    };
  }

  // =============================================================
  // RENDERING
  // =============================================================

  function renderFeatured(match) {
    var live = isLive(match);
    var st = match.fixture.status.short;
    var id = match.fixture.id;
    var odds = getOdds(match);

    // Store for animation
    state.liveOdds[id] = { home: odds.home, draw: odds.draw, away: odds.away };

    // Time / status
    var timeHtml;
    if (live) {
      timeHtml = '<span class="match-status">' + (match.fixture.status.elapsed || '') + "' LIVE</span>";
    } else if (st === 'FT' || st === 'AET' || st === 'PEN') {
      timeHtml = '<span style="color:#8B949E">FT</span>';
    } else {
      timeHtml = '<span class="match-time-display">' + fmtTime(match.fixture.date) + '</span>';
    }

    // Center: score or VS
    var center;
    if (live || st === 'FT' || st === 'AET' || st === 'PEN') {
      center = '<div class="score-display">' + (match.goals.home || 0) + ' - ' + (match.goals.away || 0) + '</div>';
    } else {
      center = '<div class="vs-badge">VS</div>';
    }

    // Team logos (API-Football returns URLs; fallback to initials)
    var hLogo = match.teams.home.logo
      ? '<img src="' + match.teams.home.logo + '" alt="" onerror="this.parentElement.textContent=\'' + esc(abbr(match.teams.home.name)) + '\'">'
      : abbr(match.teams.home.name);
    var aLogo = match.teams.away.logo
      ? '<img src="' + match.teams.away.logo + '" alt="" onerror="this.parentElement.textContent=\'' + esc(abbr(match.teams.away.name)) + '\'">'
      : abbr(match.teams.away.name);

    // Competition logo
    var compLogo = match.league.logo
      ? '<img class="comp-logo" src="' + match.league.logo + '" alt="" onerror="this.style.display=\'none\'">'
      : '';

    return (
      '<div class="featured' + (live ? ' live-match' : '') + '" data-mid="' + id + '">' +
        '<div class="hot-badge">' + (live ? '&#x1F534; LIVE NOW' : '&#x1F525; HOT MATCH') + '</div>' +
        '<div class="match-comp">' + compLogo + '<span>' + match.league.name + '</span> ' + timeHtml + '</div>' +
        '<div class="teams-row">' +
          '<div class="team">' +
            '<div class="team-crest">' + hLogo + '</div>' +
            '<div class="team-name">' + shortName(match.teams.home.name) + '</div>' +
          '</div>' +
          center +
          '<div class="team">' +
            '<div class="team-crest">' + aLogo + '</div>' +
            '<div class="team-name">' + shortName(match.teams.away.name) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="odds-row">' +
          oddBtn('1', odds.home, 'home', id) +
          oddBtn('X', odds.draw, 'draw', id) +
          oddBtn('2', odds.away, 'away', id) +
        '</div>' +
      '</div>'
    );
  }

  function oddBtn(label, value, type, matchId) {
    return (
      '<div class="odd-btn" data-odd="' + type + '-' + matchId + '">' +
        '<div class="odd-label">' + label + '</div>' +
        '<div class="odd-value">' + value.toFixed(2) + '</div>' +
        '<div class="odd-arrow">&#x25B2;</div>' +
      '</div>'
    );
  }

  function renderMini(match) {
    var live = isLive(match);
    var st = match.fixture.status.short;
    var h = abbr(match.teams.home.name);
    var a = abbr(match.teams.away.name);

    var mid, time;
    if (live) {
      mid = ' ';
      time = '<span class="mini-live">' + (match.fixture.status.elapsed || '') + "'</span>";
    } else if (st === 'FT') {
      mid = ' ' + (match.goals.home || 0) + '-' + (match.goals.away || 0) + ' ';
      time = 'FT';
    } else {
      mid = ' vs ';
      time = '<span class="mini-time">' + fmtTime(match.fixture.date) + '</span>';
    }

    return (
      '<div class="mini-match">' +
        '<span class="team-abbr">' + h + '</span>' + mid +
        '<span class="team-abbr">' + a + '</span>' +
        ' &bull; ' + time +
      '</div>'
    );
  }

  function render(matches) {
    state.matches = matches;
    var el = document.getElementById('matches');
    if (!el) return;

    // Split: featured (carousel) + mini (static below)
    state.carouselMatches = matches.slice(0, CONFIG.MAX_FEATURED);
    state.carouselIndex = 0;
    var mini = matches.slice(CONFIG.MAX_FEATURED, CONFIG.MAX_FEATURED + CONFIG.MAX_MINI);
    var extra = Math.max(0, matches.length - CONFIG.MAX_FEATURED - CONFIG.MAX_MINI);

    // Render first featured + minis
    var html = '';
    html += '<div id="featuredSlot">' + renderFeatured(state.carouselMatches[0]) + '</div>';

    if (mini.length || extra) {
      html += '<div class="more-matches">';
      mini.forEach(function (m) { html += renderMini(m); });
      if (extra > 0) html += '<div class="mini-match">+' + extra + ' more</div>';
      html += '</div>';
    }

    el.innerHTML = html;

    // Build carousel dots
    renderDots();

    // Smart countdown: target = earliest upcoming (NS) match
    var upcoming = matches.filter(function (m) { return m.fixture.status.short === 'NS'; });
    var section = document.getElementById('countdownSection');
    if (upcoming.length) {
      var first = upcoming[0];
      state.countdownTarget = new Date(first.fixture.date).getTime();
      state.countdownMatchName = first.teams.home.name + ' vs ' + first.teams.away.name;
      var label = document.getElementById('countdownLabel');
      if (label) label.textContent = state.countdownMatchName + ' kicks off in';
    } else if (section) {
      section.classList.add('hidden');
    }

    // Trigger entrance animations
    var container = document.querySelector('.container');
    if (container) {
      // Small delay so DOM paints skeleton first, then reveals
      setTimeout(function () { container.classList.add('loaded'); }, 80);
    }
  }

  // =============================================================
  // CAROUSEL
  // =============================================================

  function renderDots() {
    var dotsEl = document.getElementById('carouselDots');
    if (!dotsEl || state.carouselMatches.length <= 1) {
      if (dotsEl) dotsEl.innerHTML = '';
      return;
    }
    var html = '';
    for (var i = 0; i < state.carouselMatches.length; i++) {
      html += '<div class="carousel-dot' + (i === state.carouselIndex ? ' active' : '') + '" data-dot="' + i + '"></div>';
    }
    dotsEl.innerHTML = html;
  }

  function rotateCarousel() {
    if (state.carouselMatches.length <= 1) return;
    var slot = document.getElementById('featuredSlot');
    if (!slot) return;

    var card = slot.querySelector('.featured');
    if (!card) return;

    // Phase 1: fade out
    card.classList.add('carousel-exit');

    setTimeout(function () {
      // Advance index
      state.carouselIndex = (state.carouselIndex + 1) % state.carouselMatches.length;
      var match = state.carouselMatches[state.carouselIndex];

      // Swap content
      slot.innerHTML = renderFeatured(match);

      // Phase 2: fade in
      var newCard = slot.querySelector('.featured');
      if (newCard) {
        newCard.classList.add('carousel-enter');
        // Force reflow
        void newCard.offsetWidth;
        newCard.classList.remove('carousel-enter');
      }

      // Update dots
      renderDots();
    }, 400);
  }

  // =============================================================
  // CTA TEXT ROTATION
  // =============================================================

  function rotateCta() {
    var textEl = document.querySelector('.cta-text');
    if (!textEl) return;

    // Swap out
    textEl.classList.add('swap-out');

    setTimeout(function () {
      state.ctaIndex = (state.ctaIndex + 1) % CTA_TEXTS.length;
      textEl.textContent = CTA_TEXTS[state.ctaIndex];
      textEl.classList.remove('swap-out');
      textEl.classList.add('swap-in');
      // Force reflow
      void textEl.offsetWidth;
      textEl.classList.remove('swap-in');
    }, 250);
  }

  // =============================================================
  // FOMO ANIMATIONS
  // =============================================================

  function tickCountdown() {
    if (!state.countdownTarget) return;
    var diff = Math.max(0, state.countdownTarget - Date.now());

    var h = Math.floor(diff / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);

    setText('hrs', pad(h));
    setText('mins', pad(m));
    setText('secs', pad(s));

    // Urgent when < 1 hour
    var urgent = diff > 0 && diff < 3600000;
    var blocks = document.querySelectorAll('.time-block');
    for (var i = 0; i < blocks.length; i++) {
      if (urgent) blocks[i].classList.add('urgent');
      else blocks[i].classList.remove('urgent');
    }

    if (diff === 0) {
      var label = document.getElementById('countdownLabel');
      if (label) label.textContent = 'Match started!';
    }
  }

  function fluctuateOdds() {
    var ids = Object.keys(state.liveOdds);
    if (!ids.length) return;

    // Pick a random match, random odd type
    var matchId = ids[Math.floor(Math.random() * ids.length)];
    var odds = state.liveOdds[matchId];
    var types = ['home', 'draw', 'away'];
    var type = types[Math.floor(Math.random() * 3)];

    var delta = (Math.random() * 0.12) - 0.06;
    var newVal = Math.max(1.05, odds[type] + delta);
    var dir = newVal > odds[type] ? 'up' : 'down';
    odds[type] = +newVal.toFixed(2);

    var btn = document.querySelector('[data-odd="' + type + '-' + matchId + '"]');
    if (!btn) return;

    var valEl = btn.querySelector('.odd-value');
    var arrowEl = btn.querySelector('.odd-arrow');
    if (valEl) valEl.textContent = odds[type].toFixed(2);
    if (arrowEl) arrowEl.innerHTML = dir === 'up' ? '&#x25B2;' : '&#x25BC;';

    // Flash effect
    btn.classList.remove('flash-up', 'flash-down');
    // Force reflow so animation replays
    void btn.offsetWidth;
    btn.classList.add('flash-' + dir);
    setTimeout(function () { btn.classList.remove('flash-up', 'flash-down'); }, 900);
  }

  function fluctuateUsers() {
    var delta = Math.floor(Math.random() * 30) - 12;
    state.userCount = Math.max(
      CONFIG.USER_COUNT_MIN,
      Math.min(CONFIG.USER_COUNT_MAX, state.userCount + delta)
    );
    setText('userCount', state.userCount.toLocaleString());
  }

  function spawnParticles() {
    var container = document.getElementById('particles');
    if (!container) return;
    container.innerHTML = '';

    for (var i = 0; i < 8; i++) {
      var p = document.createElement('div');
      p.className = 'particle';
      var size = 2 + Math.random() * 4;
      var opacity = 0.15 + Math.random() * 0.25;
      var dur = 7 + Math.random() * 9;
      var delay = Math.random() * dur;
      var left = Math.random() * 100;
      var color = Math.random() > 0.75 ? '#FF4757' : '#3BF270';

      p.style.cssText =
        'width:' + size + 'px;height:' + size + 'px;' +
        'left:' + left + '%;' +
        'background:' + color + ';' +
        '--p-opacity:' + opacity + ';' +
        'animation-duration:' + dur + 's;' +
        'animation-delay:' + delay + 's;';

      container.appendChild(p);
    }
  }

  // =============================================================
  // CLICK HANDLING (MRAID + Kayzen)
  // =============================================================

  function handleClick() {
    var url = CONFIG.CLICK_URL;
    if (typeof mraid !== 'undefined' && mraid.open) {
      mraid.open(url);
    } else {
      window.open(url, '_blank');
    }
  }

  // =============================================================
  // UTILITIES
  // =============================================================

  function pad(n) { return n.toString().padStart(2, '0'); }
  function setText(id, txt) {
    var el = document.getElementById(id);
    if (el) el.textContent = txt;
  }

  // =============================================================
  // INIT
  // =============================================================

  function init() {
    spawnParticles();

    // Click handlers
    var cta = document.getElementById('cta');
    if (cta) cta.addEventListener('click', handleClick);

    var wrap = document.querySelector('.container');
    if (wrap) {
      wrap.addEventListener('click', function (e) {
        if (e.target.id !== 'cta' && !e.target.closest('.cta')) handleClick();
      });
    }

    // Timers
    setInterval(tickCountdown, 1000);
    setInterval(fluctuateOdds, 3500);
    setInterval(fluctuateUsers, 3000);
    setInterval(rotateCarousel, CONFIG.CAROUSEL_INTERVAL);
    setInterval(rotateCta, 4000);

    // Data pipeline: Worker → direct APIs → fallback
    fetchFromWorker()
      .then(function (matches) {
        render(matches);
      })
      .catch(function () {
        // Worker unavailable — try direct API calls
        fetchFixtures()
          .then(function (all) {
            var top = all.slice(0, CONFIG.MAX_FEATURED + CONFIG.MAX_MINI + 15);
            return fetchOdds(top).then(function (oddsMap) {
              state.oddsMap = oddsMap;
              return top;
            });
          })
          .then(function (matches) {
            render(matches);
          })
          .catch(function () {
            render(FALLBACK);
          });
      });
  }

  // MRAID lifecycle
  if (typeof mraid !== 'undefined') {
    if (mraid.getState() === 'loading') {
      mraid.addEventListener('ready', init);
    } else {
      init();
    }
  } else {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

})();
