/* SnowbaTTle — the snowy backyard: a packed-snow yard split by a low rope line, each side's snow forts (4 pieces
   of 3 hand-packed bricks each, which pop off when hit and pop back when rebuilt), a snowman and a pine tree per
   side, a picket fence, the house with warm windows, pines, drifts and falling snow. Everything is boxes, spheres
   and cones with canvas textures. */
(function () {
  'use strict';
  const T = THREE;
  const PI = Math.PI;
  const SIDE = [{ main: '#3d8bff', light: '#8cc2ff' }, { main: '#ff4b5c', light: '#ffb0b0' }];
  let G, scene;
  const st = { segs: [], obst: [], flakes: null, flakeV: null, time: 0 };

  const rnd = (seed) => {
    let s = seed;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  };

  // ---------------------------------------------------------------- textures

  function snowTexture() {
    const [c, g] = G.makeCanvas(256, 256);
    g.fillStyle = '#eef5ff';
    g.fillRect(0, 0, 256, 256);
    const r = rnd(7);
    for (let i = 0; i < 70; i++) {
      const x = r() * 256, y = r() * 256, rad = 12 + r() * 40;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, r() < 0.5 ? 'rgba(255,255,255,0.7)' : 'rgba(200,218,240,0.35)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 500; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(170,195,230,0.35)' : 'rgba(255,255,255,0.9)';
      g.fillRect(r() * 256, r() * 256, 1.5, 1.5);
    }
    const t = G.toTexture(c, true);
    t.repeat.set(14, 10);
    return t;
  }

  // The yard itself, packed snow, the two halves faintly tinted, a painted line down the middle and some footprints.
  function yardTexture(w, d) {
    const W = 1024, H = Math.round((1024 * d) / w);
    const [c, g] = G.makeCanvas(W, H);
    const r = rnd(11);
    g.fillStyle = '#f4f8ff';
    g.fillRect(0, 0, W, H);
    const tint = (x0, col) => {
      const gr = g.createLinearGradient(x0, 0, W / 2, 0);
      gr.addColorStop(0, col);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(Math.min(x0, W / 2), 0, W / 2, H);
    };
    tint(0, 'rgba(120,170,255,0.16)');
    tint(W, 'rgba(255,130,140,0.14)');
    for (let i = 0; i < 90; i++) {
      const x = r() * W, y = r() * H, rad = 20 + r() * 60;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, r() < 0.5 ? 'rgba(255,255,255,0.6)' : 'rgba(190,210,240,0.25)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // footprints wandering about
    g.fillStyle = 'rgba(150,175,215,0.32)';
    for (let k = 0; k < 9; k++) {
      let x = r() * W, y = r() * H, a = r() * PI * 2;
      for (let i = 0; i < 14; i++) {
        a += (r() - 0.5) * 0.5;
        x += Math.cos(a) * 16;
        y += Math.sin(a) * 16;
        const side = i % 2 ? 1 : -1;
        g.save();
        g.translate(x - Math.sin(a) * 5 * side, y + Math.cos(a) * 5 * side);
        g.rotate(a);
        g.beginPath();
        g.ellipse(0, 0, 6, 3.5, 0, 0, PI * 2);
        g.fill();
        g.restore();
      }
    }
    // the soft edge of the packed snow
    const e = 26;
    for (const [x, y, ww, hh, gx0, gy0, gx1, gy1] of [[0, 0, W, e, 0, 0, 0, e], [0, H - e, W, e, 0, H, 0, H - e], [0, 0, e, H, 0, 0, e, 0], [W - e, 0, e, H, W, 0, W - e, 0]]) {
      const gr = g.createLinearGradient(gx0, gy0, gx1, gy1);
      gr.addColorStop(0, 'rgba(238,245,255,1)');
      gr.addColorStop(1, 'rgba(238,245,255,0)');
      g.fillStyle = gr;
      g.fillRect(x, y, ww, hh);
    }
    // the line down the middle
    g.fillStyle = 'rgba(70,110,200,0.55)';
    for (let y = 8; y < H; y += 30) g.fillRect(W / 2 - 4, y, 8, 18);
    return G.toTexture(c);
  }

  function brickTexture() {
    const [c, g] = G.makeCanvas(128, 128);
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(1, '#dde9f8');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const r = rnd(3);
    for (let i = 0; i < 160; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(160,185,225,0.35)' : 'rgba(255,255,255,0.95)';
      g.fillRect(r() * 128, r() * 128, 2, 2);
    }
    g.strokeStyle = 'rgba(140,170,215,0.7)';
    g.lineWidth = 5;
    g.strokeRect(2, 2, 124, 124);
    g.strokeStyle = 'rgba(140,170,215,0.35)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(10, 40); g.quadraticCurveTo(64, 30, 118, 44); g.stroke();
    g.beginPath(); g.moveTo(20, 90); g.quadraticCurveTo(64, 98, 108, 86); g.stroke();
    return G.toTexture(c);
  }

  // ---------------------------------------------------------------- props

  function pine(x, z, s, parent) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    parent.add(g);
    G.mesh(new T.CylinderGeometry(0.16, 0.22, 0.9, 8), G.std('#6b4423'), 0, 0.45, 0, g);
    const green = G.std('#2f7d4f', { roughness: 0.9 }), snow = G.std('#f6faff', { roughness: 0.95 });
    [[1.25, 1.4, 0.8], [1.0, 1.25, 1.65], [0.72, 1.05, 2.4], [0.42, 0.8, 3.05]].forEach(([r, h, y]) => {
      G.mesh(new T.ConeGeometry(r, h, 9), green, 0, y, 0, g);
      G.mesh(new T.ConeGeometry(r * 0.62, h * 0.42, 9), snow, 0, y + h * 0.3, 0, g);
    });
    return g;
  }

  function decorSnowman(x, z, side, parent) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    g.rotation.y = side === 0 ? -0.6 : 0.6;
    parent.add(g);
    const snow = G.std('#f4f8ff', { roughness: 0.95 }), coal = G.std('#22232a');
    const body = new T.Group();
    g.add(body);
    G.mesh(new T.SphereGeometry(0.58, 18, 12), snow, 0, 0.5, 0, body);
    G.mesh(new T.SphereGeometry(0.42, 18, 12), snow, 0, 1.15, 0, body);
    G.mesh(new T.SphereGeometry(0.3, 16, 12), snow, 0, 1.62, 0, body);
    for (const xx of [-0.1, 0.1]) G.mesh(new T.SphereGeometry(0.045, 8, 6), coal, xx, 1.68, 0.26, body, false);
    for (const y of [1.3, 1.15, 1.0]) G.mesh(new T.SphereGeometry(0.045, 8, 6), coal, 0, y, 0.4, body, false);
    const nose = G.mesh(new T.ConeGeometry(0.055, 0.3, 10), G.std('#ff8a1f'), 0, 1.6, 0.42, body, false);
    nose.rotation.x = PI / 2;
    const scarf = G.mesh(new T.TorusGeometry(0.3, 0.075, 8, 20), G.std(SIDE[side].main), 0, 1.42, 0, body);
    scarf.rotation.x = PI / 2;
    const hat = G.std('#2b2a33');
    G.mesh(new T.CylinderGeometry(0.32, 0.32, 0.04, 18), hat, 0, 1.86, 0, body);
    G.mesh(new T.CylinderGeometry(0.2, 0.22, 0.32, 18), hat, 0, 2.02, 0, body);
    const stick = G.std('#6b4423');
    for (const sx of [-1, 1]) {
      const a = G.mesh(new T.CylinderGeometry(0.025, 0.035, 0.8, 6), stick, sx * 0.62, 1.32, 0, body);
      a.rotation.z = sx * -1.0;
    }
    return { g, body, wob: 0 };
  }

  function fence(parent) {
    const wood = G.std('#a8734a'), snow = G.std('#f6faff');
    const n = 48, z = -6.6;
    const pickets = new T.InstancedMesh(new T.BoxGeometry(0.22, 1.3, 0.08), wood, n);
    const caps = new T.InstancedMesh(new T.BoxGeometry(0.24, 0.1, 0.12), snow, n);
    const m4 = new T.Matrix4();
    for (let i = 0; i < n; i++) {
      const x = -16.5 + i * 0.7;
      m4.makeTranslation(x, 0.65, z);
      pickets.setMatrixAt(i, m4);
      m4.makeTranslation(x, 1.34, z);
      caps.setMatrixAt(i, m4);
    }
    pickets.castShadow = true;
    parent.add(pickets, caps);
    for (const y of [0.35, 0.95]) {
      G.mesh(new T.BoxGeometry(34, 0.12, 0.06), wood, 0, y, z - 0.08, parent);
      G.mesh(new T.BoxGeometry(34, 0.05, 0.1), snow, 0, y + 0.08, z - 0.08, parent, false);
    }
  }

  function house(parent) {
    const g = new T.Group();
    g.position.set(-3, 0, -13.5);
    parent.add(g);
    G.mesh(new T.BoxGeometry(14, 5, 5), G.std('#c8603f'), 0, 2.5, 0, g);
    const glow = new T.MeshBasicMaterial({ color: '#ffd67a' });
    const frame = G.std('#f6efe4');
    for (const [x, y] of [[-4.5, 3.3], [-1.5, 3.3], [3.5, 3.3], [-4.5, 1.3], [3.5, 1.3]]) {
      G.mesh(new T.BoxGeometry(1.5, 1.2, 0.1), frame, x, y, 2.52, g, false);
      G.mesh(new T.BoxGeometry(1.2, 0.95, 0.12), glow, x, y, 2.54, g, false);
      G.mesh(new T.BoxGeometry(0.08, 0.95, 0.14), frame, x, y, 2.56, g, false);
    }
    G.mesh(new T.BoxGeometry(1.3, 2.3, 0.12), G.std('#5b3a8c'), 0.6, 1.15, 2.53, g, false);
    // roof: two slabs, snow on top
    for (const s of [-1, 1]) {
      const r = G.mesh(new T.BoxGeometry(15, 0.3, 3.4), G.std('#5a4a5e'), 0, 6.0, s * 1.35, g);
      r.rotation.x = s * 0.62;
      const sn = G.mesh(new T.BoxGeometry(15.2, 0.22, 3.2), G.std('#f6faff'), 0, 6.2, s * 1.42, g, false);
      sn.rotation.x = s * 0.62;
    }
    G.mesh(new T.BoxGeometry(0.8, 1.6, 0.8), G.std('#8a4a36'), 4.5, 6.8, -0.5, g);
    G.mesh(new T.BoxGeometry(0.9, 0.2, 0.9), G.std('#f6faff'), 4.5, 7.65, -0.5, g, false);
    // a string of lights along the eaves
    const cols = ['#ff4b5c', '#ffd400', '#7dff5a', '#18d4ff', '#ff3d7f'];
    for (let i = 0; i < 22; i++) {
      const x = -6.8 + i * 0.65;
      G.mesh(new T.SphereGeometry(0.09, 8, 6), new T.MeshBasicMaterial({ color: cols[i % cols.length] }), x, 4.95 - Math.abs(Math.sin(i * 0.9)) * 0.12, 2.75, g, false);
    }
    return g;
  }

  // the low line down the middle: a snow ridge, little striped stakes and a sagging rope with flags
  function midLine(parent) {
    G.mesh(new T.BoxGeometry(0.34, 0.12, 9.6), G.std('#f6faff', { roughness: 0.95 }), 0, 0.06, 0, parent, false);
    const red = G.std('#e8433a'), white = G.std('#ffffff'), rope = G.std('#6b4423');
    const zs = [-4.8, -2.4, 0, 2.4, 4.8];
    for (const z of zs) {
      for (let i = 0; i < 4; i++) G.mesh(new T.CylinderGeometry(0.05, 0.05, 0.14, 8), i % 2 ? white : red, 0, 0.07 + i * 0.14, z, parent);
    }
    const cols = ['#3d8bff', '#ffd400', '#ff4b5c', '#7dff5a'];
    for (let k = 0; k < zs.length - 1; k++) {
      const z0 = zs[k], z1 = zs[k + 1];
      for (let i = 0; i < 12; i++) {
        const u = (i + 0.5) / 12, z = z0 + (z1 - z0) * u, y = 0.55 - Math.sin(u * PI) * 0.12;
        G.mesh(new T.BoxGeometry(0.03, 0.03, (z1 - z0) / 12 + 0.01), rope, 0, y, z, parent, false);
        if (i % 3 === 1) {
          const f = G.mesh(new T.ConeGeometry(0.08, 0.16, 3), G.std(cols[(k * 4 + i) % cols.length]), 0, y - 0.1, z, parent, false);
          f.rotation.x = PI;
        }
      }
    }
  }

  // ---------------------------------------------------------------- forts

  const BRICK = [[0, 0.42], [0.42, 0.36], [0.78, 0.34]]; // [bottom, height] of each brick
  function buildForts(segs, parent) {
    const tex = brickTexture();
    const mats = [0, 1, 2].map((i) => G.std(['#ffffff', '#f3f8ff', '#eaf2ff'][i], { map: tex, roughness: 0.92 }));
    const r = rnd(5);
    st.segs = segs.map((s) => {
      const bricks = BRICK.map(([y0, h], i) => {
        const b = G.mesh(new T.BoxGeometry(0.62, h, 0.6), mats[(s.i + i) % 3], s.x + (r() - 0.5) * 0.05, y0 + h / 2, s.zc, parent);
        b.rotation.y = (r() - 0.5) * 0.1;
        b.rotation.z = (r() - 0.5) * 0.05;
        b.receiveShadow = true;
        b.userData.y = y0 + h / 2;
        b.userData.pop = 1;
        return b;
      });
      return { s, bricks, lvl: 3 };
    });
    // a team flag on the outer end of every fort
    const pole = G.std('#6b4423');
    for (const f of [0, 1, 2, 3]) {
      const piece = segs.filter((s) => s.fort === f);
      const end = f % 2 === 0 ? piece[0] : piece[piece.length - 1];
      const zEnd = f % 2 === 0 ? end.z0 + 0.12 : end.z1 - 0.12;
      const side = end.side;
      G.mesh(new T.CylinderGeometry(0.03, 0.03, 1.7, 6), pole, end.x, 0.85, zEnd, parent);
      const [c, g] = G.makeCanvas(64, 40);
      g.fillStyle = SIDE[side].main;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 20); g.lineTo(0, 40); g.closePath(); g.fill();
      g.fillStyle = '#ffffff';
      g.font = `20px ${G.EMOJI_FONT}`;
      g.fillText('❄', 6, 28);
      const flag = new T.Mesh(new T.PlaneGeometry(0.6, 0.38), new T.MeshStandardMaterial({ map: G.toTexture(c), side: T.DoubleSide, transparent: true }));
      flag.position.set(end.x + (side === 0 ? -0.3 : 0.3), 1.5, zEnd);
      flag.rotation.y = side === 0 ? PI : 0;
      flag.userData.flag = true;
      parent.add(flag);
      st.flags = st.flags || [];
      st.flags.push(flag);
    }
  }

  // Show each fort piece's bricks for its level: lost bricks shrink away, rebuilt ones pop back in.
  function updateForts(dt) {
    for (const v of st.segs) {
      v.bricks.forEach((b, i) => {
        const want = v.s.lvl > i ? 1 : 0;
        const u = b.userData;
        u.pop += (want - u.pop) * Math.min(1, dt * (want ? 9 : 14));
        if (want && u.pop > 0.98) u.pop = 1;
        b.visible = u.pop > 0.04;
        const sc = want ? 0.6 + 0.4 * u.pop + Math.sin(u.pop * PI) * 0.18 : u.pop;
        b.scale.set(sc, sc, sc);
      });
    }
  }

  // ---------------------------------------------------------------- snowfall

  function snowfall(parent) {
    const n = 650;
    const pos = new Float32Array(n * 3);
    st.flakeV = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 36;
      pos[i * 3 + 1] = Math.random() * 16;
      pos[i * 3 + 2] = -14 + Math.random() * 26;
      st.flakeV[i * 2] = 0.6 + Math.random() * 0.8;
      st.flakeV[i * 2 + 1] = Math.random() * PI * 2;
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const mat = new T.PointsMaterial({ map: G.dotTexture(), size: 0.16, transparent: true, depthWrite: false, opacity: 0.9, color: '#ffffff' });
    st.flakes = new T.Points(geo, mat);
    st.flakes.frustumCulled = false;
    parent.add(st.flakes);
  }

  function updateSnow(dt) {
    const a = st.flakes.geometry.attributes.position;
    const p = a.array, v = st.flakeV;
    for (let i = 0; i < v.length / 2; i++) {
      p[i * 3 + 1] -= v[i * 2] * dt;
      p[i * 3] += Math.sin(st.time * 0.8 + v[i * 2 + 1]) * 0.25 * dt;
      if (p[i * 3 + 1] < 0) p[i * 3 + 1] += 16;
    }
    a.needsUpdate = true;
  }

  // ---------------------------------------------------------------- build / update

  function build(sc, segs, obst) {
    G = window.Kit.gfx;
    scene = sc;
    const root = new T.Group();
    scene.add(root);
    const ground = new T.Mesh(new T.PlaneGeometry(90, 60), G.std('#ffffff', { map: snowTexture(), roughness: 1 }));
    ground.rotation.x = -PI / 2;
    ground.receiveShadow = true;
    root.add(ground);
    const w = 21.8, d = 10.2;
    const yard = new T.Mesh(new T.PlaneGeometry(w, d), G.std('#ffffff', { map: yardTexture(w, d), roughness: 1, transparent: true }));
    yard.rotation.x = -PI / 2;
    yard.position.y = 0.01;
    yard.receiveShadow = true;
    root.add(yard);
    midLine(root);
    buildForts(segs, root);
    st.obst = obst.map((o) => {
      if (o.kind === 'snowman') return Object.assign(decorSnowman(o.x, o.z, o.side, root), { o });
      const g = pine(o.x, o.z, 0.72, root);
      return { g, body: g, wob: 0, o };
    });
    fence(root);
    house(root);
    // pines and drifts around the yard
    const r = rnd(21);
    for (let i = 0; i < 14; i++) pine(-17 + i * 2.6 + r() * 1.2, -8.2 - r() * 3, 0.9 + r() * 0.6, root);
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 4; i++) pine(sx * (14.6 + r() * 3), -6.5 + i * 1.8 + r(), 0.8 + r() * 0.5, root);
    }
    const drift = G.std('#f7fbff', { roughness: 1 });
    for (let i = 0; i < 26; i++) {
      const sx = r() < 0.5 ? -1 : 1;
      const m = G.mesh(new T.SphereGeometry(1, 14, 10), drift, sx * (11.8 + r() * 4), 0, -6 + r() * 13, root, false);
      m.scale.set(0.8 + r() * 1.6, 0.25 + r() * 0.35, 0.8 + r() * 1.2);
      m.receiveShadow = true;
    }
    for (let i = 0; i < 12; i++) {
      const m = G.mesh(new T.SphereGeometry(1, 14, 10), drift, -15 + i * 2.7, 0, -5.8 + r() * 0.4, root, false);
      m.scale.set(1.2 + r(), 0.3 + r() * 0.2, 0.6);
    }
    // a sled leaning on the fence
    const sled = new T.Group();
    sled.position.set(6.2, 0.75, -6.3);
    sled.rotation.x = -0.25;
    root.add(sled);
    G.mesh(new T.BoxGeometry(0.7, 1.5, 0.08), G.std('#e8433a'), 0, 0, 0, sled);
    for (const x of [-0.3, 0.3]) G.mesh(new T.BoxGeometry(0.05, 1.6, 0.1), G.std('#d9d9e3', { metalness: 0.6, roughness: 0.3 }), x, 0, 0.08, sled);
    snowfall(root);
    return root;
  }

  function wobble(obstId, strength = 1) {
    const v = st.obst.find((s) => s.o.id === obstId);
    if (v) v.wob = Math.min(1.5, v.wob + 0.6 * strength);
  }

  function update(dt) {
    st.time += dt;
    updateForts(dt);
    updateSnow(dt);
    for (const v of st.obst) {
      v.wob *= Math.exp(-3 * dt);
      v.body.rotation.z = Math.sin(st.time * 18) * 0.08 * v.wob;
    }
    if (st.flags) st.flags.forEach((f, i) => (f.rotation.x = Math.sin(st.time * 3 + i) * 0.12));
  }

  // Swap in a new match's fort pieces (the meshes stay; they follow the engine's segment objects).
  function bind(segs) {
    st.segs.forEach((v, i) => {
      v.s = segs[i];
      v.bricks.forEach((b, j) => {
        b.userData.pop = segs[i].lvl > j ? 1 : 0;
      });
    });
  }

  window.SBStage = { build, update, wobble, bind, SIDE };
})();
