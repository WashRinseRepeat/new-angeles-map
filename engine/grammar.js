// Lot prisms, the tower grammar, archetypes, core kits and named-location helpers.

import * as THREE from 'three';
import { S, H } from './state.js';
import { AXIS_HI, AXIS_LO, BLOCK, STYLES, lerp } from './core.js';
import { SETTING } from './setting.js';
import { U, scene } from './render.js';
import { B_FS, B_VS, FACES, GLOWS, SKINS, beacon, bld, glow, glows, grey, helipad, holo, neon, prop, put, roof, sign } from './instances.js';

// ---------- lot prisms: buildings that follow a lot's real outline, merged into one mesh ----------

export const MERGED_MAT = new THREE.ShaderMaterial({ uniforms: U, defines: { MERGED: 1 }, vertexShader: B_VS, fragmentShader: B_FS, userData: { casts: true } });
export let merged = null, M = null;
export const resetMerged = () => { M = { pos: [], nrm: [], base: [], win: [], p: [], skin: [], u: [], len: [] }; };
resetMerged();
export function insidePoly(x, z, poly) {
  let o = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j], [bx, bz] = poly[i];
    if ((az > z) !== (bz > z) && x < ax + (z - az) * (bx - ax) / (bz - az)) o = !o;
  }
  return o;
}
export const scalePoly = (poly, k) => {
  const c = poly.reduce((a, q) => [a[0] + q[0] / poly.length, a[1] + q[1] / poly.length], [0, 0]);
  return poly.map(([x, z]) => [c[0] + (x - c[0]) * k, c[1] + (z - c[1]) * k]);
};

// Extrudes a world-space polygon. Walls carry their own u coordinate so the window shader works at any angle.

export function prism(poly, y0, h, st, r, { lit = st.lit, glow = 0, skin = SKINS.grid } = {}) {
  const v = .7 + .6 * r(), base = st.base.map(c => c * v), P = [r() * 100, lit, st.grime, glow];
  const push = (x, y, z, n, u, len) => {
    M.pos.push(x, y, z); M.nrm.push(...n); M.base.push(...base); M.win.push(...st.win);
    M.p.push(...P); M.skin.push(skin); M.u.push(u); M.len.push(len);
  };
  const y1 = y0 + h;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length], L = Math.hypot(bx - ax, bz - az);
    if (L < .01) continue;
    let n = [(bz - az) / L, 0, -(bx - ax) / L];
    const flip = insidePoly((ax + bx) / 2 + n[0] * .2, (az + bz) / 2 + n[2] * .2, poly);
    if (flip) n = n.map(c => -c);
    if (flip) {
      push(ax, y0, az, n, 0, L); push(bx, y0, bz, n, L, L); push(bx, y1, bz, n, L, L);
      push(ax, y0, az, n, 0, L); push(bx, y1, bz, n, L, L); push(ax, y1, az, n, 0, L);
    } else {
      push(ax, y0, az, n, 0, L); push(bx, y1, bz, n, L, L); push(bx, y0, bz, n, L, L);
      push(ax, y0, az, n, 0, L); push(ax, y1, az, n, 0, L); push(bx, y1, bz, n, L, L);
    }
  }
  const tris = THREE.ShapeUtils.triangulateShape(poly.map(([x, z]) => new THREE.Vector2(x, z)), []);
  for (let [a, b, c] of tris) {
    const [p, q, o] = [poly[a], poly[b], poly[c]];
    if ((q[1] - p[1]) * (o[0] - p[0]) - (q[0] - p[0]) * (o[1] - p[1]) < 0) [b, c] = [c, b];
    for (const k of [a, b, c]) push(poly[k][0], y1, poly[k][1], [0, 1, 0], 0, 1);
  }
}
export function flushMerged() {
  if (merged) { scene.remove(merged); merged.geometry.dispose(); }
  const g = new THREE.BufferGeometry(), A = (a, n) => new THREE.Float32BufferAttribute(a, n);
  g.setAttribute('position', A(M.pos, 3)); g.setAttribute('normal', A(M.nrm, 3));
  g.setAttribute('aBase', A(M.base, 3)); g.setAttribute('aWin', A(M.win, 3)); g.setAttribute('aP', A(M.p, 4));
  g.setAttribute('aSkin', A(M.skin, 1)); g.setAttribute('aU', A(M.u, 1)); g.setAttribute('aLen', A(M.len, 1));
  merged = new THREE.Mesh(g, MERGED_MAT);
  merged.frustumCulled = false;
  scene.add(merged);
  resetMerged();
}

