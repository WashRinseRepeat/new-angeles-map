// The Rabotgorod Hyper-Fusion Plant: the reactor that powers New Angeles. A concrete drum holds a glass sphere with
// the stellarator torus inside. Three hyperboloid cooling towers steam behind it, a turbine hall and a
// transformer yard stand beside it, and two high-voltage lines march off toward the city.

const CONC = [.13, .125, .12], DARK = [.06, .058, .056], STEEL = [.11, .11, .12];
const PLASMA = [.6, .25, 1.8], VIOLET = [.5, .25, 1.4], AMBER = [1.6, .7, .12], RED = [2, .1, .05], ICE = [.4, .8, 1.6];
const dim = (rgb, k) => rgb.map(c => c * k);

// Unit hyperboloid shell: base radius 1, height 1, throat 0.62 at 78% height.

const T0 = .78, RT = .62, CH = T0 / Math.sqrt(1 / RT ** 2 - 1);
const shellR = t => RT * Math.sqrt(1 + ((t - T0) / CH) ** 2);

// Steam and plasma animate in update. Each puff has a tower and a phase.

const A = { steam: null, core: null, towers: [], seeds: null, wind: [.8, .35] };
const PUFFS = 48, LIFE = 30;
let _o = null;

function plant(H) {
  const { THREE, GLOWS, SKINS, beacon, beam, bld, glow, prop, put, puff, textSign, flickerGlow, canvasTexture, soften } = H;
  const pool = (x, z, rad, rgb) => H.pool?.(x, z, rad, rgb);
  const own = m => { m.userData.noTile = true; m.frustumCulled = false; H.decor.add(m); return m; };

  // Board-marked concrete: pour lines, darker lifts and rain streaks.

  const concreteTex = () => {
    const t = canvasTexture(256, 512, (g, W, Hh) => {
      g.fillStyle = '#6c6964'; g.fillRect(0, 0, W, Hh);
      for (let y = 0; y < Hh; y += 16) { g.fillStyle = `rgba(0,0,0,${.05 + Math.random() * .1})`; g.fillRect(0, y, W, 16); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, y, W, 1); }
      for (let k = 0; k < 90; k++) {
        const x = Math.random() * W, y = Math.random() * Hh * .6, l = 40 + Math.random() * 200, gr = g.createLinearGradient(0, y, 0, y + l);
        gr.addColorStop(0, 'rgba(20,18,16,.5)'); gr.addColorStop(1, 'rgba(20,18,16,0)');
        g.fillStyle = gr; g.fillRect(x, y, 1 + Math.random() * 3, l);
      }
    });
    t.wrapS = THREE.RepeatWrapping; t.repeat.set(6, 1);
    return t;
  };

  // A pipe run at height y with posts every 8 m.

  const pipe = (x0, z0, x1, z1, y, dia, rgb = STEEL) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
    prop('cyl', (x0 + x1) / 2, y, (z0 + z1) / 2, dia, len, dia, rgb, ry, Math.PI / 2);
    for (let t = 4; t < len; t += 8) {
      const px = x0 + (x1 - x0) * t / len, pz = z0 + (z1 - z0) * t / len;
      prop('box', px, (y - dia / 2) / 2, pz, .5, y - dia / 2, .5, DARK);
    }
  };

  // A sagging cable from a to b in four straight spans.

  const cable = (a, b, sag) => {
    let p = a;
    for (let k = 1; k <= 4; k++) {
      const t = k / 4, q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t];
      beam(p, q, .12, [.04, .04, .045]); p = q;
    }
  };

  // Lattice pylon with two crossarms. It returns its six conductor points.

  const pylon = (x, z, h) => {
    prop('lattice', x, h / 2, z, 9, h, 9, [.2, .19, .18]);
    const tips = [];
    for (const [y, half] of [[h * .72, 9], [h * .9, 6.5]]) {
      prop('box', x, y, z, half * 2, .9, .9, [.14, .13, .12]);
      for (const s of [-1, 1]) tips.push([x + s * half, y - 1.6, z]);
    }
    glow(x, h + .4, z, .7, .7, .7, RED);
    return tips;
  };

  // Hyperboloid cooling tower on a ring of crossed legs, with hazard lights at the rim and the throat.

  const tower = (x, z, rb, h, mat, r) => {
    const lift = 9, hs = h - lift, n = 30;
    const m = new THREE.Mesh(A.shellGeo, mat);
    m.position.set(x, lift, z); m.scale.set(rb, hs, rb);
    H.decor.add(m);
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2, b = (k + 1) / n * Math.PI * 2, c = Math.cos, s = Math.sin, ro = rb * 1.02;
      beam([x + c(a) * ro, 0, z + s(a) * ro], [x + c(b) * rb, lift + .4, z + s(b) * rb], .7, CONC);
      beam([x + c(b) * ro, 0, z + s(b) * ro], [x + c(a) * rb, lift + .4, z + s(a) * rb], .7, CONC);
    }
    prop('cyl', x, .3, z, rb * 2.1, .6, rb * 2.1, DARK);
    glow(x, .7, z, rb * 1.7, .1, rb * 1.7, [.05, .06, .08]);
    const rt = shellR(1) * rb, rth = RT * rb;
    put(GLOWS.ring, x, h - .3, z, rt * 2 + .6, 30, rt * 2 + .6, 0, 0, dim(AMBER, .35));
    for (let k = 0; k < 10; k++) {
      const a = k / 10 * Math.PI * 2;
      glow(x + Math.cos(a) * (rt + .4), h + .3, z + Math.sin(a) * (rt + .4), .6, .6, .6, AMBER);
      glow(x + Math.cos(a + .3) * (rth + .3), lift + hs * T0, z + Math.sin(a + .3) * (rth + .3), .4, .4, .4, dim(AMBER, .7));
    }
    textSign(`CT-${A.towers.length + 1}`, x, lift + hs * .3, z - shellR(.3) * rb - .3, 12, 3.2, Math.PI, dim(AMBER, .45));
    beacon(x, h + 1, z, r);
    pool(x, z, rb * 1.6, dim(AMBER, .05));
    A.towers.push([x, h, z, rt]);
  };

  // Puff k rises from its tower over LIFE seconds, swells, drifts downwind and fades into the dark.

  const steamAt = t => {
    const [wx, wz] = A.wind;
    for (let k = 0; k < A.seeds.length; k++) {
      const [ti, off, j] = A.seeds[k], [x, h, z, rt] = A.towers[ti];
      const p = ((t / LIFE + off) % 1 + 1) % 1, s = rt * (1.3 + 3.4 * p) * (1 + .2 * j), drift = 90 * p ** 1.4;
      _o.position.set(x + wx * drift + (j - .5) * rt * .8, h + 2 + p * 130, z + wz * drift + (off - .5) * rt * .7);
      _o.scale.set(s, s * .8, s); _o.updateMatrix();
      A.steam.setMatrixAt(k, _o.matrix);
      const f = (1 - p) ** 1.2 * Math.min(1, p * 12), w = Math.max(0, 1 - p * 4);
      A.steam.setColorAt(k, A.c.setRGB(.38 * f + .16 * w, .37 * f + .07 * w, .4 * f + .2 * w));
    }
    A.steam.instanceMatrix.needsUpdate = A.steam.instanceColor.needsUpdate = true;
  };

  return {
    // A free site in the forest off Rabotgorod's east edge. The turn sends the power lines west into the city.

    at: [778.9, 1001.1], free: [140, 140, Math.PI / 2], label: 'Rabotgorod Hyper-Fusion Plant', labelY: 200,
    build(x, z, w, d, st, r) {
      _o = new THREE.Object3D(); A.c = new THREE.Color(); A.towers = [];
      const cst = { ...st, base: CONC, win: [1.3, .75, .3], lit: .12 };
      const f = H.frame()?.front ?? { x: 0, z: -1 }, fy = Math.atan2(f.x, f.z);
      prop('box', 0, .1, 0, w, .2, d, [.035, .033, .031]);

      // Cooling towers: the tall middle one stands back, the two side ones step forward.

      const pts = [];
      for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector2(shellR(t) / shellR(0), t)); }
      A.shellGeo = new THREE.LatheGeometry(pts, 48);
      const tex = concreteTex(), shellMat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color(.16, .15, .15),
        color: new THREE.Color(.9, .88, .85), roughness: .95, metalness: 0, side: THREE.DoubleSide });
      tower(-46, 30, 22, 122, shellMat, r);
      tower(0, 43, 25, 170, shellMat, r);
      tower(46, 30, 22, 142, shellMat, r);

      // The containment drum: buttressed concrete with a violet plasma window band.

      const [cx, cz, R] = [-28, -28, 22];
      bld(cx, cz, R * 2, R * 2, 22, cst, r, { shape: 'oct', skin: SKINS.sparse, roof: false, lit: .06 });
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2, bx = cx + Math.cos(a) * (R + 1.2), bz = cz + Math.sin(a) * (R + 1.2);
        prop('box', bx, 11, bz, 2.4, 22, 4, dim(CONC, .85), Math.PI / 2 - a);
        prop('box', cx + Math.cos(a) * (R + 3), 2.5, cz + Math.sin(a) * (R + 3), 2.4, 5, 3, dim(CONC, .8), Math.PI / 2 - a);
      }
      put(GLOWS.ring, cx, 17, cz, R * 2 + 1.6, 60, R * 2 + 1.6, 0, 0, dim(VIOLET, .8));
      put(GLOWS.ring, cx, 22.2, cz, R * 2 + .6, 20, R * 2 + .6, 0, 0, dim(AMBER, .4));
      prop('cyl', cx, 23, cz, R * 1.7, 2, R * 1.7, DARK);

      // The glass sphere over the drum, ribbed in steel, with the twisted-coil torus burning inside.

      const sy = 39, sr = 17;
      const glass = new THREE.Mesh(new THREE.SphereGeometry(sr, 36, 18), new THREE.MeshBasicMaterial({
        color: new THREE.Color(.05, .03, .11), transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      glass.position.set(cx, sy, cz);
      H.decor.add(glass);
      for (let k = 0; k < 8; k++) put(GLOWS.ring, cx, sy, cz, sr * 2 + .3, sr * 2 + .3, sr * 2 + .3, k / 8 * Math.PI, Math.PI / 2, [.035, .03, .05]);
      for (const y of [-11, -4, 4, 11]) { const rr = Math.sqrt(sr * sr - y * y) * 2 + .3; put(GLOWS.ring, cx, sy + y, cz, rr, 25, rr, 0, 0, [.035, .03, .05]); }
      A.core = own(new THREE.Mesh(new THREE.TorusGeometry(9, 2.1, 12, 48).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(...PLASMA) })));
      A.core.position.set(cx, sy - 2, cz);
      for (let k = 0; k < 20; k++) {
        const a = k / 20 * Math.PI * 2;
        put(GLOWS.ring, cx + Math.cos(a) * 9, sy - 2, cz + Math.sin(a) * 9, 7.4, 40, 7.4, -a, Math.PI / 2 + .45 * Math.sin(5 * a), [.03, .028, .04]);
      }
      put(GLOWS.sphere, cx, sy - 2, cz, 6, 4, 6, 0, 0, dim(VIOLET, .5));
      beam([cx, sy + sr, cz], [cx, sy + sr + 14, cz], .5, STEEL);
      beacon(cx, sy + sr + 14.5, cz, r);
      pool(cx, cz, 50, dim(VIOLET, .12));

      // Neutral-beam injectors on the diagonals, each with an ice-blue feed strip.

      for (const a of [.25, .75, 1.25, 1.75].map(q => q * Math.PI)) {
        const ux = Math.cos(a), uz = Math.sin(a), ry = Math.atan2(ux, uz);
        prop('box', cx + ux * (R + 8), 4.5, cz + uz * (R + 8), 7, 9, 12, STEEL, ry);
        prop('cyl', cx + ux * (R + 15), 4.5, cz + uz * (R + 15), 5, 3, 5, DARK, ry, Math.PI / 2);
        glow(cx + ux * (R + 8), 9.2, cz + uz * (R + 8), .5, .3, 11, dim(ICE, .8), ry);
      }
      textSign('DANGER · PLASMA CONTAINMENT', cx + f.x * (R + 4.5), 12, cz + f.z * (R + 4.5), 16, 1.8, fy, dim(AMBER, .7));

      // Turbine hall: a long ribbed box with roof vents and a gantry crane outside.

      const [hx, hz, hw, hd, hh] = [30, -15, 30, 40, 22];
      bld(hx, hz, hw, hd, hh, cst, r, { skin: SKINS.fins, roof: false, lit: .1, kibble: false });
      for (let k = -2; k <= 2; k++) {
        prop('box', hx, hh + 1.5, hz + k * 8, hw * .5, 3, 3, DARK);
        glow(hx, hh + .2, hz + k * 8, hw * .55, .2, .4, dim(AMBER, .25));
        puff(hx + 4, hh + 5, hz + k * 8, 3 + r() * 2, [.13, .13, .14]);
      }
      for (const s of [-1, 1]) for (let k = 0; k < 6; k++) prop('box', hx + s * (hw / 2 + .8), hh / 2, hz - hd / 2 + 3 + k * 6.8, 1.6, hh, 1.4, dim(CONC, .8));
      for (const s of [-1, 1]) prop('lattice', hx + hw / 2 + 6, 13, hz + s * 14, 2.4, 26, 2.4);
      prop('box', hx + hw / 2 + 6, 26.5, hz, 2, 2, 32, [.3, .2, .05]);
      glow(hx + hw / 2 + 6, 25.3, hz, .5, .5, .5, AMBER);
      textSign('RABOTGOROD HYPER-FUSION 1', hx - hw / 2 - .4, hh - 4, hz, 26, 3, -Math.PI / 2, dim(AMBER, .6));
      textSign('RABOTGOROD HYPER-FUSION 1', hx + hw / 2 + 1.8, hh - 4, hz, 26, 3, Math.PI / 2, dim(AMBER, .6));

      // Pipes: drum to hall, hall to the header, and a drop to each tower.

      for (const pz of [-22, -32]) pipe(cx + R + 2, pz, hx - hw / 2, pz, 10, 2.4);
      pipe(hx, hz + hd / 2, hx, 10, 5, 3);
      pipe(-46, 10, 46, 10, 5, 3);
      for (const [tx, , tz, ] of A.towers) pipe(tx, 10, tx, tz - 18, 5, 2.4);
      for (const px of [-6, 8]) pipe(px, -50, px, 10, 3, 1.4, [.18, .09, .05]);

      // A catwalk truss from the drum to the hall roof, lit with amber dots.

      const ca = [cx + R, 18, cz + 6], cb = [hx - hw / 2, 18, hz - 2];
      beam(ca, cb, 1.2, STEEL);
      beam([ca[0], 19.6, ca[2]], [cb[0], 19.6, cb[2]], .2, STEEL);
      for (let t = 0; t <= 1; t += .25) glow(ca[0] + (cb[0] - ca[0]) * t, 19.7, ca[2] + (cb[2] - ca[2]) * t, .35, .35, .35, AMBER);

      // Exhaust stack: banded concrete with red and amber rings.

      prop('cyl', 58, 92, 2, 7, 184, 7, CONC);
      prop('cyl', 58, 6, 2, 11, 12, 11, DARK);
      for (let y = 60; y < 184; y += 30) put(GLOWS.ring, 58, y, 2, 7.6, 40, 7.6, 0, 0, y > 150 ? RED : dim(AMBER, .6));
      beacon(58, 185, 2, r);

      // Control block: a low bunker with slit windows.

      bld(-57, 8, 18, 12, 9, cst, r, { skin: SKINS.bands, roof: true, lit: .3, kibble: false });
      prop('dish', -61, 11.5, 9, 5, 5, 5, STEEL, 1, -.7);

      // Transformer yard: rows of units with bushings, a fence line and two take-off gantries.

      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
        const tx = 10 + i * 14, tz = -50 - j * 9;
        prop('box', tx, 2.5, tz, 7, 5, 5, [.07, .08, .07]);
        for (let k = -1; k <= 1; k++) { prop('cyl', tx + k * 2.2, 6.4, tz, .7, 2.8, .7, [.22, .2, .18]); glow(tx + k * 2.2, 8, tz, .4, .4, .4, dim(ICE, .4)); }
        for (const s of [-1, 1]) prop('box', tx + s * 4.1, 2.5, tz, 1, 4.6, 5.6, DARK);
      }
      for (let k = 0; k < 18; k++) prop('box', 2 + k * 3.6, 1.4, -66, .2, 2.8, .2, DARK);
      flickerGlow(2, 3, -66, .5, .5, .5, AMBER, r);
      const lines = [];
      for (const gx of [18, 48]) {
        for (const s of [-1, 1]) prop('lattice', gx + s * 8, 9, -64, 2, 18, 2);
        prop('box', gx, 18, -64, 18, 1, 1, STEEL);
        lines.push([[gx - 7, 17, -64], [gx, 17, -64], [gx + 7, 17, -64]]);
      }
      pool(34, -56, 30, dim(ICE, .05));

      // Two lines leave the site on pylons, three conductors each.

      lines.forEach((g, n) => {
        let last = g.map(p => [...p]);
        for (let k = 1; k <= 3; k++) {
          const px = (n ? 48 : 18) + (n ? 1 : -1) * k * 22, pz = -64 - k * 70, tips = pylon(px, pz, 50);
          const next = [tips[0], tips[2], tips[1]];
          for (let c = 0; c < 3; c++) cable(last[c], next[c], 4);
          last = next;
        }
      });

      // Steam: one soft instanced mesh for all three towers.

      A.seeds = Array.from({ length: PUFFS * 3 }, (_, k) => [k % 3, r(), r()]);
      A.steam = own(new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.5, 2),
        soften(new THREE.MeshBasicMaterial({ transparent: true, opacity: .3, depthWrite: false })), A.seeds.length));
      steamAt(0);

      return { focus: [0, 0], face: [f.x, f.z], span: 260 };
    },

    update(t) {
      if (!A.steam) return;
      steamAt(t);
      const p = .85 + .15 * Math.sin(t * 2.3) + .05 * Math.sin(t * 13);
      A.core.material.color.setRGB(PLASMA[0] * p, PLASMA[1] * p, PLASMA[2] * p);
    },
  };
}

// The showcase builds the plant once, in the middle slot.

export const kits = H => ({ fusion(x, z, s, st, b, r) { if (!x && !z) plant(H).build(0, 0, 136, 136, st, r); } });

export const landmarks = H => ({ fus_plant: plant(H) });
