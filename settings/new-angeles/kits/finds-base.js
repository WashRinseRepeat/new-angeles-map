// Landmarks from the Tour Guide and Akeidito finds in Base de Cayambe. See design/pdf-finds/.

export const kits = () => ({});

export function landmarks(H) {
  const { GLOWS, SKINS, beacon, beam, bld, glow, helipad, holo, pool, prop, puff, put, textSign, flickerGlow, stringLights } = H;

  // Base palette: brown grime, sodium streets, warm windows. NAPD blue is the one cold light in the district.

  const SODIUM = [1.6, .7, .12], WARM = [1.4, .9, .45], AMBER = [1.5, .95, .35], FLOOD = [1.7, 1.5, 1];
  const NAPD = [.45, .7, 1.6], ICE = [1.2, 1.3, 1.6], RED = [1.9, .12, .08];
  const PINK = [1.9, .25, 1.1], VIOLET = [.9, .3, 1.8], TEAL = [.2, 1.5, 1.4];
  const CONCRETE = [.11, .1, .09], RUST = [.16, .08, .045], STEEL = [.09, .09, .1], DARK = [.035, .033, .032];
  const dim = (c, k) => c.map(v => v * k);
  const brick = st => ({ ...st, base: [.15, .1, .075], win: [1, .62, .22], lit: .35, grime: .7 });

  // Long-axis helper: a runs along the longer side, b across it. P maps (a, b) to the local frame.

  const axes = (x, z, w, d) => {
    const alongZ = d >= w;
    return { L: alongZ ? d : w, S: alongZ ? w : d, alongZ, ry: alongZ ? 0 : Math.PI / 2,
      P: (a, b) => alongZ ? [x + b, z + a] : [x + a, z + b] };
  };

  // Tower crane: lattice mast, jib with counter-jib, a red tip beacon and a hook line.

  // Moving parts live in their own meshes in the landmark group, because shared instances are frozen into tiles
  // after the build. A part is [x, y, z, sx, sy, sz, rgb, rx, rz] round the mesh's pivot.

  const { THREE, PROPS } = H, _o = new THREE.Object3D(), _c = new THREE.Color();
  const mover = (src, x, y, z, parts) => {
    const m = new THREE.InstancedMesh(src.geometry, src.material, parts.length);
    parts.forEach(([px, py, pz, sx, sy, sz, rgb, rx = 0, rz = 0], i) => {
      _o.position.set(px, py, pz); _o.rotation.set(rx, 0, rz); _o.scale.set(sx, sy, sz); _o.updateMatrix();
      m.setMatrixAt(i, _o.matrix); m.setColorAt(i, _c.setRGB(...rgb));
    });
    m.position.set(x, y, z); m.userData.noTile = true; m.frustumCulled = false;
    H.decor.add(m);
    return m;
  };
  const SLEW = {}, CLOCK = {}, _w = new THREE.Object3D();
  _w.rotation.order = 'YXZ';

  // A slewing crane keeps its mast in the shared meshes. Jib, ties, hook and tip light turn as one in their own meshes.

  const slewCrane = (cx, cz, h, jib, a, r) => {
    prop('lattice', cx, h / 2, cz, 3, h, 3);
    beacon(cx, h + 7, cz, r);
    const hy = h * (.4 + r() * .4), tie = Math.hypot(6, jib);
    SLEW.arm = mover(PROPS.box, cx, 0, cz, [
      [0, h, jib * .35, 1.2, 1.2, jib * 1.3, dim([1.2, .9, .2], .25)],
      [0, h - 1, -jib * .28, 4, 3, 4, CONCRETE],
      [0, h + 3, jib / 2, .2, .2, tie, STEEL, Math.asin(6 / tie)],
      [0, (h + hy) / 2, jib * .6, .1, h - hy, .1, STEEL],
      [0, hy - 1, jib * .6, 2, 2, 6, [.2, .16, .08]],
    ]);
    SLEW.tip = mover(GLOWS.sphere, cx, 0, cz, [[0, h + .8, jib, .9, .9, .9, [2.2, .08, .04]]]);
    SLEW.a = a;
  };

  const crane = (cx, cz, h, jib, a, r) => {
    prop('lattice', cx, h / 2, cz, 3, h, 3);
    const sx = Math.sin(a), sz = Math.cos(a);
    beam([cx - sx * jib * .3, h, cz - sz * jib * .3], [cx + sx * jib, h, cz + sz * jib], 1.2, dim([1.2, .9, .2], .25));
    prop('box', cx - sx * jib * .28, h - 1, cz - sz * jib * .28, 4, 3, 4, CONCRETE, a);
    beam([cx, h + 6, cz], [cx + sx * jib, h, cz + sz * jib], .2, STEEL);
    const hx = cx + sx * jib * .6, hz = cz + sz * jib * .6, hy = h * (.4 + r() * .4);
    beam([hx, h, hz], [hx, hy, hz], .1, STEEL);
    prop('box', hx, hy - 1, hz, 2, 2, 6, [.2, .16, .08], a);
    beacon(cx + sx * jib, h + .8, cz + sz * jib, r);
    beacon(cx, h + 7, cz, r);
  };

  // ---------- Neo-Broadway: Watts-Watson's half-built towers ----------
  // A tower is glazed and lit up to fin, then runs on as a bare frame to top. A climbing rig rides a live frame:
  // a deck wider than the tower with its own crane, one of the machines Weyland built the Beanstalk with.
  // Welding sparks fall from its underside in bursts. A paused frame is rusted, dark and wrapped in torn sheeting.

  const WW_GLASS = { base: [.08, .09, .11], win: [.55, .7, .9], lit: .28, grime: .4 }, WW_YELLOW = [1.6, 1.15, .15];

  function wwTower(cx, cz, s, fin, top, st, r, { rig = true, paused = false } = {}, sparks = []) {
    if (fin > 0) bld(cx, cz, s, s, fin, { ...st, ...WW_GLASS }, r, { roof: false, skin: SKINS.curtain, kibble: false });
    const col = paused ? RUST : [.16, .15, .13], span = top - fin;
    for (const ax of [-1, 0, 1]) for (const az of [-1, 0, 1]) if (ax || az) prop('box', cx + ax * s / 2, fin + span / 2, cz + az * s / 2, 1.1, span, 1.1, col);

    // Floors are edge beams round open bays. The lower half of the frame also has its concrete poured.

    for (let y = fin + 4.5; y <= top; y += 4.5) {
      for (const sd of [-1, 1]) {
        prop('box', cx, y, cz + sd * s / 2, s + 1, .5, .6, dim(col, .8));
        prop('box', cx + sd * s / 2, y, cz, .6, .5, s + 1, dim(col, .8));
      }
      if (y < fin + span * .45) prop('box', cx, y - .3, cz, s - 1, .3, s - 1, dim(CONCRETE, 1.3));
    }
    if (paused) {
      for (let y = fin + 12; y < top - 8; y += 13) for (const [fx, fz] of [[0, 1], [1, 0]]) if (r() < .7) {
        const len = s * (.4 + r() * .6), off = (r() - .5) * (s - len);
        prop('box', cx + fx * (s / 2 + .8) + fz * off, y, cz + fz * (s / 2 + .8) + fx * off, fz ? len : .2, 8 + r() * 5, fx ? len : .2, [.12, .12, .13]);
      }
      return;
    }

    // Work floodlights two floors under the top, and a lit hoist up one face.

    for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) glow(cx + ax * s * .45, top - 5, cz + az * s * .45, 1.4, .8, 1.4, FLOOD);
    glow(cx + s / 2 + 1.4, (fin + top) / 2, cz, .6, span * .9, .6, dim(SODIUM, .45));
    if (!rig) return;

    // The rig: a yellow-banded deck over the top floors, a crane on it, sparks under its rim.

    const y0 = top - 9, w = s + 8;
    prop('box', cx, y0 + 6, cz, w, 12, w, [.17, .15, .09]);
    for (const [fx, fz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const gx = cx + fx * (w / 2 + .1), gz = cz + fz * (w / 2 + .1), lx = fz ? w : .15, lz = fx ? w : .15;
      glow(gx, y0 + .4, gz, lx, .6, lz, dim(WW_YELLOW, .75));
      glow(gx, y0 + 11.6, gz, lx, .4, lz, dim(WW_YELLOW, .5));
      glow(gx, y0 + 7, gz, fz ? w * .8 : .15, 1.2, fx ? w * .8 : .15, dim(WARM, .6));
    }
    const mh = 34 + r() * 16, mx = cx + s * .25, mz = cz - s * .25, a = r() * 6.3, jib = 30 + r() * 10;
    prop('lattice', mx, y0 + 12 + mh / 2, mz, 2.6, mh, 2.6);
    beam([mx - Math.sin(a) * jib * .3, y0 + 12 + mh, mz - Math.cos(a) * jib * .3], [mx + Math.sin(a) * jib, y0 + 12 + mh, mz + Math.cos(a) * jib], 1.1, dim(WW_YELLOW, .3));
    beacon(mx, y0 + 12 + mh + 5, mz, r);
    beacon(mx + Math.sin(a) * jib, y0 + 12.8 + mh, mz + Math.cos(a) * jib, r);
    for (let k = 0; k < 3; k++) {
      const ang = r() * 6.3, ex = cx + Math.sin(ang) * w * .48, ez = cz + Math.cos(ang) * w * .48;
      sparks.push([ex, y0 - 1, ez]);
      flickerGlow(ex, y0 - .8, ez, 1.2, .6, 1.2, [1.4, 1.8, 2.6], r);
    }
  }

  // Sparks fall from each point in two-second bursts every five seconds. A spark keeps the burst it was born in.

  function sparkFall(points) {
    const N = 24, n = points.length * N, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.6, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    m.frustumCulled = false; m.userData.noTile = true;
    H.decor.add(m);
    const seed = points.map(() => Math.random() * 10);
    return t => {
      points.forEach(([ex, ey, ez], e) => {
        for (let k = 0; k < N; k++) {
          const i = (e * N + k) * 3, ph = (t * .6 + k / N + seed[e]) % 1, age = ph * 1.8, born = t - age;
          const a = k * 2.399 + seed[e], v = 1.5 + (k % 5);
          pos[i] = ex + Math.cos(a) * v * age; pos[i + 1] = ey - 4.9 * age * age; pos[i + 2] = ez + Math.sin(a) * v * age;
          const b = (born + seed[e]) % 5 < 2 ? 2.6 * (1 - ph) ** 1.5 : 0;
          col[i] = b; col[i + 1] = b * .55; col[i + 2] = b * .15;
        }
      });
      geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = true;
    };
  }
  const WW = {};

  return {

    // NAPD precinct: a fortified slab over a blast-walled podium. Half the floors are dark.

    fbc_precinct: { at: [660, 296], label: 'Base de Cayambe NAPD Precinct', labelY: 158, minSide: 46, reach: 400, build(x, z, w, d, st, r) {
      const cold = { ...st, base: [.08, .085, .1], win: [.75, .88, 1.1], grime: .45 };
      const pw = Math.min(w - 4, 60), pd = Math.min(d - 4, 44), ph = 14;
      bld(x, z, pw, pd, ph, { ...cold, lit: .25 }, r, { roof: false, skin: SKINS.bands });

      // Blast wall in front of the podium with a gated gap.

      const fz = z + pd / 2 + 4;
      for (const s of [-1, 1]) prop('box', x + s * (pw / 4 + 3), 1.6, fz, pw / 2 - 6, 3.2, 1.6, CONCRETE);
      for (const s of [-1, 1]) prop('box', x + s * 5, 1.2, fz + 3, 1.4, 2.4, 1.4, [.25, .22, .1]);
      glow(x, ph - 1.5, z + pd / 2 + .15, pw * .8, .5, .2, NAPD);
      textSign('NAPD BASE DE CAYAMBE', x, ph - 4.5, z + pd / 2 + .3, 30, 4, 0, ICE);
      for (let k = 0; k < 4; k++) flickerGlow(x + (k - 1.5) * 3, 3.5, fz + .9, 1, .5, .3, k % 2 ? RED : dim(NAPD, 1.2), r);

      // Tower in 12 m bands. Dark bands carry no light at all.

      const tw = Math.min(pw * .55, 30), td = Math.min(pd * .7, 26), top = 146;
      let y = ph, n = 0;
      while (y < top) {
        const seg = Math.min(12, top - y), lit = n % 3 === 0 || r() < .35;
        bld(x, z, tw, td, seg, { ...cold, lit: lit ? .55 : 0 }, r, { y0: y, roof: false, skin: SKINS.fins, kibble: false });
        if (lit) for (const s of [-1, 1]) glow(x, y + seg - .6, z + s * (td / 2 + .1), tw * .96, .35, .15, dim(NAPD, .55));
        y += seg; n++;
      }
      prop('box', x, top + .6, z, tw + 2, 1.2, td + 2, STEEL);
      helipad(x, z, Math.min(tw, td) * .8, top + 1.2, r);
      for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) beacon(x + cx * tw / 2, top + 2, z + cz * td / 2, r);

      // Blue-white crown sign on front and back, a cold pool on the street.

      for (const back of [0, 1]) {
        const sz = z + (back ? -1 : 1) * (td / 2 + .3);
        textSign('NAPD', x, top - 6, sz, tw * .9, tw * .22, back ? Math.PI : 0, ICE);
        glow(x, top - 10, sz, tw * .9, .4, .15, NAPD);
      }
      prop('box', x + tw / 2 + 1, top + 8, z, .5, 14, .5, STEEL);
      pool(x, fz + 6, 22, dim(NAPD, .1));
    } },

    // Old City Hall: colonnade, drum and dome, a clock tower, market stalls in the arcade, scaffold on one wing.

    fbc_oldhall: { at: [645, 288], label: 'Old City Hall', labelY: 64, minSide: 46, reach: 400, build(x, z, w, d, st, r) {
      const stone = { ...st, base: [.16, .14, .11], win: [1, .78, .4], lit: .28, grime: .6 };
      const hw = Math.min(w - 6, 76), hd = Math.min(d - 10, 36), hh = 20;
      bld(x, z, hw, hd, hh, stone, r, { roof: false, skin: SKINS.sparse, kibble: false });
      prop('box', x, hh + .5, z, hw + 2, 1, hd + 2, [.13, .12, .1]);
      prop('box', x, 1, z + hd / 2 + 3, hw, 2, 6, [.12, .11, .1]);

      // Grand stair down from the podium, worn steps flanked by two lamp plinths.

      const f = z + hd / 2 + 6;
      for (let i = 0; i < 5; i++) prop('box', x, .2 * (i + 1), f + (5 - i) * .4, 30 - i * 1.2, .4 * (i + 1), (5 - i) * .8, dim([.15, .14, .12], .9 + (i % 2) * .15));
      for (const s of [-1, 1]) {
        prop('box', x + s * 16, 1.2, f + 2, 2.2, 2.4, 4, [.13, .12, .1]);
        prop('cyl', x + s * 16, 4.4, f + 2, .3, 4, .3, DARK);
        put(GLOWS.sphere, x + s * 16, 6.6, f + 2, 1.1, 1.1, 1.1, 0, 0, WARM);
        pool(x + s * 16, f + 3, 7, dim(WARM, .1));
      }

      // Colonnade with a pediment slab, lit amber from below.

      const cz = z + hd / 2 + 4.5, cols = Math.floor(hw / 6);
      for (let k = 0; k <= cols; k++) prop('cyl', x - hw / 2 + 3 + k * (hw - 6) / cols, 2 + 6.5, cz, 1.6, 13, 1.6, [.2, .18, .15]);
      prop('box', x, 15.6, cz, hw, 1.4, 4, [.17, .15, .12]);
      glow(x, 14.6, cz, hw * .95, .3, .2, dim(AMBER, .5));

      // Portico: an attic behind the sign and a stepped pediment with a dim round crest.

      prop('box', x, 17.6, cz - .3, 28, 2.6, 4, [.16, .14, .11]);
      for (const [k, wd] of [[0, 22], [1, 14], [2, 6]]) prop('box', x, 19.5 + k * 1.1, cz - .3, wd, 1.1, 4, [.17, .15, .12]);
      put(GLOWS.sphere, x, 20.1, cz + 1.75, 2.2, 2.2, .1, 0, 0, dim(AMBER, .6));

      // Stalls in the arcade: warm counters, coloured awnings, a line of bulbs.

      for (let k = 0; k < cols; k++) {
        const sx = x - hw / 2 + 3 + (k + .5) * (hw - 6) / cols;
        glow(sx, 2.8, z + hd / 2 + .2, 3.4, 1.6, .2, dim(WARM, .8 + r() * .4));
        prop('box', sx, 4.4, z + hd / 2 + 1.6, 4, .2, 3, [[.4, .1, .06], [.08, .25, .3], [.35, .28, .05]][k % 3]);
      }
      stringLights([x - hw / 2, 7, cz - 1.5], [x + hw / 2, 7, cz - 1.5], 1.2, 16, dim(WARM, .9));
      textSign('MERCADO DEL CABILDO', x, 17.6, cz + 2.1, 24, 2.6, 0, AMBER);

      // Drum and dome. A ring lights the drum top, thin glowing ribs run up the dome to a lit lantern.

      const dy = hh + 18, rib = R => dy - .1246 * R * R + .25;
      bld(x, z, 16, 16, 8, stone, r, { y0: hh + 1, shape: 'cyl', roof: false, skin: SKINS.sparse });
      prop('dish', x, dy, z, 17, 9 / .2, 17, [.2, .19, .17], 0, Math.PI);
      put(GLOWS.ring, x, hh + 9.1, z, 17.2, 1, 17.2, 0, 0, dim(AMBER, .55));
      for (let k = 0; k < 8; k++) {
        const c = Math.cos(k * Math.PI / 4), sn = Math.sin(k * Math.PI / 4), R = [8.5, 6.6, 4.4, 1.6];
        for (let j = 0; j < 3; j++)
          beam([x + c * R[j], rib(R[j]), z + sn * R[j]], [x + c * R[j + 1], rib(R[j + 1]), z + sn * R[j + 1]], .16, dim(AMBER, .3), 'glow');
      }
      put(GLOWS.sphere, x, dy + 1.4, z, 2.2, 2.6, 2.2, 0, 0, dim(WARM, .8));
      for (let k = 0; k < 6; k++) prop('box', x + Math.cos(k * Math.PI / 3) * 1.25, dy + 1.4, z + Math.sin(k * Math.PI / 3) * 1.25, .3, 2.8, .3, [.15, .13, .1]);
      prop('cone', x, dy + 3.4, z, 3, 1.4, 3, [.18, .16, .13]);
      prop('box', x, dy + 5, z, .25, 2, .25, STEEL);

      // Clock tower at one end: round lit faces on front and back with dark hour dots, a belfry above.

      const tx = x + hw / 2 - 6, th = 46, BRONZE = [.6, .4, .14];
      bld(tx, z, 9, 9, th - hh, stone, r, { y0: hh, roof: false, skin: SKINS.sparse, kibble: false });
      for (const s of [-1, 1]) {
        put(GLOWS.sphere, tx, th - 4, z + s * 4.6, 5, 5, .2, 0, 0, dim(AMBER, .75));
        put(GLOWS.ring, tx, th - 4, z + s * 4.72, 5.6, 1, 5.6, 0, Math.PI / 2, dim(AMBER, 1.3));
        for (let h = 0; h < 12; h++) {
          const q = h * Math.PI / 6, sz = h % 3 ? .22 : .42;
          prop('box', tx + Math.sin(q) * 2.15, th - 4 + Math.cos(q) * 2.15, z + s * 4.72, sz, sz, .05, DARK);
        }
      }

      // Belfry: open on four sides between corner piers, three bells on a headstock, a warm bulb below them.

      prop('box', tx, th + .3, z, 9.6, .6, 9.6, [.13, .12, .1]);
      for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) prop('box', tx + cx * 3.7, th + 4, z + cz * 3.7, 1.6, 7.4, 1.6, [.17, .15, .12]);
      for (const s of [-1, 1]) for (const rot of [0, Math.PI / 2]) {
        const ox = rot ? s * 3.7 : 0, oz = rot ? 0 : s * 3.7;
        prop('box', tx + ox, th + 7.2, z + oz, 5.8, .8, .9, [.15, .13, .11], rot);
      }
      prop('box', tx, th + 8, z, 9.6, .8, 9.6, [.13, .12, .1]);
      prop('box', tx, th + 6.6, z, 7, .45, .45, STEEL);
      prop('cone', tx, th + 4.9, z, 2.8, 3, 2.8, BRONZE);
      prop('cyl', tx, th + 3.45, z, 2.9, .25, 2.9, BRONZE);
      for (const s of [-1, 1]) prop('cone', tx + s * 2.3, th + 5.6, z, 1.2, 1.5, 1.2, BRONZE);
      put(GLOWS.sphere, tx, th + 1.5, z, .5, .5, .5, 0, 0, WARM);

      // The bulb catches the bell lips, so the bells read from the street.

      for (const [bx, by, bs] of [[0, 3.3, 3], [-2.3, 4.85, 1.25], [2.3, 4.85, 1.25]]) put(GLOWS.ring, tx + bx, th + by, z, bs, 1, bs, 0, 0, dim(AMBER, .7));
      bld(tx, z, 8.6, 8.6, 6, stone, r, { y0: th + 8.4, shape: 'pyr', roof: false });
      prop('box', tx, th + 15.6, z, .25, 2.4, .25, STEEL);

      // Hour, minute and second hands on both faces keep the viewer's local time. update() sets them.

      CLOCK.hands = mover(PROPS.box, tx, th - 4, z, Array.from({ length: 6 }, () => [0, 0, 0, 1, 1, 1, DARK]));
      const now = new Date();
      CLOCK.t0 = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000 - performance.now() / 1000;

      // Pigeons circle the belfry. Each bird is two wing boxes. update() flies and flaps them.

      CLOCK.th = th;
      CLOCK.birds = mover(PROPS.box, tx, 0, z, Array.from({ length: 28 }, (_, i) => [0, 0, 0, 1, 1, 1, dim([.44, .43, .41], .8 + (i >> 1) % 3 * .15)]));

      // Scaffold on the far wing: poles, planks and a sheet of dark netting.

      const sx = x - hw / 2 + 8;
      for (let i = 0; i < 4; i++) prop('box', sx - 6 + i * 4, (hh + 6) / 2, z + hd / 2 + 1.2, .3, hh + 6, .3, [.3, .25, .12]);
      for (let y = 5; y < hh + 6; y += 5) prop('box', sx, y, z + hd / 2 + 1.2, 13, .25, 1.4, [.22, .17, .1]);
      prop('box', sx, (hh + 6) / 2, z + hd / 2 + 2, 13, hh + 4, .1, [.05, .07, .05]);
      glow(sx, hh + 6.2, z + hd / 2 + 1.2, .6, .6, .6, RED);
      pool(x, cz + 6, 30, dim(AMBER, .08));
    }, update() {
      if (!CLOCK.hands) return;
      const sec = CLOCK.t0 + performance.now() / 1000;
      const HANDS = [[sec / 43200, 1.5, .4, 4.75], [sec / 3600, 2.2, .26, 4.8], [sec / 60, 2.3, .1, 4.85]];
      for (let i = 0; i < 6; i++) {
        const [turn, len, wd, out] = HANDS[i % 3], s = i < 3 ? 1 : -1, a = turn % 1 * Math.PI * 2;
        _o.position.set(s * Math.sin(a) * len / 2, Math.cos(a) * len / 2, s * out);
        _o.rotation.set(0, 0, -s * a); _o.scale.set(wd, len, .1); _o.updateMatrix();
        CLOCK.hands.setMatrixAt(i, _o.matrix);
      }
      CLOCK.hands.instanceMatrix.needsUpdate = true;

      // Each pigeon flies its own wobbling circle. Wings pivot at the body and flap, with short glides.

      for (let i = 0; i < 14; i++) {
        const t = sec * (.45 + (i * 7 % 5) * .04) + i * 2.4, R = 7.5 + (i % 5) * 1.3 + Math.sin(sec * .3 + i) * 1.5;
        const px = Math.cos(t) * R, pz = Math.sin(t) * R, py = CLOCK.th + 3 + (i % 4) * 2 + Math.sin(sec * .6 + i) * 1.5;
        const f = Math.sin(sec * 13 + i * 1.7) * (Math.sin(sec * .8 + i) > -.2 ? .7 : .1), h = -t, ch = Math.cos(h), sh = Math.sin(h);
        for (const s of [-1, 1]) {
          const lx = s * .4 * Math.cos(f), ly = .4 * Math.sin(f);
          _w.position.set(px + lx * ch, py + ly, pz - lx * sh); _w.rotation.set(0, h, s * f); _w.scale.set(.8, .06, .3); _w.updateMatrix();
          CLOCK.birds.setMatrixAt(i * 2 + (s > 0), _w.matrix);
        }
      }
      CLOCK.birds.instanceMatrix.needsUpdate = true;
    } },

    // Neo-Broadway runs over three blocks. The yard holds the flagship, glazed halfway with its rig on top, and a
    // tower paused for exciting reasons. The slewing crane and the hoarding stand between them.

    fbc_wwyard: { at: [564, 451], label: 'Watts-Watson Neo-Broadway Yard', labelY: 312, minSide: 60, reach: 400, build(x, z, w, d, st, r) {
      prop('box', x, .12, z, w, .24, d, [.05, .045, .035]);
      const q = Math.min(w, d) / 4, sparks = [];
      wwTower(x - q, z - q * .6, 26, 170, 290, st, r, {}, sparks);
      wwTower(x + q, z + q * .5, 22, 0, 170, st, r, { paused: true });
      prop('lattice', x + q * 1.7, 70, z + q * .5, 2.6, 140, 2.6);
      beam([x + q * 1.7, 140, z + q * .5], [x + q * .6, 140, z + q * 1.6], 1, dim(RUST, 1.4));
      slewCrane(x + q * .3, z - q * 1.2, 222, 46, r() * 6.3, r);

      // The flagship's glazed floors carry the slogan and a holo ad.

      const fz = z - q * .6 + 13.3;
      textSign('NEO-BROADWAY', x - q, 150, fz, 23, 4.6, 0, [1.9, .3, 1.1]);
      textSign('THE FUTURE IS UNDER CONSTRUCTION', x - q, 143, fz, 23, 2.2, 0, dim(WARM, 1.1));
      holo(x - q, z - q * .6, 26, 26, 95, r, 1, 22);
      for (const [px, pz] of [[-q, -q * .6], [q, q * .5]]) pool(x + px, z + pz, 30, dim([1.6, 1.3, .5], .06));

      // Hoarding along the front street.

      const hz = z + d / 2 - 1;
      prop('box', x, 2, hz, w - 4, 4, .4, [.12, .1, .05]);
      textSign('WATTS-WATSON INDUSTRIAL SOLUTIONS', x - w * .15, 2.6, hz + .25, 30, 2.4, 0, [1.6, 1.3, .3]);
      textSign('NEO-BROADWAY · OPENING SOON', x + w * .28, 2.6, hz + .25, 20, 2, 0, dim(WARM, .9));
      glow(x, 4.2, hz + .3, w - 6, .2, .2, dim([1.6, 1.2, .2], .7));
      for (let k = 0; k < 6; k++) glow(x - w / 2 + 4 + k * (w - 8) / 5, 4.6, hz + .4, .5, .5, .5, SODIUM);
      WW.yard = sparkFall(sparks);
    }, update(t) {
      WW.yard?.(t);

      // The big crane slews slowly back and forth. Its tip light blinks on the city's beacon beat.

      if (!SLEW.arm) return;
      SLEW.arm.rotation.y = SLEW.tip.rotation.y = SLEW.a + 1.2 * Math.sin(t * .06);
      SLEW.tip.visible = (t * .8) % 1 < .15;
    } },

    // North of the yard: a tower nearly finished, its rig still on the crown.

    fbc_wwnorth: { at: [569, 436], minSide: 44, reach: 120, build(x, z, w, d, st, r) {
      const sparks = [];
      wwTower(x, z, 24, 228, 254, st, r, {}, sparks);
      pool(x, z, 26, dim([1.6, 1.3, .5], .06));
      WW.north = sparkFall(sparks);
    }, update(t) { WW.north?.(t); } },

    // South of the yard: a bare frame climbing with its rig, and a shorter tower topping out under floodlights.

    fbc_wwsouth: { at: [558, 472], minSide: 44, reach: 120, build(x, z, w, d, st, r) {
      const q = Math.min(w, d) / 4, sparks = [];
      wwTower(x - q, z + q * .4, 24, 60, 205, st, r, {}, sparks);
      wwTower(x + q, z - q * .5, 20, 120, 150, st, r, { rig: false });
      crane(x + q * .2, z + q * 1.4, 120, 32, r() * 6.3, r);
      pool(x, z, 40, dim([1.6, 1.3, .5], .06));
      WW.south = sparkFall(sparks);
    }, update(t) { WW.south?.(t); } },

    // Two facing body-mod shops on a lane at the market's north edge.

    fbc_aniink: { at: [592, 306], label: 'Ani-Ink & Famous Faces', labelY: 26, minSide: 40, reach: 300, build(x, z, w, d, st, r) {
      const shop = { ...brick(st), lit: .45 };
      const sw = Math.min(16, w / 2 - 6), sd = Math.min(d - 8, 34), h = 11;

      // Back tenements frame the lane.

      bld(x, z - d / 2 + 6, w - 4, 10, 26 + r() * 8, brick(st), r, {});
      for (const s of [-1, 1]) {
        const sx = x + s * (sw / 2 + 4);
        bld(sx, z + 4, sw, sd, h, shop, r, { roof: true });

        // Each shop faces the lane: a lit window band and a bright door.

        const fx = sx - s * (sw / 2 + .15);
        glow(fx, 2.2, z + 4, .15, 3.6, sd * .7, dim(s < 0 ? PINK : ICE, .45));
        glow(fx, 7.5, z + 4, .15, .4, sd * .9, s < 0 ? VIOLET : TEAL);
      }

      // Ani-Ink, west side: a pink and violet tattoo-gun sign on the roof, aimed at the street.

      const ax = x - (sw / 2 + 4), ay = h + 4, az = z + 4 + sd / 2 - 3;
      glow(ax, ay + 1.2, az, 7, 1.6, .3, PINK);
      glow(ax + 3.4, ay - .2, az, 1.4, 3, .3, PINK);
      glow(ax - 4.8, ay + 1.2, az, 2.8, .4, .3, VIOLET);
      glow(ax - 6.6, ay + 1.2, az, .9, .2, .2, [2, 1.6, 2]);
      glow(ax + 1, ay + 2.6, az, 3, .6, .3, VIOLET);
      prop('box', ax, h + 1, az, .3, 2, .3, DARK);
      textSign('ANI-INK', ax, h - 1.6, z + 4 + sd / 2 + .3, sw * .9, 2.4, 0, PINK);

      // Famous Faces, east side: a wall of celebrity holos on the street front and the lane.

      const fx = x + (sw / 2 + 4);
      for (let k = 0; k < 3; k++) holo(fx, z + 4 + (k - 1) * sd * .3, sw, sd * .28, 6 + (k % 2) * 3, r, 1, 7);
      holo(fx, z + 4, sw, sd, h + 5, r, 2, 12);
      prop('box', fx, h + 1.5, z + 4 + sd / 2 - 1, .4, 3, .4, DARK);
      textSign('FAMOUS FACES', fx, h - 1.6, z + 4 + sd / 2 + .3, sw * .9, 2.4, 0, TEAL);

      // Lane: string lights, a queue glow, a wet pool.

      for (let k = 0; k < 3; k++) {
        const lz = z - 4 + k * 8;
        stringLights([x - 3.8, 8.5, lz], [x + 3.8, 8.5, lz], .8, 6, k % 2 ? dim(PINK, .6) : dim(TEAL, .6));
      }
      for (let k = 0; k < 5; k++) prop('box', x - 1 + (r() - .5) * 2, .9, z + sd / 2 + 2 - k * 1.4, .6, 1.8, .6, [.12, .1, .1]);
      pool(x, z + sd / 2 + 4, 10, dim(VIOLET, .12));
    } },

    // Hotel Row: narrow hotels back to back along the block, vertical HOTEL blades, warm restaurants below.

    fbc_hotelrow: { at: [660, 288], label: 'Oldtown Hotel Row', labelY: 40, minSide: 30, reach: 400, build(x, z, w, d, st, r) {
      const A = axes(x, z, w, d), n = Math.max(3, Math.floor(A.L / 9)), slot = A.L / n, deep = A.S / 2 - 1;
      const blades = [SODIUM, PINK, TEAL, [1.6, .25, .12], [1.5, 1.2, .3], VIOLET];
      for (const side of [-1, 1]) for (let k = 0; k < n; k++) {
        const a = -A.L / 2 + (k + .5) * slot, b = side * (deep / 2 + .5), h = 20 + Math.floor(r() * 5) * 3;
        const [hx, hz] = A.P(a, b), [bx, bz] = A.alongZ ? [deep, slot - 1] : [slot - 1, deep];
        bld(hx, hz, bx, bz, h, brick(st), r, {});

        // Restaurant front at street level and an awning.

        const [fx, fz] = A.P(a, side * (deep + 1.15)), [ox, oz] = A.alongZ ? [.2, slot * .8] : [slot * .8, .2];
        glow(fx, 2, fz, ox, 2.6, oz, dim(WARM, .7 + r() * .4));
        const [wx, wz] = A.P(a, side * (deep + 2.2)), [awx, awz] = A.alongZ ? [2.2, slot * .85] : [slot * .85, 2.2];
        prop('box', wx, 4, wz, awx, .2, awz, [[.4, .08, .05], [.06, .22, .2], [.35, .25, .04]][k % 3]);

        // Vertical blade sticking out of the facade, lettered on both faces.

        const c = blades[(k + (side > 0 ? 3 : 0)) % blades.length], [px, pz] = A.P(a - slot * .35, side * (deep + 2));
        const [sx, sz] = A.alongZ ? [2.6, .3] : [.3, 2.6];
        prop('box', px, h - 6, pz, sx, 10, sz, DARK);
        glow(px, h - 6, pz, sx * 1.05, 10.2, sz * 1.05, dim(c, .18));
        const ry = A.alongZ ? 0 : Math.PI / 2;
        for (const f of [0, 1]) [...'HOTEL'].forEach((ch, i) => {
          const off = (f ? -1 : 1) * .2, [lx, lz] = A.alongZ ? [px, pz + off] : [px + off, pz];
          textSign(ch, lx, h - 2 - i * 1.9, lz, 6.4, 1.7, ry + f * Math.PI, c);
        });
      }

      // A sign at the row's end points travellers up to the Root.

      const [ex, ez] = A.P(A.L / 2 + 1, 0);
      prop('box', ex, 4, ez, .4, 8, .4, DARK);
      textSign('TO THE ROOT ↑', ex, 8.6, ez, 9, 1.8, A.ry, ICE);
      textSign('A LA RAÍZ ↑', ex, 6.8, ez, 8, 1.5, A.ry, dim(ICE, .8));
      pool(x, z, A.L * .6, dim(WARM, .07));
    } },

    // Benny's: a one-storey diner wedged under the tenements by the Neo-Broadway sites, with a big retro sign.

    fbc_benny: { at: [597, 460], label: "Benny's CultiMeats Shack", labelY: 20, minSide: 30, reach: 300, build(x, z, w, d, st, r) {
      const sw = Math.min(16, w * .7), sd = 10, sx = x, sz = z + d / 2 - sd / 2 - 2;

      // Tenements behind dwarf the shack, which faces the street on local +z.

      const back = sz - sd / 2 - 2 - (z - d / 2);
      if (back > 6) for (const s of [-1, 1]) bld(x + s * w / 4, z - d / 2 + back / 2, w / 2 - 2, back - 1, 30 + r() * 14, brick(st), r, {});
      bld(sx, sz, sw, sd, 5, { ...brick(st), lit: .1 }, r, { roof: true, kibble: false });
      for (const s of [-1, 1]) {
        glow(sx + s * sw * .25, 2.2, sz + sd / 2 + .12, sw * .3, 1.8, .15, dim([1.6, 1.2, .4], .8));
        prop('box', sx + s * sw * .25, 3.6, sz + sd / 2 + .4, sw * .32, .7, .6, DARK);
      }
      glow(sx, 1.8, sz + sd / 2 + .12, 1.8, 3, .15, dim(WARM, .6));
      prop('box', sx - sw / 3, 6, sz - 1, 1.2, 2, 1.2, STEEL);
      for (let k = 0; k < 3; k++) puff(sx - sw / 3, 8 + k * 2.5, sz - 1, 1.6 + k * .7, [.14, .13, .13]);

      // Rooftop sign: a turquoise burger outline over red lettering.

      const gy = 9.5, gz = sz + sd / 2 - 1;
      prop('box', sx, 5.8, gz, .3, 1.6, .3, DARK);
      glow(sx, gy + 1.4, gz, 6.4, .9, .3, TEAL);
      glow(sx, gy + 2.1, gz, 4.6, .5, .3, TEAL);
      glow(sx, gy + .2, gz, 7, .5, .3, RED);
      glow(sx, gy - .7, gz, 6.4, .6, .3, TEAL);
      textSign("BENNY'S", sx, 7.4, gz + .2, 12, 2.4, 0, RED);
      textSign('CULTIMEATS · BAR', sx, 5.6, sz + sd / 2 + .3, sw * .9, 1.4, 0, TEAL);

      // Plastic tables under bulbs on the pavement.

      for (let k = 0; k < 3; k++) prop('cyl', sx + (k - 1) * 4, .5, sz + sd / 2 + 3, 1.4, 1, 1.4, [.5, .1, .06]);
      stringLights([sx - sw / 2, 4.2, sz + sd / 2 + 4], [sx + sw / 2, 4.2, sz + sd / 2 + 4], .6, 10, dim(WARM, .8));
      pool(sx, sz + sd / 2 + 4, 9, dim(RED, .1));
    } },

    // Gracie's: a two-storey wedge by the highway. Roll-up hopper doors upstairs, sodium shop floor below.

    fbc_gracie: { at: [638, 424], label: "Gracie's Gearheads", labelY: 18, minSide: 30, reach: 300, build(x, z, w, d, st, r) {
      const A = axes(x, z, w, d), L = A.L - 6, n = 6, g0 = 5, g1 = 6;
      const shell = { ...st, base: [.12, .1, .08], win: [1, .7, .3], lit: .2, grime: .8 };

      // Slices narrow toward the tip at +a (local +z when the block runs north-south).

      for (let k = 0; k < n; k++) {
        const a = -L / 2 + (k + .5) * L / n, bw = (A.S - 4) * (1 - k / n * .82);
        const [cx, cz] = A.P(a, 0), [sx, sz] = A.alongZ ? [bw, L / n] : [L / n, bw];
        bld(cx, cz, sx, sz, g0, shell, r, { roof: false, kibble: false, skin: SKINS.bands });
        bld(cx, cz, sx, sz, g1, shell, r, { y0: g0, roof: k < 2, kibble: false, skin: SKINS.sparse });

        // Orange sodium shop floor, and a roll-up door per side upstairs.

        for (const s of [-1, 1]) {
          const [gx, gz] = A.P(a, s * (bw / 2 + .12)), [ox, oz] = A.alongZ ? [.15, L / n * .7] : [L / n * .7, .15];
          glow(gx, 2, gz, ox, 2.4, oz, dim(SODIUM, .55));
          const span = L / n * .7, [px, pz] = A.alongZ ? [.3, span] : [span, .3], [hx, hz] = A.alongZ ? [.5, span * 1.1] : [span * 1.1, .5];
          if (r() < .7) glow(gx, g0 + 2.6, gz, ox, 4, oz, dim(FLOOD, .75));
          else prop('box', gx, g0 + 2.6, gz, px, 4, pz, [.2, .18, .14]);
          prop('box', gx, g0 + 5, gz, hx, .7, hz, DARK);
        }
      }

      // Blue welding flicker in one bay, a hopper half inside another.

      const [wx, wz] = A.P(-L / 6, (A.S - 4) * .3);
      flickerGlow(wx, g0 + 1.6, wz, .8, .8, .8, [.6, .9, 2.4], r);
      const [hx, hz] = A.P(L / 12, -(A.S - 4) * .38);
      prop('box', hx, g0 + 1.4, hz, A.alongZ ? 5 : 3, 1.8, A.alongZ ? 3 : 5, [.3, .1, .06]);

      // Hopper lanes: light streaks that converge on the wedge tip.

      const [tx, tz] = A.P(L / 2, 0);
      for (let k = 0; k < 4; k++) {
        const ang = (k - 1.5) * .45, [fx, fz] = A.P(L / 2 + 60 * Math.cos(ang), 60 * Math.sin(ang));
        beam([fx, 24 + k * 4, fz], [tx, g0 + 4, tz], .3, k % 2 ? dim(FLOOD, .5) : dim(SODIUM, .6), 'glow');
      }

      // Name board across the wide back end.

      const [nx, nz] = A.P(-L / 2 + L / n / 2, 0);
      const [bx, bz] = A.P(-L / 2 - .3, 0);
      textSign("GRACIE'S GEARHEADS", bx, g0 + g1 + 1.6, bz, Math.min(18, A.S - 4), 2.6, A.alongZ ? Math.PI : -Math.PI / 2, [1.8, .9, .2]);
      prop('box', nx, g0 + g1 + .3, nz, A.alongZ ? A.S - 4 : 1, .6, A.alongZ ? 1 : A.S - 4, DARK);
      glow(tx, g0 + g1 + .6, tz, 1, 1, 1, RED);
      pool(tx, tz, 12, dim(SODIUM, .1));
    } },
  };
}
