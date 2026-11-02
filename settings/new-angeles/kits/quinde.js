// Quinde: the factory floor. Sheds, container tenements, fusion plants and freight under sodium and floodlight.
// Lot kits read H.frame() and fall back to an s × s square. Sub-areas tint the work:
// The Meat Market goes clean white and Jinteki red, Golem Grove steel blue, Colonche dark and run-down.

const SODIUM = [1.3, .62, .16], FLOOD = [1.25, 1.2, 1.05], COLD = [.95, 1.1, 1.35], HAZARD = [1.6, 1.1, .1], ORANGE = [1.5, .45, .08];
const JRED = [1.4, .12, .1], JGREEN = [.4, 1.4, .3], WARM = [1.1, .72, .38], RED = [1.4, .1, .05];
const DARK = [.05, .05, .05], CONCRETE = [.11, .105, .1], RUSTY = [.13, .07, .04];
const CONT = [[.24, .07, .04], [.05, .11, .2], [.22, .15, .04], [.06, .14, .08], [.17, .17, .16], [.25, .11, .03], [.12, .05, .1]];
const CLOTH = [[.3, .08, .06], [.06, .12, .3], [.3, .28, .22], [.25, .2, .05], [.1, .25, .15]];

const AREAS = {
  'The Meat Market': { shell: [.34, .33, .32], trim: JRED, flood: FLOOD, win: [1, .95, .9], dark: 1 },
  'Golem Grove': { shell: [.1, .13, .18], trim: [.35, .75, 1.5], flood: COLD, win: [.8, .9, 1.05], dark: 1 },
  Colonche: { shell: [.09, .075, .06], trim: [.7, .35, .08], flood: [.8, .38, .1], win: [1, .62, .3], dark: .45 },
};
const PLAIN = { shell: [.13, .11, .09], trim: HAZARD, flood: SODIUM, win: null, dark: 1 };

const pick = (r, a) => a[Math.floor(r() * a.length)];
const dim = (rgb, f) => rgb.map(c => c * f);

export function kits(H) { return lotKits(H).kits; }

// Shared pieces for lots, blocks and landmarks.

