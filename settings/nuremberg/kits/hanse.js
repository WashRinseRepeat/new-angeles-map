// Lorenz's house kits: Hanseatic brick Gothic after Lübeck and Stralsund. Tall narrow houses turn their gables to the
// street. The walls are red brick with bands of dark glazed brick, the gables carry white blind arches, and the roofs
// are dark glazed tile, red tile or green copper. Kit signature: (x, z, s, st, b, r) in the lot frame.

import { parts } from '../../emberford/kits/town.js';

import { HALF_PI, COPPER, WOOD, trees } from './common.js';

const BRICKS = [[.3, .07, .045], [.27, .07, .05], [.32, .1, .06], [.24, .065, .045], [.29, .09, .06]];
const GLAZED = [[.08, .065, .06], [.1, .07, .06], [.07, .07, .08]];
const GLAZE = [.05, .045, .045], WHITE = [.95, .93, .86], DARK = [.04, .035, .03], STONE = [.3, .29, .27], LAMP = [1, .66, .3];
const DOORS = [[.16, .1, .05], [.2, .12, .06], [.1, .13, .09], [.22, .07, .05]];
const tone = (c, k) => c.map(v => v * k);

// bld() draws its brightness from the first random number. A steady generator gives every part of one house the
// same brightness, so the brick reads as one wall.

const steady = (r, k) => { let first = true; return () => first ? (first = false, k) : r(); };

