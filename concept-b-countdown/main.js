(function () {
  'use strict';

  var CONFIG = {
    WORKER_URL: 'https://worker-fawn.vercel.app/api/matches',
    CLICK_URL: '{HTML_CLICK_URL}'
  };

  var MEDIA_CDN = 'https://media.api-sports.io/football/';
  function teamLogo(id) { return MEDIA_CDN + 'teams/' + id + '.png'; }

  function todayAt(h, m) {
    var d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  }

  var FALLBACK = [
    {
      fixture: { id: 901, date: todayAt(21, 0), status: { short: 'NS' } },
      league: { name: 'Champions League' },
      teams: {
        home: { id: 541, name: 'Real Madrid', logo: teamLogo(541) },
        away: { id: 50, name: 'Manchester City', logo: teamLogo(50) }
      },
      odds: { home: 2.45, draw: 3.40, away: 2.8 },
      _score: 100
    },
    {
      fixture: { id: 903, date: todayAt(20, 0), status: { short: 'NS' } },
      league: { name: 'La Liga' },
      teams: {
        home: { id: 529, name: 'Barcelona', logo: teamLogo(529) },
        away: { id: 530, name: 'Atletico Madrid', logo: teamLogo(530) }
      },
      odds: { home: 1.85, draw: 3.60, away: 4.00 },
      _score: 85
    }
  ];

  var state = {
    match: null,
    kickoffMs: 0,
    baselineMs: 0,
    userCount: 2847
  };

  var els = {
    heroCard: document.getElementById('heroCard'),
    matchTitle: document.getElementById('matchTitle'),
    homeLogo: document.getElementById('homeLogo'),
    awayLogo: document.getElementById('awayLogo'),
    homeName: document.getElementById('homeName'),
    awayName: document.getElementById('awayName'),
    kickoffLabel: document.getElementById('kickoffLabel'),
    heroCountdown: document.getElementById('heroCountdown'),
    progressBar: document.getElementById('progressBar'),
    oddHome: document.getElementById('oddHome'),
    oddDraw: document.getElementById('oddDraw'),
    oddAway: document.getElementById('oddAway'),
    cta: document.getElementById('cta'),
    userCount: document.getElementById('userCount')
  };

  function formatTeamName(name) {
    return (name || '').toUpperCase().replace('MANCHESTER', 'MAN').replace('ATLETICO', 'ATLETI');
  }

  function formatClock(ms) {
    if (ms <= 0) return 'LIVE';
    var total = Math.floor(ms / 1000);
    var hrs = String(Math.floor(total / 3600)).padStart(2, '0');
    var mins = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    var secs = String(total % 60).padStart(2, '0');
    return hrs + ':' + mins + ':' + secs;
  }

  function getUrgency(ms) {
    if (ms <= 0) return { cta: 'BET LIVE NOW →', cls: 'urgent-1m' };
    if (ms < 10 * 60 * 1000) return { cta: 'LAST CHANCE →', cls: 'urgent-1m' };
    if (ms < 60 * 60 * 1000) return { cta: 'PLACE YOUR BET →', cls: 'urgent-10m' };
    return { cta: 'BET NOW →', cls: 'urgent-1h' };
  }

  function chooseTopMatch(matches) {
    return (matches || []).slice().sort(function (a, b) {
      return (b._score || 0) - (a._score || 0);
    })[0] || null;
  }

  function renderMatch(match) {
    if (!match) return;

    state.match = match;
    state.kickoffMs = new Date(match.fixture.date).getTime();
    state.baselineMs = Math.max(state.kickoffMs - Date.now(), 1);

    els.matchTitle.textContent = '🔥 ' + match.league.name;
    els.homeLogo.src = match.teams.home.logo;
    els.awayLogo.src = match.teams.away.logo;
    els.homeName.textContent = formatTeamName(match.teams.home.name);
    els.awayName.textContent = formatTeamName(match.teams.away.name);

    var odds = match.odds || { home: 1.95, draw: 3.4, away: 2.1 };
    els.oddHome.textContent = Number(odds.home).toFixed(2);
    els.oddDraw.textContent = Number(odds.draw).toFixed(2);
    els.oddAway.textContent = Number(odds.away).toFixed(2);

    updateCountdown();
    setInterval(updateCountdown, 1000);
  }

  function updateCountdown() {
    var ms = state.kickoffMs - Date.now();
    var urgency = getUrgency(ms);

    els.heroCountdown.textContent = formatClock(ms);
    els.kickoffLabel.textContent = ms <= 0 ? 'MATCH IS LIVE' : 'KICKOFF IN';
    els.cta.textContent = urgency.cta;

    els.heroCard.classList.remove('urgent-1h', 'urgent-10m', 'urgent-1m');
    els.heroCard.classList.add(urgency.cls);

    var remaining = Math.max(0, Math.min(1, ms / state.baselineMs));
    els.progressBar.style.width = (remaining * 100).toFixed(1) + '%';
  }


  function formatNumber(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function tickUserCount() {
    var drift = Math.floor(Math.random() * 35) - 17;
    state.userCount = Math.max(2400, Math.min(3600, state.userCount + drift));
    if (els.userCount) els.userCount.textContent = formatNumber(state.userCount);
  }

  function fetchMatches() {
    if (!CONFIG.WORKER_URL) return Promise.resolve(FALLBACK);

    return fetch(CONFIG.WORKER_URL)
      .then(function (r) {
        if (!r.ok) throw new Error('worker failed');
        return r.json();
      })
      .then(function (data) {
        if (!data.matches || !data.matches.length) throw new Error('empty');
        return data.matches;
      })
      .catch(function () {
        return FALLBACK;
      });
  }

  els.cta.addEventListener('click', function () {
    if (typeof mraid !== 'undefined' && mraid.open) {
      mraid.open(CONFIG.CLICK_URL);
      return;
    }
    window.open(CONFIG.CLICK_URL, '_blank');
  });

  tickUserCount();
  setInterval(tickUserCount, 3500);

  fetchMatches().then(function (matches) {
    renderMatch(chooseTopMatch(matches));
  });
})();
