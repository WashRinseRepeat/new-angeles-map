// Landmarks from the Tour Guide and Akeidito finds. See design/pdf-finds/.
// Nihongai, Laguna Velasco, Manta and Esmeraldas finds (TG 10-14, 16, 23).

const dim = (rgb, k) => rgb.map(c => c * k);

const ACID = [.7, 2, .25], MAG = [2, .2, 1.4], CYAN = [.25, 1.4, 1.8], AMBER = [1.8, 1.2, .3];
const COOL = [1.1, 1.2, 1.3], WARM = [1.5, .95, .5], RED = [1.8, .1, .08], GOLD = [1.6, 1.15, .4];
const ORANGE = [2, .75, .18], TEAL = [.2, 1.5, 1.3], YELLOW = [1.8, 1.4, .15];
const LEAF = [.03, .08, .04], DARK = [.04, .04, .045], ASPHALT = [.045, .045, .05];

export const kits = () => ({});

export function landmarks(H) {
  const { GLOWS, SKINS, beacon, beam, bld, glow, holo, pool, prop, put, textSign } = H;

  // Street-facing axes. a runs along the facade, b points to the street. W is the facade width, D the depth.
  // fc is the street side, which every build returns as its camera face.

  const ax = (x, z, w, d) => {
    const f = H.frame()?.front ?? { x: 0, z: 1 }, fx = f.x, fz = f.z;
    return {
      W: fx ? d : w, D: fx ? w : d, ry: Math.atan2(fx, fz),
      face: fx > 0 ? 0 : fx < 0 ? 1 : fz > 0 ? 2 : 3, fc: [fx, fz],
      p: (a, b) => [x + fz * a + fx * b, z - fx * a + fz * b],
      s: (L, Dd) => fx ? [Dd, L] : [L, Dd],
    };
  };

  // Box helpers in a/b terms. y is the centre for props and glows, the base for buildings.

  const B = (A, a, b, L, Dd, h, st, r, o) => { const [x, z] = A.p(a, b), [sx, sz] = A.s(L, Dd); bld(x, z, sx, sz, h, st, r, o); };
  const P = (A, kind, a, b, y, L, Dd, h, rgb) => { const [x, z] = A.p(a, b), [sx, sz] = A.s(L, Dd); prop(kind, x, y, z, sx, h, sz, rgb); };
  const G = (A, a, b, y, L, Dd, h, rgb) => { const [x, z] = A.p(a, b), [sx, sz] = A.s(L, Dd); glow(x, y, z, sx, h, sz, rgb); };
  const R = (A, a, b, y, L, Dd, rgb) => { const [x, z] = A.p(a, b), [sx, sz] = A.s(L, Dd); put(GLOWS.ring, x, y, z, sx, 1, sz, 0, 0, rgb); };
  const S = (A, a, b, y, s, rgb) => { const [x, z] = A.p(a, b); put(GLOWS.sphere, x, y, z, s, s, s, 0, 0, rgb); };
  const T = (A, text, a, b, y, h, rgb, back) => { const [x, z] = A.p(a, b); textSign(text, x, y, z, h * 4, h, A.ry + (back ? Math.PI : 0), rgb); };
  const L3 = (A, a, b, y) => { const [x, z] = A.p(a, b); return [x, y, z]; };
  const pl = (A, a, b, rad, rgb) => { const [x, z] = A.p(a, b); pool(x, z, rad, rgb); };
  const tree = (A, a, b, y0, h, r) => {
    P(A, 'cyl', a, b, y0 + h * .3, .5, .5, h * .6, [.07, .05, .03]);
    P(A, 'cyl', a, b, y0 + h * .75, h * .7, h * .7, h * .45, dim(LEAF, .8 + r() * .5));
  };
  const lamp = (A, a, b, h, rgb) => {
    P(A, 'cyl', a, b, h / 2, .3, .3, h, DARK);
    G(A, a, b, h + .2, .8, .8, .4, rgb);
    pl(A, a, b, h * .9, dim(rgb, .07));
  };

  // Moving parts live in their own meshes in the landmark group, because shared instances are frozen into tiles after the build.

  const _o = new H.THREE.Object3D(), _c = new H.THREE.Color();
  const mover = (src, n, rgb) => {
    const m = new H.THREE.InstancedMesh(src.geometry, src.material, n);
    for (let i = 0; i < n; i++) m.setColorAt(i, _c.setRGB(...rgb));
    m.userData.noTile = true; m.frustumCulled = false;
    H.decor.add(m);
    return m;
  };

  // Whale parts as [offset along the wall, out from the glass, rise, length, height]. The head leads.

  const WHALE = [[0, .5, 0, 26, 7], [-9, .55, .3, 10, 7.6], [15, .5, .6, 9, 2.4], [19.5, .5, .8, 5, 1.4], [-4, .55, -3.6, 4, 1.2]];
  const ZOO = { walls: [] }, CORE = {};

  return {
    // Ac!d Dr0p: a narrow three-storey bar squeezed between two Akiba stacks, acid green and magenta,
    // with a dripping-drop sign on the roof and the old courier mail-slot wall at street level.

    fe_acidDrop: { at: [305, 720], label: 'Ac!d Dr0p', minSide: 30, reach: 400, labelY: 48, build(x, z, w, d, st, r) {
      const A = ax(x, z, w, d), W = Math.min(A.W, 60), D = Math.min(A.D, 40), fb = D / 2, bw = 12;
      const sw = Math.max(6, (W - bw) / 2 - 1);

      // Akiba stacks either side, with blade signs and one holo.

      const stack = { ...st, base: [.06, .065, .07], win: [.7, .9, 1.1], lit: .45 };
      const pal = [CYAN, AMBER, MAG, [.5, .5, 1.8]];
      for (const e of [-1, 1]) {
        const h = 28 + r() * 16, a = e * (bw / 2 + 1 + sw / 2);
        B(A, a, 0, sw, D, h, stack, r, { skin: SKINS.grid });
        for (let k = 0; k < 3; k++) {
          const sh = 4 + r() * 6;
          G(A, a + (r() - .5) * sw * .6, fb + 1.6, 8 + k * (h - 14) / 3 + sh / 2, .4, 2.6, sh, pal[Math.floor(r() * pal.length)]);
        }
        G(A, a, fb + .15, 4.6, sw * .9, .3, 1.4, dim(pal[Math.floor(r() * pal.length)], .7));
        if (e > 0) { const [px, pz] = A.p(a, 0), [sx, sz] = A.s(sw, D); holo(px, pz, sx, sz, h * .7, r, A.face, 12); }
      }

      // The bar: dark body, magenta windows, neon frame and the name over the door.

      B(A, 0, 0, bw, D, 14, { ...st, base: [.05, .04, .06], win: [1.6, .3, 1.2], lit: .7, grime: .2 }, r, { skin: SKINS.bands, glow: .3 });
      G(A, 0, fb + .15, 4.7, bw, .3, .3, ACID);
      G(A, 0, fb + .15, 9.4, bw, .3, .3, MAG);
      for (const e of [-1, 1]) G(A, e * bw / 2, fb + .15, 7, .3, .3, 14, ACID);
      T(A, 'AC!D DR0P', 0, fb + .4, 11.6, 2.6, ACID);

      // Drips under the sign, a tall magenta blade and the rooftop drop.

      for (const [y, s] of [[9.9, .7], [8.9, .5], [7.6, .35]]) S(A, 3.6, fb + .5, y, s, ACID);
      G(A, -bw / 2 + 1, fb + 1.6, 18, .4, 2.6, 16, MAG);
      P(A, 'cyl', 0, 0, 15.5, .4, .4, 3, DARK);
      for (const [y, s] of [[18.5, 3.6], [20.6, 2.3], [22, 1.3], [22.9, .6]]) S(A, 0, 0, y, s, ACID);
      R(A, 0, 0, 14.3, bw * .9, D * .5, MAG);

      // Mail-slot wall from The Mailroom days, half sprayed over.

      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const a = -bw / 2 + 1.4 + i * 1.5;
        G(A, a, fb + .12, 1.1 + j * .75, 1.1, .1, .3, r() < .35 ? dim(MAG, .45) : [.35, .25, .12]);
      }
      G(A, 2.8, fb + .12, 1.4, 2, .1, 2.8, dim(ACID, .35));

      // Bikes and two hoverbikes out front.

      for (let k = 0; k < 6; k++) {
        const a = -W / 2 + 3 + k * (W - 6) / 5, b = fb + 2.2, hover = k % 3 === 1;
        P(A, 'box', a, b, hover ? 1 : .6, .5, 1.9, .7, hover ? [.12, .12, .14] : DARK);
        G(A, a, b - 1, hover ? 1 : .7, .2, .1, .15, RED);
        if (hover) G(A, a, b, .35, .4, 1.6, .1, CYAN);
      }
      pl(A, 0, fb + 3, 12, [.05, .14, .03]);
      return { face: A.fc };
    } },

    // Shinseibutsu Zoological Garden: a roof garden of glowing glass domes on a huge aquarium tank.
    // The tank stands on stilts. Fish shoals, kelp and a whale shape show on its lit glass walls.

    fe_zoo: { at: [440, 668], label: 'Shinseibutsu Zoological Garden', minSide: 60, reach: 500, labelY: 70, build(x, z, w, d, st, r) {
      const A = ax(x, z, w, d), W = A.W, D = A.D, legH = 14, tH = 28, yb = legH + 1.2, yt = yb + tH, y0 = yt + 1.5;
      const TW = W - 2, TD = D - 2, DW = W + 8, DD = D + 8, fb = DD / 2, m = Math.min(DW, DD);
      const WATER = [.04, .3, .42], FRAME = [.06, .07, .08], FISH = [AMBER, CYAN, [1.6, .6, .3], [1.3, 1.35, 1.5]];

      // Stilts in a 4 x 3 grid, braced along the long side.

      const sa = i => (i / 3 - .5) * (W - 8), sb = j => (j / 2 - .5) * (D - 8);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
        P(A, 'cyl', sa(i), sb(j), legH / 2, 2.4, 2.4, legH, FRAME);
        if (i < 3) beam(L3(A, sa(i), sb(j), 1.5), L3(A, sa(i + 1), sb(j), legH - 1), .4, FRAME);
      }
      G(A, 0, 0, legH - .05, TW * .9, TD * .9, .1, dim(TEAL, .25));
      pl(A, 0, 0, m * .6, dim(TEAL, .08));

      // Tank: floor slab, deck slab, and lit glass with mullions, sand, kelp and fish on every side.

      P(A, 'box', 0, 0, legH + .6, TW + 1, TD + 1, 1.2, FRAME);
      P(A, 'box', 0, 0, yt + .75, DW, DD, 1.5, FRAME);
      for (const [na, nb] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const len = na ? TD : TW, at = (t, o) => na ? [na * (TW / 2 + o), t] : [t, nb * (TD / 2 + o)];
        const g = (t, o, y, L, h, rgb) => { const [a, b] = at(t, o); G(A, a, b, y, na ? .2 : L, na ? L : .2, h, rgb); };
        const e = (t, o, y, L, h, rgb) => { const [a, b] = at(t, o), [px, pz] = A.p(a, b), [sx, sz] = A.s(na ? 1.2 : L, na ? L : 1.2); put(GLOWS.sphere, px, y, pz, sx, h, sz, 0, 0, rgb); };
        g(0, 0, yb + tH / 2, len, tH, WATER);
        g(0, .15, yb + 1.2, len, 2.4, [.3, .24, .1]);
        g(0, .15, yt - .3, len, .3, dim(COOL, .6));
        const n = Math.ceil(len / 9);
        for (let k = 0; k <= n; k++) { const [a, b] = at(-len / 2 + k * len / n, .25); P(A, 'box', a, b, yb + tH / 2, .4, .4, tH, FRAME); }
        for (let k = 0; k < len / 7; k++) { const h = 6 + r() * 12; g((r() - .5) * len * .9, .3, yb + 2 + h / 2, .5, h, [.1, .55, .2]); }
        for (let s = 0; s < 3; s++) {
          const t0 = (r() - .5) * len * .7, y1 = yb + 8 + r() * (tH - 14), c = FISH[Math.floor(r() * FISH.length)];
          for (let k = 0; k < 8; k++) e(t0 + (r() - .5) * 8, .4, y1 + (r() - .5) * 5, .9, .5, dim(c, .8));
        }

        // A whale shape glides along the front and back walls. update() moves it.

        if (nb) ZOO.walls.push([nb, TD / 2, yb + tH * .55, Math.max(4, len / 2 - 22)]);
      }
      Object.assign(ZOO, { x, z, fx: Math.sign(A.fc[0]), fz: Math.sign(A.fc[1]), mesh: mover(GLOWS.sphere, ZOO.walls.length * WHALE.length, [.01, .02, .03]) });

      // Glass lifts at the front corners run from the street up to the roof garden.

      for (const e of [-1, 1]) {
        const a = e * (TW / 2 - 4), b = TD / 2 + 1.6;
        P(A, 'box', a, b, (y0 + 3) / 2, 4, 2.4, y0 + 3, FRAME);
        G(A, a, b + 1.25, (y0 + 3) / 2, 2.6, .1, y0 + 2, dim(WARM, .35));
        G(A, a, b + 1.3, 6 + r() * (y0 - 10), 2.8, .15, 2.4, WARM);
        S(A, a, b + 2, 3, .9, [1.8, .5, .18]);
      }
      pl(A, 0, D / 2, 12, [.12, .08, .03]);

      // Roof garden: ground, a hedge wall with a gap for the gate, and a gold edge line.

      P(A, 'box', 0, 0, y0 + .1, DW - 1, DD - 1, .2, [.02, .045, .028]);
      P(A, 'box', 0, -fb + .6, y0 + .9, DW, 1.2, 1.8, LEAF);
      for (const e of [-1, 1]) {
        P(A, 'box', e * (DW / 2 - .6), 0, y0 + .9, 1.2, DD, 1.8, LEAF);
        P(A, 'box', e * (DW / 4 + 5), fb - .6, y0 + .9, DW / 2 - 10, 1.2, 1.8, LEAF);
        G(A, 0, e * (fb + .05), y0 - .75, DW, .1, .25, dim(GOLD, .6));
        G(A, e * (DW / 2 + .05), 0, y0 - .75, .1, DD, .25, dim(GOLD, .6));
      }

      // Domes: glowing half-spheres with lit ribs.

      const domes = [[-.24, -.16, .22, [.18, .5, .26]], [.22, -.2, .18, [.42, .36, .12]], [.08, .14, .14, [.16, .46, .3]], [-.27, .2, .1, [.4, .34, .14]]];
      const pts = [];
      for (const [fa, fbb, fr, col] of domes) {
        const a = fa * DW, b = fbb * DD, rad = fr * m;
        S(A, a, b, y0, rad * 2, col);
        for (const k of [.3, .6, .85]) R(A, a, b, y0 + rad * k, rad * 2 * Math.sqrt(1 - k * k) + .2, rad * 2 * Math.sqrt(1 - k * k) + .2, dim(GOLD, .6));
        R(A, a, b, y0 + .3, rad * 2.1, rad * 2.1, dim(GOLD, .8));
        pts.push([a, b, rad]);
      }

      // Paths from the gate, enclosure lights and trees between the domes.

      for (const [a, b] of pts) beam(L3(A, 0, fb - 6, y0 + .15), L3(A, a, b, y0 + .15), .5, [.4, .28, .12], 'glow');
      for (let k = 0; k < 16; k++) {
        const a = (r() - .5) * (DW - 8), b = (r() - .5) * (DD - 8);
        if (pts.some(([pa, pb, rad]) => Math.hypot(a - pa, b - pb) < rad + 3)) continue;
        if (k % 3) tree(A, a, b, y0, 6 + r() * 4, r);
        else { G(A, a, b, y0 + .5, 1.4, 1.4, .3, WARM); P(A, 'box', a, b, y0 + .5, 4, 4, 1, [.06, .05, .04]); }
      }

      // Tile-roof gate at the roof edge, with lanterns and the name toward the street.

      const gb = fb - 3;
      for (const e of [-1, 1]) {
        P(A, 'box', e * 7, gb, y0 + 5, 1.6, 1.6, 10, [.1, .04, .03]);
        S(A, e * 7, gb + 1.2, y0 + 7.6, 1.2, [1.8, .5, .18]);
      }
      P(A, 'box', 0, gb, y0 + 10.5, 20, 5, 1.1, [.05, .05, .06]);
      P(A, 'box', 0, gb, y0 + 11.6, 16, 4, 1, [.05, .05, .06]);
      G(A, 0, gb, y0 + 9.9, 17, 4.2, .1, dim(WARM, .5));
      T(A, 'SHINSEIBUTSU', 0, gb + 2.7, y0 + 8.6, 2.4, GOLD);
      return { face: A.fc };
    }, update(t) {

      // The whale swims head first along the glass, then shrinks away into the deep tank and starts again.

      const { x, z, fx, fz, mesh } = ZOO;
      if (!mesh) return;
      ZOO.walls.forEach(([nb, half, y0, range], w) => {
        const f = (t * .8 / range + w * .5) % 1, sc = Math.min(1, f / .12, (1 - f) / .12);
        const tc = nb * range * (1 - 2 * f), y = y0 + Math.sin(t * .5 + w) * 1.2;
        WHALE.forEach(([dt, o, dy, L, h], k) => {
          const a = tc + nb * dt * sc, b = nb * (half + o), sx = (fx ? 1.2 : L) * sc, sz = (fx ? L : 1.2) * sc;
          _o.position.set(x + fz * a + fx * b, y + dy * sc, z - fx * a + fz * b); _o.scale.set(sx, h * sc, sz); _o.updateMatrix();
          mesh.setMatrixAt(w * WHALE.length + k, _o.matrix);
        });
      });
      mesh.instanceMatrix.needsUpdate = true;
    } },

    // Jinteki Clone Barracks: a walled compound under a garden deck. A light-well shows the identical white rows
    // below and the running track along one side.

    fe_cloneBarracks: { at: [411, 752], label: 'Jinteki Clone Barracks', minSide: 50, reach: 500, labelY: 30, build(x, z, w, d, st, r) {
      const A = ax(x, z, w, d), W = A.W, D = A.D, fb = D / 2, deck = 12;
      const ww = W * .62, wd = D * .5, trk = Math.min(14, W * .2);
      P(A, 'box', 0, 0, .1, W - 2, D - 2, .2, [.09, .095, .1]);

      // Walls up to the deck, white light along the top.

      const wallC = [.13, .14, .15];
      for (const e of [-1, 1]) {
        P(A, 'box', e * (W / 2 - .75), 0, deck / 2, 1.5, D, deck, wallC);
        P(A, 'box', 0, e * (fb - .75), deck / 2, W, 1.5, deck, wallC);
      }

      // Rows: long identical white blocks, cool light along every alley.

      const clone = { ...st, base: [.42, .44, .47], win: [.85, .95, 1.1], lit: .85, grime: 0 };
      const rowL = W - 8 - trk, rowA = trk / 2;
      for (let b = -fb + 6; b < fb - 5; b += 7) {
        B(A, rowA, b, rowL, 4, 6, clone, r, { skin: SKINS.bands, roof: false, kibble: false });
        G(A, rowA, b + 2.4, 6.1, rowL, .25, .2, COOL);
        G(A, rowA, b + 3.5, .15, rowL, .3, .1, dim(COOL, .4));
      }

      // Running track on the free strip.

      R(A, -W / 2 + 2 + trk / 2, 0, .3, trk - 2, D - 8, [.3, 1.5, 1.6]);
      R(A, -W / 2 + 2 + trk / 2, 0, .3, trk - 4, D - 10, dim([.3, 1.5, 1.6], .6));

      // Garden deck round the light-well.

      const deckC = [.035, .06, .04], fd = (D - wd) / 2, sd = (W - ww) / 2;
      for (const e of [-1, 1]) {
        P(A, 'box', 0, e * (wd / 2 + fd / 2), deck - .5, W, fd, 1, deckC);
        P(A, 'box', e * (ww / 2 + sd / 2), 0, deck - .5, sd, wd, 1, deckC);
      }
      for (let k = 0; k < 18; k++) {
        const t = r() * 4, side = Math.floor(t), u = t - side;
        const a = side < 2 ? (u - .5) * (W - 6) : (side === 2 ? -1 : 1) * (ww / 2 + sd / 2), b = side < 2 ? (side ? 1 : -1) * (wd / 2 + fd / 2) : (u - .5) * wd;
        k % 4 ? tree(A, a, b, deck, 5 + r() * 4, r) : (P(A, 'cyl', a, b, deck + .3, 1, 1, .6, DARK), S(A, a, b, deck + 1.4, .7, WARM));
      }

      // Well rim railing: the bright rectangle that reads from far off.

      for (const e of [-1, 1]) {
        G(A, 0, e * wd / 2, deck + 1, ww, .25, .25, COOL);
        G(A, e * ww / 2, 0, deck + 1, .25, wd, .25, COOL);
      }

      // Jinteki name on the street wall, a guarded gate under it.

      T(A, 'JINTEKI', 0, fb + .2, deck - 3.5, 3, RED);
      G(A, 0, fb + .1, 2, 6, .2, 4, [.35, .38, .42]);
      for (const e of [-1, 1]) G(A, e * 3.6, fb + .3, 3.2, .3, .3, 6, RED);
      pl(A, 0, fb + 2, 10, [.1, .02, .02]);
      return { face: A.fc };
    } },

    // Levy University AI Tower: a glass research tower of corner piers and floor plates, a cyan lattice core
    // lit inside, and a Haas-Bioroid skybridge to a lab block when the block has room.

    fe_levyAI: { at: [507, 788], label: 'Levy University AI Tower', minSide: 40, reach: 500, labelY: 246, build(x, z, w, d, st, r) {
      const A = ax(x, z, w, d), S0 = Math.max(24, Math.min(34, Math.min(A.W, A.D) - 12)), Ht = 230, pod = 10;
      const glass = { ...st, base: [.12, .15, .18], win: [.7, .9, 1.1], lit: .5, grime: 0 };
      B(A, 0, 0, S0 + 10, S0 + 10, pod, glass, r, { skin: SKINS.curtain, roof: false, kibble: false });
      for (const ea of [-1, 1]) for (const eb of [-1, 1]) B(A, ea * (S0 / 2 - 2.5), eb * (S0 / 2 - 2.5), 5, 5, Ht - pod, glass, r, { y0: pod, skin: SKINS.curtain, roof: false });

      // Floor plates with lit glass edges.

      for (let y = pod + 10; y < Ht; y += 10) {
        P(A, 'box', 0, 0, y, S0 - 1, S0 - 1, .8, [.06, .07, .08]);
        for (const e of [-1, 1]) { G(A, 0, e * (S0 / 2 - .5), y + .5, S0 - 10, .15, .15, dim(COOL, .6)); G(A, e * (S0 / 2 - .5), 0, y + .5, .15, S0 - 10, .15, dim(COOL, .6)); }
      }

      // Lattice core: a cyan column with crossed struts on every face.

      const c = 5;
      G(A, 0, 0, pod + (Ht - pod) / 2, 4, 4, Ht - pod, dim(CYAN, .5));
      for (let y = pod, k = 0; y < Ht - 5; y += 10, k++) {
        const s = k % 2 ? 1 : -1;
        beam(L3(A, -c * s, c, y), L3(A, c * s, c, y + 10), .4, CYAN, 'glow');
        beam(L3(A, -c * s, -c, y), L3(A, c * s, -c, y + 10), .4, CYAN, 'glow');
        beam(L3(A, c, -c * s, y), L3(A, c, c * s, y + 10), .4, CYAN, 'glow');
        beam(L3(A, -c, -c * s, y), L3(A, -c, c * s, y + 10), .4, CYAN, 'glow');
      }

      // Light pulses climb the core. Three ride in one mesh, and update() lifts the mesh through one spacing.

      const [cx, cz] = A.p(0, 0), sp = (Ht - pod) / 3;
      CORE.mesh = mover({ geometry: H.PROPS.box.geometry, material: GLOWS.sphere.material }, 3, [.8, 1.9, 2.3]);
      for (let k = 0; k < 3; k++) { _o.position.set(0, pod + k * sp, 0); _o.scale.set(5.2, 1.6, 5.2); _o.updateMatrix(); CORE.mesh.setMatrixAt(k, _o.matrix); }
      CORE.mesh.position.set(cx, 0, cz); CORE.sp = sp;

      // Crown: cap, cyan ring, mast and the name.

      P(A, 'box', 0, 0, Ht + .6, S0, S0, 1.2, [.08, .09, .1]);
      R(A, 0, 0, Ht + 2, S0 * 1.15, S0 * 1.15, CYAN);
      P(A, 'cyl', 0, 0, Ht + 11, .6, .6, 20, DARK);
      const [mx, mz] = A.p(0, 0);
      beacon(mx, Ht + 21.5, mz, r);
      T(A, 'LEVY AI', 0, S0 / 2 + .3, Ht - 6, 4, CYAN);
      T(A, 'LEVY AI', 0, -S0 / 2 - .3, Ht - 6, 4, CYAN, true);
      T(A, 'LEVY UNIVERSITY', 0, (S0 + 10) / 2 + .3, pod * .55, 3, COOL);

      // Lab block and skybridge with the HB sign, else the sign sits on the podium.

      const labW = Math.min(24, (A.W - S0) / 2 - 6), hb = [.8, 1.2, 1.8];
      if (labW >= 10) {
        const la = -(S0 / 2 + 6 + labW / 2);
        B(A, la, 0, labW, Math.min(A.D - 4, 40), 42, { ...glass, lit: .4 }, r, { skin: SKINS.fins });
        const ba = -(S0 / 2 + 3);
        P(A, 'box', ba, 0, 34, 6, 4, 3, [.1, .14, .17]);
        G(A, ba, 0, 32.4, 6, 4.2, .15, dim(hb, .7));
        T(A, 'HAAS-BIOROID', ba, 2.2, 34, 1.1, hb);
      } else T(A, 'HAAS-BIOROID', 0, (S0 + 10) / 2 + .3, pod + 1.5, 1.6, hb);
      pl(A, 0, (S0 + 10) / 2 + 4, 16, [.04, .1, .13]);
      return { face: A.fc };
    }, update(t) {
      if (CORE.mesh) CORE.mesh.position.y = (t * 18) % CORE.sp;
    } },

    // Heureka: a white startup campus round a lit courtyard, orange and teal trim, glass walkways,
    // warm roof terraces and a tall name sign with a light bulb.

    fe_heureka: { at: [380, 930], label: 'Heureka', minSide: 40, reach: 450, labelY: 76, build(x, z, w, d, st, r) {
      const A = ax(x, z, w, d), W = Math.min(A.W, 90), D = Math.min(A.D, 90);
      const cw = W * .36, cd = D * .36, bw = (W - cw) / 2 - 2, bd = (D - cd) / 2 - 2;
      const white = { ...st, base: [.42, .43, .45], win: [1, .92, .75], lit: .6, grime: 0 };
      const hs = [[-1, 1, 30], [1, 1, 36], [-1, -1, 54], [1, -1, 42]], tops = [];
      for (const [ea, eb, h] of hs) {
        const a = ea * (cw / 2 + bw / 2 + 1), b = eb * (cd / 2 + bd / 2 + 1);
        B(A, a, b, bw, bd, h, white, r, { skin: SKINS.bands, roof: false, kibble: false });
        G(A, a + ea * bw / 2, b + eb * bd / 2, h / 2, .4, .4, h, ORANGE);
        G(A, a, b + bd / 2 + .1, h - .4, bw, .2, .5, TEAL);
        tops.push([a, b, h]);
      }

      // Warm roof terraces on the two front boxes.

      for (const [a, b, h] of tops.slice(0, 2)) {
        for (const e of [-1, 1]) G(A, a, b + e * (bd / 2 - .4), h + .6, bw - 1, .15, .15, WARM);
        for (let k = 0; k < 3; k++) {
          const pa = a + (k - 1) * bw * .28;
          P(A, 'cone', pa, b, h + 2.4, 3, 3, 1, [.3, .12, .04]);
          S(A, pa, b, h + 1, .6, WARM);
        }
      }

      // Glass walkways between the boxes, teal light underneath.

      const link = (i, j, y) => {
        const [a1, b1] = tops[i], [a2, b2] = tops[j];
        beam(L3(A, a1, b1, y), L3(A, a2, b2, y), 3, [.08, .16, .17]);
        beam(L3(A, a1, b1, y - 1.6), L3(A, a2, b2, y - 1.6), .3, TEAL, 'glow');
      };
      link(0, 1, 18); link(2, 3, 28); link(0, 2, 24); link(1, 3, 14);

      // Courtyard: lit floor, tables and trees.

      P(A, 'box', 0, 0, .1, cw, cd, .2, [.16, .12, .08]);
      pl(A, 0, 0, Math.min(cw, cd) * .7, [.14, .08, .03]);
      for (let k = 0; k < 6; k++) {
        const a = (r() - .5) * cw * .8, b = (r() - .5) * cd * .8;
        k % 2 ? tree(A, a, b, 0, 5 + r() * 2, r) : (P(A, 'cyl', a, b, .5, 1.6, 1.6, 1, [.2, .2, .2]), S(A, a, b, 1.3, .5, WARM));
      }
      G(A, 0, D / 2 - 1, 4, cw, 3, .3, dim(ORANGE, .6));

      // Name sign and bulb on the tallest box, facing the street.

      const [ta, tb, th] = tops[2], sh = Math.max(3, Math.min(6, bw / 4.5)), ba = ta + sh * 2.5;
      for (const e of [-1, 1]) P(A, 'box', ta + e * sh * 1.6, tb, th + sh, .5, .5, sh * 2, DARK);
      T(A, 'HEUREKA', ta, tb + .3, th + sh * 1.3, sh, ORANGE);
      P(A, 'cyl', ba, tb, th + sh * .5, sh * .27, sh * .27, sh, TEAL);
      S(A, ba, tb, th + sh * 1.45, sh * .85, [2, 1.8, 1.1]);
      for (const k of [.9, 1.05]) R(A, ba, tb, th + sh * k, sh * .35, sh * .35, TEAL);
      return { face: A.fc };
    } },

    // I/O Secure Data, Inc.: a windowless black block with thin red seams, a fence, floodlights,
    // one small logo plate and a closed roof bay for drones.

    fe_ioSecure: { at: [472, 1113], label: 'I/O Secure Data, Inc.', minSide: 40, reach: 450, labelY: 84, build(x, z, w, d, st, r) {
      const A = ax(x, z, w, d), W = Math.min(A.W, 80), D = Math.min(A.D, 80), bw = W - 14, bd = D - 14, h = 70;
      const seam = dim(RED, .7);
      P(A, 'box', 0, 0, .1, W, D, .2, [.06, .06, .065]);
      P(A, 'box', 0, 0, h / 2, bw, bd, h, [.012, .012, .015]);

      // Red seams: floor lines on four faces, corner lines and two verticals per long face.

      for (let y = 14; y < h; y += 14) for (const e of [-1, 1]) {
        G(A, 0, e * (bd / 2 + .05), y, bw, .12, .12, seam);
        G(A, e * (bw / 2 + .05), 0, y, .12, bd, .12, seam);
      }
      for (const ea of [-1, 1]) for (const eb of [-1, 1]) {
        G(A, ea * (bw / 2 + .05), eb * (bd / 2 + .05), h / 2, .15, .15, h, RED);
        G(A, ea * bw / 6, eb * (bd / 2 + .05), h / 2, .1, .1, h, seam);
      }

      // Roof bay: a closed hatch edged in red and a drone light over it.

      P(A, 'box', 0, 0, h + .2, bw * .4, bd * .4, .4, [.03, .03, .035]);
      for (const e of [-1, 1]) { G(A, 0, e * bd * .2, h + .45, bw * .4, .15, .15, RED); G(A, e * bw * .2, 0, h + .45, .15, bd * .4, .15, RED); }
      S(A, bw * .1, 0, h + 12, .8, [1.5, 1.5, 1.6]);
      const [dx, dz] = A.p(0, 0);
      beacon(dx, h + 1.5, dz, r);

      // Fence, floodlights and a guard booth at the back gate.

      for (const e of [-1, 1]) {
        P(A, 'box', 0, e * (D / 2 - 2), 1.8, W - 4, .15, 3.6, [.1, .1, .11]);
        P(A, 'box', e * (W / 2 - 2), 0, 1.8, .15, D - 4, 3.6, [.1, .1, .11]);
      }
      for (const ea of [-1, 1]) for (const eb of [-1, 1]) lamp(A, ea * (W / 2 - 3), eb * (D / 2 - 3), 11, COOL);
      for (let k = -2; k <= 2; k++) G(A, k * bw / 5, bd / 2 + 2, .4, .8, .8, .4, COOL);
      P(A, 'box', 0, -D / 2 + 5, 1.5, 4, 3, 3, [.15, .15, .16]);
      G(A, 0, -D / 2 + 3.4, 2, 2.4, .1, 1, WARM);

      // The only sign: a small white plate on a plinth by the front fence.

      P(A, 'box', -W / 4, D / 2 - 3.5, .6, 4, .8, 1.2, [.1, .1, .1]);
      T(A, 'I/O SECURE DATA', -W / 4, D / 2 - 3, .7, .8, [1.1, 1.1, 1.15]);
      return { face: A.fc };
    } },

    // Esmeraldas Work-Wear Hall: a flat big-box store with a glass front full of racks, a red and yellow
    // fascia, a pylon sign and a floodlit car park of contractor trucks.

    fe_workwear: { at: [235, 522], label: 'Esmeraldas Work-Wear Hall', minSide: 46, reach: 450, labelY: 30, build(x, z, w, d, st, r) {
      const A = ax(x, z, w, d), W = A.W, D = A.D, sd = D * .58, sw = W - 4, bS = -D / 2 + 1 + sd / 2, ff = bS + sd / 2;
      B(A, 0, bS, sw, sd, 15, { ...st, base: [.2, .19, .17], lit: .15 }, r, { skin: SKINS.sparse, kibble: false });

      // Glass front with rack silhouettes, red band and fascia sign.

      G(A, 0, ff + .1, 2.8, sw * .8, .2, 5, [1.2, 1.15, 1]);
      for (let a = -sw * .4 + 1.5; a < sw * .4; a += 3) P(A, 'box', a, ff + .35, 2.4, .6, .3, 4.2, [.05, .05, .05]);
      G(A, 0, ff + .1, 5.6, sw * .8, .25, .5, RED);
      G(A, 0, ff + .3, 11, sw * .6, .3, 5, dim(RED, .45));
      G(A, 0, ff + .3, 13.8, sw * .6, .3, .5, YELLOW);
      T(A, 'WORK-WEAR HALL', 0, ff + .5, 11, 3.6, YELLOW);

      // Car park: asphalt, bay lines, floodlights and trucks.

      const pd = D / 2 - ff, pb = ff + pd / 2;
      P(A, 'box', 0, pb, .1, W, pd, .2, ASPHALT);
      for (let a = -W / 2 + 4; a < W / 2 - 3; a += 3.2) P(A, 'box', a, pb, .22, .15, pd * .45, .04, [.3, .3, .26]);
      for (const e of [-1, 1]) for (const q of [.3, .85]) lamp(A, e * W * q / 2, pb, 12, [1.3, 1.1, .7]);
      const paint = [[.5, .5, .52], [.4, .06, .04], [.5, .3, .05], [.12, .14, .18], [.45, .45, .4]];
      for (let k = 0; k < 7; k++) {
        const a = -W / 2 + 5.5 + Math.floor(r() * ((W - 9) / 3.2)) * 3.2, b = pb + (k % 2 ? 1 : -1) * pd * .22, c = paint[Math.floor(r() * paint.length)];
        P(A, 'box', a, b - .8, 1.2, 1.9, 2.4, 1.6, c);
        P(A, 'box', a, b + 1.4, .9, 1.9, 2.2, 1, dim(c, .7));
      }

      // Pylon sign at the car-park corner.

      const pa = W / 2 - 3, pbb = D / 2 - 3;
      P(A, 'cyl', pa, pbb, 8, .6, .6, 16, DARK);
      G(A, pa, pbb, 17.5, 8, .6, 4, dim(RED, .5));
      G(A, pa, pbb, 15.3, 8, .7, .4, YELLOW);
      T(A, 'WORK-WEAR', pa, pbb + .4, 17.5, 1.9, YELLOW);
      T(A, 'WORK-WEAR', pa, pbb - .4, 17.5, 1.9, YELLOW, true);
      return { face: A.fc };
    } },
  };
}
