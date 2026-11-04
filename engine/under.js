// The dungeon toolkit: rooms, tunnels, caverns, shafts and stairs below a city, lit by torches.
// A pack layer module calls dungeon(), builds with its methods and calls bake() once. See SETTINGS.md, "Dungeons".
//
// Coordinates are world metres: x east, z south, y up. A frame (D.frame) moves and turns the x, z of everything
// built inside it. Rooms and tunnels have no ceilings, so the map looks down into them.
//
// Torch light is baked into the vertices at bake() and flickers in the shader. Each vertex keeps the phase of its
// brightest torch, so the walls round one torch flicker together. Steady light (magic, glowing water) does not flicker.

import * as THREE from 'three';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
import { U, camera, label as mkLabel, scene } from './render.js';
import { groundAt } from './relief.js';

// Materials. Each one is a pattern in the shader and a default colour.

export const MAT = { ashlar: 0, rubble: 1, brick: 2, rock: 3, flag: 4, dirt: 5, wood: 6, iron: 7, bone: 8, gold: 9, water: 10, glow: 11, plaster: 12, moss: 13, cloth: 14 };
const ALBEDO = {
  ashlar: [.46, .41, .34], rubble: [.38, .35, .3], brick: [.44, .24, .17], rock: [.33, .3, .27], flag: [.36, .33, .29],
  dirt: [.25, .2, .15], wood: [.34, .23, .14], iron: [.14, .14, .15], bone: [.66, .6, .48], gold: [.95, .7, .22],
  water: [.06, .11, .12], glow: [1, .5, .2], plaster: [.6, .56, .48], moss: [.28, .32, .22], cloth: [.35, .08, .07],
};
export const TORCH = [1.7, .95, .45];
const STEP = 1.5;

