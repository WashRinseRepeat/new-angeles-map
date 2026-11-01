// Parks and green kits. Kit signature: (x, z, s, st, b, r) in the lot frame.

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- tree library: unit-height species, one InstancedMesh each, shared by every lot ----------

// Vertex colour multiplies the instance colour. Leaves stay white so the instance tint shows.
// Trunks carry a red-heavy colour, so a green tint turns them bark brown.

const LEAF = [1, 1, 1], BARK = [1.7, .75, .55];
let LIB = null;

function library(H) {
  if (LIB) return LIB;
  const { THREE } = H;
  const paint = (g, rgb) => {
    g = g.index ? g.toNonIndexed() : g;
    g.deleteAttribute('uv');
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.set(rgb, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  };
  const trunk = (r0, r1, h) => paint(new THREE.CylinderGeometry(r1, r0, h, 5).translate(0, h / 2, 0), BARK);
  const blob = (rad, x, y, z, sy = 1) => paint(new THREE.IcosahedronGeometry(rad, 0).scale(1, sy, 1).translate(x, y, z), LEAF);
  const frond = (len, wid, a, droop, y) => paint(new THREE.BoxGeometry(len, .012, wid).translate(len / 2, 0, 0).rotateZ(droop).rotateY(a).translate(0, y, 0), LEAF);

  const palm = [trunk(.035, .022, .86)];
  for (let k = 0; k < 7; k++) palm.push(frond(.42, .085, k * 2 * Math.PI / 7, -.45 - .15 * (k % 2), .86));

  const broad = [trunk(.06, .035, .5), blob(.32, 0, .64, 0, .8), blob(.24, .2, .52, .1), blob(.22, -.17, .56, -.12)];

  const fern = [trunk(.03, .025, .72)];
  for (let k = 0; k < 10; k++) {
    const a = k * 2 * Math.PI / 10 + .2;
    fern.push(frond(.2, .07, a, .45, .72));
    const ex = .2 * Math.cos(.45), ey = .2 * Math.sin(.45);
    fern.push(paint(new THREE.BoxGeometry(.22, .012, .06).translate(.11, 0, 0).rotateZ(-.55).translate(ex, ey, 0).rotateY(a).translate(0, .72, 0), LEAF));
  }

  const cypress = [trunk(.04, .04, .1), paint(new THREE.ConeGeometry(.2, .92, 6).translate(0, .54, 0), LEAF)];
  const shrub = [blob(.5, 0, .4, 0, .8)];

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, metalness: 0, flatShading: true });
  const make = (parts, n) => {
    const m = new THREE.InstancedMesh(mergeGeometries(parts), mat, n);
    H.decor.add(m);
    return H.instanced(m);
  };
  LIB = { palm: make(palm, 3000), broad: make(broad, 4000), fern: make(fern, 3000), cypress: make(cypress, 1500), shrub: make(shrub, 6000) };
  return LIB;
}

// Tree meshes for debugging and stats.

export const trees = () => LIB;

// Leaf tints per species, Base de Cayambe then Rutherford.

const TINT = {
  palm: [[.04, .075, .025], [.025, .075, .045]],
  broad: [[.03, .065, .025], [.02, .06, .045]],
  fern: [[.02, .07, .035], [.015, .07, .055]],
  cypress: [[.015, .04, .02], [.012, .04, .035]],
  shrub: [[.035, .07, .03], [.02, .07, .05]],
};