// Lot-shaped tower: one to three tiers of the lot outline, each scaled toward the centre.

export function lotTower(x, z, W, D, H, st, r, skin, gl, crown, accent) {
  const poly = S.FRAME?.poly;
  if (!poly) return false;
  const tiers = 1 + Math.floor(r() * 3), sum = tiers * (tiers + 1) / 2;
  let y = 0, k = .94;
  for (let t = 0; t < tiers; t++) {
    const h = H * (tiers - t) / sum;
    prism(scalePoly(poly, k), y, h, st, r, { skin, glow: gl });
    y += h; k *= .8;
  }
  crownOf(crown, { x, z, w: W * k / .8, d: D * k / .8, rot: 0 }, H, st, r, accent);
  return true;
}

// ---------- tower grammar: plan, skirt, profile, flank, skin, crown ----------



// Weights per option as [low end, high end] of the style axis. A lot's style weight blends the two.

export const SLOTS = {
  plan: { lot: [2.5, 2], rect: [3, 3], L: [1.5, 1.2], U: [.6, .6], cross: [.8, .5], oct: [.3, 1.2], round: [.3, 1.2], slab: [1.4, .8] },
  skirt: { none: [3, 1.5], podium: [1.5, 2.5], stilts: [.5, .8], arcade: [.6, 1.2] },
  profile: { straight: [2, 1.2], setback: [1.5, 2.5], taper: [.3, 1.2], twist: [.1, .8], twisttaper: [0, .5], offset: [1.4, .8], terraced: [.4, .8] },
  flank: { none: [3, 2], balconies: [1.5, 1], fins: [.3, 1.2], sidetower: [.8, 1] },
  skin: { grid: [3, 1.5], bands: [1, 2], fins: [.5, 1.2], curtain: [.2, 2], sparse: [2, .3] },
  crown: { flat: [3, 1], spire: [.5, 1.5], sphere: [.1, .8], dishes: [1.2, .8], pagoda: [.4, .3], helipad: [.3, 1.2], antennas: [1.5, 1], ring: [.1, .9], pyramid: [.4, .8], logo: [.1, 1] },
};

// A pack's styles.slots replaces whole slots, such as skin, to give its towers other options.

Object.assign(SLOTS, SETTING.styles.slots);
export function pick(slot, w, r) {
  const opts = Object.entries(SLOTS[slot]);
  let x = r() * opts.reduce((s, [, [a, b]]) => s + lerp(a, b, w), 0);
  for (const [k, [a, b]] of opts) if ((x -= lerp(a, b, w)) <= 0) return k;
  return opts[0][0];
}

// Footprint as boxes or prisms in the lot frame. a is the arm width share for L, U and cross.

export function planParts(plan, W, D) {
  const a = .42;
  switch (plan) {
    case 'L': return [{ x: 0, z: -D * (1 - a) / 2, w: W, d: D * a }, { x: -W * (1 - a) / 2, z: D * a / 2, w: W * a, d: D * (1 - a) }];
    case 'U': return [{ x: 0, z: -D * (1 - a) / 2, w: W, d: D * a },
      { x: -W * (1 - a) / 2, z: D * a / 2, w: W * a, d: D * (1 - a) }, { x: W * (1 - a) / 2, z: D * a / 2, w: W * a, d: D * (1 - a) }];
    case 'cross': return [{ x: 0, z: 0, w: W, d: D * a }, { x: 0, z: 0, w: W * a, d: D }];
    case 'oct': return [{ x: 0, z: 0, w: W, d: D, shape: 'oct' }];
    case 'round': { const m = Math.min(W, D); return [{ x: 0, z: 0, w: m, d: m, shape: 'cyl' }]; }
    case 'slab': return W > D ? [{ x: 0, z: 0, w: W, d: D * .45 }] : [{ x: 0, z: 0, w: W * .45, d: D }];
    default: return [{ x: 0, z: 0, w: W, d: D }];
  }
}

// Vertical stack: each segment has a height, a scale k, a rotation and an offset.

