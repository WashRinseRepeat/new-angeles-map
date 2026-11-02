// Guayaquil sights in Nuevo Guayaquil. guayaquil.js spreads these into its landmarks and passes its shared tools as G.

export function sights(G) {
  const { H, T, facing, W2, dim, pick, NOK, PAL } = G;
  const { SKINS, FACES, GLOWS, bld, glow, prop, put, pool, roof, beacon, holo, textSign, flickerGlow, stringLights, helipad } = H;
  const { NSIGNS, GOLD, LED, FOAM, WORDS_N } = PAL;

  // Maglev lines in world metres: the Guayaquil Loop and the Guayaquil Line. Anything above 18 m keeps clear of them.

  const LOOP = [[958, 1490], [985, 1555], [1060, 1574], [1140, 1566], [1192, 1538], [1220, 1470], [1218, 1390], [1198, 1310],
    [1155, 1252], [1095, 1232], [1030, 1245], [975, 1275], [940, 1320], [928, 1380], [935, 1440]].map(W2);
  const LINES = [[...LOOP, LOOP[0]], [[760, 1250], [860, 1320], [928, 1380]].map(W2)];
  const CLEAR = 34;
  const gap = (X, Z) => {
    let best = Infinity;
    for (const L of LINES) for (let i = 1; i < L.length; i++) {
      const [ax, az] = L[i - 1], [bx, bz] = L[i], dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((X - ax) * dx + (Z - az) * dz) / (dx * dx + dz * dz)));
      best = Math.min(best, Math.hypot(X - ax - t * dx, Z - az - t * dz));
    }
    return best;
  };

  // A square footprint of half-size R round local (x, z). It moves away from the maglev and shrinks until its
  // corners keep CLEAR metres from the track.

  const settle = (x, z, R) => {
    const [X, Z] = T.toWorld(x, z), g = gap(X, Z), need = CLEAR + R * Math.SQRT2 - g;
    if (need <= 0) return { x, z, R };
    const gx = gap(X + 4, Z) - gap(X - 4, Z), gz = gap(X, Z + 4) - gap(X, Z - 4), gl = Math.hypot(gx, gz) || 1;
    const [ox, oz] = T.toLocal(X + gx / gl, Z + gz / gl), s = Math.min(need, R * .3);
    return { x: x + (ox - x) * s, z: z + (oz - z) * s, R: Math.max(R * .45, Math.min(R - s, (g + s - CLEAR) / Math.SQRT2)) };
  };

  // Inhabited sky bridge from local a to b at height y. Office floors sit over a lit shop deck on both faces.
  // A fascia strip, small shop signs, a lit soffit and a roof terrace with railing lamps and trees complete it.

  const SHOPS = [[1.4, .85, .45], [1.5, .3, .6], [1.2, .25, 1.3], [1.5, .8, .2], [.4, 1.1, 1.3], [1.3, 1.1, .8]];
  const SHOPWORDS = ['FARMACIA', 'CAFÉ', 'SALÓN', 'KARAOKE', 'CEVICHE', 'BAR', 'MASAJES', 'HOTEL', '茶', '麵', '藥', '酒'];
  const span = (a, b, y, bw, bh, S, r, o = {}) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, yaw = Math.atan2(dx, dz) || NOK;
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, nx = uz, nz = -ux, accent = o.accent ?? pick(r, NSIGNS);
    bld(mx, mz, bw, L, bh, { ...S, lit: o.lit ?? .65 + .2 * r(), win: o.win ?? [1, .84, .58] }, r,
      { y0: y, roof: false, skin: o.skin ?? (r() < .5 ? SKINS.curtain : SKINS.bands), ry: yaw });
    glow(mx, y - .3, mz, bw * .92, .25, L * .95, dim(accent, .5), yaw);
    prop('box', mx, y + bh + .3, mz, bw * .9, .6, L * .9, [.02, .06, .03], yaw);
    for (let g = 2 + Math.floor(r() * 3); g > 0; g--) {
      const t = (r() - .5) * L * .7, s = (r() - .5) * bw * .5;
      prop('cone', mx + ux * t + nx * s, y + bh + 2.2, mz + uz * t + nz * s, 2.4, 3.6, 2.4, [.02, .07, .03]);
    }
    for (const s of [-1, 1]) {
      const ox = nx * s * (bw / 2 + .06), oz = nz * s * (bw / 2 + .06), sry = Math.atan2(nx * s, nz * s);
      glow(mx + ox, y + 5.2, mz + oz, .1, .3, L * .96, dim(accent, .7), yaw);
      let signs = 0;
      for (let t = -L / 2 + 5; t < L / 2 - 4; t += 6.5) {
        const px = mx + ox + ux * t, pz = mz + oz + uz * t;
        glow(px, y + 2.4, pz, .1, 3.2, 5, dim(pick(r, SHOPS), .45 + .4 * r()), yaw);
        if (signs < 3 && r() < .3) { signs++; textSign(pick(r, SHOPWORDS), px + nx * s * .1, y + 6.6, pz + nz * s * .1, 4.4, 1.1, sry, dim(pick(r, NSIGNS), .9)); }
      }
      for (let t = -L / 2 + 4; t < L / 2; t += 9) {
        put(GLOWS.sphere, mx + nx * s * (bw * .43) + ux * t, y + bh + 1.4, mz + nz * s * (bw * .43) + uz * t, .5, .5, .5, 0, 0, [1.4, 1.05, .7]);
      }
      const nw = Math.min(L * .6, 44), off = bw / 2 + .35;
      if (o.name) textSign(o.name, mx + nx * s * off, y + bh * .62, mz + nz * s * off, nw, nw / 5.5, sry, o.nameRgb ?? dim(GOLD, .9));
      if (o.sub) textSign(o.sub, mx + nx * s * off, y + bh * .25, mz + nz * s * off, nw * .3, nw * .3 / 4, sry, dim(NSIGNS[0], .9));
    }
    return { mx, mz, L, ux, uz, nx, nz, yaw };
  };

  // Sealed Nuevo plinth: blank hardfoam, LED walkway lines and a lit name at the old street door.

  const plinth = (F, R, ph, S, r, name) => {
    const [px, pz] = F.at(0, 0);
    bld(px, pz, R * 2, R * 2, ph, { ...S, base: FOAM, lit: 0, grime: .3 }, r, { roof: false, skin: SKINS.sparse, ry: NOK });
    F.lit(0, 0, ph + .15, R * 1.9, .1, .7, dim(LED, .8));
    F.lit(0, 0, ph + .15, .7, .1, R * 1.9, dim(LED, .8));
    const [sx, sz] = F.at(R + .35, 0), sw = Math.min(R * .8, 34);
    textSign(name, sx, ph * .55, sz, sw, sw / 5.5, F.yaw, dim(GOLD, .8));
    F.lit(R + .1, 0, 2, .1, 4, 6, [1.2, 1, .7]);
    { const [qx, qz] = F.at(R + 5, 0); pool(qx, qz, 10, [.1, .08, .05]); }
    holo(px, pz, R * 2, R * 2, ph + 9, r, undefined, 18);
  };

  return {
    // Nido de Aquila: three layered towers knit together by fat inhabited sky bridges at five heights. The Eagle's
    // Nest is the highest span, with the name and a gold eagle on its roof.

    gye_nido: {
      at: [900, 1462], label: 'Nido de Aquila', minSide: 60, reach: 360, labelY: 420,
      build(x, z, w, d, st, r) {
        const S = T.ctx(x, z, st, .8).st, q = settle(x, z, Math.min(w, d, 132) / 2 - 2), R = q.R;
        const F = facing(q.x, q.z), { at, fr } = F, ph = 12, tw = R * .46;
        plinth(F, R, ph, S, r, 'NIDO DE AQUILA');

        // Two tall towers at the back and a lower one at the front.

        const [A, B, C] = [[-.42, -.5, 400], [-.38, .52, 470], [.4, .04, 260]].map(([a, b, h]) => {
          const [px, pz] = at(a * R, b * R), t = T.layered(px, pz, tw, tw * (.9 + .2 * r()), h + 60 * r(), S, r, { y0: ph, layers: 4 });
          roof(t.x, t.z, t.w, t.d, t.y, S, r);
          beacon(t.x, t.y + 2, t.z, r);
          for (let k = 0; k < 2; k++) T.word(px, pz, tw, tw, ph + 20 + r() * 60, Math.floor(r() * 4), pick(r, WORDS_N), dim(pick(r, NSIGNS), .8), 1.3);
          return { p: [px, pz], top: t.y };
        });
        const link = (P, Q, y, bh, o = {}) => (y + bh + 15 < Math.min(P.top, Q.top) ? span(P.p, Q.p, y, o.bw ?? tw * (.7 + .2 * r()), bh, S, r, o) : null);
        link(A, B, 110, 20); link(A, B, 235, 18);
        link(B, C, 85, 16); link(B, C, 185, 22);
        link(A, C, 150, 18);
        for (const [P, Q, y] of [[A, C, 60], [B, C, 135], [A, B, 175]]) H.beam([P.p[0], y, P.p[1]], [Q.p[0], y, Q.p[1]], 1.1, dim(LED, .55), 'glow');

        // The Eagle's Nest: the top span, its name on both faces and a gold eagle with spread wings on the roof.

        const NY = Math.min(A.top, B.top) - 75;
        const n = link(A, B, NY, 30, { bw: tw * .95, name: 'NIDO DE AQUILA', sub: '鷹巢', nameRgb: dim(GOLD, 1.1), lit: .85 });
        if (n) {
          const Y = NY + 31, P = (t, up) => [n.mx + n.ux * t, Y + up, n.mz + n.uz * t], E = dim(GOLD, 1.2);
          const wy = f => (f < .2 ? 6 + 35 * f : 13 + 38.9 * (f - .2));
          for (const s of [-1, 1]) {
            H.beam(P(0, 6), P(s * n.L * .2, 13), .9, E, 'glow');
            H.beam(P(s * n.L * .2, 13), P(s * n.L * .38, 20), .8, E, 'glow');
            for (const f of [.24, .31, .38]) H.beam(P(s * n.L * f, wy(f)), P(s * n.L * (f - .05), wy(f) - 6), .5, E, 'glow');
            prop('lattice', n.mx + n.ux * s * n.L * .2, Y + 6, n.mz + n.uz * s * n.L * .2, 1.2, 12, 1.2, [.5, .4, .25]);
          }
          put(GLOWS.sphere, n.mx, Y + 9, n.mz, 2.2, 2.6, 2.2, 0, 0, E);
          prop('cone', n.mx + n.nx * 1.8, Y + 8.6, n.mz + n.nz * 1.8, .9, 2, .9, E, n.yaw + Math.PI / 2, Math.PI / 2);
        }
        return { face: [fr.x, fr.z] };
      },
    },

    // La Mano del Cielo: a hub tower with a round palm deck. Four finger spans and a lower thumb fan out from it,
    // each in three stepped phalanges with lit knuckles, and end in slim towers. From above it reads as an open hand.

    gye_mano: {
      at: [990, 1425], label: 'La Mano del Cielo', minSide: 60, reach: 360, labelY: 300,
      build(x, z, w, d, st, r) {
        const S = T.ctx(x, z, st, .8).st, q = settle(x, z, Math.min(w, d, 132) / 2 - 2), R = q.R;
        const F = facing(q.x, q.z), { at, fr } = F, ph = 10, PINK = [1.6, .35, .8];
        plinth(F, R, ph, S, r, 'LA MANO DEL CIELO');

        // Hub tower in three tapering octagonal sections, a lit crown and the name on its front.

        const ha = -.45 * R, hw = .34 * R, [hx, hz] = at(ha, 0), TOPH = 300 + 40 * r(), P = 150 + 20 * r();
        for (let k = 0; k < 3; k++) {
          const y0 = ph + k * (TOPH - ph) / 3;
          bld(hx, hz, hw * (1 - .1 * k), hw * (1 - .1 * k), (TOPH - ph) / 3, { ...S, lit: .4 }, r, { y0, roof: false, shape: 'oct', skin: k % 2 ? SKINS.bands : SKINS.grid });
          put(GLOWS.ring, hx, y0 + (TOPH - ph) / 3, hz, hw * 1.15, 1, hw * 1.15, 0, 0, dim(GOLD, .6));
        }
        prop('cyl', hx, TOPH + 15, hz, 1.2, 30, 1.2, [.18, .18, .19]);
        put(GLOWS.sphere, hx, TOPH + 31, hz, 2, 2, 2, 0, 0, dim(PINK, 1.2));
        beacon(hx, TOPH + 2, hz, r);
        { const [px, pz] = at(ha + hw * .5 + .4, 0), [bx, bz] = at(ha - hw * .5 - .4, 0); textSign('LA MANO DEL CIELO', px, P + 34, pz, hw * .95, hw * .95 / 5.5, F.yaw, dim(GOLD, 1.1)); textSign('天之手', bx, P + 34, bz, hw * .6, hw * .6 / 4, F.yaw + Math.PI, dim(PINK, .9)); }

        // The palm: a round deck of shops and offices round the hub, ringed in gold and pink, with a garden on top.

        const pw = .82 * R;
        bld(hx, hz, pw, pw, 18, { ...S, lit: .85, win: [1, .84, .58] }, r, { y0: P - 9, roof: false, shape: 'cyl', skin: SKINS.curtain });
        put(GLOWS.ring, hx, P - 9.2, hz, pw * 1.02, 1, pw * 1.02, 0, 0, dim(GOLD, .9));
        put(GLOWS.ring, hx, P + 9.2, hz, pw * 1.02, 1, pw * 1.02, 0, 0, dim(PINK, .8));
        prop('cyl', hx, P + 9.3, hz, pw * .96, .4, pw * .96, [.02, .06, .03]);
        for (let k = 0; k < 10; k++) {
          const a = k / 10 * Math.PI * 2, rr = pw * (.32 + .1 * (k % 2));
          prop('cone', hx + Math.cos(a) * rr, P + 11.6, hz + Math.sin(a) * rr, 2.4, 3.6, 2.4, [.02, .07, .03]);
          put(GLOWS.sphere, hx + Math.cos(a) * pw * .47, P + 10.6, hz + Math.sin(a) * pw * .47, .5, .5, .5, 0, 0, [1.4, 1.05, .7]);
        }

        // Thumb and four fingers: angle off the front, reach in R and rise from palm to tip.

        for (const [deg, len, rise] of [[-78, .6, -30], [-34, .95, 20], [-10, 1.08, 34], [14, 1, 24], [38, .8, 12]]) {
          const th = deg * Math.PI / 180, ca = Math.cos(th), cb = Math.sin(th), L0 = hw * .45, L1 = len * R;
          const pt = f => at(ha + ca * (L0 + (L1 - L0) * f), cb * (L0 + (L1 - L0) * f));
          const cuts = [0, .42, .74, 1], bws = [.2, .17, .14].map(v => v * R), bhs = [16, 13, 11];
          const ys = [0, 1, 2].map(k => P - 6 + rise * k / 2);
          for (let k = 0; k < 3; k++) {
            span(pt(cuts[k]), pt(cuts[k + 1]), ys[k], bws[k], bhs[k], S, r, { accent: k % 2 ? PINK : GOLD, lit: .7 + .15 * r() });
            if (k) {
              const [jx, jz] = pt(cuts[k]), lo = Math.min(ys[k - 1], ys[k]) - 2, hi = Math.max(ys[k - 1] + bhs[k - 1], ys[k] + bhs[k]) + 2, kw = bws[k - 1] * 1.15;
              bld(jx, jz, kw, kw, hi - lo, { ...S, lit: .9, win: [1.1, .9, .7] }, r, { y0: lo, roof: false, shape: 'oct', skin: SKINS.curtain });
              put(GLOWS.ring, jx, (lo + hi) / 2, jz, kw * 1.35, 1, kw * 1.35, 0, 0, dim(GOLD, .9));
            }
          }

          // Fingertip tower with a pink nail ring where the finger meets it.

          const [tx, tz] = pt(1), tw = .19 * R, top = ys[2] + bhs[2] + 40 + 60 * r();
          const t = T.layered(tx, tz, tw, tw, top - ph, S, r, { y0: ph, layers: 3 });
          roof(t.x, t.z, t.w, t.d, t.y, S, r);
          beacon(t.x, t.y + 2, t.z, r);
          put(GLOWS.ring, tx, ys[2] + bhs[2] + 1.5, tz, tw * 1.5, 1, tw * 1.5, 0, 0, dim(PINK, 1.1));
          T.word(tx, tz, tw, tw, ph + 18 + r() * 40, Math.floor(r() * 4), pick(r, WORDS_N), dim(pick(r, NSIGNS), .8), 1.1);
        }
        return { face: [fr.x, fr.z] };
      },
    },

    // Hospital Alcívar: a clean white block in the rot. A glass podium with a covered emergency drop-off, a
    // cross-plan ward tower with a rooftop air-ambulance pad, a clinic wing on a glass bridge and a guarded gate.

    gye_alcivar: {
      at: [888, 1556], label: 'Hospital Alcívar', minSide: 50, reach: 320, labelY: 175,
      build(x, z, w, d, st, r) {
        const F = facing(x, z), { at, sz, yaw, fr } = F;
        const SP = Math.min(F.span(w, d), 124) - 6, DP = Math.min(F.deep(w, d), 124) - 10;
        const COOL = [.85, 1.15, 1.4], CROSS = [.4, 1.5, 1.1], RED = [1.7, .12, .1], BLUE = [.2, .4, 1.8], PALE = [.3, .31, .33];
        const WH = { ...st, base: [.3, .31, .34], win: [.72, .88, 1.05], lit: .75, grime: 0, w: 1, neon: 0 };

        // Glass podium with a cool lobby glow, a lit cornice and the name.

        const aF = DP / 2 - 12, aB = -DP / 2, pd = aF - aB, pa = (aF + aB) / 2, PS = SP * .92;
        bld(...at(pa, 0), ...sz(pd, PS), 18, { ...WH, lit: .85 }, r, { roof: false, skin: SKINS.curtain, ry: NOK });
        F.box(pa, 0, 18.3, pd + .6, .6, PS + .6, PALE);
        F.lit(pa, 0, 17.6, pd + .3, .4, PS + .3, dim(COOL, .6));
        F.lit(aF + .06, 0, 8, .1, 13, PS * .9, dim(COOL, .18));
        { const [px, pz] = at(aF + .3, PS * .2), tw = Math.min(SP * .4, 36); textSign('HOSPITAL ALCÍVAR', px, 13.5, pz, tw, tw / 6, yaw, [1.3, 1.45, 1.6]); }

        // Cross-plan ward tower, a taller core and the air-ambulance pad.

        const tA = pa - pd * .1, tB = -SP * .12, TH = 110 + 20 * r(), WA = SP * .5;
        bld(...at(tA, tB), ...sz(16, WA), TH, WH, r, { y0: 18, roof: false, skin: SKINS.curtain, ry: NOK });
        bld(...at(tA, tB), ...sz(pd * .55, 16), TH, { ...WH, lit: .7 }, r, { y0: 18, roof: false, skin: SKINS.grid, ry: NOK });
        bld(...at(tA, tB), 20, 20, TH + 8, { ...WH, lit: .5 }, r, { y0: 18, roof: false, skin: SKINS.fins, ry: NOK });
        F.box(tA, tB, 18 + TH + .3, 17, .6, WA + 1, PALE);
        F.box(tA, tB, 18 + TH + .3, pd * .55 + 1, .6, 17, PALE);
        F.lit(tA, tB, 18 + TH - .6, 16.3, .4, WA + .3, dim(COOL, .7));
        const PY = 18 + TH + 8, [cx, cz] = at(tA, tB);
        helipad(cx, cz, 24, PY, r);
        put(GLOWS.ring, cx, PY + 1.3, cz, 26, 1, 26, 0, 0, [1.2, 1.3, 1.4]);
        for (const s of [-1, 1]) { const [bx, bz] = at(tA, tB + s * (WA / 2 - 1)); beacon(bx, 18 + TH + 1, bz, r); }

        // A parked air ambulance on the pad: a white body, four duct fans and red and blue light bars.

        {
          const [ax, az] = at(tA - 2, tB + 2);
          F.box(tA - 2, tB + 2, PY + 2.4, 7, 2.6, 2.6, [.55, .55, .58]);
          F.box(tA - 2, tB + 2, PY + 4.1, 4, 1, 1.8, [.5, .5, .53]);
          for (const [sa, sb] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const [dx, dz] = at(tA - 2 + sa * 3.6, tB + 2 + sb * 2.4); prop('cyl', dx, PY + 2.4, dz, 2, .6, 2, [.2, .2, .22]); }
          flickerGlow(ax, PY + 4.8, az, .5, .3, .5, RED, r);
          { const [bx, bz] = at(tA - 3, tB + 2); flickerGlow(bx, PY + 4.8, bz, .5, .3, .5, BLUE, r); }
        }

        // Medical crosses on the tower front and the clinic wing.

        const cross = (a, b, y, s) => { F.lit(a, b, y, .1, s, s * .3, CROSS); F.lit(a, b, y, .1, s * .3, s, CROSS); };
        const tF = tA + pd * .275;
        cross(tF + .1, tB, 18 + TH - 14, 12);
        { const [px, pz] = at(tF + .3, tB); textSign('ALCÍVAR', px, 18 + TH - 30, pz, 14, 2.8, yaw, [1.3, 1.45, 1.6]); }

        // Clinic wing on a glass bridge to the ward tower.

        const wa = pa - pd * .15, wb = SP * .33, WTH = 64 + 16 * r();
        bld(...at(wa, wb), ...sz(18, 22), WTH, { ...WH, lit: .8 }, r, { y0: 18, roof: false, skin: SKINS.grid, ry: NOK });
        F.box(wa, wb, 18 + WTH + .3, 19, .6, 23, PALE);
        cross(wa + 9.1, wb, 18 + WTH - 10, 8);
        {
          const [ax, az] = at(tA, tB + WA * .45), [bx, bz] = at(wa, wb - 11), dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), ry = Math.atan2(dx, dz) || NOK;
          if (L > 2) {
            bld((ax + bx) / 2, (az + bz) / 2, 7, L, 6, { ...WH, lit: 1, win: [.8, .95, 1.15] }, r, { y0: 52, roof: false, skin: SKINS.curtain, ry });
            glow((ax + bx) / 2, 51.7, (az + bz) / 2, 6.4, .2, L * .95, dim(COOL, .8), ry);
          }
        }

        // Covered emergency drop-off: a lit canopy on four columns, two ambulances, a kerb line and the red sign.

        const bC = -SP * .24, CL = Math.min(28, SP * .4);
        F.box(aF + 5, bC, 7.2, 10, .5, CL, PALE);
        F.lit(aF + 5, bC, 6.9, 9.2, .1, CL - 1, dim(COOL, .85));
        for (const s of [-1, 1]) F.box(aF + 9.5, bC + s * (CL / 2 - 1), 3.5, .5, 7, .5, PALE, 'cyl');
        F.lit(aF + 10.3, bC, 7.6, .1, .8, CL * .9, dim(COOL, .9));
        { const [px, pz] = at(aF + 10.4, bC), tw = Math.min(CL * .6, 14); textSign('EMERGENCIA', px, 8.6, pz, tw, tw / 6, yaw, RED); }
        for (const k of [-1, 1]) {
          const b = bC + k * CL * .22, [px, pz] = at(aF + 5, b), [lx, lz] = at(aF + 5, b + .5);
          F.box(aF + 5, b, 1.3, 6, 2.4, 2.4, [.55, .55, .58]);
          flickerGlow(px, 2.7, pz, .4, .25, .4, RED, r);
          flickerGlow(lx, 2.7, lz, .4, .25, .4, BLUE, r);
          pool(px, pz, 8, [.1, .13, .16]);
        }
        F.lit(aF + 10.8, bC, .15, .3, .1, CL + 4, dim(COOL, .7));

        // Forecourt: planters with trees, LED bollards, cool light pools and a guard booth at the drive.

        for (let k = 0; k < 5; k++) {
          const b = SP * (.05 + k * .09), [px, pz] = at(DP / 2 - 2, b);
          prop('cyl', px, .5, pz, 2.4, 1, 2.4, PALE);
          prop('cyl', px, 2.2, pz, .3, 2.6, .3, [.08, .05, .03]);
          prop('cone', px, 4.6, pz, 3.4, 4, 3.4, [.03, .1, .05]);
          const [lx, lz] = at(DP / 2 + 1, b + SP * .045);
          glow(lx, .5, lz, .3, 1, .3, COOL);
          pool(lx, lz, 5, [.06, .08, .1]);
        }
        {
          F.box(DP / 2 + 2, bC - CL / 2 - 4, 1.6, 3, 3.2, 3, PALE);
          F.lit(DP / 2 + 2, bC - CL / 2 - 4, 1.9, 3.1, 1.2, 3.1, [1.1, 1.2, 1.3]);
          F.box(DP / 2 + 2, bC - CL / 2 + 1, 1, .2, .2, 6, [1, .9, .2]);
        }

        // Healing garden on the podium roof beside the tower.

        for (let k = 0; k < 8; k++) {
          const [px, pz] = at(pa + (r() - .5) * pd * .5, SP * (.14 + .08 * r()));
          prop('cone', px, 21, pz, 2.6, 4, 2.6, [.03, .1, .05]);
          put(GLOWS.sphere, px + 2, 19.2, pz, .4, .4, .4, 0, 0, [1.2, 1.15, 1]);
        }
        return { face: [fr.x, fr.z] };
      },
    },
  };
}
