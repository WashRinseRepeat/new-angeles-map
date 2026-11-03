// Landmarks from the Tour Guide and Akeidito finds. See design/pdf-finds/.
// Downtown Rutherford and Akeidito, south of Broadcast Square.

export const kits = () => ({});

export function landmarks(H) {
  const { GLOWS, PROPS, SKINS, FACES, beacon, beam, bld, glow, holo, pool, prop, puff, put, textSign, flickerGlow } = H;

  const RED = [2, .1, .06], AMBER = [1.5, .9, .35], WARM = [1.2, .75, .4], CYAN = [.25, 1.1, 1.5];
  const dim = (c, k) => c.map(v => v * k);

  // A frame that turns local +v toward the block's street front.
  //   P(u, v)        local point for a front-relative spot
  //   box/gl         prop and glow boxes, sizes given in front-relative u, v
  //   b              a building, sizes given in front-relative u, v
  //   face           FACES index of the front, for holo
  //   dims           front-relative sizes as local [w, d]
//   fwd            the front as local [x, z], for the card camera's face

  const front = (w, d) => {
    const f = H.frame()?.front ?? { x: 0, z: 1 }, fx = f.x, fz = f.z, ry = Math.atan2(fx, fz);
    const P = (u, v) => [u * fz + v * fx, -u * fx + v * fz];
    return {
      P, ry, fwd: [fx, fz], U: fx ? d : w, V: fx ? w : d,
      face: FACES.findIndex(n => n[0] === fx && n[1] === fz),
      dims: (su, sv) => fx ? [sv, su] : [su, sv],
      box: (u, y, v, su, sy, sv, rgb, kind = 'box') => { const [x, z] = P(u, v); return prop(kind, x, y, z, su, sy, sv, rgb, ry); },
      gl: (u, y, v, su, sy, sv, rgb) => { const [x, z] = P(u, v); return glow(x, y, z, su, sy, sv, rgb, ry); },
      b: (u, v, su, sv, h, st, r, o) => { const [x, z] = P(u, v); bld(x, z, fx ? sv : su, fx ? su : sv, h, st, r, o); },
      text: (s, u, y, v, tw, th, rgb, back = false) => { const [x, z] = P(u, v); textSign(s, x, y, z, tw, th, ry + (back ? Math.PI : 0), rgb); },
    };
  };

  // A spinning part: instanced boxes or spheres in their own mesh at a pivot, so update() only turns the mesh.
  // Shared instances are frozen into tiles after the build, so anything that moves lives here.

  const _o = new H.THREE.Object3D(), _c = new H.THREE.Color();
  const spinner = (src, x, y, z, parts) => {
    const m = new H.THREE.InstancedMesh(src.geometry, src.material, parts.length);
    parts.forEach(([px, py, pz, sx, sy, sz, rgb], i) => {
      _o.position.set(px, py, pz); _o.scale.set(sx, sy, sz); _o.updateMatrix();
      m.setMatrixAt(i, _o.matrix); m.setColorAt(i, _c.setRGB(...rgb));
    });
    m.position.set(x, y, z); m.userData.noTile = true; m.frustumCulled = false;
    H.decor.add(m);
    return m;
  };

  // A radar panel: a curved slab 36 m wide and 16 m high, tilted 20° up on a yoke. Its face is a steel frame
  // with notched corners round an amber grid. A canvas draws the face, and its clear margin cuts the outline.

  const radarFace = () => {
    const W = 512, Hh = 228, c = 30, [cv, glowCv, silCv] = [0, 0, 0].map(() => document.createElement('canvas'));
    for (const t of [cv, glowCv, silCv]) { t.width = W; t.height = Hh; }
    const outline = (g, i) => {
      const n = W * .38, m = W * .62, k = Hh * .12;
      g.beginPath();
      for (const [px, py] of [[c, 0], [W - c, 0], [W, c], [W, Hh - c], [W - c, Hh], [m + i, Hh], [m - k + i, Hh - k], [n + k - i, Hh - k], [n - i, Hh], [c, Hh], [0, Hh - c], [0, c]])
        g.lineTo(px + Math.sign(W / 2 - px) * i, py + Math.sign(Hh / 2 - py) * i);
      g.closePath();
    };
    const g = cv.getContext('2d'), e = glowCv.getContext('2d');
    const sil = silCv.getContext('2d');
    outline(sil, 0); sil.fillStyle = '#fff'; sil.fill();
    outline(g, 0); g.fillStyle = '#7d8796'; g.fill();
    outline(g, 16); g.fillStyle = '#2a2116'; g.fill();
    e.fillStyle = '#000'; e.fillRect(0, 0, W, Hh);
    for (const ctx of [g, e]) {
      ctx.save(); outline(ctx, 16); ctx.clip();
      ctx.strokeStyle = ctx === g ? '#b98a4a' : '#5a3a14'; ctx.lineWidth = 2;
      for (let v = 0; v < W; v += 12) { ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, Hh); ctx.stroke(); }
      for (let v = 0; v < Hh; v += 12) { ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(W, v); ctx.stroke(); }
      ctx.restore();
    }
    const tex = t => { const x = new H.THREE.CanvasTexture(t); x.colorSpace = H.THREE.SRGBColorSpace; x.anisotropy = 4; return x; };
    return [tex(cv), tex(glowCv), tex(silCv)];
  };

  const radar = (x, y, z) => {
    const { THREE } = H, g = new THREE.Group(), tilt = .35, R = 30, span = 36 / R, [map, glowMap, alphaMap] = radarFace();

    // A cylinder segment behind the pivot, so its concave inside faces forward.

    const panel = new THREE.CylinderGeometry(R, R, 16, 24, 1, true, Math.PI - span / 2, span).translate(0, 0, R - 2).rotateX(-tilt);
    const face = new THREE.MeshStandardMaterial({ map, emissiveMap: glowMap, emissive: 0xffffff, roughness: .6, metalness: .3, alphaTest: .5, transparent: false, side: THREE.BackSide });
    const back = new THREE.MeshStandardMaterial({ alphaMap, color: new THREE.Color(.55, .58, .62), roughness: .5, metalness: .3, alphaTest: .5, side: THREE.FrontSide });
    const steel = new THREE.MeshStandardMaterial({ color: new THREE.Color(.4, .43, .47), roughness: .5, metalness: .3 });
    const sensor = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 2.4).translate(0, -5.6, .6).rotateX(-tilt), steel);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.7, 8, 6).translate(0, -5, 1.9).rotateX(-tilt), new THREE.MeshBasicMaterial({ color: new THREE.Color(...dim(CYAN, .9)) }));
    g.add(new THREE.Mesh(panel, face), new THREE.Mesh(panel, back), sensor, eye,
      new THREE.Mesh(new THREE.BoxGeometry(5, 6, 5).translate(0, -3.5, -4), steel));
    g.position.set(x, y, z); g.userData.noTile = true;
    g.traverse(o => { o.frustumCulled = false; });
    H.decor.add(g);
    return g;
  };
  const RADAR = [], STROBES = [];

  return {

    // Rutherford Flight Control Tower: a lit needle with a wide disc cab, red strobes that climb the shaft,
    // and a turning radar dish on the cab roof.

    fd_tower: { at: [505, 565], label: 'Rutherford Flight Control Tower', labelY: 432, minSide: 36, reach: 450, build(x, z, w, d, st, r) {
      const T = front(w, d), s = Math.min(w, d);
      const steel = { ...st, base: [.08, .09, .1], win: [.6, .95, .9], lit: .35, grime: .15 };
      T.b(0, 0, s * .8, s * .8, 18, steel, r, { skin: SKINS.bands });
      T.text('FLIGHT CONTROL', 0, 13, s * .4 + .3, s * .6, s * .1, [.7, 1.3, 1.2]);
      T.gl(0, 3, s * .4 + .1, 8, 6, .2, [1, 1.1, 1]);

      // Shaft in two steps, then the cab at 360 m.

      bld(x, z, 18, 18, 200, steel, r, { y0: 18, shape: 'cyl', roof: false, skin: SKINS.bands });
      bld(x, z, 12, 12, 140, steel, r, { y0: 218, shape: 'cyl', roof: false, skin: SKINS.bands });
      prop('cone', x, 350, z, 44, 16, 44, [.07, .08, .09], 0, Math.PI);
      prop('cyl', x, 364, z, 62, 12, 62, [.08, .09, .1]);
      put(GLOWS.ring, x, 364, z, 62.6, 140, 62.6, 0, 0, [.75, 1.4, 1]);
      prop('cyl', x, 373, z, 54, 6, 54, [.07, .08, .09]);
      put(GLOWS.ring, x, 376.5, z, 54.4, 30, 54.4, 0, 0, dim(CYAN, .7));
      prop('cyl', x, 380, z, 34, 8, 34, [.06, .07, .08]);
      for (const [cx, cz] of FACES) beacon(x + cx * 31.5, 371, z + cz * 31.5, r);

      // Radar dish on a pedestal. It turns once every six seconds.

      prop('cyl', x, 388, z, 5, 8, 5, [.1, .11, .12]);
      RADAR.push(radar(x, 398, z));

      // Strobe rings up the shaft, one on each face.

      const rings = [];
      for (let y = 40; y < 350; y += 25) {
        const rad = y < 218 ? 10.4 : 7.4;
        for (const [fx, fz] of FACES) rings.push([fx * rad, y, fz * rad, 2.6, 2.6, 2.6, dim(RED, .03)]);
      }
      STROBES.push(spinner(GLOWS.sphere, x, 0, z, rings));
      pool(x, z, s * .7, [.1, .16, .16]);
      return { face: T.fwd };
    }, update(t) {
      for (const m of RADAR) m.rotation.y = t * 1.05;

      // A flash climbs the shaft one ring at a time, with a dim trail, then pauses before the next.

      for (const m of STROBES) {
        const n = m.count / 4, head = Math.floor((t * 7) % (n + 6)), c = m.instanceColor.array;
        for (let i = 0; i < m.count; i++) {
          const lv = i >> 2, k = lv === head ? 1.6 : lv === head - 1 ? .5 : lv === head - 2 ? .15 : .03;
          c[i * 3] = RED[0] * k; c[i * 3 + 1] = RED[1] * k; c[i * 3 + 2] = RED[2] * k;
        }
        m.instanceColor.needsUpdate = true;
      }
    } },

    // Humanity Labor Main Offices: a plain stone-grey slab with warm windows, a clasped-hands banner,
    // and a queue of job-seekers at the doors.

    fd_humanity: { at: [482, 588], label: 'Humanity Labor Main Offices', labelY: 192, minSide: 36, reach: 500, build(x, z, w, d, st, r) {
      const T = front(w, d), U = Math.min(T.U, 56), V = Math.min(T.V, 40);
      const stone = { ...st, base: [.15, .145, .135], win: [1, .78, .5], lit: .5, grime: .3 };
      T.b(0, 0, U, V, 24, stone, r, { roof: false, skin: SKINS.grid });
      T.b(0, -V * .1, U * .8, V * .7, 130, stone, r, { y0: 24, roof: false, skin: SKINS.grid });
      T.b(0, -V * .1, U * .6, V * .5, 24, stone, r, { y0: 154, skin: SKINS.sparse });
      for (const [cx, cz] of [[-1, -1], [1, 1]]) {
        const [px, pz] = T.P(cx * U * .3, -V * .1 + cz * V * .25);
        beacon(px, 179, pz, r);
      }

      // Banner screen: a warm frame, two clasped hands, and the name.

      const fv = -V * .1 + V * .35 + .3, bw = U * .6;
      T.gl(0, 120, fv, bw, 26, .2, [.12, .08, .05]);
      for (const y of [107, 133]) T.gl(0, y, fv + .1, bw, .6, .2, AMBER);
      for (const s of [-1, 1]) {
        T.gl(s * bw / 2, 120, fv + .1, .6, 26, .2, AMBER);
        T.gl(s * 3.2, 124, fv + .2, 7, 3.4, .2, [1.5, 1.15, .7]);
      }
      T.gl(0, 124, fv + .3, 3.4, 4.6, .2, [1.7, 1.3, .8]);
      T.text('HUMANITY LABOR', 0, 113, fv + .4, bw * .9, bw * .14, [1.5, 1.2, .8]);
      T.text('JOBS FOR PEOPLE', 0, 30, V / 2 + .3, U * .6, 3.6, [1.3, 1, .7]);

      // Doors and the queue.

      T.gl(0, 4, V / 2 + .1, 12, 8, .2, [1.3, 1, .7]);
      for (let k = 0; k < 22; k++) {
        const u = -7 - k * 1.4 + (r() - .5) * .4;
        T.box(u, .85, V / 2 + 3 + (r() - .5), .55, 1.7, .5, dim([.4, .3, .25], .6 + .6 * r()));
      }
      T.gl(-22, 2.6, V / 2 + 3.5, 30, .25, .25, dim(WARM, .6));
      pool(...T.P(-14, V / 2 + 4), 12, dim(WARM, .12));
      return { face: T.fwd };
    } },

    // Junction Gaming, Semyon's Arcade: a pagoda-tiered arcade tower with a giant honey-yellow bear head on the street front.
    // Players walk in through its open mouth under a chase-light marquee. The crown carries the Junction Gaming sign.

    fd_semyon: { at: [455, 535], label: "Junction Gaming: Semyon's Arcade", labelY: 66, minSide: 42, reach: 500, build(x, z, w, d, st, r) {
      const T = front(w, d), U = Math.min(T.U, 80), V = Math.min(T.V, 54), k = Math.min(1.6, V / 28, U / 24);
      const shell = { ...st, base: [.09, .06, .1], win: [.4, .6, 1.4], lit: .3 };
      const tier = { ...st, base: [.1, .06, .07], win: [1, .66, .32], lit: .34 };
      const EAVE = [.03, .025, .035], PINK = [1.9, .25, 1], HONEY = [.62, .39, .07];

      // The head sits on the tower face. Its mouth reaches the pavement.

      const hv = V / 2 + 4 - 12.1 * k, hy = 11 * k;

      // A flared dark eave with an amber edge and lit corner tips.

      const eave = (u0, v0, su, sv, y) => {
        T.box(u0, y + .5, v0, su + 4, 1, sv + 4, EAVE);
        T.gl(u0, y + .5, v0 + sv / 2 + 2.1, su + 4, .45, .25, dim(AMBER, .45));
        for (const cu of [-1, 1]) for (const cv of [-1, 1]) T.gl(u0 + cu * (su / 2 + 2.6), y + 1.4, v0 + cv * (sv / 2 + 2.6), .8, .8, .8, AMBER);
      };

      // Podium: a wide arcade hall with blue sensedep tank windows down both sides.

      const pu = U * .94, pv = V - 8, pc = -2, ph = 9;
      T.b(0, pc, pu, pv, ph, shell, r, { roof: false, skin: SKINS.sparse });
      for (const s of [-1, 1]) for (let j = 0; j < 7; j++) T.gl(s * (pu / 2 + .1), 4.5, pc - pv / 2 + 4 + j * (pv - 8) / 6, .2, 4, 2, [.2, .5, 1.5]);
      for (const s of [-1, 1]) T.gl(s * (pu * .36), 4.5, pc + pv / 2 + .1, pu * .18, 5, .2, dim(s < 0 ? PINK : CYAN, .5));
      eave(0, pc, pu, pv, ph);

      // Tower: four tiers that step in, amber windows, pink and cyan screens on the sides.

      let y = ph + 1, uu = pu * .72, vv = V * .62;
      const tc = hv - vv / 2 + 4;
      for (let j = 0; j < 4; j++) {
        const th = 12 - j;
        T.b(0, tc, uu, vv, th - 1, tier, r, { y0: y, roof: false, skin: j % 2 ? SKINS.bands : SKINS.grid });
        for (const s of [-1, 1]) T.gl(s * (uu / 2 + .2), y + th / 2, tc, .25, th - 3, vv * .6, dim((j + (s > 0)) % 2 ? PINK : CYAN, .7));
        y += th - 1;
        eave(0, tc, uu, vv, y);
        y += 1; uu *= .86; vv *= .86;
      }

      // Crown: a sign board with the Junction Gaming name, front and back, under a last small roof.

      const cw = pu * .9, cv = tc + vv / 2, cy = y + 6;
      T.box(0, cy, cv, cw, 11, 1.2, EAVE);
      T.text('JUNCTION GAMING', 0, cy, cv + .7, cw * .95, cw * .22, [1.8, .5, 1.3]);
      T.text('JUNCTION GAMING', 0, cy, cv - .7, cw * .95, cw * .22, [1.8, .5, 1.3], true);
      for (const s of [-1, 1]) T.gl(0, cy + s * 5.6, cv + .7, cw, .35, .25, PINK);
      T.b(0, tc, uu * .9, vv * .7, 5, { ...tier, lit: 0 }, r, { y0: y, shape: 'pyr', roof: false });

      // The head: skull, ears, muzzle, eyes, nose, mouth.

      const sph = (u, yy, v, s, rgb) => { const [px, pz] = T.P(u, v); put(GLOWS.sphere, px, yy, pz, s, s, s, 0, 0, rgb); };
      sph(0, hy, hv, 20 * k, HONEY);
      for (const s of [-1, 1]) { sph(s * 8 * k, hy + 8.5 * k, hv - k, 7 * k, HONEY); sph(s * 8 * k, hy + 8.5 * k, hv + .6 * k, 4.4 * k, [1.4, .7, .5]); }
      sph(0, hy - 3 * k, hv + 7.5 * k, 9 * k, [1.3, .95, .45]);
      for (const s of [-1, 1]) { sph(s * 3.8 * k, hy + 3 * k, hv + 8.6 * k, 2.6 * k, [.02, .02, .03]); sph(s * 3.6 * k, hy + 3.5 * k, hv + 9.6 * k, .8 * k, [2, 2, 2]); }
      sph(0, hy - k, hv + 11.8 * k, 2.6 * k, [.04, .02, .02]);
      T.box(0, 3.4 * k, hv + 10 * k, 7 * k, 6.6 * k, 4 * k, [.03, .02, .03]);
      T.gl(0, 3.2 * k, hv + 12.1 * k, 5.6 * k, 5.8 * k, .2, [1.7, 1.7, 1.8]);
      pool(...T.P(0, hv + 16 * k), 9 * k, [.3, .25, .1]);

      // Arched marquee in pink and yellow chase lights, with the name above it.

      for (let j = 0; j <= 20; j++) {
        const a = Math.PI * j / 20, rad = 14 * k;
        const [px, pz] = T.P(Math.cos(a) * rad, hv + 4 * k);
        flickerGlow(px, hy + 2 * k + Math.sin(a) * rad, pz, 1.2 * k, 1.2 * k, 1.2 * k, j % 2 ? [1.9, .3, 1] : [1.9, 1.5, .3], r);
      }
      T.text('JUNCTION GAMING', 0, hy + 19 * k, hv + 4 * k, 20 * k, 3.6 * k, [1.8, .5, 1.3]);
      T.text("SEMYON'S", 0, ph + 8, tc - vv / .86 / 2 - .2, uu * .9, 3.6, [1.8, 1.4, .4], true);
      return { face: T.fwd };
    } },

    // NAPD Akeidito Precinct: separate navy blocks for each unit, ringed round a glass lobby drum.
    // The jail shaft runs down from the drum through a lit pit into the undercity.

    fd_precinct: { at: [492, 535], label: 'NAPD Akeidito Precinct', labelY: 100, minSide: 50, reach: 500, build(x, z, w, d, st, r) {
      const T = front(w, d), S = Math.min(w, d, 92);
      const navy = { ...st, base: [.05, .07, .13], win: [.55, .75, 1], lit: .4, grime: .25 };
      const R0 = S * .36, bs = S * .22;
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3 + Math.PI / 6, h = 40 + ((k * 37) % 50) + r() * 6;
        const bx = x + Math.sin(a + T.ry) * R0, bz = z + Math.cos(a + T.ry) * R0;
        bld(bx, bz, bs, bs, h, navy, r, { skin: SKINS.bands });
        for (let s = -1; s <= 1; s += 2) flickerGlow(bx + s * bs * .25, h + .6, bz, bs * .4, .5, .5, s < 0 ? [1.8, .1, .1] : [.2, .4, 1.9], r);
        glow(bx, h - 2, bz, bs + .3, .6, bs + .3, [.25, .4, 1.2]);
      }

      // Lobby drum, bounty board, and the jail shaft going down.

      const dr = S * .16, pr = dr + 3;
      prop('cyl', x, .15, z, pr * 2, .3, pr * 2, [.008, .008, .012]);
      put(GLOWS.ring, x, .4, z, pr * 2, 40, pr * 2, 0, 0, [1.5, .9, .2]);
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4;
        glow(x + Math.sin(a) * (pr - 1), .45, z + Math.cos(a) * (pr - 1), .8, .1, .8, [1.1, .6, .2]);
      }
      put(PROPS.lattice, x + dr + 1.6, -10, z, 2.6, 36, 2.6);
      glow(x + dr + 1.6, 8.3, z, .6, .6, .6, [1.6, .9, .2]);
      bld(x, z, dr * 2, dr * 2, 10, { ...navy, win: [.85, .95, 1.2], lit: .9 }, r, { y0: 0, shape: 'cyl', roof: false, skin: SKINS.curtain });
      prop('cyl', x, 10.5, z, dr * 2 + 2, 1, dr * 2 + 2, [.05, .06, .1]);
      put(GLOWS.ring, x, 10, z, dr * 2 + 2.2, 30, dr * 2 + 2.2, 0, 0, [.3, .5, 1.6]);
      T.gl(0, 5, dr + .2, dr * .9, 4, .2, [1.8, 1.8, 1.7]);
      T.text('BOUNTIES', 0, 7.8, dr + .4, dr * .8, 1.6, [2, .35, .2]);
      T.text('NAPD AKEIDITO PRECINCT', 0, 13.5, dr + 1.2, dr * 2.2, 2.6, [.6, .8, 1.7]);
      pool(x, z, S * .6, [.08, .1, .2]);
      return { face: T.fwd };
    } },

    // Botanical Gardens: fused glass spheres on a deck, green inside, one bright under a blue holo sky.
    // White meridian ribs, a red Jinteki band where spheres meet.

    fd_gardens: { at: [446, 562], label: 'Botanical Gardens', labelY: 92, minSide: 60, reach: 550, build(x, z, w, d, st, r) {
      const T = front(w, d), U = Math.min(T.U, 96), V = Math.min(T.V, 96);
      T.box(0, 2, 0, U, 4, V, [.06, .065, .07]);
      T.gl(0, 4.1, V / 2 + .1, U * .9, .4, .2, dim(CYAN, .6));
      T.text('BOTANICAL GARDENS', 0, 2.2, V / 2 + .2, U * .5, 3, [.6, 1.5, .8]);
      const k = Math.min(U, V) / 96;
      const S = [[0, 0, 80, [.25, .55, 1.6]], [-30, 20, 52, [.05, .2, .09]], [28, 22, 46, [.06, .22, .1]], [-26, -28, 44, [.05, .18, .08]], [30, -26, 40, [.07, .24, .11]]];
      for (const [u, v, s0, rgb] of S) {
        const s = s0 * k, [px, pz] = T.P(u * k, v * k), y = 4 + s * .4;
        put(GLOWS.sphere, px, y, pz, s, s, s, 0, 0, rgb);
        for (let m = 0; m < 3; m++) put(GLOWS.ring, px, y, pz, s * 1.01, s * 1.01, s * 1.01, m * Math.PI / 3, Math.PI / 2, [.45, .55, .5]);
        put(GLOWS.ring, px, y, pz, s * 1.01, s * 1.01, s * 1.01, 0, 0, [.45, .55, .5]);
        put(GLOWS.ring, px, 4 + s * .12, pz, s * .9, s, s * .9, 0, 0, [1.4, .1, .1]);
        pool(px, pz, s * .7, rgb.map(c => c * .12));
      }

      // Dark tree masses round the deck edge.

      for (let n = 0; n < 14; n++) {
        const u = (r() - .5) * U * .95, v = (n % 2 ? 1 : -1) * (V / 2 - 3);
        const s = 4 + r() * 3;
        T.box(u, 4 + s * .6, v, s, s * 1.2, s, [.02, .06, .03], 'cone');
      }
      return { face: T.fwd };
    } },

    // Hivic Channel: a deep slot cut down through two plaza decks and open to the sky.
    // Three outfall pipes at its head pour condensate down the wall, rain sheets fill the slot,
    // an oily stream glows on the floor, and shacks with fungus beds line the banks and a ledge.

    fd_hivic: { at: [532, 582], label: 'Hivic Channel', labelY: 76, minSide: 46, reach: 550, build(x, z, w, d, st, r) {
      const ax = w >= d, L = Math.max(w, d), Wd = Math.min(w, d), slot = 18, half = slot / 2, deck = 44;
      const at = (l, c) => ax ? [x + l, z + c] : [x + c, z + l];
      const box = (l, y, c, sl, sy, sc, rgb, kind = 'box') => { const [px, pz] = at(l, c); prop(kind, px, y, pz, ax ? sl : sc, sy, ax ? sc : sl, rgb); };
      const gl = (l, y, c, sl, sy, sc, rgb) => { const [px, pz] = at(l, c); return glow(px, y, pz, ax ? sl : sc, sy, ax ? sc : sl, rgb); };
      const bank = (Wd - slot) / 2, l0 = -L / 2 + 10, run = L / 2 - l0, lm = (l0 + L / 2) / 2;
      const wall = { ...st, base: [.05, .055, .06], win: [1, .6, .3], lit: .2, grime: .85 };

      // Plaza decks on both banks, a lip and a cyan rail at the slot edge, and HVAC units on top.

      for (const s of [-1, 1]) {
        const [bx, bz] = at(lm, s * (half + bank / 2));
        bld(bx, bz, ax ? run : bank, ax ? bank : run, deck, wall, r, { roof: false, kibble: false, skin: SKINS.sparse });
        box(lm, deck + .4, s * (half + (bank - 1) / 2), run, .8, bank + 1, [.07, .075, .08]);
        gl(lm, deck + .9, s * (half - .8), run, .3, .3, CYAN);
        for (let l = l0 + 8; l < L / 2 - 4; l += 14 + r() * 6) {
          const c = s * (half + 4 + r() * (bank - 8));
          box(l, deck + 2.6, c, 5, 3.6, 4, [.1, .11, .11]);
          gl(l, deck + 4.5, c, 3, .2, 3, [.3, .45, .5]);
        }

        // Shacks on the floor bank and on a ledge halfway up, with lamps and pale fungus beds.

        box(lm, 13.5, s * (half - 1.6), run, .8, 3.2, [.06, .06, .065]);
        for (const [y0, c0] of [[.3, half - 2.6], [13.9, half - 1.6]]) for (let l = l0 + 2; l < L / 2 - 2; l += 3.5 + r() * 3) {
          const sw = 2.4 + r() * 2, sh = 2.2 + r() * 2.4;
          box(l, y0 + sh / 2, s * c0, sw, sh, 2.6, dim([.13, .1, .08], .6 + .6 * r()));
          if (r() < .55) gl(l, y0 + sh * .6, s * (c0 - 1.35), .8, .6, .1, [1.6, .7, .25]);
          if (r() < .35) gl(l + sw * .7, y0 + .25, s * (c0 - 1.6), 1.6, .25, .5, [.4, 1.2, 1]);
        }
      }

      // The stream in oily green and violet bands.

      box(lm, .25, 0, run, .3, slot - 12, [.02, .025, .03]);
      for (let l = l0; l < L / 2 - 3; l += 5) gl(l + 2.5, .45, (r() - .5) * 2, 4 + r() * 2, .1, 1 + r() * 2.5, r() < .5 ? [.15, .75, .5] : [.55, .2, .8]);

      // Outfall plant at the head. Three pipe mouths pour white water down to the stream.

      const [ox, oz] = at(-L / 2 + 5, 0);
      bld(ox, oz, ax ? 10 : Wd, ax ? Wd : 10, deck + 16, wall, r, { kibble: false, skin: SKINS.bands });
      for (const c of [-5, 0, 5]) {
        const y = deck * .55;
        box(l0 + 1.2, y, c, 2.4, 3.6, 3.6, [.08, .085, .09]);
        gl(l0 + 2.45, y, c, .1, 2.6, 2.6, [.6, .75, .8]);
        gl(l0 + 2.8, y / 2, c, .5, y, 2.8, [.5, .62, .68]);
        gl(l0 + 2.8, y / 2, c, .2, y, 1.2, [1.1, 1.3, 1.35]);
        for (let k = 0; k < 2; k++) { const [mx, mz] = at(l0 + 3 + r() * 3, c + (r() - .5) * 2); puff(mx, 1.5 + r() * 2, mz, 4 + r() * 2, [.2, .24, .26]); }
      }
      const [tx, tz] = at(l0 + .3, 0);
      textSign('HIVIC CHANNEL', tx, deck + 9, tz, Wd * .7, Wd * .1, ax ? Math.PI / 2 : 0, [.5, 1.4, 1.3]);

      // Rain sheets down the slot from just above the decks, and mist over the water.

      for (let l = l0 + 2; l < L / 2; l += 4 + r() * 2) gl(l, (deck + 10) / 2, (r() - .5) * (slot - 4), 3 + r() * 4, deck + 10, .08, [.1, .13, .16]);
      for (let k = 0; k < 8; k++) { const [mx, mz] = at(l0 + r() * run, 0); puff(mx, 5 + r() * 12, mz, 7 + r() * 4, [.13, .15, .17]); }

      // The camera looks up the slot from its open end toward the outfall.

      return { face: ax ? [1, 0] : [0, 1] };
    } },

    // Akeidito Community College: a temple hall held up on giant pillars over a ring of plazas,
    // pagoda tiers with amber eave lines, mirror light on the quad, and scaffold on one face.

    fd_college: { at: [474, 556], label: 'Akeidito Community College', labelY: 152, minSide: 56, reach: 550, build(x, z, w, d, st, r) {
      const T = front(w, d), U = Math.min(T.U, 90), V = Math.min(T.V, 90);
      const conc = [.14, .14, .15], hall = { ...st, base: [.11, .085, .07], win: [1, .78, .45], lit: .45, grime: .45 };
      T.box(0, .2, 0, U, .4, V, [.07, .07, .075]);

      // Pillars and plazas.

      const pu = U * .32, pv = V * .3;
      for (const [cu, cv] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]]) {
        const [px, pz] = T.P(cu * pu, cv * pv);
        prop('cyl', px, 20, pz, 7, 40, 7, conc);
        prop('cyl', px, 39, pz, 10, 2, 10, conc);
        pool(px, pz, 12, [.18, .18, .16]);
      }
      for (const [u, v] of [[-U * .38, 0], [U * .38, 0], [0, V * .42], [0, -V * .42]]) {
        const [px, pz] = T.P(u, v);
        pool(px, pz, 14, [.3, .3, .26]);
        for (let k = 0; k < 4; k++) T.box(u + (k - 1.5) * 4, .7, v + 2, 3, .6, 1, [.2, .17, .13]);
      }

      // Hall on the pillars, then three pagoda tiers with flared eaves.

      const hu = U * .82, hv = V * .76;
      T.b(0, 0, hu, hv, 34, hall, r, { y0: 40, roof: false, skin: SKINS.bands });
      let y = 74;
      for (const [f, h] of [[.82, 22], [.62, 20], [.42, 18]]) {
        const tu = hu * f, tv = hv * f, eu = tu + 9, ev = tv + 9;
        T.box(0, y + .6, 0, eu, 1.2, ev, [.06, .05, .045]);
        T.gl(0, y - .2, ev / 2 - .5, eu - 2, .4, .4, AMBER);
        T.gl(0, y - .2, -ev / 2 + .5, eu - 2, .4, .4, AMBER);
        T.gl(eu / 2 - .5, y - .2, 0, .4, .4, ev - 2, AMBER);
        T.gl(-eu / 2 + .5, y - .2, 0, .4, .4, ev - 2, AMBER);
        for (const [cu, cv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const a = T.P(cu * eu / 2, cv * ev / 2), b = T.P(cu * (eu / 2 + 3), cv * (ev / 2 + 3));
          beam([a[0], y + .6, a[1]], [b[0], y + 3.4, b[1]], .9, [.06, .05, .045]);
          glow(b[0], y + 3.6, b[1], .7, .7, .7, AMBER);
        }
        T.b(0, 0, tu, tv, h, hall, r, { y0: y + 1.2, roof: false, skin: SKINS.sparse });
        y += h + 1.2;
      }
      T.box(0, y + 4, 0, hu * .2, 8, hv * .2, [.06, .05, .045], 'cone');
      T.text('AKEIDITO COMMUNITY COLLEGE', 0, 46, hv / 2 + .3, hu * .7, 4, [1.5, 1.1, .6]);

      // Mirrors on the underside throw pale light on the quad.

      for (const [cu, cv] of [[-1, 0], [1, 0], [0, 0]]) {
        const [px, pz] = T.P(cu * pu * .5, cv);
        prop('dish', px, 39.6, pz, 8, 6, 8, [.5, .5, .55], 0, Math.PI);
        glow(px, 38.6, pz, 3, .3, 3, [1.3, 1.3, 1.2]);
      }

      // Scaffold patch on one side face.

      const sv0 = -hv * .2, su = hu / 2 + 2;
      for (let k = 0; k < 4; k++) {
        const [a0, a1] = T.P(su, sv0 + (k - 1.5) * 6);
        prop('box', a0, 57, a1, .5, 34, .5, [.25, .2, .1]);
      }
      for (let k = 0; k < 5; k++) T.box(su, 42 + k * 7, sv0, .4, .4, 20, [.25, .2, .1]);
      T.gl(su + .4, 60, sv0, .2, .5, .5, [1.6, .9, .2]);
      holo(x, z, ...T.dims(hu, hv), 60, r, T.face ^ 1, 14);
      return { face: T.fwd };
    } },
  };
}
