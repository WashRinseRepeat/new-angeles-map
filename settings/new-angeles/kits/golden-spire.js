// The Golden Spire: a gilded theme park for the Pleasure Principle side quest.
// It sits on a reclaimed island off the Manta coast, joined to the shore by a gold causeway.

export const kits = () => ({});

const GOLD = [1.6, 1.1, .35], DGOLD = [.34, .25, .08], PINK = [1.8, .25, 1.3], CYAN = [.3, 1.4, 1.8];
const LOUD = [[1.8, .2, 1.2], [.2, 1.6, 1.6], [1.6, 1.4, .2], [.4, 1.8, .4], [1.8, .4, .2]];
const WORDS = ['FLOW x2', 'BOOST', 'SPIN TO WIN', 'DOUBLE DOWN', 'LEVEL UP', 'FREE SPIN', '+500 FLOW', 'JACKPOT', 'ALL IN', 'STREAK!'];
const BOARD = [['V. KANE', '9,812,440'], ['ORTEGA-9', '8,904,115'], ['M. LIU', '7,660,302'], ['GOLDCHILD', '7,118,950'], ['T. ASHFORD', '6,544,020'],
  ['DR. SAITO', '5,902,777'], ['BIG RICKY', '5,310,488'], ['ANYA.V', '4,876,001'], ['J. MERCER', '4,120,560'], ['YOU?', '0']];

const dim = (rgb, k) => rgb.map(c => c * k);
const pick = (r, a) => a[Math.floor(r() * a.length)];
const wrap = a => ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;

// Animated parts live in their own meshes in the landmark group.

const A = { car: null, lamp: null, gond: null, gring: null, mascot: null, SP: null, N: 0, L: 1, top: 0, s: 0, ff: [0, 0], ffTop: 0, face: 0, i: 0, j: 0, u: 0, wheel: null, spoke: null, cab: null };
const CARS = 7, GAP = 5.5, SPOKES = 12, SPIN = Math.PI * 2 / 90;
let _o = null, _q = null;

// Arc position s in metres to the sample pair A.i, A.j and the blend A.u.

const seek = s => { const f = (((s / A.L) % 1) + 1) % 1 * A.N, i = Math.floor(f); A.i = i % A.N; A.j = (i + 1) % A.N; A.u = f - i; };

