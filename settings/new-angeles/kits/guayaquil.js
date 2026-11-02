// Guayaquil: two faces at night. Antiguo is a dark mass of dead proto-arcologies with fires and few windows.
// Nuevo is a brighter layered cluster with fat sky bridges round the Jack Weyland Arcology. The Waterways get
// quays, raft slums and boat lamps. Kits read H.subareaAt and the distance to the JWA to pick a face.

import { kits as favelaKits } from './favela.js';
import { sights as nuevoSights } from './gye-nuevo.js';
import { sights as waterSights } from './gye-water.js';
import { sights as antiguoSights } from './gye-antiguo.js';

const W2 = ([u, v]) => [(u - 680) * 3.6, (v - 390) * 3.6];
const JWA_AT = [935, 1515], JWA = W2(JWA_AT), PENAS = W2([1030, 1300]), XIMENA = W2([930, 1260]);

// Antiguo and Nuevo dials from design/districts/guayaquil.md. A kit blends them by its Nuevo weight n.

const ANT = { lit: .07, grime: 1, neon: .2, w: .15, base: [.09, .08, .07], win: [1, .55, .25] };
const NUE = { lit: .3, grime: .45, neon: .65, w: .6, base: [.1, .1, .11], win: [.85, .85, .7] };
const ASIGNS = [[1.5, .3, .1], [1.4, .9, .1], [.2, 1.2, .5]];
const NSIGNS = [[1.6, .2, .3], [1.5, .8, .2], [1.2, .2, 1.4]];
const FIRE = [1.7, .62, .14], TUNG = [1, .6, .3], SODIUM = [1.3, .6, .15], LED = [.5, .58, .95], GOLD = [1.5, .95, .35];
const SMOG = [.07, .06, .055], CONC = [.08, .075, .07], FOAM = [.13, .13, .14], WATER = [.008, .01, .014], WOOD = [.09, .06, .035];
const JUNK = [[.1, .06, .04], [.07, .07, .08], [.12, .09, .05], [.05, .06, .05], [.14, .05, .04]];
const TARP = [[.05, .09, .2], [.2, .07, .04], [.05, .14, .1], [.2, .16, .05], [.1, .1, .1], [.18, .06, .12]];
const HULL = [[.06, .04, .03], [.04, .05, .06], [.1, .05, .03], [.03, .06, .05]];
const PASTEL = [[.34, .18, .2], [.17, .25, .32], [.32, .28, .14], [.18, .29, .2], [.33, .2, .11], [.26, .21, .32], [.3, .3, .27]];
const WORDS_N = ['14K', 'CASINO', 'KARAOKE', 'HOTEL', 'FARMACIA', 'DRAGÓN', 'SALÓN', 'CLUB', 'MASAJES', 'BANCO'];
const WORDS_A = ['AGUA', 'REPARO', 'COMIDA', 'BATERÍAS', 'SE VENDE'];

// A tiny ry skips the engine's facade kibble on glass and foam volumes.

const NOK = 1e-4;

const pick = (r, a) => a[Math.floor(r() * a.length)];
const dim = (rgb, f) => rgb.map(c => c * f);

function inPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j], [bx, bz] = poly[i];
    if ((az > z) !== (bz > z) && x < ax + (z - az) * (bx - ax) / (bz - az)) inside = !inside;
  }
  return inside;
}

// Shared tools for lot kits, block kits and landmarks, built once per H.

let TOOLS = null;
function tools(H) {
  if (TOOLS?.H === H) return TOOLS;
  const { SKINS, FACES, bld, glow, prop, lerp, smooth, puff, pool, flickerGlow, textSign } = H;
  const waters = () => H.CITY.water ?? [];
  const wet = (X, Z) => waters().some(w => inPoly(X, Z, w.poly));

  // Local lot frame to world and back. Null frame (showcase) is the identity.

  const toWorld = (x, z) => {
    const f = H.frame();
    if (!f) return [x, z];
    const dx = x - f.cx, dz = z - f.cz;
    return [(f.tx ?? f.cx) + dx * f.c + dz * f.s, (f.tz ?? f.cz) - dx * f.s + dz * f.c];
  };
  const toLocal = (X, Z) => {
    const f = H.frame();
    if (!f) return [X, Z];
    const dX = X - (f.tx ?? f.cx), dZ = Z - (f.tz ?? f.cz);
    return [f.cx + dX * f.c - dZ * f.s, f.cz + dX * f.s + dZ * f.c];
  };
  const dims = (s, m) => { const f = H.frame(); return f?.w ? [Math.min(f.w - 2, m), Math.min(f.d - 2, m)] : [s, s]; };
  const front = () => H.frame()?.front ?? { x: 0, z: 1 };

  // The lot side that faces water, probed a little past each edge.

  const shore = (x, z) => {
    const f = H.frame();
    if (!f?.w) return null;
    for (const [nx, nz] of FACES) for (const o of [6, 18, 32]) {
      const [X, Z] = toWorld(x + nx * (f.w / 2 + o), z + nz * (f.d / 2 + o));
      if (wet(X, Z)) return { x: nx, z: nz };
    }
    return null;
  };

  const tone = (st, n, k) => {
    const o = { ...st };
    for (const key of ['lit', 'grime', 'neon', 'w']) o[key] = lerp(st[key], lerp(ANT[key], NUE[key], n), k);
    for (const key of ['base', 'win']) o[key] = st[key].map((v, i) => lerp(v, lerp(ANT[key][i], NUE[key][i], n), k));
    o.signs = n > .5 ? NSIGNS : ASIGNS;
    return o;
  };

  // Where a kit stands: Nuevo weight n (1 at the JWA), shore side, sub-area and its toned style.
  // In the showcase st.w stands in for n and the middle column plays the Waterways.

  const ctx = (x, z, st, nMin = 0) => {
    if (st.gye && st.gye.nMin === nMin) return st.gye;
    const f = H.frame(), k = st.mix?.find(m => m[0] === 'guayaquil')?.[1] ?? 1;
    let n = st.w, wetSide = null, sub = null, X = x, Z = z;
    if (f) {
      [X, Z] = toWorld(x, z);
      sub = H.subareaAt(X, Z);
      n = smooth(700, 200, Math.hypot(X - JWA[0], Z - JWA[1]));
      if (sub === 'Nuevo Guayaquil') n = Math.max(n, .55);
      else if (sub === 'Antiguo Guayaquil') n = Math.min(n, .3);
      wetSide = shore(x, z);
    } else if (st.w > .3 && st.w < .7) wetSide = { x: 0, z: 1 };
    n = Math.max(n, nMin);
    const c = { n, k, sub, X, Z, wet: wetSide, nMin, showcase: !f };
    c.st = { ...tone(st, n, k), gye: c };
    return c;
  };

  // Barrel or room fire: a flickering ember, a warm pool on the ground and a smoke puff.

  const fire = (x, y, z, r, s = 1) => {
    flickerGlow(x, y, z, .9 * s, 1.1 * s, .9 * s, dim(FIRE, .7 + .4 * r()), r);
    if (y < 2) pool(x, z, 5 * s, [.12, .05, .01]);
    if (r() < .6) puff(x, y + 3 * s, z, 2 + 2 * s, SMOG);
  };

  // Lit patch on a building face: face n, along offset, height y.

  const facePatch = (x, z, w, d, n, along, y, sw, sh, rgb) =>
    glow(x + n[0] * (w / 2 + .05) - n[1] * along, y, z + n[1] * (d / 2 + .05) + n[0] * along, n[0] ? .1 : sw, sh, n[0] ? sw : .1, rgb);

  // A stack of storeys from different decades. Each layer sets back, changes skin and gets a light band
  // at the joint; some joints throw out a lit annex sideways. Returns the top.

  const layered = (x, z, W, D, h, S, r, o = {}) => {
    const n = o.layers ?? 3 + Math.floor(r() * 3), shares = Array.from({ length: n }, (_, k) => (k ? .7 + .6 * r() : .5 + .3 * r()));
    const tot = shares.reduce((a, b) => a + b, 0), skins = [SKINS.grid, SKINS.bands, SKINS.curtain, SKINS.fins];
    const accent = pick(r, NSIGNS);
    let y = o.y0 ?? 0, w = W, d = D, ox = 0, oz = 0;
    for (let k = 0; k < n; k++) {
      const lh = h * shares[k] / tot, era = k / Math.max(1, n - 1);
      const L = { ...S, base: S.base.map((c, i) => c * (.8 + .4 * r()) + [0, .005, .02][i] * era), win: era > .5 ? [.72, .84, .95] : S.win, lit: S.lit * (.8 + .7 * r()) };
      bld(x + ox, z + oz, w, d, lh, L, r, { y0: y, roof: false, skin: skins[(k + Math.floor(r() * 4)) % 4], ry: NOK });
      y += lh;
      if (k < n - 1) {
        prop('box', x + ox, y + .3, z + oz, w + 1.6, .7, d + 1.6, [.04, .04, .045]);
        glow(x + ox, y - .4, z + oz, w + .25, .35, d + .25, dim(k % 2 ? accent : [1, .85, .6], .45));
        if (r() < .45) {
          const f = FACES[Math.floor(r() * 4)], aw = 6 + r() * 7, ah = 8 + r() * 6, span = (f[0] ? d : w) * .6;
          bld(x + ox + f[0] * (w / 2 + aw / 2), z + oz + f[1] * (d / 2 + aw / 2), f[0] ? aw : span, f[0] ? span : aw, ah, { ...L, lit: .6 }, r,
            { y0: y - ah - 2, roof: false, skin: SKINS.curtain, ry: NOK });
          glow(x + ox + f[0] * (w / 2 + aw / 2), y - ah - 2.2, z + oz + f[1] * (d / 2 + aw / 2), f[0] ? aw * .8 : span * .8, .15, f[0] ? span * .8 : aw * .8, dim(accent, .4));
        }
        w *= .74 + .14 * r(); d *= .74 + .14 * r();
        ox += (r() - .5) * W * .12; oz += (r() - .5) * D * .12;
      }
    }
    return { x: x + ox, z: z + oz, w, d, y, accent };
  };

  // Moored boat: hull, cabin, a lamp and its reflection. Long axis on local x when along is true.

  const boat = (x, z, len, along, r, y = .12) => {
    const bw = len * (.28 + .08 * r()), c = pick(r, HULL);
    prop('box', x, y + .5, z, along ? len : bw, 1.1, along ? bw : len, c);
    if (r() < .7) prop('box', x - (along ? len * .15 : 0), y + 1.7, z - (along ? 0 : len * .15), along ? len * .35 : bw * .8, 1.3, along ? bw * .8 : len * .35, dim(c, 1.6));
    if (r() < .75) {
      const rgb = r() < .75 ? [1.3, .7, .3] : [.9, 1, 1.1];
      glow(x, y + 2.8, z, .35, .35, .35, rgb);
      pool(x, z, 4 + len * .3, dim(rgb, .06));
    }
  };

  // Neon word on a face.

  const word = (x, z, w, d, y, face, text, rgb, size = 1) => {
    const n = FACES[face], ww = Math.min(size * 8, (n[0] ? d : w) * .8);
    textSign(text, x + n[0] * (w / 2 + .3), y, z + n[1] * (d / 2 + .3), ww, ww / 4, Math.atan2(n[0], n[1]), rgb);
  };

  TOOLS = { H, wet, toWorld, toLocal, dims, front, ctx, tone, fire, facePatch, layered, boat, word, waters };
  return TOOLS;
}

