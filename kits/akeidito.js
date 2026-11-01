// Akeidito: the arcade quarter of Rutherford, round the south and east of Broadcast Square.
// Tiered, pagoda-like mid-rises with flared eaves, amber windows, hot pink and cyan arcade signs at street level,
// covered arcade lanes, gaming halls and a Kwiky7 on many corners. Design: design/districts/akeidito.md.
// Lot kits: (x, z, s, st, b, r). They read the lot from H.frame() and fall back to an s × s square in the showcase.
// Each kit turns its shopfront to the lot's street side. engine/core.js routes quarter lots here by density tier.

const PINK = [1.9, .2, 1], CYAN = [.2, 1.4, 1.9], GOLD = [1.8, .85, .15], RED = [1.9, .12, .1], AMBER = [1.5, .8, .3];
const NEON = [PINK, CYAN, PINK, CYAN, GOLD];
const LACQUER = [[.12, .05, .045], [.1, .07, .05], [.07, .06, .06], [.13, .08, .05], [.09, .05, .06]];
const EAVE = [.05, .04, .035];
const WORDS = ['ARCADE', '오락실', 'GAME HALL', 'PC방', '노래방', 'JUNCTION', 'SENSEDEP', 'VR TANKS', 'HIGH SCORE', 'PLAY 24H'];