function lotKits(H) {
  const { GLOWS, SKINS, beacon, beam, bld, glow, lerp, pool, prop, puff, put, textSign } = H;

  // A local point to world, through the current frame.

  const toWorld = (x, z) => {
    const f = H.frame();
    if (!f) return [x, z];
    const dx = x - f.cx, dz = z - f.cz;
    return [(f.tx ?? f.cx) + dx * f.c + dz * f.s, (f.tz ?? f.cz) - dx * f.s + dz * f.c];
  };
  const flavor = (x, z) => AREAS[H.subareaAt(...toWorld(x, z))] ?? PLAIN;
  const look = (st, fl, lit, shell = fl.shell) => ({ ...st, base: shell, win: fl.win ?? st.win, lit });
  const dims = (s, cap = 70) => { const f = H.frame(); return f?.w ? [Math.min(f.w - 2, cap), Math.min(f.d - 2, cap)] : [s, s]; };

  // The lot front snapped to a local axis. u runs along the front, v toward it.

  const frontAxis = () => {
    const f = H.frame()?.front;
    if (!f) return [0, 1];
    return Math.abs(f.x) > Math.abs(f.z) ? [Math.sign(f.x), 0] : [0, Math.sign(f.z)];
  };
  const uvFrame = (x, z, W, D, F = frontAxis()) => {
    const [fx, fz] = F, ax = -fz, az = fx;
    const P = (u, v) => [x + u * ax + v * fx, z + u * az + v * fz];
    const S = (su, sv) => fz ? [su, sv] : [sv, su];
    return {
      U: fz ? W : D, V: fz ? D : W, P, ry: Math.atan2(fx, fz),
      box: (u, y, v, su, sy, sv, rgb, kind = 'box') => { const [px, pz] = P(u, v), [sx, sz] = S(su, sv); return prop(kind, px, y, pz, sx, sy, sz, rgb); },
      gl: (u, y, v, su, sy, sv, rgb) => { const [px, pz] = P(u, v), [sx, sz] = S(su, sv); return glow(px, y, pz, sx, sy, sz, rgb); },
      vol: (u, v, su, sv, h, st, r, o) => { const [px, pz] = P(u, v), [sx, sz] = S(su, sv); bld(px, pz, sx, sz, h, st, r, o); },
      pool: (u, v, rad, rgb) => { const [px, pz] = P(u, v); pool(px, pz, rad, rgb); },
      sign: (text, u, y, v, w, h, rgb, back = false) => { const [px, pz] = P(u, v); textSign(text, px, y, pz, w, h, Math.atan2(fx, fz) + (back ? Math.PI : 0), rgb); },
    };
  };

  // Floodlight mast with a lamp bar and a light pool where it points.

  const mast = (x, z, h, rgb, r, aim = [0, 0]) => {
    prop('box', x, h / 2, z, .45, h, .45, DARK);
    prop('box', x, h, z, 3.2, .3, .6, DARK);
    glow(x, h - .35, z, 3, .6, 1, rgb);
    pool(x + aim[0] * h * .3, z + aim[1] * h * .3, h * .6, dim(rgb, .1));
  };

  // Pipe between two points at one height.

  const pipe = (x0, z0, x1, z1, y, dia, rgb) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    prop('cyl', (x0 + x1) / 2, y, (z0 + z1) / 2, dia, len, dia, rgb, Math.atan2(x1 - x0, z1 - z0), Math.PI / 2);
  };

  // Chimney with red bands, a hot rim and a steam plume.

  const stack = (x, z, rad, h, r, hot = true) => {
    prop('cyl', x, h / 2, z, rad * 2, h, rad * 2, dim(RUSTY, .8 + .5 * r()));
    put(GLOWS.ring, x, h * .78, z, rad * 2.2, 1, rad * 2.2, 0, 0, dim(RED, .7));
    if (hot) glow(x, h + .2, z, rad * 2, .4, rad * 2, [1.1, .42, .1]);
    beacon(x, h + 1, z, r);
    if (hot) for (let k = 0; k < 3; k++) puff(x + k * rad * .9, h + rad * (1 + k * 1.3), z, rad * (1.1 + k * .6), [.1, .095, .09]);
  };

  // Truck: trailer, cab, tail lights and headlights along heading ry.

  const truck = (x, z, ry, r) => {
    const sx = Math.sin(ry), sz = Math.cos(ry);
    prop('box', x, 2.1, z, 2.5, 3.6, 12.5, pick(r, CONT), ry);
    prop('box', x + sx * 7.6, 1.7, z + sz * 7.6, 2.5, 2.8, 2.6, pick(r, CONT), ry);
    glow(x - sx * 6.3, 1, z - sz * 6.3, 2.2, .2, .2, [1.3, .06, .03]);
    glow(x + sx * 8.95, 1.2, z + sz * 8.95, 2, .25, .2, [1.3, 1.2, .9]);
  };

  // A standing figure. Bioroids read pale, workers dark.

  const fig = (x, z, rgb = [.06, .055, .05]) => prop('box', x, .85, z, .5, 1.7, .45, rgb);

  // A thin line with clothes hung on it.

  const laundry = (a, c, r) => {
    beam(a, c, .06, [.06, .06, .06]);
    for (let k = 1 + Math.floor(r() * 3); k > 0; k--) {
      const t = .15 + r() * .7;
      prop('box', lerp(a[0], c[0], t), lerp(a[1], c[1], t) - .45, lerp(a[2], c[2], t), .7, .8, .7, pick(r, CLOTH), Math.atan2(c[0] - a[0], c[2] - a[2]));
    }
  };

  // Clad shed in the uv frame: body, roof ridge, eave strip, and lit doors on the front face.

  const shed = (T, u, v, su, sv, h, fl, r, doors = 1) => {
    const c = fl.shell.map(c => c * (.8 + .4 * r()));
    T.box(u, h / 2, v, su, h, sv, c);
    T.box(u, h + .5, v, su * .94, 1, Math.min(sv * .25, 5), dim(c, .7));
    T.gl(u, h * .85, v + sv / 2 + .06, su * .9, .4, .1, dim(fl.win ?? WARM, .35 * fl.dark));
    for (let k = 0; k < doors; k++) {
      const du = u + (doors > 1 ? (k / (doors - 1) - .5) * su * .6 : 0), dw = Math.min(5, su * .3);
      const lit = r() < .8 * fl.dark;
      T.gl(du, 2.4, v + sv / 2 + .07, dw, 4, .1, lit ? dim(fl.win ?? WARM, .75) : [.05, .045, .04]);
      T.gl(du, 4.7, v + sv / 2 + .1, dw + .6, .25, .1, dim(fl.trim, .5));
      if (lit) T.pool(du, v + sv / 2 + 3, 5, dim(fl.win ?? WARM, .07));
    }
  };

  // Container tenement tower. Stacked core blocks in container colours, containers cantilevered off every face,
  // galleries on the front, a stair cage on one side, laundry and a roof floodlight.

  const ctower = (x, z, W, D, h, st, r, F) => {
    const T = uvFrame(x, z, W, D, F), fl = flavor(x, z), cu = Math.max(4, (T.U - 7) / 2), cv = Math.max(3, (T.V - 6) / 2);
    const levels = Math.min(18, Math.max(4, Math.round(h / 2.6)));
    h = levels * 2.6;
    let y = 0;
    while (y < h - .1) {
      const th = Math.min(h - y, 2.6 * (3 + Math.floor(r() * 4)));
      T.vol((r() - .5) * 1.5, (r() - .5) * 1.5, cu * 2, cv * 2, th, look(st, fl, (.3 + .3 * r()) * fl.dark, pick(r, CONT)), r, { y0: y, roof: false, skin: SKINS.grid });
      y += th;
    }
    const decks = [];
    for (let k = 0; k < levels; k++) {
      const ly = k * 2.6 + 1.3;
      if (k % 3 === 1) {
        T.box(0, ly - 1.2, cv + 1, cu * 2 + 2, .25, 2, DARK);
        T.gl(0, ly - 1.4, cv + 1.9, cu * 2, .12, .1, dim(SODIUM, .45 * fl.dark));
        decks.push(ly);
      } else if (r() < .65) {
        const u = (r() - .5) * cu;
        T.box(u, ly, cv + 1, 12.2, 2.6, 2.4, pick(r, CONT));
        if (r() < .6) T.gl(u + (r() - .5) * 8, ly, cv + 2.25, 1.4, 1, .1, dim(fl.win ?? WARM, .8 * fl.dark));
      }
      if (r() < .45) {
        const s = r() < .5 ? -1 : 1, v = (r() - .5) * cv;
        T.box(s * (cu + 3), ly, v, 12.2, 2.6, 2.4, pick(r, CONT));
        if (r() < .5) T.gl(s * (cu + 9.15), ly, v, .1, 1, 1.4, dim(fl.win ?? WARM, .8 * fl.dark));
      }
    }

    // Stair cage with sodium landings every two floors.

    const [sx, sz] = T.P(-(cu + 2), cv - 1);
    prop('lattice', sx, h / 2, sz, 3, h, 3);
    for (let ly = 5.2; ly < h; ly += 5.2) { const [lx, lz] = T.P(-(cu + 2), cv + .6); glow(lx, ly, lz, .5, .3, .5, dim(SODIUM, .8 * fl.dark)); }
    for (let k = 0; k + 1 < decks.length && k < 2; k++) {
      const a = T.P(-cu + 2 + r() * cu, cv + 2), c = T.P(cu - 2 - r() * cu, cv + 2);
      laundry([a[0], decks[k] + 1.6, a[1]], [c[0], decks[k + 1] - .4, c[1]], r);
    }

    // Roof: tanks, a mast with a beacon, and a floodlight bar washing the front.

    for (let k = 0; k < 2; k++) T.box((r() - .5) * cu, h + 1.2, (r() - .5) * cv, 2.2, 2.4, 2.2, pick(r, CONT), 'cyl');
    const [mx, mz] = T.P(cu * .6, -cv * .5);
    prop('cyl', mx, h + 5, mz, .3, 10, .3, DARK);
    beacon(mx, h + 10.3, mz, r);
    T.gl(0, h + .6, cv + .4, cu, .4, .4, dim(fl.flood, .9 * fl.dark));
    T.pool(0, cv + 6, 9, dim(fl.flood, .06 * fl.dark));
    return h;
  };

  // Clean corporate shed: white walls, a red band, white floodlight. Jinteki copy-center look.

  const cleanshed = (x, z, s, st, b, r) => {
    const [W, D] = dims(s), T = uvFrame(x, z, W, D), fl = AREAS['The Meat Market'];
    T.box(0, .1, 0, W, .2, D, [.06, .06, .065]);
    const su = T.U - 4, sv = T.V * .62, h = (9 + r() * 7) * Math.min(b, 1.4), v = -T.V / 2 + 2 + sv / 2;
    T.box(0, h / 2, v, su, h, sv, [.38, .37, .36]);
    T.gl(0, h - 1.2, v + sv / 2 + .06, su, .9, .1, dim(JRED, .85));
    T.gl(0, h - 1.2, v - sv / 2 - .06, su, .9, .1, dim(JRED, .6));
    for (const s of [-1, 1]) T.gl(s * (su / 2 + .06), h - 1.2, v, .1, .9, sv, dim(JRED, .6));
    T.gl(0, h * .5, v + sv / 2 + .06, su * .8, h * .25, .1, [.75, .78, .8]);
    T.gl(0, 1.6, v + sv / 2 + .07, Math.min(8, su * .4), 3.2, .1, [1.05, 1.05, 1.1]);
    T.sign(r() < .5 ? 'JINTEKI' : 'COPY CENTER', 0, h + 1.6, v + sv / 2, Math.min(14, su * .6), 3, [1.3, .2, .15]);
    for (let k = 0; k < 3; k++) T.box((k - 1) * su * .3, h + .7, v, 2.4, 1.4, 2, [.3, .3, .3]);
    for (const s of [-1, 1]) {
      const [px, pz] = T.P(s * (T.U / 2 - 1.5), T.V / 2 - 2);
      mast(px, pz, 12 + r() * 4, FLOOD, r);
    }
    if (r() < .5) for (let k = 0; k < 4; k++) fig(...T.P((r() - .5) * su * .5, v + sv / 2 + 2 + r() * 3), [.16, .15, .15]);
  };

  // Hardtech plant: steel-blue sawtooth shed with a cold clerestory, HVAC boxes and bioroids at the door.

  const hardworks = (x, z, s, st, b, r) => {
    const [W, D] = dims(s), T = uvFrame(x, z, W, D), fl = AREAS['Golem Grove'];
    T.box(0, .1, 0, W, .2, D, [.045, .05, .06]);
    const su = T.U - 3, sv = T.V * .7, h = (8 + r() * 6) * Math.min(b, 1.4), v = -T.V / 2 + 1.5 + sv / 2;
    T.box(0, h / 2, v, su, h, sv, [.1, .12, .16]);
    const teeth = Math.max(2, Math.min(6, Math.floor(sv / 6))), tw = sv / teeth;
    for (let k = 0; k < teeth; k++) {
      const tv = v - sv / 2 + (k + .5) * tw, [px, pz] = T.P(0, tv);
      prop('box', px, h + tw * .22, pz, su, .3, tw * 1.05, [.09, .1, .13], T.ry, .45);
      T.gl(0, h + tw * .3, tv + tw * .45, su * .95, tw * .3, .1, dim(COLD, .35));
    }
    T.gl(0, 2.2, v + sv / 2 + .07, Math.min(7, su * .35), 3.6, .1, dim(COLD, .9));
    T.sign('HB', su * .35, h * .6, v + sv / 2 + .1, 4, 2.4, [.5, .9, 1.5]);
    for (let k = 0; k < 2; k++) T.box((r() - .5) * su * .6, .9, T.V / 2 - 3, 3, 1.8, 2, [.08, .09, .11]);
    const [mx, mz] = T.P(su / 2 - 1, T.V / 2 - 1.5);
    mast(mx, mz, 13 + r() * 5, COLD, r);
    for (let k = 0; k < 3 + Math.floor(r() * 4); k++) fig(...T.P((r() - .5) * su * .4, v + sv / 2 + 1.5 + r() * 4), [.42, .46, .52]);
  };

  // Small factory lot: two or three sheds, a yard of crates, one stack and a floodlight.

  const smallworks = (x, z, s, st, b, r) => {
    const area = H.subareaAt(...toWorld(x, z));
    if (area === 'The Meat Market' && r() < .45) return cleanshed(x, z, s, st, b, r);
    if (area === 'Golem Grove' && r() < .45) return hardworks(x, z, s, st, b, r);
    const [W, D] = dims(s), T = uvFrame(x, z, W, D), fl = flavor(x, z);
    T.box(0, .1, 0, W, .2, D, [.035, .032, .03]);
    const n = Math.max(1, Math.min(3, Math.floor(T.U / 11))), cw = T.U / n;
    for (let k = 0; k < n; k++) {
      const sv = T.V * (.45 + .3 * r()), h = (6 + r() * 7) * Math.min(b, 1.5);
      shed(T, -T.U / 2 + (k + .5) * cw, -T.V / 2 + 1 + sv / 2, cw - 1.6, sv, h, fl, r);
    }
    for (let k = 2 + Math.floor(r() * 4); k > 0; k--) T.box((r() - .5) * (T.U - 4), .7, T.V / 2 - 2 - r() * T.V * .2, 1.4 + r() * 2, 1.4, 1.2 + r(), pick(r, CONT));
    if (r() < .7) { const [px, pz] = T.P(T.U / 2 - 2.5, -T.V / 2 + 2.5); stack(px, pz, .9 + r() * .5, 16 + r() * 14, r, fl.dark > .5); }
    if (r() < .8 * fl.dark + .1) { const [px, pz] = T.P(-T.U / 2 + 1.5, T.V / 2 - 1.5); mast(px, pz, 10 + r() * 6, fl.flood, r, [.5, .5]); }
    if (r() < .5) truck(...T.P((r() - .5) * T.U * .3, T.V / 2 - 3), T.ry + Math.PI / 2, r);
  };

  return {
    toWorld, flavor, look, dims, uvFrame, mast, pipe, stack, truck, fig, laundry, shed, ctower,
    kits: {
      qui_smallworks: smallworks,
      qui_cleanshed: cleanshed,
      qui_hardworks: hardworks,

      // Labour hall: bare concrete warehouse, one lit doorway and a queue of the jobless outside.

      qui_laborhall(x, z, s, st, b, r) {
        const [W, D] = dims(s), T = uvFrame(x, z, W, D), fl = flavor(x, z);
        const su = T.U - 3, sv = T.V * .6, h = 9 + r() * 4, v = -T.V / 2 + 1.5 + sv / 2;
        T.box(0, h / 2, v, su, h, sv, CONCRETE.map(c => c * (.8 + .4 * r())));
        for (let k = 0; k < 4; k++) T.gl((k - 1.5) * su * .22, h * .75, v + sv / 2 + .06, su * .12, .6, .1, dim(WARM, .3));
        T.gl(0, 2.2, v + sv / 2 + .07, 3, 3.8, .1, [1.25, 1.05, .8]);
        T.gl(0, 4.6, v + sv / 2 + .4, 4, .2, .8, dim(HAZARD, .5));
        T.sign(`LABOR HALL ${1 + Math.floor(r() * 12)}`, 0, 5.8, v + sv / 2 + .12, 9, 1.6, [1.2, 1, .6]);
        T.pool(0, v + sv / 2 + 4, 7, dim(WARM, .1));
        let u = 1.5, w = v + sv / 2 + 1.2;
        for (let k = 8 + Math.floor(r() * 12); k > 0; k--) {
          fig(...T.P(u, w));
          u += .8 + r() * .4;
          if (u > su / 2 - 1) { u = su / 2 - 1; w += 1.2; }
        }
        const [lx, lz] = T.P(-su / 2 + 1, T.V / 2 - 1);
        prop('box', lx, 4, lz, .3, 8, .3, DARK);
        glow(lx, 8, lz, .9, .35, .9, SODIUM);
        pool(lx, lz, 5, dim(SODIUM, .08));
      },

      // Container tenement: a high-rise of shipping containers.

      qui_containerstack(x, z, s, st, b, r) {
        const [W, D] = dims(s, 40);
        ctower(x, z, Math.max(14, W), Math.max(12, D), (14 + r() * st.h1 * 1.3) * Math.min(b, 1.7), st, r);
      },

      // Workers' tenement: a numbered slab with galleries, stair towers, laundry and roof tanks.

      qui_tenement(x, z, s, st, b, r) {
        const [W, D] = dims(s, 56), T = uvFrame(x, z, W, D), fl = flavor(x, z);
        const su = T.U - 3, sv = Math.min(T.V - 6, 10 + r() * 8), h = (14 + r() * st.h1 * .9) * Math.min(b, 1.6), v = -T.V / 2 + 1 + sv / 2;
        T.vol(0, v, su, sv, h, look(st, fl, (.35 + .25 * r()) * fl.dark, fl.shell.map(c => c * 1.2)), r, { roof: false, skin: SKINS.grid });
        for (let y = 6; y < h - 2; y += 6) {
          T.box(0, y, v + sv / 2 + 1, su + 1, .3, 2, DARK);
          T.gl(0, y - .25, v + sv / 2 + 1.95, su * .95, .1, .1, dim(SODIUM, .35 * fl.dark));
        }
        for (const s of [-1, 1]) {
          T.vol(s * (su / 2 + 2), v + sv / 2 - 2, 4, 4, h + 3, look(st, fl, .6 * fl.dark, CONCRETE), r, { roof: false, skin: SKINS.sparse });
          T.gl(s * (su / 2 + 2), h / 2, v + sv / 2 + .06, .8, h - 2, .1, dim(SODIUM, .5 * fl.dark));
        }
        const n = 1 + Math.floor(r() * 48);
        T.sign(`BLOCK ${n}`, 0, h - 2.5, v + sv / 2 + .1, Math.min(16, su * .5), 3.4, dim(FLOOD, .8));
        for (let k = Math.min(3, Math.floor(h / 6) - 1); k > 0; k--) {
          const y = 6 * k + 1.5, a = T.P(-su / 2 + 1 + r() * 4, v + sv / 2 + 1.8), c = T.P(su / 2 - 1 - r() * 4, v + sv / 2 + 1.8);
          laundry([a[0], y, a[1]], [c[0], y - .3, c[1]], r);
        }
        for (let k = 0; k < 3; k++) T.box((k - 1) * su * .3, h + 1.5, v, 2.4, 3, 2.4, [.1, .08, .06], 'cyl');
        T.pool(0, T.V / 2 - 2, 8, dim(SODIUM, .07 * fl.dark));
      },

      // Fusion cell: one He-3 dome with ring lights, a small cooling tower and a fenced switchyard.

      qui_fusioncell(x, z, s, st, b, r) {
        const [W, D] = dims(s), T = uvFrame(x, z, W, D), fl = flavor(x, z);
        T.box(0, .1, 0, W, .2, D, [.04, .038, .036]);
        const R = Math.min(T.U, T.V) * .22, [dx, dz] = T.P(-T.U * .18, -T.V * .12), hh = R * .8;
        prop('cyl', dx, hh / 2, dz, R * 2, hh, R * 2, [.17, .17, .18]);
        prop('dish', dx, hh + R * .2, dz, R * 2, R, R * 2, [.2, .2, .21], 0, Math.PI);
        put(GLOWS.ring, dx, hh * .98, dz, R * 2.04, 1, R * 2.04, 0, 0, dim(COLD, .75));
        put(GLOWS.ring, dx, 2, dz, R * 2.04, 1, R * 2.04, 0, 0, dim(ORANGE, .5));
        glow(dx, hh + R * .62, dz, 1, .5, 1, dim(COLD, .9));
        const [cx, cz] = T.P(T.U * .26, -T.V * .2), cR = Math.min(T.U, T.V) * .14, ch = cR * 3.4;
        for (let i = 0; i < 7; i++) {
          const t = (i + .5) / 7, rr = cR * (.65 + .35 * Math.abs(t - .7) / .7);
          prop('cyl', cx, t * ch, cz, rr * 2, ch / 7 + .05, rr * 2, dim([.2, .19, .18], .75 + .35 * t));
        }
        put(GLOWS.ring, cx, ch, cz, cR * 1.4, 1, cR * 1.4, 0, 0, [.5, .22, .06]);
        for (let k = 0; k < 3; k++) puff(cx + k * cR * .5, ch + cR * (.6 + k), cz, cR * (.6 + k * .35), [.11, .105, .1]);
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) T.box((i - 1) * T.U * .22, 1.2, T.V * .28 + j * 3.5, 2.2, 2.4, 2, [.1, .11, .1]);
        const [px, pz] = T.P(T.U * .38, T.V * .3);
        prop('lattice', px, 7, pz, 2.5, 14, 2.5);
        pipe(dx + R, dz, px, pz, 4, .7, [.12, .1, .08]);
        mast(...T.P(-T.U / 2 + 1.5, T.V / 2 - 1.5), 14 + r() * 4, fl.flood, r, [.5, -.5]);
        beacon(cx, ch + .6, cz, r);
      },

      // Freight yard: container stacks, a gantry crane over a truck lane, and floodlights.

      qui_freightyard(x, z, s, st, b, r) {
        const [W, D] = dims(s), T = uvFrame(x, z, W, D), fl = flavor(x, z);
        T.box(0, .1, 0, W, .2, D, [.045, .042, .04]);
        const rows = Math.max(1, Math.min(4, Math.floor((T.V - 8) / 3))), cols = Math.max(1, Math.floor((T.U - 4) / 13));
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
          if (r() < .15) continue;
          const tiers = 1 + Math.floor(r() * 4), u = -T.U / 2 + 2 + (i + .5) * 13, v = -T.V / 2 + 2 + (j + .5) * 2.8;
          for (let t = 0; t < tiers; t++) T.box(u, 1.3 + t * 2.6, v, 12.2, 2.5, 2.4, pick(r, CONT));
        }
        const gv = -T.V / 2 + 2 + rows * 1.4, gh = 4 + 2.6 * 4.5, span = rows * 2.8 + 8;
        const gu = (r() - .5) * T.U * .4;
        for (const s of [-1, 1]) for (const t of [-1, 1]) T.box(gu + s * 5, gh / 2, gv + t * span / 2, .8, gh, .8, dim(HAZARD, .12));
        for (const s of [-1, 1]) T.box(gu + s * 5, gh, gv, .9, 1.2, span + 1, dim(HAZARD, .14));
        T.box(gu, gh - 1, gv + span * .2, 10.6, 1.4, 3, [.12, .1, .05]);
        T.gl(gu, gh - 1.9, gv + span * .2, 8, .2, 1.2, dim(FLOOD, .9));
        T.pool(gu, gv + span * .2, 9, dim(FLOOD, .08));
        for (let k = 1 + Math.floor(r() * 3); k > 0; k--) truck(...T.P((r() - .5) * (T.U - 16), T.V / 2 - 3.5), T.ry + Math.PI / 2, r);
        for (const s of [-1, 1]) mast(...T.P(s * (T.U / 2 - 1.5), T.V / 2 - 1), 16 + r() * 6, fl.flood, r, [0, -.6]);
      },

      // Runoff canal: concrete channel of glowing sludge, pipe outfalls, a pump house.

      qui_runoff(x, z, s, st, b, r) {
        const [W, D] = dims(s), T = uvFrame(x, z, W, D), fl = flavor(x, z);
        const cw = Math.min(10, T.V * .4), v = (r() - .5) * T.V * .2;
        T.box(0, .1, 0, W, .2, D, [.035, .033, .03]);
        T.gl(0, .2, v, T.U, .1, cw - 1, [.07, .2, .04]);
        for (const s of [-1, 1]) T.box(0, .7, v + s * cw / 2, T.U, 1.4, .6, CONCRETE);
        for (let k = 2 + Math.floor(r() * 3); k > 0; k--) {
          const u = (r() - .5) * (T.U - 4), s = r() < .5 ? -1 : 1, [px, pz] = T.P(u, v + s * (cw / 2 + .3));
          prop('cyl', px, 1.6, pz, 1.2, 1.4, 1.2, [.1, .09, .07], 0, Math.PI / 2);
          T.gl(u, .9, v + s * (cw / 2 - .4), .6, 1.4, .3, dim(JGREEN, .3));
          puff(px, 1.6, pz, 1.5, [.06, .09, .05]);
        }
        T.box(0, 1.3, v + cw / 2 + 2.2, T.U, 2.6, .1, [.07, .065, .06]);
        const pv = -T.V / 2 + 3;
        shed(T, -T.U * .25, pv, Math.min(12, T.U * .4), 5, 5, fl, r);
        const [lx, lz] = T.P(T.U * .3, v + cw / 2 + 1);
        prop('box', lx, 3.5, lz, .3, 7, .3, DARK);
        glow(lx, 7, lz, .9, .35, .9, SODIUM);
        pool(lx, lz, 6, [.05, .1, .03]);
      },
    },
  };
}