export function dungeon(opts = {}) {
  const group = new THREE.Group(), ticks = [], labels = [], lights = [], flames = [], cut = { value: 1e5 };
  group.visible = false;
  scene.add(group);
  const P = [], N = [], C = [], M = [], I = [];
  let T = { x: 0, z: 0, c: 1, s: 0, r: 0 };
  const tw = (x, z) => [T.x + x * T.c + z * T.s, T.z - x * T.s + z * T.c];
  const tn = (x, z) => [x * T.c + z * T.s, -x * T.s + z * T.c];
  const tint = (mat, rgb, jit = .08) => {
    const b = rgb ?? ALBEDO[mat], v = 1 + (Math.random() - .5) * 2 * jit;
    return [b[0] * v, b[1] * v, b[2] * v];
  };

  // A grid between four corners, already in world space. n is the face normal.

  function quad(a, b, c, d, n, rgb, mat, nu, nv) {
    nu ??= Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / STEP));
    nv ??= Math.max(1, Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]) / STEP));
    const base = P.length / 3, m = MAT[mat] ?? mat;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = i / nu, v = j / nv;
      for (let k = 0; k < 3; k++) P.push((a[k] * (1 - u) + b[k] * u) * (1 - v) + (c[k] * (1 - u) + d[k] * u) * v);
      N.push(...n); C.push(...rgb); M.push(m, 0);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const p = base + j * (nu + 1) + i, q = p + nu + 1;
      I.push(p, p + 1, q, p + 1, q + 1, q);
    }
  }

  // Corners in local frame space to world space.

  const W = (x, y, z) => { const [wx, wz] = tw(x, z); return [wx, y, wz]; };
  const Wn = (x, y, z) => { const [nx, nz] = tn(x, z); return [nx, y, nz]; };

  const D = {
    group, labels, MAT, ALBEDO, TORCH,

    // Run fn with x, z moved to (x, z) and turned by rot radians (a turn from +x towards -z, as three.js rotation.y).

    frame(x, z, rot, fn) {
      const old = T, [wx, wz] = tw(x, z), r = old.r + rot;
      T = { x: wx, z: wz, c: Math.cos(r), s: Math.sin(r), r };
      try { fn(); } finally { T = old; }
    },
    world: (x, z) => tw(x, z),
    rot: () => T.r,

    // A solid box. y is its bottom. o: { rot, rgb, jit, faces } where faces skips sides, e.g. 'b' for the bottom.

    box(x, y, z, w, h, d, mat = 'ashlar', o = {}) {
      const rgb = tint(mat, o.rgb, o.jit), skip = o.faces ?? 'b';
      D.frame(x, z, o.rot ?? 0, () => {
        const a = w / 2, e = d / 2, y1 = y + h;
        if (!skip.includes('t')) quad(W(-a, y1, e), W(a, y1, e), W(-a, y1, -e), W(a, y1, -e), Wn(0, 1, 0), rgb, mat);
        if (!skip.includes('b')) quad(W(-a, y, -e), W(a, y, -e), W(-a, y, e), W(a, y, e), Wn(0, -1, 0), rgb, mat);
        quad(W(-a, y, e), W(a, y, e), W(-a, y1, e), W(a, y1, e), Wn(0, 0, 1), rgb, mat);
        quad(W(a, y, -e), W(-a, y, -e), W(a, y1, -e), W(-a, y1, -e), Wn(0, 0, -1), rgb, mat);
        quad(W(a, y, e), W(a, y, -e), W(a, y1, e), W(a, y1, -e), Wn(1, 0, 0), rgb, mat);
        quad(W(-a, y, -e), W(-a, y, e), W(-a, y1, -e), W(-a, y1, e), Wn(-1, 0, 0), rgb, mat);
      });
    },

    // A round column, or with inward a round shaft wall seen from inside. o: { seg, rgb, top, r1 } where r1 is the top radius.

    cyl(x, y, z, r, h, mat = 'ashlar', o = {}) {
      const rgb = tint(mat, o.rgb, o.jit), seg = o.seg ?? Math.max(8, Math.ceil(r * 2 * Math.PI / STEP)), r1 = o.r1 ?? r, s = o.inward ? -1 : 1;
      for (let k = 0; k < seg; k++) {
        const a0 = k / seg * Math.PI * 2, a1 = (k + 1) / seg * Math.PI * 2, am = (a0 + a1) / 2;
        const p = (a, rr, yy) => W(x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr);
        const [A, B] = o.inward ? [a0, a1] : [a1, a0];
        quad(p(A, r, y), p(B, r, y), p(A, r1, y + h), p(B, r1, y + h), Wn(Math.cos(am) * s, (r - r1) / h * s, Math.sin(am) * s), rgb, mat, 1);
        if (o.top !== false && !o.inward) quad(p(A, r1, y + h), p(B, r1, y + h), W(x, y + h, z), W(x, y + h, z), Wn(0, 1, 0), rgb, mat, 1, 1);
      }
    },

    // A flat floor. rect: x, z centre, w by d; poly: [[x, z], ...] in frame space.

    floor(x, y, z, w, d, mat = 'flag', o = {}) {
      const rgb = tint(mat, o.rgb, o.jit);
      D.frame(x, z, o.rot ?? 0, () => quad(W(-w / 2, y, d / 2), W(w / 2, y, d / 2), W(-w / 2, y, -d / 2), W(w / 2, y, -d / 2), Wn(0, 1, 0), rgb, mat));
    },
    floorPoly(poly, y, mat = 'rock', o = {}) {
      const rgb = tint(mat, o.rgb, o.jit);
      const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
      let g = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
      g = new TessellateModifier(STEP * 1.4, 8).modify(g.toNonIndexed());
      const pos = g.attributes.position, base = P.length / 3;
      for (let i = 0; i < pos.count; i++) {
        const [wx, wz] = tw(pos.getX(i), pos.getZ(i)), bump = o.bump ? (Math.sin(wx * 1.37 + wz * .61) * Math.sin(wz * 1.11 - wx * .43)) * o.bump : 0;
        P.push(wx, y + bump, wz); N.push(0, 1, 0); C.push(...rgb); M.push(MAT[mat], 0); I.push(base + i);
      }
    },

    // A wall along a path of [x, z] or [x, y, z] points, h tall and thick deep, on the left of the path's direction.
    // o: { closed, rgb, jit, rough } where rough jitters the inner face so a cave wall looks hewn.

    wall(path, y, h, mat = 'ashlar', o = {}) {
      const rgb = tint(mat, o.rgb, o.jit), t = o.thick ?? .8, pts = path.map(p => p.length === 2 ? [p[0], y, p[1]] : p);
      const n = pts.length, closed = !!o.closed, rough = o.rough ?? 0;
      const side = [];
      for (let i = 0; i < n; i++) {
        const pa = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], pb = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
        let dx = pb[0] - pa[0], dz = pb[2] - pa[2], l = Math.hypot(dx, dz) || 1;
        dx /= l; dz /= l;
        let m = 1;
        if (i > 0 || closed) {
          const pp = pts[(i - 1 + n) % n], ax = pts[i][0] - pp[0], az = pts[i][2] - pp[2], al = Math.hypot(ax, az) || 1;
          m = 1 / Math.max(.5, (ax / al) * dx + (az / al) * dz);
        }
        side.push([-dz * m, dx * m]);
      }
      const seg = closed ? n : n - 1;
      for (let i = 0; i < seg; i++) {
        const j = (i + 1) % n, a = pts[i], b = pts[j], sa = side[i], sb = side[j];
        const ra = rough ? (Math.sin(a[0] * 1.7 + a[2] * 2.3) * rough) : 0, rb = rough ? (Math.sin(b[0] * 1.7 + b[2] * 2.3) * rough) : 0;
        const ia = W(a[0] + sa[0] * ra, a[1], a[2] + sa[1] * ra), ib = W(b[0] + sb[0] * rb, b[1], b[2] + sb[1] * rb);
        const oa = W(a[0] + sa[0] * t, a[1], a[2] + sa[1] * t), ob = W(b[0] + sb[0] * t, b[1], b[2] + sb[1] * t);
        const up = (p, k) => [p[0], p[1] + h * k, p[2]];
        const dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1, inN = Wn(dz / l, 0, -dx / l), outN = [-inN[0], 0, -inN[2]];
        quad(ib, ia, up(ib, 1), up(ia, 1), inN, rgb, mat);
        quad(oa, ob, up(oa, 1), up(ob, 1), outN, rgb, mat, Math.max(1, Math.ceil(l / 4)), 1);
        quad(up(ib, 1), up(ia, 1), up(ob, 1), up(oa, 1), [0, 1, 0], rgb, mat, undefined, 1);
      }
    },

    // A room: floor and four walls with doorways. doors: [{ side: 'n'|'s'|'e'|'w', at: -1..1 along the side, w, h }].
    // North is -z. o: { rot, wall, floor, thick, rgb }.

    room(x, z, y, w, d, h, o = {}) {
      const t = o.thick ?? .8, wm = o.wall ?? 'ashlar', fm = o.floor ?? 'flag', doors = o.doors ?? [];
      D.frame(x, z, o.rot ?? 0, () => {
        D.floor(0, y, 0, w + t * 2, d + t * 2, fm, { rgb: o.floorRgb });
        const sides = { n: [[-w / 2 - t, -d / 2 - t / 2], [w / 2 + t, -d / 2 - t / 2]], s: [[-w / 2 - t, d / 2 + t / 2], [w / 2 + t, d / 2 + t / 2]],
          w: [[-w / 2 - t / 2, -d / 2], [-w / 2 - t / 2, d / 2]], e: [[w / 2 + t / 2, -d / 2], [w / 2 + t / 2, d / 2]] };
        for (const [k, [a, b]] of Object.entries(sides)) {
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
          const gaps = doors.filter(dr => dr.side === k).map(dr => { const c = (dr.at ?? 0) * (k === 'n' || k === 's' ? w : d) / 2 + len / 2, hw = (dr.w ?? 2.4) / 2; return [c - hw, c + hw, dr.h ?? 3]; }).sort((p, q) => p[0] - q[0]);
          let s0 = 0;
          for (const [g0, g1, gh] of [...gaps, [len, len, 0]]) {
            if (g0 - s0 > .05) { const m = (s0 + g0) / 2; D.box(a[0] + ux * m, y, a[1] + uz * m, k === 'n' || k === 's' ? g0 - s0 : t, h, k === 'n' || k === 's' ? t : g0 - s0, wm, { rgb: o.rgb }); }
            if (gh && gh < h) { const m = (g0 + g1) / 2; D.box(a[0] + ux * m, y + gh, a[1] + uz * m, k === 'n' || k === 's' ? g1 - g0 : t, h - gh, k === 'n' || k === 's' ? t : g1 - g0, wm, { rgb: o.rgb }); }
            s0 = g1;
          }
        }
        if (o.torches) D.torchRing(0, 0, y, w, d, o.torches, o.torchRgb);
      });
    },

    // Torches round a room's inner walls, one every `every` metres. Coordinates are in the current frame.

    torchRing(x, z, y, w, d, every = 6, rgb) {
      for (const [ax, az, bx, bz, nx, nz] of [[-w / 2, -d / 2, w / 2, -d / 2, 0, 1], [w / 2, d / 2, -w / 2, d / 2, 0, -1], [-w / 2, d / 2, -w / 2, -d / 2, 1, 0], [w / 2, -d / 2, w / 2, d / 2, -1, 0]]) {
        const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.floor(len / every));
        for (let k = 0; k < n; k++) { const u = (k + .5) / n; D.torch(x + ax + (bx - ax) * u, y + 2.3, z + az + (bz - az) * u, nx, nz, { rgb }); }
      }
    },

    // A tunnel along [x, y, z] points: floor and two walls. o: { w, h, wall, floor, thick, water, torches, torchRgb }.
    // water lays a channel along the middle, and torches hangs one every so many metres on alternate walls.

    tunnel(pts, o = {}) {
      const w = o.w ?? 2.8, h = o.h ?? 3.4, t = o.thick ?? .7, wm = o.wall ?? 'ashlar', fm = o.floor ?? 'flag';
      const n = pts.length, off = [];
      for (let i = 0; i < n; i++) {
        const pa = pts[Math.max(0, i - 1)], pb = pts[Math.min(n - 1, i + 1)];
        let dx = pb[0] - pa[0], dz = pb[2] - pa[2]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        let m = 1;
        if (i > 0 && i < n - 1) { const ax = pts[i][0] - pa[0], az = pts[i][2] - pa[2], al = Math.hypot(ax, az) || 1; m = 1 / Math.max(.5, (ax / al) * dx + (az / al) * dz); }
        off.push([-dz * m, dx * m]);
      }
      const at = (i, k) => [pts[i][0] + off[i][0] * k, pts[i][1], pts[i][2] + off[i][1] * k];
      const left = pts.map((_, i) => at(i, w / 2)), right = pts.map((_, i) => at(i, -w / 2)).reverse();
      D.wall(left, 0, h, wm, { thick: t, rgb: o.rgb, rough: o.rough });
      D.wall(right, 0, h, wm, { thick: t, rgb: o.rgb, rough: o.rough });
      const frgb = tint(fm, o.floorRgb), wrgb = tint('water', o.waterRgb, 0);
      for (let i = 0; i < n - 1; i++) {
        const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][2] - pts[i][2]);
        const A = W(...at(i, w / 2)), B = W(...at(i + 1, w / 2)), C2 = W(...at(i, -w / 2)), D2 = W(...at(i + 1, -w / 2));
        quad(A, B, C2, D2, [0, 1, 0], frgb, fm, Math.max(1, Math.ceil(l / STEP)), Math.max(1, Math.ceil(w / STEP)));
        if (o.water) {
          const ww = o.water === true ? w * .45 : o.water, lift = [0, .06, 0], add = (p) => [p[0] + lift[0], p[1] + lift[1], p[2] + lift[2]];
          quad(add(W(...at(i, ww / 2))), add(W(...at(i + 1, ww / 2))), add(W(...at(i, -ww / 2))), add(W(...at(i + 1, -ww / 2))), [0, 1, 0], wrgb, 'water', Math.max(1, Math.ceil(l / STEP)), 1);
        }
      }
      if (o.torches) {
        let acc = o.torches / 2, flip = 1;
        for (let i = 0; i < n - 1; i++) {
          const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[2] - a[2]);
          while (acc < l) {
            const u = acc / l, k = (w / 2 - .15) * flip, p = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
            const ox = off[i][0], oz = off[i][1], ol = Math.hypot(ox, oz);
            D.torch(p[0] + ox / ol * k, p[1] + 2.3, p[2] + oz / ol * k, -ox / ol * flip, -oz / ol * flip, { rgb: o.torchRgb });
            acc += o.torches; flip = -flip;
          }
          acc -= l;
        }
      }
    },

    // A rough natural cave: floor, and a hewn wall round the closed outline poly. o: { wall, floor, rough, bump }.

    cavern(poly, y, h, o = {}) {
      D.floorPoly(poly, y, o.floor ?? 'rock', { bump: o.bump ?? .25, rgb: o.floorRgb });
      const ring = poly[0][0] === poly.at(-1)[0] && poly[0][1] === poly.at(-1)[1] ? poly.slice(0, -1) : poly;
      const cw = ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]; return s + (q[0] - p[0]) * (q[1] + p[1]); }, 0) > 0;
      D.wall(cw ? ring : [...ring].reverse(), y, h, o.wall ?? 'rock', { closed: true, thick: o.thick ?? 1.5, rough: o.rough ?? .5, rgb: o.rgb });
    },

    // A straight stair from (x, y0, z) rising to y1 along local +x after rot. w wide; tread .3 m per .2 m rise by default.

    stairs(x, z, y0, y1, w = 2.4, o = {}) {
      const rise = o.rise ?? .22, n = Math.max(1, Math.round(Math.abs(y1 - y0) / rise)), tr = o.tread ?? .32, dy = (y1 - y0) / n;
      D.frame(x, z, o.rot ?? 0, () => {
        for (let k = 0; k < n; k++) {
          const yb = Math.min(y0 + dy * k, y0 + dy * (k + 1));
          D.box(k * tr + tr / 2, Math.min(y0, y1) - .2, 0, tr, yb - Math.min(y0, y1) + .2 + Math.abs(dy), w, o.mat ?? 'ashlar', { jit: .03 });
        }
        if (o.walls !== false) for (const s of [-1, 1]) D.box(n * tr / 2, Math.min(y0, y1), s * (w / 2 + .3), n * tr, Math.abs(y1 - y0) + 2.6, .6, o.wall ?? o.mat ?? 'ashlar');
      });
      return n * tr;
    },

    // A round shaft from y0 up to y1 with a spiral stair inside when o.spiral. Its wall is seen from inside.

    shaft(x, z, y0, y1, r = 2.5, o = {}) {
      const [wx, wz] = tw(x, z);
      const old = T; T = { x: 0, z: 0, c: 1, s: 0, r: 0 };
      D.cyl(wx, y0, wz, r, y1 - y0, o.wall ?? 'ashlar', { inward: true, rgb: o.rgb });
      D.cyl(wx, y0, wz, r + (o.thick ?? .8), y1 - y0, o.wall ?? 'ashlar', { top: false, rgb: o.rgb, seg: 16 });
      if (o.spiral) {
        const steps = Math.round((y1 - y0) / .25);
        for (let k = 0; k < steps; k++) {
          const a = k * .32, rr = r * .55;
          D.box(wx + Math.cos(a) * rr, y0 + k * .25, wz + Math.sin(a) * rr, r * .9, .25, .7, o.mat ?? 'ashlar', { rot: -a, jit: .03, faces: 'b' });
        }
        D.cyl(wx, y0, wz, .35, y1 - y0, o.mat ?? 'ashlar', { seg: 8 });
      }
      if (o.torches) for (let y = y0 + 2.5, k = 0; y < y1 - .5; y += o.torches, k++) {
        const a = k * 2.1; D.torch(wx + Math.cos(a) * (r - .15), y, wz + Math.sin(a) * (r - .15), -Math.cos(a), -Math.sin(a), { rgb: o.torchRgb });
      }
      T = old;
    },

    // A round arch or vault rib across a span along local x, standing on y, rise high. o: { thick, depth, rot, mat }.

    arch(x, y, z, span, rise, o = {}) {
      const segs = o.segs ?? 9, t = o.thick ?? .5, dpt = o.depth ?? .6, rgb = tint(o.mat ?? 'ashlar', o.rgb);
      D.frame(x, z, o.rot ?? 0, () => {
        for (let k = 0; k < segs; k++) {
          const a0 = Math.PI * k / segs, a1 = Math.PI * (k + 1) / segs, am = (a0 + a1) / 2;
          const cx = -Math.cos(am) * span / 2, cy = y + Math.sin(am) * rise;
          const dx = -(Math.cos(a1) - Math.cos(a0)) * span / 2, dy = (Math.sin(a1) - Math.sin(a0)) * rise, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
          D.frame(cx, 0, 0, () => D.slab(0, cy, 0, len + .08, t, dpt, ang, o.mat ?? 'ashlar', rgb));
        }
      });
    },

    // A box tilted by `tilt` radians round local z (for arch stones and ramps). Its centre is (x, y, z).

    slab(x, y, z, w, h, d, tilt, mat, rgb) {
      const c = Math.cos(tilt), s = Math.sin(tilt), p = (lx, ly, lz) => W(x + lx * c - ly * s, y + lx * s + ly * c, z + lz);
      const nr = (lx, ly, lz) => Wn(lx * c - ly * s, lx * s + ly * c, lz);
      const a = w / 2, b = h / 2, e = d / 2;
      rgb ??= tint(mat);
      quad(p(-a, b, e), p(a, b, e), p(-a, b, -e), p(a, b, -e), nr(0, 1, 0), rgb, mat, 1, 1);
      quad(p(-a, -b, -e), p(a, -b, -e), p(-a, -b, e), p(a, -b, e), nr(0, -1, 0), rgb, mat, 1, 1);
      quad(p(-a, -b, e), p(a, -b, e), p(-a, b, e), p(a, b, e), nr(0, 0, 1), rgb, mat, 1, 1);
      quad(p(a, -b, -e), p(-a, -b, -e), p(a, b, -e), p(-a, b, -e), nr(0, 0, -1), rgb, mat, 1, 1);
      quad(p(a, -b, e), p(a, -b, -e), p(a, b, e), p(a, b, -e), nr(1, 0, 0), rgb, mat, 1, 1);
      quad(p(-a, -b, -e), p(-a, -b, e), p(-a, b, -e), p(-a, b, e), nr(-1, 0, 0), rgb, mat, 1, 1);
    },

    // Still water in a rectangle or polygon, at height y.

    water(x, y, z, w, d, o = {}) { D.floor(x, y, z, w, d, 'water', { rgb: o.rgb ?? ALBEDO.water, jit: 0, rot: o.rot }); },
    waterPoly(poly, y, o = {}) { D.floorPoly(poly, y, 'water', { rgb: o.rgb ?? ALBEDO.water, jit: 0 }); },

    // A glowing box: runes, eyes, embers, lit windows. o.pulse > 0 makes it throb at that many beats a second (to 0.1).

    glow(x, y, z, w, h, d, rgb = [1.6, .6, .2], o = {}) {
      const at = P.length / 3;
      D.box(x, y, z, w, h, d, 'glow', { rgb, jit: 0, rot: o.rot, faces: o.faces ?? 'b' });
      for (let i = at; i < P.length / 3; i++) M[i * 2 + 1] = o.pulse ? Math.round(o.pulse * 10) * 1000 + (o.phase ?? Math.random()) * 999 : -1;
    },

    // Light. A torch is a bracket on a wall facing (nx, nz), a flame and a flickering light.

    light(x, y, z, rgb = TORCH, r = 8, o = {}) {
      const [wx, wz] = tw(x, z);
      lights.push({ x: wx, y, z: wz, rgb, r, flicker: o.flicker ?? 1, phase: Math.random() * 100 });
    },
    flame(x, y, z, size = .5, rgb = [1.8, .8, .3]) {
      const [wx, wz] = tw(x, z);
      flames.push([wx, y, wz, size, ...rgb, Math.random() * 100]);
    },
    torch(x, y, z, nx, nz, o = {}) {
      const rgb = o.rgb ?? TORCH;
      D.box(x - nx * .02, y - .55, z - nz * .02, .12, .7, .12, 'wood', { jit: .1 });
      D.box(x - nx * .08, y - .35, z - nz * .08, .18, .12, .18, 'iron', { jit: 0 });
      D.flame(x, y + .05, z, o.size ?? .55, rgb.map(c => c * 1.1));
      D.light(x + nx * .6, y, z + nz * .6, rgb, o.r ?? 8.5);
    },
    brazier(x, y, z, o = {}) {
      const rgb = o.rgb ?? TORCH;
      D.cyl(x, y, z, .18, .9, 'iron', { seg: 6 });
      D.cyl(x, y + .9, z, .35, .3, 'iron', { seg: 8, r1: .55 });
      D.flame(x, y + 1.25, z, o.size ?? 1.1, rgb.map(c => c * 1.1));
      D.light(x, y + 1.6, z, rgb, o.r ?? 11);
    },
    candle(x, y, z, o = {}) {
      D.cyl(x, y, z, .05, .25, 'bone', { seg: 5, jit: 0 });
      D.flame(x, y + .3, z, .18, o.rgb ?? [1.8, 1, .45]);
      if (o.light !== false) D.light(x, y + .4, z, o.rgb ?? [1.2, .75, .35], o.r ?? 3);
    },

    // A label floating at a world point. cls is a label class from ui.css. A 'quarter' label shows only near the camera.

    label(text, x, y, z, cls = 'district landmark under', color) {
      const [wx, wz] = tw(x, z), el = mkLabel(text, cls, new THREE.Vector3(wx, y - groundAt(wx, wz), wz), color);
      el.obj.visible = false; el.depth = y; el.sub = cls.includes('quarter');
      labels.push(el);
      return el;
    },

    // Run fn(t, dt) every frame while the layer shows.

    tick(fn) { ticks.push(fn); },

    // A material for a pack's own moving meshes. The town's clip hides every built-in material below a dungeon,
    // so meshes here must use this one, which keeps to the dungeon's own cut instead. It is unlit: colour times a
    // soft light from above, plus emissive. o: { emissive, opacity, additive, flat }.

    mat(color, o = {}) { return meshMaterial(color, o, cut, opts); },

    // Static geometry merged into the stone and lit by the torches: statues, bones, gold, anything three.js makes.
    // o: { at: [x, y, z], rot, scale, rgb, jit }. The geometry's own x, z follow the current frame.

    geo(g, mat = 'rock', o = {}) {
      const rgb = tint(mat, o.rgb, o.jit), m = MAT[mat] ?? mat, src = g.index ? g.toNonIndexed() : g;
      if (!src.attributes.normal) src.computeVertexNormals();
      const pos = src.attributes.position, nrm = src.attributes.normal, [ox, oy, oz] = o.at ?? [0, 0, 0], sc = o.scale ?? 1;
      const r = o.rot ?? 0, c = Math.cos(r), sn = Math.sin(r), base = P.length / 3;
      for (let i = 0; i < pos.count; i++) {
        const lx = pos.getX(i) * sc, lz = pos.getZ(i) * sc, nx = nrm.getX(i), nz = nrm.getZ(i);
        const [wx, wz] = tw(ox + lx * c + lz * sn, oz - lx * sn + lz * c), [wnx, wnz] = tn(nx * c + nz * sn, -nx * sn + nz * c);
        P.push(wx, oy + pos.getY(i) * sc, wz); N.push(wnx, nrm.getY(i), wnz); C.push(...rgb); M.push(m, 0); I.push(base + i);
      }
    },

    // Add a mesh made with D.mat to the layer.

    add(...o) { group.add(...o); return o[0]; },

    // The dungeon's cut: geometry above it is hidden. The layer eases it to each level's cut.

    cut,

    bake() { return bake(); },
  };

  // ---------- bake: light per vertex, the stone material and the flames ----------

  function bake() {
    const n = P.length / 3, Lf = new Float32Array(n * 3), Ls = new Float32Array(n * 3), cell = 10, grid = new Map();
    const key = (i, j, k) => `${i},${j},${k}`;
    for (const l of lights) {
      const r = Math.ceil(l.r / cell);
      const ci = Math.floor(l.x / cell), cj = Math.floor(l.y / cell), ck = Math.floor(l.z / cell);
      for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) for (let k = ck - r; k <= ck + r; k++) {
        const kk = key(i, j, k); (grid.get(kk) ?? grid.set(kk, []).get(kk)).push(l);
      }
    }
    const phase = new Float32Array(n);
    for (let v = 0; v < n; v++) {
      const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2], nx = N[v * 3], ny = N[v * 3 + 1], nz = N[v * 3 + 2];
      const near = grid.get(key(Math.floor(x / cell), Math.floor(y / cell), Math.floor(z / cell)));
      if (!near) continue;
      let best = 0;
      for (const l of near) {
        const dx = l.x - x, dy = l.y - y, dz = l.z - z, d = Math.hypot(dx, dy, dz);
        if (d >= l.r) continue;
        const face = Math.max(0, (dx * nx + dy * ny + dz * nz) / (d || 1)) * .85 + .15 * (d < 1.2), fall = (1 - d / l.r) ** 2 * face;
        if (fall <= 0) continue;
        const out = l.flicker ? Lf : Ls;
        out[v * 3] += l.rgb[0] * fall; out[v * 3 + 1] += l.rgb[1] * fall; out[v * 3 + 2] += l.rgb[2] * fall;
        if (l.flicker && fall > best) { best = fall; phase[v] = l.phase; }
      }
    }
    for (let v = 0; v < n; v++) if (M[v * 2 + 1] === 0) M[v * 2 + 1] = phase[v];

    // One draw per bounded chunk keeps every index under 2^32 and lets the GPU cull far chunks.

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    geo.setAttribute('aAlb', new THREE.Float32BufferAttribute(C, 3));
    geo.setAttribute('aMat', new THREE.Float32BufferAttribute(M, 2));
    geo.setAttribute('aLight', new THREE.BufferAttribute(Lf, 3));
    geo.setAttribute('aStill', new THREE.BufferAttribute(Ls, 3));
    geo.setIndex(I);
    geo.computeBoundingSphere();
    const stone = new THREE.Mesh(geo, stoneMaterial(opts, cut));
    stone.frustumCulled = false;
    group.add(stone);
    if (flames.length) group.add(flameMesh(flames, cut));
    group.userData.stats = { vertices: n, triangles: I.length / 3, lights: lights.length, flames: flames.length };
    return group.userData.stats;
  }

  // The layer module runs ticks and shows labels near the current clip.

  D.update = (t, dt, L) => {
    // The cut slides from just above the town, so a level opened from far up shows no stray parts on the way.

    if (cut.value > 120 && (L?.cut ?? 1e5) < 120) cut.value = 120;
    cut.value += ((L?.cut ?? 1e5) - cut.value) * Math.min(1, dt * 3);
    if (Math.abs(cut.value) > 9e4 && (L?.cut ?? 1e5) > 9e4) cut.value = 1e5;
    const [lo, hi] = L?.labels ?? [-1e5, 1e5];
    const near = (opts.nearLabels ?? 320) ** 2;
    for (const el of labels) el.obj.visible = el.depth > lo && el.depth < hi && (!el.sub || el.obj.position.distanceToSquared(camera.position) < near);
    for (const f of ticks) f(t, dt);
  };
  return D;
}

