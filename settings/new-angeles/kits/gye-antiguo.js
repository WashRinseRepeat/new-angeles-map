// Guayaquil sights in Antiguo Guayaquil and Beyond the Daule. guayaquil.js spreads these into its landmarks and passes its shared tools as G.

export function sights(G) {
  const { H, T, facing, W2, dim, pick, NOK, PAL } = G;
  const { THREE, SKINS, FACES, GLOWS, bld, glow, prop, put, puff, pool, roof, textSign, flickerGlow, stringLights, panel, canvasTexture, lerp } = H;
  const { FIRE, TUNG, SMOG, CONC, JUNK, TARP, PASTEL, WOOD } = PAL;
  const { fire, facePatch } = T;

  // The Guayaquil Loop and the Guayaquil Line in world metres. Tall pieces keep 30 m off both tracks.

  const LOOP = [[958, 1490], [985, 1555], [1060, 1574], [1140, 1566], [1192, 1538], [1220, 1470], [1218, 1390], [1198, 1310],
    [1155, 1252], [1095, 1232], [1030, 1245], [975, 1275], [940, 1320], [928, 1380], [935, 1440], [958, 1490]].map(W2);
  const LINE = [[760, 1250], [860, 1320], [928, 1380]].map(W2);
  const lineGap = (X, Z, p) => {
    let m = Infinity;
    for (let i = 0; i + 1 < p.length; i++) {
      const [ax, az] = p[i], [bx, bz] = p[i + 1], dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((X - ax) * dx + (Z - az) * dz) / (dx * dx + dz * dz)));
      m = Math.min(m, Math.hypot(X - ax - t * dx, Z - az - t * dz));
    }
    return m;
  };

  // Height for a piece of radius rad at local (lx, lz). Near a track it stays under 18 m.

  const capH = (lx, lz, rad, h) => {
    const [X, Z] = T.toWorld(lx, lz);
    return Math.min(lineGap(X, Z, LOOP), lineGap(X, Z, LINE)) - rad < 32 ? Math.min(h, 17) : h;
  };
  const mix = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));

  // Moving parts. Each lives in its landmark's group, because shared instances freeze into tiles after the build.

  const PEN = {}, XIM = { legs: [] }, _o = new THREE.Object3D();

  return {
    // Barrio Las Peñas: pastel colonial houses on hill terraces, restored once and now fading. A lamp-lit
    // stair street climbs the middle to a small chapel and a striped lighthouse whose beam turns slowly.

    gye_penas: {
      at: [1012, 1288], label: 'Barrio Las Peñas', minSide: 50, reach: 300, labelY: 52,
      build(x, z, w, d, st, r) {
        const F = facing(x, z), { at, sz, yaw, fr } = F;
        const SP = Math.min(F.span(w, d), 100), DP = Math.min(F.deep(w, d), 100);
        const S = T.tone(st, .1, 1), ROCK = [.06, .05, .04], STONE = [.12, .11, .095], TILE = [.17, .065, .04];
        const LAMP = [1.5, .95, .5], FEST = [[1.4, .3, .3], [1.4, 1, .3], [.3, 1, 1.3], [1.4, .6, 1.1]];
        const rows = Math.max(4, Math.min(7, Math.floor(DP / 11))), rd = DP / rows, RISE = 3.4, WS = 4.4;
        const aOf = k => DP / 2 - (k + .5) * rd, top = rows - 1, CB = -SP * .27, LB = SP * .28;
        const ridge = (a, b, y, len, wid, rgb, alongA) => {
          const [px, pz] = at(a, b), s = wid / Math.SQRT2;
          prop('box', px, y, pz, len, s, s, rgb, alongA ? Math.atan2(-fr.z, fr.x) : Math.atan2(-fr.x, -fr.z), Math.PI / 4);
        };
        const lamps = [];
        for (let k = 0; k < rows; k++) {
          const a = aOf(k), y0 = k * RISE;

          // Terrace with a stone parapet on its front edge, open where the stair comes up.

          if (k) {
            F.box(a, 0, y0 / 2, rd, y0, SP, ROCK);
            for (const s of [-1, 1]) F.box(a + rd / 2 - .2, s * (SP / 4 + WS / 4), y0 + .45, .4, .9, SP / 2 - WS / 2, STONE);
            const n = Math.round(k * 444 / top), [nx, nz] = at(a + rd / 2 + .08, WS / 2 + 1.4);
            textSign(String(n), nx, y0 - .9, nz, 1.3, .45, yaw, [1.1, .85, .5]);
          }

          // Houses on both sides of the stair. A quarter have faded to grey and some stand empty.

          for (let b = -SP / 2 + .5; b < SP / 2 - 3.5;) {
            const hw = 4.2 + r() * 2.8, m = b + hw / 2;
            b += hw;
            if (Math.abs(m) - hw / 2 < WS / 2 + 1) continue;
            if (k === top && (Math.abs(m - CB) < 9 || Math.abs(m - LB) < 6)) continue;
            const hh = 5 + r() * 2.6, hd = rd * (.6 + .12 * r()), ha = a + (rd - hd) / 2 - .7;
            const faded = r() < .25, base = faded ? mix(pick(r, PASTEL), [.15, .15, .14], .6) : pick(r, PASTEL), live = r() < .72;
            const [px, pz] = at(ha, m), [hx, hz] = sz(hd, hw - .3);
            bld(px, pz, hx, hz, hh, { ...S, base, win: [1, .72, .42], lit: live ? .45 + .2 * r() : .03, grime: faded ? .75 : .35 }, r, { y0, roof: false, skin: SKINS.grid, ry: NOK });
            bld(px, pz, hx + .5, hz + .5, 1.8, { ...S, base: TILE, lit: 0 }, r, { y0: y0 + hh, shape: 'pyr', roof: false });
            const fa = ha + hd / 2;
            if (r() < .65) {
              F.box(fa + .5, m, y0 + 3.3, 1, .2, hw * .7, dim(base, .7));
              F.box(fa + .95, m, y0 + 3.85, .08, .9, hw * .7, [.05, .04, .035]);
              if (live && r() < .6) F.lit(fa + .06, m, y0 + 4.5, .1, 1.7, 1.1, [1.3, .8, .4]);
            }
            if (live && r() < .4) { const [lx, lz] = at(fa + .35, m + hw * .3); glow(lx, y0 + 2.6, lz, .28, .28, .28, LAMP); }
            if (r() < .15) { const [tx, tz] = at(a - rd * .38, m); prop('cone', tx, y0 + 2.4, tz, 2.6, 4.2, 2.6, [.03, .08, .035]); }
          }

          // The stair street: a stone tread, six steps up to the next terrace and a lamp post on each side.

          F.box(a, 0, y0 + .15, rd, .3, WS, STONE);
          if (k < top) for (let j = 0; j < 6; j++) { const h = y0 + (j + 1) * RISE / 6; F.box(a - rd / 2 + 3.6 - (j + .5) * .6, 0, h / 2, .6, h, WS, STONE); }
          const pair = [];
          for (const s of [-1, 1]) {
            const [lx, lz] = at(a + rd * .2, s * (WS / 2 + .4));
            prop('cyl', lx, y0 + 1.8, lz, .14, 3.6, .14, [.05, .05, .05]);
            put(GLOWS.sphere, lx, y0 + 3.7, lz, .55, .55, .55, 0, 0, LAMP);
            if (!k) pool(lx, lz, 5, [.12, .075, .03]);
            pair.push([lx, y0 + 3.6, lz]);
          }
          stringLights(pair[0], pair[1], .4, 4, pick(r, FEST));
          lamps.push(pair);
        }
        for (let k = 0; k + 1 < lamps.length; k++) for (const s of [0, 1]) stringLights(lamps[k][s], lamps[k + 1][s], .5, 4, dim(LAMP, .8));

        // Foot of the stair: the barrio's painted board on two posts, step one and a barrel fire by the street.

        {
          const a = DP / 2 + 1.2;
          for (const s of [-1, 1]) F.box(a, s * 3.2, 2, .25, 4, .25, WOOD);
          F.box(a, 0, 4.2, .2, 1.3, 6.8, [.2, .12, .06]);
          const [px, pz] = at(a + .15, 0), [ox, oz] = at(DP / 2 + .1, WS / 2 + 1.4), [fx, fz] = at(DP / 2 + 3, -SP * .35);
          textSign('LAS PEÑAS', px, 4.2, pz, 6.2, 1.25, yaw, [1.5, 1, .45]);
          textSign('1', ox, .8, oz, 1.3, .45, yaw, [1.1, .85, .5]);
          pool(px, pz, 7, [.1, .07, .03]);
          fire(fx, .8, fz, r, .7);
        }

        // Chapel on the top terrace: a white nave with a tile roof, a bell tower, a lit door and a cross.

        const ya = top * RISE, at0 = aOf(top);
        {
          const cl = Math.min(rd * .8, 12), cw = 7, CH = { ...S, base: [.3, .28, .24], win: [1, .75, .45], lit: .3, grime: .3 };
          const [px, pz] = at(at0, CB), [cx, cz] = sz(cl, cw);
          bld(px, pz, cx, cz, 7.5, CH, r, { y0: ya, roof: false, skin: SKINS.bands, ry: NOK });
          ridge(at0, CB, ya + 7.5, cl + .6, cw + .6, TILE, true);
          const ta = at0 + cl / 2 - 1.6, [tx, tz] = at(ta, CB), th = Math.max(5, capH(tx, tz, 3, ya + 15) - ya);
          bld(tx, tz, 3.2, 3.2, th, CH, r, { y0: ya, roof: false, skin: SKINS.fins, ry: NOK });
          prop('cone', tx, ya + th + 1.6, tz, 3.4, 3.2, 3.4, TILE);
          F.lit(ta, CB, ya + th - 1.4, 3.3, 1.2, 3.3, dim(LAMP, .55));
          glow(tx, ya + th + 3.9, tz, .14, 1.5, .14, LAMP);
          glow(tx, ya + th + 4.2, tz, .9, .14, .9, LAMP);
          F.lit(at0 + cl / 2 + .06, CB, ya + 1.5, .1, 2.8, 1.6, [1.4, .85, .4]);
          { const [rx, rz] = at(at0 + cl / 2 + .08, CB); put(GLOWS.sphere, rx, ya + 5.6, rz, 1.2, 1.2, .3, yaw, 0, [1.2, .5, .9]); }
          { const [px2, pz2] = at(at0 + cl / 2 + 2, CB); glow(px2, ya + 2.8, pz2, .3, .3, .3, LAMP); }
        }

        // Lighthouse: a keeper's hut and a blue and white striped tower. Two beams turn from the lantern.

        {
          const la = at0 - rd * .1, [lx, lz] = at(la, LB), [hx, hz] = at(la + 3.6, LB);
          bld(hx, hz, 4, 4, 3.2, { ...S, base: [.3, .3, .29], win: [1, .75, .45], lit: .5, grime: .3 }, r, { y0: ya, roof: false, skin: SKINS.grid, ry: NOK });
          const ht = Math.max(6, capH(lx, lz, 3, ya + 15) - ya), n = 6, sh = ht / n;
          for (let k = 0; k < n; k++) prop('cyl', lx, ya + (k + .5) * sh, lz, 3.4 - k * .22, sh, 3.4 - k * .22, k % 2 ? [.06, .1, .24] : [.36, .36, .37]);
          const yl = ya + ht;
          prop('cyl', lx, yl + .15, lz, 4.4, .3, 4.4, [.05, .05, .055]);
          put(GLOWS.ring, lx, yl + 1, lz, 4.2, 1, 4.2, 0, 0, dim(LAMP, .6));
          put(GLOWS.sphere, lx, yl + 1.4, lz, 1.7, 1.7, 1.7, 0, 0, [2.2, 1.9, 1.3]);
          prop('cone', lx, yl + 3, lz, 2.6, 1.6, 2.6, [.05, .05, .055]);
          const mat = H.searchBeam([1, .9, .65], 2.5);
          PEN.pivot = new THREE.Group();
          PEN.pivot.position.set(lx, yl + 1.4, lz);
          for (const s of [-1, 1]) {
            const m = new THREE.Mesh(H.beamGeo, mat);
            m.rotation.z = s * (Math.PI / 2 + .04);
            m.scale.set(7, 200, 7);
            m.frustumCulled = false;
            PEN.pivot.add(m);
          }
          H.decor.add(PEN.pivot);
        }
        return { face: [fr.x, fr.z] };
      },
      update(t) { if (PEN.pivot) PEN.pivot.rotation.y = t * .45; },
    },

    // Ximena: slim slab towers of tiny flats stacked on flats into the sky. Dense small windows, no signs and
    // no neon. Rooms are bolted onto rooms up the faces, bridges join the towers, and black-market courier
    // drones run between them and down to the street.

    gye_ximenastack: {
      at: [918, 1250], label: 'Ximena', minSide: 50, reach: 320, labelY: 200,
      build(x, z, w, d, st, r) {
        const F = facing(x, z), { fr } = F;
        const W = Math.min(w, 120), D = Math.min(d, 120), S = T.tone(st, .15, 1);
        const WARM = [1, .74, .44], SCREEN = [.62, .72, .9], LEDGE = [.045, .04, .038], STRUT = [.08, .075, .07];
        const nx = W > 84 ? 3 : 2, nz = D > 84 ? 3 : 2, cw = W / nx, cd = D / nz, towers = [];
        XIM.legs.length = 0;
        for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
          const cx = x - W / 2 + (i + .5) * cw + (r() - .5) * 3, cz = z - D / 2 + (j + .5) * cd + (r() - .5) * 3;
          const long = Math.max(cw, cd) - 7, thin = Math.min(Math.min(cw, cd) - 7, 10 + r() * 4);
          const alongX = cw > cd || (cw === cd && r() < .5), tw = alongX ? long : thin, td = alongX ? thin : long;
          const h = capH(cx, cz, Math.hypot(tw, td) / 2, 110 + 110 * r());

          // Next to a track the cell keeps a low block of flats.

          if (h < 30) { bld(cx, cz, tw, td, 14, { ...S, lit: .4, win: WARM }, r, { skin: SKINS.grid }); continue; }

          // Segments of different decades: each a new run of flats on the last, with a dark ledge at the joint.

          const segs = 3 + Math.floor(r() * 2);
          let y = 0, sw = tw, sd = td;
          for (let k = 0; k < segs; k++) {
            const sh = k < segs - 1 ? h / segs * (.8 + .4 * r()) : h - y;
            const L = { ...S, base: S.base.map(c => c * (.8 + .5 * r())), win: r() < .25 ? SCREEN : WARM, lit: .45 + .2 * r(), grime: .85 };
            bld(cx, cz, sw, sd, sh, L, r, { y0: y, roof: false, skin: SKINS.grid });
            y += sh;
            if (k < segs - 1) prop('box', cx, y + .25, cz, sw + 1, .5, sd + 1, LEDGE);
            sw = Math.max(6, sw + (r() - .6) * 2); sd = Math.max(6, sd + (r() - .6) * 2);
          }
          roof(cx, cz, sw, sd, h, S, r);
          for (let k = 1 + Math.floor(r() * 2); k > 0; k--) {
            const bw = 3 + r() * 3;
            bld(cx + (r() - .5) * (sw - bw), cz + (r() - .5) * (sd - bw), bw, bw * (.7 + .5 * r()), 2.6, { ...S, lit: .5, win: WARM, base: dim(pick(r, JUNK), 1.4) }, r, { y0: h, roof: false, skin: SKINS.sparse, ry: NOK });
          }

          // Rooms bolted onto rooms: a box on struts out from the face, often a second on top or further out.

          for (let k = 0; k < 9; k++) {
            const n = FACES[Math.floor(r() * 4)], span = n[0] ? td : tw, half = (n[0] ? tw : td) / 2;
            const bw = 3 + r() * 2.5, bh = 2.6 + r() * .8, dep = 1.6 + r() * 1.6, along = (r() - .5) * (span - bw), by = 8 + r() * (h - 20);
            const box = (out, yy, ww) => {
              const o = half + out + dep / 2, px = cx + n[0] * o - n[1] * along, pz = cz + n[1] * o + n[0] * along;
              prop('box', px, yy + bh / 2, pz, n[0] ? dep : ww, bh, n[0] ? ww : dep, dim(pick(r, JUNK), 1.2 + .4 * r()));
              if (r() < .7) glow(px + n[0] * (dep / 2 + .05), yy + bh * .55, pz + n[1] * (dep / 2 + .05), n[0] ? .1 : ww * .45, .8, n[0] ? ww * .45 : .1, dim(r() < .8 ? WARM : SCREEN, .8));
            };
            box(0, by, bw);
            const wx = cx + n[0] * half - n[1] * along, wz = cz + n[1] * half + n[0] * along;
            H.beam([wx, by - 2.2, wz], [wx + n[0] * dep, by, wz + n[1] * dep], .15, STRUT);
            if (r() < .4) box(0, by + bh, bw * .8);
            else if (r() < .4) box(dep, by + .3, bw * .7);
          }
          for (let k = 0; k < 3; k++) {
            const n = FACES[Math.floor(r() * 4)], half = (n[0] ? tw : td) / 2 + .6, along = (r() - .5) * ((n[0] ? td : tw) - 2);
            prop('dish', cx + n[0] * half - n[1] * along, 10 + r() * (h - 20), cz + n[1] * half + n[0] * along, 1.6, 1.6, 1.6, [.3, .3, .3], Math.atan2(n[0], n[1]), -.4);
          }
          towers.push({ x: cx, z: cz, tw, td, h, i, j });
        }

        // Enclosed bridges between neighbours, a lit walkway band through each.

        for (const A of towers) for (const B of towers) {
          const east = B.i === A.i + 1 && B.j === A.j, south = B.j === A.j + 1 && B.i === A.i;
          if ((!east && !south) || r() < .3) continue;
          const lo = Math.min(A.h, B.h) - 16;
          for (let q = r() < .4 ? 2 : 1; q > 0 && lo > 30; q--) {
            const by = 22 + r() * (lo - 22);
            if (east) {
              const x0 = A.x + A.tw / 2, x1 = B.x - B.tw / 2, mz = (A.z + B.z) / 2;
              if (x1 - x0 < 1) continue;
              bld((x0 + x1) / 2, mz, x1 - x0 + 1, 3, 3, { ...S, lit: .7, win: WARM }, r, { y0: by, roof: false, skin: SKINS.bands, ry: NOK });
            } else {
              const z0 = A.z + A.td / 2, z1 = B.z - B.td / 2, mx = (A.x + B.x) / 2;
              if (z1 - z0 < 1) continue;
              bld(mx, (z0 + z1) / 2, 3, z1 - z0 + 1, 3, { ...S, lit: .7, win: WARM }, r, { y0: by, roof: false, skin: SKINS.bands, ry: NOK });
            }
          }
        }

        // The street between the towers: barrel fires, grease pools and smog.

        for (let k = 0; k < 4; k++) fire(x + (r() - .5) * W * .9, .8, z + (r() - .5) * D * .9, r, .8);
        for (let k = 0; k < 4; k++) pool(x + (r() - .5) * W, z + (r() - .5) * D, 6, [.05, .035, .015]);
        for (let k = 0; k < 4; k++) puff(x + (r() - .5) * W, 40 + r() * 100, z + (r() - .5) * D, 14 + r() * 10, SMOG);

        // Courier legs. Each runs between two tower faces, or from a face down to the street front, and back.

        const face = (A, tx, tz) => {
          const dx = tx - A.x, dz = tz - A.z, k = Math.min((A.tw / 2 + 2.5) / (Math.abs(dx) || 1e-6), (A.td / 2 + 2.5) / (Math.abs(dz) || 1e-6));
          return [A.x + dx * k, A.z + dz * k];
        };
        const LIGHTS = [[.3, 1.5, .6], [1.4, 1.4, 1.5], [1.5, .9, .3], [1.6, .2, .1]];
        for (let k = 0; k < 16 && towers.length; k++) {
          const A = pick(r, towers), others = towers.filter(o => o !== A), ay = 20 + r() * (A.h - 30);
          let bx, bz, by, ax, az;
          if (others.length && k % 4) {
            const B = pick(r, others);
            [ax, az] = face(A, B.x, B.z); [bx, bz] = face(B, A.x, A.z); by = 20 + r() * (B.h - 30);
          } else {
            [bx, bz] = F.at(Math.min(F.deep(W, D), 120) / 2 + 5, (r() - .5) * Math.min(F.span(W, D), 120) * .8); by = 3;
            [ax, az] = face(A, bx, bz);
          }
          XIM.legs.push({ ax, ay, az, bx, by, bz, arc: 4 + r() * 10, sp: .05 + r() * .05, ph: r() * 2, rgb: pick(r, LIGHTS) });
        }
        const n = XIM.legs.length;
        if (!n) return { face: [fr.x, fr.z] };
        XIM.body = new THREE.InstancedMesh(H.PROPS.box.geometry, H.PROPS.box.material, n);
        XIM.light = new THREE.InstancedMesh(GLOWS.sphere.geometry, GLOWS.sphere.material, n);
        const c = new THREE.Color();
        XIM.legs.forEach((q, i) => { XIM.body.setColorAt(i, c.setRGB(.05, .05, .055)); XIM.light.setColorAt(i, c.setRGB(...q.rgb)); });
        for (const m of [XIM.body, XIM.light]) { m.userData.noTile = true; m.frustumCulled = false; H.decor.add(m); }
        return { face: [fr.x, fr.z] };
      },
      update(t) {
        if (!XIM.body) return;
        const L = XIM.legs;
        for (let i = 0; i < L.length; i++) {
          const q = L[i], f2 = (t * q.sp + q.ph) % 2, g = f2 % 1, u = Math.min(1, Math.max(0, (g - .12) / .76));
          const e = u * u * (3 - 2 * u), k = f2 < 1 ? e : 1 - e;
          const px = q.ax + (q.bx - q.ax) * k, pz = q.az + (q.bz - q.az) * k;
          const py = q.ay + (q.by - q.ay) * k + Math.sin(Math.PI * u) * q.arc + Math.sin(t * 2.3 + q.ph * 5) * .25;
          _o.position.set(px, py + .45, pz); _o.scale.set(1.4, .3, 1.4); _o.updateMatrix(); XIM.body.setMatrixAt(i, _o.matrix);
          _o.position.set(px, py, pz); _o.scale.setScalar(Math.sin(t * 6 + q.ph * 7) > .5 ? .75 : .45); _o.updateMatrix(); XIM.light.setMatrixAt(i, _o.matrix);
        }
        XIM.body.instanceMatrix.needsUpdate = XIM.light.instanceMatrix.needsUpdate = true;
      },
    },

    // Para Los Niños Community Center: locals took back three floors of a dead business arcology. Its painted
    // rooms shine through patched transplas in a dark tower. A mural, a weapons-check door under a lamp and
    // kids' string lights fill the yard in front.

    gye_ninos: {
      at: [985, 1338], label: 'Para Los Niños Community Center', minSide: 46, reach: 320, labelY: 130,
      build(x, z, w, d, st, r) {
        const F = facing(x, z), { at, sz, yaw, fr } = F;
        const SP = Math.min(F.span(w, d), 100) - 4, DP = Math.min(F.deep(w, d), 90) - 4;
        const S = T.tone(st, .15, 1), WARM = [1.4, .85, .4];
        const KIDS = [[1.5, .35, .7], [1.5, 1.1, .2], [.3, 1.1, 1.5], [.45, 1.4, .45], [1.5, .6, .2], [1, .45, 1.5]];
        const ad = DP * .62, ac = -DP / 2 + ad / 2, front = ac + ad / 2, bw = SP * .86;
        const [cx, cz] = at(ac, 0), [bx, bz] = sz(ad, bw), Y0 = 7.5, FL = 3.6, Y1 = Y0 + 3 * FL;
        const hmax = capH(cx, cz, Math.hypot(ad, bw) / 2, 120 + 30 * r()), top = hmax < 30 ? Y1 : hmax;
        const DEAD = { ...S, lit: .015, grime: 1 };

        // The dead arcology: a black lobby, the painted section, dark office floors and a stepped crown.

        bld(cx, cz, bx, bz, Y0, DEAD, r, { roof: false, skin: SKINS.sparse, ry: NOK });
        bld(cx, cz, bx, bz, FL * 3, { ...S, lit: 0, base: [.05, .045, .05] }, r, { y0: Y0, roof: false, skin: SKINS.sparse, ry: NOK });
        const yc = Math.max(Y1, top * .68);
        if (yc > Y1) bld(cx, cz, bx, bz, yc - Y1, DEAD, r, { y0: Y1, roof: false, skin: SKINS.sparse, ry: NOK });
        if (top > yc + 2) {
          bld(cx, cz, bx * .78, bz * .78, top - yc, { ...DEAD, lit: .01 }, r, { y0: yc, roof: false, skin: SKINS.curtain, ry: NOK });
          prop('lattice', cx + bx * .2, top + 11, cz, 2.4, 22, 2.4, [.8, .8, .8]);
        }
        if (yc > Y1 + 10) for (let k = 0; k < 5; k++) {
          const n = FACES[Math.floor(r() * 4)], along = (r() - .5) * ((n[0] ? bz : bx) - 6);
          facePatch(cx, cz, bx, bz, n, along, Y1 + 4 + r() * (yc - Y1 - 8), 1.6, 1.3, dim(r() < .6 ? FIRE : TUNG, .5));
        }
        puff(cx, top * .6, cz, 26, SMOG);

        // The painted section: bright rooms in patterns behind the glass, some panes patched, a few still dark.

        for (const n of FACES) {
          const span = n[0] ? bz : bx, cols = Math.floor(span / 4.2), pitch = span / cols;
          for (let f = 0; f < 3; f++) for (let c = 0; c < cols; c++) {
            const along = -span / 2 + (c + .5) * pitch, y = Y0 + f * FL + 1.9, q = r();
            if (q < .1) continue;
            if (q < .3) {
              const out = (n[0] ? bx : bz) / 2 + .12;
              prop('box', cx + n[0] * out - n[1] * along, y, cz + n[1] * out + n[0] * along, n[0] ? .12 : pitch * .8, 2.4, n[0] ? pitch * .8 : .12, dim(pick(r, TARP), 1.5));
              facePatch(cx, cz, bx, bz, n, along, y, pitch * .5, 1.4, dim(pick(r, KIDS), .25));
            } else facePatch(cx, cz, bx, bz, n, along, y, pitch * .8, 2.4, dim(pick(r, KIDS), .45 + .35 * r()));
          }
          for (let f = 0; f <= 3; f++) facePatch(cx, cz, bx, bz, n, 0, Y0 + f * FL, span, .18, dim(KIDS[(f + FACES.indexOf(n)) % 6], .5));
        }

        // Mural on the ground floor: handprints, suns and stripes round the centre's name.

        const rnd = H.rng(H.hash(11, 29));
        const tex = canvasTexture(1024, 256, (g, Wc, Hc) => {
          const C = ['#ff4f8b', '#ffd23f', '#3fd6ff', '#5cff7a', '#ff8a2a', '#b06bff'];
          g.fillStyle = '#1d1424'; g.fillRect(0, 0, Wc, Hc);
          for (let k = 0; k < 26; k++) { g.fillStyle = C[k % 6]; g.beginPath(); g.moveTo(k * 40, Hc); g.lineTo(k * 40 + 20, Hc - 34); g.lineTo(k * 40 + 40, Hc); g.fill(); }
          for (let k = 0; k < 6; k++) { g.fillStyle = C[k % 6]; g.fillRect(0, 10 + k * 7, Wc, 5); }
          for (let k = 0; k < 9; k++) {
            const sx = 60 + rnd() * 900, sy = 80 + rnd() * 100, sr = 14 + rnd() * 22;
            g.fillStyle = C[(k + 2) % 6]; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
          }
          for (let k = 0; k < 22; k++) {
            const hx = 30 + rnd() * 960, hy = 70 + rnd() * 120, s = .7 + rnd() * .5;
            g.fillStyle = C[Math.floor(rnd() * 6)];
            g.beginPath(); g.ellipse(hx, hy, 13 * s, 16 * s, 0, 0, Math.PI * 2); g.fill();
            for (let f = 0; f < 5; f++) { const a = -2.4 + f * .42; g.beginPath(); g.ellipse(hx + Math.cos(a) * 21 * s, hy + Math.sin(a) * 21 * s, 4 * s, 8 * s, a + Math.PI / 2, 0, Math.PI * 2); g.fill(); }
          }
          g.font = 'bold 92px "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.lineWidth = 12; g.strokeStyle = '#ff4f8b'; g.strokeText('PARA LOS NIÑOS', Wc / 2, 128);
          g.fillStyle = '#fff6d8'; g.fillText('PARA LOS NIÑOS', Wc / 2, 128);
        });
        { const [px, pz] = at(front + .3, -bw * .14), mw = Math.min(bw * .62, 26); panel(tex, px, 3.6, pz, mw, mw / 4, yaw, 1); }

        // Weapons-check door: a lamp over the door, a locker rack with a sign, a table for the guard.

        const db = bw * .34;
        F.lit(front + .06, db, 1.6, .1, 3.2, 2.6, WARM);
        F.box(front + .7, db, 4.1, 1.4, .15, .15, [.05, .05, .05]);
        { const [px, pz] = at(front + 1.4, db); put(GLOWS.sphere, px, 3.9, pz, .5, .5, .5, 0, 0, [1.6, 1.1, .6]); pool(px, pz, 6, [.13, .08, .03]); }
        { const [px, pz] = at(front + .3, db); textSign('PARA LOS NIÑOS', px, 5.6, pz, 8, 2, yaw, dim(KIDS[1], .9)); }
        for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
          const b = db + 3 + i * .9, y = .7 + j * 1.1;
          F.box(front + .35, b, y, .7, 1, .8, [.1, .11, .12]);
          F.lit(front + .72, b + .25, y + .2, .05, .12, .12, r() < .7 ? [.3, 1.5, .4] : [1.5, .2, .1]);
        }
        { const [px, pz] = at(front + .3, db + 4.4); textSign('ARMAS AQUÍ', px, 2.9, pz, 3.6, .9, yaw, [1.4, 1.2, .9]); }
        F.box(front + 1.6, db + 2.4, .45, 1, .9, 1.8, WOOD);

        // The yard: posts with kids' string lights zigzagging over a painted court.

        const ya = front + 1, yb = DP / 2 - 1, ym = (ya + yb) / 2, posts = [];
        for (let k = 0; k < 5; k++) {
          const a = k % 2 ? yb - .5 : ya + 2.5, b = -bw * .45 + k * bw * .2;
          F.box(a, b, 2.4, .2, 4.8, .2, [.06, .06, .06]);
          posts.push([...at(a, b)]);
        }
        for (let k = 0; k + 1 < posts.length; k++) stringLights([posts[k][0], 4.7, posts[k][1]], [posts[k + 1][0], 4.7, posts[k + 1][1]], .6, 7, KIDS[k % 6]);
        for (let k = 0; k < 6; k++) F.box(ym, -bw * .25 + k * 2.6, .05, 2, .06, 2, dim(KIDS[k], .18));
        { const [px, pz] = at(ym, -bw * .32); pool(px, pz, 9, [.09, .05, .08]); }
        return { face: [fr.x, fr.z] };
      },
    },

    // Old fuel station and bus depot beyond the Daule: a dead canopy over squatter tents and fires, an old
    // pump island, a broken sign twisted on its pole, and rusting bus shells in a half-roofed depot shed.

    gye_depot: {
      at: [1182, 1378], label: 'Old Fuel Station and Bus Depot', minSide: 46, reach: 320, labelY: 30,
      build(x, z, w, d, st, r) {
        const F = facing(x, z), { at, sz, yaw, fr } = F;
        const SP = Math.min(F.span(w, d), 110) - 4, DP = Math.min(F.deep(w, d), 100) - 4;
        const RUST = [[.2, .08, .035], [.14, .07, .04], [.1, .06, .05], [.17, .11, .05], [.08, .09, .07]];
        const DEADRED = [.12, .035, .03], STEEL = [.09, .085, .08], WARM = [1.3, .75, .35];
        F.box(0, 0, .1, DP + 2, .2, SP + 2, [.04, .035, .03]);
        for (let k = 0; k < 8; k++) { const [px, pz] = at((r() - .5) * DP, (r() - .5) * SP); pool(px, pz, 3 + r() * 4, [.03, .025, .01]); }

        // Canopy on six columns, its fascia stripe dead but for one flickering stretch, a few panels hanging.

        const ca = DP * .24, cb = -SP * .16, cs = Math.min(SP * .55, 40), cdp = 14;
        for (const s of [-1, 1]) for (const f of [-.4, 0, .4]) F.box(ca + s * cdp * .32, cb + f * cs, 3.2, .7, 6.4, .7, CONC, 'cyl');
        F.box(ca, cb, 6.9, cdp, 1, cs, [.1, .09, .085]);
        F.box(ca + cdp / 2 + .05, cb, 6.9, .1, .8, cs, DEADRED);
        { const [px, pz] = at(ca + cdp / 2 + .12, cb + cs * .3), [fx, fz] = sz(.1, cs * .15); flickerGlow(px, 6.9, pz, fx, .5, fz, dim([1.5, .25, .1], .5), r); }
        for (let k = 0; k < 3; k++) {
          const [px, pz] = at(ca + (r() - .5) * cdp * .7, cb + (r() - .5) * cs * .8);
          prop('box', px, 5.7, pz, 3, .12, 2.2, [.09, .085, .08], r() * 3, .35 + r() * .3);
        }

        // Pump island under the canopy: a curb, two pumps with dead faces and slack hoses.

        F.box(ca, cb, .2, 2, .4, 8, CONC);
        for (const s of [-1, 1]) {
          F.box(ca, cb + s * 2.2, 1.3, .9, 1.9, .7, pick(r, RUST));
          F.lit(ca + .46, cb + s * 2.2, 1.6, .05, .4, .5, [.08, .1, .06]);
          const [hx, hz] = at(ca + .5, cb + s * 2.2), [ex, ez] = at(ca + 1.6, cb + s * 2.6);
          H.beam([hx, 1.7, hz], [ex, .2, ez], .1, [.03, .03, .03]);
        }

        // Squatters under the canopy: tarp tents, battery lamps, two fires and a laundry line.

        for (let k = 0; k < 9; k++) {
          const a = ca + (r() - .5) * cdp * .85, b = cb + (r() < .5 ? -1 : 1) * (5 + r() * (cs / 2 - 6)), [px, pz] = at(a, b);
          if (r() < .5) prop('cone', px, 1.1, pz, 2.6 + r(), 2.2, 2.6 + r(), pick(r, TARP), r() * 3);
          else { prop('box', px, .8, pz, 2.4, 1.6, 3, dim(pick(r, JUNK), 1.4), r() * 3); prop('box', px, 1.7, pz, 3, .1, 3.6, pick(r, TARP), r() * 3, (r() - .5) * .2); }
          if (r() < .4) glow(px, 1.2, pz, .25, .25, .25, WARM);
        }
        for (const s of [-1, 1]) { const [px, pz] = at(ca + s * 3, cb + s * cs * .28); fire(px, .8, pz, r, .9); }
        { const [ax, az] = at(ca - cdp * .32, cb - cs * .4), [bx, bz] = at(ca - cdp * .32, cb); stringLights([ax, 4.5, az], [bx, 4.5, bz], .6, 6, dim(WARM, .8)); }
        { const [px, pz] = at(ca, cb); put(GLOWS.sphere, px, 6.1, pz, .4, .4, .4, 0, 0, WARM); }

        // The broken sign: a tall pole by the street, the panel twisted on it, a letter dead, a blank price board.

        {
          const sa = DP / 2 - 1.5, sb = SP / 2 - 5, [px, pz] = at(sa, sb), tw = .14;
          prop('cyl', px, 7, pz, .6, 14, .6, STEEL);
          const [kx, kz] = sz(.5, 7), [qx, qz] = sz(.4, 3.2);
          prop('box', px, 13.6, pz, kx, 1.9, kz, [.13, .1, .08], tw);
          const [tx, tz] = at(sa + .6, sb);
          textSign('GAS LINERA', tx, 13.6, tz, 6.4, 1.5, yaw + tw, dim([1.5, .3, .1], .3));
          flickerGlow(tx, 13.6, tz, .4, .5, .4, dim([1.5, .3, .1], .6), r);
          prop('box', px, 10.4, pz, qx, 2.2, qz, [.07, .065, .06]);
          const [ux, uz] = at(sa + .25, sb);
          textSign('DIÉSEL', ux, 10.9, uz, 2.6, .65, yaw, [.3, .22, .12]);
          pool(px, pz, 4, [.03, .025, .01]);
        }

        // Depot shed: back wall, column rows and a roof with holes. One panel lies collapsed.

        const sd = DP * .42, sa = -DP / 2 + sd / 2 + 1, ss = SP * .88, bays = Math.max(4, Math.floor(ss / 7)), pb = ss / bays;
        F.box(sa - sd / 2, 0, 3.6, .6, 7.2, ss, CONC);
        for (let k = 0; k <= bays; k++) for (const f of [-.5, 0, .5]) if (f < .5 || k % 2 === 0) F.box(sa + f * sd, -ss / 2 + k * pb, 3.6, .5, 7.2, .5, STEEL);
        for (let k = 0; k < bays; k++) {
          const b = -ss / 2 + (k + .5) * pb;
          if (r() < .25) {
            if (r() < .5) { const [px, pz] = at(sa + sd * .2, b), [qx, qz] = sz(sd * .7, pb - .4); prop('box', px, 3.4, pz, qx, .4, qz, [.09, .085, .08], 0, .9); }
            continue;
          }
          F.box(sa, b, 7.5, sd + 1, .4, pb, [.075, .07, .065]);
        }
        { const [px, pz] = at(sa + sd / 2 + .3, 0); F.box(sa + sd / 2, 0, 8.4, .3, 1.6, ss * .5, [.06, .05, .04]); textSign('TERMINAL TERRESTRE', px, 8.4, pz, ss * .45, ss * .45 / 8, yaw, [.26, .12, .05]); }

        // Bus shells nose-in to the back wall. Squatters live in some, one burnt out, one dragged into the yard.

        for (let k = 0; k < bays; k++) {
          if (r() < .2) continue;
          const b = -ss / 2 + (k + .5) * pb, a = sa - sd / 2 + 6.5 + r() * 1.5, burnt = r() < .15, col = burnt ? [.04, .035, .03] : pick(r, RUST);
          F.box(a, b, 1.9, 11, 3, 2.6, col);
          F.box(a, b, 2.5, 10, .9, 2.66, [.02, .02, .025]);
          if (burnt) { const [px, pz] = at(a, b); fire(px, 1.6, pz, r, .8); puff(px, 6, pz, 4, SMOG); }
          else if (r() < .5) F.lit(a + (r() - .5) * 5, b, 2.5, 2.5 + r() * 3, .7, 2.7, dim(WARM, .7));
          for (const s of [-1, 1]) if (r() < .5) F.box(a + s * 3.5, b + 1.4, .45, .9, .9, .35, [.03, .03, .03], 'cyl');
        }
        {
          const [px, pz] = at(-DP * .02, SP * .3), [qx, qz] = sz(11, 2.6);
          prop('box', px, 1.5, pz, qx, 3, qz, pick(r, RUST), .5, .12);
          fire(px + 6, .8, pz - 3, r, .7);
        }
        for (let k = 0; k < 4; k++) {
          const [px, pz] = at((r() - .5) * DP * .4, SP * (.1 + r() * .35));
          for (let j = 0; j < 2 + Math.floor(r() * 3); j++) prop('cyl', px, .2 + j * .38, pz, 1.1, .36, 1.1, [.03, .03, .03]);
        }
        for (let k = 0; k < 2; k++) puff((r() - .5) * DP, 10 + r() * 6, (r() - .5) * SP, 9, SMOG);
        return { face: [fr.x, fr.z] };
      },
    },

    // Welcoming Hands Shelter: a long low hall of bunks and cots in rows, plainly lit, with a clerestory down the
    // ridge. A queue waits under the door lamp, and an unmarked van stands by the side.

    gye_shelter: {
      at: [990, 1400], label: 'Welcoming Hands Shelter', minSide: 30, reach: 300, labelY: 22,
      build(x, z, w, d, st, r) {
        const F = facing(x, z), { at, sz, yaw, fr } = F;
        const SP = Math.min(F.span(w, d) - 6, 54), DP = Math.min(F.deep(w, d) - 12, 16);
        const S = T.tone(st, .2, 1), PLAIN = [.85, .9, .95], CLOTH = [[.06, .05, .05], [.08, .07, .06], [.05, .06, .08], [.1, .06, .04]];
        const ha = F.deep(w, d) / 2 - DP / 2 - 8, front = ha + DP / 2;
        const [hx, hz] = at(ha, 0);
        bld(hx, hz, ...sz(DP, SP), 6, { ...S, base: [.14, .135, .12], lit: .02, grime: .6 }, r, { roof: false, skin: SKINS.sparse, ry: NOK });
        F.box(ha, 0, 6.3, DP + .6, .6, SP + .6, [.06, .06, .065]);
        F.box(ha, 0, 7.4, DP * .3, 1.6, SP * .95, [.07, .07, .075]);
        for (const s of [-1, 1]) {
          F.lit(ha + s * (DP * .15 + .05), 0, 7.4, .1, .7, SP * .9, dim(PLAIN, .6));
          for (let b = -SP / 2 + 2.5; b < SP / 2 - 2; b += 3.5) if (Math.abs(b) > 2 || s < 0) F.lit(ha + s * (DP / 2 + .05), b, 3.6, .1, 1, 1.6, dim(PLAIN, .55 + .15 * r()));
        }

        // Door with a plain lamp and a modest painted sign.

        F.lit(front + .06, 0, 1.5, .1, 3, 2.2, dim(PLAIN, .9));
        F.box(front + .6, 0, 3.6, 1.2, .12, .12, [.05, .05, .05]);
        { const [px, pz] = at(front + 1.2, 0); put(GLOWS.sphere, px, 3.4, pz, .45, .45, .45, 0, 0, [1.3, 1.3, 1.2]); pool(px, pz, 7, [.1, .1, .09]); }
        { const [px, pz] = at(front + .12, 0); textSign('WELCOMING HANDS', px, 4.8, pz, 7, 1.2, yaw, dim(PLAIN, .55)); }

        // The queue along the front wall, a few with bundles, and a barrel fire at its tail.

        for (let k = 0; k < 14; k++) {
          const b = -1.8 - k * .85, a = front + 1.4 + (r() - .5) * .4, [px, pz] = at(a, b), h = 1.5 + r() * .3;
          prop('cyl', px, h / 2, pz, .5, h, .5, pick(r, CLOTH));
          if (r() < .3) prop('box', px, .35, pz, .5, .5, .5, pick(r, TARP), r() * 3);
        }
        { const [px, pz] = at(front + 3, -15); fire(px, .8, pz, r, .6); }

        // Unmarked supply van and crates by the side door.

        {
          const vb = SP / 2 - 3, va = front + 3;
          F.box(va, vb, 1.3, 2.2, 2.2, 5, [.22, .22, .23]);
          F.lit(va + 1.12, vb + 2, 1.6, .05, .6, .8, [.05, .05, .06]);
          for (let k = 0; k < 4; k++) F.box(front + .8 + (k % 2) * .9, vb - 3.5 - (k >> 1) * .9, .4, .8, .8, .8, WOOD);
        }
        return { face: [fr.x, fr.z] };
      },
    },
  };
}
