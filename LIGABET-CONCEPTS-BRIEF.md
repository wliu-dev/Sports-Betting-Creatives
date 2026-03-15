# Ligabet Football Creatives - Concept Briefs

> **5 variations targeting different psychological levers**  
> **Platform:** Kayzen DSP  
> **Format:** HTML (CDN-hosted assets)  
> **Brand:** Ligabet (#3BF270 green, #0C0C0C dark)

---

## Reference Files (Concept A)

All concepts build on this working codebase:

| File | CDN URL | Purpose |
|------|---------|---------|
| index.html | Local/Kayzen upload | Structure |
| styles.css | `kayzencdn.akamaized.net/.../styles.css` | Base styles |
| main.js | `kayzencdn.akamaized.net/.../main.js` | API + logic |

**API:** API-Football (https://www.api-football.com/)  
**Caching:** Fetch fixtures hourly, serve from CDN cache  
**Click macro:** `{HTML_CLICK_URL}`

---

## Concept A: Live Match Ticker ✅ COMPLETE

**Hook:** Real match data + live odds fluctuating

**Status:** Production-ready, currently deployed

**Features:**
- Carousel of top 3 prioritized matches
- Live countdown to next kickoff
- Animated odds with up/down indicators
- Social proof ("2,847 betting now")
- 200% welcome bonus promo strip

---

## Concept B: Big Match Countdown

**Hook:** Hype / event-driven

**Psychology:** Single-focus attention, event anticipation, scarcity of time

### Visual Design
```
┌─────────────────────────────┐
│         LIGABET             │
│      [LIVE MATCHES]         │
│                             │
│    ┌───────────────────┐    │
│    │   🔥 EL CLÁSICO   │    │
│    │                   │    │
│    │  [REAL]   [BARÇA] │    │
│    │   ⚪       🔵      │    │
│    │                   │    │
│    │   KICKOFF IN      │    │
│    │    02:34:52       │    │  ← HERO ELEMENT
│    │   ███████████     │    │
│    │                   │    │
│    │  1.95  3.40  2.10 │    │
│    └───────────────────┘    │
│                             │
│      [ BET NOW → ]          │
│                             │
│    18+ | Gamble responsibly │
└─────────────────────────────┘
```

### Key Differences from A
- Remove carousel - show ONLY #1 priority match
- Countdown is the star (48px+ font, centered)
- Team crests larger (80px)
- No mini-matches section
- Background pulse accelerates as kickoff approaches
- CTA text evolves:
  - `> 1 hour`: "BET NOW"
  - `< 1 hour`: "PLACE YOUR BET"  
  - `< 10 min`: "LAST CHANCE"
  - `LIVE`: "BET LIVE NOW"

### New CSS Needed
```css
.hero-countdown {
  font-size: 48px;
  font-weight: 700;
  text-align: center;
  letter-spacing: 4px;
}

.hero-card {
  min-height: 280px;
  /* fills more vertical space */
}

/* Accelerating pulse as time decreases */
.urgent-1h { animation-duration: 2s; }
.urgent-10m { animation-duration: 1s; }
.urgent-1m { animation-duration: 0.5s; }
```

### New JS Needed
- Remove carousel logic
- Add urgency tiers based on time remaining
- Dynamic CTA text updates
- Faster animation triggers

---

## Concept C: Odds Slider

**Hook:** Interactive engagement

**Psychology:** Active participation increases commitment, curiosity ("what's next?")

### Visual Design
```
┌─────────────────────────────┐
│         LIGABET             │
│      [LIVE MATCHES]         │
│                             │
│ ┌─────────┐┌─────────┐      │
│ │ REAL vs ││ LIV vs  │←swipe│
│ │ MAN CITY││ ARSENAL │      │
│ │ 2.45 X  ││ 2.10 X  │      │
│ └─────────┘└─────────┘      │
│                             │
│    👆 Swipe for more        │  ← hint animation
│                             │
│        ● ● ○ ○ ○            │  ← dot indicators
│                             │
│      [ BET NOW → ]          │
│                             │
│    18+ | Gamble responsibly │
└─────────────────────────────┘
```

### Key Differences from A
- Horizontal scroll/swipe carousel
- Cards laid out side-by-side (overflow-x scroll)
- "Swipe for more →" hint with animated hand icon
- Hint fades after first user interaction
- Dot indicators show position
- CTA pulses more aggressively after 2+ cards viewed
- Optional: haptic-style bounce feedback on swipe

### New CSS Needed
```css
.swipe-container {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.swipe-container::-webkit-scrollbar { display: none; }

.swipe-card {
  flex: 0 0 85%;
  scroll-snap-align: center;
  margin-right: 12px;
}

.swipe-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: #8B949E;
  animation: hintPulse 1.5s ease-in-out infinite;
}

.swipe-hint.hidden {
  opacity: 0;
  transition: opacity 0.3s;
}

@keyframes hintPulse {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(5px); }
}
```

### New JS Needed
```javascript
// Track scroll position for dots
container.addEventListener('scroll', updateDots);

// Hide hint after first interaction
container.addEventListener('touchstart', () => {
  hint.classList.add('hidden');
}, { once: true });

// Track engagement
let cardsViewed = new Set();
// Boost CTA after 2+ cards
if (cardsViewed.size >= 2) {
  cta.classList.add('engaged');
}
```

---

## Concept D: Cash Out Pulse

**Hook:** Loss aversion / urgency

**Psychology:** Fear of loss > desire for gain. Fluctuating value creates anxiety → action.

### Visual Design
```
┌─────────────────────────────┐
│         LIGABET             │
│                             │
│      YOUR CASH OUT          │
│                             │
│       $ 1 2 7 . 5 0         │  ← animated, fluctuating
│         ▲ +$2.30            │  ← green when rising
│                             │
│   ⚠️ Value changing live    │
│                             │
│   ┌─────────────────────┐   │
│   │ ███████████░░░░░░░░ │   │  ← "time pressure" bar
│   └─────────────────────┘   │
│                             │
│    [ CASH OUT NOW → ]       │  ← urgent CTA
│                             │
│      Don't let it drop      │
│                             │
│    18+ | Gamble responsibly │
└─────────────────────────────┘
```

### Key Differences from A
- No specific match - this is about MONEY
- Giant animated number as hero (counting up/down smoothly)
- Background shifts subtle green↔red based on trend
- No team logos or fixtures
- Simulated "your potential win" that fluctuates
- Progress bar suggests time running out
- Copy triggers loss aversion:
  - Rising: "🔥 Value rising - lock it in"
  - Dropping: "⚠️ Value dropping - claim now"

### New CSS Needed
```css
.cashout-value {
  font-size: 52px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  transition: color 0.3s;
}

.cashout-value.rising { color: #3BF270; }
.cashout-value.dropping { color: #FF4757; }

.trend-indicator {
  font-size: 14px;
  margin-top: 4px;
}
.trend-indicator.up { color: #3BF270; }
.trend-indicator.down { color: #FF4757; }

.pressure-bar {
  height: 6px;
  background: rgba(255,255,255,0.1);
  border-radius: 3px;
  overflow: hidden;
}
.pressure-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #3BF270, #FF4757);
  animation: pressureShrink 15s linear forwards;
}
@keyframes pressureShrink {
  from { width: 100%; }
  to { width: 0%; }
}
```

### New JS Needed
```javascript
// Smooth number animation
function animateValue(el, start, end, duration) {
  const range = end - start;
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const value = start + (range * easeOutQuad(progress));
    el.textContent = '$' + value.toFixed(2);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// Random walk for realistic fluctuation
function getNextValue(current) {
  const change = (Math.random() - 0.48) * 5; // slight upward bias
  return Math.max(50, current + change);
}

// Update every 2-3 seconds
setInterval(() => {
  const newValue = getNextValue(currentValue);
  const trend = newValue > currentValue ? 'rising' : 'dropping';
  animateValue(display, currentValue, newValue, 800);
  currentValue = newValue;
  updateTrend(trend);
}, 2500);
```

---

## Concept E: Score Flash

**Hook:** FOMO / regret

**Psychology:** Regret is powerful. Show what they missed → offer redemption.

### Visual Design
```
┌─────────────────────────────┐
│         LIGABET             │
│                             │
│         ⚽ GOAL!            │  ← celebration burst
│                             │
│    REAL MADRID  2 - 0       │  ← score just updated
│                             │
│   If you bet $10...         │
│   You'd have won $47        │  ← regret trigger
│                             │
│        ↓ ↓ ↓                │
│                             │
│   Don't miss the next one   │
│                             │
│   LIVERPOOL vs ARSENAL      │  ← next opportunity
│      Starts in 1:24:30      │
│                             │
│      [ BET NOW → ]          │
│                             │
│    18+ | Gamble responsibly │
└─────────────────────────────┘
```

### Key Differences from A
- Two-phase creative with timed transitions
- Phase 1 (0-4s): "GOAL!" celebration + regret message
- Phase 2 (4s+): Pivot to next upcoming match
- Score change animation with particle burst
- "What you missed" → "What's coming" flow
- More emotional, story-driven

### Animation Sequence
```
0.0s - Show match, score "1-0"
1.5s - Flash "GOAL!" + burst particles
2.0s - Score updates to "2-0"
2.5s - Show regret text "If you bet $10..."
4.0s - Transition: fade out, slide up
4.5s - Show next match card
5.0s - Countdown begins
```

### New CSS Needed
```css
.goal-flash {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 64px;
  font-weight: 700;
  color: #3BF270;
  animation: goalPop 0.5s ease-out;
  pointer-events: none;
}
@keyframes goalPop {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

.regret-text {
  text-align: center;
  animation: fadeIn 0.5s ease-out 2.5s backwards;
}
.regret-amount {
  font-size: 32px;
  color: #3BF270;
  font-weight: 700;
}

.phase-transition {
  animation: slideUp 0.5s ease-out forwards;
}
@keyframes slideUp {
  to { transform: translateY(-100%); opacity: 0; }
}
```

### New JS Needed
```javascript
// Sequence controller
const sequence = [
  { time: 0, action: () => showScore('1-0') },
  { time: 1500, action: () => triggerGoal() },
  { time: 2000, action: () => updateScore('2-0') },
  { time: 2500, action: () => showRegret('$10', '$47') },
  { time: 4000, action: () => transitionToNextMatch() },
];

function runSequence() {
  sequence.forEach(({ time, action }) => {
    setTimeout(action, time);
  });
}

function triggerGoal() {
  // Show "GOAL!" overlay
  // Trigger particle burst (reuse existing particle system)
  burstParticles(50); // 50 particles from center
}

function showRegret(bet, win) {
  regretEl.innerHTML = `
    If you bet ${bet}...<br>
    <span class="regret-amount">You'd have won ${win}</span>
  `;
}
```

---

## Starter Prompt Template

Use this when building any concept:

```
I'm building Concept [X] of a football betting creative for Ligabet.

Reference files attached:
- index.html (Concept A - working reference)
- styles.css (base styles)  
- main.js (API integration + logic)

**This concept's hook:** [copy from brief]

**Key differences from Concept A:**
[copy bullet points from brief]

**Rules:**
1. Use ask_user_input tool before big decisions
2. Keep same CDN structure (separate HTML, CSS, JS)
3. Reuse existing styles.css where possible - extend don't rewrite
4. Keep Ligabet branding (#3BF270 green, #0C0C0C dark)
5. Maintain MRAID compliance + {HTML_CLICK_URL} macro

Start by outlining what you'll change from Concept A, then ask me to confirm before coding.
```

---

## File Naming Convention

```
/ligabet-creatives/
├── concept-a-live-ticker/
│   ├── index.html
│   ├── styles.css
│   └── main.js
├── concept-b-countdown/
│   ├── index.html
│   ├── styles.css
│   └── main.js
├── concept-c-slider/
│   ├── index.html
│   ├── styles.css
│   └── main.js
├── concept-d-cashout/
│   ├── index.html
│   ├── styles.css
│   └── main.js
└── concept-e-scoreflash/
    ├── index.html
    ├── styles.css
    └── main.js
```

---

## Testing Checklist

For each concept before upload:

- [ ] Works in Kayzen Ad Viewer (https://play.kayzen.io/ad-viewer/index.html)
- [ ] Click macro `{HTML_CLICK_URL}` wired correctly
- [ ] Animations smooth on low-end devices
- [ ] Fallback works if API fails
- [ ] Loads under 3 seconds
- [ ] No console errors
- [ ] Tested on iPhone SE (small screen)
- [ ] Tested on Android (Chrome)

---

## Contact

- **Strategy/Trading:** Will
- **Creative iteration:** [Team member]
- **CDN/Upload:** Trading team
