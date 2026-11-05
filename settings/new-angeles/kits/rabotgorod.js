// Rabotgorod: a dark, even chequerboard of Soviet barracks slabs, fortress cubes and clone-tels, tied together by gangplanks.
// Stalingrad on the Manta border turns to grey warehouse rows. Chone ("Green Valley") in the south is a bright lime-and-white island.
// Kit signature: (x, z, s, st, b, r) in the lot frame. Kits read H.frame() and fall back to an s × s square.

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function kits(H) {
  const { SKINS, beacon, beam, bld, glow, pool, prop, puff, stringLights, textSign } = H;
  const { pick, dims, look, hgt, area, PALE, WARM, BLUE, RED, MERC, LIME, BOXES } = common(H);

  // Mercury lamp over a door, with its green-white pool.

  const lamp = (x, z, y = 3.2) => { glow(x, y, z, .6, .25, .6, MERC); pool(x, z, 5, MERC.map(c => c * .1)); };

  // Rooftop water tanks and lift-motor housings on a slab.

  const tanks = (x, z, w, d, y, r) => {
    for (let k = 1 + Math.floor(r() * 2); k > 0; k--) {
      const px = x + (r() - .5) * (w - 4), pz = z + (r() - .5) * (d - 4);
      prop('cyl', px, y + 2, pz, 3, 3, 3, [.07, .06, .05]);
    }
    prop('box', x + (r() - .5) * w * .5, y + 1.5, z + (r() - .5) * d * .5, 4, 3, 3.5, [.06, .058, .055]);
  };

  // Gangplank between two points at one height, with a dim strip light under it.

  const plank = (a, c, r, lit = r() < .4) => {
    beam(a, c, .25, [.06, .05, .04]);
    beam([a[0], a[1] + 1, a[2]], [c[0], c[1] + 1, c[2]], .08, [.05, .05, .05]);
    if (lit) beam([a[0], a[1] - .25, a[2]], [c[0], c[1] - .25, c[2]], .08, PALE.map(v => v * .35), 'glow');
  };

  // Long thin panel slab with a regular window grid.

  const slab = (x, z, w, d, h, st, r, o = {}) => {
    bld(x, z, w, d, h, look(st, r, o.lit ?? .07), r, { skin: SKINS.grid, roof: false, ...o });
    tanks(x, z, w, d, h, r);
  };

  const K = {
    // Soviet panel slab, one or two in parallel, with a stair core and a painted block number.

    rab_monobloc(x, z, s, st, b, r) {
      const [W, D] = dims(s), along = W >= D, L = (along ? W : D) - 2, S = along ? D : W;
      const n = S > 30 ? 2 : 1, t = Math.min(13, S / n - 3), h = hgt(30, 44, b, r);
      for (let k = 0; k < n; k++) {
        const v = (k + .5) * S / n - S / 2, px = along ? x : x + v, pz = along ? z + v : z;
        slab(px, pz, along ? L : t, along ? t : L, h * (.95 + .1 * r()), st, r, { lit: .07 });
        const side = k ? 1 : -1, fx = along ? px : px + side * (t / 2 + .3), fz = along ? pz + side * (t / 2 + .3) : pz;
        if (r() < .55) glow(fx, h / 2, fz, along ? 1.4 : .2, h - 6, along ? .2 : 1.4, PALE.map(c => c * .22));
        lamp(fx, fz);
      }
      if (r() < .35) {
        const e = L / 2 + .3, ex = along ? x + e : x, ez = along ? z : z + e;
        textSign(pick(r, ['БЛОК 0853', 'БЛОК 0417', 'БЛОК 1120', 'БЛОК 0291']), ex, h - 6, ez, 9, 2.2, along ? Math.PI / 2 : 0, RED.map(c => c * .45));
      }
    },

    // Fortress cube: a squat block of few windows round a dark central light-well.

    rab_fortcube(x, z, s, st, b, r) {
      const [W, D] = dims(s), c = Math.min(W, D, 42) - 1, h = hgt(38, 52, b, r), well = c * .34, t = (c - well) / 2;
      const ls = look(st, r, .06);
      for (const g of [-1, 1]) {
        bld(x, z + g * (well + t) / 2, c, t, h, ls, r, { skin: SKINS.sparse, roof: false });
        bld(x + g * (well + t) / 2, z, t, well, h, ls, r, { skin: SKINS.sparse, roof: false });
      }
      pool(x, z, well * .5, WARM.map(v => v * .08));
      for (let y = 6; y < h - 4; y += 9) if (r() < .4) glow(x + (r() < .5 ? -1 : 1) * (well / 2 - .1), y, z + (r() - .5) * well * .6, .1, 1.2, 2.5, WARM.map(v => v * .4));
      if (r() < .3) {
        const cs = c * (.4 + .15 * r()), q = (c - cs) / 2 * (r() < .5 ? -1 : 1);
        bld(x + q, z - q, cs, cs, 6 + r() * 6, look(st, r, .05), r, { y0: h, skin: SKINS.sparse });
      }
      if (r() < .5) { prop('cyl', x + c / 2 - 3, h + 7, z + c / 2 - 3, .3, 14, .3, [.1, .1, .1]); beacon(x + c / 2 - 3, h + 14.3, z + c / 2 - 3, r); }
      lamp(x, z + c / 2 + .5);
    },

    // Point block: a lone panel tower of 20 to 30 floors over the barracks, shorter on a narrow lot, with a lit stair strip, a lift
    // housing, a red-lit mast and a slogan across the roof.

    rab_pointblock(x, z, s, st, b, r) {
      const [W, D] = dims(s), c = Math.min(W, D, 24) - 2, h = hgt(72, 104, b, r) * Math.min(1, .45 + c / 36), ls = look(st, r, .09);
      bld(x, z, c, c, h, ls, r, { skin: SKINS.grid, roof: false });
      glow(x, h / 2, z + c / 2 + .1, 1.6, h - 8, .2, PALE.map(v => v * .28));
      bld(x - c * .2, z, c * .4, c * .5, 6, look(st, r, .03), r, { y0: h, skin: SKINS.sparse, roof: false });
      prop('cyl', x + c * .25, h + 12, z - c * .25, .5, 24, .5, [.1, .1, .1]);
      for (let y = h + 8; y <= h + 24; y += 8) glow(x + c * .25, y, z - c * .25, .5, .4, .5, RED.map(v => v * .8));
      textSign(pick(r, ['СЛАВА ТРУДУ', 'МИР ТРУД', 'РАБОТА ЖДЁТ']), x, h + 3, z + c / 2 + .3, c - 2, 3, 0, RED.map(v => v * .6));
      if (r() < .5) puff(x - c * .2, h + 9, z, 5, [.07, .07, .075]);
      lamp(x, z + c / 2 + 2);
    },

    // Bent slab: two tall panel wings meeting at a corner stair tower, linked high up by a gangplank.

    rab_bentslab(x, z, s, st, b, r) {
      const [W, D] = dims(s), t = Math.min(13, Math.min(W, D) * .3), h = hgt(54, 68, b, r);
      const ax = x - W / 2 + 1 + t / 2, az = z - D / 2 + 1 + t / 2;
      slab(x, az, W - 2, t, h, st, r, { lit: .08 });
      slab(ax, z + t / 2, t, D - 2 - t, h * (.9 + .1 * r()), st, r, { lit: .08 });
      bld(ax, az, t + 2, t + 2, h + 8, look(st, r, .04), r, { skin: SKINS.sparse, roof: false });
      glow(ax + t / 2 + 1.1, (h + 8) / 2, az, .2, h, 1.2, PALE.map(v => v * .25));
      plank([x + W / 2 - 4, h * .7, az + t / 2], [ax + t / 2, h * .7, z + D / 2 - 4], r, true);
      lamp(x, az + t / 2 + 1.5);
    },

    // Gangplank web: three slabs strung together with planks, ladders, cage lifts and a few bulbs.

    rab_bridgeweb(x, z, s, st, b, r) {
      const [W, D] = dims(s), along = W >= D, L = (along ? W : D) - 2, S = (along ? D : W) - 2;
      const n = S > 34 ? 3 : 2, gap = 6 + r() * 3, t = (S - gap * (n - 1)) / n, base = hgt(28, 40, b, r);
      const at = (u, v, y) => along ? [x + u, y, z + v] : [x + v, y, z + u];
      const hs = [];
      for (let k = 0; k < n; k++) {
        const v = -S / 2 + t / 2 + k * (t + gap), h = base * (.9 + .2 * r()), [px, , pz] = at(0, v, 0);
        slab(px, pz, along ? L : t, along ? t : L, h, st, r, { lit: .12 });
        hs.push({ v, h });
      }
      for (let k = 0; k + 1 < n; k++) {
        const a = hs[k].v + t / 2, c = hs[k + 1].v - t / 2, mid = (a + c) / 2;
        for (let q = 3 + Math.floor(r() * 3); q > 0; q--) {
          const fl = 2 + Math.floor(r() * 10), y = fl * 3.2, u = (r() - .5) * (L - 6);
          if (y > Math.min(hs[k].h, hs[k + 1].h) - 3) continue;
          plank(at(u, a, y), at(u + (r() - .5) * 6, c, y - (r() < .3 ? 3.2 : 0)), r);
        }
        if (r() < .7) {
          const u = (r() - .5) * (L - 8), y = Math.min(hs[k].h, hs[k + 1].h) * (.4 + .4 * r()), [lx, , lz] = at(u, mid, 0);
          prop('lattice', lx, y / 2, lz, 2.4, y, 2.4);
          const cy = 2 + r() * (y - 5), [cx, , cz] = at(u, mid, 0);
          glow(cx, cy, cz, 1.6, 2.2, 1.6, WARM.map(c => c * .5));
        }
        for (const side of [a, c]) if (r() < .5) {
          const u = (r() - .5) * (L - 4), top = 6 + r() * 20;
          beam(at(u - .3, side + Math.sign(mid - side) * .4, 0), at(u - .3, side + Math.sign(mid - side) * .4, top), .1, [.08, .07, .06]);
          beam(at(u + .3, side + Math.sign(mid - side) * .4, 0), at(u + .3, side + Math.sign(mid - side) * .4, top), .1, [.08, .07, .06]);
        }
        if (r() < .5) { const y = 8 + r() * 10; stringLights(at(-L / 3, a, y), at(L / 3, c, y), 1.5, 6, WARM.map(c => c * .6)); }
      }
      { const [lx, , lz] = at(0, S / 2 + .5, 0); lamp(lx, lz); }
    },

    // Clone-tel: a grimy SafePod box with rows of soft blue bunk-light slits.

    rab_clonetel(x, z, s, st, b, r) {
      const [W, D] = dims(s), w = Math.min(W - 2, 44), d = Math.min(D - 2, 26), h = hgt(15, 24, b, r);
      bld(x, z, w, d, h, { ...look(st, r, .02), base: [.2, .205, .2] }, r, { skin: SKINS.sparse });
      for (const g of [-1, 1]) for (let y = 3.4; y < h - 1.5; y += 2.6) {
        if (r() < .25) continue;
        const seg = w * (.25 + .5 * r()), u = (r() - .5) * (w - seg), v = .35 + .3 * r();
        glow(x + u, y, z + g * (d / 2 + .06), seg, .35, .1, BLUE.map(c => c * v));
      }
      textSign(pick(r, ['SAFEPOD 54A', 'SAFEPOD 12', 'SAFEPOD 7C']), x, h - 2.2, z + d / 2 + .15, 10, 2.5, 0, BLUE.map(c => c * .7));
      glow(x, 1.6, z + d / 2 + .1, 4, 3, .2, BLUE.map(c => c * .4));
      pool(x, z + d / 2 + 4, 6, BLUE.map(c => c * .06));
    },

    // SafePod pod tower on a big lot, 20 to 32 m wide. A lot too small for it gets a plain clone-tel.

    rab_podtower(x, z, s, st, b, r) {
      const [W, D] = dims(s);
      return W < 27 || D < 19 ? K.rab_clonetel(x, z, s, st, b, r) : podtower(H, x, z, st, r, Math.min(32, W - 7));
    },

    // Burned-out tenement shell: no light, a broken roof line and charred beams.

    rab_husk(x, z, s, st, b, r) {
      const [W, D] = dims(s), w = Math.min(W - 2, 40), d = Math.min(D - 2, 16 + r() * 8), h = hgt(20, 34, b, r);
      const ash = [.03, .027, .024];
      bld(x, z, w, d, h, { ...st, base: ash, lit: 0, grime: 1 }, r, { skin: SKINS.grid, roof: false });
      for (let k = 3 + Math.floor(r() * 4); k > 0; k--) {
        const bw = 3 + r() * 8, u = (r() - .5) * (w - bw), g = r() < .5 ? -1 : 1, bh = 1 + r() * 6;
        prop('box', x + u, h + bh / 2, z + g * (d / 2 - .4), bw, bh, .8, ash);
      }
      for (let k = 2 + Math.floor(r() * 3); k > 0; k--) {
        const u = (r() - .5) * w * .8;
        beam([x + u, h - 4, z - d / 2 + 1], [x + u + (r() - .5) * 6, h + 2 + r() * 4, z + d / 2 - 1], .5, [.04, .03, .025]);
      }
      if (r() < .35) glow(x + (r() - .5) * w * .7, 2 + r() * h * .5, z + d / 2 + .05, 1.2, .8, .1, [.6, .14, .03]);
      if (r() < .4) puff(x, h + 6, z, 6, [.06, .06, .065]);
      for (let k = 2 + Math.floor(r() * 3); k > 0; k--) prop('box', x + (r() - .5) * w, .8, z + d / 2 + 2 + r() * 3, 2 + r() * 3, 1.6, 2 + r() * 2, ash, r() * 3);
    },

    // Bioroid storage: a windowless warehouse with cold vents and an android loading door.

    rab_podstore(x, z, s, st, b, r) {
      const [W, D] = dims(s), w = Math.min(W - 2, 50), d = Math.min(D - 2, 34), h = hgt(12, 18, b, r);
      bld(x, z, w, d, h, { ...st, base: [.075, .085, .095], lit: 0, grime: .7 }, r, { skin: SKINS.sparse, roof: false });
      for (let k = 2 + Math.floor(r() * 3); k > 0; k--) {
        const px = x + (r() - .5) * (w - 6), pz = z + (r() - .5) * (d - 6);
        prop('cyl', px, h + 1.2, pz, 2.2, 2.4, 2.2, [.09, .095, .1]);
        glow(px, h + 2.5, pz, 1.6, .15, 1.6, BLUE.map(c => c * .3));
        if (r() < .5) puff(px, h + 5, pz, 3, [.08, .1, .12]);
      }
      glow(x, 3, z + d / 2 + .1, 8, 5.5, .2, BLUE.map(c => c * .35));
      if (r() < .6) textSign(pick(r, ['BIOROID DEPOT', 'HB STORAGE 9', 'U-STOR']), x, h - 2.5, z + d / 2 + .15, 12, 3, 0, BLUE.map(c => c * .8));
      pool(x, z + d / 2 + 5, 7, BLUE.map(c => c * .07));
    },

    // Stalingrad: grey, straight-lined warehouse sheds with loading bays and container stacks.

    rab_warehouse(x, z, s, st, b, r) {
      const [W, D] = dims(s), along = W >= D, L = (along ? W : D) - 2, S = (along ? D : W) - 2;
      const t = Math.min(S * .6, 30), h = 10 + r() * 6, v = -S / 2 + t / 2;
      const bx = along ? x : x + v, bz = along ? z + v : z;
      bld(bx, bz, along ? L : t, along ? t : L, h, { ...st, base: [.13, .13, .13], lit: .04, grime: .9 }, r, { skin: SKINS.bands });
      for (let u = -L / 2 + 5; u < L / 2 - 3; u += 8) {
        const fx = along ? x + u : bx + t / 2 + .2, fz = along ? bz + t / 2 + .2 : z + u;
        prop('box', fx, 2.5, fz, along ? 5 : .2, 5, along ? .2 : 5, [.04, .04, .045]);
        if (r() < .3) glow(fx, 5.6, fz, along ? 3 : .3, .25, along ? .3 : 3, MERC.map(c => c * .6));
      }
      const yd = S - t - 2, yv = v + t / 2 + 1 + yd / 2;
      for (let k = Math.floor(yd / 3); k > 0 && yd > 3; k--) {
        const u = (r() - .5) * (L - 8), q = (r() - .5) * Math.max(0, yd - 3), n = 1 + Math.floor(r() * 3);
        for (let j = 0; j < n; j++) {
          const cx = along ? x + u : x + yv + q, cz = along ? z + yv + q : z + u;
          prop('box', cx, 1.3 + j * 2.6, cz, along ? 6 : 2.5, 2.5, along ? 2.5 : 6, pick(r, BOXES));
        }
      }
      lamp(along ? x : x + S / 2, along ? z + S / 2 : z, 6);
    },

    // Yard: the lots the blocs leave bare. A container yard with a gantry crane, container homes stacked two or three
    // high that never moved on, or rows of prefab huts. Stalingrad leans to containers. Everything stays under 9 m,
    // so a yard under a highway or the maglev keeps clear of the deck.

    rab_yard(x, z, s, st, b, r) {
      const [W, D] = dims(s), along = W >= D, L = (along ? W : D) - 2, S = (along ? D : W) - 2;
      const at = (u, v) => along ? [x + u, z + v] : [x + v, z + u];
      const box = (u, y, v, l, h, t, rgb) => { const [px, pz] = at(u, v); prop('box', px, y, pz, along ? l : t, h, along ? t : l, rgb); };
      const gl = (u, y, v, l, h, t, rgb) => { const [px, pz] = at(u, v); glow(px, y, pz, along ? l : t, h, along ? t : l, rgb); };
      const ground = (rgb) => prop('box', x, .1, z, W, .2, D, rgb);
      const kind = r() < (area(x, z) === 'Stalingrad' ? .6 : .3) ? 'yard' : r() < .65 ? 'homes' : 'huts';

      if (kind === 'yard') {
        ground([.05, .048, .045]);
        for (let v = -S / 2 + 2; v < S / 2 - 2; v += 3.2) for (let u = -L / 2 + 4; u < L / 2 - 4; u += 6.6) {
          if (r() < .15) continue;
          const n = 1 + Math.floor(r() * 3);
          for (let j = 0; j < n; j++) box(u, 1.3 + j * 2.6, v, 6.2, 2.5, 2.5, pick(r, BOXES));
        }
        if (L > 20) {
          const g = (r() - .5) * L * .4, GY = 8.6, CR = [.45, .3, .06];
          for (const sv of [-1, 1]) {
            const [ax, az] = at(g - 1.5, sv * (S / 2 - .5)), [bx, bz] = at(g + 1.5, sv * (S / 2 - .5));
            beam([ax, 0, az], [ax, GY, az], .4, CR); beam([bx, 0, bz], [bx, GY, bz], .4, CR);
          }
          for (const du of [-1.5, 1.5]) { const [ax, az] = at(g + du, -S / 2), [bx, bz] = at(g + du, S / 2); beam([ax, GY, az], [bx, GY, bz], .5, CR); }
          gl(g, GY - .6, (r() - .5) * S * .6, 1.6, .3, 1.6, [1.5, 1.3, .9]);
        }
        lamp(...at(L / 2 - 1, S / 2 - 1), 8);
        return;
      }

      if (kind === 'homes') {

        // Container homes: stacks two or three high along both long edges, a lane between, stairs, lit windows and
        // laundry over the lane.

        ground([.045, .04, .038]);
        const COL = [[.22, .12, .07], [.08, .12, .16], [.18, .16, .08], [.1, .13, .09], [.16, .16, .15], [.2, .08, .06]];
        for (const sv of [-1, 1]) for (let u = -L / 2 + 3.4; u < L / 2 - 3; u += 6.6) {
          const v = sv * (S / 2 - 2), n = 2 + Math.floor(r() * 2);
          for (let j = 0; j < n; j++) {
            box(u, 1.3 + j * 2.6, v, 6.2, 2.5, 2.5, pick(r, COL));
            if (r() < .55) gl(u + (r() - .5) * 3, 1.5 + j * 2.6, v - sv * 1.27, .9, .8, .04, r() < .75 ? WARM.map(c => c * .8) : PALE.map(c => c * .6));
          }
          if (r() < .4) box(u, 2.6 * n + .15, v, 6.6, .12, 3, [.12, .14, .16]);
          if (r() < .3) { const [sx, sz] = at(u + 2.6, v - sv * 2); beam([sx, 0, sz], [sx + (along ? 1.6 : 0), 2.6, sz + (along ? 0 : 1.6)], .7, [.1, .1, .1]); }
        }
        for (let u = -L / 2 + 6; u < L / 2 - 4; u += 9) if (r() < .5) {
          const [ax, az] = at(u, -S / 2 + 3.3), [bx, bz] = at(u + 2, S / 2 - 3.3);
          stringLights([ax, 4.4, az], [bx, 4.4, bz], .5, 6, r() < .5 ? WARM.map(c => c * .5) : [.5, .45, .4]);
        }
        lamp(...at(0, 0), 3.4);
        return;
      }

      // Prefab huts: low long barracks in rows with warm windows, corrugated roofs and a water tank.

      ground([.05, .045, .04]);
      for (let v = -S / 2 + 3; v < S / 2 - 2.5; v += 7) {
        const hl = Math.min(L - 4, 14 + r() * 10), u = (r() - .5) * (L - 4 - hl);
        box(u, 1.6, v, hl, 3.2, 5, pick(r, BOXES).map(c => c * 1.2));
        box(u, 3.35, v, hl + .4, .3, 5.6, [.1, .1, .1]);
        for (let k = -hl / 2 + 1.5; k < hl / 2 - 1; k += 3) if (r() < .5) gl(u + k, 1.8, v + 2.53, .8, .7, .04, WARM.map(c => c * .7));
      }
      const [tx, tz] = at(L / 2 - 3, -S / 2 + 3);
      prop('cyl', tx, 4.5, tz, 3, 3, 3, [.07, .06, .05]);
      for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) prop('cyl', tx + a, 1.5, tz + c, .2, 3, .2, [.06, .06, .06]);
      lamp(...at(-L / 2 + 2, S / 2 - 1), 3.6);
    },

    // Chone / Green Valley: bright white housing blocks on a deck, lime slidewalks and bioplastic trees.

    rab_greenvalley(x, z, s, st, b, r) {
      const [W, D] = dims(s), along = W >= D, L = (along ? W : D) - 2, S = (along ? D : W) - 2;
      const deck = 12, gs = { ...st, base: [.105, .11, .1], win: [1, .9, .74], lit: .16, grime: .05 };
      prop('box', x, deck - .5, z, W - 2, 1, D - 2, [.18, .19, .17]);
      bld(x, z, W - 3, D - 3, deck - 1, { ...gs, lit: .3 }, r, { skin: SKINS.bands, roof: false });
      const n = L > 40 ? 2 : 1, tw = Math.min(S - 4, 18), tl = Math.min(L / n - 6, 22), tops = [];
      for (let k = 0; k < n; k++) {
        const u = (k + .5) * L / n - L / 2, px = along ? x + u : x, pz = along ? z : z + u, h = 40 + r() * 25;
        bld(px, pz, along ? tl : tw, along ? tw : tl, h, gs, r, { y0: deck, skin: SKINS.curtain });
        tops.push([px, deck, pz]);
      }
      if (n === 2) {
        const [a, c] = tops, y = deck + 9 + r() * 10;
        beam([a[0], y, a[2]], [c[0], y, c[2]], 2.4, [.3, .32, .3]);
        beam([a[0], y - 1.35, a[2]], [c[0], y - 1.35, c[2]], .25, LIME.map(v => v * .7), 'glow');
      }
      for (const g of [-1, 1]) glow(along ? x : x + g * (W / 2 - 1), deck + .1, along ? z + g * (D / 2 - 1) : z, along ? W - 4 : .3, .12, along ? .3 : D - 4, LIME.map(v => v * .6));
      for (let k = 2 + Math.floor(r() * 4); k > 0; k--) {
        const px = x + (r() - .5) * (W - 6), pz = z + (r() - .5) * (D - 6);
        prop('cyl', px, deck + 1.5, pz, .4, 3, .4, [.2, .2, .18]);
        H.put(H.GLOWS.sphere, px, deck + 4, pz, 3.6, 3, 3.6, 0, 0, LIME.map(v => v * .35));
      }
      if (r() < .5) textSign('GREEN VALLEY', x, deck + 3, z + D / 2 - .8, 12, 3, 0, LIME);
      pool(x, z + D / 2 + 3, 8, [.08, .14, .06]);
    },
  };

  // Barracks kits give way to the sub-area's own kit in Chone and Stalingrad.

  const route = { Chone: K.rab_greenvalley, Stalingrad: K.rab_warehouse };
  for (const name of ['rab_monobloc', 'rab_fortcube', 'rab_bridgeweb', 'rab_husk', 'rab_clonetel', 'rab_podstore', 'rab_podtower']) {
    const f = K[name];
    K[name] = (x, z, s, st, b, r) => {
      const g = route[area(x, z)];
      return g && r() < .75 ? g(x, z, s, st, b, r) : f(x, z, s, st, b, r);
    };
  }
  return K;
}