export function kits(H) {
  const { SKINS, FACES, bld, glow, prop, puff, pool, sign, neon, holo, beacon, roof, helipad, stringLights, textSign, flickerGlow, lerp } = H;
  const T = tools(H), { ctx, dims, front, fire, facePatch, layered, boat, word } = T;

  // Favela kits from Base de Cayambe serve Antiguo's low housing.

  const favela = favelaKits(H);

  const cable = (a, c, rgb = [.04, .04, .04], t = .08) => H.beam(a, c, t, rgb);
  const laundry = (a, c, r) => {
    cable(a, c, [.06, .06, .06], .05);
    for (let k = 1 + Math.floor(r() * 3); k > 0; k--) {
      const t = .15 + r() * .7;
      prop('box', lerp(a[0], c[0], t), lerp(a[1], c[1], t) - .45, lerp(a[2], c[2], t), .7, .8, .7, pick(r, TARP), Math.atan2(c[0] - a[0], c[2] - a[2]));
    }
  };

  const K = {
    // Gutted skyscraper: a dark body with squatter fires, a bare frame top with missing floors, smog.

    gye_deadtower(x, z, s, st, b, r) {
      const c = ctx(x, z, st), S = c.st, [W, D] = dims(s, 40);
      const w = W * (.7 + .25 * r()), d = D * (.7 + .25 * r()), h = (55 + 145 * r() ** 1.4) * Math.min(b, 1.4), cut = h * (.55 + .3 * r());
      bld(x, z, w, d, cut, { ...S, lit: S.lit * .5 }, r, { skin: SKINS.sparse, roof: false });
      const fh = h - cut, ny = Math.max(1, Math.floor(fh / 4));
      for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
        if (r() < .25) continue;
        const ch = fh * (.35 + .65 * r());
        prop('box', x + i * (w / 2 - .5), cut + ch / 2, z + j * (d / 2 - .5), .9, ch, .9, CONC);
      }
      for (let k = 1; k <= ny; k++) if (r() < .7 - .4 * k / ny) {
        const sw = w * (.45 + .55 * r()), sd = d * (.45 + .55 * r());
        prop('box', x + (r() - .5) * (w - sw), cut + k * 4, z + (r() - .5) * (d - sd), sw, .35, sd, CONC);
      }
      for (let k = 1 + Math.floor(r() * 3); k > 0; k--) fire(x + (r() - .5) * w * .6, cut + Math.floor(r() * ny) * 4 + .9, z + (r() - .5) * d * .6, r, 1.2);
      for (let k = 3 + Math.floor(r() * 7); k > 0; k--) {
        const n = FACES[Math.floor(r() * 4)], along = (r() - .5) * ((n[0] ? d : w) - 3);
        facePatch(x, z, w, d, n, along, 4 + r() * (cut - 6), 1.6, 1.3, r() < .6 ? dim(FIRE, .45) : dim(TUNG, .6));
      }
      if (r() < .45) { prop('lattice', x + (r() - .5) * w * .3, h + 9, z + (r() - .5) * d * .3, 2.5, 18, 2.5, [.8, .8, .8]); }
      for (let k = 1 + Math.floor(r() * 2); k > 0; k--) puff(x + (r() - .5) * w, h * (.4 + .5 * r()), z + (r() - .5) * d, 12 + r() * 12, SMOG);
      const f = front();
      fire(x + f.x * (w / 2 + 2.5), .8, z + f.z * (d / 2 + 2.5), r, .7);
      if (r() < .35) sign(x, z, w, d, 6, S, r, dim(pick(r, ASIGNS), .7), { blade: false, sh: 1.2, y: 4 });
    },

    // Fortified gang block: junk walls, razor wire, sentry towers, a gate sign and barrel fires.

    gye_barricade(x, z, s, st, b, r) {
      const c = ctx(x, z, st), S = c.st, [W, D] = dims(s, 50), fr = front();
      for (const [nx, nz] of FACES) {
        const span = nx ? D : W, gate = nx === fr.x && nz === fr.z;
        for (let u = -span / 2; u < span / 2 - .5;) {
          const seg = Math.min(span / 2 - u, 3 + r() * 5), m = u + seg / 2;
          if (!(gate && Math.abs(m) < 4)) {
            const hh = 2.5 + r() * 3;
            prop('box', x + nx * W / 2 - nz * m, hh / 2, z + nz * D / 2 + nx * m, nx ? .9 : seg, hh, nx ? seg : .9, pick(r, JUNK), 0, (r() - .5) * .06);
          }
          u += seg;
        }
        for (const y of [6, 6.6]) prop('box', x + nx * W / 2, y, z + nz * D / 2, nx ? .12 : W, .12, nx ? D : .12, [.18, .17, .16]);
      }
      for (const [sx, sz] of [[-1, -1], [1, 1]]) {
        const px = x + sx * (W / 2 - 1.5), pz = z + sz * (D / 2 - 1.5);
        prop('box', px, 5, pz, 1, 10, 1, CONC);
        prop('box', px, 11, pz, 3.2, 2.4, 3.2, pick(r, JUNK));
        glow(px - sx * 1.7, 11, pz - sz * 1.7, .5, .4, .5, [1.3, 1.25, 1]);
        pool(px - sx * 8, pz - sz * 8, 7, [.06, .06, .05]);
        beacon(px, 12.8, pz, r);
      }
      for (let k = 1 + Math.floor(r() * 3); k > 0; k--) {
        const bw = 6 + r() * (W * .35), bd = 6 + r() * (D * .35), h = (6 + r() * 18) * Math.min(b, 1.3);
        bld(x + (r() - .5) * (W - bw - 4), z + (r() - .5) * (D - bd - 4), bw, bd, h, { ...S, lit: .12 }, r, { skin: SKINS.sparse });
      }
      const gx = x + fr.x * (W / 2 + .5), gz = z + fr.z * (D / 2 + .5), ry = Math.atan2(fr.x, fr.z);
      textSign(r() < .5 ? 'LOS SCORPIONES' : '14K', gx, 7.6, gz, 8, 2, ry, r() < .6 ? [1.5, .22, .1] : [1.4, .85, .12]);
      for (let k = 2 + Math.floor(r() * 2); k > 0; k--) fire(x + (r() - .5) * W * .7, .8, z + (r() - .5) * D * .7, r, .8);
      prop('box', x + (r() - .5) * W * .5, .7, z + (r() - .5) * D * .5, 1.9, 1.3, 4.3, [.03, .025, .02], r() * 3);
    },

    // Barrio Las Peñas: pastel two-storey houses on hill terraces with a lit stair street up the middle.

    gye_colonial(x, z, s, st, b, r) {
      const c = ctx(x, z, st), S = c.st, [W, D] = dims(s, 52), fr = front();
      const ax = fr.z !== 0, L = ax ? W : D, Sd = ax ? D : W, sgn = -(ax ? fr.z : fr.x) || 1;
      const rows = Math.max(2, Math.min(5, Math.floor(Sd / 9))), rd = Sd / rows;
      const at = (u, v) => ax ? [x + u, z + v] : [x + v, z + u];
      const sz = (su, sv) => ax ? [su, sv] : [sv, su];
      const stairs = [];
      for (let k = 0; k < rows; k++) {
        const v = sgn * (-Sd / 2 + (k + .5) * rd), y0 = k * 2.6;
        if (k) { const [px, pz] = at(0, v), [a, e] = sz(L, rd); prop('box', px, y0 / 2, pz, a, y0, e, [.055, .045, .035]); }
        for (let u = -L / 2 + .4; u < L / 2 - 3;) {
          const hw = 4 + r() * 3, m = u + hw / 2;
          if (Math.abs(m) > 3) {
            const hh = 5.5 + r() * 2.3, [px, pz] = at(m, v), [a, e] = sz(hw - .3, rd * .7), base = pick(r, PASTEL);
            bld(px, pz, a, e, hh, { ...S, base, win: [1, .72, .42], lit: .5, grime: .35 }, r, { y0, roof: false, skin: SKINS.grid });
            bld(px, pz, a + .4, e + .4, 1.8, { ...S, base: [.16, .06, .04], lit: 0 }, r, { y0: y0 + hh, shape: 'pyr', roof: false });
            if (r() < .5) { const [bx, bz] = at(m, v - sgn * rd * .38), [ba, be] = sz(hw * .6, .9); prop('box', bx, y0 + 3.4, bz, ba, .2, be, dim(base, .6)); glow(bx, y0 + 4.1, bz, ba * .9, .06, be * .9, [.4, .25, .1]); }
          }
          u += hw;
        }
        const [px, pz] = at(0, v), [a, e] = sz(4.5, rd);
        prop('box', px, y0 + .3, pz, a, .6, e, [.09, .085, .08]);
        stairs.push([...at(2.6, v), y0 + 3.4]);
        pool(px, pz, 4, [.1, .07, .03]);
      }
      for (let k = 0; k + 1 < stairs.length; k++) stringLights([stairs[k][0], stairs[k][2], stairs[k][1]], [stairs[k + 1][0], stairs[k + 1][2], stairs[k + 1][1]], .3, 3, [1.4, .9, .45]);
      if (stairs[0]) glow(stairs[0][0], stairs[0][2], stairs[0][1], .4, .4, .4, [1.5, .95, .5]);
    },

    // Nuevo layered tower: new storeys on old, set back at each layer, a lit annex thrown sideways.

    gye_layertower(x, z, s, st, b, r) {
      const c = ctx(x, z, st, .5), S = c.st, [W, D] = dims(s, 46);
      const h = (110 + 300 * r() * (.35 + .65 * c.n)) * Math.min(b, 1.5);
      const t = layered(x, z, W * .92, D * .92, h, S, r);
      neon(x, z, W * .92, D * .92, 14, S, r);
      for (let k = 1 + Math.floor(r() * 2); k > 0; k--) word(x, z, W * .92, D * .92, 20 + r() * 50, Math.floor(r() * 4), pick(r, WORDS_N), dim(pick(r, NSIGNS), .7 + .4 * r()), 1.4);
      if (r() < S.neon * .6) holo(x, z, W * .92, D * .92, 30 + r() * 40, r, undefined, 18);
      roof(t.x, t.z, t.w, t.d, t.y, S, r);
      if (r() < .35 && Math.min(t.w, t.d) > 14) helipad(t.x, t.z, Math.min(t.w, t.d) * .7, t.y, r);
      else { const mh = 10 + r() * 30; prop('cyl', t.x, t.y + mh / 2, t.z, .5, mh, .5, [.12, .12, .13]); beacon(t.x, t.y + mh + .4, t.z, r); }
      if (h > 250) sign(t.x, t.z, t.w, t.d, t.y, S, r, t.accent, { blade: true, sh: 18, y: t.y - 14 });
    },

    // Hardfoam plinth: a blank grey podium with no doors, a sealed deck of LED walkways and a tower on top.

    gye_foamplinth(x, z, s, st, b, r) {
      const c = ctx(x, z, st, .5), S = c.st, [W, D] = dims(s, 56), ph = 10 + 26 * r();
      bld(x, z, W, D, ph, { ...S, base: FOAM, lit: 0, grime: .3 }, r, { skin: SKINS.sparse, roof: false, ry: NOK });
      for (let k = 4 + Math.floor(r() * 4); k > 0; k--) {
        const n = FACES[Math.floor(r() * 4)], along = (r() - .5) * ((n[0] ? D : W) - 4), dia = 3 + r() * 4, fh = ph * (.4 + .6 * r());
        prop('cyl', x + n[0] * W / 2 - n[1] * along, fh / 2, z + n[1] * D / 2 + n[0] * along, dia, fh, dia, dim(FOAM, .85 + .2 * r()));
      }
      const tw = W * (.4 + .2 * r()), td = D * (.4 + .2 * r()), tx = x + (r() - .5) * (W - tw) * .5, tz = z + (r() - .5) * (D - td) * .5;
      glow(x, ph + .15, tz, W * .92, .1, .6, dim(LED, .8));
      glow(tx, ph + .15, z, .6, .1, D * .92, dim(LED, .8));
      for (let k = 2 + Math.floor(r() * 3); k > 0; k--) {
        const kx = x + (r() - .5) * W * .8, kz = z + (r() - .5) * D * .8;
        if (Math.abs(kx - tx) < tw / 2 + 2 && Math.abs(kz - tz) < td / 2 + 2) continue;
        prop('box', kx, ph + 1.4, kz, 3, 2.8, 2.4, [.07, .07, .08]);
        glow(kx, ph + 1.3, kz + 1.25, 2.6, 1.8, .1, dim(pick(r, [[1.3, .8, .4], [1, .3, 1.1], [.4, 1.1, 1.2]]), .7));
        pool(kx, kz, 5, [.06, .05, .07]);
      }
      for (let k = 2 + Math.floor(r() * 3); k > 0; k--) {
        const px = x + (r() - .5) * W * .85, pz = z + (r() - .5) * D * .85;
        prop('box', px, ph + .5, pz, 2, 1, 2, [.05, .05, .05]);
        prop('cone', px, ph + 3, pz, 2.4, 4, 2.4, [.02, .06, .03]);
      }
      if (r() < .8) {
        const t = layered(tx, tz, tw, td, (30 + 110 * r()) * Math.min(b, 1.4), S, r, { y0: ph, layers: 2 + Math.floor(r() * 2) });
        neon(tx, tz, tw, td, ph + 10, S, r);
        roof(t.x, t.z, t.w, t.d, t.y, S, r);
      }
      if (r() < .5) sign(x, z, W, D, ph, S, r, dim([.2, 1.2, .5], .5), { blade: false, sh: 1.4, y: ph * .4 });
    },

    // Ximena: slim residential slabs, tiny flats stacked into the sky, all windows and no signs.

    gye_ximena(x, z, s, st, b, r) {
      const c = ctx(x, z, st), S = c.st, [W, D] = dims(s, 60), along = W >= D, L = (along ? W : D) - 2, Sd = along ? D : W;
      const t = Math.min(Sd - 2, 11 + r() * 6), twin = Sd > 2 * t + 8, h = (100 + 180 * r()) * Math.min(b, 1.4);
      const X = { ...S, lit: .4 + .15 * r(), win: [1, .74, .44], grime: Math.max(S.grime, .7) };
      const offs = twin ? [-(Sd / 2 - t / 2 - 1), Sd / 2 - t / 2 - 1] : [0];
      const tops = [];
      for (const o of offs) {
        const hh = h * (.85 + .3 * r()), px = along ? x : x + o, pz = along ? z + o : z;
        bld(px, pz, along ? L : t, along ? t : L, hh, X, r, { skin: SKINS.grid, roof: false, ry: NOK });
        roof(px, pz, along ? L : t, along ? t : L, hh, X, r);
        for (let k = 2 + Math.floor(r() * 4); k > 0; k--) {
          const u = (r() - .5) * (L - 4), y = 10 + r() * (hh - 20), side = o ? Math.sign(o) : (r() < .5 ? 1 : -1), off = t / 2 + .5;
          prop('dish', along ? px + u : px + side * off, y, along ? pz + side * off : pz + u, 1.6, 1.6, 1.6, [.3, .3, .3], along ? (side > 0 ? 0 : Math.PI) : side * Math.PI / 2, -.4);
        }
        tops.push(hh);
      }
      if (twin) for (let k = 0; k < 3; k++) {
        const y = 20 + r() * (Math.min(...tops) - 30), u = (r() - .5) * L * .7, gap = Sd - 2 * t - 2;
        bld(along ? x + u : x, along ? z : z + u, along ? 3 : gap + 1, along ? gap + 1 : 3, 3, { ...X, lit: .7 }, r, { y0: y, roof: false, skin: SKINS.bands, ry: NOK });
      }
    },

    // Waterfront quay: a concrete edge with jetties into a small harbour, moored boats, a crane and food carts.

    gye_quay(x, z, s, st, b, r) {
      const c = ctx(x, z, st), S = c.st, [W, D] = dims(s, 56), dir = c.wet ?? { x: 0, z: 1 };
      const Lu = dir.x ? D : W, Lv = dir.x ? W : D;
      const at = (u, v) => [x + dir.x * v - dir.z * u, z + dir.z * v + dir.x * u];
      const sz = (su, sv) => dir.x ? [sv, su] : [su, sv];
      const bd = Lv * (.38 + .12 * r()), bv = Lv / 2 - bd / 2, edge = Lv / 2 - bd;
      { const [px, pz] = at(0, bv), [a, e] = sz(Lu, bd); prop('box', px, .06, pz, a, .1, e, WATER); }
      { const [px, pz] = at(0, -bd / 2), [a, e] = sz(Lu, Lv - bd); prop('box', px, .4, pz, a, .8, e, CONC); }
      for (let k = 3 + Math.floor(r() * 3); k > 0; k--) {
        const [px, pz] = at((r() - .5) * Lu * .9, edge + .4), [a, e] = sz(1.5 + r() * 3, 1 + r());
        prop('box', px, .25, pz, a, .6, e, dim(CONC, .8), r() * .4, (r() - .5) * .5);
      }
      for (let u = -Lu / 2 + 3; u < Lu / 2; u += 6 + r() * 4) { const [px, pz] = at(u, edge - .6); prop('cyl', px, 1.2, pz, .5, .8, .5, [.1, .1, .1]); }
      const jets = 1 + Math.floor(r() * Math.min(3, Lu / 14));
      for (let j = 0; j < jets; j++) {
        const u = (j + .5) * Lu / jets - Lu / 2, len = bd * (.6 + .3 * r());
        const [px, pz] = at(u, edge + len / 2), [a, e] = sz(1.8, len);
        prop('box', px, .55, pz, a, .2, e, WOOD);
        const [ex, ez] = at(u, edge + len);
        prop('cyl', ex, 1.6, ez, .2, 2.4, .2, [.05, .05, .05]);
        glow(ex, 2.9, ez, .4, .4, .4, [1.3, .75, .3]);
        pool(ex, ez, 6, [.09, .05, .02]);
        for (const side of [-1, 1]) if (r() < .75) {
          const blen = 5 + r() * Math.min(9, Lu / jets - 4), [bx, bz] = at(u + side * (blen * .16 + 1.8), edge + len * (.3 + .4 * r()));
          boat(bx, bz, blen, !!dir.x, r);
        }
      }
      const shw = Lu * (.3 + .3 * r()), shd = (Lv - bd) * .45, [sx, sz2] = at((r() - .5) * (Lu - shw), -Lv / 2 + shd / 2 + 1), [a, e] = sz(shw, shd);
      bld(sx, sz2, a, e, 6 + r() * 6, { ...S, lit: .1 }, r, { skin: SKINS.sparse, y0: .8 });
      if (r() < .6) {
        const u = (r() - .5) * Lu * .6, [cx, cz] = at(u, edge - 3), [hx, hz] = at(u, edge + bd * .7);
        prop('lattice', cx, 11, cz, 2.2, 20, 2.2, [.9, .7, .4]);
        H.beam([cx, 20.5, cz], [hx, 20.5, hz], .8, [.2, .13, .05]);
        cable([hx, 20, hz], [hx, 8, hz]);
        beacon(cx, 21.5, cz, r);
      }
      const carts = [];
      for (let k = 1 + Math.floor(r() * 3); k > 0; k--) {
        const [px, pz] = at((r() - .5) * Lu * .8, edge - 2.5 - r() * 3);
        prop('box', px, 1.5, pz, 2, 1.2, 1.4, pick(r, TARP));
        glow(px, 1.4, pz, 1.6, .6, 1.5, [1.2, .65, .25]);
        pool(px, pz, 4, [.1, .05, .02]);
        carts.push([px, 3.2, pz]);
      }
      if (carts.length > 1) stringLights(carts[0], carts[1], .5, 5, [1.4, .7, .3]);
    },

    // Raft slum: chained ships and junks as floating flats in a black basin, with shacks, laundry and lamps.

    gye_raftslum(x, z, s, st, b, r) {
      const c = ctx(x, z, st), S = c.st, [W, D] = dims(s, 54), along = W >= D, L = along ? W : D, Sd = along ? D : W;
      prop('box', x, .06, z, W, .1, D, WATER);
      const rows = Sd > 22 ? 2 : 1, decks = [];
      for (let q = 0; q < rows; q++) {
        const v = rows === 1 ? 0 : (q - .5) * Sd * .5;
        let u = -L / 2 + 1;
        while (u < L / 2 - 6) {
          const hl = Math.min(L / 2 - u - 1, 9 + r() * 12), hb = Math.min(Sd / rows - 2, 4 + r() * 4), m = u + hl / 2;
          const px = along ? x + m : x + v, pz = along ? z + v : z + m, col = pick(r, HULL), hh = 2 + r() * 2;
          prop('box', px, hh / 2, pz, along ? hl : hb, hh, along ? hb : hl, col, (r() - .5) * .06);
          let y = hh;
          for (let k = r() < .4 ? 2 : 1; k > 0; k--) {
            const sw = hl * (.35 + .3 * r()), sd = hb * .8, sh = 2.4 + r(), ox = (r() - .5) * (hl - sw) * .7;
            bld(along ? px + ox : px, along ? pz : pz + ox, along ? sw : sd, along ? sd : sw, sh, { ...S, lit: .35 + .3 * r(), base: dim(pick(r, JUNK), 1.3) }, r, { y0: y, roof: false, skin: SKINS.sparse, ry: NOK });
            prop('box', along ? px + ox : px, y + sh + .1, along ? pz : pz + ox, (along ? sw : sd) + .6, .1, (along ? sd : sw) + .6, pick(r, TARP), 0, (r() - .5) * .2);
            y += sh;
          }
          decks.push([px, y, pz]);
          if (r() < .7) { const lx = px + (along ? 0 : hb / 2), lz = pz + (along ? hb / 2 : 0); glow(lx, hh + .8, lz, .35, .35, .35, [1.4, .75, .3]); pool(lx, lz, 5, [.08, .04, .015]); }
          u += hl + .8;
          if (u < L / 2 - 6) { const ex = along ? x + u - .4 : px, ez = along ? pz : z + u - .4; cable([ex - (along ? .8 : 0), 1.2, ez - (along ? 0 : .8)], [ex + (along ? .8 : 0), 1.2, ez + (along ? 0 : .8)], [.12, .1, .08], .12); }
        }
      }
      for (let k = Math.min(decks.length - 1, 2 + Math.floor(r() * 4)); k > 0; k--) {
        const a = pick(r, decks), e = pick(r, decks);
        if (a === e) continue;
        r() < .5 ? laundry([a[0], a[1] - .5, a[2]], [e[0], e[1] - .7, e[2]], r) : stringLights([a[0], a[1] - .3, a[2]], [e[0], e[1] - .3, e[2]], .8, 6, r() < .7 ? [1.3, .65, .25] : [1.2, .3, .6]);
      }
      if (r() < .5) word(x, z, W, D, 5, Math.floor(r() * 4), pick(r, WORDS_A), dim(pick(r, ASIGNS), .6), .8);
    },
  };

  // Routers: tiers name these. Each picks a kit by area (Antiguo, Nuevo, Waterways) and the named spots.

  const TABLE = {
    A: [['gye_barricade', 'shacks', 'warren', 'shophouse', 'gye_deadtower', 'gye_barricade'],
      ['gye_deadtower', 'gye_deadtower', 'gye_barricade', 'warren', 'slab'],
      ['gye_deadtower', 'gye_deadtower', 'gye_deadtower', 'slab', 'gye_ximena']],
    N: [['gye_foamplinth', 'gye_foamplinth', 'gye_layertower', 'courtyard'],
      ['gye_layertower', 'gye_layertower', 'gye_foamplinth', 'gye_ximena'],
      ['gye_layertower', 'gye_layertower', 'gye_layertower', 'gye_ximena']],
    W: [['gye_raftslum', 'gye_quay', 'gye_raftslum'], ['gye_quay', 'gye_raftslum', 'gye_deadtower'], ['gye_quay', 'gye_quay', 'gye_deadtower']],
  };
  const route = tier => (x, z, s, st, b, r) => {
    const c = ctx(x, z, st), near = p => Math.hypot(c.X - p[0], c.Z - p[1]);
    let name;
    if (c.wet && (c.showcase || r() < .75)) name = pick(r, TABLE.W[tier]);
    else if (c.n > .5) name = pick(r, TABLE.N[tier]);
    else if (!c.showcase && tier < 2 && near(PENAS) < 200 && r() < .75) name = 'gye_colonial';
    else if (!c.showcase && tier > 0 && near(XIMENA) < 230 && r() < .7) name = 'gye_ximena';
    else name = pick(r, TABLE.A[tier]);
    (K[name] ?? favela[name] ?? K.gye_deadtower)(x, z, s, c.st, b, r);
  };
  return { ...K, gye_low: route(0), gye_mid: route(1), gye_high: route(2) };
}