export function kits(H) {
  const { bld, prop, glow, SKINS } = H;
  const { strip, pick, yard } = parts(H);
  const { tree } = trees(H);
  const opt = o => ({ roof: false, kibble: false, ...o });
  const TILES = [[.1, .08, .075], [.09, .08, .08], [.12, .09, .08], [.34, .13, .07], [.22, .1, .06]];

  // A brick house in the lot's own axes: u runs along the street, v out toward it from the house's centre. The
  // options pick the floors, the gable profiles, one gable or two, an eaves roof for the back lanes, the glazed
  // facade, the hoist, the Beischlag terrace and what lies behind.

  function hanse(x, z, s, st, r, o) {
    const p = strip(x, z, s, o.depth[0] + r() * (o.depth[1] - o.depth[0]));
    const w = p.frontage, d = p.deep, fr = p.fr, face = Math.atan2(fr.x, fr.z), ry = p.ry, vf = d / 2;
    const ax = { x: Math.abs(fr.z), z: Math.abs(fr.x) };
    const at = (u, v) => [p.cx + ax.x * u + fr.x * v, p.cz + ax.z * u + fr.z * v];
    const block = (u, v, y0, bw, bd, h, [skin, base], more = {}, rr = r) => bld(...at(u, v), bw, bd, h, st, rr, opt({ y0, skin, base, ry, ...more }));
    const fbox = (u, v, y, sx, sy, sz, rgb) => { const [px, pz] = at(u, v); prop('box', px, y, pz, sx, sy, sz, rgb, face); };
    const cone = (u, v, y, sx, sy, sz, rgb) => { const [px, pz] = at(u, v); prop('cone', px, y, pz, sx, sy, sz, rgb, face); };
    const pane = (u, v, y, sx, sy) => { const [px, pz] = at(u, v); glow(px, y, pz, sx, sy, .04, LAMP, face); };

    // One brick, one band colour and one roof per house.

    const brick = pick(r, o.glazed ? GLAZED : BRICKS), k = r(), wallR = () => steady(r, k), brickC = tone(brick, .7 + .6 * k);
    const B = [SKINS.stone, brick], Bb = [SKINS.blindAshlar, brick];
    const roofM = r() < (o.copper ?? .06) ? [SKINS.slate, COPPER] : [SKINS.tiles, pick(r, TILES)], ridge = tone(roofM[1], .7);
    const band = o.glazed ? tone(pick(r, BRICKS), 1.2) : GLAZE, pinC = r() < .5 ? GLAZE : brickC, door = pick(r, DOORS);

    // A pointed arch flat on the street face: a panel under a flattened cone. It draws blind arches, doors and windows.

    const arch = (u, y0, h, bw, rgb = WHITE, v = vf + .03) => {
      const ah = Math.min(bw * .9, h * .4);
      fbox(u, v, y0 + (h - ah) / 2, bw, h - ah, .06, rgb);
      cone(u, v, y0 + h - ah / 2, bw, ah, .06, rgb);
    };

    // The tall Diele on the ground floor, then the upper floors, and dark glazed bands at each floor line.

    const gf = o.gf ?? 4.4 + r(), n = o.floors, fh = o.fh ?? 2.9 + r() * .3, top = gf + n * fh, lit = st.lit * (o.lit ?? 1);
    block(0, 0, 0, w, d, gf, o.diele === false ? B : Bb, { lit: lit * 1.2 }, wallR());
    if (n) block(0, 0, gf, w, d, n * fh, o.glazed ? Bb : B, { lit }, wallR());
    if (r() < (o.bands ?? .7)) for (let i = 0; i <= n; i++) fbox(0, vf + .03, gf + i * fh - .15, w, .3, .06, band);

    // A glazed facade sets its upper windows in tall white blind arches that run from the Diele to the gable.

    if (o.glazed && n) {
      const c = Math.max(2, Math.round(w / 2.6)), span = w - .6;
      for (let j = 0; j < c; j++) {
        const u = (j + .5 - c / 2) * span / c, bw = span / c - .45;
        arch(u, gf + .35, n * fh - .7, bw);
        for (let i = 0; i < n; i++) {
          fbox(u, vf + .07, gf + i * fh + 1.6, bw * .55, 1.4, .06, DARK);
          if (r() < .35) pane(u, vf + .11, gf + i * fh + 1.6, bw * .45, 1.2);
        }
      }
    }

    // A gable to the street: the roof, a plain brick gable at its back, and in front a brick screen that hides the
    // roof's end. The profiles are stepped, stepped with pinnacles, stepped with merlons, piers that rise above the
    // slope under pinnacles, and plain. Blind arches fill the screen, and a hoist serves loading doors up its middle.

    const gable = (u0, gw, kind) => {
      const rh = Math.min(gw * (o.pitch ?? 1.15 + r() * .35), 14), tri = u => rh * (1 - 2 * Math.abs(u) / gw), sv = vf - .3;
      const sl = { lit: lit * .3 };
      block(u0, -.25, top, d - .5, gw + .3, rh, roofM, { shape: 'gable', ry: ry + HALF_PI, lit: 0 });
      block(u0, .25 - vf, top, .6, gw, rh, B, { shape: 'gable', ry: ry + HALF_PI, ...sl }, wallR());
      fbox(u0, -.25, top + rh - .05, .3, .2, d - .5, ridge);
      let cols = 3 + 2 * (gw > 7.5), span = gw * .8, y0 = .6;
      if (kind === 'piers' || kind === 'plain') {
        block(u0, sv, top, .6, gw, rh, B, { shape: 'gable', ry: ry + HALF_PI, ...sl }, wallR());
        if (kind === 'plain') cols = 0;
        else {
          const m = gw > 7.5 ? 7 : 5;
          for (let i = 0; i < m; i++) {
            const u = (i / (m - 1) - .5) * (gw - .5), hp = tri(u) + 1.4;
            block(u0 + u, sv + .1, top, .5, .8, hp, B, { lit: 0 }, wallR());
            cone(u0 + u, sv + .1, top + hp + .45, .55, .9, .55, pinC);
          }
          cols = m - 1; span = gw - .5; y0 = .4;
        }
      } else {
        const steps = 4 + Math.floor(r() * 3), hs = rh / steps;
        for (let i = 0; i < steps; i++) {
          const sw = gw * (steps - i) / steps + .1;
          block(u0, sv, top + i * hs, sw, .6, hs, B, sl, wallR());
          if (i < steps - 1) for (const sg of [-1, 1]) {
            if (kind === 'pinnacle') cone(u0 + sg * (sw / 2 - .25), sv, top + (i + 1) * hs + .5, .5, 1, .5, pinC);
            if (kind === 'crenel') fbox(u0 + sg * (sw / 2 - .3), sv, top + (i + 1) * hs + .25, .5, .5, .6, brickC);
          }
        }
        if (kind === 'pinnacle') cone(u0, sv, top + rh + .8, .6, 1.6, .6, pinC);
        else fbox(u0, sv, top + rh + .35, .45, .7, .45, brickC);
      }
      for (let j = 0; j < cols; j++) {
        const uc = (j + .5 - cols / 2) * span / cols, bw = span / cols - .45, h = tri(Math.abs(uc) + bw / 2) - y0 - .5;
        if (h > 1.2) arch(u0 + uc, top + y0, h, bw);
      }
      if (rh > 7 && r() < (o.rose ?? 0)) {
        const [px, pz] = at(u0, vf + .25), [qx, qz] = at(u0, vf + .3), dia = Math.min(2, gw * .22);
        prop('cyl', px, top + rh * .62, pz, dia, .08, dia, WHITE, face, HALF_PI);
        prop('cyl', qx, top + rh * .62, qz, dia * .6, .08, dia * .6, DARK, face, HALF_PI);
      }
      if (r() < (o.hoist ?? .5)) {
        for (let y = 1; y < rh * .6 - 1.6; y += 2.4) fbox(u0, vf + .08, top + y + .8, 1, 1.6, .08, door);
        fbox(u0, vf + .6, top + rh * .72, .22, .22, 1.3, WOOD);
        if (o.loading) fbox(u0, vf + 1.15, top + rh * .72 - 1.6, .04, 3.2, .04, DARK);
      }
      return rh;
    };

    // The roof: eaves to the street over a back-lane house, often with a small stepped dormer gable, or one gable to
    // the street, or two side by side. A lot too wide for one gable takes two.

    let rh;
    const twin = o.twin || (!o.eaves && w > (o.maxGable ?? 11));
    if (o.eaves) {
      const D = d + .8;
      rh = Math.min(D * (.55 + r() * .15), 7);
      block(0, 0, top, w + .3, D, rh, roofM, { shape: 'gable', lit: 0 });
      fbox(0, 0, top + rh - .05, w + .3, .2, .3, ridge);
      if (w > 4.5 && r() < (o.dormer ?? 0)) {
        const zw = Math.min(3.4, w * .55), zh = 3 + r() * .6, hs = zh / 3;
        block(0, vf - 1.6, top - .1, 2.6, zw + .2, zh * .8, roofM, { shape: 'gable', ry: ry + HALF_PI, lit: 0 });
        for (let i = 0; i < 3; i++) block(0, vf - .3, top + i * hs, zw * (3 - i) / 3 + .1, .6, hs, B, { lit: lit * .3 }, wallR());
        fbox(0, vf + .06, top + .9, .9, 1.3, .08, door);
        if (r() < .5) arch(0, top + .3, zh - .9, zw * .6);
      }
    } else if (twin) {
      rh = Math.max(gable(-w / 4, w / 2, pick(r, o.gables)), gable(w / 4, w / 2, pick(r, o.gables)));
      fbox(0, vf + .08, top / 2, .5, top, .16, brickC);
    } else rh = gable(0, w, pick(r, o.gables));

    // Loading doors up the street face of a storehouse, under the gable's own.

    if (o.loading) for (const lu of w > 9 ? [-w / 4, w / 4] : [0]) {
      for (let i = 0; i < n; i++) fbox(lu, vf + .06, gf + i * fh + 1.1, 1.2, 1.7, .08, door);
    }

    // The street front: a pointed portal framed in glazed brick, tall pointed Diele windows, and a Beischlag terrace.

    const front = (u0, fw) => {
      const dw = 1.6 + r() * .4, du = u0 + (fw > 6 && r() < .5 ? (r() < .5 ? -1 : 1) * (fw / 2 - 1.6) : 0);
      const dh = Math.min(gf - .9, o.loading ? 3.6 : 3.3), wide = o.loading ? 1 : 0;
      arch(du, 0, dh + .4, dw + .6 + wide, GLAZE, vf + .02);
      arch(du, 0, dh, dw + wide, door, vf + .05);
      if (o.windows === false) return;
      const m = Math.min(4, Math.max(1, Math.floor(fw / 2.3))), wh = gf - 1.8;
      for (let i = 0; i < m; i++) {
        const u = u0 + (i + .5 - m / 2) * fw / m;
        if (Math.abs(u - du) < dw / 2 + .7) continue;
        arch(u, 1, wh, .95, DARK, vf + .05);
        if (r() < .4) pane(u, vf + .09, 1 + wh * .4, .7, wh * .6);
      }
    };
    if (twin) { front(-w / 4, w / 2); front(w / 4, w / 2); } else front(0, w);
    if (r() < (o.beischlag ?? 0)) {
      fbox(0, vf + .7, .15, w * .7, .3, 1.2, STONE);
      for (const sg of [-1, 1]) fbox(sg * w * .35, vf + .7, .6, .35, .9, 1.2, STONE);
    }

    // A tall brick chimney beside the ridge.

    if (r() < .7) {
      const ch = rh * .4 + 1.3, uc = (twin ? (r() < .5 ? -1 : 1) * w / 4 : 0) + (r() < .5 ? -.6 : .6);
      fbox(uc, (r() - .5) * d * .5, top + rh * .6 + ch / 2, .7, ch, .7, tone(brickC, .8));
    }

    // Behind: a merchant's side wing along one edge of the yard, a back house across a court, or the yard.

    const behind = 2 * p.back + .5;
    if (o.wing && p.back > 5) {
      const ww = Math.min(4.2, w * .45), L = Math.min(behind - 1.5, 16), side = r() < .5 ? -1 : 1, wh = gf + Math.max(0, n - 1) * fh;
      const u = side * (w / 2 - ww / 2), v = -d / 2 - L / 2;
      block(u, v, 0, ww, L, wh, B, { lit: lit * .8 }, wallR());
      block(u, v, wh, L + .4, ww + .4, ww * .9, roofM, { shape: 'gable', ry: ry + HALF_PI, lit: 0 });
      if (w - ww > 3.5 && r() < .6) tree(...at(-side * ww / 2, -d / 2 - L / 2), r, 'fruit');
    } else if (p.back > 4.5 && r() < (o.back ?? .3)) {
      const hd = Math.min(behind - 5.5, 9), hh = 3.1 * (1 + (r() < .5)), vb = -d / 2 - behind + hd / 2 + .2;
      block(0, vb, 0, w, hd, hh, B, { lit: lit * .7 }, wallR());
      block(0, vb, hh, w + .4, hd + .6, Math.min(w, hd) * .8, roofM, { shape: 'gable', lit: 0 });
      const court = behind - hd - .2;
      if (r() < (o.tree ?? .3)) tree(...at((r() - .5) * Math.max(0, w - 4), -d / 2 - court / 2), r, court > 8 ? undefined : 'fruit');
    } else {
      yard(p, x, z, s, st, r);
      if (p.back > 3 && r() < (o.tree ?? .3)) tree(...at((r() - .5) * Math.max(0, w - 3), -d / 2 - p.back - .25), r);
    }
  }

  const STEPS = ['stepped', 'stepped', 'pinnacle', 'crenel', 'piers'];
  return {

    // The classic gable house: two or three floors over a tall Diele, under a stepped, pinnacled, crenellated or
    // piered gable.

    hs_gable(x, z, s, st, b, r) {
      hanse(x, z, s, st, r, { depth: [10, 14], floors: 2 + (r() < .5), gables: STEPS, hoist: .5, beischlag: .3, back: .4, tree: .3 });
    },

    // A merchant's house: very tall and as wide as its lot, under a rich gable with a rose window, a Beischlag
    // terrace in front and a side wing down the yard.

    hs_merchant(x, z, s, st, b, r) {
      hanse(x, z, s, st, r, { depth: [13, 17], floors: 3 + (r() < .4), gf: 5 + r() * .8, gables: ['piers', 'pinnacle', 'crenel'],
        maxGable: 15, rose: .7, hoist: .8, beischlag: .8, wing: true, copper: .2 });
    },

    // Two narrow gables side by side over one house, each with its own profile and door.

    hs_twin(x, z, s, st, b, r) {
      hanse(x, z, s, st, r, { twin: true, depth: [10, 13], floors: 2 + (r() < .3), gables: STEPS, hoist: .4, back: .3, tree: .3 });
    },

    // A facade of dark glazed brick, its windows set in white blind arches, under a piered gable with red bands.

    hs_glazed(x, z, s, st, b, r) {
      hanse(x, z, s, st, r, { glazed: true, depth: [11, 14], floors: 2 + (r() < .5), gables: ['piers', 'piers', 'pinnacle'],
        rose: .6, bands: 1, hoist: .3, beischlag: .4, back: .4, copper: .12 });
    },

    // A low house for the back lanes, its eaves to the street, often with a small stepped dormer gable.

    hs_small(x, z, s, st, b, r) {
      hanse(x, z, s, st, r, { eaves: true, depth: [7, 9], floors: r() < .4 ? 1 : 0, gf: 3 + r() * .4, fh: 2.7, diele: false,
        windows: false, dormer: .55, bands: .3, tree: .45 });
    },

    // A storehouse: tall and plain, with loading doors stacked up its front, a hoist at the top and a cart door.

    hs_warehouse(x, z, s, st, b, r) {
      hanse(x, z, s, st, r, { depth: [13, 18], floors: 3 + (r() < .4), gf: 3.6 + r() * .4, fh: 2.6, gables: ['plain', 'stepped', 'stepped'],
        pitch: 1.05 + r() * .25, maxGable: 14, hoist: 1, loading: true, windows: false, lit: .35, bands: .25, back: .2 });
    },
  };
}

export function landmarks(H) { return {}; }
