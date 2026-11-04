// Lorenz Ost's house kits: a Venetian merchant colony. Stucco houses in ochre, rose, terracotta, sienna and cream,
// trimmed with white Istrian stone, stand under low tile roofs or flat roofs with wooden terraces (altane). They carry
// funnel chimneys, pointed Gothic windows in groups with balconies, porticoes with shops, courts with well heads and
// now and then a brick bell tower. Kit signature: (x, z, s, st, b, r) in the lot frame.

import { parts } from '../../emberford/kits/town.js';
import { HALF_PI, COPPER, GOLD, trees } from './common.js';

// Mid tones, as bld() varies each part's base by up to 30 %.

const STUCCO = [[.54, .38, .17], [.56, .36, .3], [.5, .25, .15], [.44, .22, .12], [.56, .5, .38], [.56, .43, .37], [.44, .16, .11]];
const FADED = [[.52, .44, .3], [.54, .48, .38], [.5, .36, .26], [.48, .4, .3]];
const STONE = [[.6, .58, .52], [.56, .55, .5], [.58, .54, .46]];
const ISTRIA = [.62, .6, .54], DARK = [.05, .045, .04], LEAD = [.3, .31, .32];
const COPPI = [[.3, .12, .06], [.27, .11, .06], [.33, .15, .08], [.26, .12, .08]];
const BRICK = [[.42, .18, .11], [.38, .17, .1], [.45, .22, .13]];
const SHUTTERS = [[.1, .2, .12], [.12, .24, .16], [.08, .16, .1], [.14, .22, .2]];
const CHIMNEYS = [[.52, .46, .38], [.42, .22, .13], [.46, .3, .2]];
const DOORS = [[.16, .1, .05], [.1, .14, .1], [.2, .12, .06]];
const TERRACE = [.2, .15, .1], LAMP = [1, .64, .3];
const tone = (c, k) => c.map(v => v * k);

// bld() draws its brightness from the first random number. A steady generator gives every part of one wall the
// same brightness, so a house reads as one material.

const steady = (r, k) => { let first = true; return () => first ? (first = false, k) : r(); };