// Shared palette, frame and sub-area helpers for lot kits, block kits and landmarks.

function common(H) {
  const { lerp } = H;
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const dims = s => { const f = H.frame(); return f?.w ? [Math.min(f.w - 2, 60), Math.min(f.d - 2, 60)] : [s, s]; };
  const CONC = [[.09, .085, .08], [.1, .092, .082], [.075, .074, .078], [.11, .1, .088], [.085, .08, .07]];
  const PALE = [.82, .9, .78], WARM = [1, .7, .35], BLUE = [.25, .55, 1.4], RED = [1.4, .12, .1], MURAL = [1.3, .9, .2];
  const MERC = [.62, .78, .7], LIME = [.6, 1.4, .35];
  const BOXES = [[.2, .07, .05], [.06, .1, .16], [.16, .13, .05], [.07, .12, .08], [.13, .13, .13], [.08, .08, .1]];

  // Northern blocs near Laguna Velasco are a little cleaner and better lit.

  const rich = st => st.mix?.find(m => m[0] === 'laguna-velasco')?.[1] ?? 0;
  const look = (st, r, lit = .07) => ({
    ...st, grime: lerp(.85, .5, rich(st)),
    base: pick(r, CONC).map(c => c * (.85 + .3 * r())),
    win: r() < .3 ? WARM : PALE,
    lit: lit * (.6 + .8 * r()) + .12 * rich(st),
  });

  // Height with a clamped boost keeps the grid even.

  const hgt = (lo, hi, b, r) => (lo + (hi - lo) * r()) * Math.min(1.2, Math.max(.9, b));

  // Sub-area under a lot: the nearest Rabotgorod circle within 1.8 radii, else The Blocs. Null in the showcase.

  const AREAS = (H.CITY.subareas ?? []).filter(a => a.district === 'rabotgorod');
  const area = (x, z) => {
    if (!H.frame()) return null;
    let best = 'The Blocs', bd = 1.8;
    for (const a of AREAS) { const q = Math.hypot(x - a.at[0], z - a.at[1]) / a.r; if (q < bd) { bd = q; best = a.name; } }
    return best;
  };
  // A flat box from point a to point b, wide across and thick deep. Stair flights use it.

  const ramp = (a, b, wide, thick, rgb) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
    if (L > .01) H.prop('box', (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, wide, thick, L, rgb, Math.atan2(dx, dz), -Math.asin(dy / L));
  };
  return { pick, dims, look, hgt, area, ramp, CONC, PALE, WARM, BLUE, RED, MURAL, MERC, LIME, BOXES };
}