export function profileSegments(profile, H, W, D, r) {
  const even = (n, f) => Array.from({ length: n }, (_, i) => ({ h: H / n, k: 1, rot: 0, dx: 0, dz: 0, ...f(i, n) }));
  switch (profile) {
    case 'setback': {
      const n = 2 + Math.floor(r() * 3), sum = n * (n + 1) / 2;
      return Array.from({ length: n }, (_, i) => ({ h: H * (n - i) / sum, k: .78 ** i, rot: 0, dx: 0, dz: 0 }));
    }
    case 'taper': return even(8, (i, n) => ({ k: 1 - .5 * i / (n - 1) }));
    case 'twist': {
      const step = (.06 + .06 * r()) * (r() < .5 ? -1 : 1);
      return even(Math.max(6, Math.min(20, Math.round(H / 9))), i => ({ k: .82, rot: i * step }));
    }
    case 'twisttaper': {
      const n = Math.max(10, Math.min(28, Math.round(H / 6)));
      return even(n, i => ({ k: .9 * (1 - .4 * i / n), rot: i * .035 }));
    }
    case 'offset': return even(3 + Math.floor(r() * 3), () => ({ k: .82, dx: (r() - .5) * W * .22, dz: (r() - .5) * D * .22 }));
    case 'terraced': return even(4 + Math.floor(r() * 3), i => ({ k: 1 - .15 * i }));
    default: return [{ h: H, k: 1, rot: 0, dx: 0, dz: 0 }];
  }
}

export const grammarTower = (x, z, W, D, H, st, r, mega = false) => grammarTowerBody(x, z, W, D, H, st, r, {}, mega);
export function grammarTowerBody(x, z, W, D, H, st, r, force = {}, mega = false) {
  const w = st.w;
  const plan = force.plan ?? pick('plan', w, r), skirt = force.skirt ?? pick('skirt', w, r), profile = force.profile ?? pick('profile', w, r);
  const flank = force.flank ?? pick('flank', w, r), skin = force.skin ?? SKINS[pick('skin', w, r)], crown = force.crown ?? pick('crown', w, r);
  const gl = (mega ? 1 : .55) * w * (.4 + .6 * r());
  const pal = r() < w ? AXIS_HI.signs : AXIS_LO.signs, accent = pal[Math.floor(r() * pal.length)];
  if (plan === 'lot' && lotTower(x, z, W, D, H, st, r, skin, gl, crown, accent)) return;
  let y = 0;

  if (skirt === 'podium' || skirt === 'arcade') {
    const ph = 7 + r() * 8;
    bld(x, z, W, D, ph, st, r, { roof: false, skin: skirt === 'arcade' ? SKINS.bands : SKINS.grid, lit: skirt === 'arcade' ? .85 : st.lit });
    neon(x, z, W, D, ph, st, r);
    if (skirt === 'arcade') for (const [nx, nz] of FACES)
      glow(x + nx * (W / 2 + .2), ph - .4, z + nz * (D / 2 + .2), nx ? .25 : W, .35, nx ? D : .25, accent.map(c => c * .6));
    y = ph; W *= .8; D *= .8;
  } else if (skirt === 'stilts') {
    const sh = 8 + r() * 6;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) prop('cyl', x + dx * W * .35, sh / 2, z + dz * D * .35, 1.8, sh, 1.8, grey(r, .1));
    glow(x, sh - .3, z, W * .7, .2, D * .7, st.win.map(c => c * .6));
    y = sh;
  }

  const parts = planParts(plan, W, D);
  const segs = profileSegments(profile, Math.max(H - y, 12), W, D, r);
  let top = { x, z, w: W, d: D, rot: 0 };
  for (const [si, sg] of segs.entries()) {
    const c = Math.cos(sg.rot), s = Math.sin(sg.rot), cx = x + sg.dx, cz = z + sg.dz;
    for (const p of parts) {
      const px = p.x * sg.k, pz = p.z * sg.k;
      bld(cx + px * c + pz * s, cz - px * s + pz * c, p.w * sg.k, p.d * sg.k, sg.h, st, r,
        { y0: y, shape: p.shape ?? 'box', roof: false, skin, glow: gl, ry: sg.rot });
    }
    if (profile === 'terraced' && si < segs.length - 1) {
      prop('box', cx, y + sg.h + .2, cz, W * sg.k * .98, .4, D * sg.k * .98, [.03, .08, .04]);
      for (let k = 0; k < 4; k++) prop('cone', cx + (r() - .5) * W * sg.k * .9, y + sg.h + 2, cz + (r() - .5) * D * sg.k * .9, 2.5, 3.5, 2.5, [.02, .07, .03]);
    }
    if (flank === 'balconies') for (let by = y + 10.8; by < y + sg.h; by += 10.8) {
      const round = parts[0].shape === 'cyl' || parts[0].shape === 'oct';
      prop(round ? 'cyl' : 'box', cx, by, cz, W * sg.k * 1.08, .5, D * sg.k * 1.08, grey(r, .09), sg.rot);
    }
    y += sg.h;
    top = { x: cx, z: cz, w: W * sg.k, d: D * sg.k, rot: sg.rot };
  }

  if (flank === 'fins') for (const [nx, nz] of FACES) for (let k = -1; k <= 1; k++) {
    const span = nx ? D : W, out = (nx ? W : D) / 2 + .5, along = k * span * .3;
    prop('box', x + nx * out - nz * along, (H * .85 + segs.length) / 2, z + nz * out + nx * along, nx ? 1 : .5, H * .85, nx ? .5 : 1, grey(r, .07));
  }
  if (flank === 'sidetower') {
    const sw = W * .3, sd = D * .3, sh = H * (.5 + .4 * r());
    bld(x + W * .38, z + D * .38, sw, sd, sh, st, r, { skin, glow: gl, roof: true });
  }
  if (r() < st.neon * .7) holo(x, z, W * .85, D * .85, H * (.3 + .3 * r()), r);
  crownOf(crown, top, H, st, r, accent);
}

