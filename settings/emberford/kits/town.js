// Emberford's kits: burgage houses that front their street, and the town's landmarks. Kit signature:
// (x, z, s, st, b, r) in the lot frame. H.frame() gives the lot rectangle and its front, the side toward the street.

const HALF_PI = Math.PI / 2;

export function kits(H) {
  const { bld, prop, glow, puff, flickerGlow, SKINS } = H;
  const ROOFS = { tile: [SKINS.tile, [.34, .13, .07]], brown: [SKINS.tile, [.24, .11, .07]], thatch: [SKINS.thatch, [.3, .24, .13]],
    slate: [SKINS.tile, [.15, .15, .16]] };

  // The house strip along the front of the lot: its centre, its frontage, its depth and the turn that runs its
  // ridge along the street. Back is the yard behind it.

  function strip(x, z, s, depth) {
    const f = H.frame(), w = f?.w ?? s, d = f?.d ?? s, fr = f?.front ?? { x: 0, z: 1 };
    const across = fr.z !== 0, frontage = (across ? w : d) - 1, deep = Math.min(depth, (across ? d : w) - 2);
    const off = ((across ? d : w) - deep) / 2 - .5;
    const cx = x + fr.x * off, cz = z + fr.z * off, back = ((across ? d : w) - deep - 1) / 2;
    return { cx, cz, frontage, deep, ry: across ? 0 : HALF_PI, fr, back, yard: [x - fr.x * (deep / 2 + .5), z - fr.z * (deep / 2 + .5)] };
  }

  // A house body, a pitched roof along the street and a lit door on the street side.

  function house(p, h, skin, roof, st, r, lit = st.lit) {
    const [w, d] = [p.frontage, p.deep];
    bld(p.cx, p.cz, w, d, h, st, r, { skin, ry: p.ry, roof: false, kibble: false, lit });
    bld(p.cx, p.cz, w + .7, d + .9, Math.min(w, d) * .55, st, r, { y0: h, shape: 'gable', skin: roof[0], base: roof[1], lit: 0, roof: false, ry: p.ry });
    glow(p.cx + p.fr.x * (d / 2 + .05), 1.2, p.cz + p.fr.z * (d / 2 + .05), p.fr.x ? .05 : .9, 1.9, p.fr.x ? .9 : .05, [1, .6, .25]);
    if (r() < .5) prop('box', p.cx + (r() - .5) * w * .5 * (p.fr.x ? 0 : 1), h + Math.min(w, d) * .45, p.cz + (r() - .5) * w * .5 * (p.fr.z ? 0 : 1), .9, 2.4, .9, [.12, .1, .09]);
  }
  const pick = (r, list) => list[Math.floor(r() * list.length)];
  const tree = (x, z, r) => {
    const h = 4 + r() * 3;
    prop('cyl', x, h * .3, z, .4, h * .6, .4, [.12, .08, .05]);
    prop('cone', x, h * .75, z, 3 + r() * 2, h * .7, 3 + r() * 2, [.05, .12 + r() * .05, .05]);
  };

  return {

    // Two storeys of timber frame or plaster under tile or thatch.

    ef_house(x, z, s, st, b, r) {
      const p = strip(x, z, s, 8 + r() * 3);
      house(p, 5.5 + r() * 2, pick(r, [SKINS.timber, SKINS.timber, SKINS.plaster]), pick(r, [ROOFS.tile, ROOFS.brown, ROOFS.thatch]), st, r);
      if (p.back > 3 && r() < .5) tree(p.yard[0], p.yard[1], r);
    },

    // A tall town house: a stone ground floor, two or three timber floors above, the front jettied out.

    ef_tall(x, z, s, st, b, r) {
      const p = strip(x, z, s, 9 + r() * 3), floors = 2 + (r() < .4), hs = 3.6;
      bld(p.cx, p.cz, p.frontage, p.deep, hs, st, r, { skin: SKINS.stone, ry: p.ry, roof: false, kibble: false, lit: st.lit * 1.4 });
      const jut = { ...p, cx: p.cx + p.fr.x * .35, cz: p.cz + p.fr.z * .35, deep: p.deep + .7 };
      bld(jut.cx, jut.cz, jut.frontage, jut.deep, floors * 3, st, r, { y0: hs, skin: SKINS.timber, ry: p.ry, roof: false, kibble: false });
      const roof = pick(r, [ROOFS.tile, ROOFS.brown, ROOFS.slate]);
      bld(jut.cx, jut.cz, jut.frontage + .7, jut.deep + .9, Math.min(jut.frontage, jut.deep) * .6, st, r,
        { y0: hs + floors * 3, shape: 'gable', skin: roof[0], base: roof[1], lit: 0, roof: false, ry: p.ry });
      glow(p.cx + p.fr.x * (p.deep / 2 + .05), 1.2, p.cz + p.fr.z * (p.deep / 2 + .05), p.fr.x ? .05 : 1.4, 2, p.fr.x ? 1.4 : .05, [1.1, .65, .28]);
    },

    // A stone house under a slate or tile roof, the castle ward's kind.

    ef_stone(x, z, s, st, b, r) {
      const p = strip(x, z, s, 9 + r() * 3);
      house(p, 6.5 + r() * 2.5, SKINS.stone, pick(r, [ROOFS.slate, ROOFS.slate, ROOFS.tile]), st, r);
    },

    // A house with a workshop behind it: a lean shed, a forge glow and smoke.

    ef_workshop(x, z, s, st, b, r) {
      const p = strip(x, z, s, 8);
      house(p, 5 + r() * 1.5, pick(r, [SKINS.timber, SKINS.plaster]), pick(r, [ROOFS.thatch, ROOFS.brown]), st, r);
      if (p.back < 5) return;
      const [yx, yz] = p.yard, sd = Math.min(p.back - 1, 6);
      bld(yx - p.fr.x * (p.back - sd) / 2, yz - p.fr.z * (p.back - sd) / 2, p.fr.x ? sd : p.frontage * .8, p.fr.x ? p.frontage * .8 : sd, 3,
        st, r, { skin: SKINS.plaster, roof: false, kibble: false, lit: 0 });
      if (r() < .6) {
        flickerGlow(yx, 1, yz, .8, .6, .8, [1.8, .6, .15], r, .7);
        puff(yx, 6 + r() * 3, yz, 2.5, [.12, .11, .1]);
      }
    },

    // A garden plot: fruit trees, a fence along the street and a well.

    ef_yard(x, z, s, st, b, r) {
      const f = H.frame(), w = f?.w ?? s, d = f?.d ?? s, fr = f?.front ?? { x: 0, z: 1 };
      prop('box', x, .05, z, w - 1, .1, d - 1, [.05, .09, .04]);
      for (let k = 2 + Math.floor(r() * 3); k > 0; k--) tree(x + (r() - .5) * (w - 4), z + (r() - .5) * (d - 4), r);
      prop('box', x + fr.x * (w / 2 - .6), .5, z + fr.z * (d / 2 - .6), fr.x ? .15 : w - 1, 1, fr.x ? d - 1 : .15, [.14, .1, .06]);
      if (r() < .3) prop('cyl', x, .5, z, 1.4, 1, 1.4, [.2, .19, .18]);
    },
  };
}

