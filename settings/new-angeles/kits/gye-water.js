// Guayaquil sights in the Waterways. guayaquil.js spreads these into its landmarks and passes its shared tools as G.
// Each sight claims a shore block and puts its showpiece out on the water by world position.

export function sights(G) {
  const { H, T, facing, searchlight, dim, pick, PAL } = G;
  const { THREE, GLOWS, prop, glow, put, pool, puff, beam, textSign, flickerGlow, stringLights, beacon, lerp } = H;
  const { toLocal, waters, fire } = T;
  const { CONC, WOOD, HULL, TARP, JUNK, FIRE, SODIUM, SMOG, TUNG } = PAL;
  const RED14 = [1.7, .12, .1], STEEL = [.1, .09, .08], DARK = [.04, .04, .04];

  // These helpers take world X, Z and a world yaw and draw into the current landmark frame.

  const yawOf = () => H.frame()?.a ?? 0;
  const dirL = (dX, dZ) => { const a = yawOf(), c = Math.cos(a), s = Math.sin(a); return [dX * c - dZ * s, dX * s + dZ * c]; };
  const L3 = (X, y, Z) => { const [x, z] = toLocal(X, Z); return [x, y, z]; };
  const P = (kind, X, y, Z, sx, sy, sz, rgb, yaw = 0, rx = 0) => { const [x, z] = toLocal(X, Z); return prop(kind, x, y, z, sx, sy, sz, rgb, yaw - yawOf(), rx); };
  const Gl = (X, y, Z, sx, sy, sz, rgb, yaw = 0) => { const [x, z] = toLocal(X, Z); return glow(x, y, z, sx, sy, sz, rgb, yaw - yawOf()); };
  const Sp = (X, y, Z, s, rgb) => { const [x, z] = toLocal(X, Z); put(GLOWS.sphere, x, y, z, s, s, s, 0, 0, rgb); };
  const Po = (X, Z, rad, rgb) => { const [x, z] = toLocal(X, Z); pool(x, z, rad, rgb); };
  const Pf = (X, y, Z, rad, rgb) => { const [x, z] = toLocal(X, Z); puff(x, y, z, rad, rgb); };
  const Fl = (X, y, Z, s, rgb, r) => { const [x, z] = toLocal(X, Z); flickerGlow(x, y, z, s, s, s, rgb, r); };
  const Fire = (X, y, Z, r, s) => { const [x, z] = toLocal(X, Z); fire(x, y, z, r, s); };
  const Bm = (a, b, t, rgb, kind) => beam(L3(...a), L3(...b), t, rgb, kind);
  const Txt = (text, X, y, Z, w, h, yaw, rgb) => { const [x, z] = toLocal(X, Z); textSign(text, x, y, z, w, h, yaw - yawOf(), rgb); };
  const Str = (a, b, sag, n, rgb) => stringLights(L3(...a), L3(...b), sag, n, rgb);

  // shore() smooths the traced Waterways outline the way render.js does, so it matches the drawn water.
  // banks(Z) gives the west and east shore X on that row, or null.

  let SHORE;
  const shore = () => {
    if (SHORE !== undefined) return SHORE;
    let p = (waters().find(w => w.name === 'The Waterways') ?? waters()[0])?.poly ?? null;
    for (let k = 0; p && k < 3; k++) {
      const q = p;
      p = q.flatMap((a, i) => { const b = q[(i + 1) % q.length]; return [[a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]]; });
    }
    return (SHORE = p);
  };
  const banks = Z => {
    const p = shore(), xs = [];
    if (!p) return null;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [ax, az] = p[j], [bx, bz] = p[i];
      if ((az > Z) !== (bz > Z)) xs.push(ax + (Z - az) * (bx - ax) / (bz - az));
    }
    return xs.length >= 2 ? [Math.min(...xs), Math.max(...xs)] : null;
  };

  // laundry() hangs sheets on a line between two world points.

  const laundry = (a, b, r) => {
    Bm(a, b, .05, [.06, .06, .06]);
    const yaw = Math.atan2(b[0] - a[0], b[2] - a[2]);
    for (let k = 1 + Math.floor(r() * 3); k > 0; k--) {
      const t = .15 + r() * .7;
      P('box', lerp(a[0], b[0], t), lerp(a[1], b[1], t) - .55, lerp(a[2], b[2], t), .06, 1, 1.3, r() < .5 ? pick(r, TARP) : [.3, .29, .26], yaw);
    }
  };

  return {
    // Estero Salado is a toxic lobe of the Waterways off the Daule bank. Black-brown water carries a bacterial
    // sheen that pulses slowly, and goop strands tangle across it. No traffic comes in. A punishment boat sits
    // stuck in the middle, and the Mad Mudlark lab boat is the one lit hull at the south end.

    gye_estero: {
      at: [1131, 1497], label: 'Estero Salado', minSide: 24, reach: 360, labelY: 30,
      build(x, z, w, d, st, r) {
        const GOOP = [.05, .055, .02], SLIME = [.07, .08, .025], LAB = [.55, .95, 1.25];

        // The claimed block is a dead shore with bare mud, junk and a warning board.

        prop('box', x, .12, z, w, .24, d, [.03, .028, .022]);
        for (let k = 0; k < 8; k++) prop('box', x + (r() - .5) * w * .8, .5, z + (r() - .5) * d * .8, 1 + r() * 3, .4 + r() * .8, 1 + r() * 3, pick(r, JUNK), r() * 3);
        if (!shore()) return;
        const ZC = 3990, bc = banks(ZC);
        if (!bc) return;
        const [fx, fz] = toLocal(bc[1] - 77, ZC), sy = Math.atan2(fx - x, fz - z);
        for (const s of [-2.2, 2.2]) prop('cyl', x + Math.cos(sy) * s, 1.6, z - Math.sin(sy) * s, .2, 3.2, .2, WOOD);
        prop('box', x, 3, z, 5, 1.6, .15, [.1, .08, .03], sy);
        textSign('PELIGRO', x + Math.sin(sy) * .1, 3, z + Math.cos(sy) * .1, 4.4, 1.1, sy, [1.4, .55, .1]);

        // A soft-edged grid covers the lobe. Its shader draws the brown soup, a slow green-yellow pulse and
        // taffy strands from world-space noise.

        const Z0 = 3885, Z1 = 4100, ROWS = 30, COLS = 12, rows = [];
        for (let i = 0; i <= ROWS; i++) {
          const v = i / ROWS, Z = lerp(Z0, Z1, v), b = banks(Z);
          if (!b) return;
          const xe = b[1] - 7, xi = Math.max(b[0] + 60, xe - 45 - 105 * Math.sin(Math.PI * v) ** .7 + Math.sin(i * 1.7) * 7);
          rows.push([Z, xi, xe, v]);
        }
        const pos = [], fade = [], idx = [];
        for (const [Z, xi, xe, v] of rows) for (let j = 0; j <= COLS; j++) {
          const u = j / COLS, [lx, lz] = toLocal(lerp(xi, xe, u), Z);
          pos.push(lx, .6, lz);
          fade.push(Math.min(1, u * 3, (1 - u) * 8, v * 5, (1 - v) * 5));
        }
        for (let i = 0; i < ROWS; i++) for (let j = 0; j < COLS; j++) {
          const a = i * (COLS + 1) + j, c = a + COLS + 1;
          idx.push(a, c, a + 1, a + 1, c, c + 1);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('aFade', new THREE.Float32BufferAttribute(fade, 1));
        geo.setIndex(idx);
        const U = H.U, mat = new THREE.ShaderMaterial({
          uniforms: { uTime: U.uTime, uFog: U.uFog, uFogNear: U.uFogNear, uFogFar: U.uFogFar, uMist: U.uMist, uMistBase: U.uMistBase, uClipTop: U.uClipTop },
          vertexShader: `
            attribute float aFade; varying vec3 vW; varying float vF;
            void main() { vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vF = aFade; gl_Position = projectionMatrix * viewMatrix * w; }`,
          fragmentShader: `
            uniform float uTime; varying vec3 vW; varying float vF;
            ${H.FOG_GLSL}
            float hs(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float n2(vec2 p) {
              vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
              return mix(mix(hs(i), hs(i + vec2(1., 0.)), f.x), mix(hs(i + vec2(0., 1.)), hs(i + vec2(1., 1.)), f.x), f.y);
            }
            void main() {
              vec2 p = vW.xz * .03;
              float a = n2(p + vec2(uTime * .006, -uTime * .004)), b = n2(p * 2.7 - vec2(uTime * .005, uTime * .008));
              float m = .62 * a + .38 * b, pulse = .5 + .5 * sin(uTime * .3 + m * 6.);
              vec3 col = mix(vec3(.025, .016, .007), vec3(.055, .035, .013), m);
              col += vec3(.04, .06, .01) * pow(m, 2.) * (.4 + .9 * pulse);
              float s = abs(fract(m * 9. + .15 * sin(uTime * .15 + b * 3.)) - .5);
              col += vec3(.06, .075, .018) * (1. - smoothstep(0., .06, s)) * b;
              // Distance fog only. The ground mist in fogged() would bury the soup at water level.

              gl_FragColor = vec4(mix(col, uFog * 1.2, smoothstep(uFogNear, uFogFar, distance(cameraPosition, vW))), vF * .93);
            }`,
          transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
        });
        const sheen = new THREE.Mesh(geo, mat);

        // The sheen floats 0.6 m up and draws after the river surface, so the water cannot cover it at a distance.

        sheen.renderOrder = 1;
        sheen.frustumCulled = false;
        H.decor.add(sheen);

        // Goop blobs and faint gas glows float on the soup.

        for (let k = 0; k < 14; k++) {
          const [Z, xi, xe] = rows[2 + Math.floor(r() * (ROWS - 4))], X = lerp(xi, xe, .15 + r() * .7);
          P('cyl', X, .24, Z, 3 + r() * 5, .1, 2 + r() * 4, r() < .5 ? GOOP : SLIME, r() * 3);
          if (k % 3 === 0) Sp(X + 2, .3, Z, .5, [.1, .16, .04]);
        }

        // The punishment boat lists, stuck fast, with strands over its sides and one weak lamp.

        const Zp = 3952, Xp = banks(Zp)[1] - 62;
        P('box', Xp, .55, Zp, 3.6, 1.2, 11, [.06, .045, .03], .6, .1);
        P('box', Xp + .4, 1.9, Zp - .6, 2.4, 1.6, 3.2, pick(r, TARP), .6, .06);
        for (let k = 0; k < 9; k++) {
          const a = k / 9 * Math.PI * 2 + r() * .4, rr = 4 + r() * 7;
          Bm([Xp + Math.cos(a) * 1.4, 1 + r() * .3, Zp + Math.sin(a) * 4], [Xp + Math.cos(a) * rr, .22, Zp + Math.sin(a) * (rr + 3)], .18 + r() * .2, k % 2 ? GOOP : SLIME);
        }
        Fl(Xp + .2, 3, Zp - .4, .3, [.6, .38, .15], r);
        Po(Xp, Zp, 6, [.04, .025, .008]);

        // Only the bow of an older wreck still shows above the goop.

        P('box', Xp - 26, .7, Zp + 30, 3, 1.4, 8, [.04, .035, .03], 1.9, -.35);

        // The Mad Mudlark is Natalia Almeida's houseboat lab. It has a pale hull, a cabin in cold lab light, sample
        // racks, a davit with a bucket in the goop, a floodlight, solar panels and a mast.

        const Zm = 4040, Xm = banks(Zm)[1] - 70;
        P('box', Xm, .8, Zm, 6.4, 1.6, 18, [.11, .12, .12]);
        P('box', Xm, 1.7, Zm, 6.8, .2, 18.4, [.07, .07, .07]);
        P('box', Xm, 3.2, Zm + 1, 5.4, 2.8, 10, [.13, .14, .15]);
        P('box', Xm, 4.75, Zm + 1, 6, .3, 11, [.06, .06, .065]);
        for (const s of [-1, 1]) {
          Gl(Xm + s * 2.72, 3.3, Zm + 1, .1, 1, 8.4, dim(LAB, .8));
          Txt('MAD MUDLARK', Xm + s * 2.78, 2.1, Zm + 1, 6, 1.1, s * Math.PI / 2, dim(LAB, .6));
          Po(Xm + s * 6, Zm + 1, 8, dim(LAB, .07));
        }
        Gl(Xm, 3.3, Zm + 6.02, 4, 1, .1, LAB);
        P('cyl', Xm - 1.4, 5.8, Zm - 1.5, 1.4, 1.8, 1.4, [.05, .07, .06]);
        Gl(Xm - 1.4, 5.8, Zm - 1.5, 1.5, .3, 1.5, [.3, 1.1, .4]);
        P('box', Xm, 5.1, Zm + 3.5, 4.6, .1, 3, [.03, .05, .12], 0, -.25);
        P('dish', Xm + 1.6, 5.2, Zm - 3, 1.6, 1.6, 1.6, [.3, .3, .32]);
        P('cyl', Xm + 1.8, 8, Zm + 4, .15, 6.5, .15, [.2, .2, .2]);
        Sp(Xm + 1.8, 11.3, Zm + 4, .35, [1.2, 1.3, 1.4]);
        Str([Xm, 4.9, Zm + 8], [Xm + 1.8, 10.8, Zm + 4], .3, 6, dim(LAB, .7));
        P('box', Xm, 2.4, Zm - 6.4, 5.4, 1.4, .3, [.08, .08, .08]);
        for (let k = 0; k < 10; k++) Sp(Xm - 2 + (k % 5), 2.3 + Math.floor(k / 5) * .5, Zm - 6.2, .22, k % 3 ? [.4, 1.2, .35] : [1.2, .9, .2]);
        for (const s of [-1, 1]) Bm([Xm + s * 2.2, 1.8, Zm - 8.5], [Xm, 6.5, Zm - 11.5], .2, STEEL);
        Bm([Xm, 6.5, Zm - 11.5], [Xm, .6, Zm - 11.5], .05, DARK);
        P('cyl', Xm, .7, Zm - 11.5, .9, 1, .9, [.2, .18, .1]);
        Sp(Xm, 6.2, Zm - 11.3, .3, LAB);
        Po(Xm, Zm - 11.5, 5, dim(LAB, .06));
        P('box', Xm + 4.6, .4, Zm - 4, 1.6, .7, 4.5, [.08, .07, .05]);
        Bm([Xm + 3.2, 1.6, Zm - 3], [Xm + 4.4, .6, Zm - 2.2], .05, DARK);
        {
          const [lx, lz] = toLocal(Xm - 2.6, Zm - 3), [dx, dz] = dirL(-.96, -.28);
          Sp(Xm - 2.6, 7.1, Zm - 3, .5, [1.3, 1.25, 1.1]);
          P('cyl', Xm - 2.6, 4.5, Zm - 3, .15, 5, .15, [.2, .2, .2]);
          searchlight(lx, 7, lz, dx, dz, .95);
        }
        return { focus: [fx, fz], span: 280, face: dirL(-.96, .28) };
      },
    },

    // Puente Alterno Sur carries the southern highway across the estuary below the city. The highway brings the deck,
    // the piers and the traffic. The bridge adds an A-frame pylon with fans of lit stays and LED lamps on both edges.
    // Its toll plaza keeps the old block in town. North of it on the Daule bank, chained ship-flats hold a hulk
    // burning after a fight with river workers.

    gye_alterno: {
      at: [1032, 1454], label: 'Puente Alterno Sur', minSide: 24, reach: 300, labelY: 40,
      build(x, z, w, d, st, r) {
        const F = facing(x, z), sp = F.span(w, d), LED = [1.4, 1.32, 1.15];

        // The claimed block is the toll plaza, with a lit canopy over three booths.

        prop('box', x, .1, z, w, .2, d, [.05, .05, .055]);
        F.box(0, 0, 6, 8, .5, sp * .8, [.14, .14, .15]);
        F.lit(0, 0, 5.7, 7.6, .1, sp * .78, dim(LED, .5));
        for (let k = -1; k <= 1; k++) {
          F.box(0, k * sp * .25, 1.4, 3, 2.8, 2.2, [.12, .12, .13]);
          F.lit(1.55, k * sp * .25, 1.8, .1, 1, 1.8, [1.2, 1, .7]);
        }
        for (const s of [-1, 1]) F.box(0, s * sp * .4, 3, .5, 6, .5, [.15, .15, .16], 'cyl');
        if (!shore()) return;

        // The highway's straight span over the estuary, in world metres: z, the two banks and the deck top.
        // gen/gen.ts lays the highway on the same line.

        const ZB = 4400, X0 = 1130, X1 = 1600, XM = (X0 + X1) / 2, TOP = 26.3, EDGE = 8;
        const PIER = [.1, .1, .105], STAY = [.22, .26, .34], PT = 92;
        for (const s of [-1, 1]) Gl(XM, TOP + .3, ZB + s * (EDGE - .2), X1 - X0, .14, .14, dim(LED, .35));

        // An A-frame pylon at mid-span with uplit legs and a beacon. Fans of lit stays run to both deck edges.

        for (const s of [-1, 1]) {
          Bm([XM, 0, ZB + s * 17], [XM, PT, ZB + s * 1.6], 3.2, [.16, .16, .17]);
          Bm([XM + 1.7, 2, ZB + s * 16.8], [XM + 1.7, PT - 2, ZB + s * 1.9], .25, dim(LED, .3), 'glow');
        }
        P('box', XM, TOP - 4.5, ZB, 3, 2, 30, PIER);
        P('box', XM, PT + 1.5, ZB, 3.6, 3, 5, [.16, .16, .17]);
        { const [px, pz] = toLocal(XM, ZB); beacon(px, PT + 3.6, pz, r); }
        for (const s of [-1, 1]) for (let k = 0; k < 6; k++) {
          const y = PT - 4 - k * 2.2, zl = 17 - 15.4 * y / PT;
          for (const dir of [-1, 1]) Bm([XM, y, ZB + s * zl], [XM + dir * (24 + k * 22), TOP + .3, ZB + s * (EDGE - .4)], .22, STAY, 'glow');
        }

        // LED lamps line both edges and light the water below.

        for (let X = X0 + 14; X < X1 - 8; X += 24) for (const s of [-1, 1]) {
          P('cyl', X, TOP + 4.5, ZB + s * (EDGE + .3), .25, 9, .25, [.2, .2, .21]);
          P('box', X, TOP + 9, ZB + s * (EDGE - .5), .5, .25, 1.8, [.2, .2, .21]);
          Gl(X, TOP + 8.8, ZB + s * (EDGE - .6), .45, .12, 1.4, LED);
          if ((X - X0) % 48 < 24) Po(X, ZB + s * 17, 10, dim(LED, .05));
        }

        // A row of chained hulls with deck shacks lies off the Daule bank. The middle one burns.

        const SX = 1672, ships = [];
        for (let k = 0; k < 6; k++) {
          const Z = 3700 + k * 10, bb = banks(Z), hl = 15 + r() * 6;
          if (bb && SX + hl / 2 + 4 < bb[1]) ships.push([SX + (r() - .5) * 3, Z, hl, k === 3]);
        }
        const decks = [];
        ships.forEach(([X, Z, hl, burnt], k) => {
          P('box', X, 1.3, Z, hl, 2.6, 7.6, burnt ? [.022, .018, .016] : pick(r, HULL), 0, (r() - .5) * .04);
          Bm([X - hl / 2, 1.6, Z], [X - hl / 2 - 10, .15, Z], .14, DARK);
          if (k) { const [pX, pZ, phl] = ships[k - 1]; for (const e of [-.35, .35]) Bm([pX + phl * e, 1.8, pZ + 3.8], [X + hl * e, 1.8, Z - 3.8], .14, DARK); }
          if (burnt) return;
          const sw = hl * (.4 + .25 * r()), ox = (r() - .5) * (hl - sw) * .6, sh = 2.4 + r() * 1.6, scorched = ships[k + 1]?.[3] || ships[k - 1]?.[3];
          P('box', X + ox, 2.6 + sh / 2, Z, sw, sh, 5.6, scorched ? [.03, .025, .02] : dim(pick(r, JUNK), 1.3));
          P('box', X + ox, 2.7 + sh, Z, sw + .8, .12, 6.4, scorched ? [.03, .02, .015] : pick(r, TARP));
          if (!scorched) {
            for (const s of [-1, 1]) Gl(X + ox + s * sw * .2, 3.6, Z + s * 2.82, 1.2, .9, .1, dim([1.3, .7, .3], .5 + .4 * r()));
            decks.push([X + ox, 2.6 + sh, Z]);
          }
          Sp(X + hl * .45, 3.4, Z, .45, scorched ? [.5, .2, .05] : [1.4, .75, .3]);
          Po(X, Z, 8, [.06, .03, .01]);
        });
        for (let k = 0; k + 1 < decks.length; k++) laundry(decks[k], decks[k + 1], r);

        // The burning hulk has a charred cabin frame, a fallen roof and flames along the deck. Its smoke column
        // leans downwind, lit orange at its foot, and firelight falls on the water and the neighbouring hulls.

        const hot = ships.find(s => s[3]);
        if (hot) {
          const [X, Z, hl] = hot;
          for (let k = 0; k < 6; k++) P('box', X - hl * .3 + (k % 3) * hl * .3, 4, Z + (k < 3 ? -2.6 : 2.6), .35, 2.8 + r() * 1.5, .35, [.03, .025, .02], 0, (r() - .5) * .4);
          P('box', X + 1, 3.1, Z, hl * .6, .3, 6, [.03, .025, .02], .15, .35);
          for (let k = 0; k < 6; k++) Fl(X + (r() - .5) * hl * .8, 3 + r() * 3, Z + (r() - .5) * 5, 1 + r() * 1.4, dim(FIRE, .8 + .5 * r()), r);
          for (let k = 0; k < 3; k++) Fire(X + (r() - .5) * hl * .6, 2.9, Z + (r() - .5) * 4, r, 1.4);
          for (const s of [-1, 1]) Fl(X, 1.8, Z + s * 4.2, 1, dim(FIRE, .3), r);
          for (let k = 0; k < 9; k++) Pf(X + k * 2.2, 7 + k * 6.5, Z + k * 1.4, 3.5 + k * 1.3, k < 2 ? [.2, .08, .025] : dim(SMOG, 1.4 - k * .08));
          Po(X, Z, 24, [.3, .11, .025]);
          for (const s of [-1, 1]) Po(X, Z + s * 11, 12, [.15, .06, .015]);
          for (let k = 0; k < 6; k++) Sp(X + (r() - .5) * 22, .3, Z + (r() - .5) * 22, .25, dim(FIRE, .6));

          // A river workers' tug stands off with its searchlight on the fire.

          const Xt = 1692, Zt = 3792, [lx, lz] = toLocal(Xt, Zt - 1.5), dX = X - Xt, dZ = Z - Zt + 1.5, dist = Math.hypot(dX, dZ);
          P('box', Xt, .8, Zt, 4.2, 1.6, 11, [.12, .05, .03]);
          P('box', Xt, 2.8, Zt + 2, 3.2, 2.4, 3.6, [.14, .14, .13]);
          Gl(Xt, 3.1, Zt + .18, 2.6, .8, .1, [1.1, 1, .8]);
          Sp(Xt - 1.7, 4.4, Zt + 2, .25, [1.6, .1, .08]);
          Sp(Xt + 1.7, 4.4, Zt + 2, .25, [.1, 1.5, .4]);
          Sp(Xt, 4.7, Zt - 1.5, .5, [1.3, 1.25, 1.1]);
          const [ux, uz] = dirL(dX / dist, dZ / dist);
          searchlight(lx, 4.6, lz, ux, uz, Math.min(1.5, Math.atan(dist / 4.6)));
        }
        return { focus: toLocal(XM, ZB), span: 340, face: dirL(0, 1) };
      },
    },

    // Pocket harbours on the west bank in sight of El Puente. Alleys end at crumbling concrete moles round small
    // basins, packed with boats close enough to jump between. Laundry hangs between the decks. One basin holds an
    // old junk, the other a dinghy, and a rotting wooden dock runs out past the far wall.

    gye_darsenas: {
      at: [1022, 1412], minSide: 24, reach: 220,
      build(x, z, w, d, st, r) {

        // The claimed block is the alley head, a cracked quay plaza with carts, crates and a fire.

        prop('box', x, .15, z, w, .3, d, [.06, .055, .05]);
        for (let k = 0; k < 7; k++) prop('box', x + (r() - .5) * w * .8, .6, z + (r() - .5) * d * .8, 1.2 + r(), 1.2, 1.2 + r(), pick(r, JUNK), r() * 3);
        for (let k = 0; k < 2; k++) {
          const px = x + (r() - .5) * w * .5, pz = z + (r() - .5) * d * .5;
          prop('box', px, 1.5, pz, 2, 1.2, 1.4, pick(r, TARP));
          glow(px, 1.4, pz, 1.6, .6, 1.5, [1.2, .65, .25]);
          pool(px, pz, 4, [.1, .05, .02]);
        }
        fire(x, .8, z, r, 1);
        if (!shore()) return;
        let focus = null;
        for (const [Zc, kind] of [[3676, 0], [3716, 1]]) {
          const b = banks(Zc);
          if (!b) continue;
          const XB = b[0], DEP = 28, HW = 12;
          focus ??= toLocal(XB + 14, Zc + 20);

          // The moles run out from the bank in broken lengths of concrete, with rubble at the gaps.

          for (const s of [-1, 1]) {
            let X = XB - 3;
            while (X < XB + DEP) {
              const len = 5 + r() * 9, h = 1.2 + r() * .8;
              P('box', X + len / 2, h / 2, Zc + s * HW, len, h, 2.4 + r() * .6, dim(CONC, .8 + .5 * r()), (r() - .5) * .05, (r() - .5) * .06);
              X += len + (r() < .35 ? 1.5 + r() * 2 : .2);
              if (r() < .3) P('box', X - .8, .3, Zc + s * (HW + (r() - .5) * 3), 1.2 + r(), .8, 1.2 + r(), dim(CONC, .7), r() * 3, r());
            }
          }

          // A quay lip with steps and a lamp sits under the alley mouth. An outer wall leaves a gap for the mouth.

          P('box', XB - 2, .7, Zc, 5, 1.4, HW * 2, dim(CONC, .9));
          for (let k = 0; k < 4; k++) P('box', XB + .5 + k * .8, .9 - k * .25, Zc + HW * .5, .8, .3, 3, dim(CONC, .8));
          P('cyl', XB - 3, 2.5, Zc - HW * .6, .2, 5, .2, [.06, .06, .06]);
          Sp(XB - 3, 5.2, Zc - HW * .6, .5, TUNG);
          Po(XB - 1, Zc - HW * .6, 8, [.1, .06, .025]);
          P('box', XB + DEP + 1, .7, Zc - HW * .45, 2.2, 1.4, HW * 1.1, dim(CONC, .75), .04);

          // Boats pack in side by side, bows to the quay, with laundry from deck to deck.

          const decks = [];
          for (let Z = Zc - HW + 2.6; Z < Zc + HW - 2; Z += 3.3 + r() * .7) {
            if (kind && Math.abs(Z - Zc) < 4) continue;
            const len = 7 + r() * 6, wid = 2.4 + r() * .6, X = XB + 2 + len / 2 + r() * 3, col = pick(r, HULL);
            P('box', X, .55, Z, len, 1.1, wid, col, 0, (r() - .5) * .08);
            if (r() < .6) P('box', X - len * .15, 1.6, Z, len * .4, 1, wid * .8, r() < .5 ? dim(col, 1.6) : pick(r, TARP));
            if (r() < .45) { const rgb = r() < .8 ? [1.3, .7, .3] : [.9, 1, 1.1]; Sp(X + len * .3, 2.2, Z, .3, rgb); Po(X, Z, 4, dim(rgb, .05)); }
            decks.push([X + (r() - .5) * len * .4, 2.6, Z]);
          }
          for (let k = 0; k + 1 < decks.length; k++) if (r() < .55) laundry(decks[k], decks[k + 1], r);
          laundry([XB + 6, 2.8, Zc - HW], [XB + 8, 2.6, Zc + HW], r);

          if (!kind) {

            // A dinghy lies tied at the mouth.

            P('box', XB + DEP - 4, .3, Zc + HW * .7, 3.4, .6, 1.4, [.12, .1, .07], .4);
            Bm([XB + DEP - 5.5, .5, Zc + HW * .6], [XB + DEP, 1.2, Zc + HW], .05, DARK);
            continue;
          }

          // The junk has a high stern, a deck house, a red lantern and two masts with battened sails. One sail is torn.

          const XJ = XB + 14, JH = [.09, .05, .03];
          P('box', XJ, .9, Zc, 14, 1.8, 4.4, JH);
          P('box', XJ - 5.5, 2.4, Zc, 3.4, 1.6, 4.6, JH, 0, -.08);
          P('box', XJ + 1, 2.4, Zc, 5, 1.4, 3.6, [.07, .05, .04]);
          P('cyl', XJ + 2.5, 7.2, Zc, .3, 11, .3, WOOD);
          P('cyl', XJ - 2.5, 5.8, Zc, .25, 8, .25, WOOD);
          P('box', XJ + 1, 8, Zc, 4.4, 7, .08, [.16, .06, .035], .2);
          for (let k = 0; k < 4; k++) P('box', XJ + 1, 5 + k * 1.7, Zc + .06, 4.6, .12, .12, WOOD, .2);
          P('box', XJ - 3.6, 5.6, Zc, 2.4, 3.2, .08, [.13, .07, .04], .3, .2);
          P('box', XJ - 3.2, 3.9, Zc + .3, 1.2, 1.4, .06, [.13, .07, .04], .5, .9);
          Sp(XJ - 6.5, 4, Zc, .4, [1.5, .25, .12]);
          Po(XJ - 6, Zc, 6, [.12, .03, .01]);

          // The rotting dock past the far wall has gaps in its planks, one sagging run and a lamp at the end.

          const Zd = Zc + HW + 4.5;
          for (let X = XB + 1; X < XB + DEP + 14; X += 2.2) {
            for (const s of [-1, 1]) if (r() < .85) P('cyl', X, .7, Zd + s * 1.6, .35, 1.6 + r() * .6, .35, dim(WOOD, .8), 0, (r() - .5) * .2);
            if (r() < .78) P('box', X + 1.1, 1.5 + (r() - .5) * .25, Zd, 2.1, .18, 3.6, dim(WOOD, .7 + .5 * r()), (r() - .5) * .15, (r() - .5) * .15);
          }
          P('box', XB + DEP + 6, 1, Zd, 3.4, .18, 4, dim(WOOD, .6), Math.PI / 2, .3);
          P('cyl', XB + DEP + 13, 2.5, Zd + 1.5, .18, 3, .18, WOOD);
          Sp(XB + DEP + 13, 4.1, Zd + 1.5, .35, [1.3, .7, .3]);
          Po(XB + DEP + 13, Zd + 1.5, 6, [.09, .05, .02]);
        }
        return focus ? { focus, span: 120, face: dirL(1, 0) } : undefined;
      },
    },

    // The Old Port took in the raw materials that built New Angeles. 14K runs it now. A floodlit container yard
    // lies behind a gate with the red 14K mark. Three rusting quay cranes with red warning lights stand over a
    // freighter moored along the crumbling quay, with 14K launches beside it.

    gye_puerto: {
      at: [995, 1535], label: 'The Old Port', minSide: 36, reach: 300, labelY: 55,
      build(x, z, w, d, st, r) {
        const F = facing(x, z), RUST = [.2, .085, .04];
        const CONT = [[.3, .12, .08], [.1, .2, .3], [.25, .22, .1], [.12, .2, .12], [.22, .07, .05], [.14, .14, .15]];

        // The claimed block is the container yard, with paired rows of stacks between aisles.

        prop('box', x, .1, z, w, .2, d, [.045, .043, .04]);
        pool(x, z, Math.min(w, d) * .4, [.06, .06, .05]);
        const ax = w >= d, LL = Math.max(w, d) - 8, SS = Math.min(w, d) - 8;
        for (let q = -2; q <= 2; q++) for (let u = -LL / 2 + 7; u < LL / 2 - 6; u += 12.8) {
          if (r() < .15) continue;
          for (const dv of [0, 2.6]) for (let j = 1 + Math.floor(r() * 4); j > 0; j--) {
            const v = q * SS / 5.2 + dv;
            prop('box', ax ? x + u : x + v, -1.3 + j * 2.6, ax ? z + v : z + u, ax ? 12.2 : 2.5, 2.55, ax ? 2.5 : 12.2, pick(r, CONT));
          }
        }

        // Floodlight masts stand at the corners and stay under 18 m.

        for (const [sa, sb] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const px = x + sa * (w / 2 - 2), pz = z + sb * (d / 2 - 2);
          prop('cyl', px, 8, pz, .5, 16, .5, [.15, .15, .15]);
          prop('box', px, 16.2, pz, 2.4, .6, 2.4, [.12, .12, .12]);
          glow(px, 15.8, pz, 2.2, .2, 2.2, [1.5, 1.45, 1.3]);
          searchlight(px, 15.6, pz, -sa, -sb, .75);
        }

        // A gatehouse with the red 14K mark, a barrier and a fence guard the front.

        const sp = F.span(w, d), dp = F.deep(w, d);
        F.box(dp / 2 - 4, sp * .3, 2, 5, 4, 6, [.1, .1, .1]);
        F.lit(dp / 2 - 1.45, sp * .3, 2.2, .1, 1.2, 4, [1.2, .9, .5]);
        { const [px, pz] = F.at(dp / 2 - 1.3, sp * .3); textSign('14K', px, 5.4, pz, 5, 1.5, F.yaw, RED14); }
        F.box(dp / 2 - 1, 0, 1, .3, .3, sp * .4, [.6, .1, .08]);
        F.box(dp / 2 - .5, -sp * .3, 1.4, .3, 2.8, sp * .4, [.1, .1, .1]);
        const face = { face: [F.fr.x, F.fr.z] };
        if (!shore()) return face;

        // The quay frame runs along the bank. a points out over the water from the freighter's centre line,
        // b runs along the quay. All the waterside pieces are placed in it.

        const b1 = banks(4112), b2 = banks(4196);
        if (!b1 || !b2) return face;
        const psi = Math.atan2(b2[0] - b1[0], 4196 - 4112), cs = Math.cos(psi), sn = Math.sin(psi);
        const QX = (b1[0] + b2[0]) / 2, Xf = QX + 16 * cs, Zf = 4154 - 16 * sn;
        const Q = (a, b) => [Xf + a * cs + b * sn, Zf - a * sn + b * cs];
        const QP = (kind, a, y, b, sx, sy, sz, rgb, dy = 0, rx = 0) => { const [X, Z] = Q(a, b); P(kind, X, y, Z, sx, sy, sz, rgb, psi + dy, rx); };
        const QG = (a, y, b, sx, sy, sz, rgb) => { const [X, Z] = Q(a, b); Gl(X, y, Z, sx, sy, sz, rgb, psi); };
        const QS = (a, y, b, s, rgb) => { const [X, Z] = Q(a, b); Sp(X, y, Z, s, rgb); };
        const QB = (a, b, t, rgb, kind) => { const [ax2, az2] = Q(a[0], a[2]), [bx2, bz2] = Q(b[0], b[2]); Bm([ax2, a[1], az2], [bx2, b[1], bz2], t, rgb, kind); };
        const QPo = (a, b, rad, rgb) => { const [X, Z] = Q(a, b); Po(X, Z, rad, rgb); };

        // A crumbling quay apron carries bollards and sodium lamps.

        for (let b = -60; b < 60; b += 10) {
          QP('box', -24, .55, b + 5, 20, 1.1, 10.2, dim(CONC, .85 + .3 * r()), 0, (r() - .5) * .03);
          QP('cyl', -14.6, 1.5, b + 5, .6, .8, .6, [.08, .08, .08]);
          if (b % 20 === 0) { QP('cyl', -32, 4, b + 5, .25, 8, .25, [.12, .12, .12]); QS(-32, 8.2, b + 5, .55, SODIUM); QPo(-29, b + 5, 9, [.12, .06, .015]); }
        }

        // Each rusting quay crane reaches its boom out over the freighter on A-frame stays. A trolley hangs a
        // container, and red warning lights mark the apex, the boom tip and the back end.

        let mid = null;
        [-20, 2, 24].forEach((bc, i) => {
          for (const aL of [-32, -16]) {
            for (const s of [-1, 1]) QP('box', aL, 15, bc + s * 7, 1.4, 30, 1.4, RUST);
            QP('box', aL, 30, bc, 1.8, 1.6, 15.4, RUST);
            QB([aL, 2, bc - 7], [aL, 28, bc + 7], .5, RUST);
          }
          for (const s of [-1, 1]) { QP('box', -24, 30, bc + s * 7, 17.4, 1.6, 1.6, RUST); QP('box', -24, 6, bc + s * 7, 17.4, .9, .9, RUST); }
          QP('box', -27, 33.6, bc, 10, 5.6, 9, [.16, .07, .035]);
          for (const s of [-1, 1]) QP('box', -7.5, 37, bc + s * 1.6, 75, 2.2, .8, RUST);
          QP('box', -7.5, 36, bc, 75, .4, 3.6, [.12, .06, .03]);
          for (const s of [-1, 1]) {
            for (const aL of [-32, -16]) QB([aL, 30.8, bc + s * 6], [-26, 52, bc + s * 1.4], .8, RUST);
            QB([-26, 52, bc + s * 1.4], [28, 38, bc + s * 1.6], .3, STEEL);
            QB([-26, 52, bc + s * 1.4], [-43, 38, bc + s * 1.6], .3, STEEL);
          }
          const ta = -6 + r() * 26, ys = 14 + r() * 8;
          QP('box', ta, 35.4, bc, 4, 1.6, 4, [.14, .12, .08]);
          QB([ta, 34.6, bc], [ta, ys + 1.6, bc], .08, DARK);
          QP('box', ta, ys + 1.3, bc, 2.6, .5, 12.4, [.2, .16, .04]);
          QP('box', ta, ys - .3, bc, 2.5, 2.6, 12.2, pick(r, CONT));
          QG(ta, 34.4, bc, 2, .3, 2, [1.4, 1.3, 1.1]);
          QP('box', -41, 34.5, bc, 6, 4, 4.4, [.08, .08, .08]);
          { const [X, Z] = Q(-26, bc); Fl(X, 53, Z, .9, RED14, r); }
          QS(30, 38.3, bc, .9, RED14);
          QS(-45, 38.3, bc, .9, RED14);
          if (i !== 1) { const [X, Z] = Q(-21.9, bc); Txt('14K', X, 33.8, Z, 5, 1.6, psi + Math.PI / 2, RED14); }
          else mid = Q(-10, bc);
        });

        // The freighter has a rust-streaked hull with a red waterline, containers on deck and lit windows aft.
        // Its funnel carries a red band, and its superstructure carries the 14K mark.

        const HC = [.07, .035, .025];
        QP('box', 0, 3.5, -4, 20, 9, 74, HC);
        QP('box', 0, 3.5, 33, 14.1, 9, 14.1, HC, Math.PI / 4);
        QP('box', 0, .3, -4, 20.2, .6, 74.2, [.12, .03, .02]);
        for (let k = 0; k < 10; k++) { const s = k % 2 ? 1 : -1; QP('box', s * 10.06, 4.5 + r(), -38 + r() * 68, .1, 3 + r() * 3, .6, [.13, .05, .02]); }
        for (const b of [-18, -5, 8, 21]) for (const a of [-6.3, -3.7, -1.1, 1.5, 4.1, 6.7]) {
          if (r() < .2) continue;
          for (let j = 1 + Math.floor(r() * 2); j > 0; j--) QP('box', a, 6.7 + j * 2.6, b, 2.5, 2.55, 12.2, pick(r, CONT));
        }
        QP('box', 0, 16, -34, 17, 14, 11, [.16, .15, .13]);
        QP('box', 0, 24.2, -32, 21, 2.4, 6, [.14, .13, .12]);
        QG(0, 24.3, -28.95, 19, .9, .1, [1.2, 1.05, .75]);
        for (const y of [12, 15, 21]) QG(0, y, -28.45, 15, .5, .1, dim(TUNG, .3 + .4 * r()));
        { const [X, Z] = Q(0, -28.4); Txt('14K', X, 17.6, Z, 8, 2.4, psi, RED14); }
        QP('cyl', 0, 27, -38, 4, 6, 5, [.1, .09, .08]);
        QG(0, 28.5, -38, 4.2, .8, 5.2, RED14);
        QP('cyl', 0, 13, 28, .4, 8, .4, STEEL);
        QS(0, 17.3, 28, .4, [1.3, 1.3, 1.2]);
        for (let b = -24; b <= 30; b += 12) for (const s of [-1, 1]) { QS(s * 9.6, 10.2, b, .35, SODIUM); QPo(s * 13, b, 7, [.1, .05, .015]); }
        QB([-10, 9, -10], [-15, 1.2, -5], .6, STEEL);
        QB([-10, 9.4, -10], [-15, 1.6, -5], .12, dim(SODIUM, .5), 'glow');
        for (const [ba, bq] of [[-38, -46], [-30, -24], [26, 20], [36, 44]]) QB([-10, 9, ba], [-14.6, 1.6, bq], .1, DARK);
        for (let k = 0; k < 5; k++) QP('cyl', -10.4, 2, -30 + k * 14, 1.2, 2.4, 1.2, DARK);

        // 14K launches wait on the seaward side, and one comes in from the bay.

        for (const [a, b, dy] of [[17, -6, 0], [16, 12, .1], [36, 30, .5]]) {
          QP('box', a, .6, b, 3, 1.1, 9, [.05, .05, .06], dy);
          QP('box', a, 1.6, b - 1, 2.2, 1, 3, [.08, .08, .09], dy);
          QS(a, 2.4, b + 3.5, .3, [1.4, 1.35, 1.2]);
          QS(a, 2.6, b - 3.5, .35, RED14);
          QPo(a, b, 6, [.12, .02, .015]);
        }
        return { focus: toLocal(...(mid ?? Q(-10, 2))), span: 220, face: dirL(cs, -sn) };
      },
    },
  };
}
