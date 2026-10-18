/* SnowbaTTle — effects: snow puffs, flying fort chunks, comic word bursts (SPLAT!, POOF!), splats left on the
   ground, shockwave rings, emoji that float or fly (treats, power-ups), and confetti for the winner.
   Textures are painted once on canvases; sprites are recycled. */
(function () {
  'use strict';
  const T = THREE;
  let scene, G;
  const live = [];
  const pool = [];
  const decals = [];
  const burstCache = {};

  // Burst colours per word: [outer, inner, text]
  const STYLE = {
    'SPLAT!': ['#ffffff', '#bfe3ff', '#1f6fe0'], 'BIG SPLAT!': ['#ffd400', '#ffffff', '#1f4fe0'], 'POOF!': ['#ffffff', '#fff2a8', '#ff3d7f'],
    'BOINK!': ['#c8e6ff', '#ffffff', '#7a8ca8'], 'SAVED!': ['#7dff5a', '#ffffff', '#1f7a2a'], 'FSSS!': ['#ffb36b', '#fff0d8', '#a0461a'],
    'BRRR!': ['#9fdcff', '#ffffff', '#1f4fe0'], 'WHUMP!': ['#ffd400', '#ff8a1f', '#ffffff'], 'PEACE!': ['#ff9fd0', '#fff2a8', '#b02a8a'],
    'SWISH!': ['#ff8a1f', '#ffd400', '#ffffff'], 'BOP!': ['#ffe14d', '#ffffff', '#1f6fe0'], 'THUD!': ['#c58a4a', '#ffd9a0', '#ffffff'],
  };

  function burstTexture(word) {
    if (burstCache[word]) return burstCache[word];
    const [c, g] = G.makeCanvas(256, 256);
    const [outer, inner, text] = STYLE[word] || STYLE['SPLAT!'];
    const star = (r1, r2, n, fill) => {
      g.beginPath();
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 ? r2 * (0.85 + ((i * 37) % 7) / 30) : r1 * (0.88 + ((i * 53) % 5) / 25);
        g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
      }
      g.closePath();
      g.fillStyle = fill;
      g.fill();
    };
    g.lineJoin = 'round';
    star(124, 72, 12, '#14121f');
    star(114, 64, 12, outer);
    star(86, 54, 10, inner);
    g.translate(128, 132);
    g.rotate(-0.12);
    const size = word.length > 7 ? 36 : word.length > 5 ? 46 : 56;
    g.font = `${size}px ${G.FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 10;
    g.strokeStyle = '#14121f';
    g.strokeText(word, 0, 0);
    g.fillStyle = text;
    g.fillText(word, 0, 0);
    return (burstCache[word] = G.toTexture(c));
  }

  function sprite(tex, size, x, y, z, o = {}) {
    let s = pool.pop();
    if (!s) {
      s = new T.Sprite(new T.SpriteMaterial({ transparent: true, depthWrite: false }));
    }
    const m = s.material;
    m.map = tex;
    m.color.set(o.color || '#ffffff');
    m.opacity = 1;
    m.rotation = o.rot || 0;
    m.depthTest = !o.onTop;
    m.blending = o.add ? T.AdditiveBlending : T.NormalBlending;
    m.needsUpdate = true;
    s.scale.set(size, size, 1);
    s.position.set(x, y, z);
    s.renderOrder = o.onTop ? 20 : 4;
    s.visible = true;
    scene.add(s);
    return s;
  }

  function add(obj, fx) {
    live.push(Object.assign({ obj, t: 0, life: 0.6, vx: 0, vy: 0, vz: 0, g: 0, spin: 0, size: obj.scale.x, kind: 'puff' }, fx));
  }

  // ---------------------------------------------------------------- one-shots

  // A puff of snow: n soft white dots flying out and fading.
  function puff(x, y, z, o = {}) {
    const n = o.n || 10, sp = o.speed || 3, size = o.size || 0.32;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, r = Math.sqrt(1 - u * u);
      const v = sp * (0.4 + Math.random() * 0.8);
      const s = sprite(G.dotTexture(), size * (0.6 + Math.random() * 0.8), x, y, z, { color: o.color });
      add(s, { vx: Math.cos(a) * r * v, vy: Math.abs(u) * v * (o.up || 1) + (o.lift || 1), vz: Math.sin(a) * r * v, g: 6, life: (o.life || 0.6) * (0.7 + Math.random() * 0.6), grow: 1.6 });
    }
  }

  // Chunks of snow brick flying off a fort.
  const chunkGeo = () => (chunkGeo.g = chunkGeo.g || new T.BoxGeometry(0.14, 0.12, 0.14));
  const chunkMat = () => (chunkMat.m = chunkMat.m || G.std('#f4f8ff', { roughness: 0.95 }));
  function chunks(x, y, z, n = 6, dir = 0) {
    for (let i = 0; i < n; i++) {
      const m = new T.Mesh(chunkGeo(), chunkMat());
      m.position.set(x, y, z);
      m.scale.setScalar(0.6 + Math.random() * 0.9);
      m.castShadow = true;
      scene.add(m);
      add(m, {
        kind: 'chunk', vx: dir * (1 + Math.random() * 2.5) + (Math.random() - 0.5) * 2, vy: 2.5 + Math.random() * 3, vz: (Math.random() - 0.5) * 3,
        g: 14, life: 0.9 + Math.random() * 0.4, spin: (Math.random() - 0.5) * 14,
      });
    }
  }

  function word(x, y, z, text, big) {
    const s = sprite(burstTexture(text), 0.1, x, y, z, { onTop: true, rot: (Math.random() - 0.5) * 0.4 });
    add(s, { kind: 'burst', life: big ? 0.85 : 0.6, size: big ? 3.0 : 2.1, vy: 0.6 });
  }

  // An emoji sprite: floats up and fades, or flies along an arc to `o.to` (a function giving the target position).
  function emoji(ch, x, y, z, o = {}) {
    const s = sprite(G.emojiTexture(ch), o.size || 0.9, x, y, z, { onTop: true });
    add(s, { kind: o.to ? 'fly' : 'float', life: o.life || 1.2, vy: o.vy !== undefined ? o.vy : 0.9, from: { x, y, z }, to: o.to, size: o.size || 0.9, pop: true });
    return s;
  }

  // A white splat left on the snow (or a fort), fading out over a few seconds.
  const decalTex = () => (decalTex.t = decalTex.t || makeDecal());
  function makeDecal() {
    const [c, g] = G.makeCanvas(128, 128);
    g.fillStyle = '#ffffff';
    g.beginPath();
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2, r = 38 + ((i * 41) % 13) + (i % 3 === 0 ? 14 : 0);
      g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9;
      g.beginPath();
      g.arc(64 + Math.cos(a) * 56, 64 + Math.sin(a) * 56, 5 + (i % 3) * 2, 0, Math.PI * 2);
      g.fill();
    }
    return G.toTexture(c);
  }
  function decal(x, z, size = 0.8) {
    const m = new T.Mesh(new T.PlaneGeometry(size, size), new T.MeshBasicMaterial({ map: decalTex(), transparent: true, depthWrite: false, color: '#ffffff', opacity: 0.95 }));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.random() * Math.PI * 2;
    m.position.set(x, 0.02 + decals.length * 0.0004, z);
    scene.add(m);
    decals.push({ m, t: 0 });
    if (decals.length > 40) {
      const d = decals.shift();
      scene.remove(d.m);
      d.m.geometry.dispose();
      d.m.material.dispose();
    }
  }

  // A ring on the ground spreading out (slam dunks, power-up drops).
  function ring(x, z, color = '#ffffff', size = 3) {
    const m = new T.Mesh(new T.RingGeometry(0.7, 1, 32), new T.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: T.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.04, z);
    m.scale.setScalar(0.2);
    scene.add(m);
    add(m, { kind: 'ring', life: 0.6, size });
  }

  const CONFETTI = ['#ffd400', '#ff3d7f', '#18d4ff', '#7dff5a', '#ff8a1f', '#ffffff'];
  function confetti(x, y, z, n = 40) {
    for (let i = 0; i < n; i++) {
      const s = sprite(G.dotTexture(), 0.22, x + (Math.random() - 0.5) * 3, y + Math.random() * 2, z + (Math.random() - 0.5) * 2, { color: CONFETTI[i % CONFETTI.length] });
      add(s, { kind: 'confetti', vx: (Math.random() - 0.5) * 3, vy: 3 + Math.random() * 4, vz: (Math.random() - 0.5) * 3, g: 5, life: 1.6 + Math.random() });
    }
  }

  // ---------------------------------------------------------------- update

  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const f = live[i];
      f.t += dt;
      const u = f.t / f.life, o = f.obj;
      if (u >= 1) {
        live.splice(i, 1);
        scene.remove(o);
        if (o.isSprite) pool.push(o);
        else if (f.kind === 'ring') { o.geometry.dispose(); o.material.dispose(); }
        continue;
      }
      if (f.kind === 'fly' && f.to) {
        const to = f.to();
        const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        o.position.set(f.from.x + (to.x - f.from.x) * e, f.from.y + (to.y - f.from.y) * e + Math.sin(u * Math.PI) * 1.4, f.from.z + (to.z - f.from.z) * e);
        o.scale.setScalar(f.size * (1 + Math.sin(u * Math.PI) * 0.4));
        continue;
      }
      f.vy -= f.g * dt;
      o.position.x += f.vx * dt;
      o.position.y += f.vy * dt;
      o.position.z += f.vz * dt;
      if (f.kind === 'chunk') {
        if (o.position.y < 0.06) {
          o.position.y = 0.06;
          f.vy *= -0.3;
          f.vx *= 0.6;
          f.vz *= 0.6;
        }
        o.rotation.x += f.spin * dt;
        o.rotation.z += f.spin * 0.7 * dt;
        o.scale.setScalar(Math.max(0.01, o.scale.x * (u > 0.7 ? 0.92 : 1)));
      } else if (f.kind === 'burst') {
        const k = u < 0.2 ? u / 0.2 : 1;
        o.scale.setScalar(f.size * (k < 1 ? k * 1.15 : 1.15 - (u - 0.2) * 0.2));
        o.material.opacity = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
      } else if (f.kind === 'ring') {
        o.scale.setScalar(0.2 + u * f.size);
        o.material.opacity = 1 - u;
      } else if (o.isSprite) {
        if (f.grow) o.scale.setScalar(f.size * (1 + u * (f.grow - 1)));
        if (f.pop) o.scale.setScalar(f.size * (u < 0.15 ? u / 0.15 : 1));
        o.material.opacity = u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1;
      }
    }
    for (const d of decals) {
      d.t += dt;
      d.m.material.opacity = Math.max(0, 0.95 - Math.max(0, d.t - 4) * 0.3);
    }
  }

  function clear() {
    for (const f of live) {
      scene.remove(f.obj);
      if (f.obj.isSprite) pool.push(f.obj);
    }
    live.length = 0;
    for (const d of decals) scene.remove(d.m);
    decals.length = 0;
  }

  function init(sc) {
    scene = sc;
    G = window.Kit.gfx;
  }

  window.SBFx = { init, update, clear, puff, chunks, word, emoji, decal, ring, confetti, burstTexture };
})();