export function crownOf(crown, t, H, st, r, accent) {
  const m = Math.min(t.w, t.d);
  switch (crown) {
    case 'spire': {
      const sh = 15 + r() * 35;
      prop('cone', t.x, H + sh / 2, t.z, 2.2, sh, 2.2, grey(r, .25));
      beacon(t.x, H + sh + .5, t.z, r);
      break;
    }
    // Armillary globe: three crossed neon rings round a small bright core, on a stem with a mast and beacon.

    case 'sphere': {
      const rad = m * .4, cy = H + rad * 1.25;
      prop('cyl', t.x, H + rad * .15, t.z, rad * .9, rad * .3, rad * .9, grey(r, .1));
      prop('cyl', t.x, H + rad * .6, t.z, rad * .12, rad * .9, rad * .12, grey(r, .2));
      put(GLOWS.sphere, t.x, cy, t.z, rad * .5, rad * .5, rad * .5, 0, 0, accent.map(c => c * 1.4));
      for (const rx of [0, 1, -1]) put(GLOWS.ring, t.x, cy, t.z, rad * 2, rad * 2, rad * 2, 0, rx, accent.map(c => c * (rx ? .8 : 1.1)));
      prop('cone', t.x, cy + rad + 7, t.z, 1, 14, 1, grey(r, .25));
      beacon(t.x, cy + rad + 14.5, t.z, r);
      break;
    }
    case 'dishes':
      for (let k = 3 + Math.floor(r() * 4); k > 0; k--) {
        const a = r() * 6.3, s = 2.5 + r() * 3, px = t.x + Math.cos(a) * t.w * .3, pz = t.z + Math.sin(a) * t.d * .3;
        prop('cyl', px, H + s * .25, pz, .5, s * .5, .5, grey(r));
        prop('dish', px, H + s * .5, pz, s, s, s, grey(r, .3), a, -.7 - r() * .4);
      }
      break;
    case 'pagoda':
      for (let k = 0; k < 3; k++) {
        const s = 1.3 - k * .28, py = H + k * 4.5;
        bld(t.x, t.z, t.w * s, t.d * s, 3, st, r, { y0: py, shape: 'pyr', lit: 0, roof: false, ry: t.rot });
        for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) glow(t.x + dx * t.w * s * .47, py + .3, t.z + dz * t.d * s * .47, .6, .9, .6, [1.6, .15, .08]);
      }
      break;
    case 'helipad':
      if (m > 12) { helipad(t.x, t.z, m * .85, H, r); break; }
    // falls through to antennas on narrow tops
    case 'antennas':
      for (let k = 3 + Math.floor(r() * 5); k > 0; k--) {
        const h = 6 + r() * 26, px = t.x + (r() - .5) * t.w * .7, pz = t.z + (r() - .5) * t.d * .7;
        prop('cyl', px, H + h / 2, pz, .35, h, .35, grey(r, .2));
        if (h > 20) beacon(px, H + h + .4, pz, r);
      }
      break;
    case 'ring':
      for (let k = 0; k < 1 + Math.floor(r() * 2); k++)
        put(GLOWS.ring, t.x, H - 4 - k * 9, t.z, Math.max(t.w, t.d) * 1.45, 1, Math.max(t.w, t.d) * 1.45, 0, 0, accent.map(c => c * .9));
      prop('cone', t.x, H + 9, t.z, 1.6, 18, 1.6, grey(r, .25));
      break;
    case 'pyramid':
      bld(t.x, t.z, t.w, t.d, m * .8, st, r, { y0: H, shape: 'pyr', lit: st.lit * .4, ry: t.rot });
      break;
    case 'logo':
      for (let f = 0; f < 4; f++) sign(t.x, t.z, t.w, t.d, H, st, r, accent, { face: f, blade: false, sw: (f < 2 ? t.d : t.w) * .8, sh: 4, y: H - 3, along: 0 });
      break;
    default:
      roof(t.x, t.z, t.w, t.d, H, st, r);
  }
}