export const tiers = {
  quinde: {
    0: ['qui_smallworks', 'qui_smallworks', 'qui_laborhall', 'qui_freightyard', 'qui_runoff', 'qui_hardworks'],
    1: ['qui_smallworks', 'qui_containerstack', 'qui_tenement', 'qui_fusioncell', 'qui_freightyard', 'qui_cleanshed'],
    2: ['qui_containerstack', 'qui_containerstack', 'qui_tenement', 'qui_tenement', 'qui_fusioncell'],
  },
};

// Block builders. Each gets the block frame (x, z, w, d) and may swap to the builder that suits its sub-area.

function blockBuilders(H) {
  const L = lotKits(H), { GLOWS, SKINS, beacon, beam, bld, glow, pool, prop, puff, put, textSign } = H;
  const { uvFrame, mast, pipe, stack, truck, fig, flavor } = L;

  // Ground slab, fence with a light every 22 m, and corner masts.

  const site = (T, fl, r, rgb = [.032, .03, .028]) => {
    T.box(0, .1, 0, T.U, .2, T.V, rgb);
    for (const s of [-1, 1]) {
      T.box(0, 1.2, s * T.V / 2, T.U, 2.4, .1, [.07, .065, .06]);
      T.box(s * T.U / 2, 1.2, 0, .1, 2.4, T.V, [.07, .065, .06]);
      for (let t = -T.U / 2 + 10; t < T.U / 2; t += 22) T.gl(t, 2.8, s * T.V / 2, .3, .2, .3, dim(fl.flood, .7));
    }
    for (const [su, sv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) if (r() < .75) mast(...T.P(su * (T.U / 2 - 2), sv * (T.V / 2 - 2)), 22 + r() * 12, fl.flood, r, [-su * .6, -sv * .6]);
  };

  // Hyperbolic cooling tower.

  const cooler = (x, z, R, h, r) => {
    const N = 10;
    for (let i = 0; i < N; i++) {
      const t = (i + .5) / N, rr = R * (.62 + .38 * Math.abs(t - .7) ** 1.3 / .7 ** 1.3);
      prop('cyl', x, t * h, z, rr * 2, h / N + .05, rr * 2, [.19, .18, .17].map(v => v * (.75 + .35 * t)));
    }
    put(GLOWS.ring, x, h, z, R * 1.64, 1, R * 1.64, 0, 0, [.6, .25, .07]);
    put(GLOWS.ring, x, 2, z, R * 2.02, 1, R * 2.02, 0, 0, dim(SODIUM, .5));
    beacon(x + R * .8, h + .6, z, r);
    for (let k = 0; k < 4; k++) puff(x + k * R * .3, h + R * (.3 + k * .45), z, R * (.35 + k * .2), [.12, .115, .11]);
  };

  // Womb hall: one vast white shed with twelve lit production floors, a red band,
  // tank conveyors to side buildings, recycling tanks and truck docks.

  const wombhall = (x, z, w, d, st, r, big = false) => {
    const T = uvFrame(x, z, w, d), fl = AREAS['The Meat Market'];
    site(T, fl, r, [.05, .05, .052]);
    const su = T.U * (big ? .78 : .66), sv = T.V * (big ? .6 : .55), h = big ? 82 + r() * 12 : 44 + r() * 14, v = -T.V / 2 + 4 + sv / 2;
    T.vol(0, v, su, sv, h, { ...st, base: [.36, .35, .345], win: [1, .9, .85], lit: .08, grime: .2 }, r, { roof: false, skin: SKINS.bands });
    for (let k = 1; k <= 12; k++) {
      const y = h * k / 13.2;
      T.gl(0, y, v + sv / 2 + .08, su * .94, .4, .1, [.62, .4, .32]);
      T.gl(su / 2 + .08, y, v, .1, .4, sv * .9, [.5, .32, .26]);
    }
    T.gl(0, h - 2.5, v + sv / 2 + .1, su, 1.6, .1, dim(JRED, .9));
    T.gl(-su / 2 - .1, h - 2.5, v, .1, 1.6, sv, dim(JRED, .7));
    T.sign(big ? 'SHINCHOKU' : 'JINTEKI', 0, h + 4, v + sv / 2, Math.min(44, su * .55), big ? 11 : 6, [1.4, .18, .14]);
    for (let k = 0; k < 4; k++) T.box((k - 1.5) * su * .22, h + 1.5, v + (r() - .5) * sv * .5, 6, 3, 4, [.3, .3, .3]);

    // Side buildings in the front corners, joined to the hall by elevated tank conveyors.

    for (const s of [-1, 1]) {
      const bu = s * (T.U / 2 - T.U * .14), bv = T.V / 2 - T.V * .17, bs = Math.min(T.U * .22, T.V * .26);
      T.vol(bu, bv, bs, bs, 14 + r() * 8, { ...st, base: [.33, .32, .32], win: [1, .95, .9], lit: .35, grime: .25 }, r, { roof: false, skin: SKINS.grid });
      T.gl(bu, 12, bv + bs / 2 + .08, bs, .8, .1, dim(JRED, .7));
      const a = T.P(bu * .55, v + sv / 2), c = T.P(bu, bv - bs / 2);
      for (const y of [9, 13]) {
        beam([a[0], y, a[1]], [c[0], y, c[1]], 2.4, [.3, .3, .31]);
        beam([a[0], y - 1.3, a[1]], [c[0], y - 1.3, c[1]], .25, [.8, .55, .45], 'glow');
      }
    }

    // Recycling tanks with green ring lights, a stack, docks and trucks.

    for (let k = 0; k < 3; k++) {
      const [tx, tz] = T.P(-T.U * .1 + k * 9, T.V / 2 - 8), tr = 3.2;
      prop('cyl', tx, 4, tz, tr * 2, 8, tr * 2, [.25, .26, .25]);
      put(GLOWS.ring, tx, 7.8, tz, tr * 2.04, 1, tr * 2.04, 0, 0, dim(JGREEN, .45));
    }
    stack(...T.P(-su / 2 + 4, v - sv / 2 + 4), 1.6, h + 18, r);
    for (let k = 0; k < 5; k++) T.gl(-su / 2 + 6 + k * 6, 2.4, v + sv / 2 + .1, 4, 4, .1, k % 2 ? [.9, .9, .95] : [.6, .6, .62]);
    for (let k = 0; k < 2; k++) truck(...T.P(-su / 2 + 6 + k * 12, v + sv / 2 + 7), T.ry, r);
    T.pool(0, v + sv / 2 + 10, 22, dim(FLOOD, .08));
    return h;
  };

  // Spoke works: a tall hub hall, low plants radiating like spokes, an overhead maglev out of the hub,
  // and a truck lane through a barrier with autogun turrets.

  const spokeworks = (x, z, w, d, st, r, big = false) => {
    const T = uvFrame(x, z, w, d), fl = AREAS['Golem Grove'];
    site(T, fl, r, [.04, .045, .05]);
    const hr = Math.min(w, d) * (big ? .2 : .16), hh = big ? 95 + r() * 15 : 50 + r() * 20;
    bld(x, z, hr * 2, hr * 2, hh, { ...st, base: [.11, .14, .19], win: [.8, .9, 1.05], lit: .3, grime: .3 }, r, { shape: 'oct', roof: false, skin: SKINS.bands });
    for (let y = 12; y < hh; y += 16) put(GLOWS.ring, x, y, z, hr * 2.08, 1, hr * 2.08, 0, 0, dim(COLD, .45));
    put(GLOWS.ring, x, hh, z, hr * 1.9, 1, hr * 1.9, 0, 0, dim(COLD, .9));
    beacon(x, hh + 2, z, r);
    const n = 5 + Math.floor(r() * 2), off = r() * Math.PI;
    for (let k = 0; k < n; k++) {
      const a = off + k * Math.PI * 2 / n, sx = Math.sin(a), sz = Math.cos(a);
      const reach = Math.min(Math.abs(w / 2 / (sx || 1e-6)), Math.abs(d / 2 / (sz || 1e-6))) - 4;
      const L = Math.max(10, reach - hr), mid = hr + L / 2, h = 12 + r() * 10;
      prop('box', x + sx * mid, h / 2, z + sz * mid, 11, h, L, [.1, .12, .15], a);
      beam([x + sx * hr, h + .3, z + sz * hr], [x + sx * reach, h + .3, z + sz * reach], .5, dim(COLD, .55), 'glow');
      for (const s of [-1, 1]) beam([x + sx * hr + sz * s * 5.6, h * .75, z + sz * hr - sx * s * 5.6], [x + sx * reach + sz * s * 5.6, h * .75, z + sz * reach - sx * s * 5.6], .3, dim(COLD, .3), 'glow');
      glow(x + sx * (reach + .3), 2.4, z + sz * (reach + .3), 3.5, 4, 3.5, dim(COLD, .5));
    }

    // Overhead maglev from the hub, out past the block edge.

    const ma = off + Math.PI / n, mx = Math.sin(ma), mz = Math.cos(ma), my = 26, far = Math.max(w, d) * .5 + 70;
    beam([x + mx * hr, my, z + mz * hr], [x + mx * far, my, z + mz * far], 3, [.08, .09, .11]);
    beam([x + mx * hr, my - 1.7, z + mz * hr], [x + mx * far, my - 1.7, z + mz * far], .3, dim(COLD, .6), 'glow');
    for (let t = hr + 20; t < far; t += 28) prop('box', x + mx * t, my / 2, z + mz * t, 1.6, my, 1.6, DARK);
    const ct = hr + 10 + r() * (far - hr - 30);
    prop('box', x + mx * ct, my + 2.2, z + mz * ct, 3, 3, 22, [.18, .2, .24], ma);
    glow(x + mx * ct, my + 2.4, z + mz * ct, 3.1, .5, 3.1, dim(COLD, .9));

    // Birthday Alley: a lit truck lane from the hub to the front edge, barriers and turrets at the gate.

    const a0 = T.P(0, 0), a1 = T.P(0, T.V / 2 + 2);
    beam([a0[0], .25, a0[1]], [a1[0], .25, a1[1]], 6, [.12, .09, .03], 'glow');
    for (let k = -1; k <= 1; k++) T.box(k * 2.4, .6, T.V / 2 - 3, 2, 1.2, .6, [.16, .15, .14]);
    for (const s of [-1, 1]) {
      T.box(s * 5, 2, T.V / 2 - 3, 1.6, 4, 1.6, [.08, .08, .09]);
      T.gl(s * 5, 4.3, T.V / 2 - 3, .6, .5, .6, RED);
      T.gl(s * 4, 1, T.V / 2 - 2.6, 1.6, .25, .1, HAZARD);
    }
    for (let k = 0; k < 8; k++) fig(...T.P((r() - .5) * 4, hr + 4 + r() * (T.V / 2 - hr - 8)), [.44, .48, .54]);
    if (big) textSign('STAHLARME', x, hh + 6, z, 30, 7, T.ry, [.6, .9, 1.5]);
    return hh;
  };

  // Fusion row: He-3 domes in a line, cooling towers behind, a switchyard in front.

  const fusionrow = (x, z, w, d, st, r) => {
    const T = uvFrame(x, z, w, d), fl = flavor(x, z);
    site(T, fl, r);
    const n = Math.max(2, Math.min(4, Math.floor(T.U / 30))), R = Math.min(T.U / n * .36, T.V * .18), hh = R * .9;
    for (let k = 0; k < n; k++) {
      const [dx, dz] = T.P(-T.U / 2 + (k + .5) * T.U / n, -T.V * .05);
      prop('cyl', dx, hh / 2, dz, R * 2, hh, R * 2, [.17, .17, .18]);
      prop('dish', dx, hh + R * .2, dz, R * 2, R, R * 2, [.2, .2, .21], 0, Math.PI);
      put(GLOWS.ring, dx, hh * .98, dz, R * 2.04, 1, R * 2.04, 0, 0, dim(COLD, .7));
      put(GLOWS.ring, dx, hh * .5, dz, R * 2.04, 1, R * 2.04, 0, 0, dim(HAZARD, .3));
      put(GLOWS.ring, dx, 2, dz, R * 2.04, 1, R * 2.04, 0, 0, dim(SODIUM, .45));
      glow(dx, hh + R * .6, dz, 1.2, .6, 1.2, dim(COLD, .9));
      textSign(`UNIT ${k + 1}`, dx + Math.sin(T.ry) * (R + .2), hh * .7, dz + Math.cos(T.ry) * (R + .2), R * .9, R * .22, T.ry, dim(FLOOD, .7));
      const [px, pz] = T.P(-T.U / 2 + (k + .5) * T.U / n, T.V * .28);
      pipe(dx, dz, px, pz, 5, 1.1, [.12, .1, .08]);
    }
    for (let k = 0; k < (T.U > 90 ? 2 : 1); k++) cooler(...T.P((k - (T.U > 90 ? .5 : 0)) * T.U * .4, -T.V / 2 + T.V * .17), Math.min(T.V * .16, 16), 48 + r() * 14, r);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) T.box((i - 2.5) * T.U * .13, 1.4, T.V * .34 + j * 4, 2.6, 2.8, 2.4, [.1, .11, .1]);
    const pyl = [];
    for (let k = 0; k < 4; k++) { const p = T.P((k - 1.5) * T.U * .26, T.V / 2 - 5); prop('lattice', p[0], 11, p[1], 3, 22, 3); pyl.push(p); }
    for (let k = 0; k < 3; k++) for (const o of [-.8, .8]) beam([pyl[k][0], 21 + o, pyl[k][1]], [pyl[k + 1][0], 21 + o, pyl[k + 1][1]], .12, [.1, .1, .1]);
    T.pool(0, T.V * .3, 26, dim(SODIUM, .07));
  };

  return { L, site, cooler, wombhall, spokeworks, fusionrow };
}