// SafePod 9's canon point. Generic pod towers keep 170 m clear of it, so the landmark stays the only clone-tel there.

const SP9 = [597, 973];
const nearNine = (x, z) => Math.hypot(x - (SP9[0] - 680) * 3.6, z - (SP9[1] - 390) * 3.6) < 170;

// A view of H that turns everything it places by angle a round (x0, z0), so a kit built facing +z can face any way.
// A quarter turn swaps a building's width and depth.

function turn(H, x0, z0, a) {
  const c = Math.cos(a), s = Math.sin(a), q = Math.round(a / (Math.PI / 2)) % 2 !== 0;
  const X = (x, z) => x0 + (x - x0) * c + (z - z0) * s, Z = (x, z) => z0 - (x - x0) * s + (z - z0) * c;
  const pt = p => [X(p[0], p[2]), p[1], Z(p[0], p[2])];
  return {
    ...H,
    prop: (k, x, y, z, sx, sy, sz, rgb, ry = 0, rx = 0) => H.prop(k, X(x, z), y, Z(x, z), sx, sy, sz, rgb, ry + a, rx),
    glow: (x, y, z, sx, sy, sz, rgb, ry = 0) => H.glow(X(x, z), y, Z(x, z), sx, sy, sz, rgb, ry + a),
    bld: (x, z, w, d, ...o) => H.bld(X(x, z), Z(x, z), q ? d : w, q ? w : d, ...o),
    beam: (p, b, ...o) => H.beam(pt(p), pt(b), ...o),
    textSign: (t, x, y, z, w, h, ry, rgb) => H.textSign(t, X(x, z), y, Z(x, z), w, h, ry + a, rgb),
    pool: (x, z, ...o) => H.pool(X(x, z), Z(x, z), ...o),
    puff: (x, y, z, ...o) => H.puff(X(x, z), y, Z(x, z), ...o),
    beacon: (x, y, z, r) => H.beacon(X(x, z), y, Z(x, z), r),
  };
}

// SafePod pod tower: a grimy capsule slab with open galleries on the front, an external stair at one end
// and an open lift shaft on the outside. Lot kits and The Blocs block kits share it. The footprint is (W + 7) m across
// and runs from z - 9 to z + 9. Angle a turns it: π faces -z, π / 2 faces +x.