// Every lot is narrow, so tier 0 decides each ward's mix. The higher tiers repeat it.

const CASTLE = ['ef_stone', 'ef_stone', 'ef_house', 'ef_tall', 'ef_yard'];
const MARKET = ['ef_tall', 'ef_tall', 'ef_house', 'ef_house', 'ef_stone'];
const CRAFT = ['ef_workshop', 'ef_workshop', 'ef_house', 'ef_house', 'ef_yard', 'ef_tall'];
export const tiers = {
  'castle-ward': { 0: CASTLE, 1: CASTLE, 2: CASTLE },
  'market-ward': { 0: MARKET, 1: MARKET, 2: MARKET },
  'craft-ward': { 0: CRAFT, 1: CRAFT, 2: CRAFT },
};

// ---------- landmarks ----------
// Each stands free at its site from city.json (gen/town.py), whose rot turns it. The engine seats a free landmark
// unturned, so a build turns its own parts.

export function landmarks(H) {
  const { bld, prop, glow, flickerGlow, SKINS, CITY } = H;
  const site = kind => CITY.sites?.find(s => s.kind === kind);
  const STONE = [.2, .19, .17], DARK = [.1, .09, .08];

  // Local point (u, v) in a site turned by a, as an offset from the site's centre.

  const turn = (a, u, v) => [u * Math.cos(a) - v * Math.sin(a), u * Math.sin(a) + v * Math.cos(a)];
  const crenel = (x, z, y, len, ry, r) => {
    for (let k = -len / 2 + 1; k < len / 2; k += 2.4) {
      const dx = Math.cos(-ry) * k, dz = Math.sin(-ry) * k;
      bld(x + dx, z + dz, 1.2, 1.1, 1.1, { base: STONE, win: [1, .7, .4], lit: 0, grime: .5, w: 0 }, () => .5, { y0: y, skin: SKINS.stone, roof: false, kibble: false, lit: 0, ry });
    }
  };
  const TOWER = { base: STONE, win: [1, .7, .4], lit: .15, grime: .5, w: 0 };
  const tower = (x, z, dia, h, roofRgb) => {
    bld(x, z, dia, dia, h, TOWER, () => .5, { shape: 'cyl', skin: SKINS.stone, roof: false, kibble: false });
    bld(x, z, dia * 1.2, dia * 1.2, dia * .9, TOWER, () => .5, { y0: h, shape: 'pyr', skin: SKINS.tile, base: roofRgb, lit: 0, roof: false });
  };
  const pick3 = r => [[.9, .2, .15], [.2, .35, 1], [.9, .7, .2], [.25, .7, .3]][Math.floor(r() * 4)];
  const out = {};
  const keep = site('keep'), church = site('church'), hall = site('hall');

  if (keep) out.ef_keep = {
    at: keep.at, free: [keep.w, keep.d], label: keep.name, labelY: 46,

    // A square keep with corner turrets inside a curtain wall with four round towers and a gatehouse toward town.

    build(x, z, w, d, st, r) {
      const S = { ...st, base: STONE, lit: .25 };
      bld(0, 0, 18, 18, 30, S, r, { skin: SKINS.stone, roof: false, kibble: false });
      crenel(0, 9, 30, 18, 0, r); crenel(0, -9, 30, 18, 0, r); crenel(9, 0, 30, 18, HALF_PI, r); crenel(-9, 0, 30, 18, HALF_PI, r);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) tower(sx * 9, sz * 9, 4.5, 34, [.16, .16, .17]);
      const h = w / 2 - 2;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) tower(sx * h, sz * h, 8, 13, [.16, .16, .17]);
      for (const s of [-1, 1]) {
        bld(0, s * h, w - 8, 2.4, 9, S, r, { skin: SKINS.stone, roof: false, kibble: false, lit: 0 });
        bld(s * h, 0, 2.4, d - 8, 9, S, r, { skin: SKINS.stone, roof: false, kibble: false, lit: 0 });
      }
      for (const s of [-1, 1]) tower(s * 6, h + 1, 6, 14, [.16, .16, .17]);
      prop('box', 0, 11, h + 1, 12, 3, 4, STONE);
      for (const s of [-1, 1]) flickerGlow(s * 3.5, 3.5, h + 3, .4, .6, .4, [2, .9, .3], r, .7);
      prop('box', 0, 36, 0, .25, 8, .25, DARK);
      glow(1.2, 39, 0, 2.2, 1.4, .08, [.9, .15, .1]);
      return { focus: [0, 0], span: 120, face: [0, 1] };
    },
  };

  if (church) out.ef_church = {
    at: church.at, free: [church.w, church.d], label: church.name, labelY: 40,

    // A stone nave under a steep roof, a west tower with a spire, a round east end, and coloured windows.

    build(x, z, w, d, st, r) {
      const a = church.rot, S = { ...st, base: [.24, .22, .19], lit: 0 }, ry = -a;
      const at = (u, v) => turn(a, u, v);
      const [nx, nz] = at(2, 0);
      bld(nx, nz, w - 14, d - 10, 13, S, r, { skin: SKINS.stone, roof: false, kibble: false, ry });
      bld(nx, nz, w - 13, d - 8.6, 9, S, r, { y0: 13, shape: 'gable', skin: SKINS.tile, base: [.15, .15, .16], lit: 0, roof: false, ry });
      const [tx, tz] = at(-w / 2 + 6, 0);
      bld(tx, tz, 10, 10, 26, S, r, { skin: SKINS.stone, roof: false, kibble: false, ry, lit: .1 });
      bld(tx, tz, 10, 10, 16, S, r, { y0: 26, shape: 'pyr', skin: SKINS.tile, base: [.15, .15, .16], lit: 0, roof: false, ry });
      const [ex, ez] = at(w / 2 - 7, 0);
      prop('cyl', ex, 5.5, ez, 12, 11, 12, [.24, .22, .19]);
      prop('cone', ex, 14, ez, 13, 6, 13, [.15, .15, .16]);
      for (let u = -10; u <= 12; u += 5.5) for (const v of [-1, 1]) {
        const [gx, gz] = at(u, v * (d - 10) / 2 * 1.01);
        glow(gx, 7, gz, Math.abs(Math.cos(a)) > .5 ? 1.4 : .06, 4.5, Math.abs(Math.cos(a)) > .5 ? .06 : 1.4, pick3(r).map(v => v * .45));
      }
      const [dx, dz] = at(-w / 2 + .9, 0);
      flickerGlow(dx, 2.5, dz, .3, .5, .3, [2, .9, .3], r, .7);
      return { focus: [0, 0], span: 90 };
    },
  };
  if (hall) out.ef_hall = {
    at: hall.at, free: [hall.w, hall.d], label: hall.name, labelY: 22,

    // An open arcade on stone posts with a timber hall above it.

    build(x, z, w, d, st, r) {
      const a = hall.rot, ry = -a, S = { ...st, base: [.26, .22, .16], lit: .5 };
      for (let u = -w / 2 + 1; u <= w / 2 - 1; u += 4) for (const v of [-d / 2 + 1, d / 2 - 1]) {
        const [px, pz] = turn(a, u, v);
        prop('box', px, 2, pz, .9, 4, .9, STONE);
      }
      bld(0, 0, w, d, 5, S, r, { y0: 4, skin: SKINS.timber, roof: false, kibble: false, ry });
      bld(0, 0, w + .8, d + 1, 5.5, S, r, { y0: 9, shape: 'gable', skin: SKINS.tile, base: [.32, .13, .07], lit: 0, roof: false, ry });
      for (let k = 0; k < 4; k++) {
        const [lx, lz] = turn(a, -w / 2 + 4 + k * (w - 8) / 3, 0);
        flickerGlow(lx, 3.4, lz, .3, .4, .3, [1.8, .8, .3], r, .7);
      }
      return { focus: [0, 0], span: 70 };
    },
  };

  // The market square: stalls round its rim and a well and a market cross at its heart. It has no label of its own,
  // because the square is the setting's centre and carries the centre's card.

  out.ef_square = {
    at: [0, 0], free: [60, 60],
    build(x, z, w, d, st, r) {
      prop('cyl', 0, .6, 0, 3.2, 1.2, 3.2, STONE);
      prop('box', 0, 2.4, 0, .25, 2.6, .25, DARK);
      prop('box', 0, 3.8, 0, 2.2, .25, .25, DARK);
      prop('box', 6, 2, 4, .5, 4, .5, STONE);
      prop('box', 6, 4.6, 4, 1.6, .4, .4, STONE);
      for (let k = 0; k < 14; k++) {
        const a = k / 14 * Math.PI * 2 + .2, rad = 24 + r() * 3, sx = Math.cos(a) * rad, sz = Math.sin(a) * rad;
        if ((hall && Math.hypot(sx - hall.at[0], sz - hall.at[1]) < 18)) continue;
        prop('box', sx, 1, sz, 3, 2, 2.2, [.16, .12, .08], -a);
        prop('box', sx, 2.3, sz, 3.6, .15, 2.8, [[.5, .15, .1], [.15, .25, .45], [.45, .4, .15], [.2, .35, .18]][k % 4], -a);
        if (k % 3 === 0) flickerGlow(sx, 2.7, sz, .25, .35, .25, [1.8, .85, .3], r, .7);
      }
    },
  };

  // The town wall: stone curtain along city.json's wall, towers every few stretches, and a gatehouse at each gate
  // with torches. It stands free at the centre, so its parts take world coordinates. An open town (town.json
  // walls: false) has no wall in city.json and builds none.

  if (CITY.wall?.length) out.ef_wall = {
    at: [0, 0], free: [40, 40], label: 'Town Wall', labelY: 16,
    build(x, z, w, d, st, r) {
      const W = CITY.wall ?? [], G = CITY.gates ?? [], S = { ...st, base: STONE, lit: 0 };
      const nearGate = (px, pz) => G.some(([gx, gz]) => Math.hypot(px - gx, pz - gz) < 9);
      W.forEach((p, i) => {
        const q = W[(i + 1) % W.length], mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2, len = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (nearGate(mx, mz)) return;
        const ry = Math.atan2(-(q[1] - p[1]), q[0] - p[0]);
        bld(mx, mz, len + .8, 2.6, 8, S, r, { skin: SKINS.stone, roof: false, kibble: false, ry, lit: 0 });
        crenel(mx, mz, 8, len, ry, r);
        if (i % 6 === 0 && !nearGate(p[0], p[1])) tower(p[0], p[1], 7, 12, [.3, .14, .08]);
      });
      for (const [gx, gz, deg] of G) {
        const a = deg * Math.PI / 180, tx = -Math.sin(a), tz = Math.cos(a);
        for (const s of [-1, 1]) tower(gx + tx * s * 7, gz + tz * s * 7, 7.5, 14, [.3, .14, .08]);
        bld(gx, gz, 4, 14, 4, S, r, { y0: 7, skin: SKINS.stone, roof: false, kibble: false, ry: -a, lit: 0 });
        for (const s of [-1, 1]) flickerGlow(gx + tx * s * 4 + Math.cos(a) * 3, 3.5, gz + tz * s * 4 + Math.sin(a) * 3, .35, .5, .35, [2, .9, .3], r, .7);
      }
      const [gx, gz] = G[0] ?? [0, 0];
      return { focus: [gx, gz], span: 80 };
    },
  };
  return out;
}
