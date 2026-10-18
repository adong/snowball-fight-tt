/* SnowbaTTle — controls: the keyboard for one or two players, and an on-screen stick and buttons for touch.
   P1: W A S D move, F throw (tap = fast, hold and let go = lob), G scoop (hold) / quick lob (tap), H special, T brother.
   P2: arrows move, J throw, K scoop / lob, L special, Enter brother (numpad 1 2 3 0 work too).
   In 1-player mode both key sets drive P1. Buttons are reported as held; a tap shorter than one frame is still seen
   as pressed for one frame, so the engine sees it go down and up. */
(function () {
  'use strict';

  const KEYS = {
    KeyW: [0, 'up'], KeyA: [0, 'left'], KeyS: [0, 'down'], KeyD: [0, 'right'],
    KeyF: [0, 'throw'], KeyG: [0, 'scoop'], KeyH: [0, 'special'], KeyT: [0, 'buddy'],
    ArrowUp: [1, 'up'], ArrowLeft: [1, 'left'], ArrowDown: [1, 'down'], ArrowRight: [1, 'right'],
    KeyJ: [1, 'throw'], KeyK: [1, 'scoop'], KeyL: [1, 'special'], Enter: [1, 'buddy'], NumpadEnter: [1, 'buddy'],
    Numpad1: [1, 'throw'], Numpad2: [1, 'scoop'], Numpad3: [1, 'special'], Numpad0: [1, 'buddy'],
  };
  const BTN = ['throw', 'scoop', 'special'];

  const held = [{}, {}]; // [side][code] = down
  const tapped = [{}, {}]; // [side][act] = pressed since the last read
  const budLatch = [false, false];
  const touch = { mx: 0, mz: 0, throw: false, scoop: false, special: false };
  const touchTap = {};
  let touchBud = false;
  let twoPlayer = false;
  let enabled = true;

  function setKey(code, down, repeat) {
    const m = KEYS[code];
    if (!m) return false;
    const [side, act] = m;
    if (act === 'buddy') {
      if (down && !repeat) budLatch[side] = true;
      return true;
    }
    held[side][code] = down;
    if (down && !repeat && BTN.includes(act)) tapped[side][act] = true;
    return true;
  }

  function actHeld(side, act) {
    for (const code in held[side]) if (held[side][code] && KEYS[code][1] === act) return true;
    return false;
  }

  // The input for one engine frame: { mx, mz, throwBtn, scoopBtn, specialBtn, buddy }.
  function snapshot(ctrl) {
    const srcs = ctrl === 0 && !twoPlayer ? [0, 1] : [ctrl];
    const out = { mx: 0, mz: 0, throwBtn: false, scoopBtn: false, specialBtn: false, buddy: false };
    for (const s of srcs) {
      if (actHeld(s, 'left')) out.mx -= 1;
      if (actHeld(s, 'right')) out.mx += 1;
      if (actHeld(s, 'up')) out.mz -= 1;
      if (actHeld(s, 'down')) out.mz += 1;
      for (const a of BTN) {
        if (actHeld(s, a) || tapped[s][a]) out[a + 'Btn'] = true;
        tapped[s][a] = false;
      }
      if (budLatch[s]) out.buddy = true;
      budLatch[s] = false;
    }
    if (ctrl === 0) {
      if (Math.abs(touch.mx) > 0.01 || Math.abs(touch.mz) > 0.01) { out.mx = touch.mx; out.mz = touch.mz; }
      for (const a of BTN) {
        if (touch[a] || touchTap[a]) out[a + 'Btn'] = true;
        touchTap[a] = false;
      }
      if (touchBud) out.buddy = true;
      touchBud = false;
    }
    out.mx = Math.max(-1, Math.min(1, out.mx));
    out.mz = Math.max(-1, Math.min(1, out.mz));
    if (!enabled) return { mx: 0, mz: 0, throwBtn: false, scoopBtn: false, specialBtn: false, buddy: false };
    return out;
  }

  function clear() {
    for (const s of [0, 1]) {
      for (const k in held[s]) held[s][k] = false;
      for (const k in tapped[s]) tapped[s][k] = false;
      budLatch[s] = false;
    }
    Object.assign(touch, { mx: 0, mz: 0, throw: false, scoop: false, special: false });
    for (const k in touchTap) touchTap[k] = false;
    touchBud = false;
  }

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (setKey(e.code, true, e.repeat) && (e.code.startsWith('Arrow') || e.code === 'Space')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => setKey(e.code, false, false));
  window.addEventListener('blur', clear);

  // ---------------------------------------------------------------- touch

  const capture = (el, e) => {
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* not an active pointer (synthetic events) */ }
  };

  // A round stick on the left (drag the knob around) and hold-buttons on the right.
  function bindTouch(stick, knob, buttons, budBtn) {
    let finger = null;
    const R = () => stick.getBoundingClientRect().width / 2;
    const move = (e) => {
      const r = stick.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const rad = R(), d = Math.hypot(dx, dy);
      if (d > rad) { dx *= rad / d; dy *= rad / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const k = Math.min(1, d / rad);
      const dead = 0.18;
      const mag = k < dead ? 0 : (k - dead) / (1 - dead);
      touch.mx = d ? (dx / Math.hypot(dx, dy)) * mag : 0;
      touch.mz = d ? (dy / Math.hypot(dx, dy)) * mag : 0;
    };
    const release = (e) => {
      if (e.pointerId !== finger) return;
      finger = null;
      touch.mx = touch.mz = 0;
      knob.style.transform = '';
      stick.classList.remove('down');
    };
    stick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      finger = e.pointerId;
      capture(stick, e);
      stick.classList.add('down');
      move(e);
    });
    stick.addEventListener('pointermove', (e) => {
      if (e.pointerId === finger) move(e);
    });
    stick.addEventListener('pointerup', release);
    stick.addEventListener('pointercancel', release);
    for (const b of buttons) {
      const act = b.dataset.act;
      const up = () => {
        touch[act] = false;
        b.classList.remove('down');
      };
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        capture(b, e);
        touch[act] = true;
        touchTap[act] = true;
        b.classList.add('down');
      });
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
    }
    if (budBtn) {
      budBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        touchBud = true;
      });
    }
  }

  window.SBInput = {
    snapshot, clear, bindTouch, KEYS,
    setTwoPlayer(on) { twoPlayer = !!on; },
    setEnabled(on) { enabled = !!on; if (!on) clear(); },
    callBuddy(side) { if (side === 0) touchBud = true; else budLatch[side] = true; },
  };
})();