function podtower(H, x, z, st, r, W = 32, a = 0) {
  if (a) H = turn(H, x, z, a);
  const { SKINS, beacon, beam, bld, glow, pool, prop, puff, textSign } = H;
  const { pick, ramp, PALE, BLUE, MERC } = common(H);
  x -= 2.5;
  const D = 12, N = 12 + Math.floor(r() * 5), P = 3.2, B = 6, top = B + N * P, tz = z - 3, zf = tz + D / 2, GD = 2.2;
  const grim = { ...st, base: [.2, .205, .2], win: BLUE, lit: .02, grime: .95 };
  const STEEL = [.07, .068, .065], RAIL = [.16, .15, .13], DARK = [.035, .033, .03];
  bld(x, tz, W, D, B, { ...grim, lit: .1 }, r, { roof: false, kibble: false, skin: SKINS.sparse });
  bld(x, tz, W, D, top - B, grim, r, { y0: B, roof: false, kibble: false, skin: SKINS.sparse });
  prop('box', x, top + .3, tz, W + .6, .6, D + .6, [.1, .1, .095]);

  // Capsule hatches on the gallery face, about half lit blue or white. Rows of bunk slits on the back and ends.

  for (let i = 0; i < N; i++) {
    const y = B + i * P;
    for (let u = -W / 2 + 1.4; u < W / 2 - 1; u += 1.8) {
      const q = r();
      glow(x + u, y + 1.4, zf + .06, 1.2, 1.2, .08, q < .3 ? BLUE.map(c => c * (.4 + .4 * r())) : q < .5 ? PALE.map(c => c * .5) : DARK);
    }
    for (const yy of [y + .9, y + 2.3]) {
      if (r() < .2) continue;
      const seg = W * (.3 + .55 * r()), u = (r() - .5) * (W - seg);
      glow(x + u, yy, tz - D / 2 - .06, seg, .35, .1, BLUE.map(c => c * (.3 + .3 * r())));
      for (const g of [-1, 1]) if (r() < .6) glow(x + g * (W / 2 + .06), yy, tz + (r() - .5) * 6, .1, .35, 4 + r() * 4, BLUE.map(c => c * (.25 + .3 * r())));
    }
  }

  // Rust streaks down the back wall.

  for (let k = 0; k < 14; k++) { const h = 6 + r() * 20; prop('box', x + (r() - .5) * (W - 2), B + r() * (top - B - h) + h / 2, tz - D / 2 - .05, .4 + r() * .8, h, .06, [.07, .045, .03]); }

  // Open galleries on every floor, with posts, two rails and a dim strip under the slab. They run on to the stair.

  const gx0 = x - W / 2, gx1 = x + W / 2 + 5, rz = zf + GD - .1;
  for (let i = 0; i < N; i++) {
    const y = B + i * P;
    prop('box', (gx0 + gx1) / 2, y - .15, zf + GD / 2, gx1 - gx0, .3, GD, STEEL);
    glow((gx0 + gx1) / 2, y - .34, zf + GD - .3, gx1 - gx0 - 1, .06, .12, PALE.map(c => c * .25));
    for (const h of [.55, 1.1]) beam([gx0, y + h, rz], [gx1, y + h, rz], .07, RAIL);
    for (let u = gx0; u <= gx1 + .01; u += 2.4) prop('box', u, y + .55, rz, .08, 1.1, .08, RAIL);
    if (i % 2) glow(gx0 + 6 + r() * (W - 12), y + 2.7, zf + .3, .6, .25, .4, MERC);
  }

  // External stair at the east end: switchback flights between front landings at gallery level and back half-landings.

  const sx = x + W / 2 + 2.5, zb = zf - 6, zl = zf + 1.1;
  for (const [px, pz] of [[sx - 2.3, zb - 1], [sx + 2.3, zb - 1], [sx - 2.3, zf + GD], [sx + 2.3, zf + GD]]) prop('box', px, top / 2 + 1, pz, .35, top + 2, .35, STEEL);
  for (let i = 0; i <= N; i++) {
    const y = i * P + (i ? B - P : 0);
    prop('box', sx, y - .1, zl, 4.6, .2, GD, STEEL);
    if (i === N) break;
    const y1 = y, y2 = B + i * P, ym = (y1 + y2) / 2;
    prop('box', sx, ym - .1, zb, 4.6, .2, 2, STEEL);
    ramp([sx - 1.15, y1, zl - 1.1], [sx - 1.15, ym, zb + 1], 2.1, .2, STEEL);
    ramp([sx + 1.15, ym, zb + 1], [sx + 1.15, y2, zl - 1.1], 2.1, .2, STEEL);
    beam([sx + 2.25, ym + 1, zb + 1], [sx + 2.25, y2 + 1, zl - 1.1], .06, RAIL);
    beam([sx - 2.25, y1 + 1, zl - 1.1], [sx - 2.25, ym + 1, zb + 1], .06, RAIL);
    if (i % 3 === 1) glow(sx + 2.3, ym + 2, zb - .8, .4, .25, .4, MERC);
  }

  // Open lift shaft in front of the galleries at the west end, with its lit car stopped at a random floor.

  const ex = x - W / 2 + 4.5, ez = zf + GD + 1.8, eh = top + 4;
  for (const [px, pz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) prop('box', ex + px, eh / 2, ez + pz, .22, eh, .22, STEEL);
  for (let y = B; y < eh; y += P) for (const g of [-1, 1]) beam([ex - 1.6, y, ez + g * 1.6], [ex + 1.6, y, ez + g * 1.6], .12, STEEL);
  for (let i = 0; i < N; i++) glow(ex - 1.7, B + i * P + 2.6, ez - 1.6, .12, .3, .12, [.5, .9, .5]);
  prop('box', ex, eh + 1.2, ez, 3.8, 2.4, 3.8, [.09, .088, .085]);
  const cy = B + Math.floor(r() * N) * P + 1.5;
  for (const dy of [-1.4, 1.4]) prop('box', ex, cy + dy, ez, 2.9, .3, 2.9, [.12, .12, .12]);
  glow(ex, cy, ez, 2.5, 2.5, 2.5, [.9, 1.05, 1.25]);

  // Lobby with a blue door, a SAFEPOD number over it and a bright sign on the roof.

  glow(x + 4, 1.8, zf + .08, 5, 3.4, .12, BLUE.map(c => c * .6));
  pool(x + 4, zf + 6, 8, BLUE.map(c => c * .1));
  pool(ex, ez + 2, 6, [.12, .14, .16]);
  textSign(pick(r, ['SAFEPOD 4', 'SAFEPOD 12', 'SAFEPOD 31', 'SAFEPOD 7C', 'SAFEPOD 22', 'SAFEPOD 54A']), x + 4, 4.7, zf + GD + .2, 9, 1.8, 0, PALE.map(c => c * .8));
  prop('box', x, top + 4.5, zf - .4, W - 8, 5, .4, DARK);
  for (const g of [-1, 1]) prop('box', x + g * (W / 2 - 6), top + 2, zf - 1, .3, 4, .3, STEEL);
  textSign(pick(r, ['CLONE-TEL', 'SAFEPOD', 'CLONE-TEL 24H']), x, top + 4.5, zf - .15, W - 10, 4.4, 0, BLUE.map(c => c * 1.3));
  textSign('КЛОН-ОТЕЛЬ', x - W / 2 - .15, top - 8, tz, 10, 2.4, -Math.PI / 2, [1.4, .12, .1].map(c => c * .6));

  // Rooftop clutter: tanks, plant boxes, a dish, vents with steam and a mast with the aviation light.

  for (const [u, v] of [[W / 4, -2], [W * .375, 2]]) prop('cyl', x + u, top + 2, tz + v, 3, 3.4, 3, [.07, .06, .05]);
  for (let k = 0; k < 5; k++) prop('box', x - W * .375 + r() * W * .6, top + 1, tz - 3 + r() * 3, 2 + r() * 2, 1.2 + r(), 1.5 + r(), [.06 + .03 * r(), .058, .055]);
  prop('dish', x + 2, top + 1, tz - 3, 3, 3, 3, [.2, .2, .2]);
  for (let k = 0; k < 3; k++) puff(x - W / 4 + k * W / 5, top + 3 + r() * 2, tz - 2, 2 + r() * 1.5, [.1, .11, .12]);
  beam([x + W / 2 - 2, top, tz - 4], [x + W / 2 - 2, top + 12, tz - 4], .2, STEEL);
  beacon(x + W / 2 - 2, top + 12.5, tz - 4, r);
  glow(x - W / 4, 3.2, zf + GD + .2, .6, .25, .6, MERC);
  pool(x - W / 4, zf + 5, 5, MERC.map(c => c * .1));
}

export const tiers = {
  rabotgorod: {
    0: ['rab_monobloc', 'rab_monobloc', 'rab_monobloc', 'rab_fortcube', 'rab_fortcube', 'rab_husk', 'rab_husk', 'rab_clonetel', 'rab_podstore', 'rab_bridgeweb', 'rab_bentslab',
      'rab_pointblock', 'rab_podtower'],
    1: ['rab_monobloc', 'rab_monobloc', 'rab_monobloc', 'rab_bridgeweb', 'rab_bridgeweb', 'rab_fortcube', 'rab_fortcube', 'rab_clonetel', 'rab_clonetel', 'rab_husk', 'rab_podstore',
      'rab_bentslab', 'rab_bentslab', 'rab_pointblock', 'rab_podtower'],
    2: ['rab_monobloc', 'rab_monobloc', 'rab_bridgeweb', 'rab_bridgeweb', 'rab_bridgeweb', 'rab_fortcube', 'rab_fortcube', 'rab_clonetel', 'rab_husk',
      'rab_bentslab', 'rab_bentslab', 'rab_pointblock', 'rab_pointblock', 'rab_podtower'],
  },
};

// Block kits fill a whole Rabotgorod block. Each one follows the sub-area, so Stalingrad and Chone keep their look.

export function blocks(H) {
  const { SKINS, beam, bld, glow, pool, prop, puff, put, GLOWS, textSign } = H;
  const { pick, look, area, PALE, WARM, MERC, LIME, BOXES } = common(H);

  const plank = (a, c, lit) => {
    beam(a, c, .25, [.06, .05, .04]);
    if (lit) beam([a[0], a[1] - .25, a[2]], [c[0], c[1] - .25, c[2]], .08, PALE.map(v => v * .35), 'glow');
  };

  // Mikrorayon: three or four parallel slabs round dark courtyards, a gangplank web and a boiler chimney.

  const mikrorayon = (x, z, w, d, st, r) => {
    const along = w >= d, L = along ? w : d, S = along ? d : w;
    const at = (u, v, y = 0) => along ? [x + u, y, z + v] : [x + v, y, z + u];
    prop('box', x, .1, z, w, .2, d, [.03, .029, .028]);
    const n = Math.max(2, Math.min(4, Math.floor(S / 24))), t = 12, step = (S - t) / (n - 1), base = 32 + r() * 10, hs = [];

    // In about a quarter of yards a SafePod tower takes the front slab's place, set back 3 m to stay on the block
    // and shifted along it to clear the boiler house.

    const pod = L >= 42 && step >= 25 && !nearNine(x, z) && r() < .25;
    for (let k = 0; k < n; k++) {
      const v = -S / 2 + t / 2 + k * step, h = base * (.95 + .1 * r()), [px, , pz] = at(0, v), ln = L * (.78 + .12 * r());
      if (pod && k === n - 1) {
        const [qx, , qz] = at(-6.5, v - 3);
        podtower(H, qx, qz, st, r, Math.min(32, L - 22, ln - 7), along ? 0 : Math.PI / 2);
        hs.push({ v, h: 0, ln, pod });
        continue;
      }
      const dead = r() < .12;
      bld(px, pz, along ? ln : t, along ? t : ln, h, dead ? { ...st, base: [.03, .027, .024], lit: 0, grime: 1 } : look(st, r, .07), r, { skin: SKINS.grid, roof: !dead });
      hs.push({ v, h, ln, dead });
    }
    for (let k = 0; k + 1 < n; k++) {
      if (hs[k + 1].pod) continue;
      const a = hs[k].v + t / 2, c = hs[k + 1].v - t / 2, top = Math.min(hs[k].h, hs[k + 1].h) - 4;
      for (let q = 3 + Math.floor(r() * 3); q > 0; q--) {
        const y = (2 + Math.floor(r() * 10)) * 3.2, u = (r() - .5) * Math.min(hs[k].ln, hs[k + 1].ln) * .8;
        if (y < top) plank(at(u, a, y), at(u + (r() - .5) * 8, c, y), r() < .35);
      }
      for (let q = 2; q > 0; q--) {
        const [px, , pz] = at((r() - .5) * L * .6, (a + c) / 2);
        glow(px, 4, pz, .5, .3, .5, MERC);
        pool(px, pz, 7, MERC.map(c => c * .09));
      }
    }

    // Boiler house and chimney at one end, with a steam plume.

    const [bx, , bz] = at(L / 2 - 8, (r() - .5) * S * .4), ch = 46 + r() * 14;
    bld(bx, bz, 10, 10, 8, look(st, r, .05), r, { skin: SKINS.sparse });
    bld(bx, bz, 3.4, 3.4, ch, { ...st, base: [.12, .07, .05], lit: 0, grime: .9 }, r, { shape: 'cyl', roof: false });
    glow(bx, ch - 3, bz, 3.6, .4, 3.6, [1.2, .1, .08]);
    for (let k = 0; k < 5; k++) puff(bx + k * 2.5, ch + 3 + k * 4, bz + k, 3 + k * 1.4, [.09, .09, .1]);
  };

  // Tochki: four to six point towers of 25 to 34 floors on a dark yard, each with a roof slogan and a red mast.

  const tochki = (x, z, w, d, st, r) => {
    prop('box', x, .1, z, w, .2, d, [.03, .029, .028]);
    const nx = w > 90 ? 3 : 2, nz = d > 70 ? 2 : 1, c = 17;

    // About 40% of yards swap one tower for a SafePod tower, its galleries out to the nearest street. A wide cell
    // takes it facing ±z, a narrow deep cell turned to face ±x.

    const cw = w / nx, cd = d / nz, wide = cw >= 32, swap = (wide || cw >= 19 && cd >= 32) && !nearNine(x, z) && r() < .4 ? Math.floor(r() * nx * nz) : -1;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const px = x + (i - (nx - 1) / 2) * w / nx, pz = z + (j - (nz - 1) / 2) * d / nz;
      if (i * nz + j === swap) { podtower(H, px, pz, st, r, Math.min(32, (wide ? cw : cd) - 12), wide ? (nz > 1 && !j ? Math.PI : 0) : i < nx / 2 ? -Math.PI / 2 : Math.PI / 2); continue; }
      const h = 80 + r() * 30;
      bld(px, pz, c, c, h, look(st, r, .09), r, { skin: SKINS.grid, roof: false });
      glow(px, h / 2, pz + c / 2 + .1, 1.6, h - 8, .2, PALE.map(v => v * .28));
      bld(px - 3, pz, 7, 8, 6, look(st, r, .03), r, { y0: h, skin: SKINS.sparse, roof: false });
      prop('cyl', px + 4, h + 12, pz - 4, .5, 24, .5, [.1, .1, .1]);
      for (let y = h + 8; y <= h + 24; y += 8) glow(px + 4, y, pz - 4, .5, .4, .5, [1.4, .12, .1].map(v => v * .8));
      if (r() < .6) textSign(pick(r, ['СЛАВА ТРУДУ', 'МИР ТРУД', 'РАБОТА ЖДЁТ']), px, h + 3, pz + c / 2 + .3, c - 2, 3, 0, [.84, .07, .06]);
      glow(px, 3.2, pz + c / 2 + 1, .6, .25, .6, MERC);
      pool(px, pz + c / 2 + 3, 8, MERC.map(v => v * .1));
    }
  };

  // Scrapper's Square: a block of rubble and burned shells round a bare concrete lot.

  const burned = (x, z, w, d, st, r) => {
    const ash = { ...st, base: [.03, .027, .024], lit: 0, grime: 1 };
    prop('box', x, .1, z, w, .2, d, [.06, .058, .055]);
    for (const g of [-1, 1]) {
      bld(x + g * (w / 2 - 8), z, 14, d * .7, 18 + r() * 14, ash, r, { skin: SKINS.grid, roof: false });
      for (let k = 0; k < 3; k++) beam([x + g * (w / 2 - 8), 20, z + (r() - .5) * d * .5], [x + g * (w / 2 - 12), 26 + r() * 6, z + (r() - .5) * d * .6], .6, [.04, .03, .025]);
    }
    for (let k = 10 + Math.floor(r() * 8); k > 0; k--) prop('box', x + (r() - .5) * w * .6, .6, z + (r() - .5) * d * .8, 1.5 + r() * 4, 1.2 + r() * 1.2, 1.5 + r() * 3, [.05 + .03 * r(), .045, .04], r() * 3);
    textSign('SCRAPPER’S SQUARE', x - w / 2 + 15.2, 6, z, 14, 3, Math.PI / 2, [1.3, .9, .2].map(c => c * .4));
    for (let k = 0; k < 3; k++) { const px = x + (r() - .5) * w * .4, pz = z + (r() - .5) * d * .5; glow(px, .8, pz, .6, .6, .6, [1.4, .5, .1]); pool(px, pz, 4, [.12, .05, .01]); }
  };

  // Stalingrad yard: three long grey sheds, loading bays, container stacks and a gantry.

  const stalingrad = (x, z, w, d, st, r) => {
    const along = w >= d, L = along ? w : d, S = along ? d : w;
    const at = (u, v, y = 0) => along ? [x + u, y, z + v] : [x + v, y, z + u];
    prop('box', x, .1, z, w, .2, d, [.05, .05, .052]);
    const n = S > 70 ? 3 : 2, t = Math.min(22, S / n - 8);
    for (let k = 0; k < n; k++) {
      const v = -S / 2 + t / 2 + 2 + k * (S - t - 4) / (n - 1), [px, , pz] = at(-L * .1, v), ln = L * .72, h = 11 + r() * 5;
      bld(px, pz, along ? ln : t, along ? t : ln, h, { ...st, base: [.13, .13, .13], lit: .04, grime: .9 }, r, { skin: SKINS.bands });
      for (let u = -ln / 2 + 5; u < ln / 2 - 3; u += 9) if (r() < .35) {
        const [fx, , fz] = at(-L * .1 + u, v + t / 2 + .3);
        glow(fx, 5.6, fz, along ? 3 : .3, .25, along ? .3 : 3, MERC.map(c => c * .6));
      }
    }
    for (let k = 18 + Math.floor(r() * 10); k > 0; k--) {
      const [cx, , cz] = at(L / 2 - 6 - r() * 10, (r() - .5) * (S - 8)), m = 1 + Math.floor(r() * 4);
      for (let j = 0; j < m; j++) prop('box', cx, 1.3 + j * 2.6, cz, along ? 2.5 : 6, 2.5, along ? 6 : 2.5, pick(r, BOXES));
    }
    const gu = L / 2 - 11, [g1x, , g1z] = at(gu, -S / 2 + 3), [g2x, , g2z] = at(gu, S / 2 - 3);
    for (const [gx, gz] of [[g1x, g1z], [g2x, g2z]]) prop('box', gx, 9, gz, 1.2, 18, 1.2, [.2, .15, .04]);
    beam([g1x, 18, g1z], [g2x, 18, g2z], 1.4, [.2, .15, .04]);
    glow((g1x + g2x) / 2, 17, (g1z + g2z) / 2, 1, .4, 1, [1.4, .5, .1]);
    if (r() < .5) textSign(pick(r, ['WAREHOUSE 413', 'СКЛАД 7', 'MANTA FISH 22']), ...at(-L * .1, -S / 2 - .3, 8), 12, 3, along ? Math.PI : -Math.PI / 2, MERC);
  };

  // Green Valley block: four white towers on a podium deck, linked by lime slidewalks.

  const greenvalley = (x, z, w, d, st, r) => {
    const deck = 14, gs = { ...st, base: [.105, .11, .1], win: [1, .9, .74], lit: .16, grime: .05 };
    bld(x, z, w - 2, d - 2, deck, { ...gs, lit: .3 }, r, { skin: SKINS.bands, roof: false });
    const ox = w / 4, oz = d / 4, tw = Math.min(w, d) * .28, tops = [];
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const px = x + sx * ox, pz = z + sz * oz, h = 50 + r() * 28;
      bld(px, pz, tw, tw, h, gs, r, { y0: deck, skin: SKINS.curtain });
      tops.push([px, pz]);
    }
    for (let k = 0; k < 4; k++) {
      const [ax, az] = tops[k], [cx, cz] = tops[(k + 1) % 4], y = deck + 10 + (k % 2) * 8;
      beam([ax, y, az], [cx, y, cz], 2.4, [.3, .32, .3]);
      beam([ax, y - 1.35, az], [cx, y - 1.35, cz], .25, LIME.map(v => v * .8), 'glow');
    }
    for (let k = 10 + Math.floor(r() * 6); k > 0; k--) {
      const px = x + (r() - .5) * (w - 8), pz = z + (r() - .5) * (d - 8);
      prop('cyl', px, deck + 1.5, pz, .4, 3, .4, [.2, .2, .18]);
      put(GLOWS.sphere, px, deck + 4, pz, 3.6, 3, 3.6, 0, 0, LIME.map(v => v * .35));
    }
    prop('box', x, deck + .1, z, w * .5, .2, d * .5, [.06, .2, .05]);
    for (const g of [-1, 1]) glow(x, deck + .3, z + g * (d / 2 - 1), w - 4, .15, .3, LIME.map(v => v * .6));
    textSign('GREEN VALLEY', x, deck - 3, z + d / 2 - .8, 16, 4, 0, LIME);
  };

  // Pod yard: one or two rows of SafePod towers on a dark yard, galleries out to the streets. The back row is mirrored,
  // and towers keep at least 12 m apart. A block too small for one, or near SafePod 9, gets the alt kit.

  const podyard = (x, z, w, d, st, r, alt = mikrorayon) => {
    const nx = w >= 64 ? 2 : w >= 27 ? 1 : 0, nz = d >= 48 ? 2 : d >= 19 ? 1 : 0;
    if (!nx || !nz || nearNine(x, z)) return alt(x, z, w, d, st, r);
    prop('box', x, .1, z, w, .2, d, [.03, .029, .028]);
    const W = Math.min(32, w / nx - (nx > 1 ? 12 : 7)), v = d / 2 - 9;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) podtower(H, x + (i - (nx - 1) / 2) * w / nx, z + (j ? -v : v), st, r, W, j ? Math.PI : 0);
  };

  // In the showcase each kit builds its own look; in the city the sub-area decides.

  const pickBy = own => (x, z, w, d, st, r) => {
    const a = area(x, z);
    const k = r(), f = a === 'Stalingrad' ? (k > .7 ? (...o) => podyard(...o, stalingrad) : stalingrad) : a === 'Chone' ? greenvalley : a ? (k < .08 ? burned : k < .28 ? tochki : k < .48 ? podyard : mikrorayon) : own;
    f(x, z, w, d, st, r);
  };
  return {
    rab_mikrorayon: { zone: 'rabotgorod', build: pickBy(mikrorayon) },
    rab_stalingrad: { zone: 'rabotgorod', build: pickBy(stalingrad) },
    rab_greenblock: { zone: 'rabotgorod', build: pickBy(greenvalley) },
    rab_scrapper: { zone: 'rabotgorod', build: pickBy(burned) },
    rab_tochki: { zone: 'rabotgorod', build: pickBy(tochki) },
  };
}