export const tiers = { guayaquil: { 0: ['gye_low'], 1: ['gye_mid'], 2: ['gye_high'] } };

export function blocks(H) {
  const { SKINS, FACES, bld, glow, prop, puff, pool, sign, roof, beacon, textSign, holo, lerp } = H;
  const T = tools(H), { ctx, fire, facePatch, layered, word } = T;

  // Antiguo proto-arcology: a stepped slab whose lower tiers are dead and squatted, lit only near the top.

  const protoark = (x, z, w, d, st, r) => {
    const c = ctx(x, z, st), S = c.st, W = Math.min(w, 118), D = Math.min(d, 118);
    const tiers = 3 + Math.floor(r() * 3), total = 150 + 250 * r(), broken = r() < .4;
    const liveFrom = tiers - 1 - (r() < .5 ? 1 : 0);
    let y = 0, ww = W - 2, dd = D - 2;
    for (let k = 0; k < tiers; k++) {
      const th = total / tiers * (k ? .85 + .3 * r() : 1.1), live = k >= liveFrom && !(broken && k === tiers - 1);
      const L = { ...S, lit: live ? .3 + .1 * r() : .025, win: live ? [.95, .75, .45] : dim(FIRE, .5) };
      bld(x, z, ww, dd, th, L, r, { y0: y, roof: false, skin: live ? SKINS.grid : SKINS.sparse });
      if (!live) for (let q = 2 + Math.floor(r() * 4); q > 0; q--) {
        const n = FACES[Math.floor(r() * 4)], along = (r() - .5) * ((n[0] ? dd : ww) - 4), fy = y + 3 + r() * (th - 6);
        facePatch(x, z, ww, dd, n, along, fy, 1.8 + r() * 2, 1.4, dim(r() < .5 ? FIRE : TUNG, .5 + .3 * r()));
        if (r() < .4) puff(x + n[0] * (ww / 2 + 3), fy + 4, z + n[1] * (dd / 2 + 3), 4 + r() * 4, SMOG);
      }
      y += th;
      const nw = ww * (.66 + .14 * r()), nd = dd * (.66 + .14 * r());

      // Squatter shacks, fires and laundry on the setback terrace.

      if (k < tiers - 1) {
        prop('box', x, y + .15, z, ww, .3, dd, [.04, .035, .03]);
        const spots = [];
        for (let q = 3 + Math.floor(r() * 4); q > 0; q--) {
          const n = FACES[Math.floor(r() * 4)], along = (r() - .5) * ((n[0] ? dd : ww) - 6), inset = ((n[0] ? ww - nw : dd - nd) / 2) * (.3 + .4 * r());
          const px = x + n[0] * (ww / 2 - inset) - n[1] * along, pz = z + n[1] * (dd / 2 - inset) + n[0] * along;
          const sw = 3 + r() * 3, sh = 2.5 + r() * 1.5;
          bld(px, pz, sw, sw * (.7 + .5 * r()), sh, { ...S, lit: .35, base: dim(pick(r, JUNK), 1.4) }, r, { y0: y, roof: false, skin: SKINS.sparse });
          prop('box', px, y + sh + .1, pz, sw + .7, .1, sw + .7, pick(r, TARP), 0, (r() - .5) * .25);
          spots.push([px, y + sh - .5, pz]);
        }
        for (let q = 1 + Math.floor(r() * 2); q > 0; q--) { const s = pick(r, spots); fire(s[0] + 2, y + .9, s[2] + 2, r, .9); }
        if (spots.length > 1) H.beam(spots[0], spots[1], .05, [.06, .06, .06]);
      }
      ww = nw; dd = nd;
    }

    // Broken top: a bare frame of columns and slabs. Otherwise roof plant, masts and a red sign.

    if (broken) {
      for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [0, -1]]) if (r() < .8) {
        const ch = 8 + r() * 26;
        prop('box', x + i * (ww / 2 - 1), y + ch / 2, z + j * (dd / 2 - 1), 1.4, ch, 1.4, CONC);
      }
      for (let q = 1; q < 6; q++) if (r() < .5) prop('box', x + (r() - .5) * ww * .3, y + q * 5, z + (r() - .5) * dd * .3, ww * (.4 + .5 * r()), .5, dd * (.4 + .5 * r()), CONC);
      fire(x, y + 5.9, z, r, 1.6);
      prop('lattice', x + ww * .3, y + 22, z, 3, 44, 3, [.8, .8, .8]);
    } else {
      roof(x, z, ww, dd, y, S, r);
      for (let q = 1 + Math.floor(r() * 2); q > 0; q--) { const mh = 15 + r() * 25, px = x + (r() - .5) * ww * .6, pz = z + (r() - .5) * dd * .6; prop('lattice', px, y + mh / 2, pz, 2, mh, 2, [.8, .8, .8]); beacon(px, y + mh + .5, pz, r); }
      sign(x, z, ww, dd, y, S, r, pick(r, ASIGNS), { blade: true, sh: 14, y: y - 12 });
    }

    // Street level: trash heaps, grease pools, barrel fires and a smog shroud.

    for (let q = 4 + Math.floor(r() * 4); q > 0; q--) {
      const n = FACES[Math.floor(r() * 4)], along = (r() - .5) * (n[0] ? D : W) * .8, px = x + n[0] * (W / 2 + 2) - n[1] * along, pz = z + n[1] * (D / 2 + 2) + n[0] * along;
      if (r() < .5) prop('box', px, .6, pz, 2 + r() * 4, 1.2 + r(), 2 + r() * 3, pick(r, JUNK), r() * 3);
      else pool(px, pz, 6 + r() * 4, [.05, .035, .01]);
    }
    for (let q = 2 + Math.floor(r() * 2); q > 0; q--) fire(x + (r() - .5) * W, .8, z + (r() < .5 ? -1 : 1) * (D / 2 + 3), r, .8);
    for (let q = 4 + Math.floor(r() * 3); q > 0; q--) puff(x + (r() - .5) * W * 1.3, 30 + r() * total * .6, z + (r() - .5) * D * 1.3, 18 + r() * 20, SMOG);
  };

  // Nuevo sky-bridge neighbourhood: layered towers on a foam podium, joined by wide inhabited bridges.

  const bridgehab = (x, z, w, d, st, r) => {
    const c = ctx(x, z, st, .8), S = c.st, W = Math.min(w, 128), D = Math.min(d, 128);
    const ph = 12 + 8 * r();
    bld(x, z, W, D, ph, { ...S, base: FOAM, lit: 0, grime: .3 }, r, { skin: SKINS.sparse, roof: false, ry: NOK });
    glow(x, ph + .15, z, W * .9, .1, .7, dim(LED, .8));
    glow(x, ph + .15, z, .7, .1, D * .9, dim(LED, .8));
    const tw = Math.min(W, D) * (.26 + .06 * r()), ox = W / 2 - tw / 2 - 2, oz = D / 2 - tw / 2 - 2;
    const corners = [[-ox, -oz], [ox, -oz], [ox, oz], [-ox, oz]], tops = [];
    const skip = r() < .4 ? Math.floor(r() * 4) : -1;
    corners.forEach(([cx, cz], i) => {
      if (i === skip) { tops.push(null); return; }
      const h = 180 + 240 * r(), t = layered(x + cx, z + cz, tw, tw * (.9 + .2 * r()), h, S, r, { y0: ph, layers: 3 + Math.floor(r() * 2) });
      roof(t.x, t.z, t.w, t.d, t.y, S, r);
      beacon(t.x, t.y + 2, t.z, r);
      word(x + cx, z + cz, tw, tw, ph + 14 + r() * 30, Math.floor(r() * 4), pick(r, WORDS_N), dim(pick(r, NSIGNS), .8), 1.2);
      tops.push(h + ph);
    });
    const name = c.X < JWA[0] ? 'NIDO DE AQUILA' : 'LA MANO DEL CIELO';
    let named = false;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      if (!tops[i] || !tops[j] || r() < .2) continue;
      const [ax, az] = corners[i], [bx, bz] = corners[j], alongX = az === bz, len = Math.abs(alongX ? bx - ax : bz - az) + tw * .3;
      for (let q = r() < .45 ? 2 : 1; q > 0; q--) {
        const bh = 18 + 10 * r(), by = Math.min(80 + r() * 170, Math.min(tops[i], tops[j]) - bh - 20), bw = tw * (.7 + .2 * r());
        if (by < ph + 30) continue;
        const mx = x + (ax + bx) / 2, mz = z + (az + bz) / 2, sx = alongX ? len : bw, sz = alongX ? bw : len;
        bld(mx, mz, sx, sz, bh, { ...S, lit: .65 + .2 * r(), win: [1, .84, .58] }, r, { y0: by, roof: false, skin: r() < .5 ? SKINS.curtain : SKINS.bands, ry: NOK });
        glow(mx, by - .3, mz, sx * .95, .25, sz * .95, dim(pick(r, NSIGNS), .5));
        prop('box', mx, by + bh + .3, mz, sx * .9, .6, sz * .9, [.02, .06, .03]);
        for (let g = 2 + Math.floor(r() * 3); g > 0; g--) prop('cone', mx + (r() - .5) * sx * .7, by + bh + 2.4, mz + (r() - .5) * sz * .7, 2.4, 3.6, 2.4, [.02, .07, .03]);
        const face = alongX ? (az < 0 ? 3 : 2) : (ax < 0 ? 1 : 0);
        word(mx, mz, sx, sz, by + bh * .7, face, named ? pick(r, WORDS_N) : name, dim(named ? pick(r, NSIGNS) : GOLD, .75), 1.8);
        named = true;
      }

      // Thin LED walkway tubes at other heights.

      const ty = ph + 30 + r() * 120;
      if (ty < Math.min(tops[i], tops[j]) - 10) H.beam([x + ax, ty, z + az], [x + bx, ty, z + bz], 1.2, dim(LED, .55), 'glow');
    }
    if (r() < .6) holo(x, z, W, D, ph + 8, r, undefined, 20);
    for (let q = 3; q > 0; q--) pool(x + (r() - .5) * W, z + (r() - .5) * D, 12, [.05, .05, .08]);
  };

  // In the city each block takes the face of its spot. The showcase shows both builders as named.

  const pickFace = (own, other, nuevo) => (x, z, w, d, st, r) => {
    const c = H.frame() ? ctx(x, z, st) : null;
    (c && (c.n > .5) !== nuevo ? other : own)(x, z, w, d, st, r);
  };
  return {
    gye_protoark: { zone: 'guayaquil', build: pickFace(protoark, bridgehab, false) },
    gye_bridgehab: { zone: 'guayaquil', build: pickFace(bridgehab, protoark, true) },
  };
}

