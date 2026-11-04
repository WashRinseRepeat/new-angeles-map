// Emberford's kits: burgage houses that front their street, and the town's landmarks. Kit signature:
// (x, z, s, st, b, r) in the lot frame. H.frame() gives the lot rectangle and its front, the side toward the street.

const HALF_PI = Math.PI / 2;

// The parts every house kit shares: the strip a house fills, the house itself, the yard behind it, a tree and the
// roof colours. Other medieval packs build on them too.

export function parts(H) {
  const { bld, prop, glow, SKINS } = H;
  const ROOFS = { tile: [SKINS.tile, [.34, .13, .07]], brown: [SKINS.tile, [.24, .11, .07]], thatch: [SKINS.thatch, [.3, .24, .13]],
    slate: [SKINS.tile, [.15, .15, .16]] };

  // The house strip along the front of the lot: its centre, its frontage, its depth and the turn that runs its
  // ridge along the street. It fills the lot's width, so neighbours stand wall to wall. Back is the yard behind it.

  function strip(x, z, s, depth) {
    const f = H.frame(), w = f?.w ?? s, d = f?.d ?? s, fr = f?.front ?? { x: 0, z: 1 };
    const across = fr.z !== 0, frontage = (across ? w : d) - .2, deep = Math.min(depth, (across ? d : w) - 2);
    const off = ((across ? d : w) - deep) / 2 - .5;
    const cx = x + fr.x * off, cz = z + fr.z * off, back = ((across ? d : w) - deep - 1) / 2;
    return { cx, cz, frontage, deep, ry: across ? 0 : HALF_PI, fr, back, yard: [x - fr.x * (deep / 2 + .5), z - fr.z * (deep / 2 + .5)] };
  }

  // A stone plinth 0.5 m high under a house's walls, a little wider than them, and a door step on its street side.

  function footing(p, w, d) {
    prop('box', p.cx, .25, p.cz, (p.fr.x ? d : w) + .3, .5, (p.fr.x ? w : d) + .3, [.22, .21, .19]);
    prop('box', p.cx + p.fr.x * (d / 2 + .35), .1, p.cz + p.fr.z * (d / 2 + .35), p.fr.x ? .6 : 1.4, .2, p.fr.x ? 1.4 : .6, [.26, .25, .23]);
  }

  // A house body on its footing, a pitched roof along the street and a lit door on the street side.

  function house(p, h, skin, roof, st, r, lit = st.lit) {
    const [w, d] = [p.frontage, p.deep];
    footing(p, w, d);
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

  // The yard behind a house. In the lot's own axes u runs along the street and v toward it. The yard is fenced on
  // its left side and at its back, so each line between neighbours is built once, then holds a few things by ward:
  // the castle ward walls its yards in stone round a tree or a well, the market ward fences them in planks round
  // barrels, crates and a shed, and the craft ward weaves wattle round woodpiles, hay, vegetable beds and a cart.
  // Washing hangs in market and craft yards.

  const FENCE = { castle: [1.6, .45, [.24, .22, .19]], market: [1.4, .1, [.18, .12, .07]], craft: [1.1, .14, [.22, .16, .09]] };
  const STUFF = { castle: ['tree', 'well', 'tree', 'beds'], market: ['barrels', 'crates', 'shed', 'wash'],
    craft: ['wood', 'hay', 'beds', 'cart', 'wash', 'beds'] };
  const CLOTH = [[.5, .48, .42], [.35, .12, .08], [.15, .2, .32], [.45, .4, .25]];
  function yard(p, x, z, s, st, r) {
    const f = H.frame(), w = f?.w ?? s, d = f?.d ?? s, fr = p.fr, ax = { x: fr.z ? 1 : 0, z: fr.x ? 1 : 0 };
    const hw = (fr.z ? w : d) / 2 - .3, hd = (fr.z ? d : w) / 2 - .3, depth = p.back;
    if (depth < 2.5) return;
    const ward = st.w < .25 ? 'castle' : st.w > .75 ? 'market' : 'craft';
    const at = (u, v) => [x + ax.x * u + fr.x * v, z + ax.z * u + fr.z * v];
    const box = (u, v, y, lu, h, lv, rgb) => { const [px, pz] = at(u, v); prop('box', px, y, pz, ax.x ? lu : lv, h, ax.x ? lv : lu, rgb); };
    const cyl = (u, v, y, dia, h, rgb, kind = 'cyl') => { const [px, pz] = at(u, v); prop(kind, px, y, pz, dia, h, dia, rgb); };
    const [fh, ft, fc] = FENCE[ward];
    box(0, -hd, fh / 2, 2 * hw, fh, ft, fc);
    box(-hw, -hd + depth / 2, fh / 2, ft, fh, depth, fc);
    const put = {
      tree: (u, v) => tree(...at(u, v), r),
      well: (u, v) => {
        cyl(u, v, .45, 1.4, .9, [.24, .22, .19]);
        for (const k of [-.6, .6]) box(u + k, v, 1.2, .12, 1.6, .12, [.14, .1, .06]);
        box(u, v, 2, 1.4, .1, .1, [.14, .1, .06]);
      },
      barrels: (u, v) => { for (let k = 1 + Math.floor(r() * 3); k > 0; k--) cyl(u + (r() - .5) * 1.6, v + (r() - .5) * 1.2, .45, .6, .9, [.2, .13, .07]); },
      crates: (u, v) => { for (let k = 0; k < 3; k++) box(u + (k % 2) * .9 - .45, v, .4 + (k > 1) * .8, .8, .8, .8, [.26, .19, .11]); },
      shed: (u, v) => {
        const [px, pz] = at(u, v), sw = Math.min(3, hw), sd = 2.2;
        bld(px, pz, sw, sd, 2.2, st, r, { skin: SKINS.timber, roof: false, kibble: false, lit: 0, ry: p.ry });
        bld(px, pz, sw + .4, sd + .4, 1.1, st, r, { y0: 2.2, shape: 'gable', skin: ROOFS.brown[0], base: ROOFS.brown[1], lit: 0, roof: false, ry: p.ry });
      },
      wash: (u, v) => {
        const L = Math.min(4, hw * 1.5);
        for (const k of [-L / 2, L / 2]) box(u + k, v, 1, .08, 2, .08, [.14, .1, .06]);
        box(u, v, 1.95, L, .03, .03, [.3, .28, .25]);
        for (let k = 0; k < 3; k++) box(u - L / 3 + k * L / 3, v, 1.55, .6, .7, .04, CLOTH[Math.floor(r() * CLOTH.length)]);
      },
      wood: (u, v) => { box(-hw + .9, v, .55, 1, 1.1, Math.min(2.6, depth - 1), [.3, .2, .11]); cyl(u, v, .3, .5, .6, [.25, .17, .1]); },
      hay: (u, v) => { cyl(u, v, .8, 2.2, 1.6, [.42, .36, .16]); cyl(u, v, 2.1, 2.3, 1.1, [.4, .34, .15], 'cone'); },
      beds: (u, v) => {
        for (let k = 0; k < 3 && v + k * 1.4 < -hd + depth - .6; k++) {
          box(0, v + k * 1.4, .12, 2 * hw - 1.6, .25, .9, [.12, .08, .05]);
          box(0, v + k * 1.4, .32, 2 * hw - 1.9, .18, .5, [.12 + r() * .05, .2 + r() * .06, .07]);
        }
      },
      cart: (u, v) => {
        box(u, v, .8, 1.4, .35, 2.2, [.24, .16, .09]);
        for (const k of [-.8, .8]) box(u + k, v, .55, .12, 1.1, 1.1, [.12, .08, .05]);
        box(u, v + 1.6, .6, .1, .1, 1.6, [.2, .14, .08]);
      },
    };
    const n = depth > 7 ? 3 : depth > 4 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const kind = pick(r, STUFF[ward]), v = -hd + depth * (k + .5) / n, u = (r() - .5) * Math.max(0, 2 * hw - 4);
      put[kind](u, v);
    }
  }

  return { ROOFS, strip, house, pick, tree, yard };
}

