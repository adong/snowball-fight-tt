/* SnowbaTTle — sounds, synthesised with the kit's Kit.sound.tone / hiss so mute and volume are shared.
   Kit.sound already has swish, bump, punch, coin, powerup, land, click and jump; the snowy ones are here. */
(function () {
  'use strict';
  const S = () => window.Kit.sound;

  window.SBSfx = {
    // a snowball leaves the hand
    throw() { S().hiss({ f: 2600, to: 900, q: 1.4, dur: 0.14, vol: 0.09 }); },
    lob() {
      S().hiss({ f: 900, to: 2200, q: 1.2, dur: 0.22, vol: 0.07 });
      S().tone({ type: 'sine', f: 520, to: 780, dur: 0.18, vol: 0.05 });
    },
    // a snowball hits someone: a soft crunchy splat and a little "pff"
    splat(big) {
      S().hiss({ filter: 'lowpass', f: big ? 1800 : 2600, to: 300, dur: big ? 0.4 : 0.22, vol: big ? 0.32 : 0.24 });
      S().tone({ f: big ? 120 : 190, to: big ? 50 : 80, dur: big ? 0.2 : 0.1, vol: big ? 0.35 : 0.22 });
      S().tone({ type: 'triangle', f: 700, to: 350, dur: 0.08, vol: 0.06, at: 0.02 });
    },
    // the "ha!" for the thrower when it lands
    yay() { [784, 988].forEach((f, i) => S().tone({ type: 'square', f, dur: 0.07, vol: 0.035, lp: 2400, at: 0.05 + i * 0.06 })); },
    // a fort brick crumbles
    fort(big) {
      S().hiss({ filter: 'bandpass', f: 1400, to: 500, q: 0.7, dur: big ? 0.45 : 0.25, vol: big ? 0.26 : 0.16 });
      S().tone({ f: 110, to: 60, dur: 0.12, vol: big ? 0.3 : 0.18 });
    },
    ground() { S().hiss({ filter: 'lowpass', f: 1500, to: 400, dur: 0.12, vol: 0.06 }); },
    thud() {
      S().tone({ f: 140, to: 80, dur: 0.12, vol: 0.2 });
      S().hiss({ filter: 'lowpass', f: 1200, to: 300, dur: 0.18, vol: 0.12 });
    },
    poof() {
      S().hiss({ f: 3000, to: 1200, q: 0.8, dur: 0.18, vol: 0.14 });
      S().tone({ type: 'sine', f: 900, to: 1400, dur: 0.08, vol: 0.06 });
    },
    // scooping snow: crunchy little scrapes
    scrape() { S().hiss({ filter: 'bandpass', f: 2800 + Math.random() * 1200, q: 2.5, dur: 0.06, vol: 0.07 }); },
    scooped(n) { S().tone({ type: 'triangle', f: 520 + n * 130, dur: 0.09, vol: 0.12 }); },
    step() { S().hiss({ filter: 'bandpass', f: 2200 + Math.random() * 1500, q: 3, dur: 0.045, vol: 0.035 }); },
    empty() { S().tone({ type: 'square', f: 220, to: 180, dur: 0.12, vol: 0.05, lp: 1200 }); },
    // brain freeze: a shivery "brrr" and a wobbly slide down
    freeze() {
      for (let i = 0; i < 8; i++) S().tone({ type: 'square', f: 300 + (i % 2) * 60, dur: 0.05, vol: 0.04, lp: 1600, at: i * 0.055 });
      S().tone({ type: 'sine', f: 900, to: 300, dur: 0.6, vol: 0.08, at: 0.1 });
      S().tone({ type: 'sine', f: 1200, to: 500, dur: 0.6, vol: 0.05, at: 0.25 });
    },
    unfreeze() { [523, 659, 784].forEach((f, i) => S().tone({ type: 'triangle', f, dur: 0.08, vol: 0.08, at: i * 0.05 })); },
    shield() {
      S().hiss({ f: 4000, to: 2000, q: 0.6, dur: 0.3, vol: 0.12 });
      S().tone({ type: 'sine', f: 660, to: 990, dur: 0.15, vol: 0.06 });
    },
    graze() { S().tone({ type: 'triangle', f: 400, to: 700, dur: 0.1, vol: 0.08 }); },
    drop() { [1320, 1760, 2093].forEach((f, i) => S().tone({ type: 'sine', f, dur: 0.12, vol: 0.05, at: i * 0.07 })); },
    pickup() { S().powerup(); },
    special() {
      [523, 659, 784, 1047].forEach((f, i) => S().tone({ type: 'square', f, dur: 0.09, vol: 0.05, lp: 2600, at: i * 0.05 }));
      S().hiss({ f: 1200, to: 3200, dur: 0.3, vol: 0.08 });
    },
    jab() { S().punch(); },
    slam() {
      S().tone({ f: 90, to: 35, dur: 0.45, vol: 0.5 });
      S().hiss({ filter: 'lowpass', f: 1400, to: 200, dur: 0.6, vol: 0.3 });
    },
    // the companion runs in
    buddy() {
      [659, 784, 988].forEach((f, i) => S().tone({ type: 'triangle', f, dur: 0.14, vol: 0.12, at: i * 0.07 }));
      S().hiss({ f: 1200, to: 3000, dur: 0.25, vol: 0.06 });
    },
    treat() { S().coin(3); },
    save() {
      S().powerup();
      S().tone({ type: 'triangle', f: 1047, dur: 0.2, vol: 0.08, at: 0.12 });
    },
    rebuild() { S().tone({ type: 'triangle', f: 330 + Math.random() * 60, to: 500, dur: 0.07, vol: 0.07 }); },
    bye() { [784, 659, 523].forEach((f, i) => S().tone({ type: 'triangle', f, dur: 0.1, vol: 0.07, at: i * 0.07 })); },
    nope() { S().tone({ type: 'square', f: 220, to: 180, dur: 0.12, vol: 0.05, lp: 1200 }); },
    // the referee's whistle before each round
    whistle() {
      S().tone({ type: 'sine', f: 2300, dur: 0.12, vol: 0.06 });
      S().tone({ type: 'sine', f: 2500, dur: 0.25, vol: 0.06, at: 0.14 });
    },
    tick() { S().tone({ type: 'square', f: 1200, dur: 0.04, vol: 0.03, lp: 3000 }); },
    fanfare() {
      [[523, 0], [659, 0.15], [784, 0.3], [1047, 0.45], [784, 0.65], [1047, 0.8]].forEach(([f, at]) => {
        S().tone({ type: 'square', f, dur: 0.22, vol: 0.06, lp: 2600, at });
        S().tone({ type: 'triangle', f: f / 2, dur: 0.25, vol: 0.1, at });
      });
    },
    aww() { S().tone({ type: 'triangle', f: 392, to: 262, dur: 0.6, vol: 0.08 }); },
    cheer() { S().hiss({ f: 1400, to: 1800, q: 0.6, dur: 1.4, vol: 0.1, attack: 0.15 }); },
    click() { S().click(); },
  };
})();
