/* SnowbaTTle — the engine: the whole snowball fight as plain state, stepped at a fixed 60 frames a second.
   No Three.js and no DOM, so the same code runs the browser game (js/game.js draws it) and the headless soak test
   (tools/soak.js runs it in node). Everything that happens is pushed onto match.events for the renderer.

   The yard: x runs left-right, z runs toward the camera. A low line at x = 0 splits it; side 0 (left) throws toward
   +x and side 1 (right) toward -x. Each side has two snow forts made of 4 pieces that are 3 bricks high, plus a
   snowman and a pine tree to hide behind. */
(function () {
  'use strict';
  const SB = (globalThis.SB = globalThis.SB || {});
  const DT = 1 / 60;
  const GRAV = 9.8;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // Everything worth tuning, in one place.
  const TUNE = {
    speed: 4.3, // m/s
    scoopSpeed: 0.3, // you're slow while scooping
    hitSpeed: 0.5, // and for a moment after a splat
    chargeSpeed: 0.8, // and while holding a lob
    maxAmmo: 3, startAmmo: 2, scoopTime: 0.85, // a snowball per 0.85 s of scooping
    tapMax: 0.22, // a press shorter than this is a tap (fast throw); longer is a hold (lob)
    scoopDelay: 0.16, // the scoop key: a quick tap lobs, holding it scoops
    throwWind: 0.12, throwAnim: 0.36, // the arm winds up, then the ball leaves the hand
    straightSpeed: 15, giantSpeed: 11.5,
    lobBase: 1.15, lobPerM: 0.025, // lob flight time: 1.15 s plus 0.025 s per metre
    ballR: 0.13, giantR: 0.42,
    hitStun: 0.35, dizzy: 2.0, dizzyGrace: 0.8, streakFor: 3, streakTime: 5,
    meterHit: 0.25, meterTaken: 0.08,
    toWin: 10, roundsToWin: 2, roundTime: 90, intro: 2.4, outro: 3.4, meltEvery: 1.5,
    dropFirst: 6, dropEvery: [8, 11], dropLife: 14,
    cocoa: 8, triple: 3,
    buddyLife: 10, buddyLife2p: 8, buddyRest2p: 18, buddyThrow: 2.6, treatGap: 1.5, buddySpeed: 4.8,
  };

  const A = { halfW: 10.4, halfD: 4.5, mid: 0.75 }; // the yard; nobody gets closer than `mid` to the line
  const PR = 0.38; // a person's footprint, for walking into things
  const HURT_R = 0.42; // a person's body, for snowballs
  const H_STAND = 1.85, H_LOW = 1.0;
  const LVL_H = [0, 0.42, 0.78, 1.12]; // fort height by bricks left
  const FORT = { x: 3.8, zs: [-2.3, 2.3], segs: 4, segLen: 0.6, half: 0.3 };
  const OBST = [
    { kind: 'snowman', x: 8.4, z: -2.9, r: 0.55, h: 1.75 },
    { kind: 'tree', x: 9.6, z: 2.5, r: 0.5, h: 2.6 },
  ];

  // Specials: wind = time before the first ball, shots fired `gap` apart, `spread` balls per shot (a fan `fan` radians
  // apart, or a ✌️ V `fan` metres apart for lobs), giant balls, lobs, and a jump (in metres) for the slam dunks.
  const SPECIALS = {
    boxing: { name: 'BOXING FLURRY', icon: '🥊', pose: 'boxing', wind: 0.15, shots: 3, gap: 0.2 },
    jumpshot: { name: 'JUMP SHOT SLAM', icon: '🏀', pose: 'jumpshot', wind: 0.45, jump: 1.6, giant: true, lob: true, slam: true },
    peace: { name: 'PEACE SPREAD', icon: '✌️', pose: 'peace', wind: 0.6, shots: 2, gap: 0.3, spread: 5, fan: 0.1 },
    peaceRain: { name: 'PEACE RAIN', icon: '✌️', pose: 'peace', wind: 0.6, shots: 2, gap: 0.3, spread: 5, fan: 0.85, lob: true },
    flurry: { name: 'ZOOM FLURRY', icon: '💨', pose: 'boxing', wind: 0.1, shots: 4, gap: 0.14 },
    moon: { name: 'MOON RAIN', icon: '🌙', pose: 'jumpshot', wind: 0.4, shots: 2, gap: 0.3, spread: 3, fan: 0.9, lob: true },
    cannon: { name: 'SNOW CANNON', icon: '⚡', pose: 'straight', wind: 0.35, shots: 2, gap: 0.35, giant: true },
    bearslam: { name: 'BEAR SLAM', icon: '🐻', pose: 'jumpshot', wind: 0.45, jump: 1.2, giant: true, lob: true, slam: true },
    boo: { name: 'BOO-BALLS', icon: '👻', pose: 'wave', wind: 0.4, shots: 2, gap: 0.3, spread: 3, fan: 0.16 },
    avalanche: { name: 'AVALANCHE', icon: '⛄', pose: 'jumpshot', wind: 0.5, giant: true, lob: true, slam: true },
  };
  // Each character's special: [tap, hold]. Tapping is the straight version, holding the lob (like throwing).
  const CHARS = {
    teddy: { name: 'TEDDY', specials: ['boxing', 'jumpshot'] },
    tommy: { name: 'TOMMY', specials: ['peace', 'peaceRain'] },
    zoom: { name: 'ZOOM', specials: ['flurry', 'flurry'] },
    luna: { name: 'LUNA', specials: ['moon', 'moon'] },
    bolt: { name: 'BOLT', specials: ['cannon', 'cannon'] },
    bruno: { name: 'BRUNO', specials: ['bearslam', 'bearslam'] },
    zombie: { name: 'ZOMBIE', specials: ['boo', 'boo'] },
    snowman: { name: 'SNOWY', specials: ['avalanche', 'avalanche'] },
  };
  const POWERUPS = {
    giant: { name: 'GIANT SNOWBALL', icon: '❄️' },
    triple: { name: 'TRIPLE THROW', icon: '✌️' },
    shovel: { name: 'SNOW SHOVEL', icon: '🏰' },
    cocoa: { name: 'HOT COCOA SHIELD', icon: '☕' },
  };
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];
  // Co-op: the Snow Crew gets a little tougher each round.
  const COOP_WAVES = [
    [['snowman', 'SNOWY'], ['snowman', 'CHILLY']],
    [['snowman', 'SNOWY'], ['bolt', 'BOLT']],
    [['bolt', 'BOLT'], ['snowman', 'CHILLY'], ['bolt', 'VOLT']],
  ];
  const STAND_INS = ['zoom', 'luna', 'bruno', 'bolt'];

  // ---------------------------------------------------------------- making a match

  // cfg: { mode: '1p' | '2p' | 'coop' | 'demo', level: 'easy' | 'normal',
  //        teams: [[{ char, human, ctrl, level, name }], [...]] }  (co-op builds team 1 from COOP_WAVES)
  function create(cfg) {
    const m = {
      cfg, mode: cfg.mode || '1p', level: cfg.level || 'normal',
      t: 0, frame: 0, nextId: 1, round: 0, phase: 'intro', phaseT: 0,
      score: [0, 0], rounds: [0, 0], timeLeft: TUNE.roundTime, sudden: false, winner: -1, roundWinner: -1,
      players: [], balls: [], segs: [], obst: [], pickups: [], buddies: [],
      dropT: TUNE.dropFirst, dropSide: Math.random() < 0.5 ? 0 : 1, treatI: Math.floor(Math.random() * TREATS.length),
      events: [], log: [],
    };
    for (let side = 0; side < 2; side++) {
      const sx = side === 0 ? -1 : 1;
      FORT.zs.forEach((zc, f) => {
        for (let i = 0; i < FORT.segs; i++) {
          const z0 = zc - (FORT.segs * FORT.segLen) / 2 + i * FORT.segLen;
          m.segs.push({ id: m.segs.length, side, fort: side * 2 + f, i, x: sx * FORT.x, z0, z1: z0 + FORT.segLen, zc: z0 + FORT.segLen / 2, lvl: 3 });
        }
      });
      for (const o of OBST) m.obst.push(Object.assign({}, o, { id: m.obst.length, side, x: sx * o.x }));
    }
    for (let side = 0; side < 2; side++) {
      const specs = m.mode === 'coop' && side === 1 ? coopWave(m, 0) : cfg.teams[side];
      specs.forEach((s, i) => m.players.push(makePlayer(m, side, i, s)));
    }
    pickBuddies(m);
    startRound(m);
    return m;
  }

  function coopWave(m, round) {
    const wave = COOP_WAVES[Math.min(round, COOP_WAVES.length - 1)];
    const robot = m.level === 'easy' ? 'easy' : 'robot';
    return wave.map(([char, name], i) => ({ char, name, level: char === 'snowman' ? 'snowman' : robot, alt: i }));
  }

  function makePlayer(m, side, slot, s) {
    return {
      id: m.nextId++, side, slot, char: s.char, name: s.name || (CHARS[s.char] || CHARS.teddy).name,
      human: !!s.human, ctrl: s.human ? s.ctrl || 0 : -1, level: s.level || 'normal', alt: s.alt || 0,
      face: side === 0 ? 1 : -1, x: 0, z: 0, y: 0, vx: 0, vz: 0, heading: side === 0 ? 1 : -1,
      ammo: TUNE.startAmmo, scoopT: 0, scooping: false, charging: false, throwT: 0, pend: null, aim: null,
      state: 'ok', stateT: 0, streak: 0, streakT: 0, inv: 0, meter: 0, shieldT: 0, giant: 0, triple: 0,
      duck: false, moving: false, hurtH: H_STAND, spec: null, btn: {}, brain: null,
      buddyChar: null, budRest: 0, budTreatT: 0,
      stats: { thrown: 0, hits: 0, taken: 0, freezes: 0, treats: 0, saves: 0, specials: 0, calls: 0 },
    };
  }

  // Your companion is the other brother, unless he's already playing; then a friend from the roster stands in.
  function pickBuddies(m) {
    const inPlay = new Set(m.players.map((p) => p.char));
    const taken = new Set();
    for (const p of m.players) {
      if (m.mode === 'coop' && p.side === 1) continue; // the Snow Crew doesn't get one
      let id = p.char === 'tommy' ? 'teddy' : 'tommy';
      if (inPlay.has(id) || taken.has(id)) id = STAND_INS.find((c) => !inPlay.has(c) && !taken.has(c)) || 'bruno';
      taken.add(id);
      p.buddyChar = id;
    }
  }

  function spawnSpots(n) {
    return n === 1 ? [0] : n === 2 ? [-1.8, 1.8] : [-2.8, 0, 2.8];
  }

  function startRound(m) {
    if (m.mode === 'coop' && m.round > 0) {
      m.players = m.players.filter((p) => p.side === 0);
      coopWave(m, m.round).forEach((s, i) => m.players.push(makePlayer(m, 1, i, s)));
      m.events.push({ type: 'lineup' });
    }
    m.round++;
    m.score = [0, 0];
    m.timeLeft = TUNE.roundTime;
    m.sudden = false;
    m.meltT = 0;
    m.roundWinner = -1;
    m.balls.length = 0;
    m.pickups.length = 0;
    m.buddies.length = 0;
    m.dropT = TUNE.dropFirst;
    for (const s of m.segs) s.lvl = 3;
    for (let side = 0; side < 2; side++) {
      const team = m.players.filter((p) => p.side === side);
      const zs = spawnSpots(team.length);
      team.forEach((p, i) => {
        Object.assign(p, {
          x: (side === 0 ? -1 : 1) * 6.6, z: zs[i], y: 0, vx: 0, vz: 0, heading: p.face,
          ammo: TUNE.startAmmo, scoopT: 0, scooping: false, charging: false, throwT: 0, pend: null,
          state: 'ok', stateT: 0, streak: 0, streakT: 0, inv: 0, shieldT: 0, giant: 0, triple: 0, spec: null, btn: {},
        });
        p.brain = null;
      });
    }
    m.phase = 'intro';
    m.phaseT = TUNE.intro;
    m.events.push({ type: 'roundStart', round: m.round });
  }

  // ---------------------------------------------------------------- stepping

  // inputs[ctrl] = { mx, mz, throwBtn, scoopBtn, specialBtn, buddy } for the human players (buttons are held states,
  // buddy is a press). CPU players ask SB.cpu.think for the same kind of action.
  function step(m, dt, inputs) {
    m.acc = (m.acc || 0) + dt;
    let n = 0;
    while (m.acc >= DT && n < 12) {
      m.acc -= DT;
      tick(m, inputs || []);
      n++;
    }
    if (n === 12) m.acc = 0;
  }

  function tick(m, inputs) {
    const dt = DT;
    m.t += dt;
    m.frame++;
    if (m.phase === 'intro') {
      m.phaseT -= dt;
      if (m.phaseT <= 0) {
        m.phase = 'play';
        m.events.push({ type: 'go' });
      }
    } else if (m.phase === 'play') {
      m.timeLeft -= dt;
      if (m.timeLeft <= 10 && m.timeLeft + dt > 10) m.events.push({ type: 'timeWarn' });
      if (m.timeLeft <= 0 && !m.sudden) {
        m.timeLeft = 0;
        if (m.score[0] !== m.score[1]) endRound(m, m.score[0] > m.score[1] ? 0 : 1, 'time');
        else {
          m.sudden = true;
          m.events.push({ type: 'sudden' });
        }
      }
      if (m.sudden) melt(m, dt);
      updateDrops(m, dt);
    } else if (m.phase === 'outro') {
      m.phaseT -= dt;
      if (m.phaseT <= 0) {
        if (m.rounds[m.roundWinner] >= TUNE.roundsToWin) {
          m.phase = 'over';
          m.winner = m.roundWinner;
          m.events.push({ type: 'matchOver', side: m.winner });
        } else startRound(m);
      }
    }
    for (const p of m.players) {
      let act;
      if (p.human) act = readHuman(p, inputs[p.ctrl] || {}, dt, m);
      else act = SB.cpu ? SB.cpu.think(m, p, dt) : null;
      updatePlayer(m, p, act || NO_ACT, dt);
    }
    for (let i = m.buddies.length - 1; i >= 0; i--) updateBuddy(m, m.buddies[i], dt);
    updateBalls(m, dt);
  }

  const NO_ACT = { mx: 0, mz: 0, act: null, scoop: false, buddy: false };

  // Turn held buttons into actions: a tap of throw is a fast throw, a hold-and-release is a lob; a tap of the scoop
  // key lobs too, holding it scoops; the special works like throw (tap = straight version, hold = lob version).
  function readHuman(p, inp, dt, m) {
    const b = p.btn;
    const a = { mx: +inp.mx || 0, mz: +inp.mz || 0, act: null, scoop: false, buddy: !!inp.buddy };
    if (inp.throwBtn) {
      if (!b.th) { b.th = true; b.tt = 0; } else b.tt += dt;
    } else if (b.th) {
      b.th = false;
      a.act = b.tt < TUNE.tapMax ? 'throw' : 'lob';
    }
    p.charging = !!(b.th && b.tt >= TUNE.tapMax && (p.ammo > 0 || p.giant));
    if (inp.scoopBtn) {
      if (!b.sh) { b.sh = true; b.st = 0; b.scooped = false; } else b.st += dt;
      if (b.st >= TUNE.scoopDelay || (p.ammo === 0 && !p.giant)) { a.scoop = true; b.scooped = true; }
    } else if (b.sh) {
      b.sh = false;
      if (!b.scooped && (p.ammo > 0 || p.giant)) a.act = a.act || 'lob';
    }
    if (inp.specialBtn) {
      if (!b.ph) { b.ph = true; b.pt = 0; } else b.pt += dt;
    } else if (b.ph) {
      b.ph = false;
      a.act = b.pt < TUNE.tapMax ? 'special' : 'specialHold';
    }
    if (m.phase !== 'play') a.act = null;
    return a;
  }

  function updatePlayer(m, p, a, dt) {
    if (p.forceAct) { a = Object.assign({}, a, { act: p.forceAct }); p.forceAct = null; } // test hooks
    p.inv = Math.max(0, p.inv - dt);
    p.shieldT = Math.max(0, p.shieldT - dt);
    p.budRest = Math.max(0, p.budRest - dt);
    p.budTreatT = Math.max(0, p.budTreatT - dt);
    p.throwT = Math.max(0, p.throwT - dt);
    if (p.streakT > 0 && (p.streakT -= dt) <= 0) p.streak = 0;
    if (a.buddy) callBuddy(m, p);

    if (p.state === 'hit' && (p.stateT -= dt) <= 0) p.state = 'ok';
    if (p.state === 'dizzy' && (p.stateT -= dt) <= 0) {
      p.state = 'ok';
      p.inv = TUNE.dizzyGrace;
    }
    if (p.state === 'special') updateSpecial(m, p, dt);

    const can = m.phase === 'play' && (p.state === 'ok' || p.state === 'hit');
    let mx = can ? a.mx : 0, mz = can ? a.mz : 0;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }

    // scooping: crouched in the snow, one snowball per scoopTime
    p.scooping = can && p.state === 'ok' && a.scoop && p.ammo < TUNE.maxAmmo && p.throwT <= 0;
    if (p.scooping) {
      p.scoopT += dt;
      if (p.scoopT >= TUNE.scoopTime) {
        p.scoopT = 0;
        p.ammo++;
        m.events.push({ type: 'scooped', pid: p.id, ammo: p.ammo });
      }
    } else p.scoopT = Math.max(0, p.scoopT - dt * 2);
    if (!can) p.charging = false;

    const sp = TUNE.speed * (p.scooping ? TUNE.scoopSpeed : 1) * (p.state === 'hit' ? TUNE.hitSpeed : 1) * (p.charging ? TUNE.chargeSpeed : 1);
    const k = Math.min(1, dt * 14);
    p.vx += (mx * sp - p.vx) * k;
    p.vz += (mz * sp - p.vz) * k;
    if (p.state === 'dizzy' || p.state === 'special' || m.phase !== 'play') {
      p.vx *= 0.8;
      p.vz *= 0.8;
    }
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    collideBody(m, p, PR);
    keepInside(p, p.side);
    p.moving = Math.hypot(p.vx, p.vz) > 0.6;
    if (p.moving && Math.abs(p.vx) > 0.3) p.heading = Math.sign(p.vx);

    // ducking: standing still right behind a fort piece that's still at least 2 bricks high
    p.duck = p.state === 'ok' && !p.moving && p.throwT <= 0 && !p.charging && m.phase === 'play' && !!coverFor(m, p);
    p.hurtH = p.duck || p.scooping ? H_LOW : H_STAND;

    if (can && a.act && p.state === 'ok') {
      if (a.act === 'throw' || a.act === 'lob') startThrow(m, p, a.act === 'lob');
      else startSpecial(m, p, a.act === 'specialHold');
    }
    if (p.pend && (p.pend.t -= dt) <= 0) releaseThrow(m, p);

    // pick up power-ups by walking over them
    for (let i = m.pickups.length - 1; i >= 0; i--) {
      const u = m.pickups[i];
      if (u.side === p.side && u.y < 0.6 && Math.hypot(u.x - p.x, u.z - p.z) < 0.95 && p.state !== 'dizzy') {
        m.pickups.splice(i, 1);
        applyPickup(m, p, u.kind);
      }
    }
  }

  function keepInside(o, side) {
    if (side === 0) o.x = clamp(o.x, -A.halfW, -A.mid);
    else o.x = clamp(o.x, A.mid, A.halfW);
    o.z = clamp(o.z, -A.halfD, A.halfD);
  }

  // Push a walker (circle of radius r) out of fort pieces and obstacles.
  function collideBody(m, o, r) {
    for (const s of m.segs) {
      if (s.lvl <= 0 || Math.abs(s.x - o.x) > 1.5 || o.z < s.z0 - 1 || o.z > s.z1 + 1) continue;
      const cx = clamp(o.x, s.x - FORT.half, s.x + FORT.half), cz = clamp(o.z, s.z0, s.z1);
      let dx = o.x - cx, dz = o.z - cz;
      const d = Math.hypot(dx, dz);
      if (d < r) {
        if (d < 1e-4) { dx = o.side === 0 || o.x < s.x ? -1 : 1; dz = 0; }
        const n = d < 1e-4 ? 1 : d;
        o.x = cx + (dx / n) * r;
        o.z = cz + (dz / n) * r;
      }
    }
    for (const b of m.obst) {
      const dx = o.x - b.x, dz = o.z - b.z, d = Math.hypot(dx, dz), min = r + b.r;
      if (d < min && d > 1e-4) {
        o.x = b.x + (dx / d) * min;
        o.z = b.z + (dz / d) * min;
      }
    }
  }

  // The fort piece just in front of someone (toward the line), if it's tall enough to duck behind.
  function coverFor(m, p, minLvl = 2) {
    for (const s of m.segs) {
      if (s.side !== p.side || s.lvl < minLvl) continue;
      const ahead = (s.x - p.x) * p.face;
      if (ahead > 0 && ahead < 1.7 && p.z > s.z0 - 0.3 && p.z < s.z1 + 0.3) return s;
    }
    return null;
  }

  // ---------------------------------------------------------------- throwing

  // Auto-aim: the nearest opponent, preferring the one in your lane, and leaving brain-frozen kids alone.
  function pickTarget(m, p) {
    let best = null, bs = 1e9;
    for (const q of m.players) {
      if (q.side === p.side) continue;
      const s = Math.abs(q.z - p.z) * 1.4 + Math.abs(q.x - p.x) * 0.4 + (q.state === 'dizzy' || q.inv > 0 ? 8 : 0);
      if (s < bs) { bs = s; best = q; }
    }
    return best;
  }

  function startThrow(m, p, lob) {
    if (p.throwT > 0.08 || p.pend) return;
    if (p.ammo <= 0 && !p.giant) {
      m.events.push({ type: 'empty', pid: p.id });
      return;
    }
    const t = pickTarget(m, p);
    if (!t) return;
    p.throwT = TUNE.throwAnim;
    p.throwLob = lob;
    p.pend = { t: TUNE.throwWind, lob, tgt: t.id };
    p.aim = t.id;
    p.charging = false;
  }

  function releaseThrow(m, p) {
    const pend = p.pend;
    p.pend = null;
    const t = m.players.find((q) => q.id === pend.tgt && q.side !== p.side) || pickTarget(m, p);
    if (!t) return;
    const giant = p.giant > 0;
    if (giant) p.giant = 0;
    else if (p.ammo > 0) p.ammo--;
    else return;
    const triple = !giant && p.triple > 0;
    if (triple) p.triple--;
    const n = triple ? 3 : 1;
    const L = p.human ? { lead: 0.55, err: 0 } : (SB.cpu && SB.cpu.aimFor(p)) || { lead: 0.3, err: 0.5 };
    for (let i = 0; i < n; i++) {
      spawnBall(m, p, p, t, { lob: pend.lob, giant, fan: i - (n - 1) / 2, fanStep: pend.lob ? 1.3 : 0.2, lead: L.lead, err: L.err });
    }
    p.stats.thrown++;
    m.events.push({ type: 'throw', pid: p.id, lob: pend.lob, giant, triple, x: p.x, z: p.z });
  }

  // Launch a snowball from `src` (a player or a companion) toward target `t`, scoring for `owner`.
  // o: lob, giant, slam, fan (index from the middle), fanStep (radians, or metres for lobs), vee (✌️ shape), lead, err.
  function spawnBall(m, owner, src, t, o) {
    const face = src.side === 0 ? 1 : -1;
    const x0 = src.x + face * 0.4, y0 = 1.75 + (src.y || 0), z0 = src.z + 0.12;
    let tx = t.x, tz = t.z;
    const err = o.err || 0;
    if (err) { tx += rand(-err, err) * 0.5; tz += rand(-err, err); }
    const giant = !!o.giant;
    const dist0 = Math.hypot(tx - x0, tz - z0);
    let T = o.lob ? TUNE.lobBase + TUNE.lobPerM * dist0 : dist0 / (giant ? TUNE.giantSpeed : TUNE.straightSpeed);
    if (o.lead) { tx += t.vx * T * o.lead; tz += t.vz * T * o.lead; }
    const fan = o.fan || 0;
    let vx, vy, vz, ty;
    if (o.lob) {
      if (fan) {
        // a ✌️ V of landing spots: sideways by fanStep, and the outer ones further back
        const dx = tx - x0, dz = tz - z0, d = Math.hypot(dx, dz) || 1;
        const px = -dz / d, pz = dx / d;
        tx += px * fan * o.fanStep + (dx / d) * Math.abs(fan) * 0.7;
        tz += pz * fan * o.fanStep + (dz / d) * Math.abs(fan) * 0.7;
      }
      tz = clamp(tz, -A.halfD - 0.4, A.halfD + 0.4);
      T = TUNE.lobBase + TUNE.lobPerM * Math.hypot(tx - x0, tz - z0);
      ty = t.hurtH < H_STAND ? 1.05 : 1.6; // drop in on the head, steep enough to clear the fort in front
      vx = (tx - x0) / T;
      vz = (tz - z0) / T;
    } else {
      ty = t.hurtH < H_STAND ? 0.55 : 1.3; // aim at the chest, or low at someone ducking
      const d = Math.hypot(tx - x0, tz - z0) || 1;
      const sp = giant ? TUNE.giantSpeed : TUNE.straightSpeed;
      T = d / sp;
      const ang = fan * (o.fanStep || 0.2);
      const ux = (tx - x0) / d, uz = (tz - z0) / d;
      const c = Math.cos(ang), s = Math.sin(ang);
      vx = (ux * c - uz * s) * sp;
      vz = (ux * s + uz * c) * sp;
    }
    vy = (ty - y0 + 0.5 * GRAV * T * T) / T;
    const b = {
      id: m.nextId++, side: src.side, owner: owner.id, src: src.id, x: x0, y: y0, z: z0, vx, vy, vz,
      r: giant ? TUNE.giantR : TUNE.ballR, giant, lob: !!o.lob, slam: !!o.slam, pts: giant ? 2 : 1, dmg: giant ? 3 : 1,
      age: 0, tx, tz, flight: T,
    };
    m.balls.push(b);
    return b;
  }

  // Would a straight throw at `t` hit a fort piece or an obstacle first? (for the CPU's choice of straight or lob)
  function lineBlocked(m, p, t) {
    const face = p.side === 0 ? 1 : -1;
    const x0 = p.x + face * 0.4, y0 = 1.75, z0 = p.z + 0.12;
    const ty = t.duck || t.scooping ? 0.55 : 1.3;
    const d = Math.hypot(t.x - x0, t.z - z0) || 1;
    const T = d / TUNE.straightSpeed;
    const vy = (ty - y0 + 0.5 * GRAV * T * T) / T;
    for (let i = 1; i < 24; i++) {
      const tt = (T * i) / 24;
      const x = x0 + (t.x - x0) * (i / 24), z = z0 + (t.z - z0) * (i / 24), y = y0 + vy * tt - 0.5 * GRAV * tt * tt;
      for (const s of m.segs) if (s.lvl > 0 && s.side !== p.side && segHit(s, x, y, z, TUNE.ballR)) return s;
      for (const o of m.obst) if (Math.hypot(o.x - x, o.z - z) < o.r + TUNE.ballR && y < o.h) return o;
    }
    return null;
  }

  function segHit(s, x, y, z, r) {
    const dx = Math.max(Math.abs(x - s.x) - FORT.half, 0);
    const dz = Math.max(Math.abs(z - s.zc) - FORT.segLen / 2, 0);
    const dy = Math.max(y - LVL_H[s.lvl], 0);
    return dx * dx + dz * dz + dy * dy < r * r;
  }

  // ---------------------------------------------------------------- specials

  function startSpecial(m, p, hold) {
    if (p.meter < 1 || p.throwT > 0.08 || p.pend) {
      if (p.meter < 1) m.events.push({ type: 'notReady', pid: p.id });
      return;
    }
    const ids = (CHARS[p.char] || CHARS.teddy).specials;
    const key = ids[hold ? 1 : 0];
    p.meter = 0;
    p.state = 'special';
    p.spec = { key, def: SPECIALS[key], t: 0, fired: 0 };
    p.stats.specials++;
    p.scooping = false;
    m.events.push({ type: 'special', pid: p.id, key, name: SPECIALS[key].name, icon: SPECIALS[key].icon });
  }

  function updateSpecial(m, p, dt) {
    const sp = p.spec, d = sp.def;
    sp.t += dt;
    const shots = d.shots || 1, gap = d.gap || 0;
    const total = d.wind + (shots - 1) * gap + 0.35;
    if (d.jump) p.y = d.jump * Math.sin(Math.PI * Math.min(1, sp.t / (d.wind * 2)));
    while (sp.fired < shots && sp.t >= d.wind + sp.fired * gap) {
      const t = pickTarget(m, p);
      if (t) {
        const n = d.spread || 1;
        for (let i = 0; i < n; i++) {
          spawnBall(m, p, p, t, {
            lob: !!d.lob, giant: !!d.giant, slam: !!d.slam, fan: i - (n - 1) / 2, fanStep: d.fan || (d.lob ? 1.15 : 0.21),
            lead: p.human ? 0.5 : 0.3, err: p.human ? 0 : 0.3,
          });
        }
      }
      sp.fired++;
      m.events.push({ type: 'specialShot', pid: p.id, key: sp.key, n: sp.fired });
    }
    if (sp.t >= Math.max(total, d.jump ? d.wind * 2 : 0)) {
      if (d.jump) m.events.push({ type: 'land', pid: p.id });
      p.y = 0;
      p.state = 'ok';
      p.spec = null;
      p.throwT = 0.2;
    }
  }

  // ---------------------------------------------------------------- snowballs in flight

  function updateBalls(m, dt) {
    const steps = 2, h = dt / steps;
    for (const b of m.balls.slice()) {
      if (m.balls.indexOf(b) < 0) continue; // the round ended under it
      let gone = false;
      for (let s = 0; s < steps && !gone; s++) {
        b.vy -= GRAV * h;
        b.x += b.vx * h;
        b.y += b.vy * h;
        b.z += b.vz * h;
        b.age += h;
        gone = collideBall(m, b);
      }
      if (!gone && (Math.abs(b.x) > 14 || Math.abs(b.z) > 8 || b.age > 6)) gone = true;
      const i = m.balls.indexOf(b);
      if (gone && i >= 0) m.balls.splice(i, 1);
    }
    // two snowballs meeting in the air go POOF
    for (let i = 0; i < m.balls.length; i++) {
      for (let j = i + 1; j < m.balls.length; j++) {
        const a = m.balls[i], b = m.balls[j];
        if (a.side === b.side || a.lob || b.lob) continue;
        const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z, r = a.r + b.r + 0.12;
        if (dx * dx + dy * dy + dz * dz < r * r) {
          m.events.push({ type: 'poof', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
          if (!b.giant) m.balls.splice(j, 1);
          if (!a.giant) { m.balls.splice(i, 1); i--; }
          break;
        }
      }
    }
  }

  // Returns true when the ball is used up.
  function collideBall(m, b) {
    // people on the other side (lobs only hit on the way down)
    if (!b.lob || b.vy < 0) {
      for (const p of m.players) {
        if (p.side === b.side) continue;
        const dx = p.x - b.x, dz = p.z - b.z, r = HURT_R + b.r;
        if (dx * dx + dz * dz < r * r && b.y < p.y + p.hurtH + b.r && b.y > p.y - b.r) {
          ballHitsPlayer(m, b, p);
          if (b.slam) slam(m, b, p);
          return true;
        }
      }
    }
    for (const s of m.segs) {
      if (s.lvl <= 0 || (s.side === b.side && b.age < 0.15) || (b.slam && b.vy > 0)) continue;
      if (segHit(s, b.x, b.y, b.z, b.r)) {
        chip(m, s, b.dmg, b);
        if (b.giant) for (const n of m.segs) if (n.fort === s.fort && Math.abs(n.i - s.i) === 1) chip(m, n, 1, null);
        if (b.slam) slam(m, b, null);
        return true;
      }
    }
    for (const o of m.obst) {
      const dx = o.x - b.x, dz = o.z - b.z;
      if (dx * dx + dz * dz < (o.r + b.r) * (o.r + b.r) && b.y < o.h) {
        m.events.push({ type: 'thud', obst: o.id, x: b.x, y: b.y, z: b.z, giant: b.giant });
        if (b.slam) slam(m, b, null);
        return true;
      }
    }
    if (b.y < b.r * 0.6) {
      m.events.push({ type: 'ground', x: b.x, z: b.z, giant: b.giant, side: b.side });
      if (b.slam) slam(m, b, null);
      return true;
    }
    return false;
  }

  function chip(m, s, dmg, b) {
    if (s.lvl <= 0) return;
    s.lvl = Math.max(0, s.lvl - dmg);
    m.events.push({ type: 'fort', seg: s.id, lvl: s.lvl, x: b ? b.x : s.x, y: b ? b.y : 0.6, z: b ? b.z : s.zc, giant: !!(b && b.giant) });
  }

  // A slam dunk lands: everyone else close by gets splashed too, and fort pieces nearby lose two bricks.
  function slam(m, b, direct) {
    m.events.push({ type: 'slam', x: b.x, z: b.z, side: b.side });
    for (const p of m.players) {
      if (p.side === b.side || p === direct) continue;
      if (Math.hypot(p.x - b.x, p.z - b.z) < 1.6) ballHitsPlayer(m, Object.assign({}, b, { pts: 1, giant: false, splash: true }), p);
    }
    for (const s of m.segs) if (s.lvl > 0 && Math.hypot(s.x - b.x, s.zc - b.z) < 1.4) chip(m, s, 2, null);
  }

  function ballHitsPlayer(m, b, p) {
    const at = { x: b.x, y: b.y, z: b.z };
    if (m.phase !== 'play') {
      m.events.push(Object.assign({ type: 'graze', pid: p.id }, at));
      return;
    }
    if (p.state === 'dizzy' || p.inv > 0) {
      m.events.push(Object.assign({ type: 'graze', pid: p.id }, at)); // brain-frozen kids are left alone
      return;
    }
    if (p.shieldT > 0) {
      m.events.push(Object.assign({ type: 'shield', pid: p.id }, at));
      return;
    }
    const bud = m.buddies.find((u) => u.owner === p.id && u.save && u.state !== 'out');
    if (bud) {
      bud.save = false;
      p.stats.saves++;
      m.events.push(Object.assign({ type: 'saved', pid: p.id, bud: bud.id, name: bud.name }, at));
      return;
    }
    const owner = m.players.find((q) => q.id === b.owner);
    m.score[b.side] += b.pts;
    p.stats.taken++;
    p.meter = Math.min(1, p.meter + TUNE.meterTaken);
    if (owner) {
      owner.stats.hits++;
      owner.meter = Math.min(1, owner.meter + (b.giant ? 0.35 : TUNE.meterHit));
      owner.streak = 0; // hitting back breaks your own streak
    }
    p.streak++;
    p.streakT = TUNE.streakTime;
    p.scooping = false;
    p.pend = null;
    if (p.state === 'special') {
      p.spec = null;
      p.y = 0;
    }
    const byBuddy = b.src !== b.owner;
    if (p.streak >= TUNE.streakFor) {
      p.streak = 0;
      p.state = 'dizzy';
      p.stateT = TUNE.dizzy;
      p.stats.freezes++;
      m.events.push(Object.assign({ type: 'hit', pid: p.id, by: b.owner, pts: b.pts, giant: b.giant, buddy: byBuddy, splash: !!b.splash }, at));
      m.events.push({ type: 'freeze', pid: p.id });
    } else {
      p.state = 'hit';
      p.stateT = TUNE.hitStun;
      p.vx += Math.sign(b.vx) * 2.2;
      m.events.push(Object.assign({ type: 'hit', pid: p.id, by: b.owner, pts: b.pts, giant: b.giant, buddy: byBuddy, splash: !!b.splash }, at));
    }
    if (m.score[b.side] >= TUNE.toWin || m.sudden) endRound(m, b.side, m.sudden ? 'sudden' : 'score');
  }

  function endRound(m, side, reason) {
    if (m.phase !== 'play') return;
    m.phase = 'outro';
    m.phaseT = TUNE.outro;
    m.roundWinner = side;
    m.rounds[side]++;
    m.balls.length = 0;
    m.pickups.length = 0;
    for (const p of m.players) {
      p.state = p.side === side ? 'celebrate' : 'sad';
      p.stateT = 0;
      p.spec = null;
      p.y = 0;
      p.pend = null;
      p.scooping = p.charging = false;
    }
    for (const u of m.buddies) if (u.state !== 'out') { u.state = 'bye'; u.t = 0; }
    m.log.push({ round: m.round, score: m.score.slice(), time: TUNE.roundTime - m.timeLeft, reason, winner: side });
    m.events.push({ type: 'roundEnd', side, reason, score: m.score.slice(), last: m.rounds[side] >= TUNE.roundsToWin });
  }

  // Sudden death: the forts melt a brick at a time, so nobody can hide until the snow comes back.
  function melt(m, dt) {
    if ((m.meltT = (m.meltT || 0) - dt) > 0) return;
    m.meltT = TUNE.meltEvery;
    const standing = m.segs.filter((s) => s.lvl > 0);
    if (!standing.length) return;
    const s = standing[Math.floor(Math.random() * standing.length)];
    s.lvl--;
    m.events.push({ type: 'melt', seg: s.id, lvl: s.lvl, x: s.x, y: LVL_H[s.lvl] + 0.2, z: s.zc });
  }

  // ---------------------------------------------------------------- power-ups

  function updateDrops(m, dt) {
    for (let i = m.pickups.length - 1; i >= 0; i--) {
      const u = m.pickups[i];
      if (u.y > 0) u.y = Math.max(0, u.y - 6 * dt);
      if ((u.life -= dt) <= 0) {
        m.pickups.splice(i, 1);
        m.events.push({ type: 'fizzle', id: u.id, x: u.x, z: u.z });
      }
    }
    if ((m.dropT -= dt) > 0) return;
    m.dropT = rand(TUNE.dropEvery[0], TUNE.dropEvery[1]);
    const side = m.dropSide;
    m.dropSide = 1 - side;
    if (m.pickups.some((u) => u.side === side)) return;
    const kinds = Object.keys(POWERUPS);
    const damaged = m.segs.filter((s) => s.side === side && s.lvl < 3).length;
    let kind = kinds[Math.floor(Math.random() * kinds.length)];
    if (kind === 'shovel' && damaged < 2) kind = Math.random() < 0.5 ? 'giant' : 'cocoa';
    const sx = side === 0 ? -1 : 1;
    for (let tries = 0; tries < 20; tries++) {
      const x = sx * rand(1.6, 9.4), z = rand(-3.9, 3.9);
      const o = { x, z, side };
      const x0 = x, z0 = z;
      collideBody(m, o, 0.6);
      if (Math.abs(o.x - x0) > 1e-3 || Math.abs(o.z - z0) > 1e-3) continue;
      const u = { id: m.nextId++, kind, side, x, z, y: 7, life: TUNE.dropLife };
      m.pickups.push(u);
      m.events.push({ type: 'drop', id: u.id, kind, side, x, z });
      return;
    }
  }

  function applyPickup(m, p, kind) {
    if (kind === 'giant') {
      p.giant = 1;
    } else if (kind === 'triple') {
      p.triple = TUNE.triple;
      p.ammo = Math.max(p.ammo, 1);
    } else if (kind === 'shovel') {
      for (const s of m.segs) if (s.side === p.side && s.lvl < 3) { s.lvl = 3; m.events.push({ type: 'segUp', seg: s.id, lvl: 3 }); }
    } else if (kind === 'cocoa') {
      p.shieldT = TUNE.cocoa;
    }
    m.events.push({ type: 'pickup', pid: p.id, kind, name: POWERUPS[kind].name, icon: POWERUPS[kind].icon });
  }

  // ---------------------------------------------------------------- the companion

  function nextTreat(m) {
    m.treatI = (m.treatI + 1 + Math.floor(Math.random() * (TREATS.length - 1))) % TREATS.length;
    return TREATS[m.treatI];
  }

  function giveTreat(m, u, p) {
    const [emoji, name] = nextTreat(m);
    p.ammo = Math.min(TUNE.maxAmmo, p.ammo + 1); // a treat comes with a snowball
    p.meter = Math.min(1, p.meter + 0.1);
    p.stats.treats++;
    u.treats = (u.treats || 0) + 1;
    p.budTreatT = TUNE.treatGap;
    m.events.push({ type: 'treat', pid: p.id, bud: u.id, emoji, name, by: u.name });
  }

  // Call your brother: he comes onto your side for a while. Calling again while he's here gets another treat.
  // In 2P versus he needs a rest between visits, for fairness.
  function callBuddy(m, p) {
    if (!p.buddyChar || (m.phase !== 'play' && m.phase !== 'intro')) return false;
    const here = m.buddies.find((u) => u.owner === p.id && u.state !== 'bye' && u.state !== 'out');
    if (here) {
      if (here.state === 'work' && p.budTreatT <= 0) {
        giveTreat(m, here, p);
        if (m.mode !== '2p') here.life = Math.max(here.life, TUNE.buddyLife);
        here.pose = 'give';
        here.poseT = 0.6;
      }
      return true;
    }
    if (m.buddies.some((u) => u.owner === p.id)) return false; // still waving goodbye
    if (p.budRest > 0) {
      m.events.push({ type: 'buddyWait', pid: p.id, t: p.budRest });
      return false;
    }
    const versus = m.mode === '2p';
    const name = (CHARS[p.buddyChar] || CHARS.tommy).name;
    const u = {
      id: m.nextId++, owner: p.id, side: p.side, char: p.buddyChar, name, face: p.face,
      x: p.side === 0 ? -A.halfW - 1.2 : A.halfW + 1.2, z: clamp(p.z + 1.2, -A.halfD, A.halfD), y: 0, vx: 0, vz: 0,
      state: 'in', t: 0, life: versus ? TUNE.buddyLife2p : TUNE.buddyLife, maxLife: versus ? TUNE.buddyLife2p : TUNE.buddyLife,
      save: true, throwCD: 0.8, seg: null, pose: null, poseT: 0, treats: 0, digT: 0,
    };
    m.buddies.push(u);
    p.stats.calls++;
    if (versus) p.budRest = TUNE.buddyRest2p;
    m.events.push({ type: 'buddyIn', pid: p.id, bud: u.id, char: u.char, name });
    return true;
  }

  function moveTo(m, u, x, z, dt, speed) {
    const dx = x - u.x, dz = z - u.z, d = Math.hypot(dx, dz);
    if (d < 0.15) {
      u.vx = u.vz = 0;
      return true;
    }
    const sp = Math.min(speed, d / dt);
    u.vx = (dx / d) * sp;
    u.vz = (dz / d) * sp;
    u.x += u.vx * dt;
    u.z += u.vz * dt;
    return d < 0.3;
  }

  function updateBuddy(m, u, dt) {
    const p = m.players.find((q) => q.id === u.owner);
    u.t += dt;
    u.poseT = Math.max(0, u.poseT - dt);
    if (!p) { m.buddies.splice(m.buddies.indexOf(u), 1); return; }
    const home = { x: clamp(p.x - u.face * 1.3, -A.halfW, A.halfW), z: clamp(p.z + (p.z > 0 ? -1.1 : 1.1), -A.halfD, A.halfD) };
    if (u.state === 'in') {
      const there = moveTo(m, u, home.x, home.z, dt, TUNE.buddySpeed * 1.3);
      if (there || u.t > 2.2) {
        u.state = 'hello';
        u.t = 0;
        m.events.push({ type: 'buddyHello', bud: u.id, pid: p.id });
      }
      return;
    }
    if (u.state === 'hello') {
      u.vx = u.vz = 0;
      if (u.t > 1.1) {
        u.state = 'give';
        u.t = 0;
        giveTreat(m, u, p);
      }
      return;
    }
    if (u.state === 'give') {
      moveTo(m, u, home.x, home.z, dt, TUNE.buddySpeed);
      if (u.t > 0.6) { u.state = 'work'; u.t = 0; }
      return;
    }
    if (u.state === 'bye') {
      u.vx = u.vz = 0;
      if (u.t > 1.0) { u.state = 'out'; u.t = 0; m.events.push({ type: 'buddyOut', bud: u.id, pid: p.id }); }
      return;
    }
    if (u.state === 'out') {
      moveTo(m, u, u.side === 0 ? -A.halfW - 2.5 : A.halfW + 2.5, u.z, dt, TUNE.buddySpeed * 1.3);
      if (Math.abs(u.x) > A.halfW + 2) m.buddies.splice(m.buddies.indexOf(u), 1);
      return;
    }
    // 'work': rebuild the fort if it's chipped, otherwise throw snowballs
    if (m.phase === 'play' && (u.life -= dt) <= 0) {
      u.state = 'bye';
      u.t = 0;
      m.events.push({ type: 'buddyBye', bud: u.id, pid: p.id });
      return;
    }
    if (u.seg && u.seg.lvl >= 3) u.seg = null;
    if (!u.seg) {
      let best = null, bd = 1e9;
      for (const s of m.segs) {
        if (s.side !== u.side || s.lvl >= 3) continue;
        const d = Math.hypot(s.x - u.x, s.zc - u.z) - (3 - s.lvl);
        if (d < bd) { bd = d; best = s; }
      }
      u.seg = best;
    }
    if (u.seg) {
      const s = u.seg;
      const at = moveTo(m, u, s.x - u.face * 0.75, s.zc, dt, TUNE.buddySpeed);
      u.digging = at;
      if (at && (u.digT += dt) >= 0.45) {
        u.digT = 0;
        s.lvl++;
        m.events.push({ type: 'segUp', seg: s.id, lvl: s.lvl, bud: u.id });
      }
    } else {
      u.digging = false;
      moveTo(m, u, home.x, home.z, dt, TUNE.buddySpeed);
      if (m.phase === 'play' && (u.throwCD -= dt) <= 0) {
        const t = pickTarget(m, u);
        if (t && t.state !== 'dizzy') {
          const lob = !!lineBlocked(m, u, t);
          spawnBall(m, p, u, t, { lob, lead: 0.3, err: 0.8 });
          u.throwT = 0.36;
          m.events.push({ type: 'buddyThrow', bud: u.id, lob });
        }
        u.throwCD = TUNE.buddyThrow;
      }
    }
    collideBody(m, u, PR);
    keepInside(u, u.side);
  }

  SB.engine = {
    DT, GRAV, TUNE, A, FORT, LVL_H, OBST, H_STAND, H_LOW, SPECIALS, CHARS, POWERUPS, TREATS, COOP_WAVES,
    create, step, tick, pickTarget, lineBlocked, coverFor, callBuddy, startRound, applyPickup,
  };
})();