export function kits(H) {
  const { FACES, GLOWS, SKINS, beacon, beam, bld, glow, holo, pool, prop, put, textSign } = H;
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const dim = (c, k) => c.map(v => v * k);
  const paint = (st, r) => ({ ...st, base: pick(r, LACQUER), lit: .3 + .2 * r() });

  // A lot frame in front-relative terms. u runs along the street front, v points out to the street.
  //   U, V     lot size along u and v, capped at 60 m
  //   P        local point for (u, v)
  //   b        a building, sizes in u and v
  //   box, gl  prop and glow boxes turned to the front
  //   face     FACES index of the front, for holo

  const frame = (x, z, s) => {
    const f = H.frame(), fr = f?.front ?? { x: 0, z: 1 }, fx = fr.x, fz = fr.z, ry = Math.atan2(fx, fz);
    const w = f ? f.w - 2 : s, d = f ? f.d - 2 : s;
    const P = (u, v) => [x + u * fz + v * fx, z - u * fx + v * fz];
    const sz = (su, sv) => fx ? [sv, su] : [su, sv];
    return {
      U: Math.min(fx ? d : w, 60), V: Math.min(fx ? w : d, 60), P, sz, ry,
      face: FACES.findIndex(n => n[0] === fx && n[1] === fz),
      b: (u, v, su, sv, h, st, r, o) => bld(...P(u, v), ...sz(su, sv), h, st, r, o),
      box: (u, y, v, su, sy, sv, rgb, kind = 'box') => { const [px, pz] = P(u, v); prop(kind, px, y, pz, su, sy, sv, rgb, ry); },
      gl: (u, y, v, su, sy, sv, rgb) => { const [px, pz] = P(u, v); glow(px, y, pz, su, sy, sv, rgb, ry); },
      text: (t, u, y, v, tw, th, rgb) => { const [px, pz] = P(u, v); textSign(t, px, y, pz, tw, th, ry, rgb); },
      holo: (u, v, su, sv, y, r, size) => holo(...P(u, v), ...sz(su, sv), y, r, FACES.findIndex(n => n[0] === fx && n[1] === fz), size),
    };
  };

  // Flared eave: a dark plate wider than the tier, an amber line on three edges, and upturned corner tips.

  const eave = (T, u, v, su, sv, y, r, rgb = AMBER) => {
    const eu = su + 4, ev = sv + 4;
    T.box(u, y + .5, v, eu, 1, ev, EAVE);
    T.gl(u, y + .5, v + ev / 2 + .1, eu, .45, .25, dim(rgb, .45));
    for (const s of [-1, 1]) T.gl(u + s * (eu / 2 + .1), y + .5, v, .25, .45, ev, dim(rgb, .22));
    for (const cu of [-1, 1]) for (const cv of [-1, 1]) {
      const a = T.P(u + cu * eu / 2, v + cv * ev / 2), b = T.P(u + cu * (eu / 2 + 1.8), v + cv * (ev / 2 + 1.8));
      beam([a[0], y + .5, a[1]], [b[0], y + 2.2, b[1]], .7, EAVE);
      if (cv > 0) glow(b[0], y + 2.3, b[1], .7, .7, .7, rgb);
    }
  };

  // Street front: lit glass, a neon band, a sign word and a coloured spill on the pavement.

  const shopfront = (T, u, su, v, r, word = r() < .7) => {
    const c = pick(r, NEON);
    T.gl(u, 1.6, v + .1, su * .9, 2.8, .1, dim(c, .22));
    T.gl(u, 3.3, v + .25, su * .95, .25, .25, dim(c, 1.2));
    if (word) T.text(pick(r, WORDS), u, 4.6, v + .3, Math.min(su * .8, 10), Math.min(su * .2, 2.2), dim(c, 1.3));
    pool(...T.P(u, v + 3), Math.max(3, su * .4), dim(c, .06));
  };

  // Kwiky7: a white corner store with a red fascia, clinical white glass and a white pool at the door.

  const kwiky = (T, u, v, su, sv) => {
    const fv = v + sv / 2;
    T.box(u, 2.2, v, su, 4.4, sv, [.5, .5, .52]);
    T.gl(u, 4, fv + .1, su + .2, .8, .15, RED);
    T.text('KWIKY7', u, 4, fv + .25, Math.min(su * .7, 6), .7, [2, 2, 2]);
    T.gl(u, 1.7, fv + .05, su * .85, 2.6, .1, [1.4, 1.45, 1.5]);
    T.gl(u - su / 2 - .05, 4, v, .1, .8, sv, RED);
    pool(...T.P(u, fv + 3), 5, [.16, .16, .17]);
  };

  // Vertical blade sign standing out from the facade.

  const blade = (T, u, v, y, h, r) => {
    const c = pick(r, NEON);
    T.box(u, y, v + 1, .3, h + .4, 1.9, EAVE);
    T.gl(u, y, v + 1, .4, h, 1.6, dim(c, .9));
  };

  // Shop-house: two to four floors, an eave, a small top room under a second eave.

  const shop = (x, z, s, st, b, r) => {
    const T = frame(x, z, s), { U, V } = T;
    if (r() < .22) return kwikyLot(x, z, s, st, b, r);
    const pst = paint(st, r), h = H.lerp(st.h0 * .7, st.h0 * 1.5, r()), bu = U * .92, bv = V * .85, fv = bv / 2;
    T.b(0, 0, bu, bv, h, pst, r, { roof: false, skin: SKINS.bands });
    shopfront(T, 0, bu, fv, r);
    eave(T, 0, 0, bu, bv, h, r);
    if (r() < .6) {
      T.b(0, -bv * .1, bu * .55, bv * .5, 4, pst, r, { y0: h + 1, roof: false, skin: SKINS.sparse });
      eave(T, 0, -bv * .1, bu * .55, bv * .5, h + 5, r, dim(AMBER, .8));
    }
    if (h > 8 && r() < .7) blade(T, (r() < .5 ? -1 : 1) * bu * .35, fv, 4 + (h - 4) / 2, h - 5, r);
  };

  // Kwiky7 lot: the store on the street with two to four floors of flats above.

  const kwikyLot = (x, z, s, st, b, r) => {
    const T = frame(x, z, s), { U, V } = T, bu = U * .9, bv = V * .85;
    kwiky(T, 0, bv * .1, bu, bv * .8);
    const h = 3.2 * (2 + Math.floor(r() * 3));
    T.b(0, 0, bu, bv, h, paint(st, r), r, { y0: 4.4, roof: false, skin: SKINS.grid });
    eave(T, 0, 0, bu, bv, h + 4.4, r);
  };

  // Pagoda block: a shop podium, then three to five tiers that step in, each under a flared eave.

  const pagoda = (x, z, s, st, b, r) => {
    const T = frame(x, z, s), { U, V } = T;
    if (Math.min(U, V) < 10) return shop(x, z, s, st, b, r);
    const pst = paint(st, r), top = H.lerp(st.h0 * 1.8, st.h1 * 1.3, r()) * b, n = 3 + Math.floor(r() * 3);
    const pu = U * .94, pv = V * .9, ph = 5.2;
    T.b(0, 0, pu, pv, ph, { ...pst, lit: .2 }, r, { roof: false, skin: SKINS.bands });
    const bays = Math.max(1, Math.round(pu / 9)), bw = pu / bays, store = r() < .15 ? Math.floor(r() * bays) : -1;
    for (let k = 0; k < bays; k++) {
      const u = -pu / 2 + (k + .5) * bw;
      if (k === store) kwiky(T, u, pv / 2 - 3, bw - .4, 6);
      else shopfront(T, u, bw - .4, pv / 2, r);
    }
    eave(T, 0, 0, pu, pv, ph, r);
    let y = ph + 1, uu = pu * .82, vv = pv * .78;
    const th = Math.max(6, (top - y) / n), c = pick(r, [PINK, CYAN]);
    for (let k = 0; k < n; k++) {
      T.b(0, 0, uu, vv, th - 1, pst, r, { y0: y, roof: false, skin: k % 2 ? SKINS.bands : SKINS.grid });
      if (k === 0) for (const su of [-1, 1]) T.gl(su * (uu / 2 + .2), y + th / 2, vv / 2 + .2, .3, th - 2, .3, dim(c, 1.1));
      if (k === 1 && r() < .7) T.holo(0, 0, uu, vv, y + th * .45, r, uu * .8);
      y += th - 1;
      eave(T, 0, 0, uu, vv, y, r);
      y += 1; uu *= .84; vv *= .84;
    }
    T.b(0, 0, uu * .9, vv * .9, 5, { ...pst, lit: 0 }, r, { y0: y, shape: 'pyr', roof: false });
    if (y > 40) blade(T, (r() < .5 ? -1 : 1) * pu * .4, pv / 2, ph + 1 + Math.min(14, y * .3) / 2, Math.min(14, y * .3), r);
  };

  // Gaming hall: a wide dark box behind a huge screen, a chase-light marquee, and a pavilion crown on the roof.

  const hall = (x, z, s, st, b, r) => {
    const T = frame(x, z, s), { U, V } = T;
    if (U < 16 || V < 11) return shop(x, z, s, st, b, r);
    const pst = paint(st, r), hh = (12 + r() * 6) * b, bu = U * .94, bv = V * .85, fv = bv / 2, c = pick(r, NEON);
    T.b(0, 0, bu, bv, hh, { ...pst, lit: .12 }, r, { roof: false, skin: SKINS.sparse });
    T.gl(0, 2.2, fv + .1, bu * .6, 4, .1, [1.2, 1.1, 1]);
    T.box(0, 5.2, fv + 1.2, bu * .9, .5, 2.4, EAVE);
    const n = Math.floor(bu * .9 / 2.2);
    for (let k = 0; k <= n; k++) T.gl(-bu * .45 + k * 2.2, 4.85, fv + 2.35, .4, .4, .4, k % 2 ? PINK : GOLD);
    T.text(pick(r, WORDS), 0, 7.6, fv + .3, Math.min(bu * .7, 16), 2.6, dim(c, 1.4));
    T.holo(0, 0, bu, bv, Math.max(11, hh * .7), r, Math.min(bu * .8, 22));
    for (const su of [-1, 1]) T.gl(su * (bu / 2 + .2), hh / 2, fv + .2, .4, hh - 1, .4, dim(su < 0 ? PINK : CYAN, 1.2));
    pool(...T.P(0, fv + 5), bu * .35, dim(c, .08));
    eave(T, 0, 0, bu, bv, hh, r);
    T.b(0, -bv * .1, bu * .4, bv * .35, 4, pst, r, { y0: hh + 1, roof: false, skin: SKINS.sparse });
    eave(T, 0, -bv * .1, bu * .4, bv * .35, hh + 5, r);
    T.b(0, -bv * .1, bu * .36, bv * .3, 3.5, { ...pst, lit: 0 }, r, { y0: hh + 6, shape: 'pyr', roof: false });
  };

  // Arcade lane: two rows of shops either side of a lane that runs in from the street, under glowing vault ribs.

  const galleria = (x, z, s, st, b, r) => {
    const T = frame(x, z, s), { U, V } = T;
    if (U < 18 || V < 12) return shop(x, z, s, st, b, r);
    const pst = paint(st, r), lane = 6, ru = (U - lane) / 2 - .5, rv = V * .95, h = H.lerp(st.h0 * .8, st.h0 * 1.2, r()) * b;
    for (const su of [-1, 1]) {
      const u = su * (lane / 2 + ru / 2);
      T.b(u, 0, ru, rv, h, pst, r, { roof: true, skin: SKINS.bands });
      eave(T, u, 0, ru - 4, rv - 4, h, r);
      shopfront(T, u, ru, rv / 2, r);
      for (let v = -rv / 2 + 3; v < rv / 2 - 2; v += 5) T.gl(-su * (ru / 2 + .05) + u, 1.6, v, .1, 2.8, 4, dim(pick(r, NEON), .3));
    }
    for (let v = -rv / 2 + 2; v < rv / 2; v += 4) {
      const [px, pz] = T.P(0, v);
      put(GLOWS.ring, px, h, pz, lane + .6, 1, lane * .9, T.ry, Math.PI / 2, dim(CYAN, .45));
      if (r() < .5) glow(px, h - 3.2, pz, .6, .6, .6, r() < .5 ? RED : GOLD);
    }
    T.gl(0, h + 2.7, 0, .3, .3, rv, dim(CYAN, .5));
    pool(...T.P(0, 0), Math.min(rv, 16) / 2, dim(PINK, .07));
    for (const su of [-1, 1]) T.box(su * (lane / 2 + .3), h / 2 + 1, rv / 2 + .6, .6, h + 2, .6, EAVE);
    eave(T, 0, rv / 2 + .6, lane - 3, .4, h + 2, r, PINK);
    T.text(pick(r, ['AKEIDITO ARCADE', '오락실', 'ARCADE']), 0, h, rv / 2 + 1, lane * .9, 1.3, dim(PINK, 1.3));
  };

  // Heights tower: a shop podium, then four to six setback tiers under flared eaves, a screen strip, a spire.

  const tower = (x, z, s, st, b, r) => {
    const T = frame(x, z, s), { U, V } = T;
    if (Math.min(U, V) < 13) return pagoda(x, z, s, st, b, r);
    const pst = { ...paint(st, r), lit: .38 }, top = H.lerp(st.h1 * 2, st.h1 * 3.4, r()) * b, n = 4 + Math.floor(r() * 3);
    const pu = U * .94, pv = V * .9, ph = 7;
    T.b(0, 0, pu, pv, ph, { ...pst, lit: .2 }, r, { roof: false, skin: SKINS.bands });
    for (const su of [-1, 1]) shopfront(T, su * pu / 4, pu / 2 - .4, pv / 2, r);
    eave(T, 0, 0, pu, pv, ph, r);
    let y = ph + 1, uu = pu * .78, vv = pv * .74;
    const th = (top - y) / n, c = pick(r, [PINK, CYAN]);
    for (let k = 0; k < n; k++) {
      T.b(0, 0, uu, vv, th - 1, pst, r, { y0: y, roof: false, skin: k % 2 ? SKINS.curtain : SKINS.bands });
      T.gl(uu * .35, y + th / 2, vv / 2 + .2, .8, th - 3, .2, dim(c, .9));
      if (k === 1 || (k === n - 2 && r() < .5)) T.holo(0, 0, uu, vv, y + th * .5, r, uu * .8);
      y += th - 1;
      eave(T, 0, 0, uu, vv, y, r, k === n - 1 ? c : AMBER);
      y += 1; uu *= .9; vv *= .9;
    }
    T.b(0, 0, uu * .9, vv * .9, 10, { ...pst, lit: 0 }, r, { y0: y, shape: 'pyr', roof: false });
    const [cx, cz] = T.P(0, 0);
    prop('cyl', cx, y + 16, cz, .5, 14, .5, [.2, .2, .22]);
    beacon(cx, y + 23.5, cz, r);
  };

  return { ak_shop: shop, ak_kwiky: kwikyLot, ak_pagoda: pagoda, ak_hall: hall, ak_galleria: galleria, ak_tower: tower };
}