export function landmarks(H) {
  const { THREE, SKINS, PROPS, GLOWS, beacon, beam, bld, glow, prop, put, textSign, flickerGlow, stringLights, canvasTexture, lerp } = H;
  const pool = (x, z, rad, rgb) => H.pool?.(x, z, rad, rgb);
  const own = m => { m.userData.noTile = true; m.frustumCulled = false; H.decor.add(m); return m; };

  // Unit vector from the block centre to the nearest coast point, in local metres, and the distance.

  const seaward = () => {
    const [wx, wz] = H.worldOf(0, 0);
    let d = Infinity, px = wx, pz = wz;
    for (const line of H.CITY.coast ?? []) for (let i = 0; i + 1 < line.length; i++) {
      const [ax, az] = line[i], [bx, bz] = line[i + 1], ex = bx - ax, ez = bz - az;
      const t = Math.max(0, Math.min(1, ((wx - ax) * ex + (wz - az) * ez) / (ex * ex + ez * ez || 1)));
      const qx = ax + ex * t, qz = az + ez * t, e = Math.hypot(wx - qx, wz - qz);
      if (e < d) { d = e; px = qx; pz = qz; }
    }
    const [lx, lz] = H.toLocal(px, pz), L = Math.hypot(lx, lz) || 1;
    return { ux: lx / L, uz: lz / L, d: Math.min(d, 200) };
  };

  const boardTex = () => canvasTexture(512, 768, (g, W, Hh) => {
    g.fillStyle = '#0a0703'; g.fillRect(0, 0, W, Hh);
    g.strokeStyle = '#ffc040'; g.lineWidth = 8; g.strokeRect(8, 8, W - 16, Hh - 16);
    g.fillStyle = '#ffd060'; g.font = 'bold 86px sans-serif'; g.textAlign = 'center'; g.fillText('TOP FLOW', W / 2, 110);
    g.font = 'bold 36px sans-serif';
    BOARD.forEach(([n, s], k) => {
      const y = 190 + k * 56, me = n === 'YOU?';
      g.fillStyle = me ? '#ff40c0' : k < 3 ? '#ffe080' : '#e0c890';
      g.textAlign = 'left'; g.fillText(`${k + 1}. ${n}`, 34, y);
      g.textAlign = 'right'; g.fillText(s, W - 34, y);
      g.fillStyle = me ? '#ff40c0' : '#ffb030'; g.fillRect(34, y + 10, (W - 68) * (me ? .02 : 1 - k * .09), 6);
    });
  });

  // Bullion, the park's bull mascot, with dollar eyes and a grin.

  const mascotTex = () => canvasTexture(512, 512, (g, W) => {
    const c = W / 2, grad = g.createRadialGradient(c, c, 20, c, c, c);
    grad.addColorStop(0, 'rgba(255,190,60,.35)'); grad.addColorStop(1, 'rgba(255,190,60,0)');
    g.fillStyle = grad; g.fillRect(0, 0, W, W);
    g.strokeStyle = '#ffd070'; g.lineWidth = 26; g.lineCap = 'round';
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(c + s * 90, 170); g.quadraticCurveTo(c + s * 220, 150, c + s * 200, 40); g.stroke(); }
    g.fillStyle = '#ffb83a'; g.beginPath(); g.ellipse(c, 270, 150, 170, 0, 0, 7); g.fill();
    g.fillStyle = '#ffe2a0'; g.beginPath(); g.ellipse(c, 360, 100, 70, 0, 0, 7); g.fill();
    g.fillStyle = '#20e070'; g.font = 'bold 96px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const s of [-1, 1]) g.fillText('$', c + s * 62, 225);
    g.strokeStyle = '#7a3a00'; g.lineWidth = 12;
    g.beginPath(); g.arc(c, 340, 70, .2, Math.PI - .2); g.stroke();
    g.fillStyle = '#7a3a00'; for (const s of [-1, 1]) { g.beginPath(); g.arc(c + s * 40, 345, 12, 0, 7); g.fill(); }
    g.fillStyle = '#ff40c0'; g.fillRect(c - 140, 470, 280, 26);
  });

  return {

    // The Golden Spire: a gold causeway to a sealed island park. A gold spire at the centre, a magenta coaster
    // with two loops and a corkscrew on the rim, a freefall tower, a wheel, quiet gold VIP domes on one side
    // and a loud low-Flow midway on the other, Top Flow leaderboards and Bullion the holo-bull over the gate.

    gs_spire: {
      at: [491, 1271], label: 'The Golden Spire', minSide: 24, reach: 300, labelY: 260,
      build(x, z, w, d, st, r) {
        const S = seaward(), { ux, uz } = S, vx = -uz, vz = ux, ang = Math.atan2(ux, uz), shoreAng = ang + Math.PI;
        const R = 165, ac = S.d + 60 + R, ix = ux * ac, iz = uz * ac;
        const P = (a, b) => [ix + ux * a + vx * b, iz + uz * a + vz * b];
        const goldSt = { ...st, base: DGOLD, win: [1.2, .85, .35], lit: .45 };
        const darkSt = { ...st, base: [.07, .06, .05], win: [1, .8, .5], lit: .25 };
        _o = new THREE.Object3D(); _q = new THREE.Vector3();

        // Shore pavilion: the ticket hall on the block, and the causeway out to the island.

        const s0 = Math.min(w, d) * .3;
        bld(ux * -s0 * .3, uz * -s0 * .3, w * .7, d * .7, 9, goldSt, r, { skin: SKINS.curtain, roof: false });
        glow(0, 9.2, 0, w * .72, .3, d * .72, dim(GOLD, .8));
        textSign('THE GOLDEN SPIRE', ux * -s0 * .3, 12.5, uz * -s0 * .3, 20, 3, shoreAng, GOLD);
        const c0 = s0, c1 = ac - R + 4, cm = (c0 + c1) / 2, cl = c1 - c0;
        prop('box', ux * cm, .9, uz * cm, 16, 1.6, cl, [.12, .09, .04], ang);
        for (const sd of [-7.6, 7.6]) beam([ux * c0 + vx * sd, 2, uz * c0 + vz * sd], [ux * c1 + vx * sd, 2, uz * c1 + vz * sd], .3, dim(GOLD, .9), 'glow');
        for (let k = c0 + 8; k < c1; k += 18) {
          prop('box', ux * k, -2, uz * k, 10, 4, 3, [.06, .05, .04], ang);
          for (const sd of [-7.6, 7.6]) {
            const lx = ux * k + vx * sd, lz = uz * k + vz * sd;
            prop('cyl', lx, 4, lz, .3, 5, .3, [.05, .04, .03]);
            put(GLOWS.sphere, lx, 6.7, lz, 1, 1, 1, 0, 0, GOLD);
          }
          pool(ux * k, uz * k, 12, dim(GOLD, .06));
        }

        // The island: a rock base, a breakwater, a gold rim and the sealed perimeter fence.

        prop('cyl', ix, -3, iz, 2 * R + 18, 5, 2 * R + 18, [.05, .05, .045]);
        prop('cyl', ix, -1.5, iz, 2 * R, 4, 2 * R, [.09, .075, .05]);
        put(GLOWS.ring, ix, .7, iz, 2 * R, 2, 2 * R, 0, 0, dim(GOLD, .9));
        put(GLOWS.ring, ix, 14, iz, 2 * R - 2, 1, 2 * R - 2, 0, 0, dim(GOLD, .5));
        for (let k = 0; k < 24; k++) {
          const t = k / 24 * Math.PI * 2, [px, pz] = P(Math.cos(t) * (R - 1), Math.sin(t) * (R - 1));
          if (Math.cos(t) < -.985) continue;
          prop('box', px, 7, pz, .8, 14, .8, [.1, .08, .04]);
          glow(px, 14.3, pz, 1.2, .6, 1.2, GOLD);
        }

        // Gold entrance gate at the causeway end, with wristband scanner arches.

        const [gx, gz] = P(-R + 6, 0);
        for (const sd of [-14, 14]) {
          const [px, pz] = P(-R + 6, sd);
          bld(px, pz, 6, 6, 32, goldSt, r, { skin: SKINS.fins, roof: false, ry: ang });
          glow(px, 32.3, pz, 6.4, .5, 6.4, GOLD);
        }
        const [a1x, a1z] = P(-R + 6, -14), [a2x, a2z] = P(-R + 6, 14);
        beam([a1x, 30, a1z], [a2x, 30, a2z], 3, DGOLD);
        beam([a1x, 27.8, a1z], [a2x, 27.8, a2z], .4, GOLD, 'glow');
        textSign('THE GOLDEN SPIRE', gx - ux * 1.8, 30, gz - uz * 1.8, 22, 3.6, shoreAng, GOLD);
        textSign('WELCOME, VALUED GUEST', gx - ux * 1.8, 24.5, gz - uz * 1.8, 16, 1.8, shoreAng, dim(CYAN, .8));
        for (let k = -2; k <= 2; k++) {
          const [p1x, p1z] = P(-R + 10, k * 4 - 1.4), [p2x, p2z] = P(-R + 10, k * 4 + 1.4);
          beam([p1x, 0, p1z], [p1x, 3.2, p1z], .3, dim(CYAN, .8), 'glow');
          beam([p2x, 0, p2z], [p2x, 3.2, p2z], .3, dim(CYAN, .8), 'glow');
          beam([p1x, 3.2, p1z], [p2x, 3.2, p2z], .3, dim(CYAN, .8), 'glow');
        }
        pool(gx, gz, 26, dim(GOLD, .08));

        // The spire: a podium, eight tapering gold tiers with halo rings, a cone, and a lit mast.

        const [sx, sz] = P(0, 0);
        bld(sx, sz, 50, 50, 10, goldSt, r, { shape: 'oct', skin: SKINS.bands, roof: false, glow: .2 });
        let y = 10;
        for (let k = 0; k < 8; k++) {
          const tw = lerp(34, 9, k / 7), th = 21;
          bld(sx, sz, tw, tw, th - .6, goldSt, r, { y0: y, shape: 'oct', skin: k > 4 ? SKINS.fins : SKINS.curtain, roof: false, glow: .25, ry: ang });
          y += th;
          put(GLOWS.ring, sx, y - .3, sz, tw * 1.12, tw * 1.12, tw * 1.12, 0, 0, GOLD);
          for (const [fa, fb] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const o = tw / 2 + .2, [px, pz] = P(fa * o, fb * o);
            glow(px, y - th / 2, pz, .6, th - 4, .6, dim(GOLD, .7));
          }
        }
        prop('cone', sx, y + 22, sz, 9, 44, 9, [.8, .6, .2]);
        beam([sx, y + 44, sz], [sx, y + 68, sz], .9, GOLD, 'glow');
        put(GLOWS.sphere, sx, y + 44, sz, 4, 4, 4, 0, 0, dim(GOLD, 1.4));
        beacon(sx, y + 69, sz, r);
        pool(sx, sz, 60, dim(GOLD, .1));

        // Top Flow leaderboards: four on the spire, two towers by the gate.

        const tex = boardTex(), plane = new THREE.PlaneGeometry(1, 1);
        const screen = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setScalar(1.4), side: THREE.DoubleSide });
        const board = (bx, by, bz, bw, ry) => {
          const m = new THREE.Mesh(plane, screen);
          m.position.set(bx, by, bz); m.scale.set(bw, bw * 1.5, 1); m.rotation.y = ry;
          H.decor.add(m);
        };
        {
          const tw = lerp(34, 9, 2 / 7), by = 10 + 21 * 2 + 10;
          for (const [fa, fb] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const [px, pz] = P(fa * (tw / 2 + 1.5), fb * (tw / 2 + 1.5));
            board(px, by, pz, 13, Math.atan2(fa * ux + fb * vx, fa * uz + fb * vz));
          }
        }
        for (const sd of [-48, 48]) {
          const [px, pz] = P(-118, sd), [fx, fz] = P(-123, sd);
          bld(px, pz, 8, 8, 72, darkSt, r, { skin: SKINS.sparse, roof: false, ry: ang });
          prop('box', fx + ux * .5, 52, fz + uz * .5, 30, 44, 1, [.05, .04, .03], ang);
          board(fx - ux * .2, 52, fz - uz * .2, 27, shoreAng);
          for (const yy of [29.6, 74.4]) glow(fx, yy, fz, 30, .6, 1.2, GOLD, ang);
          beacon(px, 74, pz, r);
          pool(fx, fz, 20, dim(GOLD, .07));
        }

        // Anti-Scan Domes: quiet gold glass over VIP lounges on the +b side, soft lamps and still pools.

        const domeGeo = new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(.45, .32, .08), transparent: true, opacity: .6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
        for (const [a, b, dr] of [[-52, 72, 24], [22, 88, 20], [72, 42, 27]]) {
          const [px, pz] = P(a, b), m = new THREE.Mesh(domeGeo, domeMat);
          m.position.set(px, .5, pz); m.scale.set(dr, dr * .75, dr);
          H.decor.add(m);
          put(GLOWS.ring, px, .8, pz, dr * 2, 1, dr * 2, 0, 0, GOLD);
          bld(px, pz, dr * .8, dr * .8, dr * .3, goldSt, r, { shape: 'oct', skin: SKINS.bands, roof: false, lit: .2 });
          pool(px, pz, dr * 1.4, dim(GOLD, .1));
          for (let k = 0; k < 4; k++) {
            const t = k / 4 * Math.PI * 2 + .4, lx = px + Math.cos(t) * (dr + 6), lz = pz + Math.sin(t) * (dr + 6);
            prop('cyl', lx, 2, lz, .25, 4, .25, [.06, .05, .03]);
            put(GLOWS.sphere, lx, 4.2, lz, .8, .8, .8, 0, 0, [1.3, 1.1, .8]);
          }
        }

        // The wheel and the freefall tower stand in the loud half.

        const [wx, wz] = P(-60, -72), wr = 30, wh = wr + 8;
        for (const sd of [-1, 1]) {
          const [lx, lz] = P(-60 + sd * 4, -72);
          for (const e of [-14, 14]) { const [fx, fz] = P(-60 + sd * 4, -72 + e); beam([fx, 0, fz], [lx, wh, lz], 1.2, [.12, .1, .06]); }
        }
        put(GLOWS.ring, wx, wh, wz, wr * 2, wr * 2, wr * 2, ang, Math.PI / 2, PINK);
        put(GLOWS.ring, wx, wh, wz, wr * 1.2, wr * 1.2, wr * 1.2, ang, Math.PI / 2, GOLD);

        // Spokes and gondolas turn in update. The rings are round, so they stay put.

        A.wheel = [wx, wh, wz, wr, vx, vz];
        A.spoke = own(new THREE.InstancedMesh(PROPS.box.geometry, GLOWS.sphere.material, SPOKES));
        A.cab = own(new THREE.InstancedMesh(GLOWS.sphere.geometry, GLOWS.sphere.material, SPOKES));
        { const c = new THREE.Color(); for (let k = 0; k < SPOKES; k++) { A.spoke.setColorAt(k, c.setRGB(...dim(GOLD, .6))); A.cab.setColorAt(k, c.setRGB(...pick(r, LOUD))); } }
        put(GLOWS.sphere, wx, wh, wz, 3, 3, 3, 0, 0, GOLD);
        pool(wx, wz, 34, dim(PINK, .08));

        const [fx, fz] = P(76, -52), fh = 130;
        A.ff = [fx, fz]; A.ffTop = fh - 10;
        prop('lattice', fx, fh / 2, fz, 7, fh, 7, [.16, .13, .08]);
        prop('cyl', fx, fh / 2, fz, 3, fh, 3, [.08, .07, .05]);
        for (const [ea, eb] of [[1, 0], [-1, 0]]) { const [px, pz] = P(76 + ea * 2, -52 + eb * 2); glow(px, fh / 2, pz, .5, fh - 6, .5, PINK); }
        prop('box', fx, fh + 3, fz, 9, 6, 9, [.12, .1, .06]);
        glow(fx, fh + 6.3, fz, 9.4, .6, 9.4, PINK);
        textSign('MARGIN CALL', fx - ux * 4.8, fh + 3, fz - uz * 4.8, 8.5, 1.6, shoreAng, GOLD);
        beacon(fx, fh + 8, fz, r);
        pool(fx, fz, 20, dim(PINK, .1));

        // Low-Flow midway: crowded booths, loud signs, flicker and string lights on the -b side.

        const booths = [];
        for (let k = 0; k < 120 && booths.length < 38; k++) {
          const a = -105 + r() * 175, b = -20 - r() * 110, rr = Math.hypot(a, b);
          if (rr > 108 || rr < 34 || Math.hypot(a + 60, b + 72) < 26 || Math.hypot(a - 76, b + 52) < 14) continue;
          if (booths.some(q => Math.hypot(q[0] - a, q[1] - b) < 12)) continue;
          booths.push([a, b]);
        }
        for (const [a, b] of booths) {
          const [px, pz] = P(a, b), bw = 5 + r() * 5, bd = 5 + r() * 5, bh = 4 + r() * 8, ry = ang + (r() - .5) * 1.2, col = pick(r, LOUD);
          bld(px, pz, bw, bd, bh, { ...darkSt, base: dim(col, .12), win: col, lit: .5 }, r, { skin: SKINS.bands, roof: false, ry });
          textSign(pick(r, WORDS), px - Math.sin(ry) * (bd / 2 + .3), bh + 1.6, pz - Math.cos(ry) * (bd / 2 + .3), bw * 1.1, bw * .25, ry + Math.PI, col);
          if (r() < .45) flickerGlow(px, bh + .3, pz, bw * .9, .3, bd * .9, col, r);
          pool(px, pz, 10, dim(col, .12));
        }
        for (let k = 0; k + 1 < booths.length && k < 14; k += 2) {
          const [a1, b1] = booths[k], [a2, b2] = booths[k + 1], [p1x, p1z] = P(a1, b1), [p2x, p2z] = P(a2, b2);
          if (Math.hypot(a1 - a2, b1 - b2) < 40) stringLights([p1x, 9, p1z], [p2x, 9, p2z], 1.5, 7, pick(r, LOUD));
        }

        // Service dock on the seaward rim, with red lights and a dim glow under the water.

        const [kx, kz] = P(R - 4, 10);
        prop('box', kx, 2.5, kz, 14, 5, 10, [.05, .05, .05], ang);
        for (const sd of [-5, 5]) { const [px, pz] = P(R + 2, 10 + sd); glow(px, 4.2, pz, .6, .6, .6, [1.8, .1, .08]); }
        textSign('SL-4 STAFF ONLY', kx + ux * 5.2, 3.6, kz + uz * 5.2, 7, .9, ang, [1.2, .2, .15]);
        { const [px, pz] = P(R + 20, 10); glow(px, -1.6, pz, 18, .2, 10, [.35, .03, .03]); }

        // The coaster: a closed spline on the rim with a lift hill, two vertical loops and a corkscrew.

        const M = 1400, pts = [], LOOPS = [[1.78 * Math.PI, .3, 18], [.52 * Math.PI, .3, 17]], CORK = [.12 * Math.PI, .36, 7], HILL = 1.47 * Math.PI;
        const base = t => { const rho = 128 + 8 * Math.sin(3 * t); return [Math.cos(t) * rho, Math.sin(t) * rho]; };
        for (let i = 0; i < M; i++) {
          const t = i / M * Math.PI * 2, [a, b] = base(t), [a2, b2] = base(t + .001);
          let ta = a2 - a, tb = b2 - b; const tl = Math.hypot(ta, tb); ta /= tl; tb /= tl;
          const na = tb, nb = -ta, dh = wrap(t - HILL);
          let h = 16 + 8 * (1 + Math.sin(2 * t + 1)) / 2 + 58 * Math.exp(-((dh / (dh < 0 ? .5 : .16)) ** 2));
          let fa = 0, lat = 0;
          for (const [tc, span, rl] of LOOPS) {
            const q = wrap(t - tc) / span + .5;
            if (q >= 0 && q <= 1) { const f = q * Math.PI * 2; fa += rl * Math.sin(f); h += rl * (1 - Math.cos(f)); lat += 7 * q; }
            else if (q > 1 && q < 2) lat += 7 * (2 - q);
          }
          { const [tc, span, rc] = CORK, q = wrap(t - tc) / span + .5;
            if (q >= 0 && q <= 1) { const f = q * Math.PI * 2; lat += rc * Math.sin(f); h += rc * (1 - Math.cos(f)); } }
          const [px, pz] = P(a + ta * fa + na * lat, b + tb * fa + nb * lat);
          pts.push(new THREE.Vector3(px, h, pz));
        }
        const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
        curve.arcLengthDivisions = 6000;
        const track = new THREE.Mesh(new THREE.TubeGeometry(curve, 1800, 1.1, 6, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(...PINK) }));
        H.decor.add(track);
        for (let i = 0; i < M; i += 28) {
          const p = pts[i];
          if (p.y > 5) { prop('box', p.x, (p.y - 1.4) / 2, p.z, .9, p.y - 1.4, .9, [.2, .15, .06]); glow(p.x, .9, p.z, 1.6, .4, 1.6, dim(GOLD, .6)); }
        }

        // Arc-length samples drive the train with no per-frame allocation.

        A.N = 2400; A.L = curve.getLength(); A.SP = new Float32Array(A.N * 3);
        curve.getSpacedPoints(A.N).slice(0, A.N).forEach((p, i) => { A.SP[i * 3] = p.x; A.SP[i * 3 + 1] = p.y; A.SP[i * 3 + 2] = p.z; if (p.y > A.top) A.top = p.y; });
        A.car = own(new THREE.InstancedMesh(PROPS.box.geometry, GLOWS.sphere.material, CARS));
        A.lamp = own(new THREE.InstancedMesh(GLOWS.sphere.geometry, GLOWS.sphere.material, CARS));
        const cc = new THREE.Color();
        for (let k = 0; k < CARS; k++) { A.car.setColorAt(k, cc.setRGB(...(k ? dim(GOLD, .8) : [1.8, 1.5, .6]))); A.lamp.setColorAt(k, cc.setRGB(...CYAN)); }

        // Freefall gondola: a seat ring and two light rings round the tower.

        A.gond = own(new THREE.InstancedMesh(PROPS.cyl.geometry, PROPS.cyl.material, 1));
        A.gring = own(new THREE.InstancedMesh(GLOWS.ring.geometry, GLOWS.ring.material, 2));
        A.gond.setColorAt(0, cc.setRGB(.5, .38, .12));
        A.gring.setColorAt(0, cc.setRGB(...GOLD)); A.gring.setColorAt(1, cc.setRGB(...PINK));

        // Bullion the holo-bull floats over the entrance plaza, facing the shore.

        const [mx, mz] = P(-100, 0);
        A.mascot = own(new THREE.Mesh(new THREE.PlaneGeometry(44, 44), new THREE.MeshBasicMaterial({
          map: mascotTex(), color: new THREE.Color().setScalar(1.6), transparent: true, opacity: .8,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
        A.mascot.position.set(mx, 54, mz); A.face = shoreAng; A.mascot.rotation.y = shoreAng;
        put(GLOWS.ring, mx, 1, mz, 18, 1, 18, 0, 0, CYAN);
        beam([mx, .5, mz], [mx, 30, mz], 2.5, dim(CYAN, .25), 'glow');
        pool(mx, mz, 22, dim(CYAN, .1));

        return { focus: [ix, iz], face: [-ux, -uz], span: 340 };
      },

      update(t, dt) {
        if (!A.SP) return;
        const { SP, N } = A;

        // The train slows near the top and runs fast in the dips.

        seek(A.s);
        A.s += Math.min(dt, .1) * (7 + Math.sqrt(2 * 9.8 * Math.max(0, A.top + 2 - SP[A.i * 3 + 1])) * .85);
        for (let k = 0; k < CARS; k++) {
          seek(A.s - k * GAP);
          const { i, j, u } = A, n = (j + 1) % N;
          _o.position.set(SP[i * 3] + (SP[j * 3] - SP[i * 3]) * u, SP[i * 3 + 1] + (SP[j * 3 + 1] - SP[i * 3 + 1]) * u, SP[i * 3 + 2] + (SP[j * 3 + 2] - SP[i * 3 + 2]) * u);
          _o.scale.set(3.2, 2.4, 4.6);
          _q.set(SP[n * 3], SP[n * 3 + 1], SP[n * 3 + 2]); _o.lookAt(_q); _o.updateMatrix();
          A.car.setMatrixAt(k, _o.matrix);
          _o.translateZ(2.4); _o.scale.setScalar(1.3); _o.updateMatrix();
          A.lamp.setMatrixAt(k, _o.matrix);
        }
        A.car.instanceMatrix.needsUpdate = A.lamp.instanceMatrix.needsUpdate = true;

        // The wheel turns once in 90 s. Gondolas only translate, so they hang upright.

        const [wx, wh, wz, wr, vx, vz] = A.wheel;
        for (let k = 0; k < SPOKES; k++) {
          const a = k / SPOKES * Math.PI * 2 + t * SPIN, c = Math.cos(a) * wr, sn = Math.sin(a) * wr;
          _o.position.set(wx + vx * c / 2, wh + sn / 2, wz + vz * c / 2); _o.scale.set(.4, .4, wr);
          _q.set(wx + vx * c, wh + sn, wz + vz * c); _o.lookAt(_q); _o.updateMatrix();
          A.spoke.setMatrixAt(k, _o.matrix);
          _o.rotation.set(0, 0, 0); _o.position.copy(_q); _o.position.y -= 2; _o.scale.setScalar(2.6); _o.updateMatrix();
          A.cab.setMatrixAt(k, _o.matrix);
        }
        A.spoke.instanceMatrix.needsUpdate = A.cab.instanceMatrix.needsUpdate = true;

        // The gondola climbs for ten seconds, holds, drops in under two and brakes at the bottom.

        const c = t % 15, lo = 6, hi = A.ffTop;
        const gy = c < 10 ? lo + (hi - lo) * (1 - Math.cos(c / 10 * Math.PI)) / 2 : c < 11.5 ? hi : c < 13.1 ? hi - (hi - lo) * ((c - 11.5) / 1.6) ** 2 : lo;
        _o.rotation.set(0, 0, 0);
        _o.position.set(A.ff[0], gy, A.ff[1]); _o.scale.set(14, 2.6, 14); _o.updateMatrix(); A.gond.setMatrixAt(0, _o.matrix);
        _o.position.y = gy + 1.4; _o.scale.set(15, 2, 15); _o.updateMatrix(); A.gring.setMatrixAt(0, _o.matrix);
        _o.position.y = gy - 1.4; _o.updateMatrix(); A.gring.setMatrixAt(1, _o.matrix);
        A.gond.instanceMatrix.needsUpdate = A.gring.instanceMatrix.needsUpdate = true;

        // Bullion bobs and turns from side to side.

        A.mascot.position.y = 54 + Math.sin(t * .9) * 3;
        A.mascot.rotation.y = A.face + Math.sin(t * .35) * .55;
      },
    },
  };
}