export function kits(H) {
  const { GLOWS, bld, glow, lerp, prop, put, stringLights } = H;
  const T = library(H);

  const tree = (kind, x, y, z, h, w, st, r, lean = 0) => {
    const [a, c] = TINT[kind], v = 1.3 + 1.1 * r();
    const m = T[kind];
    put(m, x, y, z, w, h, w, r() * 6.3, lean, a.map((q, i) => lerp(q, c[i], st.w) * v));
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  };
  const anyTree = (x, y, z, h, st, r, mix = [.35, .45]) => {
    const q = r();
    if (q < mix[0]) tree('palm', x, y, z, h * 1.3, h * 1.1, st, r, (r() - .5) * .3);
    else if (q < mix[0] + mix[1]) tree('broad', x, y, z, h, h * (.8 + .4 * r()), st, r);
    else tree('fern', x, y, z, h * .6, h * .7, st, r, (r() - .5) * .2);
  };

  // Lot rectangle in the local frame. Showcase lots are squares.

  const dims = s => { const f = H.frame(); return f ? [f.w - 2, f.d - 2] : [s, s]; };
  const warm = st => [1, lerp(.68, .82, st.w), lerp(.38, .6, st.w)];
  const lamp = (x, z, h, st, y = 0) => {
    prop('cyl', x, y + h / 2, z, .14, h, .14, [.05, .05, .055]);
    glow(x, y + h, z, .4, .3, .4, warm(st).map(c => c * .9));
  };
  const bench = (x, z, ry, y = 0) => prop('box', x, y + .35, z, 1.8, .45, .55, [.08, .05, .03], ry);
  const ground = (x, z, W, D, rgb, h = .3) => prop('box', x, h / 2, z, W, h, D, rgb);
  const GRASS = [.02, .045, .025], STONE = [.07, .066, .062], SOIL = [.03, .028, .018];

  return {
    // Lawn with crossing paths, mixed trees, lamps and benches.

    park(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      ground(x, z, W, D, GRASS);
      prop('box', x, .32, z, W, .06, 2, STONE);
      prop('box', x, .32, z, 2, .06, D, STONE);
      const n = Math.max(4, Math.floor(W * D / 55 * (.6 + .6 * r())));
      for (let k = 0; k < n; k++) {
        const tx = (r() - .5) * (W - 3), tz = (r() - .5) * (D - 3);
        if (Math.abs(tx) < 2 || Math.abs(tz) < 2) continue;
        if (r() < .25) tree('shrub', x + tx, .3, z + tz, 1 + r(), 1.5 + r() * 1.5, st, r);
        else anyTree(x + tx, .3, z + tz, 4 + r() * 5, st, r, [lerp(.45, .25, st.w), .45]);
      }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        lamp(x + dx * W * .42 + dz * 1.5, z + dz * D * .42 + dx * 1.5, 4, st);
        bench(x + dx * W * .25 + dz * 1.6, z + dz * D * .25 + dx * 1.6, dx ? 0 : Math.PI / 2);
      }
    },

    // Formal paved square: fountain, ring of benches, clipped planters, lamp ring.

    plaza(x, z, s, st, b, r) {
      const [W, D] = dims(s), m = Math.min(W, D);
      ground(x, z, W, D, STONE.map(c => c * (.8 + .4 * r())), .25);
      const R = m * (.16 + .06 * r());
      prop('cyl', x, .55, z, R * 2, .6, R * 2, [.09, .085, .08]);
      prop('cyl', x, .82, z, R * 1.8, .06, R * 1.8, [.015, .03, .05]);
      prop('cyl', x, 1.5, z, R * .5, 1.6, R * .5, [.09, .085, .08]);
      glow(x, 3, z, .25, 2.6, .25, [.35, .55, .8]);
      put(GLOWS.sphere, x, 4.3, z, 1.2, .6, 1.2, 0, 0, [.3, .5, .75]);
      put(GLOWS.ring, x, .9, z, R * 1.75, 1, R * 1.75, 0, 0, [.2, .45, .7]);
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4 + Math.PI / 8, rr = R + 2.2;
        bench(x + Math.cos(a) * rr, z + Math.sin(a) * rr, -a + Math.PI / 2);
        lamp(x + Math.cos(a + Math.PI / 8) * (rr + 1.8), z + Math.sin(a + Math.PI / 8) * (rr + 1.8), 3.6, st);
      }
      const kind = r() < lerp(.7, .3, st.w) ? 'palm' : 'cypress';
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const px = x + dx * (W / 2 - 2.5), pz = z + dz * (D / 2 - 2.5);
        prop('box', px, .6, pz, 2.6, .7, 2.6, [.08, .075, .07]);
        tree(kind, px, .9, pz, kind === 'palm' ? 8 + r() * 4 : 6 + r() * 3, kind === 'palm' ? 7 : 3.5, st, r);
      }
      if (W > 24) for (const dx of [-1, 1]) for (let k = -1; k <= 1; k++) tree('shrub', x + dx * (W / 2 - 1.5), .25, z + k * D * .22, 1.2, 2, st, r);
    },

    // Small infill green: party wall, one or two trees, planters, vending glow, string lights.

    pocket(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      ground(x, z, W, D, SOIL.map(c => c * 1.4), .25);
      const wh = 6 + r() * 6, wz = z - D / 2 + .5;
      prop('box', x, wh / 2, wz, W, wh, 1, H.grey(r, .1));
      const pal = r() < st.w ? H.RUT.signs : H.BDC.signs;
      H.sign(x, wz, W, 1, wh, st, r, pal[Math.floor(r() * pal.length)].map(c => c * .6), { face: 2, blade: false, sw: Math.min(6, W * .4), sh: 1.4, y: wh * .6 });
      const n = 1 + Math.floor(W * D / 260);
      for (let k = 0; k < n; k++) anyTree(x + (r() - .5) * (W - 5), .25, z + (r() - .3) * (D - 6) * .6, 5 + r() * 4, st, r, [.4, .5]);
      for (let k = 0; k < 3; k++) {
        const px = x + (k - 1) * W * .3, pz = z + D / 2 - 1.5;
        prop('box', px, .55, pz, 2.4, .6, 1.1, [.07, .05, .04]);
        tree('shrub', px, .8, pz, .9, 1.8, st, r);
      }
      bench(x - W * .25, wz + 1.6, 0);
      bench(x + W * .2, z + (r() - .5) * 3, Math.PI / 2);
      const vx = x + W / 2 - 1.2;
      prop('box', vx, 1, wz + 1.2, 1, 2, .9, [.05, .05, .06]);
      glow(vx, 1.2, wz + 1.66, .7, 1.3, .03, st.w > .5 ? [.3, .8, .9] : [.9, .5, .2]);
      stringLights([x - W / 2 + .5, wh - 1, wz + .6], [x + W / 2 - .5, 3.5, z + D / 2 - .5], .8, 10, warm(st).map(c => c * .8));
    },

    // Stepped terraces fall toward a pool and garden in the middle.

    sunken(x, z, s, st, b, r) {
      const [W, D] = dims(s), step = Math.min(W, D) * .1;
      ground(x, z, W, D, STONE.map(c => c * .7), .2);
      for (let k = 0; k < 3; k++) {
        const w = W - k * step * 2, d = D - k * step * 2, h = 2.6 - k * .8;
        for (const sd of [-1, 1]) {
          prop('box', x, h / 2, z + sd * (d / 2 - step / 2), w, h, step, STONE.map(c => c * (1 - k * .12)));
          prop('box', x + sd * (w / 2 - step / 2), h / 2, z, step, h, d - step * 2, STONE.map(c => c * (1 - k * .12)));
          glow(x, h + .02, z + sd * (d / 2 - step), w - step * 2, .04, .08, [.5, .32, .14]);
        }
        for (let j = Math.floor((w + d) / 5); j > 0; j--) {
          const t = r(), side = Math.floor(r() * 4), u = (t - .5) * (side < 2 ? w - step : d - step);
          const ox = side < 2 ? u : (side === 2 ? 1 : -1) * (w / 2 - step / 2);
          const oz = side < 2 ? (side ? 1 : -1) * (d / 2 - step / 2) : u;
          tree(k === 2 && r() < .3 ? 'fern' : 'shrub', x + ox, h, z + oz, 1 + r() * .8, 1.4 + r(), st, r);
        }
      }
      const pw = W - step * 6 - 4, pd = D - step * 6 - 4;
      prop('box', x, .25, z, Math.max(2, pw * .6), .1, Math.max(2, pd * .6), [.012, .025, .04]);
      glow(x, .31, z, Math.max(1, pw * .5), .02, .15, [.15, .35, .5]);
      for (let k = 0; k < 4; k++) anyTree(x + (k % 2 - .5) * pw * .8, .2, z + (Math.floor(k / 2) - .5) * pd * .8, 4 + r() * 3, st, r, [.3, .3]);
    },

    // Overgrown lot around a ruin: dense palms, broadleaf and tree ferns, vines on the walls.

    jungle(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      ground(x, z, W, D, [.022, .03, .016], .2);
      const bw = W * (.3 + .2 * r()), bd = D * (.3 + .2 * r()), bh = 5 + r() * 9;
      const bx = x + (r() < .5 ? -1 : 1) * (W - bw) / 2 * .8, bz = z + (r() < .5 ? -1 : 1) * (D - bd) / 2 * .8;
      bld(bx, bz, bw, bd, bh, st, r, { lit: .03, roof: false });
      for (let k = 0; k < 10; k++) {
        const f = H.FACES[Math.floor(r() * 4)], along = (r() - .5) * ((f[0] ? bd : bw) - 1), vh = bh * (.3 + .7 * r());
        const out = (f[0] ? bw : bd) / 2 + .1;
        prop('box', bx + f[0] * out - f[1] * along, vh / 2, bz + f[1] * out + f[0] * along, f[0] ? .25 : .6 + r() * 1.4, vh, f[0] ? .6 + r() * 1.4 : .25, [.025, .06 + .03 * r(), .025]);
      }
      prop('box', bx, bh + .15, bz, bw * .8, .3, bd * .7, [.03, .06, .025]);
      for (let k = 0; k < 3; k++) tree(r() < .5 ? 'fern' : 'shrub', bx + (r() - .5) * bw * .6, bh, bz + (r() - .5) * bd * .6, 2 + r() * 2, 2 + r() * 2, st, r);
      const n = Math.floor(W * D / 16);
      for (let k = 0; k < n; k++) {
        const tx = x + (r() - .5) * (W - 2), tz = z + (r() - .5) * (D - 2);
        if (Math.abs(tx - bx) < bw / 2 + 1 && Math.abs(tz - bz) < bd / 2 + 1) continue;
        anyTree(tx, .2, tz, 4 + r() * 8, st, r, [.35, .4]);
        if (r() < .7) tree('shrub', tx + (r() - .5) * 3, .2, tz + (r() - .5) * 3, .8 + r() * 1.2, 1.5 + r() * 2, st, r);
      }
      for (let k = Math.floor(2 + r() * 5); k > 0; k--) glow(x + (r() - .5) * W, 1 + r() * 4, z + (r() - .5) * D, .15, .15, .15, [.4, 1, .45]);
    },

    // Supertree grove: vine-clad columns, lattice crowns, glowing canopy rings, a skywalk.

    supertrees(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      ground(x, z, W, D, [.03, .035, .035], .25);
      const n = Math.min(6, 1 + Math.floor(W * D / 260)), trees = [];
      const pal = st.w > .5 ? [[1.1, .2, .9], [.25, .8, 1.1], [.6, .3, 1.2]] : [[1.2, .4, .5], [1.1, .6, .2], [.9, .3, .9]];
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2 + r(), rad = n > 1 ? .3 : 0;
        const tx = x + Math.cos(a) * W * rad, tz = z + Math.sin(a) * D * rad, h = (12 + r() * 14) * Math.min(1.3, b + .3);
        const c = Math.min(W * .45, D * .45, 4 + h * .25 + r() * 3), col = pal[Math.floor(r() * pal.length)];
        prop('cyl', tx, h * .4, tz, 1.4, h * .8, 1.4, [.03, .05, .03]);
        put(H.PROPS.lattice, tx, h * .8, tz, c, h * .4, c, 0, Math.PI);
        prop('dish', tx, h * .98, tz, c, c * .35, c, [.04, .045, .05]);
        put(GLOWS.ring, tx, h * 1.02, tz, c, 1, c, 0, 0, col);
        put(GLOWS.ring, tx, h * .9, tz, c * .7, 1, c * .7, 0, 0, col.map(q => q * .5));
        for (let j = 0; j < 6; j++) {
          const ja = j * Math.PI / 3 + r();
          glow(tx + Math.cos(ja) * c * .45, h * .97, tz + Math.sin(ja) * c * .45, .3, .3, .3, col.map(q => q * .7));
        }
        tree('shrub', tx, .25, tz, 1.4, 4, st, r);
        trees.push([tx, tz, h]);
      }
      if (trees.length > 1) {
        const [[ax, az, ah], [cx, cz, ch]] = trees, y = Math.min(ah, ch) * .6, len = Math.hypot(cx - ax, cz - az);
        const ry = Math.atan2(cx - ax, cz - az);
        prop('box', (ax + cx) / 2, y, (az + cz) / 2, 1.6, .3, len, [.06, .06, .065], ry);
        stringLights([ax, y + .4, az], [cx, y + .4, cz], 0, Math.ceil(len / 2), warm(st).map(c => c * .6));
      }
      for (let k = 0; k < 4; k++) lamp(x + (k % 2 - .5) * (W - 3), z + (Math.floor(k / 2) - .5) * (D - 3), 3.5, st);
    },

    // Modest block with stepped green terraces, hanging vines and roof trees.

    terrace(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      let w = W - 1, d = D * (.75 + .2 * r()), y = 0;
      const tiers = 2 + Math.floor(r() * 2);
      for (let k = 0; k < tiers; k++) {
        const h = (k ? 4 + r() * 4 : 8 + r() * 10) * Math.min(1.4, b + .2);
        bld(x, z, w, d, h, st, r, { y0: y, roof: false, lit: st.lit * .8 });
        y += h;
        prop('box', x, y + .2, z, w - .4, .4, d - .4, [.03, .04, .025]);
        for (const sd of [-1, 1]) {
          prop('box', x, y + .5, z + sd * (d / 2 - .5), w - 1, .6, .8, [.06, .05, .04]);
          for (let j = Math.floor(w / 3); j > 0; j--) tree('shrub', x + (r() - .5) * (w - 2), y + .6, z + sd * (d / 2 - .5), .8 + r() * .6, 1.4, st, r);
          for (let j = Math.floor(w / 5); j > 0; j--) {
            const vh = 1.5 + r() * Math.min(5, h * .6);
            prop('box', x + (r() - .5) * (w - 2), y - vh / 2, z + sd * (d / 2 + .08), .5 + r(), vh, .12, [.025, .06, .03]);
          }
        }
        glow(x + w / 2 - 1, y + 1.4, z + d / 2 - 1, .3, .3, .3, warm(st).map(c => c * .8));
        w *= .62 + .1 * r(); d *= .62 + .1 * r();
      }
      for (let k = 1 + Math.floor(r() * 3); k > 0; k--) anyTree(x + (r() - .5) * w, y + .4, z + (r() - .5) * d, 3 + r() * 3, st, r, [.4, .5]);
    },

    // Corporate forecourt: reflecting pool, holo gyroscope, lit paving grid, planter rows.

    atrium(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      ground(x, z, W, D, [.05, .055, .065], .25);
      const cyan = [.25, .9, 1.1], mag = [1.1, .2, .9], acc = r() < .5 ? cyan : mag;
      for (let k = -2; k <= 2; k++) {
        glow(x + k * W / 5, .27, z, .06, .02, D - 1, [.08, .16, .22]);
        glow(x, .27, z + k * D / 5, W - 1, .02, .06, [.08, .16, .22]);
      }
      const pw = W * .3, pd = D * .62;
      prop('box', x, .3, z, pw, .1, pd, [.008, .012, .02]);
      glow(x, .36, z, pw - .4, .01, pd - .4, [.02, .045, .07]);
      for (const sd of [-1, 1]) {
        glow(x + sd * pw / 2, .37, z, .08, .04, pd, acc.map(c => c * .4));
        glow(x, .37, z + sd * pd / 2, pw, .04, .08, acc.map(c => c * .4));
      }
      const hx = x, hz = z - pd / 2 - 2.5, hy = 4 + r() * 2;
      prop('cyl', hx, .6, hz, 2.4, .7, 2.4, [.06, .065, .07]);
      put(GLOWS.sphere, hx, hy, hz, 1.1, 1.1, 1.1, 0, 0, acc);
      for (let k = 0; k < 3; k++) put(GLOWS.ring, hx, hy, hz, 4 + k * 1.2, 1, 4 + k * 1.2, k * 1.05 + r(), .5 + k * .6, (k % 2 ? cyan : mag).map(c => c * .9));
      glow(hx, (hy + .9) / 2, hz, .08, hy - 1, .08, acc.map(c => c * .5));
      for (const sd of [-1, 1]) for (let k = 0; k < Math.max(2, Math.floor(D / 9)); k++) {
        const px = x + sd * (pw / 2 + (W / 2 - pw / 2) * .55), pz = z + (k + .5 - Math.max(2, Math.floor(D / 9)) / 2) * 8;
        prop('box', px, .7, pz, 2.4, .9, 2.4, [.07, .075, .085]);
        tree(r() < .3 ? 'palm' : 'broad', px, 1.15, pz, 5 + r() * 2, 3.5, st, r);
        glow(px, 1.17, pz + 1.22, 2.2, .06, .03, cyan.map(c => c * .3));
      }
      for (const sd of [-1, 1]) glow(x + sd * (W / 2 - .8), 3, z + D / 2 - .8, .2, 6, .2, cyan.map(c => c * .55));
    },

    // Memorial square: stepped plinth, candle-lit niche, offerings, papel picado, a sacred ceibo.

    shrine(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      ground(x, z, W, D, [.055, .05, .045], .2);
      const sz = z - D * .15;
      for (let k = 0; k < 3; k++) prop('box', x, .3 + k * .35, sz, 6 - k * 1.4, .35, 4.6 - k * 1.1, [.08, .072, .065]);
      prop('box', x, 2.9, sz - .6, 2, 3, 1.4, [.09, .08, .07]);
      prop('cone', x, 4.9, sz - .6, 3, 1, 2.2, [.12, .05, .03]);
      glow(x, 2.6, sz + .12, .8, 1.3, .05, [1.2, .55, .18]);
      for (let k = 0; k < 18; k++) {
        const cx = x + (r() - .5) * 5, cz = sz + 1.2 + r() * 1.8;
        if (k % 3) glow(cx, .55 + .1 * r(), cz, .08, .16, .08, [1.2, .6, .2]);
        else H.flickerGlow(cx, .6, cz, .1, .2, .1, [1.3, .6, .2], r);
      }
      for (let k = 0; k < 8; k++) prop('box', x + (r() - .5) * 5, .5, sz + 1.5 + r() * 1.5, .3, .25, .3, r() < .5 ? [.3, .12, .01] : [.25, .03, .06]);
      const flags = [[1, .3, .6], [1, .7, .1], [.3, .8, 1], [.5, 1, .3]];
      for (let k = 0; k < 4; k++) {
        const cx = x + (k % 2 - .5) * (W - 1), cz = z + (Math.floor(k / 2) - .5) * (D - 1);
        prop('cyl', cx, 2.5, cz, .12, 5, .12, [.05, .04, .03]);
        stringLights([x, 5.4, sz - .6], [cx, 5, cz], .6, 8, flags[k].map(c => c * .5));
      }
      tree('broad', x + (r() < .5 ? -1 : 1) * W * .3, .2, z + D * .2, 9 + r() * 4, 10 + r() * 3, st, r);
      for (let k = 0; k < 3; k++) bench(x + (k - 1) * 3.5, z + D / 2 - 2, 0);
    },

    // Rough court ringed by stalls under tarps, string lights criss-crossing overhead.

    market(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      ground(x, z, W, D, [.045, .04, .035], .2);
      const cw = W - 9, cd = D - 9, line = [.1, .1, .085];
      if (cw > 8 && cd > 6) {
        for (const sd of [-1, 1]) {
          glow(x, .21, z + sd * cd / 2, cw, .01, .1, line);
          glow(x + sd * cw / 2, .21, z, .1, .01, cd, line);
          const gx = x + sd * (cw / 2 - .5);
          prop('cyl', gx, 1.6, z, .12, 3.2, .12, [.1, .1, .1]);
          prop('box', gx, 3.2, z, .08, 1, 1.6, [.12, .12, .12]);
        }
        glow(x, .21, z, .1, .01, cd, line);
      }
      const tarp = [[.22, .05, .03], [.04, .09, .16], [.2, .15, .03], [.05, .14, .06], [.18, .05, .14]];
      for (const sd of [-1, 1]) for (let u = -W / 2 + 2; u < W / 2 - 2; u += 3.2 + r()) {
        if (r() < .2) continue;
        const sz = z + sd * (D / 2 - 2);
        prop('box', x + u, .6, sz, 2.6, 1, 1.6, [.07, .05, .035]);
        prop('box', x + u, 2.5, sz - sd * .3, 3, .08, 2.6, tarp[Math.floor(r() * tarp.length)], 0, sd * .18);
        glow(x + u, 2.15, sz, .25, .25, .25, [1.1, .65, .3]);
        if (r() < .4) prop('box', x + u + 1.6, .4, sz - sd * 1.2, .8, .8, .8, [.08, .06, .03]);
      }
      const poles = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([dx, dz]) => [x + dx * (W / 2 - .5), 5.5, z + dz * (D / 2 - .5)]);
      for (const [px, , pz] of poles) prop('cyl', px, 2.75, pz, .14, 5.5, .14, [.06, .05, .04]);
      stringLights(poles[0], poles[2], 1.2, 16, [1, .62, .28]);
      stringLights(poles[1], poles[3], 1.2, 16, [1, .62, .28]);
      if (r() < .6) tree('palm', poles[0][0] + 1.5, .2, poles[0][2] + 1.5, 9 + r() * 4, 7, st, r, .12);
    },

    // Canal-side promenade: water channel, raised quays with railings, palm row, lamps, a footbridge.

    promenade(x, z, s, st, b, r) {
      const [W, D] = dims(s), swap = D > W, L = Math.max(W, D), C = Math.min(W, D);

      // u runs along the canal, v across it.

      const box = (u, y, v, lu, h, lv, rgb, ry = 0) => swap ? prop('box', x + v, y, z + u, lv, h, lu, rgb, ry) : prop('box', x + u, y, z + v, lu, h, lv, rgb, ry);
      const at = (u, v) => swap ? [x + v, z + u] : [x + u, z + v];
      const cw = C * (.35 + .1 * r()), qw = (C - cw) / 2;
      box(0, .05, 0, L, .1, cw, [.008, .016, .026]);
      if (swap) glow(x, .11, z, cw, .01, L, [.015, .035, .055]); else glow(x, .11, z, L, .01, cw, [.015, .035, .055]);
      for (let k = 0; k < 4; k++) {
        const [gx, gz] = at((r() - .5) * L * .8, (r() - .5) * cw * .6);
        glow(gx, .13, gz, swap ? .08 : 2 + r() * 3, .01, swap ? 2 + r() * 3 : .08, [.12, .25, .35]);
      }
      for (const sd of [-1, 1]) {
        const qv = sd * (cw / 2 + qw / 2);
        box(0, .5, qv, L, 1, qw, STONE);
        box(0, 1.55, sd * (cw / 2 + .1), L, .08, .08, [.1, .1, .1]);
        for (let u = -L / 2 + 3; u < L / 2 - 2; u += 7) {
          const [lx, lz] = at(u, sd * (cw / 2 + .6));
          lamp(lx, lz, 3.6, st, 1);
          if (sd > 0) { const [px, pz] = at(u + 3.5, sd * (C / 2 - 1.5)); tree('palm', px, 1, pz, 8 + r() * 4, 6.5, st, r, (r() - .5) * .25); }
          else if (r() < .6) { const [bx, bz] = at(u + 3.5, sd * (cw / 2 + 1.4)); bench(bx, bz, swap ? Math.PI / 2 : 0, 1); }
        }
      }
      if (L > 20) box(L * (r() - .5) * .4, 1.2, 0, 3, .3, cw + 1, [.08, .075, .07]);
      const [bx, bz] = at((r() - .5) * L * .6, (r() - .5) * cw * .3);
      prop('box', bx, .35, bz, swap ? 1.6 : 4.5, .5, swap ? 4.5 : 1.6, [.06, .05, .04]);
      glow(bx, .75, bz, .2, .2, .2, [1.1, .5, .2]);
    },

    // Rows of graves between cypress paths, a nicho wall with candles, a mausoleum or two.

    cemetery(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      ground(x, z, W, D, [.02, .03, .02], .2);
      prop('box', x, .22, z, 1.8, .05, D, [.06, .055, .05]);
      const nz = z - D / 2 + .7, nh = 3 + r();
      prop('box', x, nh / 2, nz, W, nh, 1.4, [.09, .085, .08]);
      for (let k = Math.floor(W / 2); k > 0; k--) {
        const cx = x + (r() - .5) * (W - 1), cy = .5 + Math.floor(r() * 4) * (nh / 4.5);
        if (r() < .3) H.flickerGlow(cx, cy, nz + .72, .12, .18, .05, [1.2, .55, .18], r);
        else glow(cx, cy, nz + .72, .1, .14, .05, [.9, .45, .15]);
      }
      const gx = Math.max(1.4, W / 14), gz = Math.max(1.8, D / 10);
      for (let u = -W / 2 + 1.5; u < W / 2 - 1; u += gx) for (let v = -D / 2 + 3; v < D / 2 - 1.5; v += gz) {
        if (Math.abs(u) < 1.6 || r() < .15) continue;
        const g = H.grey(r, .12), h = .6 + r() * .5;
        prop('box', x + u, .2 + h / 2, z + v, .7, h, .18, g);
        if (r() < .25) prop('box', x + u, .2 + h * .75, z + v, .55, .12, .19, g);
        if (r() < .05) glow(x + u, .3, z + v + .25, .07, .12, .07, [1, .5, .15]);
      }
      for (let v = -D / 2 + 4; v < D / 2 - 2; v += 5) for (const sd of [-1, 1]) tree('cypress', x + sd * 1.5, .2, z + v, 5 + r() * 3, 1.6, st, r);
      for (let k = r() < .6 ? 1 : 2; k > 0; k--) {
        const mx = x + (k === 1 ? 1 : -1) * W * .3, mz = z + D * .3;
        prop('box', mx, 1.7, mz, 3.4, 3, 4, [.1, .095, .09]);
        prop('cone', mx, 3.8, mz, 3.6, 1.2, 4.2, [.08, .075, .07]);
        glow(mx, 1.4, mz - 2.02, .8, 2, .04, [.5, .25, .08]);
      }
      lamp(x, z + D / 2 - 1, 3.5, st);
    },
  };
}

// Extra kit names per district style and density tier (0 = low). Base kits already use these names.

export const tiers = {
  bdc: { 0: ['jungle', 'jungle', 'market', 'cemetery', 'promenade'], 1: ['pocket', 'shrine', 'market'], 2: ['terrace'] },
  rut: { 0: ['plaza', 'supertrees', 'sunken'], 1: ['plaza', 'pocket', 'promenade', 'terrace'], 2: ['atrium', 'supertrees', 'terrace'], 3: ['atrium'] },
};