export function blocks(H) {
  const B = blockBuilders(H);
  const area = (x, z) => H.subareaAt(...B.L.toWorld(x, z));
  return {
    qui_wombhall: { zone: 'quinde', build(x, z, w, d, st, r) { area(x, z) === 'Golem Grove' ? B.spokeworks(x, z, w, d, st, r) : B.wombhall(x, z, w, d, st, r); } },
    qui_spokeworks: { zone: 'quinde', build(x, z, w, d, st, r) { area(x, z) === 'The Meat Market' ? B.wombhall(x, z, w, d, st, r) : B.spokeworks(x, z, w, d, st, r); } },
    qui_fusionrow: { zone: 'quinde', build(x, z, w, d, st, r) { B.fusionrow(x, z, w, d, st, r); } },
  };
}

// Landmarks: JQ Station, The Foundry, Quinde Plaza, Shinchoku.

export function landmarks(H) {
  const B = blockBuilders(H), { L } = B, { GLOWS, SKINS, beacon, beam, bld, glow, helipad, holo, lerp, pool, prop, puff, put, textSign, flickerGlow } = H;
  const { uvFrame, mast, pipe, stack, truck, fig, ctower, laundry } = L;

  // The block's local axis nearest world north (map up).

  const northAxis = () => {
    const f = H.frame();
    if (!f) return [0, -1];
    return Math.abs(f.s) > Math.abs(f.c) ? [Math.sign(f.s), 0] : [0, Math.sign(-f.c)];
  };

  // The local direction of a uv frame's +v side, for the card camera's face.

  const faceOf = T => { const [ax, az] = T.P(0, 0), [bx, bz] = T.P(0, 1); return [bx - ax, bz - az]; };

  return {

    // JQ Station: carbosteel transit megatower over a truck podium. Freight maglev fans out at mid-height,
    // hopper pads shelve out of the upper faces like bracket fungi, cranes lift hoppers through the open crown.

    qui_jq: { at: [785, 1407], label: 'JQ Station', labelY: 250, minSide: 64, reach: 360, build(x, z, w, d, st, r) {
      const T = uvFrame(x, z, w, d), S = Math.min(w, d);
      const carbon = { ...st, base: [.07, .075, .085], win: [1, .82, .55], lit: .32, grime: .5 };
      T.box(0, .1, 0, T.U + 6, .2, T.V + 6, [.04, .04, .042]);

      // Podium with truck portals on all four faces.

      const ph = 18;
      bld(x, z, w - 2, d - 2, ph, { ...carbon, lit: .45 }, r, { roof: false, skin: SKINS.bands });
      for (const [fx, fz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ox = fx * ((w - 2) / 2 + .1), oz = fz * ((d - 2) / 2 + .1), span = fx ? d : w;
        for (let k = -1; k <= 1; k++) {
          const px = x + ox + (fz ? k * span * .28 : 0), pz = z + oz + (fx ? k * span * .28 : 0);
          glow(px, 3.5, pz, fx ? .1 : 9, 7, fx ? 9 : .1, dim(SODIUM, .9));
          glow(px, 7.4, pz, fx ? .2 : 10, .5, fx ? 10 : .2, dim(HAZARD, .7));
          pool(px + fx * 8, pz + fz * 8, 11, dim(SODIUM, .1));
          truck(px + fx * 12, pz + fz * 12, Math.atan2(fx, fz), r);
        }
        glow(x + ox * 1.001, ph - 1.2, z + oz * 1.001, fx ? .1 : w * .9, .6, fx ? d * .9 : .1, dim(SODIUM, .6));
      }

      // Tower: three tapered carbosteel sections with corner columns, X bracing and lit floor bands.

      const secs = [[ph, 92, .78], [92, 168, .64], [168, 228, .5]];
      for (const [y0, y1, f] of secs) {
        const sw = S * f, hh = y1 - y0;
        bld(x, z, sw, sw, hh, carbon, r, { y0, roof: false, skin: SKINS.bands });
        for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) prop('box', x + cx * sw / 2, y0 + hh / 2, z + cz * sw / 2, 2.4, hh, 2.4, [.06, .065, .075]);
        for (const [fx, fz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ex = fx * (sw / 2 + .8), ez = fz * (sw / 2 + .8), tx = fz * sw / 2, tz = fx * sw / 2;
          beam([x + ex - tx, y0, z + ez - tz], [x + ex + tx, y1, z + ez + tz], 1.2, [.08, .085, .095]);
          beam([x + ex + tx, y0, z + ez + tz], [x + ex - tx, y1, z + ez - tz], 1.2, [.08, .085, .095]);
          glow(x + ex * 1.01, y1 - 1.5, z + ez * 1.01, fx ? .2 : sw, .6, fx ? sw : .2, dim(FLOOD, .45));
        }
        prop('box', x, y1 + .6, z, sw + 4, 1.2, sw + 4, [.06, .06, .07]);
      }
      const top = 228, tw = S * .5;

      // Freight maglev deck at mid-height with guideways running out in all directions.

      const my = 64, dw = S * .78 / 2 + 4;
      for (const [fx, fz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        prop('box', x + fx * dw, my, z + fz * dw, fx ? 8 : dw * 2 + 8, 2.4, fx ? dw * 2 + 8 : 8, [.07, .07, .08]);
        glow(x + fx * (dw + 4.1), my - 1.4, z + fz * (dw + 4.1), fx ? .2 : dw * 2, .3, fx ? dw * 2 : .2, dim(SODIUM, .7));
      }
      const lines = 5, a0 = r() * Math.PI;
      for (let k = 0; k < lines; k++) {
        const a = a0 + k * Math.PI * 2 / lines + (r() - .5) * .3, sx = Math.sin(a), sz = Math.cos(a);
        const len = 260 + r() * 220, y1 = my - 16 - r() * 16, p0 = [x + sx * dw, my, z + sz * dw], p1 = [x + sx * len, y1, z + sz * len];
        beam(p0, p1, 2, [.09, .09, .1]);
        beam([p0[0], my - 1.9, p0[2]], [p1[0], y1 - 1.9, p1[2]], .35, dim(SODIUM, .55), 'glow');
        for (let t = dw + 40; t < len; t += 60) {
          const py = lerp(my, y1, (t - dw) / (len - dw));
          prop('box', x + sx * t, py / 2, z + sz * t, 1.4, py, 1.4, [.07, .07, .075]);
          if (r() < .35) glow(x + sx * t, py + .3, z + sz * t, .6, .3, .6, dim(HAZARD, .8));
        }
        for (let c = 0; c < 2; c++) {
          const t = dw + 30 + r() * (len - 90), py = lerp(my, y1, (t - dw) / (len - dw));
          prop('box', x + sx * t, py + 2.4, z + sz * t, 3.2, 3, 34, pick(r, CONT), a);
          glow(x + sx * (t + 17.2), py + 2.4, z + sz * (t + 17.2), 1.8, .5, 1.8, [1.4, 1.3, 1.1]);
        }
      }

      // Hopper pads: discs shelved out of the upper faces on inverted cone brackets, many with a parked hopper.

      for (let k = 0; k < 26; k++) {
        const y = 100 + r() * (top - 104), sec = y < 168 ? .64 : .5, half = S * sec / 2;
        const face = k % 4, [fx, fz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][face], along = (r() - .5) * half * 1.4;
        const pr = 6 + r() * 7, out = half + pr * .7;
        const px = x + fx * out + fz * along, pz = z + fz * out + fx * along;
        prop('cyl', px, y, pz, pr * 2, .8, pr * 2, [.09, .09, .1]);
        prop('cone', px, y - pr * .45, pz, pr * 1.7, pr * .9, pr * 1.7, [.07, .07, .08], 0, Math.PI);
        put(GLOWS.ring, px, y + .45, pz, pr * 1.9, 1, pr * 1.9, 0, 0, k % 3 ? dim(FLOOD, .55) : dim(HAZARD, .7));
        if (r() < .6) {
          prop('box', px, y + 1.6, pz, 3.4, 2, 6, [.14, .14, .16], r() * 6.3);
          glow(px, y + 2.8, pz, .6, .4, .6, r() < .5 ? [1.5, .2, .1] : [.3, 1.3, .4]);
        }
      }

      // Open crown: roof pads, crane masts with jibs and hoppers on cables, crown floods and corner beacons.

      for (const [cx, cz] of [[-1, -1], [1, 1], [1, -1]]) helipad(x + cx * tw * .3, z + cz * tw * .3, tw * .28, top + 1.2, r);
      for (let k = 0; k < 3; k++) {
        const cx = x + (r() - .5) * tw * .5, cz = z + (r() - .5) * tw * .5, ch = 26 + r() * 14, ja = r() * 6.3, jl = 22 + r() * 10;
        prop('lattice', cx, top + ch / 2, cz, 3, ch, 3);
        const jx = cx + Math.sin(ja) * jl, jz = cz + Math.cos(ja) * jl;
        beam([cx, top + ch, cz], [jx, top + ch, jz], 1, dim(HAZARD, .25));
        beam([cx, top + ch + 4, cz], [jx, top + ch, jz], .2, [.1, .1, .1]);
        const hy = top + ch - 8 - r() * 30;
        beam([jx, top + ch, jz], [jx, hy + 1.5, jz], .1, [.1, .1, .1]);
        prop('box', jx, hy, jz, 3.4, 2.2, 6, [.15, .15, .17], ja);
        glow(jx, top + ch - .6, jz, .8, .5, .8, FLOOD);
        beacon(cx, top + ch + 1.5, cz, r);
      }
      for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        beacon(x + cx * tw / 2, top + 2.5, z + cz * tw / 2, r);
        glow(x + cx * (tw / 2 - 1.5), top + 1.8, z + cz * (tw / 2 - 1.5), 2.6, .6, 2.6, dim(FLOOD, .9));
      }
      for (let k = 0; k < 4; k++) puff(x + (r() - .5) * tw * .6, top + 6 + k * 5, z + (r() - .5) * tw * .6, 5 + k * 2, [.1, .1, .105]);

      // Name boards on two faces, NAPD precinct on the front podium, depot ramps down to the tube-lev.

      for (const back of [false, true]) T.sign('JQ STATION', 0, top - 12, (back ? -1 : 1) * (S * .25 + 1.2), S * .4, S * .1, [1.25, 1.15, .95], back);
      T.sign('NAPD QUINDE PRECINCT', 0, ph + 4, (d - 2) / 2 + .3, Math.min(40, T.U * .5), 3.4, [.55, .75, 1.4]);
      T.gl(0, ph + 1, (d - 2) / 2 + .2, T.U * .55, .5, .2, [.5, .7, 1.3]);
      for (let k = 0; k < 4; k++) {
        const [px, pz] = T.P((k - 1.5) * 6, (d - 2) / 2 + 1);
        flickerGlow(px, ph + 7, pz, 1.2, .5, .5, k % 2 ? [1.5, .1, .1] : [.2, .4, 1.6], r);
      }
      for (const s of [-1, 1]) {
        const a = T.P(s * T.U * .3, T.V / 2 + 4), c = T.P(s * T.U * .3, T.V / 2 + 26);
        beam([a[0], .3, a[1]], [c[0], .3, c[1]], 7, [.03, .03, .03]);
        beam([a[0], .45, a[1]], [c[0], .45, c[1]], .4, dim(SODIUM, .8), 'glow');
      }
      for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mast(x + cx * (w / 2 + 3), z + cz * (d / 2 + 3), 30, SODIUM, r, [-cx, -cz]);
      pool(x, z, S * .9, dim(SODIUM, .09));
      return { face: faceOf(T) };
    } },

    // The Foundry: Quinde Heavy Smelting Plant No. 4. A long rusted hall (Dignity Hall) lit warm for Local 509,
    // cold blast furnaces and chimneys behind, outside catwalks, and the Iron Hands' fortified back office.

    qui_foundry: { at: [750, 1478], label: 'The Foundry', slug: 'the-foundry', labelY: 110, minSide: 56, reach: 320, build(x, z, w, d, st, r) {
      const T = uvFrame(x, z, w, d), fl = L.flavor(x, z);
      B.site(T, { ...fl, flood: SODIUM }, r, [.035, .03, .026]);
      const su = T.U * .82, sv = T.V * .42, h = 30, v = T.V * .04;
      const rust = [.15, .08, .045];
      T.box(0, h / 2, v, su, h, sv, rust);
      const rise = sv * .22, ls = Math.hypot(rise, sv / 2);
      for (const s of [-1, 1]) {
        const [px, pz] = T.P(0, v + s * sv / 4), [ox, oz] = T.P(0, 0), [ex, ez] = T.P(0, s);
        prop('box', px, h + rise / 2, pz, su + 1, .7, ls, dim(rust, .8), Math.atan2(ex - ox, ez - oz), Math.asin(rise / ls));
      }
      for (const s of [-1, 1]) {
        T.gl(0, h - 4, v + s * (sv / 2 + .06), su * .92, 1.4, .1, dim(WARM, .7));
        T.gl(s * (su / 2 + .06), h - 4, v, .1, 1.4, sv * .9, dim(WARM, .5));
      }
      for (const y of [11, 21]) for (const s of [-1, 1]) {
        T.box(0, y, v + s * (sv / 2 + 1.2), su + 2, .3, 2.4, DARK);
        T.gl(0, y - .3, v + s * (sv / 2 + 2.3), su, .1, .1, dim(SODIUM, .5));
      }
      for (let k = 0; k < 3; k++) T.box(-su / 2 + 3 + k * 2.2, 11, v + sv / 2 + 1.2, .3, 22, .3, DARK);

      // Front: the Dignity Hall doors, union banners and a crowd under the work lights.

      const fv = v + sv / 2 + .08;
      T.gl(0, 5, fv, 10, 10, .1, [1.25, .95, .6]);
      T.gl(0, 10.4, fv + .3, 12, .4, .6, dim(HAZARD, .7));
      T.sign('DIGNITY HALL', 0, 13.5, fv + .15, 18, 3.6, [1.3, 1.1, .75]);
      T.sign('LOCAL 509', -su * .3, 17, fv + .15, 14, 3.4, [1.4, .5, .12]);
      T.sign('PLANT No 4', su * .3, h - 8, fv + .15, 14, 3, [.7, .6, .45]);
      for (const s of [-1, 1]) T.box(s * 9, 9, fv + .2, 3, 14, .1, [.35, .07, .04]);
      for (let k = 0; k < 30; k++) fig(...T.P((r() - .5) * 26, fv + 3 + r() * 12));
      T.pool(0, fv + 9, 18, dim(WARM, .11));
      for (let k = 0; k < 2; k++) truck(...T.P(su * .3 + k * 4, fv + 14), T.ry + Math.PI / 2, r);

      // Back: three cold blast furnaces with downcomers, two tall chimneys, a rusted gantry.

      const bv = v - sv / 2 - T.V * .13;
      for (let k = 0; k < 3; k++) {
        const fu = (k - 1) * su * .3, [fx, fz] = T.P(fu, bv), fr = 4.5 + r(), fh = 44 + r() * 10;
        prop('cyl', fx, fh / 2, fz, fr * 2, fh, fr * 2, dim(rust, .75));
        prop('cone', fx, fh + 3, fz, fr * 1.6, 6, fr * 1.6, dim(rust, .6));
        prop('cyl', fx, fh * .35, fz, fr * 2.6, fh * .3, fr * 2.6, [.08, .06, .045]);
        const [ux, uz] = T.P(fu + 7, bv + 3);
        beam([fx, fh + 4, fz], [ux, fh + 10, uz], 1.6, [.1, .06, .04]);
        beam([ux, fh + 10, uz], [ux, 0, uz], 1.6, [.1, .06, .04]);
        glow(fx, 4, fz + 0, fr * 1.2, .6, fr * 1.2, [.25, .1, .04]);
      }
      for (const s of [-1, 1]) {
        const [cx, cz] = T.P(s * su * .45, bv - 4), ch = 70 + r() * 12;
        prop('cyl', cx, ch / 2, cz, 4.4, ch, 4.4, dim(rust, .7));
        put(GLOWS.ring, cx, ch * .8, cz, 4.8, 1, 4.8, 0, 0, dim(RED, .6));
        beacon(cx, ch + 1, cz, r);
      }
      const gu = -su * .1;
      for (const s of [-1, 1]) T.box(gu + s * 14, 11, bv + 6, 1.2, 22, 1.2, dim(rust, .7));
      T.box(gu, 22, bv + 6, 30, 1.6, 1.6, dim(rust, .7));
      T.gl(gu, 21, bv + 6, 1.4, .3, 1.4, dim(SODIUM, .8));

      // Iron Hands back office: a squat bunker in a far corner behind sandbags, one red lamp, one searchlight.

      const ou = su / 2 - 4, ov = -T.V / 2 + 9;
      T.box(ou, 3, ov, 10, 6, 8, [.08, .075, .07]);
      T.gl(ou, 4, ov + 4.06, 6, .5, .1, [.3, .08, .04]);
      for (const s of [-1, 1]) T.box(ou + s * 6.5, .7, ov + 5.5, 3, 1.4, 1, [.11, .1, .07]);
      T.box(ou, .7, ov + 6.5, 10, 1.4, 1, [.11, .1, .07]);
      T.gl(ou - 4, 6.4, ov + 4, .5, .5, .5, dim(RED, .9));
      mast(...T.P(ou + 4, ov - 3), 10, dim(FLOOD, .9), r, [-.5, .5]);
      return { face: faceOf(T) };
    } },

    // Quinde Plaza, the Concrete Cauldron: a sunken square of stepped tiers ringed by container high-rises,
    // catwalks across the bowl, and a three-storey notice screen at the north end.

    qui_plaza: { at: [760, 1352], label: 'Quinde Plaza', slug: 'quinde-plaza', labelY: 90, minSide: 56, reach: 320, build(x, z, w, d, st, r) {
      const T = uvFrame(x, z, w, d, northAxis()), S = Math.min(T.U, T.V), P = S * .6;
      T.box(0, .1, 0, T.U, .2, T.V, [.04, .038, .036]);
      T.box(0, .25, 0, P * .42, .1, P * .42, [.06, .055, .05]);
      const steps = 6;
      for (let k = 0; k < steps; k++) {
        const s = P * (.42 + .58 * (k + 1) / steps), y = (k + 1) * 1.1, t = P * .58 / steps / 2;
        for (const q of [-1, 1]) {
          T.box(0, y / 2, q * (s / 2 - t), s, y, t * 2, [.1, .095, .09].map(c => c * (1 - k * .06)));
          T.box(q * (s / 2 - t), y / 2, 0, t * 2, y, s - t * 4, [.1, .095, .09].map(c => c * (1 - k * .06)));
          const ls = s - t * 4 - .4;
          T.gl(0, y - .5, q * (ls / 2 + .1), ls, .12, .1, dim(WARM, .45));
          T.gl(q * (ls / 2 + .1), y - .5, 0, .1, .12, ls, dim(WARM, .45));
        }
      }
      T.pool(0, 0, P * .45, dim(WARM, .12));
      for (let k = 0; k < 40; k++) {
        const rr = P * (.12 + r() * .36), a = r() * 6.3, [px, pz] = T.P(Math.sin(a) * rr, Math.cos(a) * rr);
        const tier = Math.max(0, Math.floor((Math.max(Math.abs(Math.sin(a) * rr), Math.abs(Math.cos(a) * rr)) * 2 / P - .42) / .58 * steps) + 1);
        prop('box', px, tier * 1.1 + .85, pz, .5, 1.7, .45, [.06, .055, .05]);
      }

      // The screen at the north end: frame, lit face, holo flare and notice text.

      const sv = P / 2 + 2, sh = 12, sw = Math.min(28, P * .6);
      T.box(0, 7.5 + sh / 2, sv + 1, sw + 2, sh + 2, 1.2, [.05, .05, .055]);
      for (const s of [-1, 1]) T.box(s * (sw / 2 - 2), 4, sv + 1, 1.2, 8, 1.2, DARK);
      T.gl(0, 7.5 + sh / 2, sv + .3, sw, sh, .1, [.32, .45, .55]);
      T.sign('QUINDE NOTICE', 0, 7.5 + sh * .7, sv + .1, sw * .8, sh * .25, [1.2, 1.3, 1.4], true);
      T.sign('WORK IS DIGNITY', 0, 7.5 + sh * .35, sv + .1, sw * .75, sh * .2, [1.4, 1.1, .4], true);
      T.pool(0, sv - 8, 14, [.05, .07, .09]);

      // Container high-rises on the rim, facing in, and catwalks strung between them over the bowl.

      const tops = [], rim = (S - P) / 2;
      const spots = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [-1, 0], [1, 0]];
      for (const [su, svv] of spots) {
        const u = su * (P / 2 + rim / 2 - 1), v = svv * (P / 2 + rim / 2 - 1);
        if (svv === 1 && su === 0) continue;
        const [cx, cz] = T.P(u, v), tx = x - cx, tz = z - cz;
        const f = Math.abs(tx) > Math.abs(tz) ? [Math.sign(tx), 0] : [0, Math.sign(tz)];
        const tw = Math.max(14, Math.min(26, rim * 1.6)), h = ctower(cx, cz, tw, tw, 30 + r() * 26, st, r, f);
        tops.push([cx, h, cz]);
      }
      for (let k = 0; k < 4; k++) {
        const a = tops[k], c = tops[(k + 3) % tops.length], y = Math.min(a[1], c[1]) * (.55 + .2 * r());
        beam([a[0], y, a[2]], [c[0], y, c[2]], 1.6, [.05, .05, .05]);
        beam([a[0], y - .9, a[2]], [c[0], y - .9, c[2]], .2, dim(SODIUM, .7), 'glow');
      }
      for (const [su, svv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const [mx, mz] = T.P(su * (P / 2 + 1), svv * (P / 2 + 1));
        mast(mx, mz, 20, FLOOD, r, [-su * 1, -svv * 1]);
      }

      // The camera looks in from the south, across the tiers to the screen.

      return { face: faceOf(T).map(c => -c) };
    } },

    // Shinchoku Complex: the stadium-sized womb hall of the Meat Market.

    qui_shinchoku: { at: [842, 1290], label: 'Shinchoku Complex', labelY: 120, minSide: 70, reach: 300, build(x, z, w, d, st, r) {
      B.wombhall(x, z, w, d, st, r, true);
      return { face: faceOf(uvFrame(x, z, w, d)) };
    } },

    // Stahlarme Facility: Haas-Bioroid's spoked hardtech plant in Golem Grove.

    qui_stahlarme: { at: [808, 1446], label: 'Stahlarme', labelY: 130, minSide: 54, reach: 260, build(x, z, w, d, st, r) {
      B.spokeworks(x, z, w, d, st, r, true);
      return { face: faceOf(uvFrame(x, z, w, d)) };
    } },
  };
}