// ---------- archetypes: whole-building recipes that bypass the slot picks ----------

export const ARCHETYPES = {

  // Tyrell-style micro-ziggurat: 20+ stacked slabs, each 4% smaller, amber grid, flame stacks.

  ziggurat(x, z, W, D, H, st, r) {
    const n = 22, h = H / n;
    for (let i = 0; i < n; i++) bld(x, z, W * .96 ** i, D * .96 ** i, h, st, r, { y0: i * h, roof: false, skin: SKINS.grid, lit: .45, glow: .3 });
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const fx = x + dx * (W / 2 + 3), fz = z + dz * (D / 2 + 3);
      prop('cyl', fx, 6, fz, 1.6, 12, 1.6, grey(r, .1));
      S.flicker.push([glows, glow(fx, 13, fz, 1.4, 2.4, 1.4, [2.4, .9, .15]), [2.4, .9, .15], r() * 10, false]);
    }
    crownOf('flat', { x, z, w: W * .96 ** n, d: D * .96 ** n, rot: 0 }, H, st, r, [2, 1, .2]);
  },

  // Arasaka-style split: two halves with a slot, a bridge block on top, a logo in the slot.

  split(x, z, W, D, H, st, r) {
    const gap = W * .14, hw = (W - gap) / 2, accent = AXIS_HI.signs[Math.floor(r() * AXIS_HI.signs.length)];
    for (const sx of [-1, 1]) bld(x + sx * (gap + hw) / 2, z, hw, D, H * (.92 + .08 * r()), st, r, { roof: false, skin: SKINS.fins, glow: .9 });
    bld(x, z, W, D * .7, H * .08, st, r, { y0: H, roof: false, skin: SKINS.bands, glow: 1 });
    sign(x, z, gap * .7, D, H * .7, st, r, accent, { face: 2, blade: false, sw: gap * .7, sh: H * .25, y: H * .62, along: 0 });
    crownOf('antennas', { x, z, w: W, d: D * .7, rot: 0 }, H * 1.08, st, r, accent);
  },

  // SimCity Launch Arco: round tapered shaft on fin buttresses, cone nose, needle.

  launch(x, z, W, D, H, st, r) {
    const m = Math.min(W, D);
    for (let i = 0; i < 8; i++) bld(x, z, m * (1 - .06 * i), m * (1 - .06 * i), H * .1, st, r, { y0: i * H * .1, shape: 'cyl', roof: false, skin: SKINS.bands, glow: .6 });
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + .4, fx = x + Math.cos(a) * m * .55, fz = z + Math.sin(a) * m * .55;
      prop('box', fx, H * .14, fz, 1.6, H * .28, m * .35, grey(r, .1), -a);
    }
    prop('cone', x, H * .8 + H * .1, z, m * .52, H * .2, m * .52, grey(r, .14));
    prop('cone', x, H + 18, z, 1, 36, 1, grey(r, .3));
    beacon(x, H + 36.5, z, r);
  },

  // Kowloon cluster: 6 to 12 boxes merged into one ragged mass, tanks and an antenna forest.

  kowloon(x, z, W, D, H, st, r) {
    for (let k = 6 + Math.floor(r() * 7); k > 0; k--) {
      const w = W * (.3 + .3 * r()), d = D * (.3 + .3 * r());
      const bx = x + (r() - .5) * (W - w), bz = z + (r() - .5) * (D - d), h = H * (.55 + .45 * r());
      bld(bx, bz, w, d, h, st, r, { skin: SKINS.sparse, lit: st.lit * 1.2 });
    }
    crownOf('antennas', { x, z, w: W, d: D, rot: 0 }, H * .8, st, r, AXIS_LO.signs[0]);
  },

  // Screen crown: four screens form a box over a dish ring.

  screens(x, z, W, D, H, st, r) {
    grammarTowerBody(x, z, W, D, H, st, r, { plan: 'rect', profile: 'setback', skin: SKINS.curtain, crown: 'dishes' });
    for (let f = 0; f < 4; f++) holo(x, z, W * .7, D * .7, H + 8, r, f, 30);
  },
};
// The pack's shapes dial (kits.tune.shapes) scales every archetype but the grammar tower.

