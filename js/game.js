/* SnowbaTTle — the game: scene, camera, menus, HUD, touch controls, the main loop and the window.game test hooks.
   The rules live in js/engine.js. This file reads match state every frame and turns match.events into splats,
   sounds, banners, toasts and camera shake. Behind the title and select screens, two CPUs have a quiet demo fight. */
(function () {
  'use strict';
  const T = THREE, SB = window.SB, E = SB.engine, P = window.SBPoses, FX = window.SBFx, S = window.SBSfx, I = window.SBInput, ST = window.SBStage;
  const Kit = window.Kit;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const damp = (k, dt) => 1 - Math.exp(-k * dt);
  const PI = Math.PI;
  const SIDE = ST.SIDE;
  const ROSTER = ['teddy', 'tommy', 'zoom', 'luna', 'bolt', 'bruno', 'zombie'];
  const STAND_INS = ['zoom', 'luna', 'bruno', 'bolt'];
  const SCARVES = ['#e8433a', '#ff8a1f', '#8d5bd8'];
  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem('snowbattle.' + k);
        return v === null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try { localStorage.setItem('snowbattle.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ }
    },
  };

  const G = {
    screen: 'loading', mode: '1p', level: store.get('level', 'easy'), picks: store.get('picks', ['teddy', 'tommy']),
    paused: false, time: 0, shake: 0, timers: [], lastCfg: null, hooks: false, frozen: false, overT: 0, hintT: {},
    camX: 0, camZoom: 1, demoCall: 6, cam: { pitch: 0.8, halfW: 11.0, min: 17.5, tz: -2.4, ty: 0 }, lastTick: -1, touchOn: false,
  };
  let renderer, scene, camera, sun, M = null;
  const vis = { players: new Map(), buds: new Map(), balls: new Map(), pickups: new Map(), rings: new Map() };
  let portraits = {};
  let hud = [];
  const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches || 'ontouchstart' in window;

  function later(t, fn) {
    G.timers.push({ t, fn });
  }

  // ---------------------------------------------------------------- looks

  function altLook(look) {
    // mirror match: the second one wears different colours
    const shift = (hex, h) => '#' + new T.Color(hex).offsetHSL(h, 0, 0).getHexString();
    return Object.assign({}, look, { top: shift(look.top, 0.42), bottom: shift(look.bottom, 0.3), shoes: shift(look.shoes, 0.5) });
  }

  function charName(id) {
    return (E.CHARS[id] || { name: id.toUpperCase() }).name;
  }

  // Your companion: the other brother, or a friend from the roster when he's already playing.
  function buddyOf(char, inPlay, taken = []) {
    let id = char === 'tommy' ? 'teddy' : 'tommy';
    if (inPlay.includes(id) || taken.includes(id)) id = STAND_INS.find((c) => !inPlay.includes(c) && !taken.includes(c)) || 'bruno';
    return id;
  }

  // Build a person (or a snowman) for someone in the match.
  function buildBody(char, o = {}) {
    if (char === 'snowman') return P.snowman({ scarf: SCARVES[(o.alt || 0) % SCARVES.length] });
    const entry = Kit.roster.get(char) || Kit.roster.list[0];
    return Kit.people.build(o.alt ? altLook(entry.look) : entry.look);
  }

  // ---------------------------------------------------------------- scene

  function setupScene() {
    renderer = new T.WebGLRenderer({ canvas: $('game'), antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    scene.background = new T.Color('#a9d8f5');
    scene.fog = new T.Fog('#cfe8f8', 34, 70);
    camera = new T.PerspectiveCamera(34, 1, 0.1, 200);
    scene.add(new T.HemisphereLight('#eef8ff', '#9fb6d6', 0.85));
    sun = new T.DirectionalLight('#fff3e0', 1.05);
    sun.position.set(-7, 16, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 50 });
    sun.shadow.bias = -0.0006;
    scene.add(sun);
    FX.init(scene);
    // one throwaway match gives the stage its fort pieces and obstacles; matches rebind them later
    const m0 = E.create(demoCfg());
    ST.build(scene, m0.segs, m0.obst);
  }

  let lastW = 0, lastH = 0;
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    if (w === lastW && h === lastH) return false;
    lastW = w;
    lastH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    return true;
  }

  // The whole yard (x ±11) must fit across the screen; narrow screens pull the camera back.
  function updateCamera(dt) {
    const C = G.cam;
    const tan = Math.tan((camera.fov / 2) * (PI / 180));
    let dist = clamp(C.halfW / (tan * camera.aspect), C.min, 40);
    let tx = 0, tz = C.tz;
    if (M && (M.phase === 'outro' || M.phase === 'over') && M.roundWinner >= 0) {
      tx = M.roundWinner === 0 ? -5.5 : 5.5;
      tz = 0;
      dist *= 0.62;
    }
    if (G.screen === 'title' || G.screen === 'select') {
      tx = Math.sin(G.time * 0.15) * 1.5;
      dist *= 1.02;
    }
    const k = damp(2.5, dt);
    G.camX += (tx - G.camX) * k;
    G.camZoom += (dist - G.camZoom) * (G.camZoom === 1 ? 1 : k);
    G.camTZ = G.camTZ === undefined ? tz : G.camTZ + (tz - G.camTZ) * k;
    const pitch = C.pitch;
    const sh = G.shake > 0 ? G.shake : 0;
    G.shake = Math.max(0, G.shake - dt * 2.5);
    camera.position.set(G.camX + (Math.random() - 0.5) * sh, Math.sin(pitch) * G.camZoom + (Math.random() - 0.5) * sh, G.camTZ + Math.cos(pitch) * G.camZoom);
    camera.lookAt(G.camX, C.ty, G.camTZ);
  }

  // ---------------------------------------------------------------- match lifecycle

  function demoCfg() {
    return { mode: 'demo', level: 'normal', teams: [[{ char: 'teddy', level: 'normal' }], [{ char: 'tommy', level: 'normal' }]] };
  }

  function makeCfg(mode, level, picks) {
    const [a, b] = picks;
    if (mode === '2p') return { mode, level, teams: [[{ char: a, human: true, ctrl: 0 }], [{ char: b, human: true, ctrl: 1 }]] };
    if (mode === 'coop') return { mode, level, teams: [[{ char: a, human: true, ctrl: 0 }, { char: b, human: true, ctrl: 1, alt: a === b ? 1 : 0 }], []] };
    return { mode: '1p', level, teams: [[{ char: a, human: true, ctrl: 0 }], [{ char: b, level }]] };
  }

  function bindMatch(m) {
    M = m;
    for (const map of [vis.players, vis.buds, vis.balls, vis.pickups, vis.rings]) {
      for (const v of map.values()) removeVis(v);
      map.clear();
    }
    FX.clear();
    ST.bind(M.segs);
    G.overT = 0;
    G.lastTick = -1;
  }

  function startMatch(cfg) {
    G.lastCfg = cfg;
    // mirror matches: the second one of the same character wears different colours
    const t = cfg.teams;
    if (t[0][0] && t[1][0] && t[0][0].char === t[1][0].char) t[1][0].alt = 1;
    bindMatch(E.create(cfg));
    I.setTwoPlayer(cfg.mode !== '1p');
    I.clear();
    G.paused = false;
    setScreen('fight');
    buildHud();
    Kit.sound.music('play');
  }

  function startDemo() {
    bindMatch(E.create(demoCfg()));
    G.demoCall = 5 + Math.random() * 6;
  }

  // ---------------------------------------------------------------- visuals for people

  function makeVis(who, o) {
    const body = buildBody(who.char, { alt: who.alt });
    const scale = o.scale || (who.char === 'tommy' ? 0.92 : 1);
    body.root.scale.setScalar(scale);
    scene.add(body.root);
    const v = { who, body, scale, yaw: who.side === 0 ? -PI / 2 : PI / 2, ph: 0, stepT: 0, puffT: 0, splatT: 0, held: null, poseT: 0 };
    v.tag = Kit.gfx.nameTag(Kit.lang.t(o.label || who.name), o.tagColor || SIDE[who.side].light);
    v.tag.scale.multiplyScalar(o.tagScale || 1);
    scene.add(v.tag);
    v.tagY = (who.char === 'snowman' ? 2.55 : 2.6) * scale + 0.05;
    v.held = snowballMesh();
    v.held.scale.setScalar(0.13);
    scene.add(v.held);
    if (o.full) {
      v.pips = [0, 1, 2].map(() => {
        const s = new T.Sprite(new T.SpriteMaterial({ map: pipTexture(), depthWrite: false }));
        s.scale.set(0.24, 0.24, 1);
        scene.add(s);
        return s;
      });
      v.shield = new T.Mesh(new T.SphereGeometry(1.15, 24, 16), new T.MeshBasicMaterial({ color: '#ffb36b', transparent: true, opacity: 0.22, depthWrite: false, blending: T.AdditiveBlending }));
      v.shield.visible = false;
      scene.add(v.shield);
      v.dizzy = new T.Group();
      ['❄️', '⭐', '❄️', '⭐', '💫'].forEach((e, i) => {
        const s = new T.Sprite(new T.SpriteMaterial({ map: Kit.gfx.emojiTexture(e), depthWrite: false }));
        s.scale.set(0.46, 0.46, 1);
        s.userData.a = (i / 5) * PI * 2;
        v.dizzy.add(s);
      });
      const brr = new T.Sprite(new T.SpriteMaterial({ map: Kit.gfx.emojiTexture('🥶'), depthWrite: false }));
      brr.scale.set(0.7, 0.7, 1);
      brr.position.y = 0.95;
      v.dizzy.add(brr);
      v.dizzy.visible = false;
      scene.add(v.dizzy);
      v.badge = new T.Sprite(new T.SpriteMaterial({ map: Kit.gfx.emojiTexture('✌️'), depthWrite: false }));
      v.badge.scale.set(0.45, 0.45, 1);
      v.badge.visible = false;
      scene.add(v.badge);
      v.splat = new T.Sprite(new T.SpriteMaterial({ map: splatTexture(), depthWrite: false, transparent: true }));
      v.splat.visible = false;
      scene.add(v.splat);
      v.saveRing = groundRing(0.62, 0.8, '#ffd400');
      v.saveRing.visible = false;
      scene.add(v.saveRing);
    }
    if (o.shovel) {
      v.shovel = new T.Group();
      Kit.gfx.mesh(new T.CylinderGeometry(0.03, 0.03, 0.9, 6), Kit.gfx.std('#8a5a2b'), 0, -0.35, 0, v.shovel);
      Kit.gfx.mesh(new T.BoxGeometry(0.26, 0.04, 0.3), Kit.gfx.std('#e8433a', { metalness: 0.3, roughness: 0.5 }), 0, -0.82, -0.08, v.shovel);
      v.shovel.visible = false;
      scene.add(v.shovel);
    }
    return v;
  }

  function removeVis(v) {
    for (const k of ['tag', 'held', 'shield', 'dizzy', 'badge', 'splat', 'saveRing', 'shovel', 'mesh', 'shadow', 'marker', 'glow', 'icon', 'ring']) if (v[k]) scene.remove(v[k]);
    if (v.body) scene.remove(v.body.root);
    if (v.pips) v.pips.forEach((s) => scene.remove(s));
  }

  let pipTex = null, splatTex = null;
  function pipTexture() {
    if (pipTex) return pipTex;
    const [c, g] = Kit.gfx.makeCanvas(64, 64);
    const gr = g.createRadialGradient(24, 22, 4, 32, 32, 28);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.7, '#dcefff');
    gr.addColorStop(1, '#8fbbe8');
    g.fillStyle = gr;
    g.beginPath(); g.arc(32, 32, 26, 0, PI * 2); g.fill();
    g.lineWidth = 5;
    g.strokeStyle = '#14121f';
    g.stroke();
    return (pipTex = Kit.gfx.toTexture(c));
  }
  function splatTexture() {
    if (splatTex) return splatTex;
    const [c, g] = Kit.gfx.makeCanvas(128, 128);
    g.fillStyle = '#ffffff';
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * PI * 2, r = 30 + (i % 3) * 12 + ((i * 7) % 5) * 2;
      g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(160,200,240,0.5)';
    g.beginPath(); g.arc(70, 70, 16, 0, PI * 2); g.fill();
    return (splatTex = Kit.gfx.toTexture(c));
  }

  function groundRing(r0, r1, color) {
    const m = new T.Mesh(new T.RingGeometry(r0, r1, 36), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: T.DoubleSide }));
    m.rotation.x = -PI / 2;
    m.renderOrder = 2;
    return m;
  }

  const tmpV = new T.Vector3();
  function handPos(body, side, out = new T.Vector3()) {
    if (body.hands) return body.hands[side > 0 ? 1 : 0].getWorldPosition(out);
    return Kit.people.handWorld(body, side, out);
  }

  function turnTo(v, want, dt, rate = 12) {
    let d = want - v.yaw;
    while (d > PI) d -= PI * 2;
    while (d < -PI) d += PI * 2;
    v.yaw += d * damp(rate, dt);
    v.body.root.rotation.y = v.yaw;
  }

  const yawFor = (dx, dz) => Math.atan2(-dx, -dz);

  // Pose a player from match state.
  function syncPlayer(p, dt) {
    let v = vis.players.get(p.id);
    if (!v) {
      v = makeVis(p, { full: true });
      vis.players.set(p.id, v);
    }
    v.who = p;
    v.seen = true;
    const b = v.body;
    const tgt = E.pickTarget(M, p);
    let hop = 0;
    // which way to face: toward the target when throwing or standing, along the run otherwise
    let want = p.side === 0 ? -PI / 2 - 0.3 : PI / 2 + 0.3;
    if (tgt && (p.throwT > 0 || p.charging || p.state === 'special' || !p.moving)) want = yawFor(tgt.x - p.x, tgt.z - p.z) + (p.side === 0 ? -0.25 : 0.25);
    else if (p.moving) want = yawFor(p.vx, p.vz);
    if (p.state === 'celebrate' || p.state === 'sad') want = yawFor(0, 1) + (p.side === 0 ? -0.4 : 0.4);
    // Tommy's Y pose is for the camera, like a photo, before the ✌️ spread flies
    if (p.state === 'special' && p.spec && p.spec.def.pose === 'peace' && p.spec.t < p.spec.def.wind + 0.1) want = yawFor(0, 1) + (p.side === 0 ? -0.3 : 0.3);
    if (p.state === 'dizzy') want = v.yaw + dt * 2.5;
    turnTo(v, want, dt, p.state === 'special' ? 20 : 12);
    const sp = Math.hypot(p.vx, p.vz);
    v.ph += dt * (sp > 0.3 ? 2.6 * sp : 0);
    let mode = 'ready', o = { t: 0 };
    const kfast = damp(18, dt), kslow = damp(9, dt);
    let k = kfast;
    if (p.state === 'dizzy') { mode = 'dizzy'; k = kslow; }
    else if (p.state === 'hit') mode = 'hit';
    else if (p.state === 'special' && p.spec) {
      const d = p.spec.def;
      mode = d.pose;
      o.ph = d.pose === 'boxing' ? p.spec.t * (PI / (d.gap || 0.2)) : G.time * 9;
    } else if (p.state === 'celebrate') {
      const sig = Kit.roster.get(p.char) ? Kit.roster.get(p.char).signature : null;
      const cyc = (G.time + p.id) % 3;
      if (p.char === 'teddy') {
        if (cyc < 1.5) { mode = 'boxing'; o.ph = G.time * 7; }
        else { mode = 'jumpshot'; hop = Math.max(0, Math.sin(((cyc - 1.5) / 1.5) * PI)) * 0.9; }
      } else if (sig && sig[0] === 'peace') { mode = 'peace'; hop = Math.abs(Math.sin(G.time * 4)) * 0.25; }
      else mode = 'cheer';
      k = kslow;
    } else if (p.state === 'sad') { mode = 'aww'; k = kslow; }
    else if (p.throwT > 0) { mode = p.throwLob ? 'lob' : 'throw'; o.t = E.TUNE.throwAnim - p.throwT; }
    else if (p.charging) mode = 'charge';
    else if (p.scooping) mode = 'scoop';
    else if (p.duck) mode = 'duck';
    else if (sp > 0.6) { mode = 'run'; o.ph = v.ph; }
    else mode = p.ammo > 0 || p.giant ? 'ready' : 'stand';
    if (b.snowman && (mode === 'run' || mode === 'walk')) {
      hop = Math.abs(Math.sin(v.ph * 0.9)) * 0.22;
      mode = 'ready';
    }
    P.apply(b, mode, G.time, k, o);
    b.root.position.set(p.x, p.y + hop, p.z);
    b.root.updateMatrixWorld(true);

    // the snowball in hand (a giant one overhead), hidden while scooping or throwing
    const showHeld = (p.ammo > 0 || p.giant) && !p.scooping && p.state !== 'dizzy' && !(p.throwT > 0 && p.throwT < E.TUNE.throwAnim - E.TUNE.throwWind) && p.state !== 'special' && p.state !== 'celebrate' && p.state !== 'sad';
    v.held.visible = showHeld;
    if (showHeld) {
      handPos(b, 1, tmpV);
      if (p.giant) {
        v.held.scale.setScalar(0.34);
        v.held.position.set(p.x, 2.35 * v.scale + p.y, p.z);
      } else {
        v.held.scale.setScalar(0.13);
        v.held.position.copy(tmpV);
      }
    }
    if (p.state === 'special' && p.spec && p.spec.def.giant && p.spec.fired === 0) {
      v.held.visible = true;
      v.held.scale.setScalar(0.38);
      v.held.position.set(p.x, p.y + 2.4, p.z);
    }

    // over the head: name tag and snowball pips
    v.tag.position.set(p.x, p.y + hop + v.tagY, p.z);
    v.pips.forEach((s, i) => {
      s.visible = i < p.ammo && M.phase !== 'over';
      s.position.set(p.x + (i - 1) * 0.26, p.y + hop + v.tagY + 0.36, p.z);
    });
    v.badge.visible = p.triple > 0 || p.giant > 0;
    if (v.badge.visible) {
      v.badge.material.map = Kit.gfx.emojiTexture(p.giant ? '❄️' : '✌️');
      v.badge.position.set(p.x + 0.82, p.y + v.tagY + 0.05, p.z);
    }
    v.shield.visible = p.shieldT > 0;
    if (v.shield.visible) {
      v.shield.position.set(p.x, p.y + 1.0, p.z);
      v.shield.material.opacity = (p.shieldT < 2 ? 0.12 + 0.1 * Math.sin(G.time * 20) : 0.2) + Math.sin(G.time * 5) * 0.04;
      v.shield.scale.setScalar(1 + Math.sin(G.time * 3) * 0.03);
    }
    v.dizzy.visible = p.state === 'dizzy';
    if (v.dizzy.visible) {
      v.dizzy.position.set(p.x, p.y + 2.25 * v.scale, p.z);
      v.dizzy.children.forEach((s) => {
        if (s.userData.a === undefined) return;
        const a = s.userData.a + G.time * 4;
        s.position.set(Math.cos(a) * 0.55, Math.sin(a * 2) * 0.06, Math.sin(a) * 0.55);
      });
    }
    v.splatT = Math.max(0, v.splatT - dt);
    v.splat.visible = v.splatT > 0;
    if (v.splat.visible) {
      v.splat.position.set(p.x, p.y + 1.55 * v.scale, p.z + 0.35);
      v.splat.material.opacity = Math.min(1, v.splatT / 0.4);
      v.splat.scale.set(0.75, 0.75, 1);
    }
    const bud = M.buddies.find((u) => u.owner === p.id && u.save && u.state !== 'out' && u.state !== 'bye');
    v.saveRing.visible = !!bud;
    if (bud) {
      v.saveRing.position.set(p.x, 0.05, p.z);
      v.saveRing.rotation.z = G.time;
      v.saveRing.material.opacity = 0.55 + Math.sin(G.time * 6) * 0.25;
    }

    // footsteps and scooping sounds, little snow puffs at the feet
    if (G.screen === 'fight') {
      if (sp > 1.2 && p.y < 0.05) {
        if ((v.stepT -= dt) <= 0) {
          v.stepT = 0.3;
          if (p.human) S.step();
          FX.puff(p.x, 0.1, p.z, { n: 2, speed: 0.6, size: 0.22, life: 0.45, lift: 0.4 });
        }
      }
      if (p.scooping && (v.puffT -= dt) <= 0) {
        v.puffT = 0.18;
        S.scrape();
        FX.puff(p.x + p.face * 0.45, 0.15, p.z, { n: 2, speed: 0.8, size: 0.2, life: 0.4, lift: 1 });
      }
    }
  }

  // Pose a companion from match state.
  function syncBuddy(u, dt) {
    let v = vis.buds.get(u.id);
    if (!v) {
      const entry = Kit.roster.get(u.char);
      v = makeVis(u, {
        scale: (entry && entry.buddyScale) || 0.8, label: u.name, tagColor: (entry && entry.tag) || '#ffb02e', tagScale: 0.85, shovel: true,
      });
      v.yaw = u.side === 0 ? -PI / 2 : PI / 2;
      vis.buds.set(u.id, v);
    }
    v.seen = true;
    const b = v.body, entry = Kit.roster.get(u.char);
    const sp = Math.hypot(u.vx, u.vz);
    v.ph += dt * (sp > 0.3 ? 2.6 * sp : 0);
    v.throwT = Math.max(0, (v.throwT || 0) - dt);
    v.poseT = Math.max(0, v.poseT - dt);
    let mode = 'ready', o = {}, hop = 0;
    let want = u.side === 0 ? -PI / 2 - 0.4 : PI / 2 + 0.4;
    const owner = M.players.find((q) => q.id === u.owner);
    if (u.state === 'in' || u.state === 'out') {
      mode = 'run';
      o.ph = v.ph;
      want = yawFor(u.vx || (u.state === 'out' ? -u.face : u.face), u.vz);
    } else if (u.state === 'hello' || u.state === 'bye') {
      mode = Kit.roster.signature(entry, u.state === 'hello' ? 'hello' : 'goodbye');
      if (mode === 'jumpshot') hop = Math.max(0, Math.sin(u.t * PI)) * 0.7;
      o.ph = G.time * 7;
      want = yawFor(0, 1);
    } else if (u.state === 'give' || v.poseT > 0 && v.posed === 'give') {
      mode = 'give';
      o.ph = G.time * 4;
      if (owner) want = yawFor(owner.x - u.x, owner.z - u.z);
    } else if (v.poseT > 0 && v.posed === 'guard') {
      mode = 'guard';
    } else if (u.digging) {
      mode = 'shovel';
      want = u.side === 0 ? -PI / 2 : PI / 2;
    } else if (v.throwT > 0) {
      mode = 'throw';
      o.t = 0.36 - v.throwT;
    } else if (sp > 0.5) {
      mode = 'run';
      o.ph = v.ph;
      want = yawFor(u.vx, u.vz);
    }
    turnTo(v, want, dt, 10);
    P.apply(b, mode, G.time + u.id, damp(16, dt), o);
    b.root.position.set(u.x, hop, u.z);
    b.root.updateMatrixWorld(true);
    v.tag.position.set(u.x, hop + v.tagY, u.z);
    v.held.visible = mode === 'ready';
    if (v.held.visible) v.held.position.copy(handPos(b, 1, tmpV));
    v.shovel.visible = mode === 'shovel';
    if (v.shovel.visible) {
      handPos(b, 1, tmpV);
      v.shovel.position.copy(tmpV);
      v.shovel.rotation.set(b.armR.rotation.x - 0.4, v.yaw, 0, 'YXZ');
    }
  }

  // ---------------------------------------------------------------- snowballs, power-ups, aim rings

  let ballGeo = null, ballMat = null, shadowMat = null, shadowGeo = null, rimMat = null;
  // A snowball (radius 1, scale it), with a dark rim so it shows up against white snow.
  function snowballMesh() {
    ballGeo = ballGeo || new T.SphereGeometry(1, 14, 10);
    ballMat = ballMat || Kit.gfx.std('#ffffff', { emissive: '#d6ecff', emissiveIntensity: 0.3, roughness: 0.75 });
    rimMat = rimMat || new T.MeshBasicMaterial({ color: '#2d4f86', side: T.BackSide });
    const m = new T.Mesh(ballGeo, ballMat);
    m.castShadow = true;
    const rim = new T.Mesh(ballGeo, rimMat);
    rim.scale.setScalar(1.2);
    m.add(rim);
    return m;
  }

  function syncBall(bl) {
    let v = vis.balls.get(bl.id);
    if (!v) {
      shadowGeo = shadowGeo || new T.CircleGeometry(1, 18);
      shadowMat = shadowMat || new T.MeshBasicMaterial({ color: '#4a5a80', transparent: true, opacity: 0.28, depthWrite: false });
      v = { mesh: snowballMesh(), shadow: new T.Mesh(shadowGeo, shadowMat) };
      v.mesh.scale.setScalar(bl.r);
      v.shadow.rotation.x = -PI / 2;
      scene.add(v.mesh, v.shadow);
      if (bl.lob) {
        v.marker = groundRing(0.42, 0.6, SIDE[bl.side].main);
        v.marker.position.set(bl.tx, 0.045, bl.tz);
        scene.add(v.marker);
      }
      vis.balls.set(bl.id, v);
    }
    v.seen = true;
    v.mesh.position.set(bl.x, bl.y, bl.z);
    v.mesh.rotation.x += 0.2;
    v.shadow.position.set(bl.x, 0.03, bl.z);
    v.shadow.scale.setScalar(bl.r * clamp(1.4 - bl.y * 0.12, 0.5, 1.4));
    if (v.marker) {
      const u = clamp(bl.age / bl.flight, 0, 1);
      v.marker.scale.setScalar(1.3 - u * 0.5 + Math.sin(G.time * 18) * 0.05);
      v.marker.material.opacity = 0.35 + u * 0.55;
    }
  }

  const iconCache = {};
  function pickupTexture(kind) {
    const key = kind + Kit.lang.get();
    if (iconCache[key]) return iconCache[key];
    const [c, g] = Kit.gfx.makeCanvas(128, 128);
    const gr = g.createRadialGradient(64, 54, 8, 64, 64, 60);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(1, kind === 'cocoa' ? '#ffb36b' : kind === 'shovel' ? '#9dff6a' : kind === 'triple' ? '#ff9fd0' : '#9fdcff');
    g.fillStyle = gr;
    g.beginPath(); g.arc(64, 64, 58, 0, PI * 2); g.fill();
    g.lineWidth = 7;
    g.strokeStyle = '#14121f';
    g.stroke();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (kind === 'giant') {
      const b = g.createRadialGradient(54, 52, 4, 64, 64, 40);
      b.addColorStop(0, '#ffffff');
      b.addColorStop(1, '#a8cdf0');
      g.fillStyle = b;
      g.beginPath(); g.arc(64, 66, 38, 0, PI * 2); g.fill();
      g.lineWidth = 4;
      g.strokeStyle = '#4a6a9a';
      g.stroke();
      g.font = `30px ${Kit.gfx.FONT}`;
      g.fillStyle = '#1f4fe0';
      g.fillText(Kit.lang.t('BIG'), 64, 68);
    } else if (kind === 'shovel') {
      g.save();
      g.translate(64, 64);
      g.rotate(-0.6);
      g.fillStyle = '#8a5a2b';
      g.fillRect(-5, -48, 10, 62);
      g.fillStyle = '#14121f';
      g.fillRect(-14, -52, 28, 9);
      g.fillStyle = '#e8433a';
      g.beginPath(); g.moveTo(-22, 12); g.lineTo(22, 12); g.lineTo(18, 46); g.quadraticCurveTo(0, 54, -18, 46); g.closePath(); g.fill();
      g.lineWidth = 4;
      g.strokeStyle = '#14121f';
      g.stroke();
      g.restore();
    } else {
      g.font = `70px ${Kit.gfx.EMOJI_FONT}`;
      g.fillText(kind === 'cocoa' ? '☕' : '✌️', 64, 70);
    }
    return (iconCache[key] = Kit.gfx.toTexture(c));
  }

  // Switching language: name tags and power-up icons are drawn on canvases, so build them again.
  function relabel() {
    for (const map of [vis.players, vis.buds, vis.pickups]) {
      for (const v of map.values()) removeVis(v);
      map.clear();
    }
  }

  function syncPickup(u) {
    let v = vis.pickups.get(u.id);
    if (!v) {
      v = {};
      v.icon = new T.Sprite(new T.SpriteMaterial({ map: pickupTexture(u.kind), depthWrite: false }));
      v.icon.scale.set(0.95, 0.95, 1);
      v.glow = new T.Sprite(new T.SpriteMaterial({ map: Kit.gfx.glowTexture(), color: '#fff3a0', transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
      v.glow.scale.set(2, 2, 1);
      v.shadow = groundRing(0.0, 0.45, '#4a5a80');
      v.shadow.material.opacity = 0.25;
      scene.add(v.icon, v.glow, v.shadow);
      vis.pickups.set(u.id, v);
    }
    v.seen = true;
    const y = u.y + 0.75 + Math.sin(G.time * 3 + u.id) * 0.12;
    v.icon.position.set(u.x, y, u.z);
    v.glow.position.set(u.x, y, u.z - 0.05);
    v.glow.material.opacity = 0.55 + Math.sin(G.time * 5) * 0.2;
    v.shadow.position.set(u.x, 0.04, u.z);
    v.icon.material.opacity = u.life < 3 ? 0.5 + 0.5 * Math.sign(Math.sin(G.time * 14)) : 1;
  }

  // A ring under whoever each human player is aiming at; it grows and pulses while a lob is held.
  function syncAimRings() {
    for (const p of M.players) {
      if (!p.human) continue;
      let r = vis.rings.get(p.id);
      if (!r) {
        r = { ring: groundRing(0.62, 0.78, SIDE[p.side].main) };
        scene.add(r.ring);
        vis.rings.set(p.id, r);
      }
      r.seen = true;
      const t = M.phase === 'play' && (p.ammo > 0 || p.giant || p.meter >= 1) ? E.pickTarget(M, p) : null;
      r.ring.visible = !!t;
      if (t) {
        r.ring.position.set(t.x, 0.05, t.z);
        const s = p.charging ? 1.25 + Math.sin(G.time * 14) * 0.12 : 1;
        r.ring.scale.setScalar(s);
        r.ring.material.opacity = p.charging ? 0.95 : 0.45;
      }
    }
  }

  function syncAll(dt) {
    for (const map of [vis.players, vis.buds, vis.balls, vis.pickups, vis.rings]) for (const v of map.values()) v.seen = false;
    for (const p of M.players) syncPlayer(p, dt);
    for (const u of M.buddies) syncBuddy(u, dt);
    for (const b of M.balls) syncBall(b);
    for (const u of M.pickups) syncPickup(u);
    syncAimRings();
    for (const map of [vis.players, vis.buds, vis.balls, vis.pickups, vis.rings]) {
      for (const [id, v] of map) {
        if (!v.seen) {
          removeVis(v);
          map.delete(id);
        }
      }
    }
  }

  // ---------------------------------------------------------------- events

  const who = (id) => M.players.find((p) => p.id === id);
  const budVis = (id) => vis.buds.get(id);
  const humanCount = () => M.players.filter((p) => p.human).length;

  function onEvent(e) {
    const fight = G.screen === 'fight';
    const p = e.pid ? who(e.pid) : null;
    switch (e.type) {
      case 'roundStart': {
        if (!fight) break;
        const final = M.rounds[0] === TUNE().roundsToWin - 1 && M.rounds[1] === TUNE().roundsToWin - 1;
        banner(final ? 'FINAL ROUND' : `ROUND ${e.round}`, 'small', 1.3, M.mode === 'coop' ? waveText(e.round) : '');
        Kit.sound.click();
        if (e.round > 1) buildHud();
        break;
      }
      case 'go':
        if (fight) {
          banner('SNOWBALL FIGHT!', '', 1.0);
          S.whistle();
        }
        break;
      case 'throw':
        if (fight) e.lob ? S.lob() : S.throw();
        break;
      case 'buddyThrow': {
        const v = budVis(e.bud);
        if (v) v.throwT = 0.36;
        if (fight) S.throw();
        break;
      }
      case 'specialShot':
        if (fight) {
          if (e.key === 'boxing' || e.key === 'flurry') {
            S.jab();
            if (p) FX.word(p.x + p.face * 0.9, 1.9, p.z, 'BOP!');
          } else S.throw();
        }
        break;
      case 'hit': {
        FX.puff(e.x, e.y, e.z, { n: e.giant ? 26 : 14, speed: e.giant ? 5 : 3.2, size: e.giant ? 0.5 : 0.34 });
        FX.word(e.x, e.y + 0.6, e.z, e.giant ? 'BIG SPLAT!' : 'SPLAT!', e.giant);
        if (p) {
          FX.decal(p.x + (Math.random() - 0.5) * 0.6, p.z + (Math.random() - 0.5) * 0.6, e.giant ? 1.6 : 0.9);
          const v = vis.players.get(p.id);
          if (v) v.splatT = 1.3;
        }
        if (fight) {
          S.splat(e.giant);
          const by = who(e.by);
          if (by && by.human) S.yay();
          G.shake = Math.max(G.shake, e.giant ? 0.35 : 0.12);
          bump('sc' + (p ? 1 - p.side : 0));
        }
        break;
      }
      case 'freeze':
        if (p) {
          FX.word(p.x, 2.6, p.z, 'BRRR!', true);
          FX.puff(p.x, 2.0, p.z, { n: 12, speed: 2, size: 0.3, color: '#bfe6ff' });
        }
        if (fight && p) {
          S.freeze();
          toast(`🥶 BRAIN FREEZE! ${p.name} IS DIZZY`, 'freeze');
          later(E.TUNE.dizzy, () => S.unfreeze());
        }
        break;
      case 'fort': {
        const s = M.segs[e.seg];
        FX.chunks(e.x, e.y, e.z, e.giant ? 10 : 5, s.side === 0 ? -1 : 1);
        FX.puff(e.x, e.y, e.z, { n: e.giant ? 16 : 8, speed: 2.4, size: 0.3 });
        if (fight) S.fort(e.giant || e.lvl === 0);
        break;
      }
      case 'segUp': {
        const s = M.segs[e.seg];
        FX.puff(s.x, 0.3 + e.lvl * 0.3, s.zc, { n: 5, speed: 1.4, size: 0.28 });
        if (fight) S.rebuild();
        break;
      }
      case 'ground':
        FX.puff(e.x, 0.1, e.z, { n: e.giant ? 14 : 6, speed: e.giant ? 3 : 1.8, size: e.giant ? 0.42 : 0.26 });
        FX.decal(e.x, e.z, e.giant ? 1.4 : 0.6);
        if (fight) S.ground();
        break;
      case 'thud':
        ST.wobble(e.obst, e.giant ? 2 : 1);
        FX.puff(e.x, e.y, e.z, { n: 8, speed: 2, size: 0.3 });
        if (fight) S.thud();
        break;
      case 'poof':
        FX.word(e.x, e.y + 0.4, e.z, 'POOF!');
        FX.puff(e.x, e.y, e.z, { n: 12, speed: 2.5, size: 0.3 });
        if (fight) S.poof();
        break;
      case 'shield':
        FX.word(e.x, e.y + 0.5, e.z, 'FSSS!');
        FX.puff(e.x, e.y, e.z, { n: 10, speed: 1.6, size: 0.4, color: '#ffe0c0', up: 2 });
        if (fight) S.shield();
        break;
      case 'graze':
        FX.word(e.x, e.y + 0.5, e.z, 'BOINK!');
        FX.puff(e.x, e.y, e.z, { n: 6, speed: 1.5, size: 0.26 });
        if (fight) S.graze();
        break;
      case 'saved': {
        FX.word(e.x, e.y + 0.6, e.z, 'SAVED!', true);
        FX.puff(e.x, e.y, e.z, { n: 14, speed: 3, size: 0.32, color: '#d8ffd0' });
        if (p) FX.ring(p.x, p.z, '#7dff5a', 3);
        const v = budVis(e.bud);
        if (v) { v.poseT = 0.6; v.posed = 'guard'; }
        if (fight) {
          S.save();
          toast(`${e.name} SAVED ${p && humanCount() > 1 ? p.name : 'YOU'}!`, 'save');
        }
        break;
      }
      case 'scooped':
        if (fight && p && p.human) S.scooped(e.ammo);
        if (p) FX.puff(p.x + p.face * 0.4, 0.5, p.z, { n: 4, speed: 1, size: 0.24 });
        break;
      case 'empty':
        if (fight && p && p.human) {
          S.empty();
          hint('empty' + p.id, isTouch && humanCount() === 1 ? 'No snowballs! Hold 🤲 to scoop snow' : `No snowballs! Hold ${p.ctrl === 1 ? 'K' : 'G'} to scoop snow`);
        }
        break;
      case 'notReady':
        if (fight && p && p.human) {
          S.nope();
          hint('special' + p.id, 'Hit snowballs to fill your ⭐ special!');
        }
        break;
      case 'drop':
        FX.ring(e.x, e.z, '#ffd400', 2);
        if (fight) S.drop();
        break;
      case 'fizzle':
        FX.puff(e.x, 0.6, e.z, { n: 8, speed: 1.4, size: 0.3, color: '#fff3a0' });
        break;
      case 'pickup':
        if (p) {
          FX.ring(p.x, p.z, '#ffd400', 2.5);
          FX.emoji(e.icon, p.x, 2.4, p.z, { size: 0.9, life: 1.1 });
          if (e.kind === 'shovel') for (const s of M.segs) if (s.side === p.side) FX.puff(s.x, 0.6, s.zc, { n: 3, speed: 1.2, size: 0.3 });
        }
        if (fight && p) {
          S.pickup();
          const what = { giant: 'GIANT SNOWBALL!', triple: 'TRIPLE THROW ×3!', shovel: 'FORT REBUILT!', cocoa: 'HOT COCOA SHIELD!' }[e.kind];
          toast(`${e.icon} ${humanCount() > 1 || !p.human ? p.name + ': ' : ''}${what}`, 's' + p.side);
        }
        break;
      case 'special':
        if (p) {
          // effects go above and behind, so the Y pose and the giant snowball overhead stay in sight
          if (e.key.startsWith('peace')) {
            FX.word(p.x - p.face * 0.6, 3.7, p.z - 0.3, 'PEACE!');
            for (let i = 0; i < 6; i++) FX.emoji(i % 2 ? '⭐' : '✌️', p.x + Math.cos(i) * 1.1, 2.4 + (i % 3) * 0.3, p.z + Math.sin(i) * 0.9, { size: 0.5, life: 1, vy: 1.4 });
          } else FX.emoji(e.icon, p.x - p.face * 1.1, 3.0, p.z - 0.2, { size: 1.0, life: 1.0 });
        }
        if (fight && p) {
          S.special();
          banner(`${e.icon} ${e.name}!`, 'small s' + p.side, 1.0);
        }
        break;
      case 'land':
        if (fight) Kit.sound.land();
        if (p) FX.puff(p.x, 0.1, p.z, { n: 8, speed: 2, size: 0.3 });
        break;
      case 'slam':
        FX.ring(e.x, e.z, '#ffffff', 4);
        FX.puff(e.x, 0.3, e.z, { n: 26, speed: 5, size: 0.5 });
        FX.word(e.x, 1.8, e.z, 'WHUMP!', true);
        FX.decal(e.x, e.z, 2.6);
        if (fight) {
          S.slam();
          G.shake = Math.max(G.shake, 0.45);
        }
        break;
      case 'buddyIn':
        if (fight && p) {
          S.buddy();
          toast(`${e.name} IS COMING! 🏃`, 's' + p.side);
        }
        break;
      case 'buddyHello': {
        const u = M.buddies.find((b) => b.id === e.bud);
        if (u && fight) {
          if (u.char === 'tommy') FX.word(u.x, 2.4, u.z, 'PEACE!');
          else if (u.char === 'teddy') { FX.word(u.x + u.face * 0.6, 2.0, u.z, 'BOP!'); S.jab(); }
          else FX.emoji('👋', u.x, 2.4, u.z, { size: 0.7 });
        }
        break;
      }
      case 'treat': {
        const u = M.buddies.find((b) => b.id === e.bud);
        if (u && p) {
          const v = budVis(u.id);
          const from = v ? handPos(v.body, 1, new T.Vector3()) : new T.Vector3(u.x, 1.4, u.z);
          FX.emoji(e.emoji, from.x, from.y, from.z, { to: () => ({ x: p.x, y: 1.9 * (vis.players.get(p.id) || { scale: 1 }).scale + p.y, z: p.z }), life: 0.75, size: 0.85 });
          later(0.75, () => {
            FX.emoji(e.emoji, p.x, 2.2, p.z, { size: 1.1, life: 1.0, vy: 0.6 });
            FX.puff(p.x, 2.0, p.z, { n: 8, speed: 1.6, size: 0.25, color: '#fff3a0' });
          });
          if (v) { v.poseT = 0.6; v.posed = 'give'; }
        }
        if (fight && p) {
          S.treat();
          toast(`${e.emoji} ${e.name} FROM ${e.by}!`, 's' + p.side);
        }
        break;
      }
      case 'buddyBye':
        if (fight) S.bye();
        break;
      case 'buddyWait':
        if (fight && p) {
          S.nope();
          hint('wait' + p.id, `${charName(p.buddyChar)} is resting… ${Math.ceil(e.t)} s`);
        }
        break;
      case 'timeWarn':
        if (fight) toast('⏰ 10 SECONDS LEFT!', 'hint');
        break;
      case 'melt':
        FX.puff(e.x, e.y, e.z, { n: 6, speed: 1.2, size: 0.3, color: '#dff3ff', up: 1.5 });
        break;
      case 'sudden':
        if (fight) {
          banner('NEXT HIT WINS!', 'warn', 1.8, 'THE FORTS ARE MELTING!');
          S.whistle();
        }
        break;
      case 'roundEnd': {
        const team = M.players.filter((q) => q.side === e.side);
        if (fight) {
          const name = teamName(e.side);
          const sub = e.reason === 'time' ? "TIME'S UP!" : '';
          banner(e.last ? `${name} WIN${team.length > 1 || M.mode === 'coop' ? '' : 'S'}!` : `${name} WIN${team.length > 1 || M.mode === 'coop' ? '' : 'S'} THE ROUND!`, e.last ? 'win' : 'small s' + e.side, 2.4, sub);
          const mine = M.players.some((q) => q.human && q.side === e.side) || humanCount() > 1 && M.mode === '2p';
          if (mine) { S.fanfare(); S.cheer(); } else S.aww();
          bump('rw' + e.side);
        }
        for (const q of team) FX.confetti(q.x, 2.5, q.z, 30);
        break;
      }
      case 'matchOver':
        if (fight) {
          Kit.sound.music('over');
          later(2.8, showResults);
        }
        break;
      case 'lineup':
        if (fight) later(0.05, buildHud);
        break;
      default:
        break;
    }
  }

  const TUNE = () => E.TUNE;

  function teamName(side) {
    if (M.mode === 'coop') return side === 0 ? 'THE BROTHERS' : 'THE SNOW CREW';
    const t = M.players.filter((p) => p.side === side);
    return t.map((p) => p.name).join(' & ');
  }

  function waveText(round) {
    const w = E.COOP_WAVES[Math.min(round - 1, E.COOP_WAVES.length - 1)];
    return 'VS ' + w.map(([, n]) => n).join(', ');
  }

  // ---------------------------------------------------------------- HUD

  function bump(id) {
    const el = $(id);
    if (!el) return;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  let bannerTimer = 0;
  function banner(text, cls = '', secs = 1.4, sub = '') {
    const el = $('banner');
    el.className = 'banner ' + cls;
    el.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.remove('show'), secs * 1000);
  }

  function toast(text, cls = '') {
    const box = $('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => el.remove(), 2100);
  }

  // A gentle reminder, at most every few seconds per kind.
  function hint(key, text) {
    if (G.time - (G.hintT[key] || -99) < 4) return;
    G.hintT[key] = G.time;
    toast(text, 'hint');
  }

  function portrait(id) {
    return portraits[id] || portraits.teddy;
  }

  function buildHud() {
    hud = [];
    for (const side of [0, 1]) {
      const box = $('side' + side);
      box.innerHTML = '';
      const team = M.players.filter((p) => p.side === side);
      for (const p of team) {
        const el = document.createElement('div');
        el.className = 'mem' + (team.length > 1 ? ' small' : '');
        const whoTag = p.human ? (M.mode === '1p' ? 'YOU' : p.ctrl === 0 ? '1P' : '2P') : 'CPU';
        const key = p.ctrl === 1 ? '⏎' : 'T';
        const spKey = p.ctrl === 1 ? 'L' : 'H';
        el.innerHTML = `<div class="face"><img alt="" src="${portrait(p.char)}"></div>
          <div class="info">
            <div class="nmrow"><span class="nm">${p.name}</span><span class="who">${whoTag}</span></div>
            <div class="ammo"><i></i><i></i><i></i><em></em></div>
            <div class="meter"><span>⭐</span>${p.human && !isTouch ? `<span class="key">${spKey}</span>` : ''}</div>
            ${p.buddyChar && p.human ? `<div class="bud" title="Call your brother"><div class="ring"><img alt="" src="${portrait(p.buddyChar)}"></div><b>${charName(p.buddyChar)}<small>CALL ME!</small></b><span class="k">${key}</span></div>` : ''}
          </div>`;
        box.appendChild(el);
        const h = { p, el, pips: [...el.querySelectorAll('.ammo i')], em: el.querySelector('.ammo em'), meter: el.querySelector('.meter'), bud: el.querySelector('.bud'), cache: {} };
        if (h.bud) {
          h.budRing = h.bud.querySelector('.ring');
          h.budLabel = h.bud.querySelector('b small');
          h.bud.addEventListener('pointerdown', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            Kit.sound.init();
            I.callBuddy(M.mode === '1p' ? 0 : p.ctrl);
          });
        }
        hud.push(h);
      }
    }
    $('toWin').textContent = `FIRST TO ${E.TUNE.toWin} HITS · BEST OF 3`;
    placeToasts();
    // the big touch button calls player 1's companion
    const p1 = M.players.find((p) => p.human && p.ctrl === 0);
    if (p1 && p1.buddyChar) $('tBud').querySelector('img').src = portrait(p1.buddyChar);
    $('tBud').querySelector('small').textContent = p1 && p1.buddyChar ? charName(p1.buddyChar) : 'BROTHER';
    showTouch();
  }

  // Toasts go just under the scoreboard, which is taller when a side has two or three players.
  function placeToasts() {
    $('toasts').style.top = Math.round($('board').getBoundingClientRect().bottom + 10) + 'px';
  }

  function setVar(el, name, v, cache, key) {
    const r = Math.round(v * 100) / 100;
    if (cache[key] === r) return;
    cache[key] = r;
    el.style.setProperty(name, r);
  }

  function setText(el, text, cache, key) {
    if (cache[key] === text) return;
    cache[key] = text;
    el.textContent = text;
  }

  function setClass(el, cls, on, cache, key) {
    if (cache[key] === on) return;
    cache[key] = on;
    el.classList.toggle(cls, on);
  }

  function updateHud() {
    if (!M || G.screen !== 'fight' && G.screen !== 'pause') return;
    const c = G.hudCache = G.hudCache || {};
    setText($('sc0'), String(M.score[0]), c, 'sc0');
    setText($('sc1'), String(M.score[1]), c, 'sc1');
    const need = E.TUNE.roundsToWin;
    setText($('rw0'), '★'.repeat(M.rounds[0]) + '☆'.repeat(Math.max(0, need - M.rounds[0])), c, 'rw0');
    setText($('rw1'), '★'.repeat(M.rounds[1]) + '☆'.repeat(Math.max(0, need - M.rounds[1])), c, 'rw1');
    const tl = Math.ceil(M.timeLeft);
    setText($('clock'), M.sudden ? 'NEXT HIT!' : `${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}`, c, 'clock');
    setClass($('clock'), 'warn', M.phase === 'play' && (M.timeLeft <= 10 || M.sudden), c, 'clockWarn');
    if (M.phase === 'play' && M.timeLeft <= 10 && !M.sudden && tl !== G.lastTick) {
      G.lastTick = tl;
      if (tl > 0) S.tick();
    }
    for (const h of hud) {
      const p = h.p, k = h.cache;
      h.pips.forEach((el, i) => {
        const on = i < p.ammo;
        if (k['pip' + i] !== on) {
          k['pip' + i] = on;
          el.classList.toggle('on', on);
          if (on) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
        }
      });
      const em = p.giant ? '❄️ BIG' : p.triple ? `✌️×${p.triple}` : p.shieldT > 0 ? `☕ ${Math.ceil(p.shieldT)}` : '';
      setText(h.em, em, k, 'em');
      setVar(h.meter, '--fill', p.meter, k, 'meter');
      setClass(h.meter, 'ready', p.meter >= 1, k, 'ready');
      setClass(h.el, 'frozen', p.state === 'dizzy', k, 'frozen');
      if (h.bud) {
        const u = M.buddies.find((b) => b.owner === p.id);
        const here = u && u.state !== 'out';
        let fill = 1, label = 'CALL ME!';
        if (here) {
          fill = u.state === 'work' ? clamp(u.life / u.maxLife, 0, 1) : u.state === 'bye' ? 0 : 1;
          label = u.state === 'bye' ? 'BYE!' : 'TAP: TREAT!';
        } else if (p.budRest > 0) {
          fill = 1 - p.budRest / E.TUNE.buddyRest2p;
          label = `RESTING ${Math.ceil(p.budRest)}`;
        }
        setVar(h.budRing, '--fill', fill, k, 'bfill');
        setClass(h.bud, 'on', !!here, k, 'bon');
        setClass(h.bud, 'rest', !here && p.budRest > 0, k, 'brest');
        setText(h.budLabel, label, k, 'blabel');
        if (p.ctrl === 0 && G.touchOn) {
          const tb = $('tBud');
          setVar(tb, '--fill', here ? fill : p.budRest > 0 ? fill : 1, k, 'tfill');
          setClass(tb, 'on', !!here, k, 'ton');
          setClass(tb, 'rest', !here && p.budRest > 0, k, 'trest');
          setClass(document.querySelector('.tb.sp'), 'ready', p.meter >= 1, k, 'tsp');
        }
      }
    }
  }

  // ---------------------------------------------------------------- screens

  function setScreen(name) {
    G.screen = name;
    for (const id of ['title', 'select', 'pause', 'results']) $(id).classList.toggle('hidden', id !== name);
    $('hud').classList.toggle('hidden', !(name === 'fight' || name === 'pause'));
    I.setEnabled(name === 'fight');
    showTouch();
  }

  function showTouch() {
    const on = G.screen === 'fight' && M && M.mode === '1p' && (isTouch || G.touchOn);
    G.touchOn = !!(isTouch || G.touchOn);
    $('touch').classList.toggle('hidden', !on);
  }

  function goTitle() {
    G.paused = false;
    setScreen('title');
    if (!M || M.mode !== 'demo') startDemo();
    Kit.sound.music('title');
    refreshLevel();
  }

  function refreshLevel() {
    document.querySelectorAll('[data-level]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.level === G.level)));
  }

  function openSelect(mode) {
    G.mode = mode;
    G.picks = (G.picks || ['teddy', 'tommy']).slice(0, 2);
    if (!ROSTER.includes(G.picks[0])) G.picks[0] = 'teddy';
    if (!ROSTER.includes(G.picks[1])) G.picks[1] = 'tommy';
    if (!M || M.mode !== 'demo') startDemo();
    setScreen('select');
    refreshSelect();
  }

  function refreshSelect() {
    const mode = G.mode;
    $('selTitle').textContent = mode === 'coop' ? 'PICK THE BROTHERS' : mode === '2p' ? 'PICK YOUR SNOWBALLERS' : 'WHO ARE YOU?';
    $('vsWord').textContent = mode === 'coop' ? '&' : 'VS';
    $('pick1').classList.toggle('s1', mode !== 'coop');
    $('pick1').classList.toggle('team', mode === 'coop');
    $('pick0').querySelector('.who').textContent = mode === '1p' ? 'YOU' : '1P';
    $('pick1').querySelector('.who').textContent = mode === '1p' ? 'CPU' : '2P';
    const inPlay = G.picks.slice();
    const taken = [];
    [0, 1].forEach((i) => {
      const el = $('pick' + i), id = G.picks[i];
      el.querySelector('img').src = portrait(id);
      el.querySelector('.nm').textContent = charName(id);
      const human = i === 0 || mode !== '1p';
      const pal = el.querySelector('.pal');
      if (human) {
        const b = buddyOf(id, inPlay, taken);
        taken.push(b);
        pal.innerHTML = `<img alt="" src="${portrait(b)}"><span>+ buddy<b>${charName(b)}</b></span>`;
      } else pal.innerHTML = `<span>${G.level === 'easy' ? '🐣 EASY' : '🔥 NORMAL'}</span>`;
    });
    const crew = $('crew');
    crew.classList.toggle('hidden', mode !== 'coop');
    if (mode === 'coop') {
      crew.innerHTML = `<img alt="" src="${portrait('snowman')}"><img alt="" src="${portrait('bolt')}"><b>VS THE SNOW CREW<small>snowmen and Bolt robots · ${G.level === 'easy' ? '🐣 easy' : '🔥 normal'}</small></b>`;
    }
    $('selHint').textContent = isTouch ? 'Tap the arrows to pick' : mode === '1p' ? 'A D: you · ← →: computer · F or Enter to start · Esc to go back' : 'A D: player 1 · ← →: player 2 · F or Enter to start · Esc to go back';
  }

  function cyclePick(i, d) {
    const n = ROSTER.length;
    let k = ROSTER.indexOf(G.picks[i]);
    k = (k + d + n) % n;
    G.picks[i] = ROSTER[k];
    store.set('picks', G.picks);
    Kit.sound.click();
    refreshSelect();
  }

  function go() {
    Kit.sound.init();
    Kit.sound.click();
    store.set('picks', G.picks);
    startMatch(makeCfg(G.mode, G.level, G.picks));
  }

  function pause(on) {
    if (G.screen !== 'fight' && G.screen !== 'pause') return;
    G.paused = on;
    setScreen(on ? 'pause' : 'fight');
    Kit.sound.music(on ? 'pause' : 'play');
  }

  function showResults() {
    if (!M || M.phase !== 'over') return;
    setScreen('results');
    const w = M.winner;
    const team = M.players.filter((p) => p.side === w);
    const humanWon = team.some((p) => p.human);
    $('resFace').src = portrait(M.mode === 'coop' && w === 1 ? 'snowman' : team[0].char);
    let title = `${teamName(w)} WIN${team.length > 1 || M.mode === 'coop' ? '' : 'S'}!`;
    if (M.mode === '1p' && !humanWon) title += ' GOOD TRY!';
    if (M.mode === 'coop' && !humanWon) title = 'THE SNOW CREW WINS! TRY AGAIN!';
    $('resTitle').textContent = title;
    const rows = M.players.filter((p) => p.human || M.mode === '1p');
    const st = $('stats');
    st.style.gridTemplateColumns = 'auto repeat(5, auto)';
    st.innerHTML = '<span></span><span class="h">HITS</span><span class="h">THROWS</span><span class="h">⭐</span><span class="h">🥶</span><span class="h">TREATS</span>' +
      rows.map((p) => `<span class="l">${p.name}</span><b>${p.stats.hits}</b><b>${p.stats.thrown}</b><b>${p.stats.specials}</b><b>${p.stats.freezes}</b><b>${p.stats.treats}</b>`).join('');
  }

  function bindMenus() {
    document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
      Kit.sound.init();
      Kit.sound.click();
      openSelect(b.dataset.mode);
    }));
    document.querySelectorAll('[data-level]').forEach((b) => b.addEventListener('click', () => {
      Kit.sound.init();
      G.level = b.dataset.level;
      store.set('level', G.level);
      Kit.sound.click();
      refreshLevel();
    }));
    [0, 1].forEach((i) => $('pick' + i).querySelectorAll('.arr').forEach((b) => b.addEventListener('click', () => cyclePick(i, +b.dataset.d))));
    $('goBtn').addEventListener('click', go);
    $('backBtn').addEventListener('click', () => { Kit.sound.click(); goTitle(); });
    $('pauseBtn').addEventListener('click', () => pause(true));
    $('muteBtn').addEventListener('click', toggleMute);
    $('resumeBtn').addEventListener('click', () => pause(false));
    $('restartBtn').addEventListener('click', () => startMatch(makeCfg(G.lastCfg.mode, G.lastCfg.level, G.picks)));
    $('menuBtn').addEventListener('click', goTitle);
    $('againBtn').addEventListener('click', () => startMatch(makeCfg(G.lastCfg.mode, G.lastCfg.level, G.picks)));
    $('menuBtn2').addEventListener('click', goTitle);
    window.addEventListener('pointerdown', (e) => {
      Kit.sound.init();
      if (e.pointerType === 'touch' && !G.touchOn) {
        G.touchOn = true;
        showTouch();
      }
    }, { capture: true });
    window.addEventListener('keydown', onMenuKey);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        Kit.sound.suspend();
        if (G.screen === 'fight' && !G.hooks) pause(true);
      } else Kit.sound.resume();
    });
  }

  function toggleMute() {
    Kit.sound.init();
    Kit.sound.toggleMute();
    $('muteBtn').textContent = Kit.sound.isMuted() ? '🔇' : '🔊';
  }

  function onMenuKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    Kit.sound.init();
    const c = e.code;
    if (c === 'KeyM') { toggleMute(); return; }
    if (G.screen === 'title') {
      if (c === 'Enter' || c === 'Space' || c === 'KeyF' || c === 'Digit1') openSelect('1p');
      else if (c === 'Digit2') openSelect('2p');
      else if (c === 'Digit3') openSelect('coop');
      else if (c === 'ArrowLeft' || c === 'ArrowRight' || c === 'KeyA' || c === 'KeyD') {
        G.level = G.level === 'easy' ? 'normal' : 'easy';
        store.set('level', G.level);
        Kit.sound.click();
        refreshLevel();
      } else return;
      e.preventDefault();
    } else if (G.screen === 'select') {
      if (c === 'KeyA') cyclePick(0, -1);
      else if (c === 'KeyD') cyclePick(0, 1);
      else if (c === 'ArrowLeft') cyclePick(1, -1);
      else if (c === 'ArrowRight') cyclePick(1, 1);
      else if (c === 'Enter' || c === 'Space' || c === 'KeyF' || c === 'KeyJ') go();
      else if (c === 'Escape') goTitle();
      else return;
      e.preventDefault();
    } else if (G.screen === 'fight') {
      if (c === 'KeyP' || c === 'Escape') pause(true);
    } else if (G.screen === 'pause') {
      if (c === 'KeyP' || c === 'Escape' || c === 'Enter' || c === 'Space') pause(false);
    } else if (G.screen === 'results') {
      if (c === 'Enter' || c === 'Space') $('againBtn').click();
      else if (c === 'Escape') goTitle();
    }
  }

  // ---------------------------------------------------------------- the loop

  function frame(dt, draw = true) {
    if (resize() && G.screen === 'fight') placeToasts();
    G.time += dt;
    for (let i = G.timers.length - 1; i >= 0; i--) {
      const t = G.timers[i];
      if ((t.t -= dt) <= 0) {
        G.timers.splice(i, 1);
        t.fn();
      }
    }
    if (M) {
      if (G.screen === 'fight' && !G.paused) {
        E.step(M, dt, [I.snapshot(0), I.snapshot(1)]);
      } else if (M.mode === 'demo') {
        // the demo behind the menus: the brothers call each other in now and then
        if ((G.demoCall -= dt) <= 0) {
          G.demoCall = 8 + Math.random() * 8;
          const p = M.players[Math.floor(Math.random() * 2)];
          if (M.phase === 'play') E.callBuddy(M, p);
        }
        E.step(M, dt, []);
        if (M.phase === 'over' && (G.overT += dt) > 4) startDemo();
      }
      for (const e of M.events) onEvent(e);
      M.events.length = 0;
      syncAll(dt);
    }
    ST.update(dt);
    FX.update(dt);
    updateCamera(dt);
    updateHud();
    if (draw) renderer.render(scene, camera);
  }

  let last = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    if (!G.frozen) frame(dt);
  }

  // ---------------------------------------------------------------- start

  function snowmanPortrait() {
    const [c, g] = Kit.gfx.makeCanvas(152, 152);
    g.fillStyle = '#f4f8ff';
    g.beginPath(); g.arc(76, 172, 58, 0, PI * 2); g.fill();
    const gr = g.createRadialGradient(64, 82, 10, 76, 96, 50);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(1, '#cfe0f4');
    g.fillStyle = gr;
    g.beginPath(); g.arc(76, 96, 46, 0, PI * 2); g.fill();
    g.fillStyle = '#e8433a';
    g.fillRect(30, 132, 92, 16);
    g.fillStyle = '#2b2a33';
    g.fillRect(28, 50, 96, 9);
    g.fillRect(46, 6, 60, 46);
    g.fillStyle = '#e8433a';
    g.fillRect(46, 38, 60, 9);
    g.fillStyle = '#22232a';
    for (const x of [60, 92]) { g.beginPath(); g.arc(x, 86, 6, 0, PI * 2); g.fill(); }
    for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(58 + i * 9, 114 + Math.sin((i / 4) * PI) * 5, 3, 0, PI * 2); g.fill(); }
    g.fillStyle = '#ff8a1f';
    g.beginPath(); g.moveTo(74, 94); g.lineTo(122, 104); g.lineTo(74, 104); g.closePath(); g.fill();
    return c.toDataURL('image/png');
  }

  function init() {
    setupScene();
    try {
      portraits = Kit.portraits(Kit.roster.list.filter((e) => ROSTER.includes(e.id)));
    } catch (err) {
      portraits = {};
    }
    portraits.snowman = snowmanPortrait();
    $('logo').innerHTML = window.SB_TITLE_HTML;
    I.bindTouch($('stick'), $('knob'), [...document.querySelectorAll('#touch [data-act]')], $('tBud'));
    Kit.lang.onChange(relabel);
    bindMenus();
    $('muteBtn').textContent = Kit.sound.isMuted() ? '🔇' : '🔊';
    goTitle();
    $('loading').classList.add('hidden');
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------- test hooks (window.game)

  const hooks = () => { G.hooks = true; };
  window.game = {
    // advance the game by `seconds` in 1/60 s ticks and draw (for when the tab's animation is throttled)
    step(seconds = 1) {
      hooks();
      const n = Math.max(1, Math.round(seconds * 60));
      for (let i = 0; i < n; i++) frame(1 / 60);
      return this.state();
    },
    // start a match straight away: { mode: '1p' | '2p' | 'coop', p1, p2, level }
    // the same, drawing only the last frame (fast in a hidden or software-rendered browser)
    ff(seconds = 1) {
      hooks();
      const n = Math.max(1, Math.round(seconds * 60));
      for (let i = 0; i < n; i++) frame(1 / 60, i === n - 1);
      return this.state();
    },
    start(o = {}) {
      hooks();
      Kit.sound.init();
      G.picks = [o.p1 || 'teddy', o.p2 || 'tommy'];
      G.level = o.level || G.level;
      startMatch(makeCfg(o.mode || '1p', G.level, G.picks));
      return this.state();
    },
    title() { goTitle(); },
    select(mode) { openSelect(mode || '1p'); },
    state() {
      if (!M) return null;
      return {
        screen: G.screen, mode: M.mode, phase: M.phase, round: M.round, score: M.score.slice(), rounds: M.rounds.slice(), timeLeft: +M.timeLeft.toFixed(1),
        players: M.players.map((p) => ({ name: p.name, side: p.side, x: +p.x.toFixed(2), z: +p.z.toFixed(2), state: p.state, ammo: p.ammo, meter: +p.meter.toFixed(2), duck: p.duck, human: p.human })),
        buddies: M.buddies.map((u) => ({ name: u.name, state: u.state, life: +u.life.toFixed(1), save: u.save })),
        balls: M.balls.length, pickups: M.pickups.map((u) => u.kind), forts: M.segs.map((s) => s.lvl).join(''),
      };
    },
    match: () => M,
    // call player i's companion (i = index among the players)
    buddy(i = 0) { hooks(); return E.callBuddy(M, M.players[i]); },
    // fire player i's special right now (hold = the lob version)
    special(i = 0, hold = false) { hooks(); const p = M.players[i]; p.meter = 1; p.forceAct = hold ? 'specialHold' : 'special'; },
    throw(i = 0, lob = false) { hooks(); M.players[i].forceAct = lob ? 'lob' : 'throw'; },
    give(i = 0, kind = 'giant') { hooks(); E.applyPickup(M, M.players[i], kind); },
    set(i, props) { hooks(); Object.assign(M.players[i], props); },
    // freeze the real-time loop (screenshots driven by step() only)
    freeze(on = true) { hooks(); G.frozen = on; },
    soak: (n, o) => SB.sim.soak(n, o),
    versus: (a, b, n, o) => SB.sim.versus(a, b, n, o),
    sim: (cfg, o) => SB.sim.run(cfg || SB.sim.randomCfg(), o),
    hud: () => updateHud(),
    cam(o) { Object.assign(G.cam, o); G.camZoom = 1; return G.cam; },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
