// Landmarks from the Tour Guide and Akeidito finds. See design/pdf-finds/.
// Broadcast Square, Rutherford: NBN's home turf, packed onto one square.

export const kits = () => ({});

export function landmarks(H) {
  const { THREE, SKINS, GLOWS, beacon, beam, bld, glow, holo, pool, prop, puff, put, textSign } = H;

  const dim = (c, k) => c.map(v => v * k);
  const GOLD = [1.8, 1.35, .25], CYAN = [.3, 1.4, 1.8], WHITE = [1.3, 1.35, 1.45], AMBER = [1.6, .8, .15], RED = [1.6, .1, .1];
  const HOT = [[1.8, .15, 1.2], [.18, 1.4, 1.8], [1.6, .9, .1], [1.2, .2, 1.6]];
  const FACE4 = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  const ryOf = (fx, fz) => Math.atan2(fx, fz);

  // Points share one additive material. Colours above 1 bloom.

  const ptsMat = new THREE.PointsMaterial({ size: 2.4, sizeAttenuation: false, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const points = (xyz, rgb) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(xyz, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(rgb, 3));
    const p = new THREE.Points(g, ptsMat);
    p.frustumCulled = false;
    H.decor.add(p);
    return p;
  };

  // A ring of n lights at height y, radius rad, centred on the block. The caller spins it.

  const orbit = (n, rad, y, rgb, wobble = 0, r = Math.random) => {
    const xyz = [], col = [];
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + r() * .1;
      xyz.push(Math.sin(a) * rad, y + (r() - .5) * wobble, Math.cos(a) * rad);
      col.push(...rgb);
    }
    return points(xyz, col);
  };

  // Shared meshes for the Big Church holo facades and the NBNNS scan band.

  const GEO = { box: new THREE.BoxGeometry(1, 1, 1), cone: new THREE.ConeGeometry(.5, 1, 8), cyl: new THREE.CylinderGeometry(.5, .5, 1, 16), dome: new THREE.SphereGeometry(.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2) };
  const holoMat = rgb => new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb), transparent: true, opacity: .4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const mesh = (parent, geo, mat, x, y, z, sx, sy, sz) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    parent.add(m);
    return m;
  };

  // Animated parts, filled in by build and driven by update.

  const A = {};

  return {

    // NBN Headquarters: the tallest tower on the square. Four bands of dark glass twist a little further as they
    // step in, each wrapped in one live media screen with tickers on its narrow faces. A lattice broadcast mast
    // with dish rings and a gold halo crowns it, signal beams sweep the city, and camdrones circle the top.

    fb_nbn: { at: [462, 488], label: 'NBN Headquarters', labelY: 520, minSide: 50, reach: 500, build(x, z, w, d, st, r) {
      const glass = { ...st, base: [.025, .03, .04], win: [.55, .8, 1], lit: .22, grime: .05 };
      const S = Math.min(w, d), tw = S * .62, td = S * .38, ph = 26, top = 330;

      // Podium with a lit lobby front and the plaza lights.

      bld(x, z, S - 4, S - 4, ph, { ...glass, lit: .5 }, r, { skin: SKINS.bands, roof: false, kibble: false });
      glow(x, 6, z + (S - 4) / 2 + .1, S * .6, 9, .2, dim(WHITE, .7));
      glow(x, ph - 1, z + (S - 4) / 2 + .2, S - 6, .6, .2, dim(GOLD, .8));
      textSign('NBN', x, ph - 6, z + (S - 4) / 2 + .3, 18, 6, 0, GOLD);
      pool(x, z + S / 2 + 6, S * .5, dim(GOLD, .08));

      // Media textures: news mosaics, tickers and the NBN LIVE band on the broad faces, a vertical ticker on the
      // narrow ones. They scroll in update.

      const css = c => `rgb(${c.map(v => Math.min(255, v * 150) | 0).join(',')})`, pick = (q, a) => a[Math.floor(q() * a.length)];
      const media = H.canvasTexture(512, 2048, (g, W, Hh) => {
        g.fillStyle = '#04060a'; g.fillRect(0, 0, W, Hh);
        for (let y = 0; y < Hh;) {
          const kind = r();
          if (kind < .18) {
            g.fillStyle = '#c8961e'; g.fillRect(0, y, W, 56);
            g.fillStyle = '#05070a'; g.font = 'bold 40px sans-serif'; g.textBaseline = 'middle';
            g.fillText(pick(r, ['BREAKING  ·  NBN NEWS', 'MARKETS  ▲ 2.4%  ·  HAAS ▼', 'LIVE FROM BROADCAST SQUARE', 'ALWAYS ON  ·  NBN']), 18, y + 29);
            y += 64;
          } else if (kind < .3) {
            g.fillStyle = '#0b0f16'; g.fillRect(0, y, W, 150);
            g.fillStyle = '#ffd24a'; g.font = 'bold 120px sans-serif'; g.textBaseline = 'middle'; g.fillText('NBN', 24, y + 78);
            g.fillStyle = '#ff3030'; g.fillRect(300, y + 46, 180, 62);
            g.fillStyle = '#fff'; g.font = 'bold 44px sans-serif'; g.fillText('LIVE', 336, y + 79);
            y += 160;
          } else {
            const hh = 120 + r() * 140, cols = 1 + Math.floor(r() * 3);
            for (let c = 0; c < cols; c++) {
              const c0 = pick(r, HOT), x0 = c * W / cols + 6, cw = W / cols - 12;
              const gr = g.createLinearGradient(x0, y, x0 + cw, y + hh);
              gr.addColorStop(0, css(dim(c0, .55))); gr.addColorStop(1, css(dim(pick(r, HOT), .2)));
              g.fillStyle = gr; g.fillRect(x0, y, cw, hh);
              g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x0 + 10, y + hh - 26, cw * (.3 + r() * .6), 10);
            }
            y += hh + 10;
          }
        }
      });
      media.wrapT = THREE.RepeatWrapping;
      const tick = H.canvasTexture(128, 1024, (g, W, Hh) => {
        g.fillStyle = '#05070a'; g.fillRect(0, 0, W, Hh);
        g.save(); g.translate(W / 2, 0); g.rotate(Math.PI / 2);
        g.fillStyle = '#ffd24a'; g.font = 'bold 72px sans-serif'; g.textBaseline = 'middle';
        g.fillText('NBN  ·  LIVE  ·  NBN  ·  LIVE  ·', 0, 0);
        g.restore();
      });
      tick.wrapT = THREE.RepeatWrapping;
      const screenMat = new THREE.MeshBasicMaterial({ map: media, color: new THREE.Color(1.2, 1.2, 1.25) });
      const tickMat = new THREE.MeshBasicMaterial({ map: tick, color: new THREE.Color(1.3, 1.25, 1.1) });
      A.media = [media, tick];
      const plane = new THREE.PlaneGeometry(1, 1);
      const panel = (mat, px, py, pz, pw, phh, ry) => {
        const m = new THREE.Mesh(plane, mat);
        m.position.set(px, py, pz); m.scale.set(pw, phh, 1); m.rotation.y = ry; m.userData.live = true;
        H.decor.add(m);
      };

      // Four twisting bands. Each carries lit corners, a gold line round its top and its screens.

      const BANDS = [[ph, 115, 0, 1], [115, 195, .2, .93], [195, 265, .4, .86], [265, top, .6, .78]], AT = BANDS[3][2];
      const ring = (y, bw, bd, a, rgb, t = .35) => {
        const ca = Math.cos(a), sa = Math.sin(a);
        for (const s of [-1, 1]) {
          glow(x + sa * s * bd / 2, y, z + ca * s * bd / 2, bw + t, t, t, rgb, a);
          glow(x + ca * s * bw / 2, y, z - sa * s * bw / 2, t, t, bd + t, rgb, a);
        }
      };
      for (const [y0, y1, a, f] of BANDS) {
        const bw = tw * f, bd = td * f, hh = y1 - y0, cy = (y0 + y1) / 2, ca = Math.cos(a), sa = Math.sin(a);
        bld(x, z, bw, bd, hh - .4, glass, r, { y0, skin: SKINS.curtain, roof: false, kibble: false, ry: a });
        ring(y1 - .2, bw + .5, bd + .5, a, dim(GOLD, .9), .5);
        for (const [cxs, czs] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const lx = cxs * bw / 2, lz = czs * bd / 2;
          glow(x + lx * ca + lz * sa, cy, z - lx * sa + lz * ca, .4, hh - 1, .4, dim(WHITE, .5), a);
        }
        for (const s of [-1, 1]) {
          const o = bd / 2 + .25;
          panel(screenMat, x + sa * s * o, cy, z + ca * s * o, bw * .9, hh - 6, a + (s < 0 ? Math.PI : 0));
          const q = bw / 2 + .25;
          panel(tickMat, x + ca * s * q, cy, z - sa * s * q, bd * .45, hh - 8, a + s * Math.PI / 2);
        }
      }

      // Cap: a short dark block with NBN on all four faces.

      const ca = Math.cos(AT), sa = Math.sin(AT), cw = tw * .7, cd = td * .7, cy0 = top;
      bld(x, z, cw, cd, 14, { ...glass, lit: .15 }, r, { y0: cy0, skin: SKINS.bands, roof: false, kibble: false, ry: AT });
      ring(cy0 + 14, cw + .4, cd + .4, AT, dim(GOLD, 1.1), .5);
      for (const [fx, fz] of FACE4) {
        const span = fx ? cd * .9 : cw * .8, out = (fx ? cw : cd) / 2 + .4, lx = fx * out, lz = fz * out;
        textSign('NBN', x + lx * ca + lz * sa, cy0 + 7, z - lx * sa + lz * ca, span * .9, span * .3, ryOf(fx, fz) + AT, dim(GOLD, 1.2));
      }

      // Broadcast mast: a dark lattice 150 m tall, dish rings, dishes, a gold NBN halo, beacons and signal beams.

      const my = cy0 + 14, MH = 150, steel = [.07, .07, .08];
      prop('lattice', x, my + MH / 2, z, 8, MH, 8, steel);
      for (const [hy, rr, k] of [[28, 30, .45], [62, 22, .4], [96, 15, .35]]) {
        put(GLOWS.ring, x, my + hy, z, rr, .5, rr, 0, 0, dim(WHITE, k));
        for (let q = 0; q < 4; q++) {
          const an = q / 4 * Math.PI * 2 + hy * .05, dx = Math.sin(an), dz = Math.cos(an);
          prop('dish', x + dx * 5.5, my + hy - 2, z + dz * 5.5, 5, 5, 5, [.2, .2, .22], an, -1.2);
        }
      }
      put(GLOWS.ring, x, my + 45, z, tw * 2.2, 1, tw * 2.2, 0, 0, dim(GOLD, .9));
      put(GLOWS.ring, x, my + 47, z, tw * 2.05, .6, tw * 2.05, 0, 0, dim(GOLD, .45));
      for (let k = 0; k < 5; k++) beacon(x, my + 20 + k * 30, z, r);
      put(GLOWS.sphere, x, my + MH + 1, z, 3, 3, 3, 0, 0, [2, .15, .12]);
      for (let k = 0; k < 4; k++) {
        const an = k / 4 * Math.PI * 2 + .4, b0 = [x, my + MH - 12, z], b1 = [x + Math.sin(an) * 420, my + MH - 60, z + Math.cos(an) * 420];
        H.laser(b0, b1, .4, k % 2 ? dim(GOLD, .32) : dim(CYAN, .3), { sweep: [.5, .04, .18, k * 1.7] });
      }

      // Camdrone rings circle the upper bands.

      A.cams = orbit(24, tw * .85, top + 30, [1.6, 1.5, 1.2], 14, r);
      A.cams2 = orbit(16, tw * 1.1, top - 20, [1.2, .3, .25], 10, r);
    }, update(t) {
      if (A.cams) A.cams.rotation.y = t * .12;
      if (A.cams2) A.cams2.rotation.y = -t * .08;
      if (A.media) { A.media[0].offset.y = (t * .015) % 1; A.media[1].offset.y = (-t * .05) % 1; }
    } },

    // Central Plaza: a broad raised deck on columns with a soft white floor. One grand stair climbs the front (+z)
    // to a giant screen on the back edge. Holo pillars line the rim, a crowd fills the deck, and NAPD drones
    // hover over a protest corner.

    fb_plaza: { at: [472, 500], label: 'Central Plaza', labelY: 72, minSide: 40, reach: 450, face: [-1, 0], build(x, z, w, d, st, r) {

      // The deck runs 5 m past the block edge over the streets, because the square has no traffic.

      const hw = w / 2 + 5, hd = d / 2 + 5, W = hw * 2, D = hd * 2, dh = 16, sd = 18, sw = W * .4, deck = [.07, .07, .08];
      const inNotch = (px, pz) => Math.abs(px - x) < sw / 2 + 1 && pz > z + hd - sd - 1;

      // Deck slabs round a notch in the front edge. Each slab has a white floor and a cyan edge line.

      const slabs = [[x, z - sd / 2, W, D - sd]];
      for (const s of [-1, 1]) slabs.push([x + s * (sw / 2 + (W - sw) / 4), z + hd - sd / 2, (W - sw) / 2, sd]);
      for (const [sx, sz, sw2, sd2] of slabs) {
        prop('box', sx, dh - 1.5, sz, sw2, 3, sd2, deck);
        glow(sx, dh + .05, sz, sw2 - 1.5, .1, sd2 - 1.5, [.32, .33, .38]);
        glow(sx, dh - 2.4, sz, sw2 + .3, .5, sd2 + .3, dim(CYAN, .6));
      }

      // Columns under the deck, each with a downlight.

      for (let i = 0; i < 8; i++) for (let j = 0; j < 7; j++) {
        const cx = x - hw + 5 + i * (W - 10) / 7, cz = z - hd + 5 + j * (D - 10) / 6;
        if (inNotch(cx, cz)) continue;
        prop('box', cx, (dh - 3) / 2, cz, 2.2, dh - 3, 2.2, [.08, .08, .09]);
        if ((i + j) % 2 === 0) glow(cx, dh - 3.15, cz + 2, 1.6, .15, 1.6, dim(WHITE, .5));
      }
      pool(x, z, W * .6, [.07, .07, .09]);

      // Grand stair in the notch, from the street up to the deck. Every other nosing glows.

      for (let k = 0; k < 8; k++) {
        const sh = (k + 1) * dh / 8, tz = z + hd - (k + .5) * sd / 8;
        prop('box', x, sh / 2, tz, sw, sh, sd / 8 + .05, [.08, .08, .09]);
        if (k % 2 === 0) glow(x, sh + .05, tz + sd / 16 - .2, sw - 1, .1, .2, [.25, .25, .3]);
      }

      // Giant screen on the back edge, facing the stair, with the NBN LIVE banner above it.

      const Hs = 56, sz = z - hd + 1.5;
      prop('box', x, dh + Hs / 2, sz, W * .7, Hs, 2, [.04, .04, .05]);
      holo(x, sz, W * .7, 2, dh + Hs * .55, r, 2, W * .65);
      glow(x, dh + Hs + .3, sz, W * .72, .6, 2.2, dim(CYAN, .8));
      textSign('NBN LIVE', x, dh + Hs - 2.6, sz + 1.1, 26, 4, 0, GOLD);

      // A lower screen wall on the west edge.

      prop('box', x - hw + 1, dh + 9, z - sd / 2, 1, 18, D * .5, [.04, .04, .05]);
      holo(x - hw + 1, z - sd / 2, 1, D * .5, dh + 9, r, 0, D * .45);

      // Holo pillars down both sides and at the head of the stair.

      const pillars = [[x - (sw / 2 + 2.5), z + hd - 2.5], [x + sw / 2 + 2.5, z + hd - 2.5]];
      for (const s of [-1, 1]) for (const t of [-.7, -.25, .2, .62]) pillars.push([x + s * hw * .92, z + t * hd]);
      pillars.forEach(([px, pz], k) => {
        prop('box', px, dh + 8, pz, 2, 16, 2, [.05, .05, .06]);
        glow(px, dh + 8, pz, 2.3, 15, .4, HOT[k % 4], k * .7);
        put(GLOWS.sphere, px, dh + 17.5, pz, 2.4, 2.4, 2.4, 0, 0, HOT[(k + 1) % 4]);
      });

      // Protest corner on the east side: a packed crowd, glowing banners and placards.
      // Strollers spread over the rest of the open deck.

      const cx = x + hw * .55, cz = z - hd * .1;
      for (let k = 0; k < 70; k++) prop('box', cx + (r() - .5) * 24, dh + .85, cz + (r() - .5) * 24, .5, 1.7, .45, [.05, .05, .055]);
      for (let k = 0; k < 6; k++) glow(cx + (r() - .5) * 20, dh + 3.2, cz + (r() - .5) * 20, 3.5, 1.2, .1, k % 2 ? [1.6, .2, .1] : [1.5, 1.4, 1.2], r() * 6.3);
      for (let k = 0; k < 100; k++) {
        const px = x + (r() - .5) * W * .85, pz = z + (r() - .5) * D * .85;
        if (!inNotch(px, pz)) prop('box', px, dh + .85, pz, .5, 1.7, .45, [.06, .06, .065]);
      }

      // NAPD drones: blue-white lights over the deck.

      for (let k = 0; k < 7; k++) {
        const px = x + (r() - .5) * W * .7, pz = z + (r() - .5) * D * .7, py = dh + 22 + r() * 16;
        put(GLOWS.sphere, px, py, pz, 1.2, .6, 1.2, 0, 0, [.5, .8, 1.8]);
        glow(px, py - .5, pz, .4, .3, .4, RED);
      }
    } },

    // Broadcast Square Tube Depot: a long glass shed half sunk into the square, lit ribs and a departure board,
    // tube lines entering at three heights, line-colour rings on the floor, screen towers at the back corners,
    // and hopper traffic circling above.

    fb_depot: { at: [480, 507], label: 'Broadcast Square Tube Depot', labelY: 160, minSide: 40, reach: 500, face: [0, 1], build(x, z, w, d, st, r) {
      const L = Math.min(w * .98, 96), D = Math.min(d * .5, 34) * 1.3, rh = 29, bh = 10;
      prop('box', x, bh / 2, z, L, bh, D, [.05, .055, .065]);
      prop('cyl', x, bh, z, D, L, rh * 1.6, [.07, .1, .13], Math.PI / 2, Math.PI / 2);
      for (let k = 0; k <= 8; k++) {
        const px = x - L / 2 + k * L / 8;
        put(GLOWS.ring, px, bh, z, D * 1.01, 1, rh * 1.62, Math.PI / 2, Math.PI / 2, dim(CYAN, .6));
      }
      glow(x, bh + rh * .8 + .2, z, L, .4, .6, dim(WHITE, .6));

      // Front: departure board strip, name, lit escalator mouths.

      const fz = z + D / 2 + .15;
      glow(x, bh * .78, fz, L * .9, 1.8, .2, [1.1, 1.4, 1.6]);
      textSign('BROADCAST SQUARE', x, bh + 3.5, fz + .2, 38, 4.5, 0, WHITE);
      for (const s of [-1, 0, 1]) {
        glow(x + s * L * .3, 2, fz + .2, 9, 4, .2, [1.3, 1.25, 1.1]);
        pool(x + s * L * .3, fz + 6, 10, dim(WHITE, .1));
      }

      // Line-colour rings on the floor, each with a pylon. Tangerine, clay, jade, crimson, gold, navy.

      const LINES = [[1.8, .6, .1], [1.1, .5, .3], [.2, 1.4, .6], [1.6, .1, .2], [1.7, 1.3, .2], [.2, .35, 1.6]];
      LINES.forEach((c, k) => {
        const px = x + (k - 2.5) * L / 6, pz = fz + 12;
        put(GLOWS.ring, px, .4, pz, 9, 1, 9, 0, 0, c);
        prop('box', px, 2.5, pz, .8, 5, .8, [.08, .08, .09]);
        glow(px, 5.3, pz, 1, .8, 1, c);
      });

      // Tube lines leave both ends at three heights.

      for (const s of [-1, 1]) [8, 21, 36].forEach((ty, k) => {
        const a = [x + s * L / 2, ty, z + (k - 1) * 10], b = [x + s * (L / 2 + 22), ty + (k - 1) * 3, z + (k - 1) * 8];
        beam(a, b, 4.4, [.08, .09, .1]);
        beam([a[0], a[1] - 2.3, a[2]], [b[0], b[1] - 2.3, b[2]], .4, LINES[(k + (s > 0 ? 3 : 0)) % 6], 'glow');
        if (ty > 8) prop('box', (a[0] + b[0]) / 2, (a[1] + b[1]) / 4, (a[2] + b[2]) / 2, 1.8, (a[1] + b[1]) / 2, 1.8, [.07, .07, .08]);
      });

      // Screen towers at the back corners. Vidscreens climb the front and outer faces from base to crown.

      const T = Math.min(18, d / 2 - D / 2 - 2), glass = { ...st, base: [.05, .06, .08], win: [.55, .8, 1], lit: .35, grime: .15 };
      if (T >= 8) for (const s of [-1, 1]) {
        const tx = x + s * (L / 2 - T / 2), tz = z - (D + d) / 4, th = s < 0 ? 120 : 150;
        bld(tx, tz, T, T, th, glass, r, { skin: SKINS.curtain, roof: false, kibble: false });
        for (let y = 16; y < th - 12; y += 13) {
          holo(tx, tz, T, T, y, r, 2, T);
          holo(tx, tz, T, T, y + 6, r, s > 0 ? 0 : 1, T);
        }
        glow(tx, th, tz, T + .4, .7, T + .4, dim(GOLD, .7));
        beacon(tx, th + 2, tz, r);
      }

      // Hopper lanes inside the screen towers: a faint ring and two counter-rotating streams of lights.

      put(GLOWS.ring, x, 62, z, L * .7, 1, L * .7, 0, 0, dim(CYAN, .35));
      A.hop1 = orbit(30, L * .32, 62, [1.4, 1.3, 1.1], 3, r);
      A.hop2 = orbit(22, L * .37, 72, [1.4, .3, .25], 3, r);
      pool(x, z, L * .6, dim(CYAN, .07));
    }, update(t) {
      if (A.hop1) A.hop1.rotation.y = t * .25;
      if (A.hop2) A.hop2.rotation.y = -t * .2;
    } },

    // Big Church: a dark stone Gothic church. A nave with lean-to aisles and flying buttresses, tall pointed windows,
    // twin spired towers over the portal (+z), and a crossing tower. Two holo facades rise from the crossing tower and take turns,
    // a Gothic spire in cold white and a dome with a minaret in green-gold, and an amber strip warns before each change.

    fb_church: { at: [466, 513], label: 'Big Church', labelY: 175, minSide: 46, reach: 450, face: [0, 1], build(x, z, w, d, st, r) {
      const S = Math.min(w, d, 84), k = S / 64, L = S * .76, Wn = S * .32, Aw = S * .16, Tw = Aw * 1.15;
      const bh = 26 * k, ah = 14 * k, ct = bh + 22 * k, Ct = Wn * .7, zf = z + L / 2;
      const stone = { ...st, base: [.16, .15, .15], win: [1, .85, .6], lit: 0, grime: .25 }, rock = [.14, .13, .13], slate = [.07, .08, .1];
      const WIN = [[1.4, .75, .3], [.45, .65, 1.5], [1.3, .35, .55]];
      const opt = { skin: SKINS.sparse, roof: false, kibble: false };

      // A lancet: a tall lit strip with a stepped point. onX puts it on a face that looks along x.

      const lancet = (px, y, pz, h, wd, onX, rgb) => {
        const g = (yy, hh, ww) => glow(px, yy, pz, onX ? .2 : ww, hh, onX ? ww : .2, rgb);
        g(y, h, wd); g(y + h / 2 + .5, 1, wd * .66); g(y + h / 2 + 1.4, .8, wd * .3);
      };

      // Nave with a steep slate roof, and a round apse at the back.

      bld(x, z, Wn, L, bh, stone, r, opt);
      const a = Wn * 1.08 / Math.SQRT2;
      prop('box', x, bh, z, L, a, a, slate, Math.PI / 2, Math.PI / 4);
      const az = z - L / 2 + Wn * .25;
      bld(x, az, Wn, Wn, bh * .85, stone, r, { ...opt, shape: 'cyl' });
      prop('cone', x, bh * .85 + Wn * .25, az, Wn * 1.04, Wn * .5, Wn * 1.04, slate);
      lancet(x, bh * .4, az - Wn / 2 - .1, bh * .4, 2.4, false, WIN[1]);

      // Aisles with lean-to roofs, buttress piers and flying buttresses, and a lancet in every bay.

      const nb = 5, z0 = z - L / 2 + 2, span = L - Tw - 4;
      for (const s of [-1, 1]) {
        const ax = x + s * (Wn / 2 + Aw / 2);
        bld(ax, z - Tw / 2, Aw, L - Tw, ah, stone, r, opt);
        prop('box', ax, ah + 1.5, z - Tw / 2, L - Tw, .8, Aw * 1.12, slate, Math.PI / 2, s * Math.atan2(3, Aw));
        for (let b = 0; b <= nb; b++) {
          const pz = z0 + span * b / nb, px = x + s * (Wn / 2 + Aw + 1.4);
          prop('box', px, (ah + 6) / 2, pz, 2.8, ah + 6, 2.4, rock);
          prop('cone', px, ah + 8.5, pz, 2, 5, 2, rock);
          beam([px - s * 1.4, ah + 4, pz], [x + s * Wn / 2, bh - 3, pz], 1.1, rock);
          if (b === nb) continue;
          const mz = pz + span / nb / 2;
          lancet(x + s * (Wn / 2 + Aw + .12), ah * .45, mz, ah * .55, 2, true, WIN[b % 3]);
          if (Math.abs(mz - z) > Ct / 2 + 2) lancet(x + s * (Wn / 2 + .12), (ah + 3 + bh) / 2 - .8, mz, bh - ah - 5, 1.8, true, WIN[(b + 1) % 3]);
        }
      }

      // Crossing tower: the base the holo rises from. Lancets above the roof, pinnacles, a white projector rim.

      bld(x, z, Wn + 2, Ct, ct, stone, r, opt);
      for (const [fx, fz] of FACE4) {
        const ox = fx * (Wn / 2 + 1.12), oz = fz * (Ct / 2 + .12);
        lancet(x + ox, ct - 6 * k, z + oz, 7 * k, 2.4, !!fx, WIN[2]);
      }
      for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) prop('cone', x + cx * (Wn / 2 + .5), ct + 3.5, z + cz * (Ct / 2 - .5), 2, 7, 2, rock);
      glow(x, ct + .3, z, Wn + 2.6, .6, Ct + .6, dim(WHITE, .8));

      // West front: twin towers with slate spires and belfry lancets.

      for (const s of [-1, 1]) {
        const tx = x + s * (Wn / 2 + Aw / 2), tz = zf - Tw / 2 + 1, th = bh + 14 * k, tw = Aw * 1.1;
        bld(tx, tz, tw, Tw, th, stone, r, opt);
        prop('cone', tx, th + 12 * k, tz, tw, 24 * k, tw, slate);
        for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) prop('cone', tx + cx * (tw / 2 - .6), th + 2.5, tz + cz * (Tw / 2 - .6), 1.4, 5, 1.4, rock);
        lancet(tx, th - 6 * k, tz + Tw / 2 + .12, 5 * k, 1.8, false, WIN[0]);
        lancet(tx + s * (tw / 2 + .12), th - 6 * k, tz, 5 * k, 1.8, true, WIN[0]);
        beacon(tx, th + 24 * k + .5, tz, r);
      }

      // Portal: a deep porch with a pointed gable and a lit door, the name above it, and a rose window in the gable.

      const Wp = Wn * .55, ph = 12 * k, pd = 3, wz = zf + pd + .1;
      prop('box', x, ph / 2, zf + pd / 2, Wp, ph, pd, rock);
      prop('box', x, ph, zf + pd / 2, pd, Wp / Math.SQRT2, Wp / Math.SQRT2, slate, Math.PI / 2, Math.PI / 4);
      glow(x, 4 * k, wz, Wp * .45, 8 * k, .2, [1.3, 1.05, .7]);
      glow(x, 8.6 * k, wz, Wp * .3, 1.2 * k, .2, [1.3, 1.05, .7]);
      glow(x, 9.6 * k, wz, Wp * .14, .9 * k, .2, [1.3, 1.05, .7]);
      textSign('BIG CHURCH', x, 20.4 * k, zf + .35, Wn * .75, 2.4 * k, 0, [1.2, 1.1, .9]);
      const ry0 = bh + 1.5 * k, R = 8.5 * k;
      put(GLOWS.ring, x, ry0, zf + .4, R, 1, R, 0, Math.PI / 2, dim(WHITE, .9));
      put(GLOWS.ring, x, ry0, zf + .4, R * .5, 1, R * .5, 0, Math.PI / 2, dim(GOLD, .9));
      put(GLOWS.sphere, x, ry0, zf + .25, R * .92, R * .92, .3, 0, 0, [1.1, .45, .7]);
      pool(x, zf + 10, Wn, [.12, .1, .07]);

      // Amber warning strip round the base, and the two holo facades on the crossing tower.

      const warnMat = holoMat(AMBER), gothMat = holoMat([.75, .85, 1]), domeMat = holoMat([.45, .9, .3]);
      warnMat.opacity = 0;
      mesh(H.decor, GEO.box, warnMat, x, 2, z, Wn + Aw * 2 + 7, 1.2, L + Wn * .5 + 6);

      // Each facade group sits on the tower top, so scaling it in y grows it up from there.

      const goth = new THREE.Group(), dome = new THREE.Group();
      goth.position.y = dome.position.y = ct;
      H.decor.add(goth, dome);
      mesh(goth, GEO.box, gothMat, x, 22 * k, z, S * .5, 44 * k, S * .35);
      mesh(goth, GEO.cone, gothMat, x, 66 * k, z, S * .32, 44 * k, S * .32);
      for (const s of [-1, 1]) {
        mesh(goth, GEO.box, gothMat, x + s * S * .32, 16 * k, z, S * .14, 32 * k, S * .14);
        mesh(goth, GEO.cone, gothMat, x + s * S * .32, 42 * k, z, S * .16, 20 * k, S * .16);
      }
      mesh(dome, GEO.cyl, domeMat, x, 7 * k, z, S * .6, 14 * k, S * .6);
      mesh(dome, GEO.dome, domeMat, x, 14 * k, z, S * .62, S * .5, S * .62);
      mesh(dome, GEO.cyl, domeMat, x + S * .42, 34 * k, z - S * .2, 4 * k, 68 * k, 4 * k);
      mesh(dome, GEO.cone, domeMat, x + S * .42, 72 * k, z - S * .2, 5 * k, 8 * k, 5 * k);
      mesh(dome, GEO.box, domeMat, x, 14 * k + S * .25 + 3, z, .6, 6, .6);
      Object.assign(A, { goth, dome, gothMat, domeMat, warnMat });
      pool(x, z, S * .7, [.1, .08, .06]);
    }, update(t) {
      if (!A.goth) return;

      // An 8 s cycle. Each facade shows for 4 s and morphs in its last second, while the base strip pulses.

      const c = t % 8, p = c < 4 ? c : c - 4, a = c < 4;
      const m = Math.min(1, Math.max(0, p - 3)), on = a ? 1 - m : m;
      A.goth.scale.y = Math.max(.02, on); A.dome.scale.y = Math.max(.02, 1 - on);
      A.gothMat.opacity = .4 * on; A.domeMat.opacity = .4 * (1 - on);
      A.goth.visible = A.gothMat.opacity > .01; A.dome.visible = A.domeMat.opacity > .01;
      A.warnMat.opacity = p > 2.4 ? .8 * (.5 + .5 * Math.sin(t * 8)) : 0;
    } },

    // Broadcasters' Corporate Park: five lit plaza decks stepping up from the square to 200 m, small offices on each,
    // amber escalator tubes between decks, and a waterfall of delivery drones pouring down the front face.

    fb_bcp: { at: [500, 478], label: "Broadcasters' Corporate Park", labelY: 240, minSide: 46, reach: 550, face: [1, 1], build(x, z, w, d, st, r) {
      const S = Math.min(w, d), office = { ...st, base: [.07, .08, .09], win: [.9, 1, .85], lit: .55, grime: .15 };
      const decks = 5, step = S / (decks + 1);
      let prev = null;
      for (let k = 0; k < decks; k++) {
        const y = 40 * (k + 1), dz = z + S / 2 - step * (k + 1.2), dd = step * 1.4, dw = S * (.95 - k * .07);

        // Support core, deck slab, green-white edge light.

        bld(x - dw * .3, dz - dd * .2, 10, 10, y, office, r, { skin: SKINS.bands, roof: false, kibble: false });
        bld(x + dw * .3, dz - dd * .2, 10, 10, y, office, r, { skin: SKINS.bands, roof: false, kibble: false });
        prop('box', x, y - 1, dz, dw, 2, dd, [.08, .085, .09]);
        glow(x, y - 1.6, dz + dd / 2 + .1, dw, .5, .2, [.6, 1.4, .9]);
        glow(x, y + .05, dz, dw - 4, .1, dd - 4, [.18, .26, .2]);

        // Small office blocks on the deck.

        for (let j = 0; j < 3; j++) {
          const ow = 8 + r() * 8, oh = 10 + r() * 14;
          bld(x + (j - 1) * dw * .3, dz - dd * .15, ow, dd * .5, oh, office, r, { y0: y, skin: SKINS.grid, kibble: false });
        }

        // Escalator tube to the deck below.

        const front = [x + dw * .42, y, dz + dd / 2 - 2];
        if (prev) beam(prev, front, 1.2, dim(AMBER, .8), 'glow');
        else beam([x + dw * .42, 0, z + S / 2], front, 1.2, dim(AMBER, .8), 'glow');
        prev = [x - dw * .42, y, dz + dd / 2 - 2];
        glow(prev[0], y + 4, prev[2], 1.2, 8, 1.2, dim(AMBER, .6));
      }
      textSign('BCP', x, 192, prev[2] + 2.3, 20, 6, 0, [.8, 1.5, 1]);
      beacon(x, 226, prev[2] - 6, r);

      // Drone waterfall: vertical streams of gold lights in front of the decks. Each stream is periodic in
      // its spacing, so sliding the whole set down by one spacing loops without a seam.

      const xyz = [], col = [], sp = 6;
      for (let c = 0; c < 48; c++) {
        const px = x + (r() - .5) * S * .8, pz = z + S / 2 + 1 + r() * 5, off = r() * sp, h = 200 + r() * 20;
        for (let yy = off; yy < h; yy += sp) {
          xyz.push(px, yy, pz);
          const b = .5 + r() * .7;
          col.push(1.3 * b, .95 * b, .25 * b);
        }
      }
      A.fall = points(xyz, col);
      A.fallSp = sp;
      pool(x, z + S / 2, S * .4, dim(GOLD, .08));
    }, update(t) {
      if (A.fall) A.fall.position.y = -((t * 9) % A.fallSp);
    } },

    // NBNNS, the Nebenins: a broad windowless server block with a ribbed face, cyan status lines on the ribs,
    // cooling units venting on the roof, a gold NBN strip, and a cyan scan band climbing the front.

    fb_nbnns: { at: [525, 500], label: 'NBNNS', labelY: 100, minSide: 44, reach: 550, face: [0, 1], build(x, z, w, d, st, r) {
      const W = Math.min(w, 90), D = Math.min(d, 70), h = 80;
      bld(x, z, W, D, h, { ...st, base: [.06, .065, .075], lit: 0, grime: .3 }, r, { skin: SKINS.sparse, roof: false, kibble: false });

      // Ribs on the front and back, each with a thin cyan status line.

      for (const s of [-1, 1]) for (let k = 0; k < 14; k++) {
        const px = x - W / 2 + 3 + k * (W - 6) / 13, pz = z + s * (D / 2 + .8);
        prop('box', px, h / 2, pz, 1.2, h, 1.6, [.08, .085, .1]);
        glow(px, h * (.3 + .5 * r()), pz + s * .85, .2, 6 + r() * 30, .1, dim(CYAN, .6 + r() * .5));
      }

      // Gold logo strip, name, and the cold blue light round the base.

      glow(x, h - 3, z + D / 2 + 1.7, W * .8, 1.2, .2, GOLD);
      textSign('NBN NET SERVICES', x, h - 8, z + D / 2 + 1.8, 34, 4.5, 0, dim(GOLD, 1.1));
      glow(x, 3, z + D / 2 + 1.7, 8, 6, .2, dim(CYAN, .7));
      pool(x, z, Math.max(W, D) * .7, [.04, .1, .2]);

      // Roof: cooling units with fan glows and pale plumes.

      for (let k = 0; k < 10; k++) {
        const px = x + ((k % 5) - 2) * W * .18, pz = z + (k < 5 ? -1 : 1) * D * .22;
        prop('box', px, h + 3, pz, 10, 6, 10, [.1, .1, .11]);
        prop('cyl', px, h + 6.4, pz, 8, .8, 8, [.05, .05, .06]);
        put(GLOWS.ring, px, h + 6.9, pz, 7, 1, 7, 0, 0, dim(CYAN, .5));
        if (k % 2 === 0) for (let j = 0; j < 3; j++) puff(px, h + 12 + j * 7, pz, 4 + j * 2, [.13, .14, .16]);
      }

      // Scan band: one thin cyan sheet that climbs the front face.

      const band = mesh(H.decor, GEO.box, holoMat(CYAN), x, 0, z + D / 2 + 2, W * .9, 1.2, .3);
      A.scan = band; A.scanH = h;
    }, update(t) {
      if (A.scan) A.scan.position.y = 2 + (t * 6) % (A.scanH - 4);
    } },

    // The Dollhouse: a white residential slab with a fairy-tale castle crown. Pale turrets, blue-grey cone roofs,
    // gold windows, and one floor two-thirds up lit police red where Unit 468 stays sealed.

    fb_doll: { at: [510, 515], label: 'The Dollhouse', labelY: 175, minSide: 36, reach: 500, face: [0, 1], build(x, z, w, d, st, r) {
      const W = Math.min(w, 44), D = Math.min(d, 30), h = 120, white = { ...st, base: [.42, .42, .44], win: [1, .9, .7], lit: .4, grime: .05 };
      bld(x, z, W, D, h, white, r, { skin: SKINS.grid, roof: false, kibble: false });

      // Unit 468: a red row on two faces.

      const uy = h * .66;
      for (const s of [-1, 1]) glow(x, uy, z + s * (D / 2 + .1), W * .6, 2.6, .2, dim(RED, .55));
      for (let k = 0; k < 3; k++) glow(x - W * .2 + k * W * .2, uy, z + D / 2 + .3, 2, .3, .1, [1.6, 1.4, .2]);

      // Castle crown: a cornice with battlements round the roof edge, a stepped plinth, a keep,
      // four corner turrets on corbels, and two slim spires.

      const roofC = [.22, .27, .34], wall = [.5, .5, .52];
      prop('box', x, h + 1, z, W + 1.6, 2, D + 1.6, wall);
      glow(x, h + .1, z, W + 1.8, .3, D + 1.8, [1.6, 1.25, .5]);
      for (const [ex, ez, len, along] of [[0, D / 2 + .5, W, 1], [0, -D / 2 - .5, W, 1], [W / 2 + .5, 0, D, 0], [-W / 2 - .5, 0, D, 0]]) {
        for (let t = -len / 2 + 7; t <= len / 2 - 7; t += 3) {
          prop('box', x + ex + (along ? t : 0), h + 2.8, z + ez + (along ? 0 : t), along ? 1.6 : .8, 1.6, along ? .8 : 1.6, wall);
        }
      }
      prop('box', x, h + 1.75, z, W * .78, 3.5, D * .8, wall);
      prop('box', x, h + 3, z, W * .66, 6, D * .7, wall);
      prop('box', x, h + 9, z, W * .55, 18, D * .6, wall);
      prop('cone', x, h + 26, z, W * .5, 16, D * .7, roofC);
      for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const tx = x + cx * (W / 2 - 3), tz = z + cz * (D / 2 - 3), th = 14 + r() * 8;
        prop('cyl', tx, h + 1.5, tz, 8, 3, 8, wall);
        prop('cyl', tx, h + th / 2, tz, 6, th, 6, wall);
        prop('cone', tx, h + th + 5, tz, 7.5, 10, 7.5, roofC);
        glow(tx, h + th * .6, tz + 3.05 * Math.sign(cz), 1, 1.8, .1, [1.6, 1.2, .45]);
      }
      for (const s of [-1, 1]) {
        prop('cyl', x + s * W * .15, h + 28, z, 3.5, 20, 3.5, wall);
        prop('cone', x + s * W * .15, h + 44, z, 4.5, 12, 4.5, roofC);
        beacon(x + s * W * .15, h + 50.5, z, r);
      }
      for (let k = 0; k < 6; k++) glow(x + (k - 2.5) * W * .08, h + 10, z + D * .3 + .1, 1.2, 2.4, .1, [1.6, 1.25, .5]);

      // Cold white wash up the facade.

      for (const s of [-1, 1]) glow(x + s * W * .3, 1.5, z + D / 2 + 1.5, 2, .6, .6, [1.2, 1.3, 1.5]);
      pool(x, z + D / 2 + 4, W * .7, [.1, .11, .14]);
      textSign('RESIDENCES', x, 6, z + D / 2 + .3, 12, 2.4, 0, [1, 1.05, 1.2]);
    } },

    // New Angeles Stock Exchange: a carbosteel beehive across the square from NBN. Stacked bands bulge and
    // narrow like a skep, each rib lit gold, amber honeycomb cells between them, and a ticker of green and red
    // lights circling the waist. The All-Seeing Eye glows under a glass cap on the crown.

    fb_nasx: { at: [514, 490], label: 'New Angeles Stock Exchange', labelY: 185, minSide: 50, reach: 500, face: [0, 1], build(x, z, w, d, st, r) {
      const carbo = { ...st, base: [.1, .09, .08], win: [1, .7, .3], lit: .12, grime: .3 }, rib = [.16, .14, .11];
      const R = Math.min(w, d) / 2 + 1, bh = 16, PROFILE = [.74, .9, 1, 1, .96, .88, .76, .6, .42];
      const AMBERC = dim(AMBER, .55);

      PROFILE.forEach((f, i) => {
        const y0 = 4 + i * bh, rr = R * f;
        bld(x, z, rr * 1.9, rr * 1.9, bh, carbo, r, { y0, shape: 'cyl', roof: false, kibble: false, skin: SKINS.sparse, glow: 0 });

        // The rib is a fat roll, like the straw coils of a skep, with a thin gold line on its crest.

        for (const [f2, hh] of [[1, 4.5], [1.04, 2.6]]) prop('cyl', x, y0 + .5, z, (rr * 2 + 4) * f2, hh, (rr * 2 + 4) * f2, rib);
        put(GLOWS.ring, x, y0 + 1.9, z, (rr * 2 + 4) * 1.045, 1, (rr * 2 + 4) * 1.045, 0, 0, dim(GOLD, .5));

        // Honeycomb cells: two staggered rows of amber windows round each band.

        const n = Math.round(rr * 1.1);
        for (const [row, off] of [[.35, 0], [.7, .5]]) for (let k = 0; k < n; k++) {
          if (r() < .3) continue;
          const a = (k + off) / n * Math.PI * 2;
          glow(x + Math.sin(a) * (rr * .95 + .15), y0 + 2.5 + (bh - 2.5) * row, z + Math.cos(a) * (rr * .95 + .15), 2.2, 1.6, .2, AMBERC, a);
        }
      });

      // Crown: the last rib, a glass cap, and the Eye inside it with its iris ring.

      const top = 4 + PROFILE.length * bh, cr = R * .44;
      prop('cyl', x, top, z, cr * 2 + 3, 2.4, cr * 2 + 3, rib);
      put(GLOWS.ring, x, top + 1.3, z, cr * 2 + 3.1, 1, cr * 2 + 3.1, 0, 0, GOLD);
      mesh(H.decor, GEO.dome, holoMat([.12, .2, .25]), x, top + 1, z, cr * 2, cr * 1.6, cr * 2);
      put(GLOWS.sphere, x, top + cr * .45, z, cr * .9, cr * .9, cr * .9, 0, 0, [1.9, .55, .12]);
      put(GLOWS.ring, x, top + cr * .45, z, cr * 1.15, 1, cr * 1.15, 0, Math.PI / 2, dim(GOLD, 1.2));
      beacon(x, top + cr * 1.7, z, r);

      // Ticker round the waist, green and red, turning against each other.

      A.tickUp = orbit(70, R * 1.02 + 2.2, 4 + bh * 2.5, [.2, 1.7, .4], 0, r);
      A.tickDn = orbit(50, R * 1.02 + 2.4, 4 + bh * 2.5 - 1.6, [1.7, .15, .1], 0, r);

      // Front: a broad stair up to a gold portal, the name above it, and visitors queueing for the galleries.

      const fz = z + R * .84;
      for (let k = 0; k < 4; k++) prop('box', x, (k + 1) * .5, fz + 6 - k * 1.5, R * .9 - k * 2, (k + 1), 1.6, [.08, .08, .09]);
      glow(x, 7, fz + .3, R * .5, 9, .3, dim(GOLD, .7));
      textSign('NEW ANGELES STOCK EXCHANGE', x, 15, fz + .8, 34, 3.4, 0, GOLD);
      for (let k = 0; k < 24; k++) prop('box', x + (r() - .5) * R * .9, 2.85, fz + 7 + r() * 8, .5, 1.7, .45, [.06, .06, .065]);
      pool(x, fz + 10, R * .7, dim(GOLD, .1));
    }, update(t) {
      if (A.tickUp) A.tickUp.rotation.y = t * .1;
      if (A.tickDn) A.tickDn.rotation.y = -t * .07;
    } },

    // La Concordia: the luxury market street. A glass-vaulted galleria runs the long way through the block
    // between two rows of cream stone shopfronts, with a domed crossing in the middle. Flagship windows glow
    // gold on the outer faces, holo models stand at both entrances, and shoppers' hoppers land on the roof.

    fb_concordia: { at: [473, 446], label: 'La Concordia', labelY: 60, minSide: 46, reach: 550, face: [0, 1], build(x, z, w, d, st, r) {
      const ax = w >= d, L = Math.max(w, d) * .98, Dd = Math.min(w, d) * .96;
      const P = (a, b) => ax ? [x + a, z + b] : [x + b, z + a];
      const RY = ax ? 0 : Math.PI / 2, rowD = (Dd - 14) / 2, h = 26;
      const stone = { ...st, base: [.5, .46, .4], win: [1, .85, .6], lit: .55, grime: .04 }, glassC = [.1, .13, .16];
      const WARM = [1.6, 1.3, .8];

      // Two shopfront rows, each with a gold cornice line.

      for (const s of [-1, 1]) {
        const [rx, rz] = P(0, s * (7 + rowD / 2));
        bld(rx, rz, ax ? L : rowD, ax ? rowD : L, h, stone, r, { skin: SKINS.grid, roof: false, kibble: false });
        const bw = ax ? L : rowD, bd = ax ? rowD : L;
        prop('box', rx, h + .8, rz, bw + 1, 1.6, bd + 1, [.3, .28, .25]);
        for (const e of [-1, 1]) {
          glow(rx, h + .2, rz + e * (bd / 2 + .55), bw + 1.1, .4, .15, dim(GOLD, .8));
          glow(rx + e * (bw / 2 + .55), h + .2, rz, .15, .4, bd + 1.1, dim(GOLD, .8));
        }

        // Flagship windows on the outer face: tall lit arches, every fourth with a brand sign.

        const BRANDS = ['COUTURE', 'JEWELS', 'SMARTFABRIC', 'CHROME', 'PARFUM', 'ATELIER'];
        for (let t = -L / 2 + 5, k = 0; t <= L / 2 - 5; t += 7.5, k++) {
          const [gx, gz] = P(t, s * (Dd / 2 + .15));
          glow(gx, 4.5, gz, ax ? 4.6 : .2, 8, ax ? .2 : 4.6, k % 3 ? dim(WARM, .7) : WARM);
          if (k % 4 === 1) {
            const [sx, sz] = P(t, s * (Dd / 2 + .3));
            textSign(BRANDS[(k + (s > 0 ? 3 : 0)) % BRANDS.length], sx, 10.5, sz, 8, 1.6, RY + (s > 0 ? 0 : Math.PI), GOLD);
          }
        }
      }

      // The vault over the gallery, lit ribs along it, and the domed crossing.

      prop('cyl', x, h - 2, z, 14, L, 14, glassC, RY + Math.PI / 2, Math.PI / 2);
      for (let t = -L / 2; t <= L / 2; t += L / 10) {
        const [px, pz] = P(t, 0);
        put(GLOWS.ring, px, h - 2, pz, 14.2, 1, 14.2, RY + Math.PI / 2, Math.PI / 2, dim(WARM, .6));
      }
      glow(x, h + 5, z, ax ? L : .4, .3, ax ? .4 : L, dim(GOLD, .7));
      prop('cyl', x, h + 1, z, 20, 4, 20, [.45, .42, .37]);
      mesh(H.decor, GEO.dome, holoMat([.55, .42, .18]), x, h + 3, z, 19, 16, 19);
      put(GLOWS.ring, x, h + 3.2, z, 20.5, 1, 20.5, 0, 0, GOLD);
      prop('cyl', x, h + 12, z, 1, 4, 1, [.5, .45, .3]);
      put(GLOWS.sphere, x, h + 14.5, z, 1.6, 1.6, 1.6, 0, 0, GOLD);

      // Entrances at both ends: a gold arch, the name, a warm carpet of light, and holo models on plinths.

      for (const e of [-1, 1]) {
        const [ex, ez] = P(e * (L / 2 + .2), 0), ry = RY + (e > 0 ? Math.PI / 2 : -Math.PI / 2);
        glow(ex, 9, ez, ax ? .3 : 11, 16, ax ? 11 : .3, dim(WARM, .9));
        const [nx, nz] = P(e * (L / 2 + .5), 0);
        textSign('LA CONCORDIA', nx, h - 4, nz, 16, 3, ry, GOLD);
        const [cx, cz] = P(e * (L / 2 + 6), 0);
        pool(cx, cz, 9, dim(GOLD, .14));
        for (const s of [-1, 1]) {
          const [mx, mz] = P(e * (L / 2 + 4), s * 9);
          prop('cyl', mx, .6, mz, 2.6, 1.2, 2.6, [.4, .37, .3]);
          glow(mx, 4, mz, .9, 5.2, .5, HOT[(e + s + 2) % 4]);
          put(GLOWS.sphere, mx, 7.1, mz, .9, 1, .9, 0, 0, HOT[(e + s + 3) % 4]);
        }
      }

      // Hopper pads on both roofs, each with a lit rim and one hopper parked.

      for (const s of [-1, 1]) for (const t of [-.3, .3]) {
        const [hx, hz] = P(t * L, s * (7 + rowD / 2));
        prop('cyl', hx, h + 1.9, hz, rowD * .7, .6, rowD * .7, [.12, .12, .13]);
        put(GLOWS.ring, hx, h + 2.3, hz, rowD * .72, 1, rowD * .72, 0, 0, dim(CYAN, .8));
        if (t * s > 0) {
          prop('box', hx, h + 3, hz, 3, 1.4, 6, [.75, .72, .66], RY);
          glow(hx, h + 2.35, hz, 3.2, .2, 6.2, dim(WHITE, .5), RY);
        }
      }

      // Shoppers along both street faces, and bioroid couriers with bags in a line toward the entrance.

      for (let k = 0; k < 50; k++) {
        const [px, pz] = P((r() - .5) * L, (r() < .5 ? -1 : 1) * (Dd / 2 + 2 + r() * 4));
        prop('box', px, .85, pz, .5, 1.7, .45, [.07, .065, .06]);
      }
      for (let k = 0; k < 6; k++) {
        const [px, pz] = P(L / 2 + 8 + k * 3, -2);
        prop('box', px, .9, pz, .55, 1.8, .45, [.55, .58, .62]);
        glow(px, 1.6, pz, .6, .12, .5, dim(CYAN, .8));
      }
    } },
  };
}