// ---------- shaders ----------

const NOISE = `
  float uh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float un(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(uh(i), uh(i + vec2(1, 0)), f.x), mix(uh(i + vec2(0, 1)), uh(i + vec2(1, 1)), f.x), f.y); }
  float ufbm(vec2 p) { return .5 * un(p) + .25 * un(p * 2.1) + .125 * un(p * 4.3) + .125 * un(p * 8.7); }
  vec2 ucell(vec2 p) { vec2 i = floor(p), f = fract(p); float d1 = 9., d2 = 9.;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(x, y), o = vec2(uh(i + g), uh(i + g + 7.1)) * .8 + .1;
      float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
    return vec2(d1, d2); }
  float joints(vec2 uv, vec2 size, float stagger, float mortar) {
    float row = floor(uv.y / size.y); vec2 q = vec2(uv.x / size.x + row * stagger, uv.y / size.y), f = fract(q);
    float e = min(min(f.x, 1. - f.x) * size.x, min(f.y, 1. - f.y) * size.y);
    return smoothstep(mortar * .5, mortar, e) * (.84 + .3 * uh(floor(q) + row * 3.1));
  }
`;

function stoneMaterial(opts, cut) {
  const amb = new THREE.Color(...(opts.ambient ?? [.07, .075, .09]));
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uAmb: { value: amb }, uCut: cut },
    side: THREE.DoubleSide,
    vertexShader: `
      attribute vec3 aAlb, aLight, aStill; attribute vec2 aMat;
      varying vec3 vAlb, vLight, vStill, vUW, vUN; varying vec2 vMat;
      void main() {
        vAlb = aAlb; vLight = aLight; vStill = aStill; vMat = aMat; vUW = position; vUN = normal;
        gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.);
      }`,
    fragmentShader: `
      uniform float uTime, uCut; uniform vec3 uAmb;
      varying vec3 vAlb, vLight, vStill, vUW, vUN; varying vec2 vMat;
      ${NOISE}
      void main() {
        if (vUW.y > uCut) discard;
        vec3 n = normalize(vUN), an = abs(n), w = vUW;
        vec2 uv = an.y > .7 ? w.xz : (an.x > an.z ? vec2(w.z, w.y) : vec2(w.x, w.y));
        int mt = int(vMat.x + .5);
        float pat = 1.;
        vec3 alb = vAlb;
        if (mt == 0) pat = an.y > .7 ? joints(uv, vec2(1.1, .8), .5, .06) : joints(uv, vec2(1.15, .5), .5, .05);
        else if (mt == 1 || mt == 8) { vec2 c = ucell(uv * (mt == 8 ? 3.2 : 1.9)); pat = smoothstep(.02, .12, c.y - c.x) * (.8 + .35 * uh(floor(uv * 3.))); }
        else if (mt == 2) pat = joints(uv, vec2(.42, .16), .5, .025);
        else if (mt == 3 || mt == 13) { pat = .62 + .62 * ufbm(uv * .9 + vec2(0., w.y * .3)) - .12 * smoothstep(.45, .5, fract(w.y * .9 + un(uv * .3))); if (mt == 13) alb = mix(alb, vec3(.12, .2, .07), smoothstep(.4, .75, ufbm(uv * 1.7))); }
        else if (mt == 4) pat = joints(uv, vec2(1.3, 1.3), .5, .07) * (.85 + .3 * un(uv * 4.));
        else if (mt == 5) pat = .7 + .5 * un(uv * 2.7) * un(uv * 9.);
        else if (mt == 6) pat = (.8 + .3 * un(vec2(uv.x * .6, uv.y * 14.))) * smoothstep(.0, .04, abs(fract(uv.y / .28) - .5) - .44);
        else if (mt == 7) pat = .85 + .3 * un(uv * 7.);
        else if (mt == 9) pat = .85 + 1.4 * pow(uh(floor(uv * 18.) + floor(uTime * 2.)), 18.);
        else if (mt == 12) pat = .9 + .15 * un(uv * 1.8);
        else if (mt == 14) pat = .8 + .3 * un(vec2(uv.x * 9., uv.y * .7));
        float blur = smoothstep(.04, .25, length(fwidth(uv)));
        pat = mix(pat, mt == 9 ? 1.1 : .9, blur);
        float ph = vMat.y, fl = .78 + .22 * (.5 + .5 * sin(uTime * 9.3 + ph)) * (.6 + .4 * sin(uTime * 23.7 + ph * 1.7));
        vec3 lit = uAmb * (.55 + .45 * max(n.y, 0.)) + vStill + vLight * fl;
        vec3 col = alb * pat * lit;
        if (mt == 10) {
          float r = un(w.xz * 1.3 + uTime * vec2(.31, .17)) + un(w.xz * 2.9 - uTime * vec2(.23, .41));
          col = alb * (.7 + .5 * r) + (vLight * fl + vStill) * (.12 + .45 * pow(r * .5, 3.));
        }
        if (mt == 11) col = alb * (ph < 0. ? 1. : .75 + .45 * sin(uTime * floor(ph / 1000.) * .6283 + fract(ph / 1000.) * 6.283));
        if (!gl_FrontFacing && mt != 11) col *= .22;
        gl_FragColor = vec4(col, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function meshMaterial(color, o, cut, opts) {
  const amb = new THREE.Color(...(opts.ambient ?? [.07, .075, .09]));
  return new THREE.ShaderMaterial({
    uniforms: { uCut: cut, uColor: { value: new THREE.Color(color) }, uEmit: { value: new THREE.Color(o.emissive ?? 0) }, uOpacity: { value: o.opacity ?? 1 }, uAmb: { value: amb }, uLift: { value: o.lift ?? .6 } },
    side: THREE.DoubleSide, transparent: (o.opacity ?? 1) < 1 || !!o.additive, depthWrite: !o.additive && (o.opacity ?? 1) >= 1,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: `
      varying vec3 vW, vN;
      #include <skinning_pars_vertex>
      void main() {
        vec3 transformed = position; vec3 objectNormal = normal;
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <skinning_vertex>
        vec4 w = modelMatrix * vec4(transformed, 1.);
        #ifdef USE_INSTANCING
          w = modelMatrix * instanceMatrix * vec4(transformed, 1.);
        #endif
        vW = w.xyz; vN = normalize(mat3(modelMatrix) * objectNormal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform float uCut, uOpacity, uLift; uniform vec3 uColor, uEmit, uAmb; varying vec3 vW, vN;
      void main() {
        if (vW.y > uCut) discard;
        vec3 c = uColor * (uAmb * 2. + uLift * (.5 + .5 * normalize(vN).y)) + uEmit;
        gl_FragColor = vec4(c, uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function flameMesh(list, cut) {
  const base = new THREE.PlaneGeometry(1, 1.6).translate(0, .6, 0), g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv;
  const at = new Float32Array(list.length * 4), col = new Float32Array(list.length * 4);
  list.forEach((f, i) => { at.set([f[0], f[1], f[2], f[3]], i * 4); col.set([f[4], f[5], f[6], f[7]], i * 4); });
  g.setAttribute('aAt', new THREE.InstancedBufferAttribute(at, 4));
  g.setAttribute('aCol', new THREE.InstancedBufferAttribute(col, 4));
  g.instanceCount = list.length;
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uCut: cut },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec4 aAt, aCol; uniform float uTime; varying vec2 vUv; varying vec4 vCol; varying float vY;
      void main() {
        vUv = uv; vCol = aCol;
        float s = aAt.w * (.9 + .15 * sin(uTime * 11. + aCol.w) + .08 * sin(uTime * 27. + aCol.w * 2.));
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 p = aAt.xyz + right * position.x * s + vec3(0., position.y * s, 0.);
        vY = aAt.y;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
      }`,
    fragmentShader: `
      uniform float uTime, uCut; varying vec2 vUv; varying vec4 vCol; varying float vY;
      ${NOISE}
      void main() {
        if (vY > uCut) discard;
        vec2 p = vUv - vec2(.5, .0);
        float t = uTime * 3. + vCol.w, sway = (un(vec2(vUv.y * 3. - t, vCol.w)) - .5) * .35 * vUv.y;
        p.x += sway;
        float wd = .32 * (1. - vUv.y) * smoothstep(0., .25, vUv.y) + .04, body = 1. - smoothstep(wd * .5, wd, abs(p.x));
        body *= 1. - smoothstep(.55, 1., vUv.y + un(vec2(p.x * 6., vUv.y * 4. - t * 1.6)) * .35);
        float core = 1. - smoothstep(.0, wd * .55, abs(p.x)); core *= smoothstep(.0, .1, vUv.y) * (1. - smoothstep(.2, .55, vUv.y));
        vec3 c = vCol.rgb * body + vec3(1.4, 1.25, .9) * core;
        if (body < .01) discard;
        gl_FragColor = vec4(c * body, 1.);
      }`,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  return mesh;
}
