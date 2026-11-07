// Nihongai: Jinteki's garden company town. Tile-roof towers and lantern streets, green arcologies,
// a calm campus, and one hot neon pocket at New Akiba. Design: design/districts/nihongai.md.
// Lot kits read H.frame() and fall back to an s × s square. Kits swap by sub-area (see SWAP).

import { trees } from './nature.js';
import { ISLE } from '../isle.js';

// Dials for the showcase, which passes a plain mixStyle without a district palette.

const NIH = {
  id: 'nihongai', w: .85, h0: 12, h1: 55, density: .68, neon: .35, lit: .17, grime: .08,
  base: [.08, .085, .08], win: [1, .74, .44], street: [.95, .86, .72],
  signs: [[1.8, .18, .22], [1.6, .4, 1], [.3, 1.5, .8], [1.7, 1.2, .4]],
};

// Sub-area centres in map px. Mache-Chindul keeps a small cell, the campus a wide one.

const AREAS = [
  ['Mache-Chindul Park', [335, 580], 1.9],
  ['Jinteki Biotech', [318, 632], .8],
  ['Tourist Quarter', [436, 676], 1],
  ['New Akiba Quarter', [312, 715], 1],
  ['Residential Quarter', [411, 752], 1],
].map(([name, [u, v], k]) => ({ name, x: (u - 680) * 3.6, z: (v - 390) * 3.6, k }));

// Lot kits trade places by sub-area. Arrays pick one at random; the kit's own name keeps it.

const SWAP = {
  'New Akiba Quarter': {
    nih_pavilion: ['nih_stalls', 'nih_akibaStack', 'nih_pavilion'], nih_ngSlab: ['nih_akibaStack', 'nih_capsule', 'nih_ngSlab'],
    nih_tileTower: ['nih_akibaStack', 'nih_tileTower'], nih_garden: ['nih_stalls', 'nih_garden'], nih_onsen: 'nih_stalls',
    nih_campusHall: 'nih_akibaStack', nih_greenArc: ['nih_akibaStack', 'nih_greenArc'],
  },
  'Jinteki Biotech': {
    nih_pavilion: ['nih_garden', 'nih_garden', 'nih_pavilion'], nih_ngSlab: ['nih_campusHall', 'nih_garden'], nih_tileTower: 'nih_campusHall',
    nih_akibaStack: 'nih_campusHall', nih_capsule: 'nih_campusHall', nih_stalls: 'nih_garden', nih_onsen: 'nih_garden',
    nih_greenArc: ['nih_campusHall', 'nih_greenArc'],
  },
  'Mache-Chindul Park': Object.fromEntries(['pavilion', 'tileTower', 'ngSlab', 'greenArc', 'campusHall', 'akibaStack', 'capsule', 'stalls', 'onsen'].map(k => ['nih_' + k, 'nih_garden'])),
  'Residential Quarter': {
    nih_pavilion: ['nih_pavilion', 'nih_ngSlab', 'nih_garden'], nih_tileTower: ['nih_ngSlab', 'nih_tileTower'],
    nih_akibaStack: ['nih_ngSlab', 'nih_greenArc'], nih_stalls: ['nih_garden', 'nih_pavilion'], nih_capsule: ['nih_ngSlab', 'nih_capsule'],
  },
  'Tourist Quarter': {
    nih_ngSlab: ['nih_tileTower', 'nih_pavilion', 'nih_ngSlab'], nih_akibaStack: ['nih_tileTower', 'nih_greenArc'],
    nih_capsule: ['nih_capsule', 'nih_tileTower'], nih_stalls: 'nih_pavilion',
  },
};

// Palette. Signs bloom; structure stays dark.

const RED = [1.8, .18, .22], SAKURA = [1.6, .4, 1], JADE = [.3, 1.5, .8], GOLD = [1.7, 1.2, .4];
const LANTERN = [1.5, .45, .16], PAPER = [1.25, .95, .6], COOL = [.85, .95, 1.05];

// Window tones per building: lantern amber, paper, soft warm white.

const PANES = [[1, .62, .3], [1, .68, .36], [1, .76, .48], [1, .86, .66]];

// The tone hashes off the lot position, so the random stream and the layout stay as they were.

const pane = (x, z) => PANES[Math.floor(Math.abs(x * 7.3 + z * 3.1)) % PANES.length];

const TILE = [.04, .045, .05], WOOD = [.08, .045, .03], STONE = [.12, .12, .11], MOSS = [.025, .05, .03], WATER = [.012, .026, .034];
const AKIBA_RGB = [[.2, 1.4, 1.8], [1.8, .2, 1.2], [1.6, 1.4, .3], [.4, 1.6, .5], [1.8, .3, .25], [.6, .5, 1.8]];
const WORDS = ['居酒屋', '寿司', 'ラーメン', '茶屋', '旅館', '酒場', '焼鳥', 'カラオケ'];
const BOARDS = ['IZAKAYA', 'SUSHI', 'RAMEN', 'SAKE', 'KARAOKE', 'PACHINKO', '日本街'];
const AKIBA = ['ジャンク', '電脳', 'CHIPS', 'MODS', 'ANIME', 'ROBOT', 'GAMES', '中古', 'HOLO', 'RIGS'];

const pick = (r, a) => a[Math.floor(r() * a.length)];
const dim = (rgb, k) => rgb.map(c => c * k);

// Sub-lot override: block kits and landmarks run lot kits on a rectangle of their own.

let OVR = null, PADS = null;