export function landmarks(H) {
  const { THREE, SKINS, FACES, GLOWS, bld, glow, prop, put, puff, pool, sign, roof, beacon, holo, textSign, flickerGlow, stringLights, panel, canvasTexture, lerp } = H;
  const T = tools(H), { ctx, fire, toLocal, wet, waters, boat, word } = T;

  // Street-facing frame round (x, z). a runs out along the front normal, b along the front face.

  const facing = (x, z) => {
    const fr = T.front(), tx = -fr.z, tz = fr.x;
    const at = (a, b) => [x + fr.x * a + tx * b, z + fr.z * a + tz * b];
    const sz = (fa, fb) => (fr.x ? [fa, fb] : [fb, fa]);
    return {
      fr, at, sz, yaw: Math.atan2(fr.x, fr.z),
      span: (w, d) => (fr.x ? d : w), deep: (w, d) => (fr.x ? w : d),
      box: (a, b, y, fa, h, fb, rgb, kind = 'box') => { const [px, pz] = at(a, b), [sx, sz2] = sz(fa, fb); return prop(kind, px, y, pz, sx, h, sz2, rgb); },
      lit: (a, b, y, fa, h, fb, rgb) => { const [px, pz] = at(a, b), [sx, sz2] = sz(fa, fb); return glow(px, y, pz, sx, h, sz2, rgb); },
    };
  };

  // Soft searchlight from a lamp at (x, y, z) down to the ground, leaning by tilt toward (dx, dz).

  const searchlight = (x, y, z, dx, dz, tilt) => {
    const L = Math.hypot(dx, dz) || 1, len = y / Math.cos(tilt), m = new THREE.Mesh(H.beamGeo, H.searchBeam([1, .95, .8], 12));
    m.position.set(x, y, z);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / L * Math.sin(tilt), -Math.cos(tilt), dz / L * Math.sin(tilt)));
    m.scale.set(len * .3, len, len * .3);
    H.decor.add(m);
    pool(x + dx / L * y * Math.tan(tilt), z + dz / L * y * Math.tan(tilt), 7, [.22, .22, .18]);
  };

  const G = { H, T, facing, searchlight, W2, JWA_AT, dim, pick, inPoly, NOK,
    PAL: { ANT, NUE, ASIGNS, NSIGNS, FIRE, TUNG, SODIUM, LED, GOLD, SMOG, CONC, FOAM, WATER, WOOD, JUNK, TARP, HULL, PASTEL, WORDS_N, WORDS_A } };

  return {
    // Jack Weyland Arcology: 1.1 km, once the tallest building on Earth. A derelict renovation zone below
    // the plaza mall, an octagonal core with four buttress towers and gold light lines, a merc guard ring
    // above level 70, the Palace at Guayaquil crown and a lit spire.

    gye_jwa: {
      at: JWA_AT, label: 'Jack Weyland Arcology', minSide: 58, reach: 360, labelY: 1160, scaleY: .6,
      build(x, z, w, d, st, r) {
        const S = { ...T.tone(st, 1, 1), lit: .26, win: [.95, .85, .66] }, B = Math.min(w, d, 70), TOP = 1100;
        const LINE = [1.1, .72, .32], RED = [1.6, .1, .06];

        // Derelict renovation zone: dark base, scaffolds, work lights and squatter fires.

        bld(x, z, B, B, 26, { ...S, lit: .02, base: [.07, .065, .06], grime: 1 }, r, { roof: false, skin: SKINS.sparse, ry: NOK });
        for (const n of FACES) for (const u of [-.35, 0, .35]) {
          const px = x + n[0] * (B / 2 + 1.5) - n[1] * u * B, pz = z + n[1] * (B / 2 + 1.5) + n[0] * u * B;
          prop('lattice', px, 13, pz, 1.6, 26, 1.6, [.9, .8, .6]);
        }
        for (const n of FACES) for (const y of [9, 18]) prop('box', x + n[0] * (B / 2 + 1.5), y, z + n[1] * (B / 2 + 1.5), n[0] ? 1 : B, .3, n[0] ? B : 1, [.12, .1, .07]);
        for (let k = 0; k < 6; k++) flickerGlow(x + (r() - .5) * B, 4 + r() * 18, z + (r() < .5 ? -1 : 1) * (B / 2 + 1), .7, .5, .7, SODIUM, r);
        for (let k = 0; k < 3; k++) fire(x + (r() - .5) * B, .8, z + (r() < .5 ? -1 : 1) * (B / 2 + 4), r, .8);

        // Plaza-level mall.

        bld(x, z, B * .97, B * .97, 28, { ...S, lit: .9, win: [1, .86, .6] }, r, { y0: 26, roof: false, skin: SKINS.curtain, ry: NOK });
        for (const y of [26.3, 54]) glow(x, y, z, B + .6, .5, B + .6, dim(GOLD, .5));
        for (let f = 0; f < 4; f++) word(x, z, B * .97, B * .97, 46, f, 'JACK WEYLAND', dim(GOLD, .9), 4);
        for (let k = 0; k < 6; k++) sign(x, z, B * .97, B * .97, 52, S, r, dim(pick(r, NSIGNS), .8), { y: 32 + r() * 8, blade: r() < .5 });
        holo(x, z, B * .97, B * .97, 40, r, 0, 24);
        holo(x, z, B * .97, B * .97, 40, r, 1, 24);

        // Shopfronts and awnings along the mall's plaza floor.

        const MW = B * .97, SHOP = [[1.4, .85, .45], [1.3, 1.1, .8], [1.5, .8, .2], [1.2, .3, .9]];
        for (const n of FACES) for (let k = 0; k < 6; k++) {
          const t = (k - 2.5) * MW / 6, px = x + n[0] * (MW / 2 + .06) - n[1] * t, pz = z + n[1] * (MW / 2 + .06) + n[0] * t;
          glow(px, 28.6, pz, n[0] ? .1 : MW / 7, 3.2, n[0] ? MW / 7 : .1, dim(pick(r, SHOP), .5 + .3 * r()));
          prop('box', px + n[0] * .8, 30.6, pz + n[1] * .8, n[0] ? 1.6 : MW / 7, .15, n[0] ? MW / 7 : 1.6, [.08, .06, .05]);
        }

        // Plaza concourse round the mall: a deck with a gold rim, people-scale lamps and lit shop kiosks.
        // The deck and kiosks stay under 30 so they clear the maglev rule at this landmark's 0.6 height scale.

        const E = Math.max(4, Math.min(12, (Math.min(w, d) - B) / 2)), CO = B / 2 + E, LONG = B + E * 2;
        for (const n of FACES) {
          prop('box', x + n[0] * (B / 2 + E / 2), 25.6, z + n[1] * (B / 2 + E / 2), n[0] ? E : LONG, .8, n[0] ? LONG : E, [.06, .06, .065]);
          glow(x + n[0] * CO, 26.1, z + n[1] * CO, n[0] ? .25 : LONG, .3, n[0] ? LONG : .25, dim(GOLD, .55));
          for (let t = -LONG / 2 + 3; t < LONG / 2; t += 7) put(GLOWS.sphere, x + n[0] * (CO - .6) - n[1] * t, 27.4, z + n[1] * (CO - .6) + n[0] * t, .45, .45, .45, 0, 0, [1.4, 1.1, .75]);
          if (E >= 6) for (const t of [-.36, -.12, .12, .36]) {
            const o = B / 2 + E * .55, px = x + n[0] * o - n[1] * t * B, pz = z + n[1] * o + n[0] * t * B;
            prop('box', px, 27.6, pz, n[0] ? 3 : 4.4, 3.2, n[0] ? 4.4 : 3, [.09, .08, .07]);
            glow(px + n[0] * 1.55, 27.4, pz + n[1] * 1.55, n[0] ? .1 : 3.6, 2, n[0] ? 3.6 : .1, dim(pick(r, SHOP), .7));
          }
        }

        // Small commercial offices on the floors over the mall.

        bld(x, z, B * .86, B * .86, 46, { ...S, lit: .45, win: [.95, .85, .62] }, r, { y0: 54, roof: false, skin: SKINS.grid, ry: NOK });
        for (const y of [54.4, 99.6]) glow(x, y, z, B * .86 + .3, .3, B * .86 + .3, dim([1, .85, .6], .5));
        prop('box', x, 100.3, z, B * .88, .6, B * .88, [.05, .05, .055]);

        // Yakuza vice strip on the mall front for the rich: a magenta line, club names, blade signs and lanterns.

        {
          const F = facing(x, z), VICE = [[1.6, .2, .9], [1.5, .35, .55], [1.1, .3, 1.5], [1.5, .9, .3]];
          F.lit(MW / 2 + .08, 0, 31.4, .1, .35, MW * .9, dim(VICE[0], .9));
          F.lit(MW / 2 + .08, 0, 37.4, .1, .25, MW * .9, dim(VICE[1], .8));
          ['CLUB SAKURA', 'KARAOKE VIP', '極楽', 'CASINO'].forEach((t, k) => {
            const b = (k - 1.5) * MW * .22, [px, pz] = F.at(MW / 2 + .3, b);
            textSign(t, px, 34.4, pz, MW * .17, MW * .17 / 4.5, F.yaw, dim(VICE[k], .95));
          });
          for (let k = 0; k < 5; k++) F.lit(MW / 2 + 1.2, (k - 2) * MW * .22, 41, 2.2, 6, .2, dim(VICE[k % 4], .8));
          const [ax, az] = F.at(CO - .4, -LONG * .4), [bx, bz] = F.at(CO - .4, LONG * .4);
          stringLights([ax, 30.5, az], [bx, 30.5, bz], 1, 16, [1.5, .2, .3]);
        }

        // Waste-disposal chute down the back of the base. The guards send bodies down it as a warning.

        {
          const F = facing(x, z), a = -(B / 2 + 1.2), b = B * .22;
          F.box(a, b, 37, 2.6, 66, 2.6, [.07, .065, .06], 'cyl');
          for (let y = 12; y < 70; y += 11) F.box(a, b, y, 3.2, .6, 3.2, [.1, .085, .07], 'cyl');
          F.box(a - 1.4, b, 3.2, 3, 3.4, 4, [.06, .055, .05]);
          F.lit(a - 2.95, b, 2.6, .1, 1.8, 2.6, [.05, .02, .015]);
          F.lit(a - 2.9, b, 5.4, .3, .3, .3, [.6, .05, .03]);
          F.box(a - 5.5, b, .9, 3, 1.8, 5, [.08, .07, .05]);
          F.box(a - 6, b + .5, .03, 7, .06, 6, [.025, .012, .01]);
          for (let k = 0; k < 3; k++) F.box(a - 4 - r() * 4, b + (r() - .5) * 6, .4, .9, .8, .9, [.03, .03, .03]);
        }

        // Octagonal core in four tapering sections and four buttress towers ending at staggered heights.

        const core = B * .5, crownY = 940;
        for (let k = 0; k < 4; k++) {
          const y0 = 54 + k * (crownY - 54) / 4, cw = core * (1 - .09 * k);
          bld(x, z, cw, cw, (crownY - 54) / 4, S, r, { y0, roof: false, shape: 'oct', skin: k % 2 ? SKINS.bands : SKINS.grid });
          prop('cyl', x, y0, z, cw * 1.12, 1.2, cw * 1.12, [.05, .05, .055]);
        }
        const bt = B * .27, bo = B * .33, ends = [430, 600, 760, 330].map(v => v + r() * 40);
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz], i) => {
          const px = x + sx * bo, pz = z + sz * bo, top = ends[i], mid = 54 + (top - 54) * .55;
          bld(px, pz, bt, bt, mid - 54, { ...S, lit: .22 }, r, { y0: 54, roof: false, skin: SKINS.fins, ry: NOK });
          bld(px - sx * bt * .08, pz - sz * bt * .08, bt * .8, bt * .8, top - mid, { ...S, lit: .28 }, r, { y0: mid, roof: false, skin: SKINS.grid, ry: NOK });
          roof(px, pz, bt * .8, bt * .8, top, S, r);
          beacon(px, top + 1, pz, r);
          glow(px + sx * bt / 2, (54 + top) / 2, pz + sz * bt / 2, .45, top - 60, .45, LINE);
          glow(x + sx * core * .38, (54 + crownY) / 2, z + sz * core * .38, .35, crownY - 60, .35, dim(LINE, .7));
        });
        for (let y = 120; y < crownY; y += 120) put(GLOWS.ring, x, y, z, core * 1.25, 1, core * 1.25, 0, 0, dim(GOLD, .5));

        // Merc guard ring above level 70: red halo, beacons and searchlights.

        put(GLOWS.ring, x, 272, z, core * 1.5, 1, core * 1.5, 0, 0, RED);
        prop('cyl', x, 270, z, core * 1.35, 2, core * 1.35, [.05, .05, .05]);
        for (let k = 0; k < 8; k++) {
          const a = k / 8 * Math.PI * 2, rr = core * .7;
          beacon(x + Math.cos(a) * rr, 273, z + Math.sin(a) * rr, r);
          glow(x + Math.cos(a) * (rr + .6), 271, z + Math.sin(a) * (rr + .6), .6, .5, .6, [1.4, 1.35, 1.1]);
        }

        // Sky lobbies every 200 m on the core.

        for (let y = 200; y < crownY; y += 200) bld(x, z, core * 1.05, core * 1.05, 6, { ...S, lit: .85, win: [1, .9, .7] }, r, { y0: y, roof: false, shape: 'oct', skin: SKINS.curtain });

        // Weyland Consortium floors: a cool-lit band with white rings and the company name on four faces.

        const wb = core * .82 * 1.08, WEY = [1.2, 1.35, 1.6];
        bld(x, z, wb, wb, 60, { ...S, lit: .85, win: [.72, .85, 1.1] }, r, { y0: 505, roof: false, shape: 'oct', skin: SKINS.curtain });
        for (const y of [505, 565]) put(GLOWS.ring, x, y, z, wb * 1.3, 1, wb * 1.3, 0, 0, WEY);
        for (let f = 0; f < 4; f++) {
          word(x, z, wb, wb, 540, f, 'WEYLAND', WEY, 3);
          word(x, z, wb, wb, 526, f, 'CONSORTIUM', dim(WEY, .7), 1.6);
        }

        // Palace at Guayaquil: an eight-point crown of two turned blocks, terrace bands and a name.

        const cw = core * .95;
        for (const ry of [0, Math.PI / 4]) bld(x, z, cw, cw, 90, { ...S, lit: .95, win: [1.2, .9, .55] }, r, { y0: crownY, roof: false, skin: SKINS.curtain, ry });
        for (let y = crownY + 15; y < crownY + 90; y += 18) put(GLOWS.ring, x, y, z, cw * 1.5, 1, cw * 1.5, 0, 0, dim(GOLD, .7));
        for (let f = 0; f < 4; f++) word(x, z, cw, cw, crownY + 70, f, 'THE PALACE', dim(GOLD, 1.1), 3);
        prop('cone', x, crownY + 90 + 20, z, cw * 1.1, 40, cw * 1.1, [.12, .09, .05]);
        put(GLOWS.ring, x, crownY + 92, z, cw * 1.45, 1, cw * 1.45, 0, 0, dim(GOLD, 1.2));

        // Spire with a white tip.

        prop('cyl', x, crownY + 130 + (TOP - crownY - 130) / 2, z, 2.4, TOP - crownY - 130, 2.4, [.2, .19, .18]);
        prop('lattice', x, crownY + 145, z, 5, 50, 5, [1, .9, .7]);
        put(GLOWS.sphere, x, TOP, z, 3, 3, 3, 0, 0, [2.4, 2.1, 1.6]);
        beacon(x, TOP - 30, z, r);

        // Four searchlights sweep slowly from the crown. Each beam is brightest at the lamp, fades along
        // its length, has soft edges, and carries drifting haze.

        const beamMat = new THREE.ShaderMaterial({
          uniforms: { uTime: H.U.uTime, uFog: H.U.uFog, uFogNear: H.U.uFogNear, uFogFar: H.U.uFogFar, uCol: { value: new THREE.Color(1, .92, .72) } },
          vertexShader: `
            varying vec3 vW, vN; varying float vT;
            void main() {
              vec4 w = modelMatrix * vec4(position, 1.);
              vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vT = position.y / 900.;
              gl_Position = projectionMatrix * viewMatrix * w;
            }`,
          fragmentShader: `
            uniform float uTime, uFogNear, uFogFar; uniform vec3 uCol;
            varying vec3 vW, vN; varying float vT;
            float h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
            float n3(vec3 p) {
              vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
              return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
                         mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z);
            }
            void main() {
              vec3 v = normalize(cameraPosition - vW);
              float edge = pow(abs(dot(normalize(vN), v)), 2.2);
              float fall = pow(max(1. - vT, 0.), 2.4) * (.35 + 2.2 * exp(-vT * 18.));
              vec3 q = vW * .018 + vec3(uTime * .05, -uTime * .02, 0.);
              float haze = .45 + .9 * n3(q) * n3(q * 2.7 + 3.1);
              float fog = 1. - smoothstep(uFogNear, uFogFar * 1.4, distance(cameraPosition, vW));
              gl_FragColor = vec4(uCol * edge * fall * haze * fog * .16, 1.);
            }`,
          transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
        });
        const geo = new THREE.CylinderGeometry(60, 2.5, 900, 40, 24, true).translate(0, 450, 0);
        for (let k = 0; k < 4; k++) {
          const a = k / 4 * Math.PI * 2 + .4, px = x + Math.cos(a) * cw * .4, pz = z + Math.sin(a) * cw * .4;
          const pivot = new THREE.Group(), m = new THREE.Mesh(geo, beamMat);
          pivot.position.set(px, crownY + 92, pz);
          m.rotation.z = -.42;
          m.frustumCulled = false;
          m.onBeforeRender = () => { pivot.rotation.y = -a + Math.sin(H.U.uTime.value * .11 + k * 1.7) * .9; };
          pivot.add(m);
          H.decor.add(pivot);
          put(GLOWS.sphere, px, crownY + 93, pz, 4, 4, 4, 0, 0, [2.6, 2.3, 1.7]);
        }
      },
    },

    // El Puente de la Unidad Nacional: four old road bridges across the north arm of the Waterways, closed to
    // traffic and covered in tents. The site is the west bridgehead; the spans and the river's boats and
    // chained-ship squats are placed by world position.

    gye_unidad: {
      at: [1033, 1362], label: 'El Puente de la Unidad Nacional', minSide: 24, reach: 260, labelY: 45,
      build(x, z, w, d, st, r) {
        const river = waters().find(o => o.name === 'The Waterways') ?? waters()[0];
        if (!river) return;
        const DY = 13, TENT = [1.3, .7, .3];
        const flag = (px, py, pz) => {
          prop('cyl', px, py + 4, pz, .15, 8, .15, [.15, .15, .15]);
          [[1.1, .85, .1], [.1, .2, .7], [.8, .08, .06]].forEach((c, i) => prop('box', px + 1.2, py + 7.6 - i * .5 - (i ? .25 : 0), pz, 2.2, i ? .5 : 1, .05, dim(c, .5)));
        };
        const crossings = Z => {
          const xs = [];
          const p = river.poly;
          for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
            const [ax, az] = p[j], [bx, bz] = p[i];
            if ((az > Z) !== (bz > Z)) xs.push(ax + (Z - az) * (bx - ax) / (bz - az));
          }
          return xs.length >= 2 ? [Math.min(...xs), Math.max(...xs)] : null;
        };

        // Bridgehead on the claimed block: a ramp plaza of tents round fires.

        prop('box', x, .2, z, w, .4, d, [.05, .045, .04]);
        for (let k = 6 + Math.floor(r() * 6); k > 0; k--) {
          const px = x + (r() - .5) * w * .85, pz = z + (r() - .5) * d * .85;
          prop('box', px, 1.1, pz, 2.5 + r() * 2, 2.2, 2.5 + r() * 2, pick(r, TARP), r() * 3);
        }
        fire(x, .8, z, r, 1.1);
        flag(x + w * .3, 0, z - d * .3);

        ['truss', 'arch', 'hang', 'arch'].forEach((kind, bi) => {
          const Zw = 3430 + bi * 64, cr = crossings(Zw);
          if (!cr) return;
          const [a, b] = [toLocal(cr[0] - 14, Zw + (r() - .5) * 24), toLocal(cr[1] + 14, Zw + (r() - .5) * 24)];
          const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, px = -uz, pz = ux, ry = Math.atan2(dx, dz);
          const P = (t, side = 0, y = DY) => [a[0] + ux * t + px * side, y, a[1] + uz * t + pz * side];
          const mid = P(L / 2);
          prop('box', mid[0], DY, mid[2], 15, 1.4, L, [.09, .085, .08], ry);
          for (const t of [0, L]) { const e = P(t); prop('box', e[0], DY / 2, e[2], 16, DY, 8, CONC, ry); }
          const piers = [];
          for (let t = 40; t < L - 20; t += 40 + r() * 8) { const e = P(t); prop('box', e[0], DY / 2, e[2], 13, DY, 3.5, CONC, ry); piers.push(t); }
          for (const side of [-7.2, 7.2]) { const e = P(L / 2, side, DY + 1.2); prop('box', e[0], e[1], e[2], .25, 1, L, [.14, .13, .12], ry); }

          if (kind === 'truss') for (const side of [-7, 7]) {
            const g = P(L / 2, side, DY + 7);
            prop('box', g[0], g[1], g[2], .6, .6, L - 10, [.1, .09, .08], ry);
            for (let t = 5; t < L - 15; t += 15) {
              H.beam(P(t, side, DY + .7), P(t, side, DY + 7), .45, [.1, .09, .08]);
              H.beam(P(t, side, DY + .7), P(t + 15, side, DY + 7), .4, [.1, .09, .08]);
            }
          } else if (kind === 'arch') {
            const stops = [0, ...piers, L];
            for (let q = 0; q + 1 < stops.length; q++) {
              const t0 = stops[q], t1 = stops[q + 1], seg = 6;
              for (let k = 0; k < seg; k++) {
                const ya = DY - 1 - 7 * Math.sin(Math.PI * k / seg), yb = DY - 1 - 7 * Math.sin(Math.PI * (k + 1) / seg);
                for (const side of [-5, 5]) H.beam(P(lerp(t0, t1, k / seg), side, ya), P(lerp(t0, t1, (k + 1) / seg), side, yb), .9, CONC);
              }
            }
          } else {
            const t0 = L * .28, t1 = L * .72, TH = DY + 38;
            for (const t of [t0, t1]) for (const side of [-7, 7]) { const e = P(t, side, TH / 2); prop('box', e[0], e[1], e[2], 1.8, TH, 1.8, [.12, .1, .09], ry); beacon(e[0], TH + .6, e[2], r); }
            for (const side of [-7, 7]) {
              const pts = [P(0, side, DY + 1), P(t0, side, TH), ...[.2, .4, .6, .8].map(f => P(lerp(t0, t1, f), side, TH - 22 * Math.sin(Math.PI * f) + 0)), P(t1, side, TH), P(L, side, DY + 1)];
              for (let k = 0; k + 1 < pts.length; k++) H.beam(pts[k], pts[k + 1], .35, [.16, .15, .14]);
            }
          }

          // Tents along both curbs, lit doors, cooking fires, Ecuadorian flags and strings of tent light.

          for (let t = 8; t < L - 8; t += 6 + r() * 3) for (const side of [-1, 1]) if (r() < .78) {
            const e = P(t, side * (4 + r() * 2.5), DY + .7), th = 1.6 + r() * 1.3;
            prop('box', e[0], e[1] + th / 2, e[2], 2.4 + r() * 2, th, 2.2 + r() * 2, pick(r, TARP), ry + (r() - .5) * .5);
            if (r() < .3) glow(e[0] - px * side * 1.3, e[1] + .7, e[2] - pz * side * 1.3, .9, 1, .9, dim(TENT, .5 + .4 * r()));
          }
          for (let k = 2 + Math.floor(r() * 2); k > 0; k--) { const e = P(15 + r() * (L - 30), (r() - .5) * 3, DY + 1.5); fire(e[0], e[1], e[2], r, .9); }
          for (let k = 0; k < 2; k++) { const e = P(L * (.25 + .5 * k), 7, DY + .7); flag(e[0], e[1], e[2]); }
          for (const side of [-1, 1]) stringLights(P(4, side * 6.6, DY + 3.4), P(L - 4, side * 6.6, DY + 3.4), 1.2, Math.round(L / 9), r() < .7 ? TENT : [1.2, .35, .55]);
        });

        // Boat lamps on the open water and chained-ship squats where the river narrows. Boats keep out of the
        // Estero Salado lobe on the Daule bank (gye-water.js).

        const xs = river.poly.map(p => p[0]), zs = river.poly.map(p => p[1]);
        const deep = (X, Z) => [[0, 0], [14, 0], [-14, 0], [0, 14], [0, -14]].every(([ox, oz]) => wet(X + ox, Z + oz));
        for (let k = 0, n = 0; k < 400 && n < 46; k++) {
          const X = lerp(Math.min(...xs), Math.max(...xs), r()), Z = lerp(Math.min(...zs), Math.max(...zs), r());
          if (!deep(X, Z) || (Z > 3400 && Z < 3640 && r() < .7) || (X > 1470 && Z > 3870 && Z < 4115)) continue;
          const [lx, lz] = toLocal(X, Z);
          boat(lx, lz, 6 + r() * 10, r() < .5, r);
          n++;
        }
        for (const [X0, Z0, dirX] of [[1290, 3740, 1], [1240, 4050, 1], [1640, 3700, -1]]) {
          let made = 0;
          for (let k = 0; k < 7; k++) {
            const X = X0 + dirX * 18, Z = Z0 + k * 9;
            if (!wet(X, Z)) continue;
            const [lx, lz] = toLocal(X, Z), hl = 18 + r() * 10, col = pick(r, HULL);
            prop('box', lx, 1.3, lz, hl, 2.6, 7.4, col);
            const sh = 2.6 + r() * 2.4;
            bld(lx + (r() - .5) * 4, lz, hl * .5, 5.5, sh, { ...st, lit: .45, base: dim(pick(r, JUNK), 1.3) }, r, { y0: 2.6, roof: false, skin: SKINS.sparse, ry: NOK });
            prop('box', lx, 2.7 + sh, lz, hl * .55, .12, 6.2, pick(r, TARP));
            glow(lx + hl * .45, 3.2, lz, .4, .4, .4, [1.4, .75, .3]);
            pool(lx, lz, 9, [.07, .035, .012]);
            made++;
          }
          if (made > 1) { const [ax, az] = toLocal(X0 + dirX * 18 + 6, Z0), [bx, bz] = toLocal(X0 + dirX * 18 + 6, Z0 + 9 * 6); stringLights([ax, 7, az], [bx, 7, bz], 1, 10, [1.3, .65, .28]); }
        }
      },
    },

    // San Miguel Cathedral: a few decades old and over-opulent. Twin towering spires, a lantern spire,
    // flying buttresses, a rose window and holographic ceiling light through the clerestory.

    gye_sanmiguel: {
      at: [1000, 1385], label: 'San Miguel Cathedral', minSide: 50, reach: 320, labelY: 175,
      build(x, z, w, d, st, r) {
        const fr = H.frame()?.front ?? { x: 0, z: 1 }, ax = w >= d, L = Math.min(Math.max(w, d) - 4, 104), Wn = Math.min(Math.min(w, d) - 6, 34);
        const fs = ax ? (fr.x || 1) : (fr.z || 1);
        const at = (u, v) => ax ? [x + u * fs, z + v] : [x + v, z + u * fs];
        const sz = (su, sv) => ax ? [su, sv] : [sv, su];
        const yaw = ax ? 0 : Math.PI / 2;
        const STONE = { ...st, base: [.2, .18, .15], win: [1, .75, .42], lit: .3, grime: .35, w: .3 };
        const COPPER = [.05, .09, .075], TRIM = [1.3, .9, .4];
        const box = (u, v, su, sv, y0, h, o = {}) => { const [px, pz] = at(u, v), [a, e] = sz(su, sv); bld(px, pz, a, e, h, { ...STONE, ...o.st }, r, { y0, roof: false, skin: o.skin ?? SKINS.bands, shape: o.shape, ry: NOK }); return [px, pz]; };
        const gable = (u, v, len, wid, y, along = true) => { const [px, pz] = at(u, v), s = wid / Math.SQRT2; prop('box', px, y, pz, len, s, s, COPPER, yaw + (along ? 0 : Math.PI / 2), Math.PI / 4); };

        { const [a, e] = sz(L + 4, Math.min(w, d) - 2); prop('box', x, .15, z, a, .3, e, [.07, .065, .06]); }
        const nl = L * .62, nw = Wn * .5, nu = -L * .06;
        box(nu, 0, nl, nw, 0, 34);
        gable(nu, 0, nl, nw, 34);
        for (const v of [-1, 1]) {
          box(nu, v * (nw / 2 + Wn * .12), nl, Wn * .24, 0, 17, { skin: SKINS.grid });
          for (let k = 0; k < 8; k++) {
            const u = nu - nl / 2 + (k + .5) * nl / 8;
            const [hx, hz] = at(u, v * (nw / 2 + .1));
            glow(hx, 27, hz, ax ? nl / 8 * .7 : .1, 6, ax ? .1 : nl / 8 * .7, dim([[1.2, .3, 1.1], [1.3, .85, .3], [.3, 1, 1.3]][k % 3], .55));
            const [ox, oz] = at(u, v * (Wn / 2 + 1));
            prop('box', ox, 11, oz, 1.6, 22, 1.6, [.17, .15, .12]);
            prop('cone', ox, 24, oz, 1.6, 4, 1.6, [.17, .15, .12]);
            H.beam([ox, 21, oz], [hx, 30, hz], .8, [.17, .15, .12]);
          }
        }
        const tu = nu - nl * .12;
        box(tu, 0, 13, Wn, 0, 31);
        gable(tu, 0, Wn, 13, 31, false);

        // Lantern spire over the crossing.

        { const [px, pz] = at(tu, 0); bld(px, pz, 11, 11, 26, STONE, r, { y0: 34, roof: false, shape: 'oct', skin: SKINS.fins }); prop('cone', px, 60 + 32, pz, 10, 64, 10, COPPER); put(GLOWS.sphere, px, 125, pz, 1.4, 1.4, 1.4, 0, 0, TRIM); put(GLOWS.ring, px, 60, pz, 13, 1, 13, 0, 0, dim(TRIM, .6)); }

        // Apse.

        { const [px, pz] = at(nu - nl / 2 - 6, 0); bld(px, pz, nw * 1.1, nw * 1.1, 28, STONE, r, { roof: false, shape: 'oct', skin: SKINS.bands }); prop('cone', px, 28 + 7, pz, nw * 1.15, 14, nw * 1.15, COPPER); }

        // West front: a tall screen, two towers with spires and pinnacles, a rose window and lit portals.

        const fu = nu + nl / 2 + 4;
        box(fu, 0, 8, Wn * .72, 0, 46);
        for (const v of [-1, 1]) {
          const tv = v * Wn * .36, [px, pz] = box(fu, tv, 10, 10, 0, 82, { skin: SKINS.fins });
          prop('cone', px, 82 + 39, pz, 9.5, 78, 9.5, [.19, .17, .14]);
          put(GLOWS.sphere, px, 161, pz, 1.2, 1.2, 1.2, 0, 0, TRIM);
          for (const [a, e] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            prop('cone', px + a * 4.5, 82 + 5, pz + e * 4.5, 1.4, 10, 1.4, [.19, .17, .14]);
            glow(px + a * 5.1, 41, pz + e * 5.1, .25, 80, .25, dim(TRIM, .5));
          }
          const [gx, gz] = at(fu + 6, tv);
          glow(gx, .6, gz, 1, 1, 1, dim(TRIM, 1.2));
          pool(gx, gz, 14, [.12, .09, .04]);
        }
        const [rx, rz] = at(fu + 4.1, 0);
        put(GLOWS.sphere, rx, 32, rz, ax ? .4 : 11, 11, ax ? 11 : .4, 0, 0, [1.1, .45, .95]);
        put(GLOWS.ring, rx, 32, rz, 12, 1, 12, ax ? Math.PI / 2 : 0, Math.PI / 2, TRIM);
        for (const v of [-1, 0, 1]) { const [px, pz] = at(fu + 4.15, v * 7); glow(px, 4, pz, ax ? .1 : 3.4, 8, ax ? 3.4 : .1, [1.3, .8, .4]); }
        for (let k = 0; k < 6; k++) { const [px, pz] = at(fu + 10 + r() * 6, (r() - .5) * Wn); glow(px, 3.5, pz, .4, .3, .4, [1.2, .85, .5]); pool(px, pz, 9, [.08, .06, .03]); }
        return { face: ax ? [fs, 0] : [0, fs] };
      },
    },

    // Resistance Wall: a giant mural in sun-powered holographic paint on the face of a dead arcology.

    gye_resistance: {
      at: [955, 1250], label: 'Resistance Wall', minSide: 40, reach: 320, labelY: 210,
      build(x, z, w, d, st, r) {
        const fr = H.frame()?.front ?? { x: 0, z: 1 }, F = Math.min(fr.x ? d : w, 70) - 4, Tk = Math.min(fr.x ? w : d, 40) - 6, h = 190 + 30 * r();
        const bx = x - fr.x * 2, bz = z - fr.z * 2, sw = fr.x ? Tk : F, sd = fr.x ? F : Tk;
        const S = T.tone(st, .1, 1);
        bld(bx, bz, sw, sd, h - 40, { ...S, lit: .03 }, r, { roof: false, skin: SKINS.sparse, ry: NOK });
        bld(bx, bz, sw * .9, sd * .9, 40, { ...S, lit: .35, win: [1, .7, .4] }, r, { y0: h - 40, roof: false, skin: SKINS.grid, ry: NOK });
        roof(bx, bz, sw * .9, sd * .9, h, S, r);
        for (let k = 0; k < 8; k++) prop('box', bx + (r() - .5) * sw * .7, h + 1.4, bz + (r() - .5) * sd * .7, 5, .2, 3, [.04, .06, .12], 0, -.35);

        // The mural: sun over Cayambe, the Beanstalk cut, a raised fist and the flag's bands, sprayed by hand.

        const rnd = H.rng(H.hash(7, 13));
        const tex = canvasTexture(512, 1024, (g, W, Hh) => {
          g.fillStyle = '#0b0908'; g.fillRect(0, 0, W, Hh);
          for (let k = 0; k < 5000; k++) { g.fillStyle = `rgba(${40 + rnd() * 40},${30 + rnd() * 30},${30 + rnd() * 20},.5)`; g.fillRect(rnd() * W, rnd() * Hh, 2, 2); }
          const sun = g.createRadialGradient(256, 230, 10, 256, 230, 200);
          sun.addColorStop(0, '#ffe066'); sun.addColorStop(.45, '#ff8a1f'); sun.addColorStop(1, 'rgba(255,60,20,0)');
          g.fillStyle = sun; g.fillRect(0, 0, W, 470);
          g.strokeStyle = '#ffcf3a'; g.lineWidth = 6;
          for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; g.beginPath(); g.moveTo(256 + Math.cos(a) * 120, 230 + Math.sin(a) * 120); g.lineTo(256 + Math.cos(a) * 200, 230 + Math.sin(a) * 200); g.stroke(); }
          g.fillStyle = '#16323a'; g.beginPath(); g.moveTo(0, 520); g.lineTo(120, 410); g.lineTo(200, 470); g.lineTo(300, 330); g.lineTo(400, 450); g.lineTo(512, 400); g.lineTo(512, 560); g.lineTo(0, 560); g.fill();
          g.strokeStyle = '#7fe8ff'; g.lineWidth = 10; g.beginPath(); g.moveTo(300, 0); g.lineTo(300, 150); g.moveTo(300, 190); g.lineTo(300, 330); g.stroke();
          g.strokeStyle = '#ff3355'; g.lineWidth = 8; g.beginPath(); g.moveTo(270, 175); g.lineTo(335, 160); g.stroke();
          [['#f5c400', 560, 90], ['#1f3fb0', 650, 60], ['#d01a1a', 710, 60]].forEach(([c, y, hh]) => { g.fillStyle = c; g.fillRect(0, y, W, hh); });

          // Raised fist: a tapered forearm with a red cuff, the back of the hand, four curled fingers and the thumb
          // across them. A warm rim light picks out the outline against the flag.

          // The rim colour is stroked wide first and the dark fill covers its inner half, so only the outline glows.

          const fist = () => {
            g.beginPath();
            g.moveTo(222, 868); g.lineTo(218, 712); g.lineTo(294, 712); g.lineTo(290, 868); g.closePath();
            g.roundRect(186, 604, 140, 112, 30);
            for (let k = 0; k < 4; k++) g.roundRect(188 + k * 34, 556, 34, 76, 16);
          };
          g.lineJoin = 'round';
          g.strokeStyle = 'rgba(255,165,60,.9)'; g.lineWidth = 9; fist(); g.stroke();
          g.fillStyle = '#1a1210'; fist(); g.fill();
          g.strokeStyle = '#4a3226'; g.lineWidth = 3;
          for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(188 + k * 34, 568); g.lineTo(188 + k * 34, 618); g.stroke(); }
          g.fillStyle = 'rgba(255,210,122,.85)';
          for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(205 + k * 34, 570, 10, 5, 0, Math.PI, 0); g.fill(); }
          g.save(); g.translate(250, 640); g.rotate(-.12);
          g.strokeStyle = 'rgba(255,165,60,.75)'; g.lineWidth = 6; g.beginPath(); g.roundRect(-62, -16, 116, 32, 16); g.stroke();
          g.fillStyle = '#271a14'; g.beginPath(); g.roundRect(-62, -16, 116, 32, 16); g.fill();
          g.restore();
          g.fillStyle = '#ff3355'; g.fillRect(217, 726, 78, 18);
          g.fillStyle = '#ff5a8a'; g.font = 'bold 76px "Arial Narrow", sans-serif'; g.textAlign = 'center';
          g.fillText('RESISTENCIA', 256, 930);
          g.fillStyle = '#7fe8ff'; g.font = 'bold 40px "Arial Narrow", sans-serif'; g.fillText('LA TIERRA NO SE VENDE', 256, 985);
          for (let k = 0; k < 900; k++) { g.fillStyle = ['#ffcf3a', '#ff5a8a', '#7fe8ff'][k % 3]; g.globalAlpha = .25; g.fillRect(rnd() * W, rnd() * Hh, 3, 3); }
          g.globalAlpha = 1;
        });
        const mw = F * .92, mh = Math.min(h - 70, mw * 2.6);
        panel(tex, bx + fr.x * ((fr.x ? sw : sd) / 2 + .6), h - 45 - mh / 2, bz + fr.z * ((fr.x ? sw : sd) / 2 + .6), mw, mh, Math.atan2(fr.x, fr.z), .85);

        // Uplights, a crowd round fires and tags at the foot of the wall.

        for (const u of [-.35, 0, .35]) {
          const px = x + fr.x * ((fr.x ? sw : sd) / 2 + 4) - fr.z * u * F, pz = z + fr.z * ((fr.x ? sw : sd) / 2 + 4) + fr.x * u * F;
          glow(px, .5, pz, .8, .5, .8, [1.2, 1.1, .8]);
          pool(px, pz, 12, [.07, .06, .05]);
        }
        for (let k = 0; k < 3; k++) fire(x + fr.x * ((fr.x ? sw : sd) / 2 + 10) + (r() - .5) * F * .6 * Math.abs(fr.z), .8, z + fr.z * ((fr.x ? sw : sd) / 2 + 10) + (r() - .5) * F * .6 * Math.abs(fr.x), r, .9);
        puff(bx, h * .5, bz, 40, SMOG);
        return { face: [fr.x, fr.z] };
      },
    },

    // Parque Industrial Arcology: a small stepped arcology beyond the Daule. The offices at the bottom and the
    // dead mall above them are a trash dump. Residents hold the lit top behind a guarded light line, and
    // trash chutes run down the street face to burning mounds.

    gye_parque: {
      at: [1215, 1175], label: 'Parque Industrial Arcology', minSide: 50, reach: 420, labelY: 185,
      build(x, z, w, d, st, r) {
        const fr0 = T.front();
        x -= fr0.x * 5; z -= fr0.z * 5;
        const F = facing(x, z), { at, sz, yaw, fr } = F;
        const SP = Math.min(F.span(w, d), 96) - 6, DP = Math.min(F.deep(w, d), 72) - 18;
        const S = T.tone(st, .15, 1), HOME = [1.4, .9, .45], GREEN = [.35, 1, .45];
        const tier = (f, y0, h, o, skin) => { const [a, e] = sz(DP * f, SP * f); bld(x, z, a, e, h, { ...S, ...o }, r, { y0, roof: false, skin, ry: NOK }); return [a, e]; };

        // Offices and the dead mall: black floors, breaches, scavenger torches, trash spilling from the doors.

        const [bw, bd] = tier(1, 0, 58, { lit: .015, grime: 1 }, SKINS.sparse);
        tier(.94, 58, 34, { lit: .04 }, SKINS.curtain);
        F.lit(0, 0, 75, DP * .94 + .3, .3, SP * .94 + .3, dim([1.2, .2, 1.4], .12));
        for (let k = 0; k < 12; k++) {
          const n = FACES[k % 4], y = 4 + r() * 84, s = y > 58 ? .94 : 1;
          const half = (n[0] ? bw : bd) / 2 * s + .2, along = (r() - .5) * (n[0] ? bd : bw) * .8;
          const px = x + n[0] * half - n[1] * along, pz = z + n[1] * half + n[0] * along;
          if (k % 3) flickerGlow(px, y, pz, n[0] ? .12 : 1.2, .9, n[0] ? 1.2 : .12, dim(FIRE, .55), r);
          else glow(px, y, pz, n[0] ? .12 : 3.5, 2.6, n[0] ? 3.5 : .12, [.18, .07, .02]);
        }
        for (let k = 0; k < 24; k++) {
          const n = FACES[k % 4], out = (n[0] ? bw : bd) / 2 + .6 + r() * 2.2, along = (r() - .5) * (n[0] ? bd : bw) * .9, s = 1.2 + r() * 2.4;
          prop('box', x + n[0] * out - n[1] * along, s * .3, z + n[1] * out + n[0] * along, s, s * .6, s * (.6 + r()), pick(r, JUNK), r() * 3);
        }

        // Two trash chutes down the street face, each onto a burning mound.

        [[-.3, 134], [.22, 92]].forEach(([f, top]) => {
          const b = f * SP, [px, pz] = at(DP / 2 + 1.6, b), [mx, mz] = at(DP / 2 + 7, b);
          prop('cyl', px, (8 + top) / 2, pz, 2.4, top - 8, 2.4, [.1, .085, .07]);
          for (let y = 20; y < top; y += 14) prop('box', px, y, pz, 3.2, .8, 3.2, [.13, .1, .07]);
          prop('cone', mx, 2.5, mz, 12, 5, 12, pick(r, JUNK));
          for (let k = 0; k < 5; k++) prop('box', mx + (r() - .5) * 9, .8, mz + (r() - .5) * 9, 1.5 + r() * 2, 1.4, 1.5 + r() * 2, pick(r, JUNK), r() * 3);
          fire(mx, 1.2, mz, r, 1.1);
        });

        // The resident line: a lit ledge with sentry lamps at the top of the dead mall.

        F.box(0, 0, 92.4, DP * .94 + 2, .8, SP * .94 + 2, [.05, .05, .05]);
        F.lit(0, 0, 91.6, DP * .94 + .3, .6, SP * .94 + .3, dim(HOME, .9));
        for (let k = 0; k < 10; k++) {
          const n = FACES[k % 4], half = (n[0] ? bw : bd) / 2 * .94 + 1, along = ((k >> 2) - .5) * (n[0] ? bd : bw) * .6;
          put(GLOWS.sphere, x + n[0] * half - n[1] * along, 93.6, z + n[1] * half + n[0] * along, .8, .8, .8, 0, 0, [1.4, 1.35, 1.1]);
        }

        // Lived-in flats on top: warm windows, terrace gardens, laundry lights, solar panels and the old name.

        tier(.8, 92, 42, { lit: .55, win: [1, .78, .48], grime: .7 }, SKINS.grid);
        tier(.62, 134, 30, { lit: .7, win: [1, .8, .5], grime: .6 }, SKINS.grid);
        roof(x, z, ...sz(DP * .62, SP * .62), 164, S, r);
        for (let k = 0; k < 6; k++) F.lit((k < 3 ? 1 : -1) * DP * .355, (k % 3 - 1) * SP * .25, 134.4, DP * .07, .5, SP * .18, dim(GREEN, .3));
        for (const s of [-1, 1]) {
          const [ax, az] = at(DP * .36, s * SP * .38), [cx, cz] = at(DP * .36, -s * SP * .05);
          stringLights([ax, 137, az], [cx, 137, cz], .8, 9, dim(HOME, .9));
        }
        for (let k = 0; k < 6; k++) { const [px, pz] = at((k % 2 - .5) * DP * .3, (Math.floor(k / 2) - 1) * SP * .18); prop('box', px, 165.2, pz, SP * .14, .15, 3, [.03, .05, .12], yaw, -.3); }
        { const [px, pz] = at(DP * .4 + .3, 0); textSign('PARQUE INDUSTRIAL', px, 122, pz, SP * .6, SP * .15, yaw, dim(GREEN, .55)); }
        { const [px, pz] = at(0, SP * .2); beacon(px, 166, pz, r); }

        // Four corner lift shafts run the full height. They are dark below the resident line and lit above it,
        // with a lobby band every floor group and a beacon on each cap.

        for (const [sa, sb] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
          const a = sa * DP * .47, b = sb * SP * .47;
          F.box(a, b, 89, 8, 178, 8, [.07, .065, .06]);
          F.lit(sa * (DP * .47 + 4.05), sb * (SP * .47 + 4.05), 135, .4, 84, .4, dim(HOME, .7));
          for (let y = 98; y < 176; y += 9) F.lit(a, b, y, 8.2, .5, 8.2, dim(HOME, .45));
          F.box(a, b, 179, 9.5, 2, 9.5, [.05, .05, .05]);
          const [px, pz] = at(a, b);
          beacon(px, 181, pz, r);
        }

        // The dead mall's glass: broken and burnt panes, and its old sign with one letter still flickering.

        for (let k = 0; k < 22; k++) {
          const n = FACES[k % 4], half = (n[0] ? bw : bd) / 2 * .94 + .15, along = (r() - .5) * (n[0] ? bd : bw) * .85;
          const s = 3 + r() * 5, px = x + n[0] * half - n[1] * along, pz = z + n[1] * half + n[0] * along;
          prop('box', px, 61 + r() * 28, pz, n[0] ? .2 : s, 2 + r() * 4, n[0] ? s : .2, r() < .7 ? [.012, .012, .014] : [.05, .03, .02]);
        }
        {
          const [px, pz] = at(DP * .47 + .4, 0), [fx, fz] = at(DP * .47 + .5, SP * .26);
          textSign('CENTRO COMERCIAL', px, 82, pz, SP * .55, SP * .07, yaw, dim([1.2, .2, 1.4], .2));
          flickerGlow(fx, 82, fz, 1.6, 2.4, 1.6, dim([1.2, .2, 1.4], .9), r);
        }

        // Terrace gardens on the flats' setback: small trees and a lantern string along the front.

        for (let k = 0; k < 18; k++) {
          const side = k % 4, t = (r() - .5) * .7, d = .34 + r() * .04;
          const [a, b] = side < 2 ? [(side ? 1 : -1) * DP * d, t * SP] : [t * DP, (side === 2 ? 1 : -1) * SP * d];
          const [px, pz] = at(a, b), h = 3 + r() * 3;
          prop('cyl', px, 134 + h / 2, pz, .4, h, .4, [.08, .05, .03]);
          prop('cone', px, 134 + h + 1.4, pz, 3.2 + r() * 1.5, 4, 3.2 + r() * 1.5, [.03, .09 + r() * .05, .04]);
        }
        { const [ax, az] = at(DP * .39, -SP * .38), [cx, cz] = at(DP * .39, SP * .38); stringLights([ax, 137.5, az], [cx, 137.5, cz], 1.2, 14, dim(HOME, .8)); }

        // Roof: a lit greenhouse, water tanks, a radio mast and a dish.

        F.box(-DP * .1, -SP * .1, 167.5, DP * .22, 7, SP * .26, [.03, .06, .04]);
        F.lit(-DP * .1, -SP * .1, 167.5, DP * .22 + .3, 6.4, SP * .26 + .3, dim(GREEN, .22));
        for (const s of [-1, 1]) F.box(DP * .18, s * SP * .2, 168, 5, 8, 5, [.09, .08, .07], 'cyl');
        F.box(DP * .05, -SP * .26, 182, 2.4, 36, 2.4, [.2, .2, .2], 'lattice');
        { const [px, pz] = at(DP * .2, SP * .02); prop('dish', px, 165, pz, 6, 6, 6, [.35, .35, .35]); }
        puff(x, 35, z, 34, SMOG);
        return { face: [fr.x, fr.z] };
      },
    },

    // The Rusty I-Beam: a condemned NetTel hotel squatted by hackers, artists and writers. Studio windows in
    // painted colours, a guerrilla solar rig with wings over the roof edges, dishes that steal the neighbours'
    // Network, and a rusted girder the residents raised on the roof, its flanges lined in orange light.

    gye_ibeam: {
      at: [1222, 1322], label: 'The Rusty I-Beam', minSide: 32, reach: 380, labelY: 125,
      build(x, z, w, d, st, r) {
        const F = facing(x, z), { at, sz, yaw, fr } = F;
        const SP = Math.min(F.span(w, d) - 8, 38), DP = Math.min(F.deep(w, d) - 10, 18), H0 = 9, TOP = 80;
        const S = T.tone(st, .2, 1), RUST = [.22, .085, .035], STEEL = [.1, .09, .08];
        const ART = [[1.4, .2, 1.1], [.2, 1.1, 1.4], [1.5, 1, .15], [.3, 1.3, .4], [1.5, .35, .15]];

        // Boarded lobby and the hotel slab with rust streaks and painted studio windows.

        bld(x, z, ...sz(DP + 6, SP + 4), H0, { ...S, lit: .02 }, r, { roof: false, skin: SKINS.sparse, ry: NOK });
        bld(x, z, ...sz(DP, SP), TOP - H0, { ...S, lit: .14, win: TUNG, grime: 1 }, r, { y0: H0, roof: false, skin: SKINS.grid, ry: NOK });
        F.box(0, 0, TOP + .4, DP + .6, .8, SP + .6, [.06, .05, .045]);
        for (const b of [-.3, 0, .3]) F.box(DP / 2 + 3.15, b * SP, 2.6, .3, 5.2, 4, WOOD);
        { const [px, pz] = at(DP / 2 + 6, 0); pool(px, pz, 8, [.08, .05, .03]); }
        for (let k = 0; k < 18; k++) {
          const s = k % 3 ? 1 : -1, y = H0 + 3 + Math.floor(r() * 20) * 3.4;
          F.lit(s * (DP / 2 + .06), (r() - .5) * SP * .85, y, .1, 2.2, 2.6 + r() * 2, dim(pick(r, ART), .5 + .3 * r()));
        }
        for (let k = 0; k < 6; k++) F.box(DP / 2 + .08, (r() - .5) * SP * .9, TOP - 14 - r() * 20, .1, 18 + r() * 20, .6, RUST);
        { const [px, pz] = at(DP / 2 + .3, 0); textSign('RUSTY I-BEAM', px, 46, pz, SP * .7, SP * .7 / 4, yaw, dim(ART[1], .9)); }

        // The dead NetTel sign on the roof's front edge.

        F.box(DP / 2 - 1, SP * .18, TOP + 4, .4, 6, SP * .45, STEEL);
        { const [px, pz] = at(DP / 2 - .7, SP * .18); textSign('NETTEL', px, TOP + 4, pz, SP * .42, SP * .42 / 4.5, yaw, [.35, .05, .04]); }

        // Guerrilla solar rig on lattice legs, its outer panels on wings past the side walls.

        const SY = TOP + 6, PW = SP * 1.5 / 5;
        for (const a of [-.42, .05]) for (const b of [-.4, .4]) F.box(a * DP, b * SP, TOP + 3, 1.2, 6, 1.2, [.5, .45, .4], 'lattice');
        for (const a of [-.32, -.05]) {
          for (let k = 0; k < 5; k++) { const [px, pz] = at(a * DP, (k - 2) * PW); prop('box', px, SY, pz, PW - .3, .15, 3.4, [.03, .05, .12], yaw, -.32); }
          const [gx, gz] = at(a * DP - 1.6, 0);
          glow(gx, SY - .5, gz, SP * 1.5, .12, .25, dim([.3, .6, 1.2], .35), yaw);
          for (const s of [-1, 1]) { const [ex, ez] = at(a * DP, s * SP / 2), [tx, tz] = at(a * DP, s * SP * .75); H.beam([ex, TOP + .8, ez], [tx, SY - .4, tz], .35, STEEL); }
        }

        // Dishes on each roof edge, aimed at the neighbours' Network.

        const [bw, bd] = sz(DP, SP);
        for (const n of FACES) {
          const px = x + n[0] * (bw / 2 - 1.5), pz = z + n[1] * (bd / 2 - 1.5);
          prop('cyl', px, TOP + 1.5, pz, .3, 2.4, .3, STEEL);
          prop('dish', px, TOP + 2.8, pz, 3, 3, 3, [.2, .2, .22], Math.atan2(n[0], n[1]), 1.3);
          glow(px, TOP + 2.2, pz, .25, .25, .25, [.3, 1.4, .5]);
        }

        // The rusted girder, leaning out over the street. Web, two flanges, orange seams, a beacon at the tip.

        const L = 34, th = .4, ga = -DP * .05, gb = -SP * .34, ca = ga + L / 2 * Math.sin(th), cy = TOP + L / 2 * Math.cos(th);
        F.box(ga, gb, TOP + 1, 4, 2, 4, STEEL);
        { const [px, pz] = at(ca, gb); prop('box', px, cy, pz, .5, L, 2.8, RUST, yaw, th); }
        for (const s of [-1, 1]) {
          const [px, pz] = at(ca + s * 1.4 * Math.cos(th), gb), [qx, qz] = at(ca + s * 1.62 * Math.cos(th), gb);
          prop('box', px, cy - s * 1.4 * Math.sin(th), pz, 2.6, L, .35, RUST, yaw, th);
          put(GLOWS.sphere, qx, cy - s * 1.62 * Math.sin(th), qz, .35, L * .96, .35, yaw, th, [1.6, .45, .12]);
        }
        { const [px, pz] = at(ga, gb); put(GLOWS.sphere, px, TOP + 2.4, pz, 2, 2, 2, 0, 0, [1.4, .7, .3]); }
        const ta = ga + L * Math.sin(th), ty = TOP + L * Math.cos(th), [tx, tz] = at(ta, gb), [kx, kz] = at(-DP / 2, SP / 2);
        beacon(tx, ty, tz, r);
        stringLights([tx, ty - 1, tz], [kx, TOP + 1, kz], 2.5, 14, [1.3, .7, .3]);
        return { face: [fr.x, fr.z] };
      },
    },

    // Florine Ojeda Bank: a dead bank built to shrug off rockets, now a 14K hideout. A barricaded portico, a
    // walled side entrance, sentry turrets with searchlights over a razor-wire kill zone, cameras on every
    // edge and a red 14K band round the podium and the crown.

    gye_ojeda: {
      at: [1192, 1578], label: 'Florine Ojeda Bank', minSide: 44, reach: 360, labelY: 100,
      build(x, z, w, d, st, r) {
        const fr0 = T.front(), SPAN0 = fr0.x ? d : w, DEEP0 = fr0.x ? w : d;
        const SP = Math.min(SPAN0 - 14, 62), DP = Math.min(DEEP0 - 22, 42), off = Math.max(0, (DEEP0 - DP) / 2 - 4);
        x -= fr0.x * off; z -= fr0.z * off;
        const F = facing(x, z), { at, sz, yaw, fr } = F, G = (DEEP0 - DP) / 2 + off;
        const S = T.tone(st, .3, 1), STONE = { ...S, base: [.16, .145, .13], lit: .05, grime: .8, win: [1, .7, .4] };
        const COL = [.17, .155, .14], DARK = [.07, .065, .06], METAL = [.09, .09, .1], WIRE = [.34, .34, .36], RED14 = [1.7, .12, .1];
        const [bw, bd] = sz(DP, SP);

        // Podium, cornice and the red band.

        bld(x, z, bw, bd, 16, STONE, r, { roof: false, skin: SKINS.bands, ry: NOK });
        F.box(0, 0, 16.4, DP + 1, .8, SP + 1, DARK);
        F.lit(0, 0, 15.6, DP + .3, .5, SP + .3, RED14);

        // Portico: columns with steel plates bolted between them, an attic with the old name.

        const nc = 8, pitch = SP * .8 / (nc - 1);
        for (let k = 0; k < nc; k++) {
          const b = -SP * .4 + k * pitch;
          F.box(DP / 2 + 4, b, 7, 1.8, 14, 1.8, COL, 'cyl');
          if (k < nc - 1) F.box(DP / 2 + 4, b + pitch / 2, 5.5, .6, 11, pitch - 2.2, METAL);
        }
        F.box(DP / 2 + 2.5, 0, 14.8, 5.5, 2.4, SP * .9, COL);
        F.box(DP / 2 + 2.5, 0, 18.5, 5.5, 5, SP * .9, DARK);
        { const [px, pz] = at(DP / 2 + 5.3, 0), tw = Math.min(SP * .7, 26); textSign('BANCO FLORINE OJEDA', px, 18.5, pz, tw, tw / 4, yaw, dim(GOLD, .5)); }

        // Slit-windowed tower with red corner lines, a red crown band and the 14K mark.

        bld(x, z, ...sz(DP * .62, SP * .5), 66, { ...STONE, lit: .04 }, r, { y0: 16, roof: false, skin: SKINS.fins, ry: NOK });
        F.box(0, 0, 83, DP * .66, 2, SP * .54, DARK);
        F.lit(0, 0, 81, DP * .62 + .3, .6, SP * .5 + .3, RED14);
        for (const sa of [-1, 1]) for (const sb of [-1, 1]) F.lit(sa * (DP * .31 + .1), sb * (SP * .25 + .1), 49, .3, 64, .3, dim(RED14, .6));
        { const [px, pz] = at(DP * .31 + .3, 0); textSign('14K', px, 70, pz, SP * .6, SP * .15, yaw, [1.8, .15, .1]); }

        // Sentry turrets on the podium corners. The two street-side ones throw searchlights onto the kill zone.

        for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
          const a = sa * (DP / 2 - 2), b = sb * (SP / 2 - 2), [px, pz] = at(a, b);
          const dx = fr.x * sa - fr.z * sb, dz = fr.z * sa + fr.x * sb, L = Math.hypot(dx, dz);
          prop('box', px, 17.8, pz, 2.4, 2, 2.4, METAL);
          prop('cyl', px + dx / L * 1.7, 18.4, pz + dz / L * 1.7, .5, 3.4, .5, [.12, .12, .13], Math.atan2(dx, dz), Math.PI / 2);
          glow(px + dx / L * 1.25, 19, pz + dz / L * 1.25, .3, .3, .3, RED14);
          if (sa > 0) searchlight(px, 18.6, pz, fr.x + dx / L * .4, fr.z + dz / L * .4, .62);
        }

        // Kill zone: two rows of razor wire, jersey barriers and burned-out cars.

        for (const f of [.4, .75]) {
          const a = DP / 2 + 6 + (G - 7) * f;
          if (a > DP / 2 + G - 1.5) continue;
          for (let k = 0; k < 3; k++) { const [px, pz] = at(a, (k - 1) * SP * .32); prop('cyl', px, .7, pz, 1.3, SP * .3, 1.3, WIRE, yaw + Math.PI / 2, Math.PI / 2); }
        }
        for (let k = 0; k < 8; k++) F.box(DP / 2 + 6 + r() * Math.max(1, G - 9), (r() - .5) * SP, .55, .8, 1.1, 3, [.15, .145, .13]);
        for (let k = 0; k < 2; k++) {
          const [px, pz] = at(DP / 2 + 7 + r() * Math.max(1, G - 10), (k ? 1 : -1) * SP * (.15 + .2 * r()));
          prop('box', px, .8, pz, 2, 1.5, 4.6, [.05, .045, .04], r() * 3);
          puff(px, 3, pz, 2.5, SMOG);
        }

        // Walled side entrance with its own wire, a turret and an amber door.

        const SB = SP / 2;
        F.box(0, SB + 7, 3, 14, 6, .8, CONC);
        for (const s of [-1, 1]) F.box(s * 7, SB + 3.5, 3, .8, 6, 7, CONC);
        { const [px, pz] = at(0, SB + 7); prop('cyl', px, 6.6, pz, .9, 14, .9, WIRE, yaw, Math.PI / 2); }
        F.lit(0, SB + .1, 2.4, 4, 4.5, .1, [1.3, .75, .3]);
        { const [px, pz] = at(6.5, SB + 6.5); prop('box', px, 7.2, pz, 1.6, 1.6, 1.6, METAL); glow(px, 7.6, pz, .3, .3, .3, RED14); }

        // Cameras on every podium and crown edge.

        for (let k = 0; k < 12; k++) {
          const n = FACES[k % 4], y = k < 8 ? 15 : 80, [cw, cd] = k < 8 ? [bw, bd] : sz(DP * .62, SP * .5);
          const half = (n[0] ? cw : cd) / 2 + .5, along = (r() - .5) * (n[0] ? cd : cw) * .8;
          const px = x + n[0] * half - n[1] * along, pz = z + n[1] * half + n[0] * along;
          prop('box', px, y, pz, .6, .4, .6, METAL);
          glow(px + n[0] * .32, y, pz + n[1] * .32, .15, .15, .15, RED14);
        }
        return { face: [fr.x, fr.z] };
      },
    },

    // More sights live in gye-nuevo.js, gye-water.js and gye-antiguo.js. They share this file's tools.

    ...nuevoSights(G), ...waterSights(G), ...antiguoSights(G),
  };
}