export function kits(H) {
  const { bld, prop, glow, SKINS } = H;
  const { strip, pick, yard } = parts(H);
  const { tree } = trees(H);
  const opt = o => ({ roof: false, kibble: false, ...o });

  // A Venetian house in the lot's own axes: u runs along the street, v out toward it from the house's centre. The
  // options pick the floors, the walls, the roof (a low hip, a low gable or flat behind a cornice), the window groups,
  // a portico, the chimneys and the altana. A tower lot keeps a strip at one side free for the campanile. The house
  // returns its frame, so a kit can build a court or a tower beside it.

  function house(x, z, s, st, r, o) {
    const p = strip(x, z, s, o.depth[0] + r() * (o.depth[1] - o.depth[0]));
    const W0 = p.frontage, side = o.tower && W0 >= 8 ? Math.min(4.4, Math.max(3.4, W0 * .4)) : 0, sg = r() < .5 ? -1 : 1;
    const w = W0 - side, uo = -sg * side / 2, d = p.deep, fr = p.fr, face = Math.atan2(fr.x, fr.z), ry = p.ry, vf = d / 2;
    const ax = { x: Math.abs(fr.z), z: Math.abs(fr.x) };
    const at = (u, v) => [p.cx + ax.x * (u + uo) + fr.x * v, p.cz + ax.z * (u + uo) + fr.z * v];
    const block = (u, v, y0, bw, bd, h, [skin, base], more = {}, rr = r) => bld(...at(u, v), bw, bd, h, st, rr, opt({ y0, skin, base, ry, ...more }));
    const fbox = (u, v, y, sx, sy, sz, rgb) => { const [px, pz] = at(u, v); prop('box', px, y, pz, sx, sy, sz, rgb, face); };
    const cyl = (u, v, y, dia, h, rgb, kind = 'cyl', flip = 0) => { const [px, pz] = at(u, v); prop(kind, px, y, pz, dia, h, dia, rgb, face, flip); };
    const pane = (u, v, y, sx, sy, rgb) => { const [px, pz] = at(u, v); glow(px, y, pz, sx, sy, .04, rgb, face); };
    const arch = (u, v, y, lw, rgb) => block(u, v, y, .06, lw, lw * .6, [SKINS.blindAshlar, rgb], { shape: 'gable', ry: ry + HALF_PI, lit: 0 });

    // The palette: one stucco, one stone and one roof per house.

    const pal = { stucco: pick(r, o.stucco ?? STUCCO), stone: pick(r, STONE) };
    const roofM = [SKINS.tiles, pick(r, COPPI)];
    const wall = kind => ({ plaster: [SKINS.plaster, pal.stucco], ashlar: [SKINS.ashlar, pal.stone] })[kind];

    // The ground floor stands back behind a portico if there is one. The upper floors run over it to the street.

    const gf = o.gf ?? 3.8 + r() * .6, n = o.floors, fh = o.fh ?? 3.1 + r() * .3, por = o.portico ?? 0;
    const gKind = pick(r, o.ground), uKind = pick(r, o.upper ?? ['plaster']), k = r(), upR = () => steady(r, k);
    block(0, -por / 2, 0, w, d - por, gf, wall(gKind), { lit: st.lit * 1.3 }, gKind === uKind ? upR() : r);
    block(0, 0, gf, w, d, n * fh, wall(uKind), {}, upR());
    const top = gf + n * fh;
    for (let i = 0; i < n; i++) fbox(0, vf + .1, gf + i * fh, w + .1, .2, .25, ISTRIA);

    // The roof: a white cornice, then a low hip, a low gable along the street, or a flat roof of tiles behind it.
    // Merlons of white stone may crown the front, as on the palaces of the Grand Canal.

    const kind = pick(r, o.roof);
    fbox(0, 0, top + .17, w + .5, .35, d + .5, ISTRIA);
    let rh = .5;
    if (kind === 'flat') fbox(0, 0, top + .4, w - .3, .2, d - .3, tone(roofM[1], .8));
    else {
      const Wr = w + .6, D = d + .6;
      rh = Math.min(kind === 'hip' ? Math.min(Wr, D) * (.22 + r() * .08) : D * (.16 + r() * .06), 3.5);
      if (kind === 'gable') block(0, 0, top + .3, Wr, D, rh, roofM, { shape: 'gable', lit: 0 });
      else if (Wr <= D + .5) block(0, 0, top + .3, Wr, D, rh, roofM, { shape: 'pyr', lit: 0 });
      else {
        block(0, 0, top + .3, Wr - D, D, rh, roofM, { shape: 'gable', lit: 0 });
        for (const e of [-1, 1]) block(e * (Wr - D) / 2, 0, top + .3, D, D, rh, roofM, { shape: 'pyr', lit: 0 });
      }
    }
    if (r() < (o.merlons ?? 0)) for (let m = Math.floor(w / 1.2), i = 0; i < m; i++) fbox((i + .5 - m / 2) * w / m, vf + .05, top + .8, .5, .9, .3, ISTRIA);

    // The altana: a wooden deck on posts above the roof, with a rail. Flat roofs get one twice as often.

    if (r() < (o.altana ?? 0) * (kind === 'flat' ? 2 : 1)) {
      const aw = Math.min(3.6, w - 1.5), ad = 2.6 + r() * .8, au = (r() < .5 ? -1 : 1) * Math.max(0, w / 2 - aw / 2 - .5);
      const av = -r() * Math.max(0, d / 2 - ad / 2 - 1), y0 = top + .3, yd = y0 + (kind === 'flat' ? 1.1 : rh + .2), ph = yd + 1 - y0;
      for (const [su, sv] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) fbox(au + su * (aw / 2 - .07), av + sv * (ad / 2 - .07), y0 + ph / 2, .14, ph, .14, TERRACE);
      fbox(au, av, yd, aw, .12, ad, TERRACE);
      for (const sv of [-1, 1]) fbox(au, av + sv * (ad / 2 - .07), yd + .9, aw, .08, .08, TERRACE);
    }

    // Funnel chimneys: a slim shaft under a wide upturned cone, near the side walls.

    for (let c = o.chim[0] + Math.floor(r() * (o.chim[1] - o.chim[0] + 1)); c > 0; c--) {
      const cu = (r() < .5 ? -1 : 1) * Math.max(0, w / 2 - .6 - r() * w * .2), cv = (r() - .35) * d * .7, ch = rh + 1.4 + r() * 1.2, rgb = pick(r, CHIMNEYS);
      cyl(cu, cv, top + ch / 2, .5, ch, rgb);
      cyl(cu, cv, top + ch + .45, 1.2 + r() * .3, 1, rgb, 'cone', Math.PI);
    }

    // A polifora: a row of pointed lights in a white stone frame, lit together, often over a balcony.

    const polifora = (u0, y, m, lw, lh, balc) => {
      const gap = .26, gw = m * lw + (m - 1) * gap, on = r() < .45;
      fbox(u0, vf + .03, y + (lh + lw * .6) / 2, gw + .5, lh + lw * .6 + .45, .06, ISTRIA);
      for (let i = 0; i < m; i++) {
        const u = u0 + (i + .5 - m / 2) * (lw + gap);
        if (on) pane(u, vf + .08, y + lh / 2, lw, lh, LAMP); else fbox(u, vf + .07, y + lh / 2, lw, lh, .06, DARK);
        arch(u, vf + .07, y + lh, lw, DARK);
      }
      if (balc) {
        fbox(u0, vf + .45, y - .08, gw + .7, .16, .9, ISTRIA);
        fbox(u0, vf + .86, y + .45, gw + .7, .9, .08, tone(ISTRIA, .92));
      }
      return gw;
    };

    // A single pointed window with green shutters open against the wall.

    const shut = pick(r, SHUTTERS);
    const mono = (u, y, lw, lh) => {
      fbox(u, vf + .06, y + lh / 2, lw, lh, .06, DARK);
      arch(u, vf + .06, y + lh, lw, DARK);
      for (const e of [-1, 1]) fbox(u + e * (lw * .75 + .05), vf + .07, y + lh / 2, lw / 2, lh + .3, .05, shut);
    };

    // The piano nobile: a central polifora, flanked by shuttered windows where there is room.

    if (n > 0 && r() < (o.poli ?? 0)) {
      const m = Math.max(2, Math.min(o.lights[0] + Math.floor(r() * (o.lights[1] - o.lights[0] + 1)), Math.floor((w - 1.5) / 1.15)));
      const y = gf + .7, gw = polifora(0, y, m, .85, Math.min(2, fh - 1.3), r() < (o.balc ?? .5));
      if (w - gw > 4.6) for (const e of [-1, 1]) mono(e * (gw / 2 + 1.5), y + .1, .8, 1.6);
      if (n > 1 && r() < (o.poli2 ?? 0)) polifora(0, gf + fh + .7, Math.max(2, m - 1), .8, Math.min(1.8, fh - 1.3), r() < .3);
    } else if (n > 0 && r() < (o.shutters ?? .5)) {
      const m = Math.max(1, Math.min(3, Math.round(w / 3.4)));
      for (let i = 0; i < m; i++) mono((i + .5 - m / 2) * w / m, gf + n * fh - fh + .7, .8, 1.5);
    }

    // The street front. A portico stands on white columns under a stone beam, with lit shops behind. Otherwise a
    // door or a wide water gate opens in a white frame.

    if (por) {
      const bays = Math.max(2, Math.round(w / 3.2)), v = vf - .35;
      for (let i = 0; i <= bays; i++) {
        const u = -w / 2 + .3 + i * (w - .6) / bays;
        cyl(u, v, (gf - .5) / 2, .5, gf - .5, ISTRIA);
        fbox(u, v, gf - .45, .75, .3, .75, ISTRIA);
      }
      fbox(0, vf - .2, gf - .15, w + .1, .5, .45, ISTRIA);
      for (let i = 0; i < bays; i++) {
        const u = (i + .5 - bays / 2) * w / bays;
        if (r() < .5) pane(u, vf - por + .05, 1.4, w / bays - 1, 2.2, [.75, .45, .2]);
        else fbox(u, vf - por + .04, 1.3, w / bays - 1.2, 2.4, .06, DARK);
      }
    } else {
      const big = o.gate && w > 7, dw = big ? 2.2 : 1.2, dh = big ? 3.3 : 2.4, du = big ? 0 : (r() - .5) * Math.max(0, w - 3);
      fbox(du, vf + .03, dh / 2 + .1, dw + .5, dh + .4, .06, ISTRIA);
      if (r() < .35) pane(du, vf + .08, dh / 2, dw, dh - .1, LAMP); else fbox(du, vf + .07, dh / 2, dw, dh, .06, pick(r, DOORS));
      if (big) arch(du, vf + .07, dh, dw, ISTRIA);
    }
    return { p, W0, w, d, sg, side, top, pal, roofM, at, block, fbox, cyl };
  }

  // The yard behind, with a tree now and then.

  const behind = (h, x, z, s, st, r, t) => {
    yard(h.p, x, z, s, st, r);
    if (h.p.back > 3 && r() < t) tree(...h.at((r() - .5) * Math.max(0, h.w - 3), -h.d / 2 - h.p.back - .25), r, 'fruit');
  };

  const casa = (x, z, s, st, r) => house(x, z, s, st, r, { depth: [10, 14], floors: 2 + (r() < .5), ground: ['plaster', 'plaster', 'ashlar'],
    roof: ['hip', 'gable', 'gable', 'flat'], altana: .35, chim: [1, 3], poli: .6, lights: [2, 3], balc: .5, shutters: .7 });

  // A brick campanile: a slim shaft with corner strips, a white belfry and a spire, a lead pyramid or an onion.

  function campanile(h, st, r) {
    const { block, fbox, cyl } = h, ts = h.side - .2, tu = h.sg * h.W0 / 2, tv = h.d / 2 - ts / 2 - (r() < .5 ? 0 : 1.5);
    const ht = 24 + r() * 10, brick = pick(r, BRICK), dk = tone(brick, .8), bh = 3.6;
    fbox(tu, tv, .6, ts + .3, 1.2, ts + .3, ISTRIA);
    block(tu, tv, 0, ts, ts, ht, [SKINS.blindAshlar, brick], { lit: 0 });
    for (const [su, sv] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) fbox(tu + su * (ts / 2 - .15), tv + sv * (ts / 2 - .15), ht / 2, .4, ht, .4, dk);
    block(tu, tv, ht, ts, ts, bh, [SKINS.blindAshlar, ISTRIA], { lit: 0 });
    fbox(tu, tv, ht + bh * .5, ts + .08, bh * .6, ts * .45, DARK);
    fbox(tu, tv, ht + bh * .5, ts * .45, bh * .6, ts + .08, DARK);
    fbox(tu, tv, ht + bh + .2, ts + .6, .4, ts + .6, ISTRIA);
    const y = ht + bh + .4, cap = pick(r, ['spire', 'spire', 'pyr', 'onion']);
    let tip;
    if (cap === 'spire') {
      block(tu, tv, y, ts * .8, ts * .8, 2.2, [SKINS.blindAshlar, brick], { shape: 'oct', lit: 0 });
      cyl(tu, tv, y + 2.2 + ts * 1.2, ts * .85, ts * 2.4, brick, 'cone');
      tip = y + 2.2 + ts * 2.4;
    } else if (cap === 'pyr') {
      block(tu, tv, y, ts + .2, ts + .2, ts * 1.5, [SKINS.slate, r() < .5 ? COPPER : LEAD], { shape: 'pyr', lit: 0 });
      tip = y + ts * 1.5;
    } else {
      cyl(tu, tv, y + .8, ts * .7, 1.6, ISTRIA);
      cyl(tu, tv, y + 2.3, ts * .95, 1.6, COPPER);
      cyl(tu, tv, y + 3.1 + ts * .5, ts * .95, ts, COPPER, 'cone');
      tip = y + 3.1 + ts;
    }
    fbox(tu, tv, tip + .6, .2, 1.2, .2, GOLD);
  }

  return {

    // A narrow stucco house of three or four storeys, with a bifora or trifora on the piano nobile, shuttered windows,
    // funnel chimneys and sometimes an altana.

    ve_casa(x, z, s, st, b, r) { behind(casa(x, z, s, st, r), x, z, s, st, r, .3); },

    // A Gothic palazzo: a white stone ground floor with a water gate, a wide polifora over a long balcony on the piano
    // nobile, often a second one above, a cornice and sometimes merlons.

    ve_palazzo(x, z, s, st, b, r) {
      const h = house(x, z, s, st, r, { depth: [13, 17], floors: 3, gf: 4.4 + r() * .6, fh: 3.4 + r() * .3, ground: ['ashlar'],
        upper: ['plaster', 'plaster', 'plaster', 'ashlar'], roof: ['hip', 'hip', 'flat'], merlons: .3, altana: .2, chim: [2, 4],
        poli: 1, lights: [4, 6], balc: .85, poli2: .6, gate: true });
      behind(h, x, z, s, st, r, .45);
    },

    // Shops under a portico of white columns along the street, with rooms above.

    ve_arcade(x, z, s, st, b, r) {
      const h = house(x, z, s, st, r, { depth: [10, 14], floors: 2 + (r() < .4), gf: 3.9 + r() * .4, portico: 2.6 + r() * .6,
        ground: ['plaster'], roof: ['gable', 'gable', 'hip'], altana: .25, chim: [1, 2], poli: .35, lights: [2, 3], balc: .3, shutters: .8 });
      behind(h, x, z, s, st, r, .2);
    },

    // A house round a small paved court, with a white well head and a loggia in the back wing.

    ve_court(x, z, s, st, b, r) {
      const h = house(x, z, s, st, r, { depth: [8, 10], floors: 2 + (r() < .5), ground: ['plaster', 'ashlar'], roof: ['hip', 'gable', 'flat'],
        altana: .3, chim: [1, 2], poli: .5, lights: [2, 4], balc: .4, shutters: .6 });
      const { p, w, d, block, fbox, cyl, pal, roofM } = h, room = 2 * p.back + .5;
      if (room < 11) return behind(h, x, z, s, st, r, .3);
      const hd = Math.min(5 + r() * 2, room - 6), vb = -d / 2 - room + hd / 2 + .3, court = room - hd - .3, vc = -d / 2 - court / 2;
      fbox(0, vc, .04, w - .3, .08, court, tone(ISTRIA, .7));
      const wu = (r() - .5) * Math.max(0, w - 4);
      cyl(wu, vc, .5, 1.1, 1, ISTRIA);
      cyl(wu, vc, 1.07, 1.3, .14, tone(ISTRIA, .95));
      for (const e of [-1, 1]) fbox(wu + e * .5, vc, 1.6, .06, 1.2, .06, DARK);
      fbox(wu, vc, 2.2, 1.06, .06, .06, DARK);

      // The back wing: an open loggia on columns facing the court, a floor of rooms over it and a low roof.

      const lg = 2.2, gh = 3.6, uh = 3.1, k = r(), wR = () => steady(r, k);
      block(0, vb - lg / 2, 0, w, hd - lg, gh, [SKINS.plaster, pal.stucco], { lit: st.lit }, wR());
      block(0, vb, gh, w, hd, uh, [SKINS.plaster, pal.stucco], { lit: st.lit * .8 }, wR());
      const bays = Math.max(2, Math.round(w / 2.8)), cv = vb + hd / 2 - .3;
      for (let i = 0; i <= bays; i++) cyl(-w / 2 + .3 + i * (w - .6) / bays, cv, (gh - .3) / 2, .4, gh - .3, ISTRIA);
      fbox(0, cv + .1, gh - .1, w, .4, .4, ISTRIA);
      fbox(0, vb, gh + uh + .15, w + .4, .3, hd + .4, ISTRIA);
      block(0, vb, gh + uh + .3, w + .5, hd + .6, Math.min(w, hd) * .25, roofM, { shape: 'gable', lit: 0 });
      if (r() < .4) tree(...h.at((r() < .5 ? -1 : 1) * Math.max(0, w / 2 - 1.8), vc + (r() - .5) * court * .4), r, 'fruit');
    },

    // A low plain house for the back lanes: one or two floors of faded stucco, a funnel chimney, sometimes an altana.

    ve_small(x, z, s, st, b, r) {
      const h = house(x, z, s, st, r, { depth: [7, 9], floors: 1 + (r() < .5), gf: 3.2 + r() * .3, fh: 2.9, stucco: r() < .6 ? FADED : STUCCO,
        ground: ['plaster'], roof: ['hip', 'gable', 'gable', 'flat'], altana: .15, chim: [1, 1], poli: .1, lights: [2, 2], shutters: .5 });
      behind(h, x, z, s, st, r, .45);
    },

    // A slim brick bell tower beside a small house. Most lots of this kind build a plain casa, so towers stay rare.

    ve_campanile(x, z, s, st, b, r) {
      if (r() >= .35) return behind(casa(x, z, s, st, r), x, z, s, st, r, .3);
      const h = house(x, z, s, st, r, { depth: [8, 11], floors: 1 + (r() < .6), tower: true, ground: ['plaster', 'ashlar'],
        roof: ['hip', 'gable'], altana: 0, chim: [1, 1], poli: .3, lights: [2, 2], shutters: .6 });
      if (h.side) campanile(h, st, r);
      behind(h, x, z, s, st, r, .3);
    },
  };
}

export function landmarks(H) { return {}; }