export function kits(H) {
  const { GLOWS, SKINS, THREE, beacon, bld, glow, helipad, holo, lerp, prop, put, sign, stringLights, textSign } = H;
  const pool = (x, z, rad, rgb) => H.pool?.(x, z, rad, rgb);

  // Own instanced foliage: cloud-pruned pads and sakura crowns.

  if (!PADS) {
    PADS = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.5, 1),
      new THREE.MeshStandardMaterial({ roughness: .9, metalness: 0, flatShading: true }), 12000);
    H.decor.add(PADS);
    H.instanced(PADS);
  }
  const pad = (x, y, z, sx, sy, sz, rgb) => {
    put(PADS, x, y, z, sx, sy, sz, 0, 0, rgb);
    PADS.instanceMatrix.needsUpdate = true;
    if (PADS.instanceColor) PADS.instanceColor.needsUpdate = true;
  };

  // Forest trees from the nature library.

  const forest = (kind, x, z, h, r, tint, y = 0) => {
    const T = trees(), m = T?.[kind];
    if (!m) return pad(x, y + h * .6, z, h * .7, h * .8, h * .7, MOSS);
    const v = 1.3 + 1.1 * r();
    put(m, x, y, z, h * .9, h, h * .9, r() * 6.3, 0, dim(tint, v));
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  };

  // Niwaki: a leaning trunk with two or three flat cloud pads.

  const niwaki = (x, z, h, r, y = 0) => {
    const lean = (r() - .5) * .4;
    prop('cyl', x, y + h * .4, z, .35, h * .8, .35, WOOD, r() * 6.3, lean);
    const g = [.025 + .015 * r(), .055 + .025 * r(), .03];
    for (let k = r() < .5 ? 2 : 3, q = 0; q < k; q++) {
      const t = .55 + q * .2, w = h * (.75 - q * .15);
      pad(x + (r() - .5) * h * .4, y + h * t, z + (r() - .5) * h * .4, w, h * .22, w * (.8 + .3 * r()), g);
    }
  };

  // Sakura: a round pink crown with a pink pool beneath.

  const sakura = (x, z, h, r, y = 0) => {
    prop('cyl', x, y + h * .3, z, .4, h * .6, .4, WOOD);
    pad(x, y + h * .72, z, h * .95, h * .6, h * .95, [.28 + .1 * r(), .1, .17]);
    pool(x, z, h * .7, [.1, .03, .06]);
  };

  // Tōrō stone lantern.

  const toro = (x, z, y = 0, k = .7) => {
    prop('box', x, y + .5, z, .5, 1, .5, STONE);
    glow(x, y + 1.25, z, .55, .45, .55, dim(PAPER, k));
    prop('cone', x, y + 1.7, z, 1.2, .5, 1.2, STONE);
    pool(x, z, 3, dim(PAPER, .05));
  };

  // Torii gate facing along n, glowing lacquer red.

  const torii = (x, z, n, span, h) => {
    const t = [-n[1], n[0]], red = [.42, .035, .025];
    for (const s of [-1, 1]) glow(x + t[0] * s * span / 2, h / 2, z + t[1] * s * span / 2, .6, h, .6, red);
    glow(x, h - .2, z, Math.abs(t[0]) * (span + 3) + .7, .5, Math.abs(t[1]) * (span + 3) + .7, red);
    glow(x, h - 1.4, z, Math.abs(t[0]) * (span + .6) + .4, .35, Math.abs(t[1]) * (span + .6) + .4, red);
  };

  // Frame helpers.

  const dims = s => {
    if (OVR) return [OVR.w, OVR.d];
    const f = H.frame();
    return f?.w ? [Math.min(f.w - 2, 60), Math.min(f.d - 2, 60)] : [s, s];
  };
  const frontN = () => {
    const v = OVR?.front ?? H.frame()?.front ?? { x: 0, z: 1 };
    return Math.abs(v.x) > Math.abs(v.z) ? [Math.sign(v.x), 0] : [0, Math.sign(v.z) || 1];
  };
  const faceIdx = n => n[0] > 0 ? 0 : n[0] < 0 ? 1 : n[1] > 0 ? 2 : 3;
  const ryOf = n => Math.atan2(n[0], n[1]);

  // Point on the face of a w × d box with normal n, `along` the face, `o` out from it.

  const fp = (x, z, w, d, n, along, o = .3) => {
    const out = (n[0] ? w : d) / 2 + o;
    return [x + n[0] * out - n[1] * along, z + n[1] * out + n[0] * along];
  };
  const span = (w, d, n) => n[0] ? d : w;

  // Box sized c across the face and t through it.

  const slabOn = (px, y, pz, n, across, h, t, rgb) => prop('box', px, y, pz, n[0] ? t : across, h, n[0] ? across : t, rgb);
  const lightOn = (px, y, pz, n, across, h, t, rgb) => glow(px, y, pz, n[0] ? t : across, h, n[0] ? across : t, rgb);

  // Vertical kanji sign: one glyph per text slot on a dark blade.

  const vsign = (text, x, z, w, d, n, along, y0, c, rgb) => {
    const chars = [...text], hh = chars.length * c * 1.15 + .6;
    const [bx, bz] = fp(x, z, w, d, n, along, .5);
    slabOn(bx, y0 + hh / 2, bz, n, c * 1.3, hh, .35, [.05, .015, .015]);
    const t = [-n[1], n[0]];
    for (const s of [-1, 1]) glow(bx + t[0] * s * c * .66, y0 + hh / 2, bz + t[1] * s * c * .66, .12, hh, .12, dim(rgb, .35));
    const [gx, gz] = fp(x, z, w, d, n, along, .72);
    chars.forEach((ch, i) => textSign(ch, gx, y0 + hh - .3 - (i + .5) * c * 1.15, gz, c * 4, c, ryOf(n), rgb));
  };

  // Horizontal board with a dark backing.

  const board = (text, x, z, w, d, n, along, y, bw, rgb, back = true) => {
    if (back) { const [bx, bz] = fp(x, z, w, d, n, along, .2); slabOn(bx, y, bz, n, bw * 1.05, bw * .3, .25, [.03, .025, .02]); }
    const [px, pz] = fp(x, z, w, d, n, along, .4);
    textSign(text, px, y, pz, bw, bw / 4, ryOf(n), rgb);
  };

  // Tile eave: wide dark slab with lantern light along its underside.

  const eave = (x, y, z, w, d, o, k = .45, rgb = GOLD) => {
    prop('box', x, y, z, w + 2 * o, .35, d + 2 * o, TILE);
    glow(x, y - .3, z + d / 2 + o - .2, w + 2 * o - .4, .12, .12, dim(rgb, k));
    glow(x, y - .3, z - d / 2 - o + .2, w + 2 * o - .4, .12, .12, dim(rgb, k));
    glow(x + w / 2 + o - .2, y - .3, z, .12, .12, d + 2 * o - .4, dim(rgb, k));
    glow(x - w / 2 - o + .2, y - .3, z, .12, .12, d + 2 * o - .4, dim(rgb, k));
  };
  const hip = (x, y, z, w, d, h, st, r) => bld(x, z, w, d, h, { ...st, base: [.05, .055, .06], grime: 0 }, r, { y0: y, shape: 'pyr', roof: false, lit: 0, skin: SKINS.sparse });

  // Pagoda crown: stacked eaves and short drums, a finial on top. Returns the top height.

  const pagoda = (x, y, z, w, d, tiers, st, r, rgb = GOLD) => {
    let cw = w, cd = d;
    for (let k = 0; k < tiers; k++) {
      eave(x, y, z, cw, cd, 1.6 + cw * .06, .5, rgb);
      cw *= .78; cd *= .78;
      if (k < tiers - 1) { bld(x, z, cw, cd, 3.4, { ...st, lit: .32 }, r, { y0: y + .2, roof: false, skin: SKINS.bands }); y += 3.6; }
    }
    hip(x, y + .2, z, cw * 1.25, cd * 1.25, Math.min(cw, cd) * .45, st, r);
    y += Math.min(cw, cd) * .45;
    prop('cyl', x, y + 2, z, .25, 4, .25, [.2, .16, .08]);
    glow(x, y + 4.2, z, .5, .5, .5, dim(rgb, .8));
    return y + 4.5;
  };

  // Hanging chōchin lanterns along a face.

  const lanterns = (x, z, w, d, n, y, count, rgb = LANTERN) => {
    const sp = span(w, d, n) * .8;
    for (let k = 0; k < count; k++) {
      const [px, pz] = fp(x, z, w, d, n, count > 1 ? -sp / 2 + sp * k / (count - 1) : 0, .9);
      put(GLOWS.sphere, px, y, pz, .55, .8, .55, 0, 0, rgb);
    }
  };

  // A holo mascot: a soft figure standing on a projector ring.

  const mascot = (x, y, z, h, r) => {
    const c = dim(pick(r, [SAKURA, [.4, 1.2, 1.6], GOLD]), .4);
    put(GLOWS.ring, x, y + .2, z, h * .5, 1, h * .5, 0, 0, [.3, 1.1, 1.4]);
    glow(x, y + h * .35, z, h * .22, h * .55, h * .12, c);
    put(GLOWS.sphere, x, y + h * .8, z, h * .3, h * .3, h * .3, 0, 0, c);
  };

  const nst = (st, x, z) => ({ ...(st.signs ? st : { ...st, ...NIH }), win: pane(x, z) });
  const warm = (st, lit) => ({ ...st, lit: lit * .75 });

  // ---------- lot kits ----------

  const K = {
    // Tile-roof shop or restaurant: one or two floors, noren glow, lanterns, a kanji board and sometimes a roof mascot.

    nih_pavilion(x, z, s, st, b, r) {
      st = nst(st, x, z);
      const [W, D] = dims(s), n = frontN(), w = Math.min(W - 2, 26), d = Math.min(D - 2, 22);
      const h1 = (4.5 + r() * 2.5) * Math.min(b, 1.2);
      bld(x, z, w, d, h1, warm(st, .55), r, { roof: false, skin: SKINS.bands });
      eave(x, h1, z, w, d, 1.8);
      let top = h1 + .2;
      if (r() < .55 && w > 8) {
        const w2 = w * .7, d2 = d * .7, h2 = 3.6;
        bld(x, z, w2, d2, h2, warm(st, .4), r, { y0: top, roof: false, skin: SKINS.bands });
        top += h2;
        eave(x, top, z, w2, d2, 1.4, .35);
        top += .2;
        hip(x, top, z, w2 * 1.15, d2 * 1.15, Math.min(w2, d2) * .35, st, r);
      } else hip(x, top, z, w * 1.1, d * 1.1, Math.min(w, d) * .3, st, r);

      // Street face: noren glow, door lanterns, board.

      const sp = span(w, d, n), [nx, nz] = fp(x, z, w, d, n, 0, .08);
      lightOn(nx, 1.6, nz, n, sp * .75, 2.4, .15, dim(PAPER, .45 + .3 * r()));
      lanterns(x, z, w, d, n, h1 - 1, Math.min(5, 2 + Math.floor(sp / 6)), r() < .6 ? LANTERN : PAPER);
      board(pick(r, r() < .6 ? WORDS : BOARDS), x, z, w, d, n, (r() - .5) * sp * .3, h1 - 2.3, Math.min(8, sp * .5), dim(pick(r, [GOLD, RED, PAPER]), .8));
      pool(...fp(x, z, w, d, n, 0, 3), 6, [.12, .07, .04]);
      if (areaOf(x, z) === 'Tourist Quarter') for (const u of [-.35, .35]) {
        const [ax, az] = fp(x, z, w, d, n, u * sp, .5), [bx, bz] = fp(x, z, w, d, n, u * sp * .4, 13);
        stringLights([ax, h1 - .6, az], [bx, h1 + 1.5, bz], .8, 6, dim(r() < .7 ? LANTERN : RED, 1.1));
      }
      if (r() < .45) mascot(x + (r() - .5) * w * .3, top + 2, z + (r() - .5) * d * .3, 5 + r() * 4, r);
      if (W - w > 5) niwaki(x + Math.sign(r() - .5) * (W / 2 - 1.5), z + (r() - .5) * d * .6, 3 + r() * 2, r);
    },

    // Fusion tower: a stretched pagoda. The shaft rises in tiers that step in a little, each closed by a thin tile
    // eave with lantern light beneath, so the roofline repeats up the whole height. A shallow hip and a finial cap it.

    nih_tileTower(x, z, s, st, b, r) {
      st = nst(st, x, z);
      const [W, D] = dims(s), n = frontN(), tw = Math.min(W - 4, 16 + r() * 10), td = Math.min(D - 4, 16 + r() * 10);
      const h = (55 + r() * 85) * Math.min(b, 1.3);
      const pw = Math.min(W - 2, tw + 6), pd = Math.min(D - 2, td + 6), ph = 7;
      bld(x, z, pw, pd, ph, warm(st, .55), r, { roof: false, skin: SKINS.bands });
      eave(x, ph, z, pw, pd, 1.6);
      const tiers = 3 + Math.floor((h - ph) / 38), seg = (h - ph) / tiers, skin = r() < .5 ? SKINS.bands : SKINS.fins;
      const rgb = r() < .7 ? GOLD : RED;
      let y = ph, cw = tw, cd = td;
      for (let k = 0; k < tiers; k++) {
        bld(x, z, cw, cd, seg - .5, st, r, { y0: y, roof: false, skin });
        y += seg;
        eave(x, y - .4, z, cw, cd, 1.1 + cw * .05, .75, rgb);
        cw *= .94; cd *= .94;
      }
      hip(x, y - .2, z, cw * 1.12, cd * 1.12, Math.min(cw, cd) * .32, st, r);
      prop('cyl', x, y + Math.min(cw, cd) * .32 + 3, z, .25, 6, .25, [.2, .16, .08]);
      glow(x, y + Math.min(cw, cd) * .32 + 6.3, z, .5, .5, .5, dim(rgb, .8));

      // Vertical kanji down the street face; neon boards on the podium.

      const word = pick(r, WORDS), c = 2 + r() * 1.4;
      vsign(word, x, z, tw, td, n, (r() < .5 ? -1 : 1) * span(tw, td, n) * .32, ph + 4 + r() * 10, c, RED);
      board(pick(r, BOARDS), x, z, pw, pd, n, 0, ph - 2.4, Math.min(10, span(pw, pd, n) * .5), dim(pick(r, st.signs), .7));
      lanterns(x, z, pw, pd, n, ph - .9, 4);
      if (r() < st.neon) sign(x, z, tw, td, h, st, r, dim(pick(r, st.signs), .6), { face: faceIdx([-n[0], -n[1]]) });
      pool(...fp(x, z, pw, pd, n, 0, 3), 8, [.12, .06, .04]);
    },

    // NeoTokyo-modern residential slab: balcony bands, planted columns, a small roof garden.

    nih_ngSlab(x, z, s, st, b, r) {
      st = nst(st, x, z);
      const [W, D] = dims(s), along = W >= D, n = frontN();
      const w = along ? W - 2 : Math.min(W - 2, 13 + r() * 6), d = along ? Math.min(D - 2, 13 + r() * 6) : D - 2;
      const h = (38 + r() * 70) * Math.min(b, 1.3), ls = { ...st, base: [.11, .115, .11], lit: .1 + .12 * r() };
      bld(x, z, w, d, h, ls, r, { roof: false, skin: SKINS.bands });

      // Planter columns on the long faces read as green-wall strips.

      for (const side of [-1, 1]) {
        if (r() < .35) continue;
        const nn = along ? [0, side] : [side, 0], u = (r() - .5) * span(w, d, nn) * .6;
        const [px, pz] = fp(x, z, w, d, nn, u, .4);
        slabOn(px, h * .45, pz, nn, 2.5, h * .85, .8, [.02, .05, .028]);
        lightOn(...fp(x, z, w, d, nn, u, .85).flatMap((v, i) => i ? [h * .45, v] : [v]), nn, 1, h * .85, .1, dim(JADE, .6));
      }

      // Roof garden: hedge, niwaki, a lit pergola.

      prop('box', x, h + .3, z, w * .7, .6, d * .7, MOSS);
      for (let k = 2 + Math.floor(r() * 3); k > 0; k--) niwaki(x + (r() - .5) * w * .6, z + (r() - .5) * d * .6, 2.5 + r() * 2, r, h + .6);
      glow(x + (r() - .5) * w * .3, h + 3, z + (r() - .5) * d * .3, 4, .2, 3, dim(PAPER, .3));
      const [ex, ez] = fp(x, z, w, d, n, 0, .1);
      lightOn(ex, 2, ez, n, 6, 3.5, .15, dim(PAPER, .5));
      pool(...fp(x, z, w, d, n, 0, 3), 7, [.1, .08, .06]);
      if (r() < .3) board(pick(r, BOARDS), x, z, w, d, n, span(w, d, n) * .3, 5, 6, dim(pick(r, st.signs), .55));
    },

    // Green arcology: three setback tiers, each terrace planted, garden strips on the faces, a roof grove and crown ring.

    nih_greenArc(x, z, s, st, b, r) {
      st = nst(st, x, z);
      const [W, D] = dims(s), gs = { ...st, base: [.05, .085, .065], win: [.95, .9, .62], lit: .12 + .1 * r() };
      const total = (150 + r() * 200) * Math.min(b, 1.25), parts = [.45, .33, .22];
      let w = Math.min(W - 2, 42), d = Math.min(D - 2, 42), y = 0;
      for (let t = 0; t < 3; t++) {
        const th = total * parts[t];
        bld(x, z, w, d, th, gs, r, { y0: y, roof: false, skin: t === 1 ? SKINS.fins : SKINS.curtain });

        // Vertical garden strip on two faces.

        for (const nn of [[1, 0], [0, 1]].map(v => r() < .5 ? v : v.map(c => -c))) {
          const [px, pz] = fp(x, z, w, d, nn, (r() - .5) * span(w, d, nn) * .4, .45);
          slabOn(px, y + th / 2, pz, nn, span(w, d, nn) * .25, th * .9, .9, [.02, .055, .03]);
          glow(px, y + th * .5, pz, nn[0] ? 1.1 : 1, th * .9, nn[0] ? 1 : 1.1, dim(JADE, .5));
        }
        y += th;
        const nw = w * .76, nd = d * .76;

        // Terrace: planter rim, trees and a faint jade edge.

        prop('box', x, y + .3, z, w - .5, .6, d - .5, MOSS);
        glow(x, y + .7, z + d / 2 - .4, w - 1, .2, .2, dim(JADE, .8));
        glow(x, y + .7, z - d / 2 + .4, w - 1, .2, .2, dim(JADE, .8));
        glow(x + w / 2 - .4, y + .7, z, .2, .2, d - 1, dim(JADE, .8));
        glow(x - w / 2 + .4, y + .7, z, .2, .2, d - 1, dim(JADE, .8));
        if (t < 2) for (let k = 0; k < 4; k++) {
          const a = k * Math.PI / 2 + r() * .6, rx = (w + nw) / 4, rz = (d + nd) / 4;
          niwaki(x + Math.cos(a) * rx, z + Math.sin(a) * rz, 3 + r() * 3, r, y + .6);
        }
        if (t < 2) { w = nw; d = nd; }
      }

      // Roof grove and crown.

      for (let k = 0; k < 4; k++) (r() < .5 ? niwaki : sakura)(x + (r() - .5) * w * .6, z + (r() - .5) * d * .6, 4 + r() * 3, r, y + .6);
      put(GLOWS.ring, x, y + 2, z, Math.min(w, d) * 1.05, 1, Math.min(w, d) * 1.05, 0, 0, dim(JADE, 1.1));
      put(GLOWS.ring, x, y + 5, z, Math.min(w, d) * .8, 1, Math.min(w, d) * .8, 0, 0, dim(RED, .8));
      prop('cyl', x, y + 10, z, .5, 18, .5, [.1, .12, .1]);
      beacon(x, y + 19.5, z, r);
      if (r() < .5) holo(x, z, w, d, y - 12, r, faceIdx(frontN()), 14);
      pool(x, z, Math.max(W, D) * .6, [.03, .08, .05]);
    },

    // Jinteki campus hall: a clean round-ended slab, few lit floors, hidden roof pad and a tile-roof pavilion crown.

    nih_campusHall(x, z, s, st, b, r) {
      st = nst(st, x, z);
      const [W, D] = dims(s), along = W >= D, L = Math.min((along ? W : D) - 2, 46), T = Math.min((along ? D : W) - 2, 18 + r() * 6);
      const h = (130 + r() * 50) * Math.min(b, 1.1), cs = { ...st, base: [.07, .08, .078], win: [1, .82, .58], lit: .06 + .05 * r() };
      const core = Math.max(2, L - T), w = along ? core : T, d = along ? T : core;
      const ends = [-1, 1].map(s2 => [x + (along ? s2 * core / 2 : 0), z + (along ? 0 : s2 * core / 2)]);
      const stadium = (y0, hh, k, style, skin) => {
        bld(x, z, along ? core : T * k, along ? T * k : core, hh, style, r, { y0, roof: false, skin });
        for (const [ex, ez] of ends) bld(ex, ez, T * k, T * k, hh, style, r, { y0, roof: false, shape: 'cyl', skin });
      };

      // A thin tile plate that follows the rounded plan, with lantern light under its rim.

      const plate = (y, k, o, rgb = GOLD, lk = .4) => {
        const t = T * k + 2 * o;
        prop('box', x, y, z, along ? core : t, .4, along ? t : core, TILE);
        for (const s2 of [-1, 1]) glow(x + (along ? 0 : s2 * (t / 2 - .2)), y - .3, z + (along ? s2 * (t / 2 - .2) : 0), along ? core : .12, .12, along ? .12 : core, dim(rgb, lk));
        for (const [ex, ez] of ends) {
          prop('cyl', ex, y, ez, t, .4, t, TILE);
          put(GLOWS.ring, ex, y - .3, ez, t - .3, 1, t - .3, 0, 0, dim(rgb, lk));
        }
      };

      // The shaft wears a louvre skin and a tile plate every few dozen metres, so the eave rhythm runs all the way up.

      stadium(0, h, 1, cs, SKINS.fins);
      const bands = 2 + Math.floor(h / 55);
      for (let k = 1; k <= bands; k++) plate(h * k / (bands + 1), 1, .9, GOLD, .7);

      // Hanging-garden walls climb both long faces, lit jade from within.

      for (const s2 of [-1, 1]) for (const u of [-.3, .3]) {
        const nn = along ? [0, s2] : [s2, 0], [gx, gz] = fp(x, z, w, d, nn, u * core, .5);
        slabOn(gx, h * .45, gz, nn, 3, h * .86, .8, [.02, .05, .03]);
        lightOn(...fp(x, z, w, d, nn, u * core, .95).flatMap((v, i) => i ? [h * .45, v] : [v]), nn, 1, h * .86, .1, dim(JADE, .75));
      }

      // Lit sky lobby, then a stepped crown: a wide plate, a short setback tier, a second plate and a low roof.

      const yb = h * (.55 + .1 * r());
      stadium(yb, 3.6, 1.03, { ...cs, lit: .55 }, SKINS.bands);
      plate(h + .2, 1, 2.4, RED, 1.1);
      stadium(h + .4, 6, .78, { ...cs, lit: .35 }, SKINS.bands);
      plate(h + 6.6, .78, 1.8, GOLD, .45);
      prop('box', x, h + 7.6, z, along ? core : T * .6, 1.6, along ? T * .6 : core, [.05, .055, .06]);
      for (const [ex, ez] of ends) prop('cyl', ex, h + 7.6, ez, T * .6, 1.6, T * .6, [.05, .055, .06]);
      helipad(ends[0][0], ends[0][1], Math.min(T * .5, 10), h + 8.4, r);

      // Garden at the foot.

      const n = frontN(), [gx, gz] = fp(x, z, w, d, n, 0, 3.5);
      prop('box', gx, .1, gz, n[0] ? 5 : L, .2, n[0] ? L : 5, MOSS);
      for (let k = -1; k <= 1; k++) {
        const [tx, tz] = fp(x, z, w, d, n, k * L * .32, 3.5);
        k ? niwaki(tx, tz, 3 + r() * 2, r) : toro(tx, tz);
      }
    },

    // New Akiba stack: a podium and tower skinned in screens and signs, stalls and string lights at the street.

    nih_akibaStack(x, z, s, st, b, r) {
      st = nst(st, x, z);
      const [W, D] = dims(s), n = frontN(), w = W - 1, d = D - 1, ak = { ...st, lit: .4, grime: .25, neon: 1.1 };
      const ph = 12 + r() * 10;
      bld(x, z, w, d, ph, ak, r, { roof: false, skin: SKINS.bands });
      const tw = w * (.6 + .3 * r()), td = d * (.6 + .3 * r()), th = (30 + r() * 70) * Math.min(b, 1.3);
      bld(x, z, tw, td, th, ak, r, { y0: ph });
      holo(x, z, w, d, ph * .62, r, faceIdx(n), span(w, d, n) * .7);
      holo(x, z, tw, td, ph + th * (.4 + .3 * r()), r, faceIdx(n), 14);
      if (r() < .6) holo(x, z, tw, td, ph + th * .5, r, faceIdx([n[1], n[0]]), 12);

      // Signs stacked to the street.

      const sp = span(w, d, n);
      for (let k = 4 + Math.floor(r() * 4), y = 4; k > 0 && y < ph - 1; k--, y += 2.2 + r() * 1.5) {
        const bw = 3 + r() * Math.min(6, sp * .3);
        board(pick(r, AKIBA), x, z, w, d, n, (r() - .5) * (sp - bw), y, bw, dim(pick(r, AKIBA_RGB), .55 + .35 * r()));
      }
      for (let k = 2 + Math.floor(r() * 2); k > 0; k--) sign(x, z, tw, td, th + ph, ak, r, dim(pick(r, AKIBA_RGB), .6 + .3 * r()), { blade: true });
      vsign(pick(r, ['電脳', 'ジャンク', '中古']), x, z, w, d, n, (r() < .5 ? -1 : 1) * (sp / 2 - 1.5), 3, 1.6, dim(pick(r, AKIBA_RGB), .9));

      // Street stalls under the podium.

      const ns = Math.min(5, Math.floor(sp / 4));
      for (let k = 0; k < ns; k++) {
        const u = -sp / 2 + 2 + k * (sp - 4) / Math.max(1, ns - 1), [px, pz] = fp(x, z, w, d, n, u, 1.6);
        slabOn(px, .5, pz, n, 2.6, 1, 1.2, [.06, .06, .07]);
        prop('box', px, 2.6, pz, n[0] ? 2.4 : 3, .1, n[0] ? 3 : 2.4, pick(r, [[.05, .12, .2], [.2, .05, .12], [.12, .12, .14]]), 0, (r() - .5) * .3);
        glow(px, 1.3, pz, .9, .5, .9, dim(pick(r, AKIBA_RGB), .35));
      }
      const [ax, az] = fp(x, z, w, d, n, -sp / 2, .2), [cx, cz] = fp(x, z, w, d, n, sp / 2, .2);
      stringLights([ax, ph - 1, az], [cx, ph - 1, cz], 1.5, 8, dim(pick(r, AKIBA_RGB), .6));
      pool(...fp(x, z, w, d, n, 0, 4), 9, [.06, .08, .12]);
    },

    // Capsule hotel: a narrow dark tower whose faces are grids of lit pods.

    nih_capsule(x, z, s, st, b, r) {
      st = nst(st, x, z);
      const [W, D] = dims(s), n = frontN(), w = Math.min(W - 2, 11 + r() * 4), d = Math.min(D - 2, 11 + r() * 4);
      const h = (55 + r() * 40) * Math.min(b, 1.3);
      bld(x, z, w, d, h, { ...st, base: [.05, .05, .055], lit: .03 }, r, { roof: true, skin: SKINS.sparse });
      const sp = span(w, d, n), cols = Math.max(2, Math.min(4, Math.floor(sp / 2.6))), rows = Math.min(22, Math.floor((h - 8) / 2.5));
      const POD = [PAPER, PAPER, COOL, [1.3, .55, .8], [.6, 1, 1.2]];
      for (const nn of [n, [-n[0], -n[1]]]) for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
        if (r() > (nn === n ? .55 : .3)) continue;
        const u = (j - (cols - 1) / 2) * (sp / cols), [px, pz] = fp(x, z, w, d, nn, u, .12);
        lightOn(px, 7 + i * 2.5, pz, nn, sp / cols * .78, 1.7, .2, dim(pick(r, POD), .25 + .35 * r()));
      }
      vsign('カプセル', x, z, w, d, [n[1], n[0]], 0, 8, 2, dim(SAKURA, .8));
      const [ex, ez] = fp(x, z, w, d, n, 0, .1);
      lightOn(ex, 2, ez, n, sp * .6, 3.4, .15, dim(PAPER, .55));
      board('CAPSULE', x, z, w, d, n, 0, 5, Math.min(8, sp * .7), dim(COOL, .8));
    },

    // Microgarden: gravel, koi pond with an islet and red bridge, torii, stone lanterns, niwaki and sakura.
    // In Mache-Chindul it grows into dark preserve forest instead.

    nih_garden(x, z, s, st, b, r) {
      st = nst(st, x, z);
      const [W, D] = dims(s), n = frontN();
      if (areaOf(x, z) === 'Mache-Chindul Park') {
        prop('box', x, .08, z, W, .16, D, [.02, .035, .02]);
        for (let k = Math.min(40, Math.floor(W * D / 22)); k > 0; k--)
          forest(pick(r, ['broad', 'broad', 'fern', 'palm']), x + (r() - .5) * W, z + (r() - .5) * D, 6 + r() * 10, r, [.02, .06, .03]);
        if (r() < .5) toro(x, z, 0, .4);
        return;
      }
      prop('box', x, .08, z, W, .16, D, [.07, .07, .068]);
      const pw = W * (.35 + .2 * r()), pd = D * (.35 + .2 * r()), ox = (r() - .5) * W * .15, oz = (r() - .5) * D * .15;
      prop('cyl', x + ox, .2, z + oz, pw, .2, pd, WATER);
      for (let k = 3 + Math.floor(r() * 4); k > 0; k--) glow(x + ox + (r() - .5) * pw * .6, .32, z + oz + (r() - .5) * pd * .6, .6, .08, .25, dim(r() < .7 ? [1, .4, .1] : PAPER, .5));
      const ix = x + ox + pw * .18, iz = z + oz - pd * .12;
      prop('cyl', ix, .35, iz, pw * .25, .5, pd * .25, MOSS);
      niwaki(ix, iz, 2.5 + r(), r, .5);
      const red = [.4, .04, .03];
      H.beam([x + ox - pw * .5, .3, z + oz], [x + ox - pw * .2, 1.2, z + oz], .5, red, 'glow');
      H.beam([x + ox - pw * .2, 1.2, z + oz], [x + ox + pw * .05, .3, z + oz], .5, red, 'glow');
      const [tx, tz] = fp(x, z, W - 3, D - 3, n, 0, -1.5);

      // Torii stay rare, so each one marks a shrine garden rather than every lawn.

      if (r() < .12 && areaOf(x, z) !== 'Jinteki Biotech') torii(tx, tz, n, 3.5, 5);
      for (let k = 2 + Math.floor(r() * 3); k > 0; k--) toro(x + (r() < .5 ? -1 : 1) * W * (.3 + .15 * r()), z + (r() - .5) * D * .8);
      for (let k = 3 + Math.floor(r() * 4); k > 0; k--) {
        const a = r() * 6.3, px = x + Math.cos(a) * W * .38, pz = z + Math.sin(a) * D * .38;
        r() < .3 ? sakura(px, pz, 4 + r() * 3, r) : niwaki(px, pz, 2.5 + r() * 3, r);
      }
      if (W > 18 && r() < .5) {
        const cx = x - ox * 2, cz = z - D * .3;
        bld(cx, cz, 5, 4, 3, warm(st, .6), r, { roof: false, skin: SKINS.bands });
        eave(cx, 3, cz, 5, 4, 1.2, .35);
        hip(cx, 3.2, cz, 6, 5, 2, st, r);
      }
    },

    // New Akiba night market: rows of tarp stalls full of salvage tech, screens and criss-cross lights, a lit walk-up behind.

    nih_stalls(x, z, s, st, b, r) {
      st = nst(st, x, z);
      const [W, D] = dims(s), n = frontN(), t = [-n[1], n[0]], sp = span(W, D, n), deep = n[0] ? W : D;
      prop('box', x, .08, z, W, .16, D, [.04, .04, .045]);
      const bx = x - n[0] * deep * .3, bz = z - n[1] * deep * .3, bw = n[0] ? deep * .35 : sp - 2, bd = n[0] ? sp - 2 : deep * .35;
      const bh = (9 + r() * 10) * Math.min(b, 1.3);
      bld(bx, bz, bw, bd, bh, { ...st, lit: .45, grime: .25 }, r, { skin: SKINS.grid });
      board(pick(r, AKIBA), bx, bz, bw, bd, n, 0, bh - 2, Math.min(9, sp * .5), dim(pick(r, AKIBA_RGB), .8));
      const rows = 2, per = Math.max(2, Math.min(5, Math.floor(sp / 3.4)));
      for (let i = 0; i < rows; i++) for (let j = 0; j < per; j++) {
        const u = (j - (per - 1) / 2) * (sp / per), v = deep * (.25 - i * .2);
        const px = x + n[0] * v + t[0] * u, pz = z + n[1] * v + t[1] * u;
        prop('box', px, .5, pz, 2.4, 1, 2.4, [.06, .055, .05]);
        prop('box', px, 2.5, pz, 3, .08, 3, pick(r, [[.04, .1, .2], [.2, .04, .1], [.15, .1, .03], [.1, .1, .12]]), r() * .3, (r() - .5) * .25);
        glow(px, 1.3, pz, 1.2, .6, .15, dim(pick(r, AKIBA_RGB), .3 + .3 * r()));
        if (r() < .4) prop('box', px + (r() - .5), 1.25, pz + (r() - .5), .7, .5, .7, [.08, .08, .09]);
      }
      for (let k = 0; k < 3; k++) {
        const a = [x - t[0] * sp / 2 + n[0] * deep * (r() - .2) * .5, 4.5, z - t[1] * sp / 2 + n[1] * deep * (r() - .2) * .5];
        const c = [x + t[0] * sp / 2 + n[0] * deep * (r() - .2) * .5, 4, z + t[1] * sp / 2 + n[1] * deep * (r() - .2) * .5];
        stringLights(a, c, 1, 7, k ? dim(pick(r, AKIBA_RGB), .5) : dim(PAPER, .7));
      }
      if (r() < .6) holo(bx, bz, bw, bd, bh + 5, r, faceIdx(n), 10);
      pool(x, z, Math.max(W, D) * .45, [.05, .07, .1]);
    },

    // Onsen bathhouse: a low tile-roof hall wrapped round steaming pools behind a bamboo fence.

    nih_onsen(x, z, s, st, b, r) {
      st = nst(st, x, z);
      const [W, D] = dims(s), n = frontN(), t = [-n[1], n[0]], sp = span(W, D, n), deep = n[0] ? W : D;
      const hx = x + n[0] * deep * .22, hz = z + n[1] * deep * .22, hw = n[0] ? deep * .5 : sp - 2, hd = n[0] ? sp - 2 : deep * .5;
      bld(hx, hz, hw, hd, 6, warm(st, .5), r, { roof: false, skin: SKINS.bands });
      eave(hx, 6, hz, hw, hd, 2);
      hip(hx, 6.2, hz, hw * 1.1, hd * 1.1, Math.min(hw, hd) * .35, st, r);
      lanterns(hx, hz, hw, hd, n, 5, 4, PAPER);
      board(r() < .5 ? '温泉' : 'SUPA-SEN', hx, hz, hw, hd, n, 0, 4.2, Math.min(9, sp * .5), dim(GOLD, .8));
      const px = x - n[0] * deep * .22, pz = z - n[1] * deep * .22;
      for (let k = 0; k < 2; k++) {
        const u = (k - .5) * sp * .4, qx = px + t[0] * u, qz = pz + t[1] * u, rad = Math.min(sp * .35, deep * .35);
        prop('cyl', qx, .25, qz, rad, .3, rad * .8, STONE);
        glow(qx, .42, qz, rad * .6, .05, rad * .5, [.05, .2, .24]);
        for (let q = 0; q < 2; q++) H.puff(qx + (r() - .5) * 2, 1.5 + q * 2.5 + r(), qz + (r() - .5) * 2, 2 + q, [.14, .15, .16]);
        toro(qx + rad * .5, qz + rad * .4, 0, .5);
      }
      for (const s2 of [-1, 1]) {
        const fx = px + t[0] * s2 * (sp / 2 - .3), fz = pz + t[1] * s2 * (sp / 2 - .3);
        prop('box', fx, 1.4, fz, n[0] ? deep * .5 : .3, 2.8, n[0] ? .3 : deep * .5, [.07, .08, .04]);
      }
      niwaki(px - n[0] * deep * .2, pz - n[1] * deep * .2, 3.5, r);
    },
  };

  // Sub-area under a world point: the engine's circle, else the nearest Nihongai centre within reach.

  function areaOf(x, z) {
    const a = H.subareaAt(x, z);
    if (a && AREAS.some(q => q.name === a)) return a;
    let best = null, bd = 480;
    for (const q of AREAS) { const dd = Math.hypot(x - q.x, z - q.z) * q.k; if (dd < bd) { bd = dd; best = q.name; } }
    return best;
  }
  H.nihArea = areaOf;

  // Run a lot kit on an explicit rectangle in the current frame.

  const sub = (name, x, z, w, d, front, st, b, r) => {
    const prev = OVR;
    OVR = { w, d, front };
    K[name](x, z, Math.min(w, d), st, b, r);
    OVR = prev;
  };
  H.nihSub = sub;

  // Exported kits swap by sub-area before they build.

  const out = {};
  for (const name of Object.keys(K)) out[name] = (x, z, s, st, b, r) => {
    const sw = OVR ? null : SWAP[areaOf(x, z)]?.[name];
    K[sw ? (Array.isArray(sw) ? pick(r, sw) : sw) : name](x, z, s, st, b, r);
  };
  H.nihKits = K;

  // Nihongai dresses the engine's tall towers too: tile eave plates with gold light beneath and a jade garden
  // wall up two faces. It draws from its own seed, so the city's layout stays the same.

  const NS = H.SETTING.styles.styles.nihongai;
  if (NS) NS.tallTrim = (x, z, W, D, Ht) => {
    const q = H.rng(H.hash(Math.round(x * 3) + 11, Math.round(z * 3) + 5)), top = Ht * .55;
    if (Ht < 40) return;
    const rgb = q() < .75 ? GOLD : RED, k = 2 + Math.floor(top / 45);
    for (let i = 1; i <= k; i++) eave(x, top * i / k, z, W, D, 1, 1.3, rgb);
    const along = W >= D;
    for (const s2 of [-1, 1]) {
      const nn = along ? [0, s2] : [s2, 0], u = (q() - .5) * span(W, D, nn) * .4;
      const [gx, gz] = fp(x, z, W, D, nn, u, .5);
      slabOn(gx, top / 2 + 3, gz, nn, 3, top - 6, .8, [.02, .05, .03]);
      lightOn(...fp(x, z, W, D, nn, u, .95).flatMap((v, i) => i ? [top / 2 + 3, v] : [v]), nn, 1.4, top - 6, .1, dim(JADE, .75));
    }

    // A tall kanji blade on a short face, the district's signature from across the city.

    if (q() < .65) {
      const nn = along ? [q() < .5 ? 1 : -1, 0] : [0, q() < .5 ? 1 : -1], c = 2.6 + q() * 1.6;
      vsign(pick(q, WORDS), x, z, W, D, nn, (q() - .5) * span(W, D, nn) * .5, 10 + q() * top * .5, c, pick(q, [RED, RED, GOLD, SAKURA]));
    }
  };
  H.nihParts = { pad, niwaki, sakura, toro, torii, eave, hip, pagoda, lanterns, board, vsign, forest, fp, slabOn, lightOn, mascot };
  return out;
}