export const ARCH_BASE = { grammar: [10, 10], ziggurat: [0, .5], split: [0, .6], launch: [.5, .2], kowloon: [2.5, 0], screens: [0, .8] };
export const ARCH_WEIGHTS = Object.fromEntries(Object.entries(ARCH_BASE).map(([k, w]) => [k, k === 'grammar' ? w : w.map(v => v * (SETTING.kits.tune.shapes ?? 1))]));
export const TALLY = {};
export function buildTall(x, z, W, D, H, st, r, mega) {
  const opts = Object.entries(ARCH_WEIGHTS).map(([k, [a, b]]) => [k, lerp(a, b, st.w) * (k !== 'grammar' && !mega ? .35 : 1)]);
  let p = r() * opts.reduce((s, [, v]) => s + v, 0);
  const kind = opts.find(([, v]) => (p -= v) <= 0)?.[0] ?? 'grammar';
  TALLY[kind] = (TALLY[kind] ?? 0) + 1;
  if (kind === 'grammar') grammarTower(x, z, W, D, H, st, r, mega);
  else ARCHETYPES[kind](x, z, W, D, H, st, r);

  // A pack style may dress every tall tower in its district with a tallTrim(x, z, W, D, H) after the build.

  STYLES[st.mix?.[0]?.[0]]?.tallTrim?.(x, z, W, D, H);
}

// ---------- kits ----------

export const KITS = {
  stack(x, z, s, st, b, r) {
    const q = s / 2;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      if (r() < .12) continue;
      const w = q - 1.5 - r() * 3, d = q - 1.5 - r() * 3;
      const h = lerp(st.h0, st.h1, r() ** 1.6) * b * (.6 + .5 * r());
      const bx = x + dx * q / 2, bz = z + dz * q / 2;
      bld(bx, bz, w, d, h, st, r);
      neon(bx, bz, w, d, h, st, r);
    }
  },

  // Tall buildings come from the tower grammar, sized to the lot's real rectangle.

  tower(x, z, s, st, b, r) {
    buildTall(x, z, S.FRAME ? S.FRAME.w - 2 : s, S.FRAME ? S.FRAME.d - 2 : s, lerp(st.h1 * .9, st.h1 * 1.8, r()) * b, st, r, false);
  },

  mega(x, z, s, st, b, r) {
    buildTall(x, z, S.FRAME ? S.FRAME.w - 2 : s, S.FRAME ? S.FRAME.d - 2 : s, st.h1 * (1.6 + 1.8 * r() ** 2) * b, st, r, true);
  },


  twin(x, z, s, st, b, r) {
    const w = s * .34, d = s * .5, H = lerp(st.h1 * .8, st.h1 * 1.4, r()) * b;
    for (const dx of [-1, 1]) {
      const h = H * (.85 + .3 * r());
      bld(x + dx * s * .27, z, w, d, h, st, r);
      neon(x + dx * s * .27, z, w, d, h, st, r);
    }
    const by = H * (.4 + .3 * r());
    bld(x, z, s * .2, d * .4, 4, st, r, { y0: by, roof: false });
    glow(x, by - .2, z, s * .2, .2, d * .4, [.2, .9, 1.3]);
  },

  block(x, z, s, st, b, r) {
    for (const dz of [-1, 1]) {
      if (r() < .1) continue;
      const w = s - 3, d = s * .42, h = lerp(st.h0, st.h1 * .7, r()) * b;
      bld(x, z + dz * s * .25, w, d, h, st, r);
      neon(x, z + dz * s * .25, w, d, h, st, r);
    }
  },

  tenement(x, z, s, st, b, r) {
    const h = lerp(st.h0, st.h1 * .8, r()) * b, t = s * .38;
    bld(x - (s - t) / 2 + 1, z, t, s - 2, h, st, r);
    bld(x + t / 2, z - (s - t) / 2 + 1, s - t - 2, t, h * (.7 + .3 * r()), st, r);
    neon(x - (s - t) / 2 + 1, z, t, s - 2, h, st, r);
    for (let k = 0; k < 3; k++) prop('box', x + t / 2, 3 + k * 3.6, z - (s - t) / 2 + 1 + t / 2 + .6, s - t - 4, .15, 1.2, grey(r, .1));
  },


  // Container yard with a gantry crane, for a port.

};

