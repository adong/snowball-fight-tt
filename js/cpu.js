/* SnowbaTTle — the computer players, and the headless match runner used by tools/soak.js and window.game.soak.
   A CPU player returns the same kind of action a human's buttons turn into: { mx, mz, act, scoop, buddy }.
   Levels:
     easy    for little ones like Tommy (5): slow, throws rarely and wide, never dodges, scoops out in the open.
     normal  for big kids like Teddy (8): ducks behind forts, lobs over them, dodges some throws, grabs power-ups.
     snowman / robot   the Snow Crew in co-op. */
(function () {
  'use strict';
  const SB = (globalThis.SB = globalThis.SB || {});
  const rand = (a, b) => a + Math.random() * (b - a);
  const E = () => SB.engine;

  const LEVELS = {
    easy: { speed: 0.7, think: [0.5, 0.9], gap: [2.0, 3.2], err: 1.3, lead: 0, lob: 0.3, dodge: 0, cover: 0.3, grab: 3.5, special: [2.5, 5], scoopTo: 3 },
    normal: { speed: 0.95, think: [0.25, 0.45], gap: [1.2, 2.0], err: 0.6, lead: 0.4, lob: 0.7, dodge: 0.4, cover: 0.85, grab: 7, special: [0.6, 2], scoopTo: 2 },
    snowman: { speed: 0.55, think: [0.6, 1.0], gap: [2.6, 3.8], err: 1.1, lead: 0, lob: 0.4, dodge: 0, cover: 0.2, grab: 0, special: [3, 6], scoopTo: 3 },
    robot: { speed: 0.8, think: [0.4, 0.7], gap: [1.6, 2.6], err: 0.7, lead: 0.2, lob: 0.5, dodge: 0.25, cover: 0.5, grab: 4, special: [2, 4], scoopTo: 2 },
    // test bot, not in the menus: a little kid who runs around and presses throw a lot, with the human aim assist
    kid: { speed: 1, think: [0.3, 1.2], gap: [0.5, 1.6], err: 0.25, lead: 0.55, lob: 0.3, dodge: 0, cover: 0, grab: 4, special: [0.2, 1.5], scoopTo: 1 },
    // test bot: a big kid who hides behind forts and lobs, but rarely dodges
    bigkid: { speed: 1, think: [0.3, 0.7], gap: [0.8, 1.6], err: 0.2, lead: 0.55, lob: 0.6, dodge: 0.15, cover: 0.6, grab: 6, special: [0.3, 1.2], scoopTo: 2 },
  };
  const lv = (p) => LEVELS[p.level] || LEVELS.normal;

  function aimFor(p) {
    const L = lv(p);
    return { lead: L.lead, err: L.err };
  }

  function brain(p, L) {
    return (p.brain = p.brain || {
      plan: null, goal: null, t: 0, throwAt: rand(0.4, 1) * L.gap[0], specT: -1,
      dodgeT: 0, dodgeDir: 0, seen: new Set(), stuckT: 0, lastD: 1e9,
    });
  }

  // A spot right behind one of your forts, where standing still ducks you.
  function coverSpot(m, p) {
    const segs = m.segs.filter((s) => s.side === p.side && s.lvl >= 2);
    if (!segs.length) return null;
    const s = segs[Math.floor(Math.random() * segs.length)];
    return { x: s.x - p.face * 0.95, z: s.zc };
  }

  function openSpot(p) {
    return { x: -p.face * rand(4.7, 9.0), z: rand(-3.8, 3.8) };
  }

  function decide(m, p, b, L) {
    b.t = rand(L.think[0], L.think[1]);
    b.stuckT = 0;
    b.lastD = 1e9;
    const hasBall = p.ammo > 0 || p.giant;
    if (!hasBall || (b.plan === 'scoop' && p.ammo < L.scoopTo)) {
      if (b.plan !== 'scoop') b.goal = Math.random() < L.cover ? coverSpot(m, p) : null;
      b.plan = 'scoop';
      return;
    }
    const u = m.pickups.find((k) => k.side === p.side && Math.hypot(k.x - p.x, k.z - p.z) < L.grab);
    if (u) {
      b.plan = 'grab';
      b.goal = { x: u.x, z: u.z, id: u.id };
      return;
    }
    if (b.plan === 'pos' && b.goal && Math.random() < 0.7) return; // keep going where we were going
    b.plan = 'pos';
    b.goal = (Math.random() < L.cover && coverSpot(m, p)) || openSpot(p);
  }

  function steer(p, goal, out, L) {
    const dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.22) return d;
    out.mx = (dx / d) * L.speed;
    out.mz = (dz / d) * L.speed;
    return d;
  }

  function think(m, p, dt) {
    const L = lv(p);
    const b = brain(p, L);
    const out = { mx: 0, mz: 0, act: null, scoop: false, buddy: false };
    if (m.phase !== 'play' || (p.state !== 'ok' && p.state !== 'hit') || p.hold) return out; // hold: test hook
    b.t -= dt;
    b.throwAt -= dt;

    // dodge: sidestep a snowball that's about to arrive, or a lob about to land on us
    if (b.dodgeT > 0) {
      b.dodgeT -= dt;
      out.mz = b.dodgeDir * L.speed;
      return out;
    }
    if (L.dodge > 0) {
      for (const ball of m.balls) {
        if (ball.side === p.side || b.seen.has(ball.id)) continue;
        let zAt, soon;
        if (ball.lob) {
          zAt = ball.tz;
          soon = ball.vy < 1 && Math.hypot(ball.tx - p.x, ball.tz - p.z) < 1.1;
        } else {
          const tt = ball.vx ? (p.x - ball.x) / ball.vx : -1;
          zAt = ball.z + ball.vz * tt;
          soon = tt > 0 && tt < 0.55 && Math.abs(zAt - p.z) < 0.75;
        }
        if (!soon) continue;
        b.seen.add(ball.id);
        if (Math.random() < L.dodge) {
          b.dodgeT = ball.lob ? 0.45 : 0.32;
          b.dodgeDir = p.z > 3.2 ? -1 : p.z < -3.2 ? 1 : zAt > p.z ? -1 : 1;
          return out;
        }
      }
      if (b.seen.size > 60) b.seen.clear();
    }

    // the special, a moment after it's charged
    if (p.meter >= 1) {
      if (b.specT < 0) b.specT = rand(L.special[0], L.special[1]);
      else if ((b.specT -= dt) <= 0) {
        b.specT = -1;
        const t = E().pickTarget(m, p);
        if (t && t.state !== 'dizzy') {
          out.act = t.duck || E().lineBlocked(m, p, t) || Math.random() < 0.35 ? 'specialHold' : 'special';
          return out;
        }
      }
    }

    const hasBall = p.ammo > 0 || p.giant;
    if (b.t <= 0 || !b.plan || (!hasBall && b.plan !== 'scoop')) decide(m, p, b, L);

    if (b.plan === 'scoop') {
      const d = b.goal ? steer(p, b.goal, out, L) : 0;
      if (d < 0.3 || b.stuckT > 1) {
        out.mx = out.mz = 0;
        out.scoop = true;
      }
      if (p.ammo >= L.scoopTo) b.t = 0;
    } else if (b.plan === 'grab') {
      if (!m.pickups.some((k) => k.id === b.goal.id)) b.t = 0;
      else steer(p, b.goal, out, L);
    } else if (b.plan === 'pos' && b.goal) {
      steer(p, b.goal, out, L);
    }
    // stuck against something? think again
    if (b.goal && (out.mx || out.mz)) {
      const d = Math.hypot(b.goal.x - p.x, b.goal.z - p.z);
      if (d > b.lastD - 0.02) b.stuckT += dt;
      else b.stuckT = 0;
      b.lastD = d;
      if (b.stuckT > 0.9 && b.plan !== 'scoop') b.t = 0;
    }

    // throw when it's time (not at a brain-frozen kid)
    if (b.throwAt <= 0 && hasBall && !out.scoop) {
      const t = E().pickTarget(m, p);
      if (t && t.state !== 'dizzy' && t.inv <= 0) {
        const blocked = E().lineBlocked(m, p, t);
        const lob = blocked ? Math.random() < L.lob : Math.random() < 0.1;
        out.act = lob ? 'lob' : 'throw';
        b.throwAt = rand(L.gap[0], L.gap[1]);
        if (b.plan === 'pos' && Math.random() < 0.5) b.t = Math.min(b.t, 0.4);
      } else b.throwAt = 0.3;
    }
    return out;
  }

  SB.cpu = { LEVELS, think, aimFor };

  // ---------------------------------------------------------------- headless matches

  // One whole match, no drawing. o: { maxRound (s, a round longer than this is a problem), callEvery: [a, b] s for
  // pretend kids pressing the companion button, callSides: which sides press it (default both) }.
  function run(cfg, o = {}) {
    const Eng = E();
    const m = Eng.create(cfg);
    const problems = [];
    const maxRound = o.maxRound || Eng.TUNE.roundTime + 90;
    const callers = m.players.filter((p) => p.buddyChar && (!o.callSides || o.callSides.includes(p.side)));
    const callAt = new Map(callers.map((p) => [p.id, o.callEvery ? rand(o.callEvery[0], o.callEvery[1]) : 1e9]));
    const counts = {};
    let roundT = 0, lastRound = m.round;
    const limit = (maxRound + 10) * (Eng.TUNE.roundsToWin * 2 + 1) * 60;
    for (let f = 0; f < limit && m.phase !== 'over'; f++) {
      for (const p of callers) {
        const t = callAt.get(p.id) - Eng.DT;
        if (t <= 0 && m.phase === 'play') {
          Eng.callBuddy(m, p);
          callAt.set(p.id, rand(o.callEvery[0], o.callEvery[1]));
        } else callAt.set(p.id, t);
      }
      Eng.tick(m, []);
      for (const e of m.events) counts[e.type] = (counts[e.type] || 0) + 1;
      m.events.length = 0;
      if (m.round !== lastRound) { lastRound = m.round; roundT = 0; }
      if (m.phase === 'play') roundT += Eng.DT;
      if (roundT > maxRound) {
        problems.push(`round ${m.round} still going after ${maxRound} s (score ${m.score.join(':')})`);
        break;
      }
      if (f % 30 === 0) check(m, problems);
      if (problems.length > 5) break;
    }
    if (m.phase !== 'over' && !problems.length) problems.push('match never finished');
    return { winner: m.winner, rounds: m.log, time: m.t, problems, counts, players: m.players.map((p) => ({ char: p.char, side: p.side, level: p.level, stats: p.stats })) };
  }

  function check(m, problems) {
    const A = E().A;
    for (const p of m.players) {
      if (![p.x, p.z, p.y, p.vx, p.vz].every(Number.isFinite)) problems.push(`${p.name} position is NaN`);
      if (Math.abs(p.z) > A.halfD + 0.01 || Math.abs(p.x) > A.halfW + 0.01 || (p.side === 0 ? p.x > -A.mid + 0.01 : p.x < A.mid - 0.01)) {
        problems.push(`${p.name} left the yard at ${p.x.toFixed(2)}, ${p.z.toFixed(2)}`);
      }
      if (p.ammo < 0 || p.ammo > E().TUNE.maxAmmo) problems.push(`${p.name} has ${p.ammo} snowballs`);
    }
    for (const b of m.balls) if (![b.x, b.y, b.z].every(Number.isFinite)) problems.push('snowball position is NaN');
    for (const s of m.segs) if (s.lvl < 0 || s.lvl > 3) problems.push(`fort piece at level ${s.lvl}`);
    if (m.score[0] > E().TUNE.toWin + 2 || m.score[1] > E().TUNE.toWin + 2) problems.push(`score ran away: ${m.score}`);
  }

  const ROSTER = ['teddy', 'tommy', 'zoom', 'luna', 'bolt', 'bruno', 'zombie'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  function randomCfg() {
    const mode = pick(['1p', '1p', '2p', 'coop']);
    const level = pick(['easy', 'normal']);
    const lvl = () => pick(['easy', 'normal']);
    if (mode === 'coop') {
      return { mode, level, teams: [[{ char: 'teddy', level: lvl() }, { char: 'tommy', level: lvl() }], []] };
    }
    const a = pick(['teddy', 'tommy']), b = mode === '2p' ? (a === 'teddy' ? 'tommy' : 'teddy') : pick(ROSTER);
    return { mode, level, teams: [[{ char: a, level: lvl() }], [{ char: b, level: mode === '1p' ? level : lvl() }]] };
  }

  // n random matches across every mode; every match must finish with no problems.
  function soak(n = 100, o = {}) {
    const res = { matches: 0, finished: 0, withProblems: 0, problems: [], rounds: 0, roundTimes: [], byMode: {}, events: {} };
    for (let i = 0; i < n; i++) {
      const cfg = randomCfg();
      const r = run(cfg, Object.assign({ callEvery: [4, 16] }, o));
      res.matches++;
      res.byMode[cfg.mode] = (res.byMode[cfg.mode] || 0) + 1;
      if (!r.problems.length) res.finished++;
      else {
        res.withProblems++;
        if (res.problems.length < 12) res.problems.push(`${cfg.mode} ${cfg.teams.map((t) => t.map((p) => p.char).join('+')).join(' vs ')}: ${r.problems[0]}`);
      }
      for (const rd of r.rounds) { res.rounds++; res.roundTimes.push(rd.time); }
      for (const k in r.counts) res.events[k] = (res.events[k] || 0) + r.counts[k];
    }
    const t = res.roundTimes.sort((a, b) => a - b);
    res.roundTime = t.length ? { min: +t[0].toFixed(1), median: +t[t.length >> 1].toFixed(1), max: +t[t.length - 1].toFixed(1) } : null;
    delete res.roundTimes;
    return res;
  }

  // Win counts for level `a` (left) against level `b` (right), Teddy vs Tommy.
  function versus(a, b, n = 50, o = {}) {
    const wins = [0, 0];
    let hits = [0, 0];
    for (let i = 0; i < n; i++) {
      const r = run({ mode: '1p', level: b, teams: [[{ char: 'teddy', level: a }], [{ char: 'tommy', level: b }]] }, o);
      if (r.winner >= 0) wins[r.winner]++;
      for (const p of r.players) hits[p.side] += p.stats.hits;
    }
    hits = hits.map((h) => +(h / n).toFixed(1));
    return `${a} vs ${b}: ${wins[0]}-${wins[1]} in ${n} matches (hits per match ${hits.join(' / ')})`;
  }

  SB.sim = { run, soak, versus, randomCfg };
})();