export const tiers = {
  nihongai: {
    0: ['nih_garden', 'nih_garden', 'nih_garden', 'nih_pavilion', 'nih_pavilion', 'nih_pavilion', 'nih_onsen', 'nih_stalls', 'nih_ngSlab'],
    1: ['nih_ngSlab', 'nih_ngSlab', 'nih_ngSlab', 'nih_pavilion', 'nih_pavilion', 'nih_tileTower', 'nih_tileTower', 'nih_capsule', 'nih_stalls', 'nih_garden'],
    2: ['nih_greenArc', 'nih_greenArc', 'nih_campusHall', 'nih_campusHall', 'nih_tileTower', 'nih_tileTower', 'nih_ngSlab', 'nih_ngSlab', 'nih_capsule', 'nih_akibaStack'],
    3: ['nih_greenArc', 'nih_greenArc', 'nih_greenArc', 'nih_akibaStack', 'nih_akibaStack', 'nih_tileTower', 'nih_campusHall'],
  },
};

// ---------- block kits ----------

export function blocks(H) {
  const P = () => H.nihParts, K = () => H.nihKits;
  const { GLOWS, SKINS, beam, bld, glow, prop, put, stringLights, textSign, holo } = H;
  const pool = (x, z, rad, rgb) => H.pool?.(x, z, rad, rgb);
  const nst = (st, x, z) => ({ ...(st.signs ? st : { ...st, ...NIH }), win: pane(x, z) });

  // Winding stream: glow segments along a wobbling line across the block.

  const stream = (x, z, w, d, r, rgb = [.03, .08, .1]) => {
    let px = x - w / 2, pz = z + (r() - .5) * d * .5;
    for (let k = 1; k <= 8; k++) {
      const qx = x - w / 2 + w * k / 8, qz = Math.max(z - d * .45, Math.min(z + d * .45, pz + (r() - .5) * d * .25));
      beam([px, -.2, pz], [qx, -.2, qz], .9, rgb, 'glow');
      px = qx; pz = qz;
    }
  };

  // Vine-covered security wall with sensor posts and drone lights. The front side keeps a gate gap.

  const vineWall = (x, z, w, d, n, r) => {
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const L = nx ? d : w, gate = nx === n[0] && nz === n[1];
      const cx = x + nx * w / 2, cz = z + nz * d / 2;
      for (const s of gate ? [-1, 1] : [0]) {
        const len = gate ? L / 2 - 6 : L, off = gate ? s * (L / 4 + 3) : 0;
        prop('box', cx - nz * off, 2.5, cz + nx * off, nx ? 1.2 : len, 5, nx ? len : 1.2, [.022, .045, .026]);
      }
      for (let u = -L / 2 + 4; u < L / 2; u += 18) {
        const px = cx - nz * u, pz = cz + nx * u;
        prop('cyl', px, 3.5, pz, .3, 7, .3, [.08, .08, .09]);
        glow(px, 7.2, pz, .35, .35, .35, [1.3, .08, .06]);
      }
    }
    for (let k = 0; k < 4; k++) put(GLOWS.sphere, x + (r() - .5) * w, 22 + r() * 18, z + (r() - .5) * d, .8, .4, .8, 0, 0, [1.4, .1, .08]);
  };

  const frontN = () => {
    const v = H.frame()?.front ?? { x: 0, z: 1 };
    return Math.abs(v.x) > Math.abs(v.z) ? [Math.sign(v.x), 0] : [0, Math.sign(v.z) || 1];
  };

  return {
    // Garden block. Campus: koi lake, islets, stream, paths, tea house, vine wall and a hall. Mache-Chindul: dark preserve forest.

    nih_gardenBlock: { zone: 'nihongai', build(x, z, w, d, st, r) {
      st = nst(st, x, z);
      const p = P(), area = H.nihArea(x, z), n = frontN();
      w = Math.min(w, 130); d = Math.min(d, 130);
      if (area === 'Mache-Chindul Park') {
        prop('box', x, .08, z, w, .16, d, [.018, .03, .018]);
        for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) {
          if (r() < .1) continue;
          p.forest(r() < .6 ? 'broad' : r() < .5 ? 'fern' : 'palm', x + ((i + r()) / 13 - .5) * w, z + ((j + r()) / 13 - .5) * d, 8 + r() * 14, r, [.018, .055, .028]);
        }
        stream(x, z, w, d, r, [.02, .05, .07]);
        for (let k = 0; k < 6; k++) { const px = x + (r() - .5) * w * .8, pz = z + (r() - .5) * d * .8; p.toro(px, pz, 0, .35); }
        return;
      }
      prop('box', x, .08, z, w, .16, d, [.035, .045, .035]);
      const lw = w * .42, ld = d * .36, lx = x + (r() - .5) * w * .15, lz = z + (r() - .5) * d * .15;
      prop('cyl', lx, .2, lz, lw, .2, ld, WATER);
      prop('cyl', lx + lw * .25, .2, lz + ld * .3, lw * .55, .2, ld * .6, WATER);
      for (let k = 0; k < 8; k++) glow(lx + (r() - .5) * lw * .7, .32, lz + (r() - .5) * ld * .7, .7, .08, .3, dim(r() < .7 ? [1, .4, .1] : PAPER, .5));
      for (let k = 0; k < 2; k++) {
        const ix = lx + (r() - .5) * lw * .4, iz = lz + (r() - .5) * ld * .4;
        prop('cyl', ix, .35, iz, 6 + r() * 4, .5, 5 + r() * 3, MOSS);
        p.niwaki(ix, iz, 3 + r() * 2, r, .5);
        p.toro(ix + 1.5, iz + 1, .5, .5);
      }
      const red = [.4, .04, .03], by = lz + ld * .45;
      beam([lx - 6, .3, by], [lx, 2, by], .7, red, 'glow');
      beam([lx, 2, by], [lx + 6, .3, by], .7, red, 'glow');
      stream(x, z, w, d, r);

      // Gravel paths loop round the lake.

      for (let k = 0; k < 10; k++) {
        const a0 = k / 10 * 6.283, a1 = (k + 1) / 10 * 6.283, R0 = .62 + .06 * Math.sin(k * 2.1), R1 = .62 + .06 * Math.sin(k * 2.1 + 2.1);
        beam([lx + Math.cos(a0) * lw * R0, -.55, lz + Math.sin(a0) * ld * R0], [lx + Math.cos(a1) * lw * R1, -.55, lz + Math.sin(a1) * ld * R1], 1.4, [.09, .09, .085]);
      }
      for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283 + .3; p.toro(lx + Math.cos(a) * lw * .72, lz + Math.sin(a) * ld * .72, 0, .6); }
      for (let k = 0; k < 22; k++) {
        const px = x + (r() - .5) * w * .92, pz = z + (r() - .5) * d * .92;
        if (((px - lx) / lw) ** 2 + ((pz - lz) / ld) ** 2 < .4) continue;
        r() < .28 ? p.sakura(px, pz, 5 + r() * 3, r) : p.niwaki(px, pz, 3 + r() * 4, r);
      }

      // Tea house on the far shore, torii at the gate.

      const hx = lx - lw * .55, hz = lz - ld * .55;
      bld(hx, hz, 8, 6, 3.4, { ...st, lit: .42 }, r, { roof: false, skin: SKINS.bands });
      p.eave(hx, 3.4, hz, 8, 6, 1.5, .4);
      p.hip(hx, 3.6, hz, 9.5, 7.5, 2.8, st, r);
      p.lanterns(hx, hz, 8, 6, [0, 1], 2.6, 3);
      const [tx, tz] = p.fp(x, z, w - 8, d - 8, n, 0, 0);
      p.torii(tx, tz, n, 6, 7);
      if (area === 'Jinteki Biotech') {
        vineWall(x, z, w - 1, d - 1, n, r);
        const t = [-n[1], n[0]], cx = x - n[0] * d * .3 + t[0] * w * .3, cz = z - n[1] * d * .3 + t[1] * w * .3;
        H.nihSub('nih_campusHall', cx, cz, 36, 22, { x: n[0], z: n[1] }, st, 1, r);
      }
    } },

    // Shotengai: a covered arcade street through the block, tile-roof shops both sides, lantern rows, gates and a corner tower.
    // New Akiba gets screens and RGB signs instead of lanterns.

    nih_arcadeBlock: { zone: 'nihongai', build(x, z, w, d, st, r) {
      st = nst(st, x, z);
      const p = P(), akiba = H.nihArea(x, z) === 'New Akiba Quarter';
      w = Math.min(w, 130); d = Math.min(d, 130);
      const along = w >= d, L = along ? w : d, S = along ? d : w, lane = 7;
      const at = (u, v) => along ? [x + u, z + v] : [x + v, z + u];
      const size = (lu, lv) => along ? [lu, lv] : [lv, lu];
      const deep = (S - lane) / 2, shop = Math.min(10, deep * .4);
      const cols = akiba ? AKIBA_RGB : [GOLD, RED, PAPER, SAKURA];

      // Shop units: a low tile-roof front on the lane and a mid-rise behind.

      for (const side of [-1, 1]) {
        let u = -L / 2 + (side > 0 ? 18 : 0);
        const n = along ? [0, -side] : [-side, 0];
        while (u < L / 2 - 4) {
          const uw = Math.min(L / 2 - u, 9 + r() * 5), c = u + uw / 2, h = 5 + r() * 4;
          const [fx, fz] = at(c, side * (lane / 2 + shop / 2)), [fw, fd] = size(uw - .4, shop);
          bld(fx, fz, fw, fd, h, { ...st, lit: .4 }, r, { roof: false, skin: SKINS.bands });
          prop('box', fx, h + .15, fz, fw + .6, .3, fd + .6, TILE);
          const [lx, lz] = p.fp(fx, fz, fw, fd, n, 0, .1);
          p.lightOn(lx, 1.6, lz, n, uw * .7, 2.4, .15, dim(akiba ? pick(r, AKIBA_RGB) : PAPER, akiba ? .3 : .45 + .25 * r()));
          if (r() < .6) p.board(pick(r, akiba ? AKIBA : r() < .5 ? WORDS : BOARDS), fx, fz, fw, fd, n, 0, h - 1.2, Math.min(6, uw * .75), dim(pick(r, cols), .7), false);
          const bh = (14 + r() * 30) * (akiba ? 1.4 : 1), [bx, bz] = at(c, side * (lane / 2 + shop + (deep - shop) / 2)), [bw, bd] = size(uw - .2, deep - shop - .5);
          const tiled = !akiba && r() < .5;
          bld(bx, bz, bw, bd, bh, { ...st, lit: akiba ? .4 : st.lit }, r, { roof: !tiled, skin: r() < .5 ? SKINS.bands : SKINS.grid });
          if (tiled) { p.eave(bx, bh, bz, bw, bd, 1, .3); p.hip(bx, bh + .2, bz, bw, bd, Math.min(bw, bd) * .3, st, r); }
          if (akiba && r() < .3) holo(bx, bz, bw, bd, bh * .6, r, along ? (side > 0 ? 2 : 3) : (side > 0 ? 0 : 1), 10);
          u += uw;
        }
      }

      // Arcade canopy with a light spine and lantern rows.

      const [cx, cz] = at(0, 0), [cw, cd] = size(L - 4, lane + 1);
      prop('box', cx, 9, cz, cw, .3, cd, [.05, .05, .055]);
      const [g1, g2] = size(L - 6, .4);
      glow(cx, 8.75, cz, g1, .1, g2, dim(akiba ? COOL : PAPER, .45));
      for (const v of [-2, 2]) {
        const [ax, az] = at(-L / 2 + 3, v), [bx2, bz2] = at(L / 2 - 3, v);
        stringLights([ax, 7.6, az], [bx2, 7.6, bz2], .3, 10, akiba ? dim(pick(r, AKIBA_RGB), .55) : dim(LANTERN, .8));
      }

      // Gates at both ends.

      for (const e of [-1, 1]) {
        const n = along ? [e, 0] : [0, e], gr = akiba ? dim(pick(r, AKIBA_RGB), .4) : [.45, .04, .03];
        for (const v of [-1, 1]) { const [px, pz] = at(e * (L / 2 - 1), v * (lane / 2 + .6)); glow(px, 5.5, pz, .8, 11, .8, gr); }
        const [gx, gz] = at(e * (L / 2 - 1), 0), [gw, gd] = size(1, lane + 3);
        prop('box', gx, 11.3, gz, gw, 1.6, gd, [.05, .02, .02]);
        textSign(akiba ? 'NEW AKIBA' : '日本街', gx + n[0] * .6, 11.3, gz + n[1] * .6, lane + 1, (lane + 1) / 4, Math.atan2(n[0], n[1]), akiba ? dim(COOL, 1.1) : dim(GOLD, 1.1));
      }

      // Corner tile tower in the gap left at one end.

      const [tx, tz] = at(-L / 2 + 9, (lane / 2 + deep / 2)), [tw, td] = size(16, deep - 1);
      H.nihSub(akiba ? 'nih_akibaStack' : 'nih_tileTower', tx, tz, tw, td, along ? { x: 0, z: -1 } : { x: -1, z: 0 }, st, 1.1, r);
      pool(cx, cz, L * .4, akiba ? [.05, .07, .1] : [.1, .06, .03]);
    } },
  };
}

