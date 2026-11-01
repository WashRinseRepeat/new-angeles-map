// Landmarks from the Tour Guide and Akeidito finds. See design/pdf-finds/.
// These finds have no fixed home in canon, so they sit in districts with few landmarks.

export const kits = () => ({});

export function landmarks(H) {
  const { THREE, SKINS, GLOWS, STALK, bld, glow, prop, put, beam, beacon, pool, puff, textSign, stringLights, flickerGlow, toLocal, lerp } = H;
  const dim = (c, k) => c.map(v => v * k);
  const look = (st, base, win, lit, grime = .5) => ({ ...st, base, win, lit, grime });
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const WARM = [1, .72, .4], COLD = [.8, .9, 1], GOLD = [2, 1.25, .35], PINK = [2.2, .3, 1.3], LIME = [1.1, 2, .3];

  // The local face (+x, -x, +z, -z) that points closest to a world spot.

  const faceTo = (wx, wz) => {
    const [lx, lz] = toLocal(wx, wz);
    return Math.abs(lx) > Math.abs(lz) ? [Math.sign(lx), 0] : [0, Math.sign(lz)];
  };

  // SlotWhizz mascot balls. One geometry and one material for the file.

  const ballGeo = new THREE.SphereGeometry(1, 10, 8);
  const ballMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.3, .3) });
  const balls = [];
  const FALL = { top: 40, bottom: 5, span: 0, front: 0 };

  // Warrens cargo drones. Each carries one box between two stack tops.

  const DRONES = [], DRN = {}, DRN_O = new THREE.Object3D(), DRN_C = new THREE.Color();

  // Los Barrancos parts: plank walkways, scaffold towers and cages, and Polecats graffiti textures.

  const walkway = (a, b, r, wood, rail, CLOTH) => {
    const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz), y = a[1];
    if (L < 1) return;
    const ry = Math.atan2(dx, dz), nx = dz / L, nz = -dx / L, side = (p, s, dy) => [p[0] + nx * s, y + dy, p[2] + nz * s];
    prop('box', (a[0] + b[0]) / 2, y, (a[2] + b[2]) / 2, 1.8, .25, L, wood, ry);
    for (const s of [-.9, .9]) beam(side(a, s, 1.1), side(b, s, 1.1), .1, rail);
    for (let k = 1, n = Math.floor(L / 4); k < n; k++) for (const s of [-.9, .9]) {
      const t = k / n;
      prop('box', lerp(a[0], b[0], t) + nx * s, y + .55, lerp(a[2], b[2], t) + nz * s, .1, 1.1, .1, rail);
    }
    beam(side(a, 0, 2.8), side(b, 0, 2.8), .06, rail);
    stringLights(side(a, 0, 2.7), side(b, 0, 2.7), .6, Math.max(3, Math.round(L / 3.5)), dim(WARM, 1.5));

    // Laundry hangs over one rail on half the walkways.

    if (r() < .5) {
      const s = r() < .5 ? -1.05 : 1.05;
      for (let t = .1; t < .9; t += .07 + r() * .06) if (r() < .8)
        prop('box', lerp(a[0], b[0], t) + nx * s, y + .55 - r() * .3, lerp(a[2], b[2], t) + nz * s, .05, .8 + r() * .5, .6 + r() * .4, pick(r, CLOTH), ry);
    }
    if (L > 18 && y > 10 && r() < .5) prop('lattice', (a[0] + b[0]) / 2, y / 2, (a[2] + b[2]) / 2, 1.8, y, 1.8);
  };

  // A free-standing scaffold tower: four poles, a beam frame and zigzag braces every 4 m, plank decks
  // on some levels, and a shack with a lamp on top.

  const scaffoldTower = (x, z, s, h, r, pole, wood) => {
    const e = s / 2, C = [[-e, -e], [e, -e], [e, e], [-e, e]];
    for (const [cx, cz] of C) prop('box', x + cx, h / 2, z + cz, .3, h, .3, pole);
    for (let y = 4, k = 0; y <= h; y += 4, k++) for (let f = 0; f < 4; f++) {
      const [ax, az] = C[f], [bx, bz] = C[(f + 1) % 4], up = (k + f) % 2;
      beam([x + ax, y, z + az], [x + bx, y, z + bz], .18, pole);
      beam([x + ax, y - (up ? 4 : 0), z + az], [x + bx, y - (up ? 0 : 4), z + bz], .12, pole);
      if (!f && (k % 2 || y + 4 > h)) prop('box', x, y + .12, z, s + .3, .2, s + .3, wood);
    }
    prop('box', x, h + 1.4, z, s * .7, 2.6, s * .6, [.14, .08, .05]);
    glow(x, h + 1.4, z + s * .3 + .05, 1.2, .9, .1, dim(WARM, 1.5));
    glow(x + e, h + 3.2, z + e, .5, .5, .5, dim(WARM, 2));
  };

  // A scaffold cage on a dorm face: poles on an outer line, plank floors every 3.5 m, one brace per floor,
  // and tarps hung on some bays. fz picks the +z or -z face.

  const scaffoldFace = (g, fz, frac, r, pole, wood, CLOTH) => {
    const top = g.h * frac, span = g.bw * .7, x0 = g.bx + (r() - .5) * (g.bw - span) * .6;
    const wall = g.bz + fz * g.bd / 2, zo = wall + fz * 1.7, n = Math.max(2, Math.round(span / 3.5)), bay = span / n;
    for (let k = 0; k <= n; k++) prop('box', x0 - span / 2 + bay * k, top / 2, zo, .18, top, .18, pole);
    for (let y = 3.5, f = 0; y <= top; y += 3.5, f++) {
      prop('box', x0, y, wall + fz * .9, span, .18, 1.6, wood);
      beam([x0 - span / 2, y + 1, zo], [x0 + span / 2, y + 1, zo], .08, pole);
      beam([x0 - span / 2, f % 2 ? y : y - 3.5, zo], [x0 + span / 2, f % 2 ? y - 3.5 : y, zo], .1, pole);
      for (let k = 0; k < n; k++) if (r() < .18)
        prop('box', x0 - span / 2 + bay * (k + .5), y - 1.6, zo + fz * .05, bay * .9, 3, .05, dim(pick(r, CLOTH), .6));
    }
  };

  // The Polecats signature: a polecat curled round a concave spire shaped like the Root.

  const polecatSig = (g, cx, by, s, spire, body) => {
    g.lineJoin = g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx - .3 * s, by);
    g.quadraticCurveTo(cx - .03 * s, by - .3 * s, cx, by - s);
    g.quadraticCurveTo(cx + .03 * s, by - .3 * s, cx + .3 * s, by);
    g.closePath();
    g.fillStyle = spire; g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = s * .015; g.stroke();
    g.strokeStyle = '#111'; g.lineWidth = s * .13;
    const curl = () => {
      g.beginPath();
      g.moveTo(cx - .42 * s, by - .08 * s);
      g.bezierCurveTo(cx - .1 * s, by - .02 * s, cx + .38 * s, by - .2 * s, cx + .1 * s, by - .38 * s);
      g.bezierCurveTo(cx - .2 * s, by - .52 * s, cx - .25 * s, by - .62 * s, cx + .1 * s, by - .76 * s);
    };
    curl(); g.stroke();
    g.strokeStyle = body; g.lineWidth = s * .09; curl(); g.stroke();
    g.fillStyle = body; g.beginPath(); g.ellipse(cx - .44 * s, by - .1 * s, s * .1, s * .06, -.3, 0, 7); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.ellipse(cx - .5 * s, by - .12 * s, s * .05, s * .045, -.3, 0, 7); g.fill();
    const hx = cx + .14 * s, hy = by - .8 * s;
    g.fillStyle = body; g.beginPath(); g.ellipse(hx, hy, s * .1, s * .07, -.4, 0, 7); g.fill();
    for (const e of [-1, 1]) { g.beginPath(); g.moveTo(hx + e * .07 * s, hy - .03 * s); g.lineTo(hx + e * .05 * s, hy - .12 * s); g.lineTo(hx + e * .01 * s, hy - .05 * s); g.fill(); }
    g.fillStyle = '#111'; g.fillRect(hx - .09 * s, hy - .025 * s, .18 * s, .035 * s);
    g.fillStyle = '#fff'; for (const e of [-1, 1]) { g.beginPath(); g.arc(hx + e * .04 * s, hy - .008 * s, s * .012, 0, 7); g.fill(); }
  };
  const spray = (g, q, W, Hh, C, n) => {
    for (let k = 0; k < n; k++) {
      g.fillStyle = C[Math.floor(q() * C.length)]; g.globalAlpha = .5 + q() * .5;
      const px = q() * W, py = q() * Hh * .8, len = 6 + q() * 30;
      g.fillRect(px, py, 2 + q() * 2, len);
      g.beginPath(); g.arc(px + 1.5, py + len, 2.5, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  };
  const MURAL = ['#ff3d8b', '#ffd23a', '#3ee6c8', '#7a5cff', '#ff7a1a', '#a6ff3a', '#29b6ff'];
  const muralTex = (seed, word) => H.canvasTexture(320, 192, (g, W, Hh) => {
    const q = H.rng(seed), c = () => MURAL[Math.floor(q() * MURAL.length)];
    g.fillStyle = '#1a1512'; g.fillRect(0, 0, W, Hh);
    for (let k = 0; k < 8; k++) { g.fillStyle = c(); g.globalAlpha = .9; g.beginPath(); g.ellipse(q() * W, q() * Hh, 25 + q() * 70, 18 + q() * 45, q() * 3, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    spray(g, q, W, Hh, MURAL, 30);
    g.save(); g.translate(W * .45, Hh * .55); g.rotate((q() - .5) * .25);
    g.font = 'bold 58px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = 14; g.strokeStyle = '#111'; g.strokeText(word, 0, 0);
    g.fillStyle = c(); g.fillText(word, 0, 0);
    g.lineWidth = 2.5; g.strokeStyle = '#fff'; g.strokeText(word, 0, 0);
    g.restore();
    polecatSig(g, W - 34, Hh - 10, 70, '#ff3d8b', '#a6ff3a');
  });
  const polecatTex = () => H.canvasTexture(512, 512, (g, W) => {
    const q = H.rng(H.hash(9, 77));
    g.fillStyle = '#120e10'; g.fillRect(0, 0, W, W);
    const halo = g.createRadialGradient(256, 250, 20, 256, 250, 250);
    halo.addColorStop(0, 'rgba(255,61,139,.55)'); halo.addColorStop(1, 'rgba(255,61,139,0)');
    g.fillStyle = halo; g.fillRect(0, 0, W, W);
    spray(g, q, W, W, ['#ff3d8b', '#a6ff3a', '#ffd23a'], 40);
    polecatSig(g, 256, 420, 380, '#ff3d8b', '#a6ff3a');
    g.font = 'bold 70px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.lineJoin = 'round';
    g.lineWidth = 14; g.strokeStyle = '#111'; g.strokeText('POLECATS', 256, 490);
    g.fillStyle = '#ffd23a'; g.fillText('POLECATS', 256, 490);
  });

  return {

    // Los Barrancos: the builders' camp in Chakana Eastside. Dorm slabs, an old Consortium warehouse and a
    // communal kitchen. Scaffolds and plank walkways join the towers at several heights, hung with bulbs and
    // laundry. Polecats murals cover the walls, and their big tag faces the Root.

    fs_barrancos: {
      at: [920, 92], label: 'Los Barrancos', minSide: 40, reach: 500, labelY: 62,
      build(x, z, w, d, st, r) {
        const S = look(st, [.1, .08, .065], WARM, .36, .9), SHED = look(st, [.085, .08, .07], WARM, .12, 1);
        const WOOD = [.24, .16, .1], RAIL = [.09, .08, .07], POLE = [.13, .12, .11];
        const TIN = [[.2, .09, .05], [.08, .14, .18], [.18, .16, .07], [.1, .15, .1], [.17, .07, .1]];
        const CLOTH = [[.6, .12, .1], [.15, .3, .6], [.65, .55, .15], [.5, .5, .48], [.15, .45, .3], [.55, .2, .45]];
        prop('box', x, .15, z, w, .3, d, [.05, .045, .04]);

        // A 3 × 2 grid. Five cells hold dorm slabs. The centre back cell holds the warehouse, the kitchen
        // and a scaffold tower that the walkways meet at.

        const cw = w / 3, cd = d / 2, grid = [];
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
          const cx = x - w / 2 + cw * (i + .5), cz = z - d / 2 + cd * (j + .5);
          if (i === 1 && j === 0) {
            const hs = 7, hx = cx + cw * .28, hz = cz + cd * .2, hh = 30 + r() * 8;
            scaffoldTower(hx, hz, hs, hh, r, POLE, WOOD);
            grid.push({ i, j, bx: hx, bz: hz, bw: hs, bd: hs, h: hh });
            continue;
          }
          const bw = cw * (.5 + r() * .15), bd = cd * (.55 + r() * .2), h = 22 + r() * 28;
          bld(cx, cz, bw, bd, h, S, r, { skin: r() < .5 ? SKINS.sparse : SKINS.grid });
          grid.push({ i, j, bx: cx, bz: cz, bw, bd, h });
          textSign('D-' + (grid.length), cx, h - 3, cz + bd / 2 + .3, 4, 2.2, 0, [.5, .48, .42]);

          // Rooftop shacks of corrugated tin, each with a lit window, and a water drum.

          for (let k = 1 + Math.floor(r() * 3); k > 0; k--) {
            const sw = 3 + r() * 3, sd = 3 + r() * 2.5, sh = 2.4 + r() * 1.2;
            const sx = cx + (r() - .5) * (bw - sw - 1), sz = cz + (r() - .5) * (bd - sd - 1);
            prop('box', sx, h + sh / 2, sz, sw, sh, sd, pick(r, TIN));
            prop('box', sx, h + sh + .1, sz, sw + .6, .2, sd + .6, dim(pick(r, TIN), .8), 0, (r() - .5) * .15);
            glow(sx, h + sh * .5, sz + sd / 2 + .05, 1, .8, .1, dim(WARM, 1.3));
          }
          prop('cyl', cx - bw * .3, h + 1.5, cz - bd * .3, 2.4, 3, 2.4, [.14, .1, .08]);
        }
        const at = (i, j) => grid.find(g => g.i === i && g.j === j);

        // The old warehouse: a long low shed with a barrel roof and a faded Consortium stencil.

        const wx = x, wz = z - d / 2 + cd * .3, ww = cw * .82, wd = cd * .42;
        bld(wx - cw * .05, wz, ww, wd, 9, SHED, r, { skin: SKINS.sparse, roof: false, kibble: false });
        prop('cyl', wx - cw * .05, 9, wz, ww, wd, 5, [.12, .1, .085], 0, Math.PI / 2);
        for (const s of [-1, 1]) prop('box', wx - cw * .05, 4, wz + s * (wd / 2 + .1), ww * .25, 5, .2, [.07, .06, .05]);
        textSign('CONSORTIUM  BLOQUE 7', wx - cw * .05, 7, wz + wd / 2 + .3, ww * .6, 1.8, 0, [.35, .33, .3]);

        // The communal kitchen: a lit open shed with tables, stovepipes and steam.

        const kx = x - cw * .12, kz = z - cd * .2, kw = 11, kd = 7;
        bld(kx, kz, kw, kd, 4.5, { ...SHED, lit: .9, win: [1.2, .7, .35] }, r, { skin: SKINS.grid, roof: false, kibble: false });
        prop('box', kx, 4.7, kz + 1, kw + 3, .25, kd + 4, [.18, .08, .05], 0, -.08);
        glow(kx, 2, kz + kd / 2 + .1, kw * .7, 2.4, .1, dim(WARM, 1.6));
        for (let k = 0; k < 3; k++) {
          prop('box', kx - 3.5 + k * 3.5, .8, kz + kd / 2 + 2.6, 2.6, .15, 1.2, WOOD);
          prop('box', kx - 3.5 + k * 3.5, .4, kz + kd / 2 + 2.6, .4, .8, .4, WOOD);
        }
        for (const s of [-1, 1]) {
          const px = kx + s * 3, pz = kz - 1.5;
          prop('cyl', px, 7, pz, .7, 5, .7, [.08, .07, .06]);
          for (let k = 0; k < 4; k++) puff(px + k * .6, 10 + k * 3.2, pz - k * .4, 1.4 + k * .9, [.16, .15, .14]);
        }
        stringLights([kx - kw / 2, 5.5, kz + kd / 2 + 4], [kx + kw / 2, 5.5, kz + kd / 2 + 4], .5, 6, dim(WARM, 1.5));
        pool(kx, kz + kd / 2 + 3, 9, dim(WARM, .14));

        // Walkways join neighbours in a row and across the lane. Each pair gets one or two at different heights.

        const pairs = [];
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) pairs.push([at(i, j), at(i + 1, j)]);
        for (let i = 0; i < 3; i++) pairs.push([at(i, 0), at(i, 1)]);
        for (const [a, b] of pairs) {
          const top = Math.min(a.h, b.h) - 3, n = r() < .55 ? 2 : 1;
          for (let k = 0; k < n; k++) {
            const y = 7 + (top - 7) * (n === 1 ? .3 + r() * .5 : (k + .2 + r() * .6) / n);
            const row = a.j === b.j, off = (r() - .5) * (row ? Math.min(a.bd, b.bd) : Math.min(a.bw, b.bw)) * .6;
            const p0 = row ? [a.bx + a.bw / 2, y, a.bz + off] : [a.bx + off, y, a.bz + a.bd / 2];
            const p1 = row ? [b.bx - b.bw / 2, y, b.bz + off] : [b.bx + off, y, b.bz - b.bd / 2];
            walkway(p0, p1, r, WOOD, RAIL, CLOTH);
          }
        }

        // Scaffold cages climb the lane faces of three dorm slabs.

        for (const g of [at(0, 1), at(2, 0), at(1, 1)]) scaffoldFace(g, g.j ? -1 : 1, .45 + r() * .3, r, POLE, WOOD, CLOTH);

        // The Polecats tag: a polecat curled round a concave spire, sprayed big on the tallest outer wall that faces the Root.

        const [fx, fz] = faceTo(STALK.x, STALK.y), ry = Math.atan2(fx, fz);
        const open = g => g.bw > 10 && (fx ? g.i === (fx > 0 ? 2 : 0) : g.j === (fz > 0 ? 1 : 0));
        const big = grid.filter(open).reduce((m, b) => (b.h > m.h ? b : m));
        const out = (fx ? big.bw : big.bd) / 2 + .45, R = Math.min(fx ? big.bd : big.bw, big.h * .6);
        const tx = big.bx + fx * out, tz = big.bz + fz * out, ty = big.h - R / 2 - 5;
        H.panel(polecatTex(), tx, ty, tz, R, R, ry, 1.7);
        for (const s of [-1, 1]) glow(tx + fz * s * R * .45 + fx * 1.2, ty - R / 2 - .5, tz + fx * s * R * .45 + fz * 1.2, .6, .4, .6, dim(PINK, .8));
        pool(tx + fx * 6, tz + fz * 6, 12, dim(PINK, .15));

        // Polecats murals on the lower walls, on the faces that show to the street.

        const tex = ['POLECATS', 'EASTSIDE', 'BARRANCOS'].map((t, k) => muralTex(H.hash(k, 53), t));
        for (const g of grid) if (g.bw > 10) for (const [ux, uz] of [[0, g.j ? 1 : -1], [g.i === 0 ? -1 : g.i === 2 ? 1 : 0, 0]]) {
          if (!ux && !uz) continue;
          const span = ux ? g.bd : g.bw, mw = Math.min(span * .85, 20), mh = mw * .6;
          const o = (ux ? g.bw : g.bd) / 2 + .35, along = (r() - .5) * (span - mw) * .8;
          if (g === big && ux === fx && uz === fz) continue;
          H.panel(pick(r, tex), g.bx + ux * o + uz * along, 3 + mh / 2, g.bz + uz * o + ux * along, mw, mh, Math.atan2(ux, uz), 1.3);
        }
        for (let k = 0; k < 8; k++) {
          const b = pick(r, grid);
          flickerGlow(b.bx + (r() - .5) * b.bw, 3 + r() * b.h * .8, b.bz + b.bd / 2 + .3, .5, .5, .3, dim(WARM, 1.6), r);
        }
        return { face: [fx, fz] };
      },
    },

    // SlotWhizz: a chinquieros hall in a tower base on the Root approach. A mascot of gold balls
    // tumbles down the facade from the plaza overhang to the door on a loop.

    fs_slotwhizz: {
      at: [800, 158], label: 'SlotWhizz', minSide: 40, reach: 450, labelY: 128, face: [0, 1],
      build(x, z, w, d, st, r) {

        // The tower sits back on the block so the 17 m plaza overhang stays off the street.

        const S = look(st, [.05, .05, .06], [1, .85, .6], .3, .3), tw = Math.min(w, 56), td = Math.min(d * .55, 48);
        const tz = z + d / 2 - 17 - td / 2;
        bld(x, tz, tw, td, 119, S, r, { skin: SKINS.bands });

        // Plaza overhang at 56 m and the bright door notch below it.

        const fz = tz + td / 2;
        prop('box', x, 56, fz + 8.5, tw + 14, 2, 17, [.07, .07, .08]);
        glow(x, 54.9, fz + 17, tw + 14, .6, .6, dim(GOLD, .8));
        glow(x, 5.6, fz + .3, 14, 11, .3, dim(GOLD, .9));
        glow(x, 11.8, fz + .5, 17, .7, .7, PINK);
        pool(x, fz + 11, 20, dim(GOLD, .12));
        textSign('SLOTWHIZZ', x, 62, fz + 17.4, 34, 8.4, 0, GOLD);
        textSign('ARDCOIN PRIZES', x + tw * .3, 17, fz + .5, 14, 3.4, 0, [.4, 1.6, 2]);
        for (const s of [-1, 1]) glow(x + s * (tw / 2 + .3), 28, fz + .3, .7, 53, .7, dim(GOLD, .6));

        // Mascot balls fall in a zigzag. update() moves them.

        FALL.top = 56; FALL.bottom = 7; FALL.front = fz + 2.8; FALL.span = tw * .35;
        for (let k = 0; k < 7; k++) {
          const m = new THREE.Mesh(ballGeo, ballMat);
          m.scale.setScalar(2.24);
          m.userData.off = k / 7;
          H.decor.add(m);
          balls.push(m);
        }
      },
      update(t) {
        const H0 = FALL.top - FALL.bottom;
        for (const m of balls) {
          const f = (t * .12 + m.userData.off) % 1, y = FALL.top - f * H0;
          m.position.set(Math.sin(f * Math.PI * 6) * FALL.span, y + Math.abs(Math.sin(f * Math.PI * 12)) * 2.8, FALL.front);
        }
      },
    },

    // Cayambe Geo Labs: a walled contract-lab compound on bare volcanic rock, east of the Root.
    // Black plasteel walls with a slick sheen, corner floods, a drill rig with a red beacon.

    fs_geolabs: {
      at: [945, 155], label: 'Cayambe Geo Labs', minSide: 44, reach: 450, labelY: 70, face: [0, 1],
      build(x, z, w, d, st, r) {
        const WALL = [.02, .022, .028], hw = w / 2 - 2, hd = d / 2 - 2;
        prop('box', x, .2, z, w, .4, d, [.06, .05, .045]);
        for (const [fx, fz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          prop('box', x + fx * hw, 5, z + fz * hd, fx ? 1.2 : w - 4, 10, fx ? d - 4 : 1.2, WALL);
          glow(x + fx * (hw + .7), 9.6, z + fz * (hd + .7), fx ? .1 : w - 4, .2, fx ? d - 4 : .1, [.5, .55, .7]);
        }
        for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          prop('box', x + sx * hw, 7, z + sz * hd, 3, 14, 3, WALL);
          glow(x + sx * hw, 14.5, z + sz * hd, 1.4, .8, 1.4, [2, 2, 2.2]);
          pool(x + sx * (hw - 6), z + sz * (hd - 6), 12, [.2, .2, .22]);
        }
        glow(x, 5, z + hd + .7, 6, 6, .2, [.9, 1, 1.2]);

        // Low lab blocks inside, one with Jinteki red marks.

        const S = look(st, [.08, .085, .09], COLD, .5, .2);
        for (const [ox, oz, bw, bd, h] of [[-.25, -.25, .32, .3, 12], [.25, -.25, .3, .34, 9], [-.25, .25, .3, .3, 7]]) {
          bld(x + ox * w, z + oz * d, bw * w, bd * d, h, S, r, { skin: SKINS.bands });
        }
        glow(x - .25 * w, 10, z + .25 * d + .15 * d + .2, .15 * d, .8, .2, [2, .15, .12]);
        textSign('JINTEKI', x - .25 * w, 6, z + .25 * d + .15 * d + .3, 10, 2.4, 0, [2, .2, .15]);

        // Drill rig at the centre over the shaft to the deep labs.

        const rx = x + .22 * w, rz = z + .22 * d;
        prop('cyl', rx, .6, rz, 12, 1.2, 12, [.08, .08, .09]);
        prop('lattice', rx, 22, rz, 7, 44, 7);
        prop('box', rx, 30, rz, 1.4, 60, 1.4, [.12, .11, .1]);
        put(GLOWS.ring, rx, 1.4, rz, 13, 1, 13, 0, 0, [1.6, .9, .3]);
        beacon(rx, 45, rz, r);
        puff(rx, 50, rz, 5, [.16, .15, .15]);
      },
    },

    // Spurline Storage Warrens: a sprawl of rental storage cubes beside the freight spur out of the Root.
    // Stacks up to six high, lit service aisles, gantry cranes over the lanes, Weyland trim,
    // and cargo drones that shift boxes from stack to stack.

    fs_warrens: {
      at: [765, 205], label: 'Spurline Storage Warrens', minSide: 48, reach: 500, labelY: 48, face: [0, 1],
      build(x, z, w, d, st, r) {
        const C = 6.5, nx = Math.floor(w / C), nz = Math.floor(d / C), x0 = x - nx * C / 2, z0 = z - nz * C / 2;
        const YEL = [1.8, 1.3, .2], TRIM = [.35, .8, .5], tops = [];
        prop('box', x, .15, z, w, .3, d, [.04, .04, .045]);
        for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
          if (i % 4 === 3 || j % 3 === 2) continue;
          const n = 2 + Math.floor(r() * 5), h = n * 6, g = .1 + r() * .05;
          const cx = x0 + (i + .5) * C, cz = z0 + (j + .5) * C;
          const tint = r() < .25 ? pick(r, [[.2, .1, .06], [.07, .12, .14], [.12, .14, .1]]) : [g, g, g * 1.05];
          prop('box', cx, h / 2, cz, C - .6, h, C - .6, tint);
          if (r() < .7) glow(cx + (r() < .5 ? -1 : 1) * (C / 2 - .2), 2 + Math.floor(r() * n) * 6, cz, .1, .25, .25, YEL);
          if (r() < .5) glow(cx, 2 + Math.floor(r() * n) * 6, cz + (C / 2 - .2), .25, .25, .1, YEL);
          tops.push([cx, cz, h]);
        }

        // Lit service aisles along the gaps, floor strips and lamps overhead.

        for (let i = 3; i < nx; i += 4) {
          const ax = x0 + (i + .5) * C;
          glow(ax, .4, z, .3, .1, nz * C, dim(YEL, .5));
          for (let k = 0; k < 4; k++) glow(ax, 9, z0 + (k + .5) * nz * C / 4, .8, .3, .8, dim(COLD, 1.2));
          pool(ax, z, C * .8, dim(YEL, .08));
        }
        for (let j = 2; j < nz; j += 3) glow(x, .4, z0 + (j + .5) * C, nx * C, .1, .3, dim(YEL, .5));

        // Gantry cranes span the block on lattice legs, each with a lit trolley.

        for (const t of [.25, .6, .9]) {
          const gz = z0 + t * nz * C, gy = 40;
          for (const s of [-1, 1]) prop('lattice', x + s * (nx * C / 2 + 1), gy / 2, gz, 2, gy, 2);
          beam([x - nx * C / 2 - 1, gy, gz], [x + nx * C / 2 + 1, gy, gz], 1.4, [.14, .15, .13]);
          const tx = x + (r() - .5) * nx * C * .7;
          prop('box', tx, gy - 1.6, gz, 3, 2, 3, [.2, .17, .06]);
          glow(tx, gy - 2.8, gz, 1, .3, 1, YEL);
        }

        // Weyland green-grey trim round the edge, a few vents steaming.

        for (const [fx, fz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          glow(x + fx * (nx * C / 2 + .2), 18.5, z + fz * (nz * C / 2 + .2), fx ? .2 : nx * C, .6, fx ? nz * C : .2, TRIM);
        }
        textSign('WEYLAND STORAGE', x, 21, z + nz * C / 2 + .4, 22, 3.6, 0, [.5, 1.3, .8]);
        for (let k = 0; k < 6; k++) puff(x0 + r() * nx * C, 20 + r() * 4, z0 + r() * nz * C, 2 + r() * 2, [.14, .14, .15]);

        // Cargo drones shuttle boxes between nearby stack tops. They get their own meshes in the landmark
        // group, because shared instances are frozen into tiles after the build.

        for (let k = 0; k < 8 && tops.length > 1; k++) {
          const a = pick(r, tops), near = tops.filter(b => b !== a && Math.hypot(b[0] - a[0], b[1] - a[1]) < 40);
          if (near.length) DRONES.push({ a, b: pick(r, near), ph: r() * 2, sp: .07 + r() * .03 });
        }
        const n = DRONES.length;
        if (!n) return;
        DRN.box = new THREE.InstancedMesh(H.PROPS.box.geometry, H.PROPS.box.material, n * 2);
        DRN.light = new THREE.InstancedMesh(GLOWS.sphere.geometry, GLOWS.sphere.material, n);
        for (let i = 0; i < n; i++) {
          DRN.box.setColorAt(i * 2, DRN_C.setRGB(.06, .065, .07));
          DRN.box.setColorAt(i * 2 + 1, DRN_C.setRGB(...pick(r, [[.3, .14, .05], [.08, .16, .2], [.2, .2, .08]])));
          DRN.light.setColorAt(i, DRN_C.setRGB(...YEL));
        }
        for (const m of [DRN.box, DRN.light]) { m.userData.noTile = true; m.frustumCulled = false; H.decor.add(m); }
      },
      update(t) {
        if (!DRN.box) return;

        // Each leg runs stack P to stack Q. The drone drops onto the box, lifts it on an arc, sets it down and climbs.
        // Odd legs run back, so the loop is seamless.

        DRONES.forEach((q, i) => {
          const f2 = (t * q.sp + q.ph) % 2, g = f2 % 1, [P, Q] = f2 < 1 ? [q.a, q.b] : [q.b, q.a];
          let bx, by, bz, dy;
          if (g < .2) { bx = P[0]; bz = P[1]; by = P[2] + 1.2; dy = 8 * (1 - g / .2); }
          else if (g < .8) {
            const u = (g - .2) / .6, e = u * u * (3 - 2 * u);
            bx = lerp(P[0], Q[0], e); bz = lerp(P[1], Q[1], e); by = lerp(P[2], Q[2], e) + 1.2 + Math.sin(Math.PI * u) * 14; dy = 0;
          } else { bx = Q[0]; bz = Q[1]; by = Q[2] + 1.2; dy = 8 * (g - .8) / .2; }
          const yy = by + 1.9 + dy;
          DRN_O.position.set(bx, yy, bz); DRN_O.scale.set(3.4, .6, 3.4); DRN_O.updateMatrix(); DRN.box.setMatrixAt(i * 2, DRN_O.matrix);
          DRN_O.position.set(bx, by, bz); DRN_O.scale.setScalar(2.4); DRN_O.updateMatrix(); DRN.box.setMatrixAt(i * 2 + 1, DRN_O.matrix);
          DRN_O.position.set(bx, yy - .5, bz); DRN_O.scale.setScalar(.6); DRN_O.updateMatrix(); DRN.light.setMatrixAt(i, DRN_O.matrix);
        });
        DRN.box.instanceMatrix.needsUpdate = DRN.light.instanceMatrix.needsUpdate = true;
      },
    },

    // Chakana Public Library: the oldest building in El Centro Historico. Stone, tall arched windows,
    // a lit lantern cupola, and a blue screen glow in the back room where the runners work.

    fs_library: {
      at: [800, 240], label: 'Chakana Public Library', minSide: 36, reach: 450, labelY: 34, face: [0, 1],
      build(x, z, w, d, st, r) {
        const S = look(st, [.2, .18, .15], [1, .8, .45], .15, .7), bw = Math.min(w, 48), bd = Math.min(d, 34);
        bld(x, z, bw, bd, 15, S, r, { roof: false, skin: SKINS.sparse, kibble: false });
        prop('box', x, 15.4, z, bw + 1.5, .8, bd + 1.5, [.16, .14, .12]);

        // Arched windows on the front and the sides.

        for (let k = -3; k <= 3; k++) {
          const px = x + k * bw / 8;
          glow(px, 7, z + bd / 2 + .2, 2.4, 7, .2, dim(WARM, .7));
          put(GLOWS.sphere, px, 10.5, z + bd / 2 + .2, 2.4, 2.4, .3, 0, 0, dim(WARM, .7));
        }
        for (const s of [-1, 1]) for (let k = -1; k <= 1; k++) glow(x + s * (bw / 2 + .2), 7, z + k * bd / 4, .2, 7, 2.2, dim(WARM, .6));
        glow(x, 2.5, z + bd / 2 + .3, 3, 5, .2, dim(WARM, 1.2));
        textSign('BIBLIOTECA PUBLICA', x, 13.4, z + bd / 2 + .3, 14, 1.8, 0, [1.2, 1, .7]);

        // Lantern cupola that reads from a distance.

        prop('cyl', x, 17.5, z, 9, 3.4, 9, [.18, .16, .14]);
        glow(x, 21, z, 6, 4, 6, dim(WARM, 1.4));
        prop('cone', x, 25, z, 8, 4, 8, [.12, .2, .16]);
        put(GLOWS.ring, x, 19.4, z, 10, 1, 10, 0, 0, dim(WARM, 1.2));

        // Runners' den in the back corner.

        glow(x + bw / 2 - 5, 4, z - bd / 2 - .2, 8, 3, .2, [.6, 1.1, 2.2]);
        glow(x + bw / 2 + .2, 4, z - bd / 2 + 5, .2, 3, 8, [.6, 1.1, 2.2]);
      },
    },

    // Drone On: Gertie's painted container workshop on the derelict east bank of the Waterways.
    // Behind it, junk fields under a dead expressway deck whose standby spotlights look like stars.

    fs_droneon: {
      at: [1180, 1470], label: 'Drone On & the Junk Flats', minSide: 40, reach: 500, labelY: 40, face: [0, 1],
      build(x, z, w, d, st, r) {
        const DECK = 30, CONC = [.08, .075, .07];
        prop('box', x, .15, z, w, .3, d, [.035, .03, .028]);

        // Expressway deck over the back two-thirds on big pillars, with standby lamps underneath.

        const dz0 = z - d / 2, dd = d * .7;
        prop('box', x, DECK, dz0 + dd / 2, w, 2.4, dd, CONC);
        for (const sx of [-.35, 0, .35]) for (const sz of [.2, .7]) prop('cyl', x + sx * w, DECK / 2, dz0 + sz * dd, 4, DECK, 4, CONC);
        for (let k = 0; k < 40; k++) glow(x + (r() - .5) * w * .95, DECK - 1.4, dz0 + r() * dd, .3, .2, .3, [1.3, 1.3, 1.4]);

        // E-waste mounds and container stacks.

        const CONT = [[.3, .12, .08], [.1, .2, .3], [.25, .22, .1], [.12, .2, .12]];
        for (let k = 0; k < 18; k++) {
          const s = 4 + r() * 7;
          prop('cone', x + (r() - .5) * w * .9, s * .25, dz0 + r() * dd, s * 2, s * .5, s * 2, [.06, .055, .05], r() * 6);
        }
        for (let k = 0; k < 6; k++) {
          const px = x + (r() - .5) * w * .8, pz = dz0 + r() * dd, n = 1 + Math.floor(r() * 3), a = r() * 3;
          for (let j = 0; j < n; j++) prop('box', px, 1.3 + j * 2.6, pz, 2.5, 2.5, 12, pick(r, CONT), a);
        }

        // Scavenger drones over the field.

        for (let k = 0; k < 7; k++) flickerGlow(x + (r() - .5) * w * .8, 6 + r() * 16, dz0 + r() * dd, .6, .3, .6, pick(r, [[.3, 1.8, .6], [1.8, .3, .3], [.5, .9, 2]]), r);

        // The workshop: one loud container with pink and green neon edges.

        const cx = x, cz = z + d / 2 - 8;
        prop('box', cx, 1.4, cz, 12.2, 2.8, 2.5, [.45, .1, .35]);
        glow(cx, 2.9, cz + 1.3, 12.2, .2, .2, PINK);
        glow(cx, .2, cz + 1.3, 12.2, .2, .2, LIME);
        for (const s of [-1, 1]) glow(cx + s * 6.1, 1.5, cz + 1.3, .2, 2.8, .2, LIME);
        glow(cx + 2, 1.3, cz + 1.3, 3, 2, .1, dim(WARM, 1.2));
        textSign('DRONE ON', cx, 4.8, cz + 1.3, 9, 2.2, 0, LIME);
        stringLights([cx - 8, 4, cz + 4], [cx + 8, 4, cz + 4], .6, 8, dim(WARM, 1.4));
        pool(cx, cz + 5, 9, dim(PINK, .12));
      },
    },

    // Jackson Howard Executive Prep and PS'71 in Laguna Velasco. The prep school stands on a lawn deck
    // with a gold art deco front. The public school sits in the shade under the deck lip.

    fs_schools: {
      at: [600, 800], label: "Jackson Howard Prep & PS'71", minSide: 44, reach: 500, labelY: 62, face: [0, 1],
      build(x, z, w, d, st, r) {
        const DECK = 22, fz = d / 2;
        prop('box', x, .15, z, w, .3, d, [.04, .04, .045]);

        // PS'71: a plain grey slab under the deck, cold tube light.

        const P = look(st, [.13, .13, .14], [.75, .9, 1], .7, .6);
        bld(x, z + fz - 8, w * .8, 12, 12, P, r, { roof: false, skin: SKINS.bands, kibble: false });
        textSign("PS'71", x - w * .3, 9, z + fz - 1.8, 6, 2, 0, [.8, .9, 1]);
        pool(x, z + fz + 4, 14, [.12, .14, .16]);

        // Lawn deck on columns, with sunset-orange edge light.

        prop('box', x, DECK, z - 2, w, 1.6, d - 4, [.07, .075, .07]);
        prop('box', x, DECK + .9, z - 2, w - 2, .2, d - 6, [.05, .12, .05]);
        for (const sx of [-.4, 0, .4]) for (const sz of [-.35, .1]) prop('cyl', x + sx * w, DECK / 2, z + sz * d, 2.6, DECK, 2.6, [.1, .1, .1]);
        glow(x, DECK - .9, z + fz - 4 + .1, w, .3, .3, [1.6, .7, .3]);

        // Jackson Howard: wood-brown front, gold deco fins, arched gold marquee.

        const J = look(st, [.2, .12, .07], [1.1, .85, .5], .55, .1), jw = w * .7, jd = d * .4, jz = z - d * .15;
        bld(x, jz, jw, jd, 28, J, r, { y0: DECK + 1, skin: SKINS.fins, kibble: false });
        for (let k = -3; k <= 3; k++) glow(x + k * jw / 7, DECK + 15, jz + jd / 2 + .3, .4, 26, .4, dim(GOLD, .7));
        put(GLOWS.ring, x, DECK + 9, jz + jd / 2 + .5, 14, 1, 14, 0, Math.PI / 2, GOLD);
        textSign('JACKSON HOWARD', x, DECK + 17, jz + jd / 2 + .6, 16, 3, 0, GOLD);

        // Holo sculptures on the deck edge and toy drones over the drop.

        for (let k = -2; k <= 2; k++) {
          const px = x + k * w * .18, pz = z + fz - 7;
          prop('cyl', px, DECK + 1.5, pz, 1.4, 1.2, 1.4, [.2, .2, .22]);
          glow(px, DECK + 3.5, pz, .9, 2.8, .9, [.4, 1.4, 2]);
        }
        for (let k = 0; k < 6; k++) flickerGlow(x + (r() - .5) * w * .8, 8 + r() * 12, z + fz + 1 + r() * 5, .5, .25, .5, [2, .3, .3], r);
      },
    },

    // Builders' Playground: a play park from the Beanstalk camp days, hemmed in by burned-out Stalingrad
    // blocks and gangplanks. Maintenance lamps wash it flat white. A rusty rocket climber stands in the middle.

    fs_playground: {
      at: [480, 930], label: "Builders' Playground", minSide: 40, reach: 450, labelY: 34,
      build(x, z, w, d, st, r) {
        const RUST = [.32, .13, .06], WHITE = [1.5, 1.5, 1.45], R = Math.min(w, d) * .3;
        prop('box', x, .15, z, w, .3, d, [.04, .04, .04]);

        // Burned husks on the corners, gangplanks over the top.

        const S = look(st, [.08, .075, .07], [.6, .7, .8], .05, 1);
        const husks = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [x + sx * w * .36, z + sz * d * .36]);
        for (const [hx, hz] of husks) {
          bld(hx, hz, w * .26, d * .26, 18 + r() * 10, S, r, { skin: SKINS.sparse });
          glow(lerp(hx, x, .3), 16, lerp(hz, z, .3), 1.6, .6, 1.6, WHITE);
        }
        for (let k = 0; k < 4; k++) {
          const a = husks[k], b = husks[(k + 1) % 4], y = 12 + r() * 4;
          beam([a[0], y, a[1]], [b[0], y, b[1]], .8, [.12, .1, .08]);
          const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          glow(m[0], y - .6, m[1], .8, .4, .8, WHITE);
        }

        // Turf, the white wash and dark tree clumps round the edge.

        prop('cyl', x, .35, z, R * 2, .3, R * 2, [.06, .16, .05]);
        pool(x, z, R * 1.3, [.35, .38, .34]);
        for (let k = 0; k < 9; k++) {
          const a = k / 9 * Math.PI * 2 + r() * .3, s = 3 + r() * 3;
          prop('cone', x + Math.cos(a) * R * .9, s, z + Math.sin(a) * R * .9, s * 1.4, s * 2, s * 1.4, [.03, .08, .03]);
        }

        // Rocket climber with fins and a faint glow at the nose cone.

        const rx = x - R * .25, rz = z;
        prop('cyl', rx, 5, rz, 3, 10, 3, RUST);
        prop('cone', rx, 11.5, rz, 3, 3, 3, RUST);
        for (const [fx, fz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) prop('box', rx + fx * 2, 1.5, rz + fz * 2, fx ? 1.4 : .2, 3, fx ? .2 : 1.4, RUST);
        put(GLOWS.sphere, rx, 13.4, rz, .7, .7, .7, 0, 0, [1.6, .5, .3]);

        // Swing frame.

        const sx = x + R * .4, sz = z + R * .2;
        for (const s of [-1, 1]) {
          beam([sx - 3, 0, sz + s * 1.4], [sx, 3.6, sz], .2, RUST);
          beam([sx + 3, 0, sz + s * 1.4], [sx, 3.6, sz], .2, RUST);
        }
        beam([sx - 3, 3.6, sz], [sx + 3, 3.6, sz], .2, RUST);
        for (const s of [-1.2, 1.2]) prop('box', sx + s, 2, sz, .1, 3.2, .1, [.2, .2, .2]);

        // Animal eyes in the trees.

        for (let k = 0; k < 4; k++) {
          const a = r() * Math.PI * 2;
          glow(x + Math.cos(a) * R * .85, .8, z + Math.sin(a) * R * .85, .3, .12, .3, [.6, 1.6, .4]);
        }
      },
    },
  };
}