// ---------- named-location blocks ----------

export const decor = new THREE.Group();
scene.add(decor);
S.DECOR = decor;

export function neonTexture(lines, color, { w = 512, h = 128, font = 'bold 64px "Avenir Next Condensed", "Arial Narrow", sans-serif', border = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#08070c'; g.fillRect(0, 0, w, h);
  g.shadowColor = color; g.shadowBlur = 18;
  if (border) { g.strokeStyle = color; g.lineWidth = 5; g.strokeRect(10, 10, w - 20, h - 20); }
  g.fillStyle = color; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((t, k) => g.fillText(t, w / 2, h * (k + .5) / lines.length));
  g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,.55)';
  lines.forEach((t, k) => g.fillText(t, w / 2, h * (k + .5) / lines.length));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
export function panel(tex, x, y, z, w, h, ry = 0, gain = 1.4) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setScalar(gain), side: THREE.DoubleSide }));
  m.position.set(x, y, z); m.rotation.y = ry;
  S.DECOR.add(m);
  return m;
}
export function stringLights(a, b, sag, n, rgb) {
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    glow(lerp(a[0], b[0], t), lerp(a[1], b[1], t) - sag * 4 * t * (1 - t), lerp(a[2], b[2], t), .35, .35, .35, rgb);
  }
}
// Low filler for lots without a building: sheds, a walled yard, parked cars or crates.

export function yard(x, z, w, d, st, r) {
  prop('box', x, .12, z, w, .24, d, [.035, .034, .036]);
  if (w > 6 && d > 6) for (let k = 1 + Math.floor(r() * 3); k > 0; k--) {
    const sw = 3 + r() * Math.min(8, w * .4), sd = 3 + r() * Math.min(8, d * .4);
    bld(x + (r() - .5) * (w - sw), z + (r() - .5) * (d - sd), sw, sd, 3 + r() * 4, st, r, { lit: st.lit * .5, roof: false, skin: SKINS.sparse });
  }
  for (let k = Math.floor(r() * 4); k > 0; k--)
    prop('box', x + (r() - .5) * (w - 3), .7, z + (r() - .5) * (d - 3), 1.8, 1.2, 4, r() < .5 ? grey(r, .12) : [.12, .05, .04], r() * 3);
}

// Market stalls along a lot's front edge: counter, coloured awning, a warm bulb.

export function marketStalls(x, z, w, d, r) {
  const AWN = [[.42, .1, .05], [.1, .25, .32], [.35, .3, .06], [.3, .08, .25]];
  for (let k = 0, n = Math.floor(w / 4.5); k < n; k++) {
    if (r() < .25) continue;
    const sx = x - w / 2 + 2.2 + k * 4.5, sz = z + d / 2 + 1.6;
    prop('box', sx, .55, sz, 3.4, 1.1, 1.6, [.12, .09, .07]);
    prop('box', sx, 2.6, sz + .4, 3.8, .12, 2.6, AWN[Math.floor(r() * AWN.length)], 0, -.25);
    glow(sx, 2.2, sz + .2, .3, .3, .3, [1.8, 1.1, .5]);
  }
}
export function plate(cx, cz, rgb = [.035, .033, .032]) { prop('box', cx, .15, cz, BLOCK, .3, BLOCK, rgb); }

// Named-location blocks live in places/<slug>.js. Each exports meta and build(H, p, cx, cz), which returns the pin height.