// ---------- landmarks ----------

export function landmarks(H) {
  const P = () => H.nihParts;
  const { GLOWS, SKINS, THREE, beacon, bld, glow, helipad, prop, put, textSign } = H;
  const pool = (x, z, rad, rgb) => H.pool?.(x, z, rad, rgb);
  const nst = (st, x, z) => ({ ...(st.signs ? st : { ...st, ...NIH }), win: pane(x, z) });
  const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); H.decor.add(m); return m; };

  // Jade Light equaliser state: K bands per column, the lit count per column, shared colours.

  const EQ = { K: 10, mesh: null, lit: new Int8Array(24), on: new THREE.Color(), off: new THREE.Color(.03, .05, .04) };

  return {
    // Jinteki HQ, the Garden Ark: a terraced garden platform grown out from the shore into the sea. The long low
    // loaf lies along the top terrace, and a helix spire rises at its west end.
    // The land block keeps two campus halls behind a vine wall. Lanterns line the Nihongai shore.

    jintekiHQ: { at: [318, 632], label: 'Jinteki HQ', minSide: 90, reach: 700, labelY: 560, build(x, z, w, d, st, r) {
      st = nst(st, x, z);
      const p = P(), F = H.frame();
      const toW = (lx, lz) => [F.tx + lx * F.c + lz * F.s, F.tz - lx * F.s + lz * F.c];
      const toL = (wx, wz) => { const dx = wx - F.tx, dz = wz - F.tz; return [dx * F.c - dz * F.s, dx * F.s + dz * F.c]; };

      // Ark frame: t runs along the coast, n points out to sea. The group's local x is t and its local z is n.

      const [ox, oz] = toL(...ISLE.at), { L, B } = ISLE;
      const t = [ISLE.t[0] * F.c - ISLE.t[1] * F.s, ISLE.t[0] * F.s + ISLE.t[1] * F.c], n = [-t[1], t[0]], RY = Math.atan2(-t[1], t[0]);
      const A = (a, b) => [ox + t[0] * a + n[0] * b, oz + t[1] * a + n[1] * b];

      // The joined street meets the island at a = aR (isle.js). Rim posts, walls and trees keep off it.

      const aR = ISLE.road?.[0] ?? 0, onRoad = (a, b, m = 0) => !!ISLE.road && Math.abs(a - aR) < 8 + m && b < -B * .3;
      const ark = new THREE.Group();
      ark.position.set(ox, 0, oz); ark.rotation.y = RY;
      H.decor.add(ark);
      const add = (geo, mat, a = 0, y = 0, b = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(a, y, b); ark.add(m); return m; };
      const aglow = (a, y, b, sa, sy, sb, rgb) => glow(...A(a, b).flatMap((v, i) => i ? [y, v] : [v]), sa, sy, sb, rgb, RY);
      const abeam = (a0, y0, b0, a1, y1, b1, th, rgb) => { const [x0, z0] = A(a0, b0), [x1, z1] = A(a1, b1); H.beam([x0, y0, z0], [x1, y1, z1], th, rgb, 'glow'); };

      // Terraces: three superellipse tiers, a seawall in the surf and two garden steps. Each rim carries a lit line.

      const rim = (la, lb, k, q = 64) => Array.from({ length: q }, (_, i) => {
        const th = i / q * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
        return [la / 2 * Math.sign(c) * Math.abs(c) ** (2 / k), lb / 2 * Math.sign(s) * Math.abs(s) ** (2 / k)];
      });
      const top = new THREE.MeshStandardMaterial({ color: new THREE.Color(.03, .05, .032), roughness: .95 });
      // Terrace walls carry lab windows: one lit strip per storey, a few dark gaps, in world-metre UVs.

      const labs = H.canvasTexture(512, 64, (g, cw, ch) => {
        g.fillStyle = '#000'; g.fillRect(0, 0, cw, ch);
        for (let i = 0; i < 64; i++) {
          const v = H.rng(H.hash(i, 7))();
          if (v < .3) continue;
          g.fillStyle = `rgba(255,${200 + Math.floor(v * 40)},${150 + Math.floor(v * 60)},${.35 + .5 * v})`;
          g.fillRect(i * 8 + 1, 26, 6, 14);
        }
      });
      labs.wrapS = labs.wrapT = THREE.RepeatWrapping; labs.repeat.set(1 / 64, 1 / 6);
      const wall = new THREE.MeshStandardMaterial({ color: new THREE.Color(.1, .105, .1), roughness: .6, metalness: .2, emissive: 0xffffff, emissiveMap: labs, emissiveIntensity: .9 });
      const TIERS = [[L, B, 0, -8, 5], [L * .8, B * .7, -B * .07, 5, 11], [L * .62, B * .46, -B * .1, 11, 17]];
      const rims = TIERS.map(([la, lb, b0, y0, y1], k) => {
        const pts = rim(la, lb, 4.5), shp = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, -(b + b0))));
        const geo = new THREE.ExtrudeGeometry(shp, { depth: y1 - y0, bevelEnabled: false, curveSegments: 1 }).rotateX(-Math.PI / 2);
        add(geo, [top, wall], 0, y0);
        pts.forEach(([a, b], i) => {
          const [a2, b2] = pts[(i + 1) % pts.length];
          abeam(a, y1 + .15, b + b0, a2, y1 + .15, b2 + b0, .25, k === 2 ? dim(RED, .7) : dim(PAPER, .45));
          if (k === 0) {
            abeam(a, .5, b + b0, a2, .5, b2 + b0, .5, [.12, .3, .34]);
            if (i % 2 === 0 && !onRoad(a, b)) { prop('cyl', ...A(a * .985, b * .985 + b0).flatMap((v, j) => j ? [y1 + 3, v] : [v]), .3, 6, .3, [.08, .08, .09]); aglow(a * .985, y1 + 6.2, b * .985 + b0, .4, .4, .4, [1.3, .08, .06]); }
          }
        });
        return { pts, b0, y: y1 };
      });

      // Vine wall on the seawall rim, broken by a water stair on the seaward side.

      rims[0].pts.forEach(([a, b], i) => {
        const [a2, b2] = rims[0].pts[(i + 1) % rims[0].pts.length];
        if ((Math.abs(a) < 30 && b > 0) || onRoad(a, b, 4)) return;
        const [x0, z0] = A(a * .99, b * .99), [x1, z1] = A(a2 * .99, b2 * .99);
        H.beam([x0, 6.5, z0], [x1, 6.5, z1], 3, [.022, .05, .028]);
      });
      for (let k = 0; k < 6; k++) { const yy = 5 - k * .9; abeam(-24, yy, B / 2 + k * 1.8, 24, yy, B / 2 + k * 1.8, .25, dim(PAPER, .5)); }

      // Gardens: niwaki, sakura and stone lanterns on each terrace ring, koi lakes on the middle step.

      const between = (o, i, k) => {
        const [a0, b0] = o.pts[k % o.pts.length], [a1, b1] = i.pts[k % i.pts.length], f = .15 + r() * .7;
        return [a0 + (a1 - a0) * f, b0 + o.b0 + (b1 + i.b0 - b0 - o.b0) * f];
      };
      for (const [o, i, cnt] of [[rims[0], rims[1], 200], [rims[1], rims[2], 150]]) for (let k = 0; k < cnt; k++) {
        const [a, b] = between(o, i, Math.floor(r() * 64)), [px, pz] = A(a, b), y = o.y + .1, q = r();
        if (onRoad(a, b, 3)) continue;
        q < .3 ? p.niwaki(px, pz, 4 + r() * 4, r, y) : q < .55 ? p.sakura(px, pz, 6 + r() * 4, r, y)
          : q < .85 ? p.forest('broad', px, pz, 9 + r() * 7, r, [.02, .06, .035], y) : p.toro(px, pz, y, .8);
      }

      // A lit footpath loops round the middle of each terrace ring.

      for (const [o, i] of [[rims[0], rims[1]], [rims[1], rims[2]]]) for (let k = 0; k < 64; k++) {
        const P0 = o.pts[k], P1 = o.pts[(k + 1) % 64], Q0 = i.pts[k], Q1 = i.pts[(k + 1) % 64], f = .5;
        const m = (Pp, Qq) => [Pp[0] + (Qq[0] - Pp[0]) * f, Pp[1] + o.b0 + (Qq[1] + i.b0 - Pp[1] - o.b0) * f];
        const [a1, b1] = m(P0, Q0), [a2, b2] = m(P1, Q1);
        abeam(a1, o.y + .12, b1, a2, o.y + .12, b2, .5, k % 4 ? dim(PAPER, .22) : dim(PAPER, .5));
      }
      for (const s of [-1, 1]) {
        const a = s * L * .3, b = rims[1].b0 + B * .25, [px, pz] = A(a, b);
        prop('cyl', px, rims[1].y + .15, pz, 46, .2, 26, WATER, RY);
        put(GLOWS.ring, px, rims[1].y + .3, pz, 47, 1, 27, RY, 0, dim(PAPER, .35));
        for (let k = 0; k < 10; k++) aglow(a + (r() - .5) * 34, rims[1].y + .32, b + (r() - .5) * 16, .8, .08, .3, dim(r() < .7 ? [1, .4, .1] : PAPER, .6));
        const [hx, hz] = A(a + s * 40, b - 16);
        bld(hx, hz, 10, 8, 4, { ...st, lit: .5 }, r, { y0: rims[1].y, roof: false, skin: SKINS.bands });
        p.eave(hx, rims[1].y + 4.1, hz, 10, 8, 1.4, .5);
      }

      // Grow-houses: glass domes on the middle step, ribbed with jade light, a grove inside each.

      const glass = new THREE.MeshStandardMaterial({ color: new THREE.Color(.05, .09, .08), metalness: .6, roughness: .15, emissive: new THREE.Color(.02, .09, .06), transparent: true, opacity: .75 });
      for (const [a, rd] of [[-L * .12, 24], [L * .05, 18], [L * .2, 14]]) {
        const b = rims[1].b0 + B * .27 + (rd - 18), [px, pz] = A(a, b), y = rims[1].y;
        add(new THREE.SphereGeometry(rd, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass, a, y, b);
        for (const f of [.15, .45, .72, .9]) { const rr = rd * Math.sqrt(1 - f * f) * 2.02; put(GLOWS.ring, px, y + rd * f, pz, rr, 1, rr, 0, 0, dim(JADE, .55)); }
        for (let k = 0; k < 8; k++) { const an = k / 8 * 6.283; p.forest('broad', px + Math.cos(an) * rd * .45, pz + Math.sin(an) * rd * .45, rd * .4, r, [.03, .09, .05], y); }
        put(GLOWS.sphere, px, y + rd + .5, pz, 2, 2, 2, 0, 0, dim(JADE, 1.2));
      }

      // Cascades: lit water falls over the terrace edges into the sea.

      for (const th of [.12, .38, .62, .88]) {
        const k = Math.floor(th * 64), [a1, b1] = rims[1].pts[k], [a0, b0] = rims[0].pts[k];
        abeam(a1, rims[1].y, b1 + rims[1].b0, a1, rims[0].y, b1 + rims[1].b0, 2.2, [.3, .7, .8]);
        abeam(a0, rims[0].y, b0, a0, .2, b0, 3, [.35, .8, .9]);
        const [fx, fz] = A(a0 * 1.03, b0 * 1.03);
        put(GLOWS.ring, fx, .3, fz, 16, 3, 16, 0, 0, [.25, .55, .6]);
      }

      // Tunnel portal: the street runs into a dark mouth in the seawall, under a flat concrete frame.

      if (ISLE.road) {
        const ryR = Math.atan2(n[0], n[1]), MW = 13, MH = 4.6, CON = [.15, .16, .18];
        const bW = -B / 2 * (1 - Math.abs(2 * aR / L) ** 4.5) ** (1 / 4.5), at = o => A(aR, bW - o);
        prop('box', ...at(.3).flatMap((v, i) => i ? [MH / 2, v] : [v]), MW, MH, .6, [.004, .004, .006], ryR);
        for (const s2 of [-1, 1]) { const [jx, jz] = A(aR + s2 * (MW / 2 + .6), bW - .6); prop('box', jx, (MH + .6) / 2, jz, 1.2, MH + .6, 1.2, CON, ryR); }
        prop('box', ...at(.6).flatMap((v, i) => i ? [MH + .3, v] : [v]), MW + 2.4, .6, 1.2, CON, ryR);
        glow(...at(1.25).flatMap((v, i) => i ? [MH - .1, v] : [v]), MW - 1, .12, .1, dim(RED, .9), ryR);
        glow(...at(.05).flatMap((v, i) => i ? [MH - .5, v] : [v]), MW - 2, .1, .3, dim(PAPER, .6), ryR);
      }

      // The loaf: a 220 m seed pod half sunk in the top terrace, with warm floor lines, red ribs and a red spine.

      const yT = rims[2].y, bT = rims[2].b0, la = 196, lw = 60, lh = 48, a0 = 50;
      const tex = H.canvasTexture(1024, 256, (g, cw, ch) => {
        g.fillStyle = '#000'; g.fillRect(0, 0, cw, ch);
        for (let i = 0; i < 128; i++) for (let j = 0; j < 12; j++) {
          const v = H.rng(H.hash(i, j))();
          if (v < .4) continue;
          g.fillStyle = `rgba(255,${190 + Math.floor(v * 50)},${130 + Math.floor(v * 70)},${.3 + .55 * v})`;
          g.fillRect(i / 128 * cw, j * ch / 12 + 2, 4, ch / 12 - 4);
        }
      });
      add(new THREE.CapsuleGeometry(1, 2, 12, 48).rotateZ(Math.PI / 2).scale(la / 4, lh, lw / 2),
        new THREE.MeshStandardMaterial({ color: 0x1b2624, metalness: .55, roughness: .32, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.3 }), a0, yT, bT);
      for (let a = -la / 4; a <= la / 4; a += 13.75) {
        const [px, pz] = A(a0 + a, bT);
        put(GLOWS.ring, px, yT, pz, lw * 1.01, 1, lh * 2.02, RY + Math.PI / 2, Math.PI / 2, dim(RED, .55));
      }
      abeam(a0 - la / 4, yT + lh + .4, bT, a0 + la / 4, yT + lh + .4, bT, .9, dim(RED, 1.2));
      for (const e of [-1, 1]) {
        const [ex, ez] = A(a0 + e * (la / 2 + 1.5), bT);
        textSign('JINTEKI', ex, yT + lh * .45, ez, 30, 7.5, Math.atan2(e * t[0], e * t[1]), dim(RED, 1.3));
      }
      for (let k = -3; k <= 4; k++) for (const s of [-1, 1]) {
        const [px, pz] = A(a0 + k * 26, bT + s * (lw / 2 + 8));
        k % 2 ? p.toro(px, pz, yT, .8) : p.niwaki(px, pz, 4 + r() * 2, r, yT);
      }

      // Helix spire: two dark slab towers twist round an empty axis, joined by sky bridges. Red light runs up
      // the outer edges of each slab, so two red spirals trace the twist.

      const ha = -L * .62 / 2 + 40, HH = 480, y0 = yT + 10, [hx, hz] = A(ha, bT);
      bld(hx, hz, 96, 96, 10, { ...st, base: [.06, .06, .065], lit: .25 }, r, { y0: yT, shape: 'cyl', roof: false, skin: SKINS.bands });
      put(GLOWS.ring, hx, yT + 10.3, hz, 98, 1, 98, 0, 0, dim(RED, .9));
      const dark = { ...st, base: [.045, .045, .05], win: [1, .55, .45], lit: .14, grime: 0 };
      const NS = 40, SH = HH / NS, turns = 1.15;
      const slab = (f, ph) => {
        const an = ph + f * turns * Math.PI * 2, R = 36 - 14 * f, ca = Math.cos(an), sa = Math.sin(an);
        const tl = [t[0] * -sa + n[0] * ca, t[1] * -sa + n[1] * ca];
        return { a: ha + ca * R, b: bT + sa * R, ca, sa, W: 40 - 16 * f, D: 10 - 3 * f, ry: Math.atan2(-tl[1], tl[0]), tl };
      };
      for (const ph of [0, Math.PI]) for (let k = 0; k < NS; k++) {
        const f = k / NS, g = slab(f, ph), [sx, sz] = A(g.a, g.b), yy = y0 + k * SH;
        bld(sx, sz, g.W, g.D, SH - .5, dark, r, { y0: yy, roof: false, skin: k % 5 === 4 ? SKINS.bands : SKINS.fins, ry: g.ry });
        for (const e of [-1, 1]) glow(sx + g.tl[0] * e * g.W / 2, yy + SH / 2, sz + g.tl[1] * e * g.W / 2, .7, SH + .1, .7, dim(RED, 1.25));
        if (k % 4 === 0) glow(sx, yy + SH - .3, sz, g.W + .4, .25, g.D + .4, dim(RED, .5), g.ry);
      }

      // Sky bridges cross the empty axis every few storeys, each with a red strip beneath.

      for (let k = 2; k < NS; k += 3) {
        const f = (k + .5) / NS, p1 = slab(f, 0), p2 = slab(f, Math.PI), yy = y0 + (k + .5) * SH;
        const [x1, z1] = A(p1.a, p1.b), [x2, z2] = A(p2.a, p2.b);
        H.beam([x1, yy, z1], [x2, yy, z2], 4.5, [.05, .05, .055]);
        H.beam([x1, yy - 2.4, z1], [x2, yy - 2.4, z2], .4, dim(RED, k % 2 ? .9 : .5), 'glow');

        // Hallway windows: a warm row on both sides, one pane every 3 m.

        const bl = Math.hypot(x2 - x1, z2 - z1), ux = (x2 - x1) / bl, uz = (z2 - z1) / bl, ry = Math.atan2(ux, uz);
        for (let u = 3; u < bl - 2; u += 3) for (const s of [-1, 1]) {
          glow(x1 + ux * u + uz * s * 2.32, yy + .3, z1 + uz * u - ux * s * 2.32, .12, 1.4, 2, dim(PAPER, .75), ry);
        }
      }

      // Crown: a last bridge carries the name, a red halo floats above, a mast and a beacon.

      const yc = y0 + HH, q1 = slab(1, 0), q2 = slab(1, Math.PI), [c1x, c1z] = A(q1.a, q1.b), [c2x, c2z] = A(q2.a, q2.b);
      H.beam([c1x, yc + 4, c1z], [c2x, yc + 4, c2z], 8, [.05, .05, .055]);
      const bl = Math.hypot(c2x - c1x, c2z - c1z), bx = (c1x + c2x) / 2, bz = (c1z + c2z) / 2, bd = [(c2z - c1z) / bl, -(c2x - c1x) / bl];
      for (const s of [-1, 1]) textSign('JINTEKI', bx + bd[0] * s * 4.3, yc + 4, bz + bd[1] * s * 4.3, 26, 6, Math.atan2(bd[0] * s, bd[1] * s), dim(RED, 1.4));
      put(GLOWS.ring, hx, yc + 20, hz, 64, 1, 64, 0, 0, dim(RED, 1.1));
      put(GLOWS.ring, hx, yc + 34, hz, 40, 1, 40, 0, 0, dim(RED, .6));
      prop('cyl', bx, yc + 8 + 30, bz, .8, 60, .8, [.12, .12, .13]);
      put(GLOWS.sphere, bx, yc + 70, bz, 3.5, 3.5, 3.5, 0, 0, [2, .15, .15]);
      beacon(bx, yc + 64, bz, r);

      // Land block: two campus halls behind a vine wall, with a garden between them.

      prop('box', 0, .08, 0, w, .16, d, [.03, .045, .032]);
      const frt = H.frame()?.front ?? { x: 0, z: 1 };
      for (const e of [-1, 1]) H.nihSub('nih_campusHall', e * w * .26, 0, w * .44, d * .62, frt, st, 1.05, r);
      for (let k = 0; k < 8; k++) { const px = (r() - .5) * w * .2, pz = (r() - .5) * d * .8; k % 3 ? p.niwaki(px, pz, 3 + r() * 3, r) : p.toro(px, pz, 0, .6); }

      // Lantern promenade along the Nihongai shore, clear of the platform.

      for (const line of H.CITY.coast ?? []) for (let i = 0; i + 1 < line.length; i++) {
        const [ax, az] = line[i], [bx, bz] = line[i + 1], sl = Math.hypot(bx - ax, bz - az);
        for (let u = 0; u < sl; u += 16) {
          const wx = ax + (bx - ax) * u / sl, wz = az + (bz - az) * u / sl;
          if (Math.hypot(wx - F.tx, wz - F.tz) > 1500 || !H.nihArea(wx, wz)) continue;
          const [lx, lz] = toL(wx, wz), da = (lx - ox) * t[0] + (lz - oz) * t[1], db = (lx - ox) * n[0] + (lz - oz) * n[1];
          if ((Math.abs(da) < L / 2 + 6 && Math.abs(db) < B / 2 + 6) || (ISLE.road && Math.abs(da - aR) < 10 && db < 0 && db > -B / 2 - 40)) continue;
          prop('cyl', lx, 2, lz, .25, 4, .25, [.1, .06, .04]);
          put(GLOWS.sphere, lx, 4.3, lz, .9, 1.2, .9, 0, 0, dim(LANTERN, 1.1));
          pool(lx, lz, 6, [.14, .06, .02]);
        }
      }

      // Airspace ring: a faint red line 180 m up with drone lights on it.

      const ringR = 420, rh = 180;
      mesh(new THREE.TorusGeometry(ringR, .35, 4, 200).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(.6, .05, .06), transparent: true, opacity: .4, depthWrite: false }))
        .position.set(ox, rh, oz);
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2;
        put(GLOWS.sphere, ox + Math.cos(a) * ringR, rh, oz + Math.sin(a) * ringR, 2.4, 1.2, 2.4, 0, 0, [1.6, .1, .08]);
      }

      // The card camera looks from the sea at the loaf and the spire.

      return { focus: A(-20, bT), span: 420, face: n };
    } },

    // Harmony General: a silvery ziggurat of nine tall storeys on a raised garden deck, with a lit split stair
    // up the front, edge-lit tiers, a cross and a pad.

    harmonyGeneral: { at: [446, 714], label: 'Harmony General', minSide: 84, reach: 600, labelY: 90, build(x, z, w, d, st, r) {
      st = nst(st, x, z);
      const p = P(), hs = { ...st, base: [.21, .22, .24], win: [1, .88, .7], lit: .3, grime: 0 };
      const front = H.frame()?.front ?? { x: 0, z: 1 }, n = Math.abs(front.x) > Math.abs(front.z) ? [Math.sign(front.x), 0] : [0, Math.sign(front.z) || 1];
      w = Math.min(w, 120); d = Math.min(d, 120);
      const plaza = 7, pw = w - 12, pd = d - 12, lineC = [.55, .7, .8];
      prop('box', x, .08, z, w, .16, d, [.03, .045, .035]);

      // Podium deck: a lit plinth with a planted top and light on every rim.

      bld(x, z, pw, pd, plaza, { ...hs, base: [.1, .105, .11], lit: .32 }, r, { roof: false, skin: SKINS.bands });
      prop('box', x, plaza + .2, z, pw - 1, .4, pd - 1, [.03, .05, .035]);
      for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        glow(x + ax * pw / 2, plaza + .5, z + az * pd / 2, ax ? .25 : pw, .25, ax ? pd : .25, lineC);
        glow(x + ax * pw / 2, .4, z + az * pd / 2, ax ? .2 : pw, .2, ax ? pd : .2, dim(lineC, .5));
      }

      // Split stair: two flights climb along the front face to a centre landing, with lit nosings.

      const t = [-n[1], n[0]], out = (n[0] ? pw : pd) / 2 + 2.5, N = 14, rise = plaza / N, run = 1.1, land = 4;
      const at = (u, o = out) => [x + n[0] * o + t[0] * u, z + n[1] * o + t[1] * u];
      const [lx, lz] = at(0);
      p.slabOn(lx, plaza / 2, lz, n, land * 2, plaza, 4.5, [.16, .17, .18]);
      for (const s of [-1, 1]) for (let k = 0; k < N; k++) {
        const h = plaza - k * rise, [sx, sz] = at(s * (land + (k + .5) * run));
        p.slabOn(sx, h / 2, sz, n, run, h, 4.5, [.16, .17, .18]);
        if (k % 2 === 0) p.lightOn(sx + t[0] * s * run / 2, h + .05, sz + t[1] * s * run / 2, n, .12, .08, 4.5, dim(lineC, .7));
      }

      // Garden ring round the ziggurat on the deck.

      const B = Math.min(pw, pd) * .86, deck = plaza + .4;
      for (let k = 0; k < 20; k++) {
        const a = k / 20 * 6.283, rx = (pw / 2 + B / 2) / 2, rz = (pd / 2 + B / 2) / 2;
        const px = x + Math.cos(a) * rx, pz = z + Math.sin(a) * rz;
        k % 4 === 0 ? p.toro(px, pz, deck, .7) : k % 3 ? p.forest('broad', px, pz, 6 + r() * 3, r, [.02, .06, .035], deck) : p.sakura(px, pz, 5, r, deck);
      }

      // Ziggurat: nine stepped storeys with cool light on every edge and planters on each step.

      const SH = 7, step = B * .05;
      let y = deck, s = B;
      for (let k = 0; k < 9; k++) {
        bld(x, z, s, s, SH, hs, r, { y0: y, roof: false, skin: SKINS.bands });
        y += SH;
        for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) glow(x + ax * s / 2, y, z + az * s / 2, ax ? .2 : s, .2, ax ? s : .2, lineC);
        if (k < 8) prop('box', x, y + .25, z, s - .4, .5, s - .4, [.03, .06, .04]);
        if (k < 8) s -= 2 * step;
      }

      // Crown: pad, hopper, beacons and a cross on two faces.

      helipad(x, z, Math.min(s * .8, 16), y, r);
      prop('box', x + s * .2, y + 2, z, 3, 1.6, 5, [.3, .3, .32]);
      H.flickerGlow(x + s * .2, y + 3, z - 1.5, .5, .4, .5, [.3, .4, 1.8], r);
      H.flickerGlow(x + s * .2, y + 3, z + 1.5, .5, .4, .5, [1.8, .15, .1], r);
      beacon(x, y + 6, z, r);
      const S0 = B - 2 * step * 7;
      for (const nn of [n, [n[1], n[0]]]) {
        const [cx, cz] = p.fp(x, z, S0, S0, nn, 0, .6), cy = deck + SH * 7.5, crossC = [.4, 1.5, 1.1];
        p.lightOn(cx, cy, cz, nn, 8, 2.6, .3, crossC);
        p.lightOn(cx, cy, cz, nn, 2.6, 8, .3, crossC);
      }

      // Entrance on the deck: name over the door, canopy and drop-off light. A pool lights the stair foot.

      p.board('HARMONY GENERAL', x, z, B, B, n, 0, deck + SH * .55, Math.min(30, B * .5), [.9, 1.3, 1.4]);
      const [ex, ez] = p.fp(x, z, B, B, n, 0, 3);
      p.slabOn(ex, deck + 4, ez, n, 18, .4, 6, [.15, .16, .17]);
      glow(ex, deck + 3.7, ez, n[0] ? 4 : 16, .1, n[0] ? 16 : 4, dim(COOL, .5));
      pool(...at(0, out + 6), 22, [.08, .1, .12]);
    } },

    // Senbon Torii: a stone avenue under some forty lacquer gates that rise toward the far end, where a 40 m
    // hologram torii stands over a shrine pad. Cyan circuit light runs along every lintel and drone lanterns drift above.

    senbon: { at: [452, 692], label: 'Senbon Torii', minSide: 36, reach: 450, labelY: 52, build(x, z, w, d, st, r) {
      st = nst(st, x, z);
      const p = P(), along = w >= d, L = Math.min(Math.max(w, d), 100) - 6, n = along ? [1, 0] : [0, 1], t = [-n[1], n[0]];
      const at = (u, v = 0) => [x + n[0] * u + t[0] * v, z + n[1] * u + t[1] * v];
      const RED = [.5, .04, .03], CYAN = [.25, 1.3, 1.6];
      prop('box', x, .1, z, along ? w : w, .2, along ? d : d, [.03, .04, .03]);
      const [sx, sz] = at(0), pathW = 5;
      prop('box', sx, .25, sz, along ? L : pathW, .1, along ? pathW : L, [.09, .085, .08]);

      // The avenue: gates every 2.4 m, growing from 5 m to 9 m toward the shrine.

      const N = Math.floor((L - 18) / 2.4);
      for (let k = 0; k < N; k++) {
        const u = -L / 2 + 2 + k * 2.4, f = k / (N - 1), h = 5 + f * 4, span = 4 + f * 1.5, [gx, gz] = at(u);
        for (const s of [-1, 1]) { const [px, pz] = at(u, s * span / 2); glow(px, h / 2, pz, .45, h, .45, RED); }
        glow(gx, h - .15, gz, along ? .5 : span + 2.2, .4, along ? span + 2.2 : .5, RED);
        if (k % 3 === 0) glow(gx, h + .05, gz, along ? .12 : span + 1.6, .06, along ? span + 1.6 : .12, dim(CYAN, .9));
      }
      for (let k = 0; k < 10; k++) { const s = k % 2 ? 1 : -1, [lx, lz] = at(-L / 2 + 4 + k * (L - 22) / 9, s * 5); p.toro(lx, lz, 0, .5); }

      // Shrine pad and the hologram gate: outlines of light, a scan band and a name board.

      const [hx, hz] = at(L / 2 - 8), H0 = 40, S0 = 26;
      prop('cyl', hx, .4, hz, 16, .8, 16, [.08, .08, .085]);
      put(GLOWS.ring, hx, .9, hz, 16.4, 1, 16.4, 0, 0, dim(CYAN, .8));
      for (const s of [-1, 1]) {
        const [px, pz] = at(L / 2 - 8, s * S0 / 2);
        glow(px, H0 / 2, pz, 1.2, H0, 1.2, dim(RED, 1.6));
        glow(px, H0 / 2, pz, .25, H0, .25, dim(CYAN, 1.2));
      }
      glow(hx, H0 - .6, hz, along ? 1.6 : S0 + 9, 1.4, along ? S0 + 9 : 1.6, dim(RED, 1.8));
      glow(hx, H0 - 5, hz, along ? 1 : S0 + 2, .9, along ? S0 + 2 : 1, dim(RED, 1.5));
      glow(hx, H0 + .3, hz, along ? .2 : S0 + 9, .15, along ? S0 + 9 : .2, dim(CYAN, 1.4));
      for (let y = 6; y < H0 - 6; y += 6) glow(hx, y, hz, along ? .08 : S0 - 1, .08, along ? S0 - 1 : .08, dim(CYAN, .35));
      textSign('千本鳥居', hx, H0 - 2.8, hz, 10, 2.5, Math.atan2(-n[0], -n[1]), dim([1.6, 1.3, .7], 1.1));

      // Drone lanterns drift over the avenue.

      for (let k = 0; k < 14; k++) {
        const [dx, dz] = at(-L / 2 + r() * L, (r() - .5) * 12);
        put(GLOWS.sphere, dx, 12 + r() * 14, dz, .9, 1.1, .9, 0, 0, r() < .7 ? [1.4, .55, .2] : CYAN);
      }
      pool(hx, hz, 30, [.12, .03, .02]);

      // The camera looks from the small-gate end, up the avenue to the holo gate.

      return { face: [-n[0], -n[1]] };
    } },

    // Jade Light Arcology: an octagonal arcology in three planted tiers, the Phoenix Club band, an equaliser
    // section whose window columns pulse to the club's beat, and a stacked jade crown.

    jadeLight: { at: [418, 655], label: 'Jade Light Arcology', minSide: 50, reach: 500, labelY: 300, build(x, z, w, d, st, r) {
      st = nst(st, x, z);
      const p = P(), js = { ...st, base: [.045, .085, .065], win: [.75, 1, .85], lit: .28, grime: 0 };
      let D0 = Math.min(w, d, 80) * .8, y = 0;
      prop('box', x, .1, z, w, .2, d, [.03, .04, .035]);
      for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283 + .2; p.niwaki(x + Math.cos(a) * (D0 / 2 + 5), z + Math.sin(a) * (D0 / 2 + 5), 4, r); }
      const hs = [91, 74, 52];
      for (let t = 0; t < 3; t++) {
        bld(x, z, D0, D0, hs[t], js, r, { y0: y, shape: 'oct', roof: false, skin: t === 1 ? SKINS.fins : SKINS.curtain });
        y += hs[t];
        prop('cyl', x, y + .3, z, D0 * .98, .6, D0 * .98, MOSS);
        put(GLOWS.ring, x, y + .8, z, D0 * .97, 1, D0 * .97, 0, 0, dim(JADE, .55));
        const nd = D0 * .78;
        for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283 + t; p.niwaki(x + Math.cos(a) * (D0 + nd) / 4, z + Math.sin(a) * (D0 + nd) / 4, 4 + r() * 3, r, y + .6); }
        D0 = nd;
      }

      // Phoenix Club: a glowing glass band with gold and magenta light and its name on four sides.

      bld(x, z, D0 * 1.04, D0 * 1.04, 14, { ...js, win: [1.6, .5, 1.2], lit: 1 }, r, { y0: y, shape: 'oct', roof: false, skin: SKINS.curtain, glow: .5 });
      put(GLOWS.ring, x, y + 1, z, D0 * 1.15, 1, D0 * 1.15, 0, 0, dim(GOLD, .9));
      put(GLOWS.ring, x, y + 13, z, D0 * 1.15, 1, D0 * 1.15, 0, 0, dim(SAKURA, .9));
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2, rr = D0 * .54;
        textSign('PHOENIX CLUB', x + Math.sin(a) * rr, y + 7, z + Math.cos(a) * rr, 22, 5.5, a, dim(GOLD, 1.2));
      }
      y += 14;

      // Equaliser: three columns of window bands on each of the eight faces, in their own mesh so update can relight them.

      const DE = D0 * .9, EH = 28;
      bld(x, z, DE, DE, EH, { ...js, lit: .05 }, r, { y0: y, shape: 'oct', roof: false, skin: SKINS.fins });
      const rf = DE / 2 * Math.cos(Math.PI / 8) + .25, fw = DE * Math.sin(Math.PI / 8), bh = EH / EQ.K, o = new THREE.Object3D();
      EQ.mesh = new THREE.InstancedMesh(H.PROPS.box.geometry, GLOWS.sphere.material, 24 * EQ.K);
      for (let c = 0; c < 24; c++) {
        const a = Math.floor(c / 3) * Math.PI / 4, u = (c % 3 - 1) * fw / 3;
        for (let k = 0; k < EQ.K; k++) {
          o.position.set(x + Math.sin(a) * rf + Math.cos(a) * u, y + (k + .5) * bh, z + Math.cos(a) * rf - Math.sin(a) * u);
          o.rotation.set(0, a, 0); o.scale.set(fw / 3 * .78, bh * .62, .3); o.updateMatrix();
          EQ.mesh.setMatrixAt(c * EQ.K + k, o.matrix);
          EQ.mesh.setColorAt(c * EQ.K + k, EQ.off);
        }
      }
      EQ.lit.fill(-1);
      EQ.mesh.userData.noTile = true; EQ.mesh.frustumCulled = false;
      H.decor.add(EQ.mesh);
      y += EH;

      // Jade crown: shrinking rings up a spire, a lantern at the tip.

      for (let k = 0; k < 6; k++) put(GLOWS.ring, x, y + 2 + k * 4.2, z, D0 * (.9 - k * .13), 1, D0 * (.9 - k * .13), 0, 0, dim(JADE, 1.3 - k * .12));
      prop('cone', x, y + 14, z, D0 * .7, 28, D0 * .7, [.04, .08, .06]);
      put(GLOWS.sphere, x, y + 29.5, z, 3, 3, 3, 0, 0, dim(JADE, 1.6));
      beacon(x, y + 32, z, r);
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + Math.PI / 4, rr = Math.min(w, d, 80) * .44;
        textSign('JADE LIGHT', x + Math.sin(a) * rr, 5, z + Math.cos(a) * rr, 16, 4, a, dim(JADE, 1.1));
      }
      pool(x, z, Math.min(w, d) * .6, [.03, .1, .06]);
    }, update(t) {

      // Each column's level follows a kick at 124 bpm and a slow wave of its own. Only changed bands are rewritten.

      if (!EQ.mesh) return;
      const beat = t * 124 / 60, kick = Math.exp(-(beat % 1) * 5);
      let dirty = false;
      for (let c = 0; c < 24; c++) {
        const wave = .5 + .5 * Math.sin(t * (1.3 + (c * 7 % 5) * .35) + c * 1.7);
        const n = Math.max(1, Math.min(EQ.K, Math.round(EQ.K * (.15 + .45 * wave + .4 * kick * (.6 + .4 * Math.sin(c * 2.1 + Math.floor(beat)))))));
        if (n === EQ.lit[c]) continue;
        EQ.lit[c] = n; dirty = true;
        for (let k = 0; k < EQ.K; k++) {
          const f = k / (EQ.K - 1);
          EQ.mesh.setColorAt(c * EQ.K + k, k < n ? EQ.on.setRGB(GOLD[0] + (SAKURA[0] - GOLD[0]) * f, GOLD[1] + (SAKURA[1] - GOLD[1]) * f, GOLD[2] + (SAKURA[2] - GOLD[2]) * f) : EQ.off);
        }
      }
      if (dirty) EQ.mesh.instanceColor.needsUpdate = true;
    } },
  };
}