// Landmarks: the lone Atsuzawa supertall, Saint Olesya's gold domes, the Big Hole and the Workers' Wall.

export function landmarks(H) {
  const { THREE, SKINS, beacon, beam, bld, glow, pool, prop, puff, put, GLOWS, textSign } = H;
  const { look, ramp, MERC, WARM, BLUE, PALE } = common(H);

  // Atsuzawa Arcology: three tapering octagonal shafts in a triangle, sky bridges, halo rings and a spire.

  const atsuzawa = (x, z, w, d, st, r) => {
    const glass = { ...st, base: [.05, .06, .075], win: [1, .86, .6], lit: .2, grime: .1 };
    const TOP = 660;
    bld(x, z, Math.min(w, 64), Math.min(d, 64), 22, { ...glass, lit: .3 }, r, { skin: SKINS.bands, roof: false });
    const shafts = [[0, -13, TOP], [11.3, 6.5, TOP * .84], [-11.3, 6.5, TOP * .7]];
    for (const [sx, sz, top] of shafts) {
      let y = 22, dia = 24;
      while (y < top) {
        const seg = Math.min(70, top - y);
        bld(x + sx, z + sz, dia, dia, seg, glass, r, { y0: y, shape: 'oct', roof: false, skin: SKINS.curtain });
        glow(x + sx, y + seg, z + sz, dia * .95, .5, dia * .95, [.9, .8, .55]);
        y += seg; dia *= .9;
      }
      const ox = sx * 1.05, oz = sz * 1.05;
      glow(x + ox + Math.sign(sx || 1) * 6, (22 + top) / 2, z + oz + Math.sign(sz) * 6, .35, top - 30, .35, [1, 1.05, 1.2].map(c => c * .5));
      put(GLOWS.sphere, x + sx, top + 3, z + sz, 5, 5, 5, 0, 0, [1.8, 1.5, 1]);
    }
    for (let y = 90; y < TOP * .7; y += 80) {
      for (let k = 0; k < 3; k++) {
        const [ax, az] = shafts[k], [cx, cz] = shafts[(k + 1) % 3];
        bld((ax + cx) / 2 + x, (az + cz) / 2 + z, 6, Math.hypot(cx - ax, cz - az), 5, { ...glass, lit: .7 }, r, { y0: y, roof: false, skin: SKINS.bands, ry: Math.atan2(cx - ax, cz - az) });
      }
      put(GLOWS.ring, x, y + 8, z, 70, 1, 70, 0, 0, [1, .85, .5].map(c => c * .55));
    }
    bld(x, z - 13, 4, 4, 90, { ...glass, lit: 0 }, r, { y0: TOP, shape: 'pyr', roof: false });
    for (let k = 0; k < 3; k++) beacon(x, TOP + 30 + k * 28, z - 13, r);

    // Glimmer: fixed-size points scattered over the shafts read at any distance.

    const pts = [];
    for (const [sx, sz, top] of shafts) for (let k = 0; k < 500; k++) {
      const y = 22 + r() * (top - 22), a = r() * Math.PI * 2, rad = 12 * .9 ** ((y - 22) / 70);
      pts.push(sx + Math.cos(a) * rad, y, sz + Math.sin(a) * rad);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    H.decor.add(new THREE.Points(g, new THREE.PointsMaterial({ color: new THREE.Color(1.3, 1.1, .75), size: 1.6, sizeAttenuation: false, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false })));
    pool(x, z, 40, [.12, .1, .07]);
    textSign('ATSUZAWA', x, 16, z + Math.min(d, 64) / 2 + .3, 26, 6, 0, [1.4, 1.2, .8]);
  };

  // Saint Olesya: a white cathedral with a great gold onion on a windowed drum, four corner domes,
  // an apse, a tented bell tower, and arcades round a forecourt on local +z.

  const olesya = (x, z, w, d, st, r) => {
    const white = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: .85, emissive: 0x2e2a22 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd9a62a, roughness: .3, metalness: .85, emissive: 0x5a3a08 });
    const onion = new THREE.LatheGeometry([[0, 0], [.75, .1], [1, .45], [.9, .85], [.5, 1.25], [.15, 1.6], [.05, 1.9], [0, 2]].map(([a, b]) => new THREE.Vector2(a, b)), 24);
    const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 24), tent = new THREE.ConeGeometry(1, 1, 8);
    const cap = new THREE.SphereGeometry(1, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const archZ = cyl.clone().rotateX(Math.PI / 2), archX = cyl.clone().rotateZ(Math.PI / 2);
    const W = [], G = [];
    const add = (arr, geo, u, y, v, sx, sy = sx, sz = sx, rz = 0) => arr.push(geo.clone().scale(sx, sy, sz).rotateZ(rz).translate(u, y, v));

    // The design is 66 × 84 m and shrinks to fit a smaller block.

    const k = Math.min(1, (w - 2) / 66, (d - 2) / 84);
    const gl = (u, y, v, sx, sy, sz, c, ry = 0) => glow(x + u * k, y * k, z + v * k, sx * k, sy * k, sz * k, c, ry);
    const pr = (u, y, v, sx, sy, sz, c) => prop('box', x + u * k, y * k, z + v * k, sx * k, sy * k, sz * k, c);
    const cross = (u, y, v, s) => {
      add(G, box, u, y, v, .12 * s, 2 * s, .12 * s);
      add(G, box, u, y + .5 * s, v, .9 * s, .1 * s, .1 * s);
      add(G, box, u, y - .55 * s, v, .6 * s, .1 * s, .1 * s, .35);
    };
    const B = 1.5, z0 = -10, T = B + 22, WIN = WARM.map(c => c * .6), ICON = [1.7, 1.15, .45];

    // Platform, naos, cornice and the kokoshnik gables on all four walls.

    add(W, box, 0, B / 2, z0 - 2, 46, B, 50);
    add(W, box, 0, B + 11, z0, 36, 22, 36);
    add(G, box, 0, T, z0, 37, .6, 37);
    add(W, box, 0, T + 1, z0, 33, 2, 33);
    for (const o of [-12, 0, 12]) {
      for (const g of [-1, 1]) {
        add(W, archZ, o, T, z0 + g * 17.6, 5.6, 5.6, 1);
        add(W, archX, 17.6 * g, T, z0 + o, 1, 5.6, 5.6);
      }
    }

    // Central drum and the great onion.

    add(W, cyl, 0, T + 10, z0, 8, 16, 8);
    add(G, cyl, 0, T + 18, z0, 8.5, .8, 8.5);
    add(G, onion, 0, T + 18, z0, 12);
    cross(0, T + 46, z0, 4);
    for (let q = 0; q < 8; q++) {
      const a = (q + .5) / 8 * Math.PI * 2;
      gl(Math.sin(a) * 8.05, T + 10, z0 + Math.cos(a) * 8.05, 1.4, 7, .1, WIN, a);
    }

    // Four corner drums with small domes.

    for (const [ou, ov] of [[-12, -12], [12, -12], [12, 12], [-12, 12]]) {
      add(W, cyl, ou, T + 7, z0 + ov, 3.6, 10, 3.6);
      add(G, onion, ou, T + 12, z0 + ov, 6);
      cross(ou, T + 26, z0 + ov, 2);
      for (let q = 0; q < 4; q++) {
        const a = (q + .5) / 4 * Math.PI * 2;
        gl(ou + Math.sin(a) * 3.65, T + 7, z0 + ov + Math.cos(a) * 3.65, .8, 4, .1, WIN, a);
      }
    }

    // Apse with a gold half-dome at the back.

    add(W, cyl, 0, B + 8, z0 - 18, 10, 16, 10);
    add(G, cap, 0, B + 16, z0 - 18, 10.4, 6, 10.4);
    for (const a of [-.9, 0, .9]) gl(Math.sin(a + Math.PI) * 10.05, B + 9, z0 - 18 + Math.cos(a + Math.PI) * 10.05, 1.4, 5, .1, WIN, a + Math.PI);

    // Tall arched windows on the naos.

    for (const o of [-11, 0, 11]) {
      for (const g of [-1, 1]) gl(18.05 * g, B + 12, z0 + o, .1, 8, 2, WIN);
      gl(o, B + 12, z0 - 18.05, 2, 8, .1, WIN);
    }

    // Front porch with its own small dome, a lit door and the icon above it.

    add(W, box, 0, B + 6.5, z0 + 22, 22, 13, 8);
    add(W, archZ, 0, B + 13, z0 + 25.6, 7, 7, 1);
    add(W, cyl, 0, B + 16, z0 + 22, 2, 6, 2);
    add(G, onion, 0, B + 19, z0 + 22, 3.4);
    cross(0, B + 27.5, z0 + 22, 1.4);
    gl(0, B + 3.2, z0 + 26.05, 3.6, 6.4, .1, WARM.map(c => c * .9));
    gl(0, B + 10, z0 + 26.05, 3.6, 4.4, .12, ICON);
    for (const g of [-1, 1]) gl(7 * g, B + 6, z0 + 26.05, 1.6, 5, .1, WIN);

    // Bell tower: a square shaft, an open belfry, a gold tent roof, an onion and a cross.

    const bu = 27, bv = z0 - 14;
    add(W, box, bu, B + 15, bv, 11, 30, 11);
    add(G, box, bu, B + 30, bv, 11.6, .6, 11.6);
    add(W, box, bu, B + 35, bv, 9, 10, 9);
    add(G, box, bu, B + 40.2, bv, 10, .5, 10);
    add(G, tent, bu, B + 49, bv, 6, 18, 6);
    add(G, onion, bu, B + 57, bv, 2.2);
    cross(bu, B + 63, bv, 2);
    for (const [fu, fv] of [[0, 4.55], [0, -4.55], [4.55, 0], [-4.55, 0]]) gl(bu + fu, B + 35, bv + fv, fu ? .1 : 4.4, 6.4, fu ? 4.4 : .1, WARM.map(c => c * .8));
    for (let y = 8; y < 28; y += 7) gl(bu - 5.55, B + y, bv, .1, 3, 1.4, WIN);

    // Forecourt with arcades on both sides, lamps, and a gate with two small domes.

    pr(0, .15, 27, 52, .3, 28, [.15, .14, .125]);
    pr(0, .32, 27, 8, .1, 28, [.2, .18, .15]);
    for (const g of [-1, 1]) {
      add(W, box, 25 * g, 3.5, 27, .8, 7, 26);
      add(W, box, 22.2 * g, 7.4, 27, 6.4, .8, 26);
      add(G, box, 19.2 * g, 7, 27, .4, .4, 26);
      for (let q = 0; q < 6; q++) add(W, cyl, 19.4 * g, 3.5, 15 + q * 4.8, .45, 7, .45);
      for (let q = 0; q < 5; q++) gl(24.55 * g, 3.4, 17.4 + q * 4.8, .1, 4, 2.2, WIN);
      add(W, box, 15.5 * g, 1.25, 40, 17, 2.5, .8);
      add(W, box, 6.5 * g, 4.5, 40, 2.4, 9, 2.4);
      add(G, onion, 6.5 * g, 9, 40, 1.6);
      gl(9 * g, 3, 33, .6, .6, .6, [1.4, 1.1, .7]);
      gl(9 * g, 3, 22, .6, .6, .6, [1.4, 1.1, .7]);
      pr(9 * g, 1.5, 33, .3, 3, .3, [.08, .08, .08]);
      pr(9 * g, 1.5, 22, .3, 3, .3, [.08, .08, .08]);
    }
    add(W, box, 0, 8.6, 40, 13, 1.4, 1.8);
    gl(0, 10.6, 40.95, 2.4, 2.6, .1, ICON);

    // Floodlights wash the white walls.

    for (const [pu, pv, rad] of [[0, 28, 18], [-22, z0, 14], [22, z0 + 8, 12], [0, z0 - 30, 12], [bu, bv - 8, 10]]) pool(x + pu * k, z + pv * k, rad * k, [.14, .12, .08]);

    for (const [arr, mat] of [[W, white], [G, gold]]) {
      const m = new THREE.Mesh(mergeGeometries(arr), mat);
      m.position.set(x, 0, z);
      m.scale.setScalar(k);
      H.decor.add(m);
    }
  };

  // The Big Hole: a stalled pit behind hoardings, a spiderweb of beams, plastic sheeting and one crane.

  const bighole = (x, z, w, d, st, r) => {
    const pw = w - 12, pd = d - 12, steel = [.13, .1, .07];
    prop('box', x, .12, z, pw, .25, pd, [.012, .011, .01]);
    for (const g of [-1, 1]) {
      prop('box', x, 2, z + g * (pd / 2 + 1), pw + 2, 4, .3, [.16, .15, .13]);
      prop('box', x + g * (pw / 2 + 1), 2, z, .3, 4, pd + 2, [.16, .15, .13]);
    }
    textSign('G.W. FOUNDATIONS', x, 2.4, z + pd / 2 + 1.3, 16, 3.5, 0, [1.2, .9, .3].map(c => c * .5));
    const nx = 5, nz = 4, cols = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const px = x + (i / (nx - 1) - .5) * pw * .85, pz = z + (j / (nz - 1) - .5) * pd * .85, h = 14 + r() * 26;
      prop('box', px, h / 2, pz, .9, h, .9, steel);
      cols.push([px, h, pz, i, j]);
    }
    for (const [px, h, pz, i, j] of cols) for (const [di, dj] of [[1, 0], [0, 1], [1, 1]]) {
      const o = cols.find(c => c[3] === i + di && c[4] === j + dj);
      if (!o || r() < .25) continue;
      const top = Math.min(h, o[1]);
      for (let y = 8; y < top; y += 10) beam([px, y, pz], [o[0], y + (di && dj ? 6 : 0), o[2]], .35, steel);
    }

    // Plastic sheeting hangs between some columns.

    const sheet = new THREE.MeshBasicMaterial({ color: new THREE.Color(.5, .55, .6), transparent: true, opacity: .16, side: THREE.DoubleSide, depthWrite: false });
    for (let k = 0; k < 10; k++) {
      const a = cols[Math.floor(r() * cols.length)], b = cols.find(c => c[3] === a[3] + 1 && c[4] === a[4]);
      if (!b) continue;
      const h = Math.min(a[1], b[1]) * (.5 + .4 * r()), len = Math.hypot(b[0] - a[0], b[2] - a[2]);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, h), sheet);
      m.position.set((a[0] + b[0]) / 2, Math.min(a[1], b[1]) - h / 2, (a[2] + b[2]) / 2);
      m.rotation.y = -Math.atan2(b[2] - a[2], b[0] - a[0]);
      H.decor.add(m);
    }

    // One tower crane, jib out over the pit.

    const cxr = x - pw / 2 + 6, czr = z - pd / 2 + 6, ch = 62;
    prop('lattice', cxr, ch / 2, czr, 4, ch, 4);
    bld(cxr, czr, 2.2, 2.2, ch, { ...st, base: [.25, .17, .04], lit: 0 }, r, { roof: false, skin: SKINS.sparse });
    beam([cxr - 12, ch, czr - 12], [cxr + 40, ch, czr + 40], 1.4, [.3, .2, .05]);
    prop('box', cxr - 10, ch - 1.5, czr - 10, 4, 3, 4, [.1, .1, .1]);
    beam([cxr + 30, ch, czr + 30], [cxr + 30, 18, czr + 30], .08, [.1, .1, .1]);
    beacon(cxr, ch + 3, czr, r);
    beacon(cxr + 40, ch + 1, czr + 40, r);
    for (let k = 0; k < 4; k++) {
      const px = x + (r() - .5) * pw * .7, pz = z + (r() - .5) * pd * .7;
      glow(px, 10, pz, .7, .4, .7, MERC);
      pool(px, pz, 12, MERC.map(c => c * .1));
    }
  };

  // Workers' Wall: a scarred factory wall with a lit hopper pickup pad and a crowd of day labourers.

  const workerswall = (x, z, w, d, st, r) => {
    const L = Math.min(w - 6, 90), fz = z + d / 2 - 14;
    bld(x, fz, L, 3, 12, { ...st, base: [.12, .07, .05], lit: 0, grime: 1 }, r, { skin: SKINS.sparse, roof: false });
    for (let k = 0; k < 30; k++) prop('box', x + (r() - .5) * (L - 2), 1.5 + r() * 9, fz + 1.55, .5 + r(), .4 + r() * .6, .1, [.03, .03, .03]);
    for (let k = 0; k < 6; k++) glow(x + (r() - .5) * (L - 4), 2 + r() * 7, fz + 1.6, .8, .8, .05, BLUE.map(c => c * .35));
    textSign('РАБОТА · WORK TODAY', x, 9.5, fz + 1.65, 22, 3, 0, [1.3, .9, .2].map(c => c * .55));

    // Derelict factory hall behind the wall, sawtooth roof.

    const hd = Math.min(d - 24, 50), hz = fz - 2 - hd / 2;
    bld(x, hz, L, hd, 14, { ...st, base: [.05, .045, .04], lit: .03, grime: 1 }, r, { skin: SKINS.sparse, roof: false });
    for (let u = -L / 2 + 5; u < L / 2; u += 10) {
      prop('box', x + u, 15.6, hz, hd, .4, 9, [.07, .065, .06], Math.PI / 2, .35);
      glow(x + u + 4.2, 15.5, hz, .2, 1.6, hd * .9, WARM.map(c => c * .15));
    }
    for (let k = 0; k < 3; k++) { const ch = 34 + r() * 10, px = x + (k - 1) * L * .3; bld(px, hz - hd / 2 + 4, 3, 3, ch, { ...st, base: [.1, .06, .04], lit: 0 }, r, { shape: 'cyl', roof: false }); }

    // Pickup pad, a parked hopper and the waiting crowd.

    const pz = fz + 8;
    prop('box', x, .12, pz, L * .6, .25, 10, [.07, .07, .075]);
    for (const g of [-1, 1]) glow(x + g * L * .3, .3, pz, .3, .15, 10, MERC);
    pool(x, pz, 22, MERC.map(c => c * .12));
    prop('box', x + L * .2, 1.6, pz, 7, 2.2, 3.6, [.12, .12, .13]);
    glow(x + L * .2 + 3.6, 1.6, pz, .1, .6, 2.6, [1.4, 1.3, 1.1]);
    for (let k = 0; k < 36; k++) prop('cyl', x - L * .25 + r() * L * .35, .85, fz + 3 + r() * 4, .55, 1.7, .55, [.08 + .1 * r(), .07, .06]);
  };

  // Brutalist landmarks share one raw-concrete look and the district's mercury and faded red lights.

  const RED_DIM = [1.4, .12, .1].map(c => c * .5), MERC_DIM = MERC.map(c => c * .5);
  const raw = { w: .2, base: [.1, .095, .09], win: MERC, lit: .06, grime: .85 };
  const concrete = new THREE.MeshStandardMaterial({ color: 0x6e6a62, roughness: .9, emissive: 0x1a1916 });
  const solid = (geos, mat = concrete) => { const m = new THREE.Mesh(mergeGeometries(geos), mat); H.decor.add(m); return m; };

  // Druzhba-style sanatorium: a round core on pilotis, three rings of radial cells, the middle ring cantilevered out.

  const druzhba = (x, z, w, d, st, r) => {
    const k0 = Math.min(1, Math.min(w, d) / 74);
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2;
      bld(x + Math.sin(a) * 20 * k0, z + Math.cos(a) * 20 * k0, 2.4, 2.4, 12, { ...raw, lit: 0 }, r, { shape: 'cyl', roof: false, kibble: false });
    }
    bld(x, z, 16 * k0, 16 * k0, 58, raw, r, { shape: 'cyl', roof: false, kibble: false, skin: SKINS.bands });
    const rings = [[12, 22, 20], [24, 28, 24], [36, 22, 20]];
    for (const [y, R0, n] of rings) {
      const R = R0 * k0, cell = 14 * k0;
      for (let k = 0; k < n; k++) {
        const a = (k + (y === 24 ? .5 : 0)) / n * Math.PI * 2;
        bld(x + Math.sin(a) * R, z + Math.cos(a) * R, 2 * Math.PI * R / n - 1.4 * k0, cell, 10, { ...raw, lit: .08 }, r, { y0: y, ry: a, roof: false, kibble: false, skin: SKINS.fins });
      }
      put(GLOWS.ring, x, y + .4, z, (R + cell / 2 + .4) * 2, 1, (R + cell / 2 + .4) * 2, 0, 0, MERC_DIM);
    }
    const disc = R => new THREE.CylinderGeometry(R * k0, R * k0, 1, 48);
    solid([disc(30).translate(x, 11.5, z), disc(36).translate(x, 34, z), disc(30).translate(x, 46.5, z), disc(10).translate(x, 58.5, z)]);
    put(GLOWS.ring, x, 47.2, z, 60 * k0, 1, 60 * k0, 0, 0, RED_DIM);
    beacon(x, 60, z, r);
    pool(x, z, 30 * k0, MERC.map(c => c * .1));
  };

  // Trellick-style bloc: a long slab on pilotis with sky streets, a separate service tower, bridges and a cantilevered boiler house.

  const trellick = (x, z, w, d, st, r) => {
    const L = Math.min(w - 10, 76), T = 16, sz = z + 6, tz = z - 18, top = 110;
    for (let u = -L / 2 + 3; u <= L / 2 - 3; u += 9.5) for (const g of [-1, 1]) bld(x + u, sz + g * (T / 2 - 2), 1.8, 1.8, 10, { ...raw, lit: 0 }, r, { roof: false, kibble: false });
    bld(x, sz, L, T, top - 10, raw, r, { y0: 10, roof: false, kibble: false, skin: SKINS.grid });
    for (let y = 16; y < top - 2; y += 9.6) {
      prop('box', x, y, sz + T / 2 + .7, L, .5, 1.4, [.08, .076, .07]);
      glow(x, y + .5, sz + T / 2 + 1.3, L * .96, .14, .1, MERC.map(c => c * .3));
    }
    bld(x, tz, 9, 9, top + 18, { ...raw, lit: .02 }, r, { roof: false, kibble: false, skin: SKINS.bands });
    glow(x + 4.6, (top + 18) / 2, tz, .1, top + 10, .6, RED_DIM.map(c => c * .5));
    for (let y = 26; y < top; y += 28.8) bld(x, (sz - T / 2 + tz + 4.5) / 2, 4, sz - T / 2 - tz - 4.5, 3.2, { ...raw, lit: .3 }, r, { y0: y, roof: false, kibble: false, skin: SKINS.bands });
    bld(x, tz + 4, 13, 17, 9, { ...raw, lit: .05 }, r, { y0: top + 18, roof: false, kibble: false, skin: SKINS.sparse });
    for (const g of [-1, 1]) bld(x + g * 3, tz + 4, 1.2, 1.2, 18, { ...raw, lit: 0 }, r, { y0: top + 27, shape: 'cyl', roof: false, kibble: false });
    beacon(x, top + 46, tz + 4, r);
    textSign('SKY STREETS', x, 5, sz + T / 2 + .3, 10, 2.4, 0, MERC);
  };

  // Ribbed water tower: a fluted stem, a deep bowl with radial fins, an observation band and a radar dome on top.

  const watertower = (x, z, w, d, st, r) => {
    const g = [], N = 20;
    g.push(new THREE.CylinderGeometry(4.5, 7.5, 64, 24).translate(x, 32, z));
    for (let k = 0; k < N; k++) {
      const a = k / N * Math.PI * 2;
      g.push(new THREE.BoxGeometry(1.4, 64, 2.2).rotateZ(-.047).translate(6.6, 32, 0).rotateY(a).translate(x, 0, z));
      g.push(new THREE.BoxGeometry(1.2, 6, 20).rotateX(-.75).translate(0, 66, 11).rotateY(a).translate(x, 0, z));
    }
    g.push(new THREE.LatheGeometry([[4, 62], [12, 66], [22, 72], [27, 79], [27, 86], [25, 88]].map(([a, b]) => new THREE.Vector2(a, b)), 40).translate(x, 0, z));
    g.push(new THREE.CylinderGeometry(25, 25, 1, 40).translate(x, 88, z));
    g.push(new THREE.SphereGeometry(9, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, 88.5, z));
    solid(g);
    put(GLOWS.ring, x, 82, z, 55, 6, 55, 0, 0, MERC.map(c => c * .45));
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; glow(x + Math.sin(a) * 27.3, 82, z + Math.cos(a) * 27.3, 2.4, .9, .3, MERC_DIM, a); }
    put(GLOWS.ring, x, 88.6, z, 51, 1, 51, 0, 0, RED_DIM);
    beacon(x, 98, z, r);
    bld(x + 22, z, 14, 20, 7, raw, r, { skin: SKINS.sparse });
    pool(x, z, 24, MERC.map(c => c * .1));
  };

  // Ministry of Labour: crossed slabs stacked on three cores, each tier longer, so the block grows as it rises.

  const ministry = (x, z, w, d, st, r) => {
    const cores = [[-14, -6], [12, 10], [4, -16]];
    for (const [cx, cz] of cores) bld(x + cx, z + cz, 7, 7, 84, { ...raw, lit: .02 }, r, { roof: false, kibble: false, skin: SKINS.bands });
    for (let k = 0; k < 5; k++) {
      const y = 16 + k * 14, L = 40 + k * 9, along = k % 2 === 0, off = (k % 3 - 1) * 6;
      bld(along ? x + off : x, along ? z : z + off, along ? L : 14, along ? 14 : L, 10, raw, r, { y0: y, roof: false, kibble: false, skin: SKINS.grid });
      glow(along ? x + off : x, y - .1, along ? z : z + off, along ? L * .9 : 2, .12, along ? 2 : L * .9, MERC.map(c => c * .4));
      if (k === 4) textSign('МИНТРУД', along ? x + off : x, y + 5, (along ? z : z + off) + (along ? 7.3 : L / 2 + .3), 12, 3, 0, RED_DIM);
    }
    beacon(x + 12, 86, z + 10, r);
    pool(x, z, 20, MERC.map(c => c * .08));
  };

  // Moving parts get their own instanced mesh in the landmark group, because shared instances freeze into tiles.
  // A part is [x, y, z, sx, sy, sz, rgb] round the mesh's pivot.

  const _o = new THREE.Object3D(), _c = new THREE.Color();
  const mover = (material, x, y, z, parts) => {
    const m = new THREE.InstancedMesh(H.PROPS.box.geometry, material, parts.length);
    parts.forEach(([px, py, pz, sx, sy, sz, rgb], i) => {
      _o.position.set(px, py, pz); _o.scale.set(sx, sy, sz); _o.updateMatrix();
      m.setMatrixAt(i, _o.matrix); m.setColorAt(i, _c.setRGB(...rgb));
    });
    m.position.set(x, y, z); m.userData.noTile = true; m.frustumCulled = false;
    H.decor.add(m);
    return m;
  };
  const LIFT = {};

  // SafePod 9: a hollow concrete tube. Capsule pods line the inner wall round an open atrium, a ring walkway runs
  // in front of them on every floor, and gangways cross to a glass lift in the centre. A glass slot on the front
  // shows the atrium from the street. On the top floor a stretch of ring railing is shot away where Grima nearly fell.

  const clonetel = (x, z, w, d, st, r) => {
    const R = 17, T = 1.2, N = 16, P = 3.2, B = 6, top = B + N * P, n = 24, Ri = R - T / 2, Rw = Ri - 1.1, Rr = Ri - 2.1;
    const grim = { ...st, base: [.2, .205, .2], win: BLUE, lit: .03, grime: .95 };
    const STEEL = [.07, .068, .065], RAIL = [.16, .15, .13], DARK = [.035, .033, .03];
    const at = (a, rad, y = 0) => [x + Math.sin(a) * rad, y, z + Math.cos(a) * rad];
    const slot = k => k === 0 || k === 1 || k === n - 1, seg = 2 * Math.PI * R / n + .1;

    // Shell: one capped panel per segment, full height except over the lobby where the front slot opens.
    // Bunk slits and rust streaks on the outside, a dark atrium floor inside.

    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2, [px, , pz] = at(a, R);
      bld(px, pz, seg, T, slot(k) ? B : top, grim, r, { ry: a, roof: false, kibble: false, skin: SKINS.sparse });
      prop('box', px, top + .3, pz, seg, .6, T + .6, [.1, .1, .095], a);
      if (slot(k)) continue;
      for (let i = 0; i < N; i++) if (r() < .55) {
        const [sx, , sz] = at(a, R + T / 2 + .06);
        glow(sx, B + i * P + .9 + r() * 1.4, sz, seg * (.4 + .5 * r()), .35, .1, BLUE.map(c => c * (.25 + .35 * r())), a);
      }
      if (r() < .5) { const h = 6 + r() * 18, [sx, , sz] = at(a, R + T / 2 + .04); prop('box', sx, B + r() * (top - B - h) + h / 2, sz, .5 + r() * .8, h, .06, [.07, .045, .03], a); }
    }
    prop('cyl', x, .15, z, Ri * 2, .3, Ri * 2, [.04, .04, .045]);
    put(GLOWS.ring, x, top + .2, z, R * 2 + 1.4, 1, R * 2 + 1.4, 0, 0, BLUE.map(c => c * .6));

    // Glass in the front slot, above the lobby.

    const glass = new THREE.MeshBasicMaterial({ color: new THREE.Color(.35, .55, .7), transparent: true, opacity: .12, depthWrite: false, side: THREE.DoubleSide });
    for (const k of [n - 1, 0, 1]) {
      const a = k / n * Math.PI * 2, [px, , pz] = at(a, R), m = new THREE.Mesh(new THREE.PlaneGeometry(seg, top - B), glass);
      m.position.set(px, (top + B) / 2, pz); m.rotation.y = a;
      H.decor.add(m);
      prop('box', ...at(a + Math.PI / n, R, top / 2), .4, top, .4, STEEL, a);
    }

    // Each floor: pod hatches on the inner wall, the ring walkway with rails and a dim strip, and a blue rail ring.
    // The top-floor rail is gone over two segments at the back, and a bent rail hangs into the atrium.

    for (let i = 0; i < N; i++) {
      const y = B + i * P;
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2, tx = Math.cos(a), tz = -Math.sin(a);
        if (!slot(k)) for (const t of [-1.1, 1.1]) {
          const [hx, , hz] = at(a, Ri - .06), q = r();
          glow(hx + tx * t, y + 1.4, hz + tz * t, 1.4, 1.2, .08, q < .3 ? BLUE.map(c => c * (.4 + .4 * r())) : q < .5 ? PALE.map(c => c * .5) : DARK, a);
        }
        prop('box', ...at(a, Rw, y - .15), seg - .2, .3, 2.2, STEEL, a);
        if (i === N - 1 && (k === 12 || k === 13)) continue;
        for (const h of [.55, 1.1]) beam(at(a, Rr, y + h), at(a1, Rr, y + h), .07, RAIL);
        prop('box', ...at(a, Rr, y + .55), .08, 1.1, .08, RAIL);
      }
      put(GLOWS.ring, x, y - .3, z, Rr * 2, 1, Rr * 2, 0, 0, BLUE.map(c => c * .22));
      if (i % 2) glow(...at(r() * Math.PI * 2, Ri - .3, y + 2.7), .6, .25, .6, MERC);
    }
    const yb = B + (N - 1) * P, ab = 12 / n * Math.PI * 2, ae = 14 / n * Math.PI * 2;
    beam(at(ab, Rr, yb + 1.1), at(ab + .12, Rr - 1.4, yb - 1.4), .07, RAIL);
    beam(at(ae, Rr, yb + .55), at(ae - .08, Rr - .7, yb - .4), .07, RAIL);
    for (let k = 0; k < 5; k++) prop('box', ...at(ab + r() * (ae - ab), Rw - .4 + r() * .6, yb + .1), .3 + r() * .4, .15, .2 + r() * .3, RAIL, r() * 3);
    glow(...at((ab + ae) / 2, Rw, yb + .02), seg * 1.6, .03, 1.2, [.3, .05, .03], (ab + ae) / 2);

    // Gangways cross from the ring to the lift on every floor, four on the diagonals, each with two rails.

    for (let i = 0; i < N; i++) for (let k = 0; k < 4; k++) {
      const y = B + i * P, a = Math.PI / 4 + k * Math.PI / 2, tx = Math.cos(a) * .8, tz = -Math.sin(a) * .8;
      prop('box', ...at(a, (1.6 + Rr) / 2, y - .15), 1.6, .3, Rr - 1.6, STEEL, a);
      for (const g of [-1, 1]) {
        const [ax, ay, az] = at(a, 1.7, y + 1.1), [bx, by, bz] = at(a, Rr, y + 1.1);
        beam([ax + g * tx, ay, az + g * tz], [bx + g * tx, by, bz + g * tz], .06, RAIL);
      }
    }

    // A spiral stair climbs the ring, one flight per floor, each a fifth of a turn round from the last.

    for (let i = 0; i < N; i++) {
      const a0 = Math.PI / 2 + i * .5, y0 = i ? B + (i - 1) * P : 0, y1 = B + i * P;
      ramp(at(a0, Rw, y0), at(a0 + .5, Rw, y1), 1.8, .2, STEEL);
      beam(at(a0, Rr - .2, y0 + 1), at(a0 + .5, Rr - .2, y1 + 1), .06, RAIL);
    }

    // Glass lift in the centre: a turned square shaft with corner posts and floor bands, a motor room on top,
    // and a lit car that rides up and down.

    const eh = top + 4, sq = Math.PI / 4;
    for (let k = 0; k < 4; k++) prop('box', ...at(k * Math.PI / 2, 2.26, eh / 2), .22, eh, .22, STEEL, sq);
    for (let y = B; y < eh; y += P) for (let k = 0; k < 4; k++) beam(at(k * Math.PI / 2, 2.26, y), at((k + 1) * Math.PI / 2, 2.26, y), .12, STEEL);
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(3.2, eh, 3.2), glass);
    shaft.position.set(x, eh / 2, z); shaft.rotation.y = sq;
    H.decor.add(shaft);
    prop('box', x, eh + 1.2, z, 3.8, 2.4, 3.8, [.09, .088, .085], sq);
    LIFT.lo = 1.5; LIFT.hi = B + (N - 1) * P + 1.5;
    LIFT.parts = [
      mover(H.PROPS.box.material, x, LIFT.lo, z, [[0, -1.4, 0, 2.9, .25, 2.9, [.12, .12, .12]], [0, 1.4, 0, 2.9, .35, 2.9, [.12, .12, .12]]]),
      mover(GLOWS.sphere.material, x, LIFT.lo, z, [[0, 0, 0, 2.5, 2.5, 2.5, [.9, 1.05, 1.25]], [0, 1.2, 0, 2.6, .12, 2.6, [1.4, 1.4, 1.5]]]),
    ];
    for (const m of LIFT.parts) m.rotation.y = sq;
    pool(x, z, 8, [.12, .14, .16]);

    // Lobby door and SAFEPOD 9 under the slot, the CLONE-TEL sign on the rim, a red sign on the side.

    glow(...at(0, R + T / 2 + .08, 1.8), 6, 3.4, .12, BLUE.map(c => c * .6));
    pool(x, z + R + 6, 9, BLUE.map(c => c * .1));
    textSign('SAFEPOD 9', x, 4.7, z + R + T / 2 + .2, 9, 1.8, 0, PALE.map(c => c * .8));
    const sz = z - R;
    prop('box', x, top + 4.5, sz - .25, 22, 5, .4, DARK);
    for (const g of [-1, 1]) prop('box', x + g * 9, top + 2, sz - .5, .3, 4, .3, STEEL);
    textSign('CLONE-TEL', x, top + 4.5, sz, 20, 4.4, 0, BLUE.map(c => c * 1.3));
    textSign('КЛОН-ОТЕЛЬ', ...at(-Math.PI / 2, R + T / 2 + .15, top - 8), 10, 2.4, -Math.PI / 2, [1.4, .12, .1].map(c => c * .6));

    // Rim clutter: tanks, plant boxes, a dish, steam and a mast with the aviation light.

    for (const a of [1.9, 4.4]) prop('cyl', ...at(a, R, top + 2), 2.4, 3.4, 2.4, [.07, .06, .05]);
    for (let k = 0; k < 4; k++) prop('box', ...at(4.7 + k * .3, R, top + 1), 2.4, 1.6, 1.4, [.06 + .03 * r(), .058, .055], 4 + k * .3);
    prop('dish', ...at(1.6, R, top + 1), 2.6, 2.6, 2.6, [.2, .2, .2]);
    for (let k = 0; k < 3; k++) puff(...at(4.6 + k * .4, R, top + 3 + r() * 2), 2 + r() * 1.5, [.1, .11, .12]);
    beam(at(2.2, R, top), at(2.2, R, top + 12), .2, STEEL);
    beacon(...at(2.2, R, top + 12.5), r);
    glow(...at(.5, R + 1.5, 3.2), .6, .25, .6, MERC);
    const [lx, , lz] = at(.5, R + 4);
    pool(lx, lz, 5, MERC.map(c => c * .1));
  };

  // Kistochka, after the Bierpinsel: a ribbed concrete stem with a cantilevered stair carries a red crown.
  // The crown has a flared underside, three staggered tiers of angled bay windows, a flat wing on one side,
  // a louvre band and a dome. Worn paint, holo-ad bays, an LED ticker and a pirate radio mast make it cyberpunk.
  // The stem rises from a raised deck with the night market on top and the pivnaya underneath.

  const KIST = {};
  const kistochka = (x, z, w, d, st, r) => {
    const red = new THREE.MeshStandardMaterial({ color: 0x8a2416, roughness: .85, emissive: 0x340704 });
    const louvre = new THREE.MeshStandardMaterial({ color: 0x1c1b1d, roughness: .5, metalness: .6, emissive: 0x060607 });
    const AMBER = [1.5, .8, .25], NEON = [1.6, .1, .5], CYAN = [.2, 1.1, 1.4], GLASS = [.03, .04, .05];
    const louvreRGB = [.02, .02, .022];
    const ADS = [NEON, CYAN, [1.3, .9, .2], [.6, 1.4, .35]], STEEL = [.07, .068, .065], CON = [.17, .16, .15], RUST = [.06, .025, .015];
    const at = (a, rad, y = 0) => [x + Math.sin(a) * rad, y, z + Math.cos(a) * rad];
    const ring = (y, rad, rgb) => put(GLOWS.ring, x, y, z, rad * 2, 1, rad * 2, 0, 0, rgb);
    const pick = a => a[Math.floor(r() * a.length)];
    const C0 = 45, N = 16, DY = 7;

    // Stem: a concrete shaft with eight ribs, from the deck up into the crown.

    const S = [new THREE.CylinderGeometry(5.2, 5.8, C0 + 2, 24).translate(x, (C0 + 2) / 2, z)];
    for (let k = 0; k < 8; k++) S.push(new THREE.BoxGeometry(1.4, C0, 2).translate(0, C0 / 2, 5.6).rotateY((k + .5) / 8 * Math.PI * 2).translate(x, 0, z));
    solid(S);

    // Crown: flared underside, three drums with bays staggered by half a bay, and a wing on local -x.
    // Each bay is a box with sloped plates above and below, which gives the chunky angled frames.
    // K scales the whole crown. Two bays hold a failing tube and flicker.

    const K = 1.4;
    const R = [new THREE.CylinderGeometry(13 * K, 5.5, 8 * K, N).translate(x, C0 + 4 * K, z)];
    const tiers = [[8, 6.5, 12.5, 0], [14.5, 6.5, 14, .5], [21, 6, 13, 0]].map(([y, h, rad, off]) => [C0 + y * K, h * K, rad * K, off]);
    const BAD = { '0,0': [.45, .5, .48], '2,4': NEON.map(v => v * .7) };
    tiers.forEach(([y0, h, rad, off], ti) => {
      R.push(new THREE.CylinderGeometry(rad, rad, h, N).translate(x, y0 + h / 2, z));
      const bw = 2 * rad * Math.sin(Math.PI / N) * .86, bh = h * .78, yc = y0 + h / 2;
      for (let k = 0; k < N; k++) {
        const a = (k + off) / N * Math.PI * 2;
        if (Math.abs(Math.sin(a) + 1) < .2) continue;
        const bay = g => g.translate(0, 0, rad + 1.6 * K).rotateY(a).translate(x, 0, z);
        R.push(bay(new THREE.BoxGeometry(bw, bh, 3.6 * K).translate(0, yc, 0)));
        R.push(bay(new THREE.BoxGeometry(bw, .6 * K, 4.2 * K).rotateX(-.7).translate(0, yc - bh / 2 - .3 * K, 0)));
        R.push(bay(new THREE.BoxGeometry(bw, .6 * K, 4.2 * K).rotateX(.7).translate(0, yc + bh / 2 + .3 * K, 0)));
        prop('box', ...at(a + Math.PI / N, rad + 1.4 * K, yc), .45 * K, bh + K, 3 * K, louvreRGB, a);

        // Bad tubes sit on bays at 0 or 90 degrees, because flickerGlow takes no turn.

        const bad = BAD[`${ti},${k}`], [gx, gy, gz] = at(a, rad + 3.45 * K, yc + .2 * K);
        if (bad) H.flickerGlow(gx, gy, gz, k ? .1 : bw * .7, bh * .5, k ? bw * .7 : .1, bad, r);
        else {
          const q = r(), c = q < .14 ? pick(ADS).map(v => v * .45) : q < .65 ? AMBER.map(v => v * (.1 + .08 * r())) : GLASS;
          glow(gx, gy, gz, bw * .7, bh * .5, .1, c, a);
        }
        if (r() < .35) prop('box', ...at(a, rad + .05, y0 - 1.2 * K), .35 * K, (2.4 + r() * 2) * K, .1, RUST, a);
      }
      ring(y0 + .2, rad + 3.5 * K, NEON.map(v => v * .3));
    });
    R.push(new THREE.BoxGeometry(9 * K, 22 * K, 10 * K).translate(-11.5 * K, C0 + 14 * K, 0).translate(x, 0, z));
    solid(R, red);

    // Wing windows in four rows, a pivnaya sign and neon edges.

    const wx = x - 16 * K - .05;
    for (let i = 0; i < 4; i++) for (let j = -1; j <= 1; j++) {
      const y = C0 + (7 + i * 4.6) * K, c = r() < .7 ? AMBER.map(v => v * (.2 + .15 * r())) : GLASS;
      glow(wx, y, z + j * 3 * K, .1, 1.8 * K, 2.4 * K, c, 0);
      for (const g of [-1, 1]) glow(x + (-11.5 + j * 2.6) * K, y, z + g * (5 * K + .05), 2 * K, 1.8 * K, .1, c);
    }
    textSign('ПИВНАЯ', wx - .1, C0 + 4.4 * K, z, 8 * K, 1.8 * K, -Math.PI / 2, NEON);
    for (const g of [-1, 1]) glow(wx - .05, C0 + 14 * K, z + g * 5 * K, .15, 21 * K, .15, NEON.map(v => v * .6));

    // Louvre band with the LED ticker, the dome and the pirate radio farm.

    const yt = C0 + 27 * K, top = yt + 4 * K, rb = 11.6 * K;
    const L = [new THREE.CylinderGeometry(rb, rb, 4 * K, N).translate(x, yt + 2 * K, z)];
    for (let k = 0; k < N * 2; k++) L.push(new THREE.BoxGeometry(.25 * K, 4 * K, .8 * K).translate(0, yt + 2 * K, rb + .2 * K).rotateY(k / N / 2 * Math.PI * 2).translate(x, 0, z));
    solid(L, louvre);
    ring(yt + .4 * K, rb + .3 * K, CYAN.map(v => v * .5));
    textSign('РАДИО КИСТОЧКА 101.7', x, yt + 2.4 * K, z + rb + .7 * K, 12 * K, 1.4 * K, 0, CYAN);
    textSign('ПИВО · КВАС · 24/7', x, yt + 2.4 * K, z - rb - .7 * K, 12 * K, 1.4 * K, Math.PI, AMBER);
    solid([new THREE.SphereGeometry(7 * K, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, top, z)]);
    beam([x, top + 6 * K, z], [x, top + 30, z], .3, STEEL);
    for (let k = 0; k < 3; k++) beacon(x, top + 16 + k * 6, z, r);
    for (let k = 0; k < 5; k++) { const a = r() * Math.PI * 2; beam(at(a, 7.5 * K, top), at(a, 7.5 * K, top + 5 + r() * 8), .08, STEEL); }
    for (const a of [.8, 2.6, 4.4]) prop('dish', ...at(a, 9 * K, top + 1), 2.6 * K, 2.6 * K, 2.6 * K, [.2, .2, .2]);
    for (let k = 0; k < 3; k++) puff(...at(1.5 + k * 1.8, rb + .2 * K, yt + 3 * K), (2 + r() * 1.5) * K, [.1, .11, .12]);

    // Cables hang from the louvre band down to the deck, and old murals cover the stem.

    for (const a of [.4, 2.1, 3.7]) beam(at(a, rb, yt), at(a + .25, 6.2, DY + .5), .07, [.03, .03, .03]);
    for (const a of [.3, 1.9, 3.1]) glow(...at(a, 5.95, DY + 6 + r() * 16), 2.6, 5, .1, pick(ADS).map(v => v * .18), a);

    // Cantilevered stair on local -x under the wing: solid flights and landings that reach back to the stem.

    const FL = 8, rise = (C0 - DY) / FL;
    for (let i = 0; i < FL; i++) {
      const s = i % 2 ? -1 : 1, y = DY + i * rise;
      ramp([x - 8.5, y, z - 3 * s], [x - 8.5, y + rise, z + 3 * s], 2.4, 1.1, CON);
      prop('box', x - 6.6, y + rise, z + 4.2 * s, 6, .8, 2.6, CON);
    }

    // Glass lift on local +x, with a lit car that rides between the deck and the crown.

    const lx = x + 8, lh = C0 - DY;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2.6, lh, 2.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(.35, .55, .7), transparent: true, opacity: .14, depthWrite: false }));
    glass.position.set(lx, DY + lh / 2, z);
    H.decor.add(glass);
    for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) prop('box', lx + a * 1.3, DY + lh / 2, z + b * 1.3, .2, lh, .2, STEEL);
    KIST.lo = DY + 1.5; KIST.hi = C0 - 2;
    KIST.lift = [
      mover(H.PROPS.box.material, lx, KIST.lo, z, [[0, -1.2, 0, 2.3, .2, 2.3, [.12, .12, .12]], [0, 1.2, 0, 2.3, .3, 2.3, [.12, .12, .12]]]),
      mover(GLOWS.sphere.material, lx, KIST.lo, z, [[0, 0, 0, 2, 2.2, 2, AMBER.map(v => v * .6)]]),
    ];

    // Raised deck on pillars, a broad stair down at the front, beer medallions on the fascia.

    const Dw = Math.min(w - 6, 56), Dd = Math.min(d - 22, 34);
    prop('box', x, DY - .6, z, Dw, 1.2, Dd, [.09, .087, .082]);
    for (const g of [-1, 1]) {
      prop('box', x, DY + .5, z + g * (Dd / 2 - .2), Dw, 1, .4, CON);
      prop('box', x + g * (Dw / 2 - .2), DY + .5, z, .4, 1, Dd, CON);
      glow(x, DY - 1.25, z + g * Dd / 2, Dw * .95, .1, .1, MERC.map(v => v * .4));
    }
    for (let u = -Dw / 2 + 4; u <= Dw / 2 - 4; u += 12) for (let v = -Dd / 2 + 4; v <= Dd / 2 - 4; v += 12) {
      if (Math.hypot(u, v) > 11) prop('cyl', x + u, (DY - 1.2) / 2, z + v, 1.4, DY - 1.2, 1.4, CON);
    }
    ramp([x + Dw / 2 - 9, 0, z + Dd / 2 + 9], [x + Dw / 2 - 9, DY, z + Dd / 2], 6, .6, CON);
    ['ПИВО', 'КВАС', '24/7'].forEach((t, k) => textSign(t, x - 12 + k * 6, DY - .6, z + Dd / 2 + .05, 4, 1, 0, ADS[k + 1].map(v => v * .8)));

    // Night market on the deck: stalls with lit awnings and a crowd, clear of the stair and the lift.

    for (let k = 0; k < 12; k++) {
      const u = (r() * 2 - 1) * (Dw / 2 - 4), v = (r() * 2 - 1) * (Dd / 2 - 4);
      if (Math.hypot(u, v) < 12) continue;
      const c = ADS[k % ADS.length];
      prop('box', x + u, DY + 1, z + v, 2.6, 2, 2, [.08, .07, .06]);
      glow(x + u, DY + 2.1, z + v, 2.8, .12, 2.2, c.map(q => q * .5));
      pool(x + u, z + v, 4, c.map(q => q * .05));
    }
    for (let k = 0; k < 30; k++) {
      const a = r() * Math.PI * 2, rad = 10 + r() * Math.min(Dw, Dd) * .3;
      prop('cyl', ...at(a, rad, DY + .85), .55, 1.7, .55, [.08 + .1 * r(), .07, .06]);
    }

    // Pivnaya under the deck round the stem's foot, with its queue on the street.

    bld(x, z, 20, 20, 5, { ...raw, base: [.12, .05, .04], win: WARM, lit: .5 }, r, { shape: 'cyl', roof: false, kibble: false, skin: SKINS.bands });
    textSign('ПИВО 24', x, 3.6, z + 10.3, 6, 1.4, 0, AMBER);
    for (let k = 0; k < 14; k++) prop('cyl', x - 6 + r() * 12, .85, z + 12 + r() * 4, .55, 1.7, .55, [.08 + .1 * r(), .07, .06]);
    pool(x, z, 34, AMBER.map(v => v * .07));
  };

  return {
    rab_atsuzawa: { at: [662, 1000], label: 'Atsuzawa Arcology', labelY: 750, scaleY: .6, minSide: 56, reach: 500, face: [0, 1], build: atsuzawa },
    rab_olesya: { at: [612, 1012], label: 'Saint Olesya', labelY: 75, minSide: 62, reach: 500, face: [0, 1], build: olesya },
    rab_bighole: { at: [645, 1052], label: 'The Big Hole', labelY: 70, minSide: 46, reach: 260, face: [0, 1], build: bighole },
    rab_workerswall: { at: [532, 985], label: "Workers' Wall", labelY: 40, minSide: 50, reach: 300, face: [0, 1], build: workerswall },
    rab_druzhba: { at: [532, 1012], label: 'Druzhba Sanatorium', labelY: 75, minSide: 40, reach: 200, build: druzhba },
    rab_trellick: { at: [560, 948], label: 'Sky-Street Bloc', labelY: 160, minSide: 50, reach: 300, face: [0, 1], build: trellick },
    rab_watertower: { at: [690, 1012], label: 'Vodokanal Tower', labelY: 110, minSide: 40, reach: 200, build: watertower },
    rab_ministry: { at: [562, 1050], label: 'Ministry of Labour', labelY: 105, minSide: 50, reach: 300, face: [0, 1], build: ministry },
    rab_kistochka: { at: [718, 990], label: 'Kistochka', labelY: 125, minSide: 50, reach: 300, face: [0, 1], build: kistochka, update(t) {
      if (!KIST.lift) return;

      // The lift rides up and down every 20 s.

      const p = (t / 20) % 1, s = Math.min(1, Math.max(0, ((p < .5 ? p * 2 : 2 - p * 2) - .12) / .76));
      for (const m of KIST.lift) m.position.y = KIST.lo + (KIST.hi - KIST.lo) * s * s * (3 - 2 * s);
    } },
    rab_clonetel: { at: SP9, label: 'SafePod 9 Clone-Tel', labelY: 75, minSide: 40, reach: 200, face: [0, 1], build: clonetel, update(t) {
      if (!LIFT.parts) return;

      // The car rides up and down every 26 s and waits a moment at each end.

      const p = (t / 26) % 1, s = Math.min(1, Math.max(0, ((p < .5 ? p * 2 : 2 - p * 2) - .12) / .76));
      for (const m of LIFT.parts) m.position.y = LIFT.lo + (LIFT.hi - LIFT.lo) * s * s * (3 - 2 * s);
    } },
  };
}
