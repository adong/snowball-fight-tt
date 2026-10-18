/* SnowbaTTle — poses on top of the kit's Kit.people.pose: the overhand throw, the underhand lob (and holding one),
   scooping snow, ducking behind a fort, the splat flinch, the brain-freeze wobble, the companion's shovelling, the
   winner's celebration and the loser's "aww". Also builds the Snow Crew's snowman with the same rig, so every pose
   works on him too.
   The kit's conventions: rotation.x swings a limb forward, rotation.z swings it out (negative for the left side),
   hips.rotation.x leans (negative = forward) and carries the legs with it. Kit candidates: throw, lob, scoop, duck,
   dizzy, shovel. */
(function () {
  'use strict';
  const T3 = THREE;
  const PI = Math.PI;
  const KIT = { run: 1, walk: 1, wave: 1, give: 1, peace: 1, guard: 1, jab: 1, straight: 1, boxing: 1, jumpshot: 1, jump: 1 };

  // Every channel this file drives, at rest.
  const base = () => ({
    ll: 0, rl: 0, llz: 0, rlz: 0, la: 0, ra: 0, laz: 0, raz: 0, lean: -0.08, twist: 0,
    head: 0, headZ: 0, bob: 0, rigY: 0.55, rigX: 0, rigZ: 0, fingers: false,
  });

  function drive(p, T, k) {
    const to = (o, prop, v) => { o[prop] += (v - o[prop]) * k; };
    to(p.legL.rotation, 'x', T.ll);
    to(p.legR.rotation, 'x', T.rl);
    to(p.legL.rotation, 'z', T.llz);
    to(p.legR.rotation, 'z', T.rlz);
    to(p.armL.rotation, 'x', T.la);
    to(p.armR.rotation, 'x', T.ra);
    to(p.armL.rotation, 'z', T.laz);
    to(p.armR.rotation, 'z', T.raz);
    to(p.hips.rotation, 'x', T.lean);
    to(p.hips.rotation, 'y', T.twist);
    to(p.head.rotation, 'x', T.head);
    to(p.head.rotation, 'z', T.headZ);
    to(p.hips.position, 'y', p.hipY + T.bob);
    to(p.rig.position, 'y', p.snowman ? Math.max(0.42, T.rigY) : T.rigY);
    to(p.rig.rotation, 'x', T.rigX);
    to(p.rig.rotation, 'z', T.rigZ);
    if (p.fingers) for (const f of p.fingers) f.visible = T.fingers;
  }

  // A kit pose, plus easing the channels the kit doesn't touch back to rest.
  function kit(p, ph, mode, k, extra) {
    window.Kit.people.pose(p, ph, mode, k);
    const T = Object.assign(base(), extra);
    const to = (o, prop, v) => { o[prop] += (v - o[prop]) * k; };
    to(p.legL.rotation, 'z', T.llz);
    to(p.legR.rotation, 'z', T.rlz);
    to(p.head.rotation, 'z', T.headZ);
    to(p.rig.position, 'y', T.rigY);
    to(p.rig.rotation, 'x', T.rigX);
    to(p.rig.rotation, 'z', T.rigZ);
  }

  // Squat with the legs split; the leg angles allow for the lean, since the hips carry the legs.
  function crouch(T, lean, low) {
    Object.assign(T, { rigY: low ? 0.12 : 0.2, lean, ll: 1.0 - lean, rl: -0.85 - lean, llz: -0.22, rlz: 0.22 });
  }

  // pose(p, mode, time, k, o): o.t = time in this pose (for throws), o.ph = running phase for strides.
  function apply(p, mode, time, k, o = {}) {
    const T = base();
    const t = o.t || 0;
    if (KIT[mode]) {
      kit(p, o.ph !== undefined ? o.ph : time * 9, mode, k, o.extra);
      return;
    }
    switch (mode) {
      case 'ready': {
        // holding a snowball up by the shoulder, waiting
        const br = Math.sin(time * 2.4);
        Object.assign(T, { ll: 0.15, rl: -0.1, la: 0.35, ra: 2.3, laz: -0.15, raz: -0.55, lean: -0.1, bob: br * 0.015, head: 0.05 });
        break;
      }
      case 'stand':
        Object.assign(T, { la: 0.12 + Math.sin(time * 2) * 0.04, ra: 0.12 - Math.sin(time * 2) * 0.04, laz: -0.08, raz: 0.08 });
        break;
      case 'throw': {
        // overhand: the arm cocks back over the head, then whips forward and down; the other arm points at the target
        const w = t < 0.1 ? 3.7 : t < 0.2 ? 3.7 - ((t - 0.1) / 0.1) * 2.9 : 0.8;
        Object.assign(T, { ll: 0.45, rl: -0.35, ra: w, raz: -0.15, la: 1.35, laz: -0.1, lean: t < 0.1 ? 0.12 : -0.3, twist: t < 0.1 ? 0.35 : -0.35, head: -0.05 });
        k = Math.max(k, 0.6);
        break;
      }
      case 'lob': {
        // underhand: the arm swings back low, then up and forward
        const w = t < 0.1 ? -1.0 : t < 0.22 ? -1.0 + ((t - 0.1) / 0.12) * 3.4 : 2.4;
        Object.assign(T, { ll: 0.35, rl: -0.3, ra: w, raz: -0.1, la: 0.6, laz: -0.3, lean: t < 0.1 ? -0.25 : 0.1, head: -0.25 });
        k = Math.max(k, 0.6);
        break;
      }
      case 'charge':
        // holding a lob: crouched a little, the ball swung back low, the other arm aiming high
        Object.assign(T, { ll: 0.5, rl: -0.4, ra: -1.0 + Math.sin(time * 6) * 0.08, raz: -0.12, la: 2.0, laz: -0.25, lean: -0.2, head: -0.3, rigY: 0.47 });
        break;
      case 'scoop': {
        // down in the snow, patting a snowball together with both hands
        crouch(T, -0.55);
        const s = Math.sin(time * 10);
        Object.assign(T, { la: 0.9 + s * 0.25, ra: 0.9 - s * 0.25, laz: 0.32, raz: -0.32, head: 0.35 });
        break;
      }
      case 'duck':
        // low behind the fort, hugging the knees, peeking over now and then
        crouch(T, -0.35, true);
        Object.assign(T, { la: 1.2, ra: 1.2, laz: 0.4, raz: -0.4, head: Math.sin(time * 1.3) > 0.6 ? -0.25 : 0.25 });
        break;
      case 'hit':
        // a splat: rock back, arms flung up, head shaking the snow off
        Object.assign(T, { ll: -0.2, rl: 0.35, la: 2.6, ra: 2.3, laz: -0.55, raz: 0.6, lean: 0.35, head: 0.4, headZ: Math.sin(time * 30) * 0.25, rigX: 0.08 });
        k = Math.max(k, 0.5);
        break;
      case 'dizzy': {
        // brain freeze: a slow wobble, arms out like a tightrope walker, head rolling
        const s = Math.sin(time * 3.2), c = Math.cos(time * 2.1);
        Object.assign(T, {
          ll: 0.1 + s * 0.15, rl: -0.1 - s * 0.15, llz: -0.12, rlz: 0.12, la: 0.3 + c * 0.3, ra: 0.3 - c * 0.3, laz: -1.2 - s * 0.2, raz: 1.2 - s * 0.2,
          lean: 0.05, head: 0.15 + c * 0.15, headZ: s * 0.4, twist: c * 0.3, rigZ: s * 0.12, rigX: c * 0.05,
        });
        break;
      }
      case 'shovel': {
        // the companion rebuilding a fort: scoop, lift, pat it on top
        const s = Math.sin(time * 7);
        crouch(T, -0.4);
        Object.assign(T, { rigY: 0.32, la: 1.3 + s * 0.6, ra: 1.3 + s * 0.6, laz: 0.15, raz: -0.15, head: 0.2 });
        break;
      }
      case 'cheer': {
        const hop = Math.max(0, Math.sin(time * 7));
        Object.assign(T, { la: 2.9, ra: 2.9, laz: -0.4 - hop * 0.3, raz: 0.4 + hop * 0.3, ll: hop * 0.4, rl: -hop * 0.2, rigY: 0.55 + hop * 0.25, head: -0.2 });
        break;
      }
      case 'aww':
        // lost the round: slumped, head down, kicking the snow
        Object.assign(T, { la: 0.05, ra: 0.05, laz: -0.05, raz: 0.05, lean: -0.3, head: 0.5, ll: Math.max(0, Math.sin(time * 2.5)) * 0.5, rigY: 0.52 });
        break;
      default:
        break;
    }
    drive(p, T, k);
  }

  // The Snow Crew's snowman, on the same rig as a kit person (arms, hips, head), so every pose above works.
  // Legs are empty groups; he hops instead of walking.
  function snowman(o = {}) {
    const { std, mesh } = window.Kit.gfx;
    const snow = std('#f4f8ff', { roughness: 0.95 });
    const coal = std('#22232a', { roughness: 0.6 });
    const scarfM = std(o.scarf || '#e8433a');
    const root = new T3.Group();
    const rig = new T3.Group();
    rig.position.y = 0.55;
    root.add(rig);
    const hipY = 0.33;
    const hips = new T3.Group();
    hips.position.y = hipY;
    rig.add(hips);
    mesh(new T3.SphereGeometry(0.56, 20, 14), snow, 0, -0.33, 0, hips);
    mesh(new T3.SphereGeometry(0.42, 18, 12), snow, 0, 0.36, 0, hips);
    for (const y of [0.5, 0.33, 0.16]) mesh(new T3.SphereGeometry(0.045, 8, 6), coal, 0, y, -0.4, hips, false);
    const scarf = mesh(new T3.TorusGeometry(0.3, 0.08, 8, 20), scarfM, 0, 0.72, 0, hips);
    scarf.rotation.x = PI / 2;
    mesh(new T3.BoxGeometry(0.14, 0.34, 0.05), scarfM, 0.16, 0.56, -0.28, hips).rotation.z = 0.2;
    const head = new T3.Group();
    head.position.y = 0.93;
    hips.add(head);
    mesh(new T3.SphereGeometry(0.3, 18, 12), snow, 0, 0, 0, head);
    for (const x of [-0.11, 0.11]) mesh(new T3.SphereGeometry(0.045, 8, 6), coal, x, 0.07, -0.26, head, false);
    for (let i = 0; i < 5; i++) {
      const a = -0.6 + i * 0.3;
      mesh(new T3.SphereGeometry(0.025, 6, 4), coal, Math.sin(a) * 0.14, -0.1 - Math.cos(a) * 0.04 + 0.04, -0.27, head, false);
    }
    const nose = mesh(new T3.ConeGeometry(0.06, 0.32, 10), std('#ff8a1f'), 0, 0.0, -0.42, head, false);
    nose.rotation.x = -PI / 2;
    const hatM = std(o.hat || '#2b2a33');
    mesh(new T3.CylinderGeometry(0.34, 0.34, 0.04, 20), hatM, 0, 0.24, 0, head);
    mesh(new T3.CylinderGeometry(0.22, 0.24, 0.34, 20), hatM, 0, 0.42, 0, head);
    mesh(new T3.CylinderGeometry(0.245, 0.245, 0.07, 20), scarfM, 0, 0.3, 0, head);
    // stick arms with mittens, angled out from the shoulder so they look like twigs even at rest
    const stick = std('#6b4423');
    const arm = (side) => {
      const g = new T3.Group();
      g.position.set(side * 0.38, 0.5, 0);
      hips.add(g);
      const inner = new T3.Group();
      inner.rotation.z = side * 0.55;
      g.add(inner);
      mesh(new T3.CylinderGeometry(0.03, 0.04, 0.72, 6), stick, 0, -0.36, 0, inner);
      const twig = mesh(new T3.CylinderGeometry(0.018, 0.022, 0.22, 5), stick, side * 0.05, -0.5, 0, inner);
      twig.rotation.z = -side * 0.8;
      g.mitten = mesh(new T3.SphereGeometry(0.09, 10, 8), scarfM, 0, -0.72, 0, inner);
      return g;
    };
    const armL = arm(-1), armR = arm(1);
    const legL = new T3.Group(), legR = new T3.Group();
    hips.add(legL, legR);
    return { root, rig, hips, head, armL, armR, legL, legR, hipY, fingers: [], snowman: true, hands: [armL.mitten, armR.mitten] };
  }

  window.SBPoses = { apply, drive, base, snowman };
})();