export function kits(H) {
  const { bld, prop, glow, flickerGlow, puff, SKINS } = H;
  const { ROOFS, strip, house, pick, tree, yard } = parts(H);
  return {

    // Two storeys of timber frame or plaster under tile or thatch.

    ef_house(x, z, s, st, b, r) {
      const p = strip(x, z, s, 8 + r() * 3);
      house(p, 5.5 + r() * 2, pick(r, [SKINS.timber, SKINS.timber, SKINS.plaster]), pick(r, [ROOFS.tile, ROOFS.brown, ROOFS.thatch]), st, r);
      yard(p, x, z, s, st, r);
    },

    // A tall town house: a stone ground floor, two or three timber floors above, the front jettied out.

    ef_tall(x, z, s, st, b, r) {
      const p = strip(x, z, s, 9 + r() * 3), floors = 2 + (r() < .4), hs = 3.6;
      footing(p, p.frontage, p.deep);
      bld(p.cx, p.cz, p.frontage, p.deep, hs, st, r, { skin: SKINS.stone, ry: p.ry, roof: false, kibble: false, lit: st.lit * 1.4 });
      const jut = { ...p, cx: p.cx + p.fr.x * .35, cz: p.cz + p.fr.z * .35, deep: p.deep + .7 };
      bld(jut.cx, jut.cz, jut.frontage, jut.deep, floors * 3, st, r, { y0: hs, skin: SKINS.timber, ry: p.ry, roof: false, kibble: false });
      const roof = pick(r, [ROOFS.tile, ROOFS.brown, ROOFS.slate]);
      bld(jut.cx, jut.cz, jut.frontage + .7, jut.deep + .9, Math.min(jut.frontage, jut.deep) * .6, st, r,
        { y0: hs + floors * 3, shape: 'gable', skin: roof[0], base: roof[1], lit: 0, roof: false, ry: p.ry });
      glow(p.cx + p.fr.x * (p.deep / 2 + .05), 1.2, p.cz + p.fr.z * (p.deep / 2 + .05), p.fr.x ? .05 : 1.4, 2, p.fr.x ? 1.4 : .05, [1.1, .65, .28]);
      yard(p, x, z, s, st, r);
    },

    // A stone house under a slate or tile roof, the castle ward's kind.

    ef_stone(x, z, s, st, b, r) {
      const p = strip(x, z, s, 9 + r() * 3);
      house(p, 6.5 + r() * 2.5, SKINS.stone, pick(r, [ROOFS.slate, ROOFS.slate, ROOFS.tile]), st, r);
      yard(p, x, z, s, st, r);
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

    // A one-storey cottage under thatch or a brown tile roof, the suburbs' kind.

    ef_cottage(x, z, s, st, b, r) {
      const p = strip(x, z, s, 6 + r() * 2);
      house(p, 3 + r() * .6, pick(r, [SKINS.timber, SKINS.plaster, SKINS.plaster]), pick(r, [ROOFS.thatch, ROOFS.thatch, ROOFS.brown]), st, r);
      yard(p, x, z, s, { ...st, w: .5 }, r);
    },

    // A garden plot: fruit trees, a fence along the street, sometimes a well and vegetable beds at the back.

    ef_yard(x, z, s, st, b, r) {
      const f = H.frame(), w = f?.w ?? s, d = f?.d ?? s, fr = f?.front ?? { x: 0, z: 1 };
      prop('box', x, .05, z, w - 1, .1, d - 1, [.05, .09, .04]);
      for (let k = 2 + Math.floor(r() * 3); k > 0; k--) tree(x + (r() - .5) * (w - 4), z + (r() - .5) * (d - 4), r);
      prop('box', x + fr.x * (w / 2 - .6), .5, z + fr.z * (d / 2 - .6), fr.x ? .15 : w - 1, 1, fr.x ? d - 1 : .15, [.14, .1, .06]);
      if (r() < .3) prop('cyl', x, .5, z, 1.4, 1, 1.4, [.2, .19, .18]);
      if (r() < .5) for (let k = 0; k < 3; k++) {
        const v = -(fr.z ? d : w) / 2 + 2 + k * 1.4;
        const L = (fr.z ? w : d) - 3;
        prop('box', x + fr.x * v, .12, z + fr.z * v, fr.x ? .9 : L, .25, fr.x ? L : .9, [.12, .08, .05]);
        prop('box', x + fr.x * v, .32, z + fr.z * v, fr.x ? .5 : L - .3, .18, fr.x ? L - .3 : .5, [.14, .22, .07]);
      }
    },
  };
}

// Every lot is narrow, so tier 0 decides each ward's mix. The higher tiers repeat it.

const CASTLE = ['ef_stone', 'ef_stone', 'ef_house', 'ef_tall', 'ef_yard'];
const MARKET = ['ef_tall', 'ef_tall', 'ef_house', 'ef_house', 'ef_stone'];
const CRAFT = ['ef_workshop', 'ef_workshop', 'ef_house', 'ef_house', 'ef_yard', 'ef_tall'];
const SUBURB = ['ef_cottage', 'ef_cottage', 'ef_cottage', 'ef_workshop', 'ef_house', 'ef_yard'];
export const tiers = {
  ...Object.fromEntries(['suburb-15', 'suburb-100', 'suburb-190', 'suburb-340'].map(id => [id, { 0: SUBURB, 1: SUBURB, 2: SUBURB }])),
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
  const ROOF_TILE = [SKINS.tile, [.34, .13, .07]];

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
    bld(x, z, dia, dia, h + 4, TOWER, () => .5, { y0: -4, shape: 'cyl', skin: SKINS.stone, roof: false, kibble: false });
    bld(x, z, dia * 1.2, dia * 1.2, dia * .9, TOWER, () => .5, { y0: h, shape: 'pyr', skin: SKINS.tile, base: roofRgb, lit: 0, roof: false });
  };
  const pick3 = r => [[.9, .2, .15], [.2, .35, 1], [.9, .7, .2], [.25, .7, .3]][Math.floor(r() * 4)];
  const out = {};
  const keep = site('keep'), church = site('church'), hall = site('hall');

  // The water mill on the river bank: a stone ground floor and a timber floor under a tile roof, a sluice along its
  // river side and a wheel of eight paddles that the river turns.

  const mill = site('mill');
  if (mill) {
    const a = Math.atan2(mill.at[1], mill.at[0]), away = [Math.cos(a), Math.sin(a)], along = [-away[1], away[0]];
    let wheel = null;
    out.ef_mill = {
      at: mill.at, free: [mill.w, mill.d], label: mill.name, labelY: 14,
      build(x, z, w, d, st, r) {
        const S = { ...st, base: STONE, lit: .2 }, ry = Math.atan2(along[0], along[1]);
        bld(0, 0, 12, 9, 4, S, r, { skin: SKINS.stone, roof: false, kibble: false, ry });
        bld(0, 0, 12, 9, 3.2, st, r, { y0: 4, skin: SKINS.timber, roof: false, kibble: false, ry });
        bld(0, 0, 12.8, 9.8, 4, st, r, { y0: 7.2, shape: 'gable', skin: ROOF_TILE[0], base: ROOF_TILE[1], lit: 0, roof: false, ry });
        const sx = away[0] * 5.6, sz = away[1] * 5.6;
        prop('box', sx, 1, sz, Math.abs(along[0]) * 9 + .5, 2, Math.abs(along[1]) * 9 + .5, STONE, 0);
        const T = H.THREE, wood = new T.MeshStandardMaterial({ color: new T.Color(.2, .13, .07), roughness: .9 });
        const pivot = new T.Group();
        pivot.position.set(away[0] * 7.2, 2.4, away[1] * 7.2);
        pivot.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(along[0], 0, along[1]));
        wheel = new T.Group();
        wheel.add(new T.Mesh(new T.CylinderGeometry(.25, .25, 1.6, 8), wood));
        wheel.add(new T.Mesh(new T.TorusGeometry(2.6, .12, 6, 24).rotateX(Math.PI / 2), wood));
        for (let k = 0; k < 8; k++) {
          const p = new T.Mesh(new T.BoxGeometry(.12, 1.1, 1.2), wood), b = k / 8 * Math.PI * 2;
          p.position.set(Math.cos(b) * 2.7, 0, Math.sin(b) * 2.7); p.rotation.y = -b;
          const spoke = new T.Mesh(new T.BoxGeometry(2.6, .1, .14), wood);
          spoke.position.set(Math.cos(b) * 1.3, 0, Math.sin(b) * 1.3); spoke.rotation.y = -b;
          wheel.add(p, spoke);
        }
        pivot.add(wheel);
        H.decor.add(pivot);
        return { focus: [0, 0], span: 60 };
      },
      update(t) { if (wheel) wheel.rotation.y = -t * .6; },
    };
  }

  if (keep) out.ef_keep = {
    at: keep.at, free: [keep.w, keep.d], label: keep.name, labelY: 46,

    // A square keep with corner turrets inside a curtain wall with four round towers and a gatehouse toward town. The
    // bailey round it holds a great hall, a stable, a chapel, a well and stacked stores.

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
      bld(-h / 2 - 4, -h + 5, h - 4, 7, 6, S, r, { skin: SKINS.stone, roof: false, kibble: false, lit: .4 });
      bld(-h / 2 - 4, -h + 5, h - 3.4, 7.8, 4, S, r, { y0: 6, shape: 'gable', skin: SKINS.tile, base: [.16, .16, .17], lit: 0, roof: false });
      bld(h - 5, -h / 2 - 2, 6, h - 6, 3.5, st, r, { skin: SKINS.timber, roof: false, kibble: false, lit: 0, ry: HALF_PI });
      bld(h - 5, -h / 2 - 2, 6.6, h - 5.4, 2.4, st, r, { y0: 3.5, shape: 'gable', skin: SKINS.thatch, base: [.3, .24, .13], lit: 0, roof: false, ry: HALF_PI });
      bld(-h + 6, h / 2 + 3, 6, 10, 6, S, r, { skin: SKINS.stone, roof: false, kibble: false, lit: 0 });
      bld(-h + 6, h / 2 + 3, 6.6, 10.6, 4, S, r, { y0: 6, shape: 'gable', skin: SKINS.tile, base: [.16, .16, .17], lit: 0, roof: false });
      prop('cyl', h / 2, .45, h / 2, 1.6, .9, 1.6, STONE);
      for (let k = 0; k < 5; k++) prop(k % 2 ? 'cyl' : 'box', 12 + k * 1.3, .45, -12, .9, .9, .9, k % 2 ? [.2, .13, .07] : [.26, .19, .11]);
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
        const ry = Math.atan2(-(q[1] - p[1]), q[0] - p[0]), n = Math.ceil(len / 6);

        // The curtain goes up in pieces of at most 6 m, each sunk 4 m, so on a slope it steps with the ground.

        for (let k = 0; k < n; k++) {
          const f = (k + .5) / n, px = p[0] + (q[0] - p[0]) * f, pz = p[1] + (q[1] - p[1]) * f;
          bld(px, pz, len / n + .4, 2.6, 12, S, r, { y0: -4, skin: SKINS.stone, roof: false, kibble: false, ry, lit: 0 });
          crenel(px, pz, 8, len / n, ry, r);
        }
        if (i % 6 === 0 && !nearGate(p[0], p[1])) tower(p[0], p[1], 7, 12, [.3, .14, .08]);
      });
      for (const [gx, gz, deg] of G) {
        const a = deg * Math.PI / 180, tx = -Math.sin(a), tz = Math.cos(a), ox = Math.cos(a), oz = Math.sin(a);
        for (const s of [-1, 1]) tower(gx + tx * s * 7, gz + tz * s * 7, 7.5, 14, [.3, .14, .08]);

        // The barbican: two low towers and a gate arch out at the moat's inner bank, walled to the gatehouse.

        for (const s of [-1, 1]) {
          const bx = gx + ox * 5 + tx * s * 5, bz = gz + oz * 5 + tz * s * 5;
          bld(bx, bz, 4, 4, 9, S, r, { y0: -3, shape: 'cyl', skin: SKINS.stone, roof: false, kibble: false, lit: 0 });
          crenel(bx, bz, 6, 4, 0, r);
          bld(gx + ox * 2.5 + tx * s * 5, gz + oz * 2.5 + tz * s * 5, 5, 1.4, 9, S, r, { y0: -3, skin: SKINS.stone, roof: false, kibble: false, ry: -a, lit: 0 });
        }
        bld(gx + ox * 5, gz + oz * 5, 2.2, 7, 3, S, r, { y0: 5, skin: SKINS.stone, roof: false, kibble: false, ry: -a, lit: 0 });
        bld(gx, gz, 4, 14, 4, S, r, { y0: 7, skin: SKINS.stone, roof: false, kibble: false, ry: -a, lit: 0 });
        for (const s of [-1, 1]) flickerGlow(gx + tx * s * 4 + Math.cos(a) * 3, 3.5, gz + tz * s * 4 + Math.sin(a) * 3, .35, .5, .35, [2, .9, .3], r, .7);
      }
      const [gx, gz] = G[0] ?? [0, 0];
      return { focus: [gx, gz], span: 80 };
    },
  };
  // ---------- generic landmarks: one for every site of their kind ----------
  // Each is free at its site, turned by the site's rot, and builds in the site's own axes through at(u, v). A
  // waterside site (quay, tannery) faces the water along +v, so town.json gives it a rot 90° less than its bearing.

  const sitesOf = kind => (CITY.sites ?? []).filter(s => s.kind === kind);
  const slug = s => s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const T = H.THREE, WOOD = [.16, .11, .06];
  const spinner = (parts, x, y, z, axis) => {
    const pivot = new T.Group(), spin = new T.Group(), mat = new T.MeshStandardMaterial({ color: new T.Color(...WOOD), roughness: .9 });
    pivot.position.set(x, y, z);
    pivot.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), axis);
    for (const [sx, sy, sz, px, py, pz, ry = 0] of parts) {
      const m = new T.Mesh(new T.BoxGeometry(sx, sy, sz), mat);
      m.position.set(px, py, pz); m.rotation.y = ry; spin.add(m);
    }
    pivot.add(spin);
    H.decor.add(pivot);
    return spin;
  };
  const generic = (kind, make) => sitesOf(kind).forEach((st0, i) => {
    const key = `ef_${kind}_${i}`, a = st0.rot, at = (u, v) => turn(a, u, v);
    const lm = make(st0, at, a);
    out[key] = { at: st0.at, free: [st0.w, st0.d], label: st0.name, labelY: lm.labelY ?? 18, slug: slug(st0), ...lm };
  });

  // A parish chapel in a walled churchyard: a small nave with a bellcote, a lych gate and rows of graves.

  generic('chapel', (c, at, a) => ({
    labelY: 22,
    build(x, z, w, d, st, r) {
      const S = { ...st, base: [.24, .22, .19], lit: 0 }, ry = -a;
      bld(...at(-w / 6, 0), w * .42, d * .38, 8, S, r, { skin: SKINS.stone, roof: false, kibble: false, ry });
      bld(...at(-w / 6, 0), w * .42 + .6, d * .38 + .8, 5.5, S, r, { y0: 8, shape: 'gable', skin: SKINS.tile, base: [.15, .15, .16], lit: 0, roof: false, ry });
      bld(...at(-w / 6 - w * .21, 0), 2, 2, 4, S, r, { y0: 9, skin: SKINS.stone, roof: false, kibble: false, ry });
      for (const [u, v, lu, lv] of [[0, -d / 2, w, .5], [0, d / 2, w, .5], [-w / 2, 0, .5, d], [w / 2, 0, .5, d]]) {
        const [px, pz] = at(u, v);
        prop('box', px, .6, pz, lu, 1.2, lv, STONE, -a);
      }
      const [gx, gz] = at(0, d / 2);
      prop('box', gx, 2.6, gz, 3, .3, 3, [.3, .13, .07]);
      for (let u = w / 10; u < w / 2 - 2; u += 2.2) for (let v = -d / 2 + 2.5; v < d / 2 - 2; v += 2.6) {
        if (r() < .25) continue;
        const [px, pz] = at(u + (r() - .5) * .5, v);
        prop('box', px, .45, pz, .5, .9, .2, [.32, .31, .3], -a);
      }
      flickerGlow(gx, 2.2, gz, .25, .35, .25, [2, .9, .3], r, .7);
      return { focus: [0, 0], span: 50 };
    },
  }));

  // A market cross on steps, and a pillory beside it.

  generic('cross', (c, at, a) => ({
    labelY: 9,
    build(x, z, w, d, st, r) {
      for (let k = 0; k < 3; k++) prop('box', 0, .2 + k * .4, 0, 5 - k * 1.4, .4, 5 - k * 1.4, STONE, -a);
      prop('box', 0, 4, 0, .5, 5.5, .5, STONE, -a);
      prop('box', 0, 5.6, 0, 1.8, .4, .4, STONE, -a);
      const [px, pz] = at(5, 0);
      prop('box', px, 1.2, pz, .25, 2.4, .25, WOOD, -a);
      prop('box', px, 2.1, pz, 1.4, .35, .2, WOOD, -a);
      return { focus: [0, 0], span: 30 };
    },
  }));

  // An inn: a big three-storey house round a lit courtyard, a sign on a bracket over the door, and a cart in the yard.

  generic('inn', (c, at, a) => ({
    labelY: 18,
    build(x, z, w, d, st, r) {
      const S = { ...st, lit: .7 }, ry = -a;
      bld(...at(0, d / 4), w - 1, d / 2 - 1, 9, S, r, { skin: SKINS.timber, roof: false, kibble: false, ry });
      bld(...at(0, d / 4), w - .2, d / 2, 5, S, r, { y0: 9, shape: 'gable', skin: SKINS.tile, base: [.3, .12, .07], lit: 0, roof: false, ry });
      bld(...at(-w / 2 + 3, -d / 4), 5, d / 2 - 1, 5, S, r, { skin: SKINS.plaster, roof: false, kibble: false, ry, lit: .4 });
      bld(...at(w / 2 - 3, -d / 4), 5, d / 2 - 1, 4, S, r, { skin: SKINS.timber, roof: false, kibble: false, ry, lit: 0 });
      const [sx, sz] = at(0, d / 2 + .9), [ix, iz] = at(0, -d / 4);
      prop('box', sx, 4.2, sz, .2, .2, 1.8, WOOD, -a);
      prop('box', sx, 3.4, sz, 1.4, 1.1, .1, [.55, .18, .1], -a);
      flickerGlow(ix, 1.2, iz, 1, .6, 1, [1.8, .8, .3], r, .8);
      const [cx, cz] = at(-2, -d / 4);
      prop('box', cx, .8, cz, 1.4, .35, 2.2, [.24, .16, .09], -a);
      return { focus: [0, 0], span: 45 };
    },
  }));

  // A quay: a stone quay wall along the water, two warehouses, a timber crane and stacked goods.

  generic('quay', (c, at, a) => ({
    labelY: 16,
    build(x, z, w, d, st, r) {
      const S = { ...st, base: [.24, .2, .15], lit: .2 }, ry = -a;
      const [qx, qz] = at(0, d / 2 - 1);
      prop('box', qx, .6, qz, w, 1.6, 2, STONE, -a);
      for (const u of [-w / 4, w / 4]) {
        bld(...at(u, -d / 6), w / 2 - 3, d / 2, 7, S, r, { skin: SKINS.stone, roof: false, kibble: false, ry });
        bld(...at(u, -d / 6), w / 2 - 2.4, d / 2 + .6, 4, S, r, { y0: 7, shape: 'gable', skin: SKINS.tile, base: [.28, .12, .07], lit: 0, roof: false, ry });
      }
      const [kx, kz] = at(0, d / 2 - 2);
      prop('box', kx, 4, kz, .5, 8, .5, WOOD, -a);
      const [jx, jz] = at(0, d / 2);
      prop('box', jx, 7.8, jz, .3, .3, 4.5, WOOD, -a + Math.PI / 2);
      for (let k = 0; k < 6; k++) {
        const [bx, bz] = at(-w / 3 + k * 2.2, d / 2 - 4);
        prop(k % 2 ? 'cyl' : 'box', bx, .5, bz, .9, 1, .9, k % 2 ? [.2, .13, .07] : [.26, .19, .11]);
      }
      return { focus: [0, 0], span: 60 };
    },
  }));

  // A post windmill on a mound: a timber body on a post, and four sails the wind turns.

  const sails = [];
  generic('windmill', (c, at, a) => ({
    labelY: 20,
    build(x, z, w, d, st, r) {
      prop('cyl', 0, 1, 0, 9, 2, 9, [.2, .26, .12]);
      prop('box', 0, 4, 0, .7, 6, .7, WOOD);
      bld(0, 0, 4, 4, 5, { ...st, lit: 0 }, r, { y0: 6, skin: SKINS.timber, roof: false, kibble: false, ry: -a });
      bld(0, 0, 4.4, 4.4, 2.4, st, r, { y0: 11, shape: 'gable', skin: SKINS.thatch, base: [.3, .24, .13], lit: 0, roof: false, ry: -a });
      const [fx, fz] = at(0, 2.4), [ux, uz] = at(0, 1), ax = new T.Vector3(ux, 0, uz).normalize();
      const blades = [];
      for (let k = 0; k < 4; k++) {
        const b = k * Math.PI / 2;
        blades.push([.5, .12, 7, Math.cos(b) * 3.8, 0, Math.sin(b) * 3.8, -b + Math.PI / 2]);
        blades.push([1.6, .05, 5.6, Math.cos(b) * 4.2 + Math.cos(b + Math.PI / 2) * .9, 0, Math.sin(b) * 4.2 + Math.sin(b + Math.PI / 2) * .9, -b + Math.PI / 2]);
      }
      sails.push(spinner(blades, fx, 9.5, fz, ax));
      return { focus: [0, 0], span: 40 };
    },
    update(t) { for (const s of sails) s.rotation.y = t * .5; },
  }));

  // A tannery by the water: a long open shed, rows of vats, and hides stretched on frames.

  generic('tannery', (c, at, a) => ({
    labelY: 12,
    build(x, z, w, d, st, r) {
      const ry = -a;
      bld(...at(0, -d / 4), w - 2, d / 3, 3.5, { ...st, lit: 0 }, r, { skin: SKINS.timber, roof: false, kibble: false, ry, lit: 0 });
      bld(...at(0, -d / 4), w - 1.4, d / 3 + .6, 2, st, r, { y0: 3.5, shape: 'gable', skin: SKINS.thatch, base: [.28, .22, .12], lit: 0, roof: false, ry });
      for (let k = 0; k < 8; k++) {
        const [vx, vz] = at(-w / 2 + 2 + (k % 4) * (w - 4) / 3, 1.5 + Math.floor(k / 4) * 2.4);
        prop('cyl', vx, .45, vz, 1.6, .9, 1.6, [.16, .12, .08]);
        prop('cyl', vx, .86, vz, 1.3, .05, 1.3, [[.25, .2, .08], [.15, .1, .2], [.3, .1, .06]][k % 3]);
      }
      for (let k = 0; k < 4; k++) {
        const [hx, hz] = at(-w / 2 + 2.5 + k * (w - 5) / 3, d / 2 - 1.5);
        for (const s of [-.8, .8]) prop('box', hx + s * Math.cos(a), 1, hz + s * Math.sin(a), .1, 2, .1, WOOD);
        prop('box', hx, 1.3, hz, 1.5, 1.3, .05, [.45, .33, .2], -a);
      }
      return { focus: [0, 0], span: 40 };
    },
  }));

  return out;
}
