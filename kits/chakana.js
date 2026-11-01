// Chakana block kits: the logistics and corporate ring round the Root. Signature: build(x, z, w, d, st, r) in the block frame.
// Builders look good from all sides, because a block cannot know which way the Root lies.

export function kits(H) { return {}; }

// Shared parts for the block kits and the landmarks.

function tools(H) {
  const { GLOWS, SKINS, beacon, bld, glow, prop, put, textSign } = H;
  const pool = (x, z, rad, rgb) => H.pool?.(x, z, rad, rgb);

  const CARBO = [.1, .105, .115], CONCRETE = [.09, .088, .085], DARK = [.035, .036, .04];
  const SEA = [1.4, 1.05, .15], COLD = [.9, .95, 1.05], CYAN = [.2, .7, 1.1];
  const ROCK = [.1, .09, .08], HUES = [[1.6, .3, 1.1], [.3, 1.2, 1.6], [1.6, 1, .3], [.4, 1.5, .6], [1.5, .4, .3]];
  const CORP = [[.15, 1.2, 1.3], [1.4, .2, .15], [.8, .3, 1.4], [1.4, .9, .2], [.3, .6, 1.5]];
  const BOX = [[.2, .06, .04], [.05, .1, .2], [.18, .14, .04], [.05, .14, .08], [.14, .14, .15], [.16, .09, .03]];
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const dim = (rgb, k) => rgb.map(c => c * k);

  // Clean carbosteel style: cold white windows, little grime.

  const chak = (st, o = {}) => ({ ...st, w: Math.max(st.w, .65), base: [.05, .055, .065], win: [.6, .72, .85], grime: .15, lit: .28, neon: .5, ...o });
  const slab = (x, z, w, d, rgb = [.04, .04, .045]) => prop('box', x, .1, z, w, .2, d, rgb);

  // Cylinder laid along local x, centred at (x, y, z). sx is the depth across, sz the height.

  const barrel = (x, y, z, len, across, tall, rgb) => prop('cyl', x, y, z, across, len, tall, rgb, Math.PI / 2, Math.PI / 2);

  const lamp = (x, z, h = 7, rgb = COLD) => {
    prop('cyl', x, h / 2, z, .3, h, .3, DARK);
    glow(x, h + .3, z, .7, .5, .7, dim(rgb, .9));
    pool(x, z, h * .8, dim(rgb, .08));
  };
  const mast = (x, z, h, r, rgb = [1.2, 1.1, .9]) => {
    prop('cyl', x, h / 2, z, .7, h, .7, DARK);
    prop('box', x, h, z, 3.4, .5, 1.2, DARK);
    glow(x, h - .4, z, 3, .3, .9, rgb);
    if (r() < .5) beacon(x, h + .8, z, r);
    pool(x, z, h * .6, dim(rgb, .1));
  };

  // Service annexes packed into a yard: low sheds, crate piles and parked trucks, with lit doors.

  const annex = (x, z, w, d, cs, r, maxH = 12) => {
    const nx = Math.max(1, Math.floor(w / 11)), nz = Math.max(1, Math.floor(d / 11)), cw = w / nx, cd = d / nz;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const cx = x - w / 2 + cw * (i + .5), cz = z - d / 2 + cd * (j + .5), roll = r();
      if (roll < .55) {
        const h = 4 + r() * (maxH - 4), bw = cw * (.6 + .3 * r()), bd = cd * (.6 + .3 * r());
        bld(cx, cz, bw, bd, h, cs, r, { roof: r() < .3, skin: SKINS.sparse, lit: .15 });
        glow(cx, 1.6, cz + bd / 2 + .15, Math.min(3, bw * .5), 2.8, .2, r() < .6 ? [.8, .7, .5] : dim(CYAN, .5));
      } else if (roll < .8) {
        for (let k = 2 + Math.floor(r() * 4); k > 0; k--) prop('box', cx + (r() - .5) * cw * .6, .9, cz + (r() - .5) * cd * .6, 1.8, 1.8, 1.8, pick(r, BOX));
      } else {
        prop('box', cx, 1.8, cz, 2.6, 3.2, Math.min(9, cd * .8), pick(r, BOX));
        pool(cx, cz, 5, [.1, .09, .07]);
      }
    }
  };

  // Road vehicle: trailer with a cab, along z.

  const truck = (x, z, r, len = 9, dir = 1) => {
    prop('box', x, 1.9, z, 2.6, 3.2, len, pick(r, BOX));
    prop('box', x, 1.5, z + dir * (len / 2 + 1.4), 2.5, 2.6, 2.4, [.12, .12, .13]);
    glow(x, 1.2, z + dir * (len / 2 + 2.65), 2, .3, .1, [1.1, 1, .85]);
  };

  // Sloped deck along local x: a road or rail ramp from height y0 to y1.

  const ramp = (x0, x1, z, y0, y1, width, rgb) => {
    const len = Math.hypot(x1 - x0, y1 - y0), tilt = Math.atan2(y1 - y0, x1 - x0);
    prop('box', (x0 + x1) / 2, (y0 + y1) / 2, z, width, .7, len, rgb, Math.PI / 2, -tilt);
  };

  // Lamps round a rectangle, spaced about every gap metres.

  const ringLamps = (x, z, w, d, gap, h, rgb) => {
    for (const s of [-1, 1]) {
      for (let k = Math.ceil(w / gap); k >= 0; k--) lamp(x - w / 2 + k * w / Math.ceil(w / gap), z + s * d / 2, h, rgb);
      for (let k = Math.ceil(d / gap) - 1; k > 0; k--) lamp(x + s * w / 2, z - d / 2 + k * d / Math.ceil(d / gap), h, rgb);
    }
  };

  // Hopper: flat body, two fan pods, blue underglow.

  const hopper = (x, y, z, r, ry = r() * 6.3) => {
    const c = Math.cos(ry), s = Math.sin(ry);
    prop('box', x, y, z, 3, 1.6, 6, pick(r, [[.18, .18, .2], [.25, .22, .06], [.05, .06, .08]]), ry);
    for (const k of [-1, 1]) prop('cyl', x + k * 2.2 * c, y, z - k * 2.2 * s, 1.8, .6, 1.8, DARK, ry);
    glow(x, y - .9, z, 1.6, .15, 4, [.25, .55, 1.1]);
  };

  // Container stacks in a grid of 6.4 × 2.8 m cells.

  const containers = (x, z, w, d, maxH, r) => {
    const cols = Math.max(1, Math.floor(w / 6.6)), rows = Math.max(1, Math.floor(d / 2.9));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if (r() < .3) continue;
      const cx = x + (i - (cols - 1) / 2) * 6.6, cz = z + (j - (rows - 1) / 2) * 2.9;
      for (let k = 1 + Math.floor(r() * maxH); k > 0; k--) prop('box', cx, k * 2.6 - 1.3, cz, 6.1, 2.5, 2.4, pick(r, BOX));
    }
  };

  // Rail gantry crane spanning a yard along z.

  const gantry = (x, z, span, h, r) => {
    const yel = [.34, .24, .03];
    for (const s of [-1, 1]) {
      for (const dx of [-3, 3]) prop('box', x + dx, h / 2, z + s * span / 2, .9, h, .9, yel);
      prop('box', x, 1, z + s * span / 2, 8, 1, 1.4, yel);
    }
    for (const dx of [-3, 3]) prop('box', x + dx, h, z, 1.2, 1.4, span + 3, yel);
    const tz = z + (r() - .5) * span * .7;
    prop('box', x, h - .4, tz, 7.5, 2.4, 3.5, yel);
    glow(x, h - 1.8, tz, 1.2, .2, 1.2, [1.3, .9, .4]);
    beacon(x, h + 1.2, z + span / 2, r);
  };

  // A name on both long faces of a slab of half-depth half, centred at (x, y, z).

  const bothFaces = (text, x, y, z, half, w, rgb) => {
    for (const s of [-1, 1]) textSign(text, x, y, z + s * (half + .4), w, w / 4, s > 0 ? 0 : Math.PI, rgb);
  };

  return { pool, ROCK, HUES, bothFaces, CARBO, CONCRETE, DARK, SEA, COLD, CYAN, CORP, BOX, pick, dim, chak, slab, barrel, lamp, mast, annex, truck, ramp, ringLamps, hopper, containers, gantry };
}

export function blocks(H) {
  const { GLOWS, SKINS, beacon, bld, glow, grammarTowerBody, helipad, holo, prop, put, sign, textSign } = H;
  const { pool, ROCK, HUES, bothFaces, CARBO, CONCRETE, DARK, SEA, COLD, CYAN, CORP, BOX, pick, dim, chak, slab, barrel, lamp, mast, annex, truck, ramp, ringLamps, hopper, containers, gantry } = tools(H);
  const HOTELS = ['HOTEL ORBITA', 'LUNA SUITES', 'MARS INN', 'HOTEL ZENIT', 'ASTRO LODGE', 'SKYPORT INN', 'APOGEO', 'PERIGEO'];
  const STALLS = ['LUNA ROCK', 'MARS GIFTS', 'SOUVENIRS', 'REAL MOON DUST', 'ZERO-G WEAR'];
  const VAULTS = ['WEYLAND CARGO', 'SEA BONDED', 'ROOT FREIGHT', 'CAYAMBE STORE'];

  return {

    // Freight marshalling hall: barrel-roofed shed, lit loading bays, maglev sidings, a container yard under gantries.

    freightyard: {
      zone: 'chakana',
      build(x, z, w, d, st, r) {
        const cs = chak(st), x0 = x - w / 2, z0 = z - d / 2;
        slab(x, z, w, d);
        const sd = d * (.3 + .1 * r()), sh = 16 + r() * 10, sz = z0 + 2 + sd / 2;
        bld(x, sz, w - 4, sd, sh, cs, r, { roof: false, skin: SKINS.bands, lit: .25 });
        barrel(x, sh, sz, w - 4, sd, sd * .4, CARBO);
        glow(x, sh + sd * .2 + .05, sz, w - 8, .15, 1.4, [.45, .55, .65]);
        for (let bx = x0 + 6; bx < x + w / 2 - 4; bx += 7) {
          glow(bx, 2.2, sz + sd / 2 + .15, 4.4, 4, .2, r() < .7 ? [.9, .7, .4] : [.12, .1, .08]);
          if (r() < .35) prop('box', bx, 1.6, sz + sd / 2 + 4.5, 2.5, 2.8, 7, pick(r, BOX));
        }
        prop('box', x, 5.4, sz + sd / 2 + 2, w - 6, .4, 4, DARK);
        glow(x, 5.1, sz + sd / 2 + 3.6, w - 8, .15, .2, dim(SEA, .5));

        // Maglev sidings with freight pod trains.

        const tracks = 2 + Math.floor(r() * 2), tz0 = sz + sd / 2 + 9;
        for (let k = 0; k < tracks; k++) {
          const tz = tz0 + k * 5;
          prop('box', x, .6, tz, w + 6, 1.2, 2, [.07, .07, .08]);
          glow(x, 1.25, tz, w + 6, .08, .5, dim(CYAN, .7));
          if (r() < .7) {
            const n = 3 + Math.floor(r() * 4), px = x0 + 8 + r() * Math.max(0, w - n * 13 - 10);
            for (let p = 0; p < n; p++) {
              prop('box', px + p * 13, 3, tz, 12, 3.2, 3.2, [.13, .13, .14]);
              glow(px + p * 13, 3, tz, 12.1, .3, 3.3, dim(SEA, .6));
            }
          }
        }

        // Container yard under one or two gantries.

        const yz0 = tz0 + tracks * 5, yd = z + d / 2 - 2 - yz0, yc = yz0 + yd / 2;
        if (yd > 8) {
          containers(x, yc, w - 8, yd - 2, 3, r);
          for (let g = r() < .5 ? 2 : 1; g > 0; g--) gantry(x0 + 10 + r() * (w - 20), yc, yd + 1, 18 + r() * 6, r);
        }
        for (const [sx, sz2] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mast(x + sx * (w / 2 - 1), z + sz2 * (d / 2 - 1), 26 + r() * 10, r);
        sign(x, sz, w - 4, sd, sh, cs, r, dim(SEA, .8), { face: 2, blade: false, sw: Math.min(24, w * .3), sh: 3, y: sh - 3, along: 0 });
        sign(x, sz, w - 4, sd, sh, cs, r, dim(SEA, .8), { face: 3, blade: false, sw: Math.min(24, w * .3), sh: 3, y: sh - 3, along: 0 });
      },
    },

    // Corporate tower on a broad glass podium, with a corporate colour band, a podium helipad and plaza lamps.

    corptower: {
      zone: 'chakana',
      build(x, z, w, d, st, r) {
        const cs = chak(st, { lit: .35 }), corp = pick(r, CORP), ph = 18 + r() * 10, pw = w * .9, pd = d * .88;
        slab(x, z, w, d, [.05, .05, .055]);
        bld(x, z, pw, pd, ph, cs, r, { roof: false, skin: SKINS.curtain, lit: .5, glow: .2 });
        for (const y of [ph - .6, 6]) for (const s of [-1, 1]) {
          glow(x, y, z + s * (pd / 2 + .2), pw, .4, .2, dim(corp, y > 6 ? .8 : .35));
          glow(x + s * (pw / 2 + .2), y, z, .2, .4, pd, dim(corp, y > 6 ? .8 : .35));
        }
        const m = Math.min(w, d), tw = m * (.42 + .16 * r()), td = tw * (.8 + .3 * r()), th = 150 + 150 * r();
        const tx = x + (w - tw) * (r() - .5) * .35;
        grammarTowerBody(tx, z, tw, td, th, cs, r, {
          plan: pick(r, ['rect', 'oct', 'round', 'slab', 'cross']), skirt: 'none',
          profile: pick(r, ['setback', 'taper', 'straight', 'twist']), flank: pick(r, ['none', 'fins', 'sidetower']),
          skin: pick(r, [SKINS.curtain, SKINS.fins, SKINS.bands]), crown: pick(r, ['logo', 'helipad', 'ring', 'spire', 'sphere']),
        }, true);

        // Tower lines: corp-colour pinstripes run up two corners.

        for (const s of [-1, 1]) glow(tx + s * tw * .42, th * .5, z + s * td * .42, .3, th * .9, .3, dim(corp, .45));
        const free = (pw - tw) / 2;
        if (free > 16) helipad(x + Math.sign(x - tx || 1) * (pw / 2 - free / 2), z, Math.min(free, pd) * .7, ph, r);
        for (const f of [2, 3]) sign(x, z, pw, pd, ph, cs, r, corp, { face: f, blade: false, sw: Math.min(30, pw * .4), sh: 4, y: ph - 5, along: 0 });
        ringLamps(x, z, w - 1, d - 1, 12, 8, COLD);
        holo(tx, z, tw, td, ph + 20 + r() * 30, r, undefined, 22);
      },
    },

    // Passenger concourse: wide glass hall under a barrel or sawtooth roof, drop-off canopies and a lit plaza.

    concourse: {
      zone: 'chakana',
      build(x, z, w, d, st, r) {
        const cs = chak(st), hw = w * .86, hd = d * .5, hh = 10 + r() * 4, glass = [.16, .3, .4];
        slab(x, z, w, d, [.05, .05, .055]);
        bld(x, z, hw, hd, hh, cs, r, { roof: false, skin: SKINS.curtain, lit: .6, glow: .3 });
        if (r() < .55) {
          barrel(x, hh, z, hw + 4, hd + 4, hd * .7, [.15, .16, .18]);
          for (let k = -hw / 2; k <= hw / 2; k += 9) barrel(x + k, hh, z, .8, hd + 4.6, hd * .7 + .6, DARK);
          glow(x, hh + hd * .35 + .1, z, hw, .15, 2, dim(COLD, .5));
        } else {
          for (let k = -hd / 2 + 4; k < hd / 2; k += 8) {
            prop('box', x, hh + 2.6, z + k, hw + 2, .5, 8.6, [.14, .15, .17], 0, -.6);
            glow(x, hh + 2.6, z + k + 3.8, hw, 4.4, .2, [.3, .5, .65]);
          }
        }

        // Glowing glass fronts with mullions on both long faces.

        for (const s of [-1, 1]) {
          glow(x, hh * .45, z + s * (hd / 2 + .3), hw * .96, hh * .8, .2, glass);
          for (let k = -hw / 2; k <= hw / 2; k += 5) prop('box', x + k, hh * .45, z + s * (hd / 2 + .5), .3, hh * .85, .3, DARK);
          const cz = z + s * (hd / 2 + 6);
          prop('box', x, 5.5, cz, hw * .7, .4, 6, [.12, .12, .13]);
          glow(x, 5.2, cz, hw * .66, .1, 5, dim(COLD, .35));
          for (let k = -hw * .33; k <= hw * .33; k += 10) prop('cyl', x + k, 2.75, cz + s * 2.5, .4, 5.5, .4, DARK);
          for (let k = -hw * .4; k <= hw * .4; k += 9) lamp(x + k, z + s * (d / 2 - 3), 6);
          if (r() < .6) hopper(x + (r() - .5) * hw * .5, 1.3, cz, r, Math.PI / 2);
        }
        for (const s of [-1, 1]) {
          const px = x + s * (w / 2 - 3);
          prop('box', px, 12, z, 1.4, 24, 1.4, DARK);
          glow(px, 18, z, 1.6, 9, 4, dim(s > 0 ? COLD : SEA, .8));
        }
        if (r() < .7) holo(x, z, hw, hd, hh + 10, r, r() < .5 ? 2 : 3, 18);
      },
    },

    // Customs and security compound: walls with gates, scanner arches, watchtowers, inspection sheds and floodlights.

    customs: {
      zone: 'chakana',
      build(x, z, w, d, st, r) {
        const cs = chak(st, { lit: .2 }), ww = w - 4, wd = d - 4, gate = 14, wh = 6;
        slab(x, z, w, d);
        for (const s of [-1, 1]) {
          for (const g of [-1, 1]) prop('box', x + g * (ww + gate) / 4, wh / 2, z + s * wd / 2, (ww - gate) / 2, wh, 1.2, CONCRETE);
          prop('box', x + s * ww / 2, wh / 2, z, 1.2, wh, wd, CONCRETE);
          glow(x + s * (ww / 2 + .7), wh - .5, z, .1, .2, wd - 2, dim(SEA, .35));
        }

        // Gates on both long sides: booth, barrier, scanner arch and a truck queue outside.

        for (const s of [-1, 1]) {
          const gz = z + s * wd / 2;
          prop('box', x - gate / 2 + 1.5, 1.6, gz - s * 2, 2.6, 3.2, 2.6, CARBO);
          glow(x - gate / 2 + 1.5, 2.4, gz - s * 2, 2.7, .8, 2.7, dim(COLD, .5));
          glow(x + 1, 1.1, gz, gate - 4, .25, .25, r() < .5 ? [1.3, .15, .08] : SEA);
          for (const dx of [-5, 5]) prop('box', x + dx, 3.5, gz - s * 7, .8, 7, .8, CARBO);
          prop('box', x, 7.2, gz - s * 7, 11, .8, 1.4, CARBO);
          glow(x, 6.6, gz - s * 7, 9.6, .15, 1, [1.2, .2, .1]);
          for (let k = 0; k < 2 + Math.floor(r() * 3); k++) {
            const tz = gz + s * (4 + k * 9);
            if (Math.abs(tz - z) > d / 2 + 6) break;
            prop('box', x + 2, 2, tz, 2.6, 3.2, 8, pick(r, BOX));
          }
        }

        // Inspection sheds and an operations block.

        const n = 2 + Math.floor(r() * 2), sw = (ww - 10) / n;
        for (let k = 0; k < n; k++) {
          const sx = x - ww / 2 + 5 + sw * (k + .5), sd2 = wd * .32, sz = z + (k % 2 ? 1 : -1) * wd * .14;
          bld(sx, sz, sw - 4, sd2, 8 + r() * 4, cs, r, { skin: SKINS.sparse, lit: .15 });
          for (const f of [-1, 1]) glow(sx, 2.2, sz + f * (sd2 / 2 + .15), Math.min(6, sw * .4), 4, .2, [.85, .8, .65]);
        }
        for (const s of [-1, 1]) annex(x, z + s * wd * .4, ww - 16, wd * .12, cs, r, 6);
        for (const s of [-1, 1]) pool(x, z + s * wd / 2, 12, [.12, .1, .05]);
        const oh = 34 + r() * 20, ox = x + (r() - .5) * ww * .4;
        bld(ox, z, 12, 12, oh, cs, r, { skin: SKINS.bands, lit: .45 });
        for (const s of [-1, 1]) hopper(ox + s * 14, .9, z + s * wd * .3, r, 0);
        H.crownOf('dishes', { x: ox, z, w: 12, d: 12, rot: 0 }, oh, cs, r, SEA);

        // Watchtowers at the corners and floodlight masts between them.

        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const tx = x + sx * (ww / 2 - 1), tz = z + sz * (wd / 2 - 1), th = 18 + r() * 6;
          prop('cyl', tx, th / 2, tz, 2, th, 2, CONCRETE);
          prop('box', tx, th + 1.6, tz, 5, 3.2, 5, CARBO);
          glow(tx, th + 1.8, tz, 5.15, 1, 5.15, [.35, .5, .55]);
          prop('box', tx, th + 3.4, tz, 6, .4, 6, DARK);
          glow(tx - sx * 2.8, th + .2, tz - sz * 2.8, 1.2, .4, 1.2, [1.6, 1.5, 1.2]);
          beacon(tx, th + 4, tz, r);
        }
        for (const s of [-1, 1]) mast(x + s * ww / 4, z, 28 + r() * 6, r);
      },
    },

    // Hotel arcology: a thin slab or twin slabs over a podium, sky lobbies every 40 m, a lit atrium slot.

    arcology: {
      zone: 'chakana',
      build(x, z, w, d, st, r) {
        const cs = chak(st, { lit: .32, win: [.85, .7, .5] }), twin = r() < .45, h = 140 + 100 * r(), corp = pick(r, CORP);
        const sw = w * .82, sd = Math.max(12, d * (twin ? .2 : .3)), offs = twin ? [-1, 1].map(s => s * d * .22) : [0];
        slab(x, z, w, d, [.05, .05, .055]);
        bld(x, z, w * .92, d * .85, 12, cs, r, { roof: false, skin: SKINS.curtain, lit: .8 });
        for (const [i, oz] of offs.entries()) {
          const sh = h * (i ? .82 + .1 * r() : 1);
          let y = 12;
          while (y < sh - 4) {
            const seg = Math.min(sh - y, 34 + r() * 10);
            bld(x, z + oz, sw, sd, seg - 3, cs, r, { y0: y, roof: false, skin: r() < .3 ? SKINS.fins : SKINS.grid, glow: .2 });
            if (y + seg < sh - 4) {
              bld(x, z + oz, sw * .96, sd * .9, 3, cs, r, { y0: y + seg - 3, roof: false, skin: SKINS.curtain, lit: .9 });
              glow(x, y + seg - 1.5, z + oz, sw + .4, .3, sd + .4, dim([.9, .65, .3], .6));
            }
            y += seg;
          }
          for (const s of [-1, 1]) glow(x, (12 + sh) / 2, z + oz + s * (sd / 2 + .25), 2.4, sh - 20, .2, [.5, .62, .75]);
          bld(x - sw * .25, z + oz, sw * .4, sd * .8, 8, cs, r, { y0: sh, roof: true, lit: .3 });
          if (sd > 13) helipad(x + sw * .25, z + oz, Math.min(sd * .85, 16), sh, r);
          else beacon(x + sw * .25, sh + 1, z + oz, r);
          sign(x, z + oz, sw, sd, sh, cs, r, corp, { face: r() < .5 ? 0 : 1, blade: true, sw: 4, sh: Math.min(50, sh * .3), y: sh * .7 });
        }
        if (twin) for (const k of [.45, .75]) {
          const by = h * .82 * k;
          bld(x + (r() - .5) * sw * .4, z, 10, d * .44 - sd, 5, cs, r, { y0: by, roof: false, skin: SKINS.curtain, lit: .9, glow: .3 });
        }
        ringLamps(x, z, w - 1, d - 1, 14, 7, [1.0, .85, .6]);
        holo(x, z + offs[0], sw, sd, 40 + r() * 40, r, offs.length > 1 ? 3 : undefined, 24);
      },
    },

    // Freight tube interchange: banded transplas tubes on pylons over a transfer station, running past the block edges.

    tubeline: {
      zone: 'chakana',
      build(x, z, w, d, st, r) {
        const cs = chak(st), n = 2 + Math.floor(r() * 3), len = w + 14;
        slab(x, z, w, d);
        const sx = x + (r() - .5) * w * .3, stw = Math.min(30, w * .3), sth = 50 + r() * 25;
        bld(sx, z, stw, d * .55, sth, cs, r, { skin: SKINS.bands, lit: .3, glow: .1 });
        for (const s of [-1, 1]) glow(sx + s * (stw / 2 + .2), sth / 2, z, .2, sth - 6, 3, dim(CYAN, .5));
        for (let k = 0; k < n; k++) {
          const tz = z + (k - (n - 1) / 2) * Math.min(9, d * .7 / n), ty = 24 + k * 5 + r() * 4, dia = 4 + r() * 1.5;
          barrel(x, ty, tz, len, dia, dia, [.07, .08, .1]);
          for (let bx = -len / 2 + 3; bx < len / 2; bx += 6) put(GLOWS.ring, x + bx, ty, tz, dia * 1.05, 1, dia * 1.05, Math.PI / 2, Math.PI / 2, dim(CYAN, .55));
          for (let p = 2 + Math.floor(r() * 3); p > 0; p--) glow(x + (r() - .5) * (len - 10), ty, tz, 9, dia * .3, dia * 1.04, dim(k % 2 ? SEA : COLD, .7));
          for (let px = -len / 2 + 6; px < len / 2; px += 18) {
            if (Math.abs(x + px - sx) < stw / 2 + 2) continue;
            prop('box', x + px, ty / 2, tz, 1.4, ty, 1.4, CARBO);
            prop('box', x + px, ty - dia / 2 - .4, tz, 2.2, .8, dia + 1, CARBO);
          }
        }

        // Ground level: conveyor belts with crates and a loading apron.

        for (const s of [-1, 1]) {
          const cz = z + s * d * .38;
          prop('box', x, 1.2, cz, w - 6, .6, 2.4, [.08, .08, .085]);
          glow(x, 1.55, cz + 1.25, w - 6, .1, .1, dim(SEA, .6));
          for (let k = 0; k < 8; k++) prop('box', x + (r() - .5) * (w - 8), 2.2, cz, 2, 1.4, 2, pick(r, BOX));
          for (let k = 0; k < 3; k++) lamp(x + (k - 1) * w * .35, cz + s * 3, 8);
        }
        for (const s of [-1, 1]) {
          const ex = s < 0 ? x - w / 2 + 3 : sx + stw / 2 + 3, fx = s < 0 ? sx - stw / 2 - 3 : x + w / 2 - 3;
          if (fx - ex > 10) annex((ex + fx) / 2, z, fx - ex, d * .55, cs, r, 14);
        }
        mast(sx, z + d * .3, sth + 10, r);
        sign(sx, z, stw, d * .55, sth, cs, r, dim(CYAN, 1.2), { face: 2, blade: false, sw: stw * .8, sh: 3, y: sth - 4, along: 0 });
      },
    },

    // Hopper park: a parking stack with pads on the roof and hoppers coming and going.

    hopperpark: {
      zone: 'chakana',
      build(x, z, w, d, st, r) {
        const cs = chak(st, { lit: .15 }), gw = w * .82, gd = d * .82, gh = 28 + r() * 22;
        slab(x, z, w, d);
        bld(x, z, gw, gd, gh, cs, r, { roof: false, skin: SKINS.bands, lit: .2 });
        for (let y = 7; y < gh - 2; y += 7) for (const s of [-1, 1]) {
          glow(x, y, z + s * (gd / 2 + .3), gw * .94, .2, .2, [.32, .24, .1]);
          glow(x + s * (gw / 2 + .3), y, z, .2, .2, gd * .94, [.32, .24, .1]);
        }
        const nx = Math.max(1, Math.floor(gw / 22)), nz = Math.max(1, Math.floor(gd / 22)), ps = Math.min(gw / nx, gd / nz) * .8;
        for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
          const px = x + (i - (nx - 1) / 2) * gw / nx, pz = z + (j - (nz - 1) / 2) * gd / nz;
          if (r() < .25) {
            put(GLOWS.ring, px, gh + .4, pz, ps * .9, 1, ps * .9, 0, 0, dim(SEA, .9));
            glow(px, gh + .1, pz, ps * .5, .2, ps * .5, [.04, .035, .02]);
          } else {
            helipad(px, pz, ps, gh, r);
            if (r() < .45) hopper(px, gh + 2.4, pz, r);
          }
        }
        for (let k = 2 + Math.floor(r() * 4); k > 0; k--) hopper(x + (r() - .5) * w * 1.3, gh + 15 + r() * 50, z + (r() - .5) * d * 1.3, r);
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) beacon(x + sx * gw / 2, gh + 1, z + sz * gd / 2, r);
        for (const f of [0, 1, 2, 3]) sign(x, z, gw, gd, gh, cs, r, dim(SEA, .9), { face: f, blade: false, sw: 12, sh: 2.4, y: gh - 3, along: 0 });
        for (const s of [-1, 1]) {
          glow(x + s * gw * .25, 2.5, z + s * (gd / 2 + .3), 8, 4.5, .2, [.8, .7, .45]);
          prop('box', x + s * gw * .25, 5.4, z + s * (gd / 2 + 2), 10, .4, 4, DARK);
          pool(x + s * gw * .25, z + s * (gd / 2 + 3), 9, [.1, .08, .04]);
          for (let k = 0; k < 3; k++) truck(x - s * gw * (.1 + k * .12), z + s * (gd / 2 + 4), r, 6, s);
        }
      },
    },

    // Micro-fab campus: stacked clean-room towers with cold blue light, roof vents and pipe bridges between them.

    microfab: {
      zone: 'chakana',
      build(x, z, w, d, st, r) {
        const cs = chak(st, { lit: .22, win: [.45, .65, 1.0] }), n = 2 + Math.floor(r() * 3), gap = 8;
        const tw = (w - 6 - gap * (n - 1)) / n, td = d * (.5 + .15 * r()), BLUE = [.2, .45, 1.1];
        slab(x, z, w, d);
        const tops = [];
        for (let i = 0; i < n; i++) {
          const tx = x - w / 2 + 3 + tw / 2 + i * (tw + gap);
          let y = 0, kw = tw, kd = td;
          for (let t = 2 + Math.floor(r() * 2); t > 0; t--) {
            const h = 14 + r() * 14;
            bld(tx, z, kw, kd, h, cs, r, { y0: y, roof: false, skin: r() < .5 ? SKINS.bands : SKINS.sparse, lit: .2, glow: .15 });
            glow(tx, y + h - .5, z, kw + .4, .3, kd + .4, dim(BLUE, .55));
            y += h; kw *= .86; kd *= .86;
          }
          for (const s of [-1, 1]) glow(tx + s * kw * .3, y * .5, z + s * (td / 2 + .2), 1, y * .8, .2, dim(BLUE, .4));
          for (let v = 0; v < 4 + Math.floor(r() * 4); v++) {
            const vx = tx + (r() - .5) * kw * .7, vz = z + (r() - .5) * kd * .7;
            prop('cyl', vx, y + 2, vz, 1.6, 4, 1.6, [.12, .12, .13]);
            if (r() < .35) put(GLOWS.sphere, vx, y + 6 + r() * 3, vz, 3, 2.2, 3, 0, 0, [.05, .06, .08]);
          }
          tops.push([tx, y]);
        }

        // Pipe bridges between neighbouring towers at two heights.

        for (let i = 0; i < n - 1; i++) {
          const ax = tops[i][0], bx = tops[i + 1][0], top = Math.min(tops[i][1], tops[i + 1][1]);
          for (const f of [.35, .7]) {
            const py = top * f, pz = z + (r() - .5) * td * .5;
            barrel((ax + bx) / 2, py, pz, bx - ax, 1.4, 1.4, [.14, .14, .16]);
            barrel((ax + bx) / 2, py + 1.6, pz, bx - ax, 1, 1, [.1, .1, .12]);
            glow((ax + bx) / 2, py - .9, pz, bx - ax - tw, .1, .3, dim(BLUE, .5));
          }
        }

        // Ground: chiller rows, gas tanks and service annexes on both long sides.

        for (const s of [-1, 1]) {
          const bz = z + s * (td / 2 + (d / 2 - td / 2) / 2), bd = d / 2 - td / 2 - 3;
          if (bd < 5) continue;
          if (r() < .5) annex(x, bz, w - 6, bd, cs, r, 8);
          else {
            for (let cx = x - w / 2 + 5; cx < x + w / 2 - 4; cx += 5) {
              prop('box', cx, 1.3, bz, 4, 2.6, Math.min(bd, 6), [.1, .11, .12]);
              glow(cx, 2.65, bz, 2.4, .1, 2.4, dim(BLUE, .3));
            }
            for (let k = 0; k < 3; k++) prop('cyl', x + (k - 1) * w * .3, 4, bz + s * 1, 3, 8, 3, [.16, .16, .17]);
          }
          pool(x, bz, Math.min(w * .3, 18), [.03, .06, .12]);
        }
        sign(tops[0][0], z, tw, td, tops[0][1], cs, r, dim(BLUE, 1.1), { face: 2, blade: false, sw: tw * .7, sh: 2.4, y: 8, along: 0 });
      },
    },

    // Loading docks: two dock sheds back to front over a deep apron, bays packed with trucks, crawlers queued, conveyors overhead.

    loadingdocks: {
      zone: 'chakana',
      build(x, z, w, d, st, r) {
        const cs = chak(st, { lit: .2 }), sd = d * .24, sh = 12 + r() * 6, gap = 6.5;
        slab(x, z, w, d, [.045, .045, .05]);
        for (const s of [-1, 1]) {
          const sz = z + s * (d / 2 - sd / 2 - 1), face = sz - s * (sd / 2);
          bld(x, sz, w - 2, sd, sh, cs, r, { roof: true, skin: SKINS.bands, lit: .2 });
          prop('box', x, 5.2, face - s * 2.5, w - 2, .4, 5, DARK);
          glow(x, 4.95, face - s * 4.8, w - 4, .12, .15, dim(SEA, .5));
          for (let bx = x - w / 2 + 4; bx < x + w / 2 - 3; bx += gap) {
            const lit = r() < .8;
            glow(bx, 2.1, face - s * .15, 3.6, 3.6, .2, lit ? [.85, .7, .45] : [.1, .09, .07]);
            prop('box', bx, .6, face - s * 1.2, 3, 1.2, 2.4, [.12, .12, .1]);
            if (r() < .7) truck(bx, face - s * 7.2, r, 9, -s);
            if (lit && r() < .4) pool(bx, face - s * 4, 4, [.1, .08, .05]);
          }
        }

        // Middle lane: queued cargo crawlers, then overhead conveyors bridging the two sheds.

        const lane = d - 2 * sd - 30;
        if (lane > 4) for (let cx = x - w / 2 + 8; cx < x + w / 2 - 8; cx += 9) if (r() < .65) {
          const cz = z + (r() - .5) * lane;
          prop('box', cx, 1.1, cz, 7, 2, 4, [.22, .17, .04]);
          prop('box', cx, 2.6, cz, 5, 1.2, 3.4, pick(r, BOX));
          glow(cx, .4, cz, 6, .15, 4.2, dim(SEA, .4));
        }
        for (let k = 0; k < 2 + Math.floor(r() * 2); k++) {
          const cx = x + (k - .5 - r() * .5) * w * .3, cy = sh - 2 + k * 2, span = d - 2 * sd;
          prop('box', cx, cy, z, 3, 1.4, span + 4, [.12, .12, .13]);
          glow(cx, cy - .8, z, .4, .1, span, dim(CYAN, .5));
          for (let b = 0; b < 4; b++) prop('box', cx, cy + 1.1, z + (r() - .5) * span, 1.6, .9, 1.6, pick(r, BOX));
          for (const s of [-1, 1]) prop('box', cx, cy / 2, z + s * span * .25, .8, cy, .8, CARBO);
        }
        for (const s of [-1, 1]) mast(x + s * w * .3, z, 24 + r() * 6, r);
        for (let f = 2; f <= 3; f++) sign(x, z, w - 2, d - 2, sh, cs, r, dim(SEA, .9), { face: f, blade: false, sw: Math.min(20, w * .25), sh: 2.6, y: sh - 2.5, along: (r() - .5) * w * .4 });
      },
    },

    // Transport hub: ground hall, an elevated maglev platform deck under a ribbed glass roof, road ramps at both ends.

    transporthub: {
      zone: 'chakana',
      build(x, z, w, d, st, r) {
        const cs = chak(st, { lit: .35 }), hw = w * .78, hd = d * .72, deck = 14, roofY = 30 + r() * 8;
        slab(x, z, w, d, [.05, .05, .055]);
        bld(x, z, hw, hd, deck - 1, cs, r, { roof: false, skin: SKINS.curtain, lit: .55, glow: .2 });
        prop('box', x, deck, z, hw + 4, 1.2, hd + 4, [.1, .1, .11]);
        glow(x, deck - .7, z, hw + 4.2, .2, hd + 4.2, dim(COLD, .45));

        // Maglev guideways on the deck, running out past the block, with trains at the platforms.

        const n = 2 + Math.floor(r() * 2);
        for (let k = 0; k < n; k++) {
          const tz = z + (k - (n - 1) / 2) * hd * .8 / n;
          prop('box', x, deck + 1.2, tz, w + 20, 1.2, 2.6, [.08, .08, .09]);
          glow(x, deck + 1.85, tz, w + 20, .08, .5, dim(CYAN, .8));
          if (r() < .75) {
            const len = hw * (.5 + .3 * r());
            barrel(x + (r() - .5) * (hw - len), deck + 4, tz, len, 3.6, 3.6, [.16, .17, .19]);
            glow(x, deck + 4.4, tz, len * .95, .8, 3.7, dim(COLD, .55));
          }
          for (const s of [-1, 1]) prop('box', x + s * (w / 2 + 6), deck / 2, tz, 1.4, deck, 1.4, CARBO);
          prop('box', x, deck + 3.4, tz + hd * .4 / n, hw, .3, 1.5, DARK);
        }

        // Glass roof: ribs over lit panels, on tall columns.

        for (let k = -hw / 2; k <= hw / 2; k += 8) {
          barrel(x + k, roofY, z, .7, hd + 6, 10, DARK);
          for (const s of [-1, 1]) prop('box', x + k, (deck + roofY) / 2, z + s * (hd / 2 + 1), .8, roofY - deck, .8, CARBO);
        }
        barrel(x, roofY, z, hw, hd + 5, 9, [.08, .13, .18]);
        glow(x, roofY + 4.4, z, hw - 4, .15, 2, dim(COLD, .6));

        // Road ramps down to the street at both ends, with traffic.

        for (const s of [-1, 1]) {
          const x0 = x + s * hw / 2, x1 = x + s * (w / 2 - 1);
          for (const dz of [-1, 1]) {
            const rz = z + dz * hd * .25;
            ramp(x0, x1, rz, deck - 2, .3, 7, [.09, .09, .1]);
            glow((x0 + x1) / 2, (deck - 2) / 2 + .5, rz + 3.3, Math.abs(x1 - x0), .1, .1, dim(SEA, .5));
            for (let c = 0; c < 2; c++) {
              const t = r();
              glow(x0 + (x1 - x0) * t, (deck - 2) * (1 - t) + 1, rz + (r() - .5) * 3, 3.6, 1.2, 1.8, r() < .5 ? [1, .9, .7] : [1.1, .15, .1]);
            }
          }
          pool(x1, z, 14, [.1, .1, .12]);
        }
        for (const s of [-1, 1]) annex(x, z + s * (hd / 2 + (d - hd) / 4 + 1), hw - 4, (d - hd) / 2 - 4, cs, r, 7);
        for (const f of [2, 3]) sign(x, z, hw, hd, deck, cs, r, dim(COLD, 1.1), { face: f, blade: false, sw: Math.min(26, hw * .3), sh: 3, y: deck - 4, along: 0 });
        if (r() < .7) holo(x, z, hw, hd, roofY + 14, r, undefined, 20);
      },
    },

    // Logistics stack: automated high-bay warehouse towers, crane shafts between them, drone ports on the faces.

    logistack: {
      zone: 'chakana',
      build(x, z, w, d, st, r) {
        const cs = chak(st, { lit: .12 }), n = w > 90 ? 3 : 2, gap = 9, tw = (w * .9 - gap * (n - 1)) / n, td = d * (.5 + .2 * r());
        const GREEN = [.3, 1.2, .5];
        slab(x, z, w, d);
        const xs = Array.from({ length: n }, (_, i) => x - w * .45 + tw / 2 + i * (tw + gap));
        for (const tx of xs) {
          const h = 60 + r() * 60;
          bld(tx, z, tw, td, h, cs, r, { roof: true, skin: SKINS.sparse, lit: .1 });
          for (let y = 10; y < h - 4; y += 10) for (const s of [-1, 1]) glow(tx, y, z + s * (td / 2 + .2), tw * .96, .15, .15, [.12, .2, .3]);

          // Drone ports: lit ledges cantilevered off the long faces, drones hovering.

          for (let k = 2 + Math.floor(r() * 3); k > 0; k--) {
            const s = r() < .5 ? -1 : 1, py = 15 + r() * (h - 25), px = tx + (r() - .5) * tw * .5, pz = z + s * (td / 2 + 3);
            prop('box', px, py, pz, 8, .6, 6, [.12, .12, .13]);
            glow(px, py + .35, pz + s * 2.9, 7, .1, .1, dim(GREEN, .7));
            for (let q = 1 + Math.floor(r() * 3); q > 0; q--) glow(px + (r() - .5) * 10, py + 2 + r() * 8, pz + s * r() * 8, .8, .3, .8, r() < .5 ? dim(GREEN, .9) : [1.2, .2, .1]);
          }
          beacon(tx, h + 1.5, z, r);
        }

        // Crane shafts between towers: open lattice with a lit car.

        for (let i = 0; i < n - 1; i++) {
          const cx = (xs[i] + xs[i + 1]) / 2, ch = 55 + r() * 20;
          prop('lattice', cx, ch / 2, z, gap * .8, ch, td * .8);
          const cy = 6 + r() * (ch - 12);
          prop('box', cx, cy, z, gap * .6, 3, 5, [.25, .2, .05]);
          glow(cx, cy - 1.6, z, gap * .5, .15, 4, dim(SEA, .6));
          glow(cx, ch / 2, z + td * .4, .2, ch, .2, dim(SEA, .35));
        }

        // Truck aprons on both long sides.

        for (const s of [-1, 1]) {
          const az = z + s * (td / 2 + (d - td) / 4);
          for (let tx = x - w / 2 + 5; tx < x + w / 2 - 4; tx += 4.5) if (r() < .55) truck(tx, az, r, Math.min(9, (d - td) / 2 - 4), s);
          pool(x, az, Math.min(20, w * .3), [.08, .09, .1]);
        }
        sign(xs[0], z, tw, td, 40, cs, r, dim(GREEN, .9), { face: 0, blade: true, sw: 3, sh: 24, y: 30 });
      },
    },

    // Power and coolant substation: transformer rows, insulator gantries, cryo feeder trunks running out past the block, cooling towers.

    substation: {
      zone: 'chakana',
      build(x, z, w, d, st, r) {
        const cs = chak(st, { lit: .2 }), FROST = [.35, .85, 1.2], ARC = [.7, .6, 1.4];
        slab(x, z, w, d, [.04, .042, .045]);

        // Superconducting feeder trunks: thick insulated pipes on saddles with frost bands.

        const nt = 2 + Math.floor(r() * 2), ty = 4;
        for (let k = 0; k < nt; k++) {
          const tz = z + (k - (nt - 1) / 2) * 4;
          barrel(x, ty, tz, w + 20, 2.4, 2.4, [.16, .17, .19]);
          for (let bx = -w / 2 - 8; bx < w / 2 + 10; bx += 7) {
            put(GLOWS.ring, x + bx, ty, tz, 2.6, 2, 2.6, Math.PI / 2, Math.PI / 2, dim(FROST, .9));
            if (k === 0) prop('box', x + bx, ty / 2, z, 1, ty, nt * 4 + 1, CARBO);
          }
        }
        pool(x, z, Math.min(w * .4, 26), [.06, .12, .18]);

        // Transformer rows on both sides of the trunk corridor.

        for (const s of [-1, 1]) {
          const rz = z + s * (nt * 2 + 9), cols = Math.floor((w - 30) / 9);
          for (let i = 0; i < cols; i++) {
            const tx = x - w / 2 + 6 + i * 9;
            prop('box', tx, 2.5, rz, 5, 5, 5, [.12, .13, .12]);
            glow(tx, 5.05, rz, 3, .1, 3, dim(FROST, .25));
            for (const f of [-1, 1]) prop('box', tx + f * 3, 2, rz, .8, 3.6, 4.4, [.08, .08, .08]);
            for (let q = -1; q <= 1; q++) prop('cyl', tx + q * 1.4, 6.2, rz, .5, 2.4, .5, [.3, .28, .24]);
            if (r() < .15) H.flickerGlow(tx, 7.6, rz, .5, .5, .5, ARC, r);
          }
          for (let gx = x - w / 2 + 8; gx < x + w / 2 - 20; gx += 18) {
            for (const f of [-1, 1]) prop('box', gx, 7, rz + f * 4, .6, 14, .6, [.15, .15, .16]);
            prop('box', gx, 14, rz, .6, .6, 8.6, [.15, .15, .16]);
          }
        }

        // Cooling towers and a control block at one end.

        const ex = x + w / 2 - 12;
        for (const s of [-1, 1]) {
          const cz = z + s * d * .3, ch = 16 + r() * 8;
          prop('cyl', ex, ch / 2, cz, 10, ch, 10, [.13, .135, .14]);
          put(GLOWS.ring, ex, ch * .8, cz, 10.4, 1, 10.4, 0, 0, dim(FROST, .7));
          put(GLOWS.sphere, ex, ch + 4, cz, 9, 6, 9, 0, 0, [.05, .06, .07]);
        }
        bld(ex, z, 12, Math.min(14, d * .2), 10 + r() * 8, cs, r, { skin: SKINS.bands, lit: .45 });
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mast(x + sx * (w / 2 - 1), z + sz * (d / 2 - 1), 20 + r() * 6, r, [.9, 1, 1.2]);
        for (const s of [-1, 1]) prop('box', x, 1.5, z + s * (d / 2 - .5), w - 2, 3, .3, [.08, .08, .09]);
      },
    },

    // Tourist hotel row: space-themed mid-rise hotels over a souvenir arcade, with Luna rock stalls in front.

    hotelrow: {
      zone: 'chakana',
      build(x, z, w, d, st, r) {
        const cs = chak(st, { lit: .4, win: [1, .78, .5] }), n = Math.max(1, Math.min(3, Math.floor(w / 34))), cw = w / n;
        const hd = Math.max(10, d * .36);
        slab(x, z, w, d, [.05, .05, .055]);

        // Hotels stand on the block's spine. Each has a coloured crown band and its name on both long faces.

        for (let i = 0; i < n; i++) {
          const hx = x - w / 2 + cw * (i + .5), hw = cw * .78, hh = 34 + r() * 56, col = pick(r, HUES), name = pick(r, HOTELS);
          bld(hx, z, hw, hd, hh, cs, r, { skin: pick(r, [SKINS.grid, SKINS.fins, SKINS.bands]) });
          glow(hx, hh - 1.5, z, hw + .4, 1, hd + .4, dim(col, .7));
          bothFaces(name, hx, hh - 6, z, hd / 2, Math.min(hw * .9, 22), col);
          if (hh > 60) beacon(hx, hh + 1, z, r);
        }

        // Souvenir arcade along both long edges: lit shopfronts under flat awnings, and stalls out front on deep blocks.

        for (const s of [-1, 1]) {
          const az = z + s * (d / 2 - 4);
          bld(x, az, w - 4, 6, 5, cs, r, { roof: false, skin: SKINS.curtain, lit: .7, glow: .3 });
          for (let k = -w / 2 + 6; k < w / 2 - 5; k += 7) {
            const col = pick(r, HUES);
            glow(x + k, 2, az + s * 3.1, 5, 2.6, .2, dim(col, .5));
            prop('box', x + k, 4.2, az + s * 4.3, 6, .3, 2.6, dim(col, .3));
          }
          textSign(pick(r, STALLS), x + (r() - .5) * w * .4, 7.5, az + s * 3.2, 12, 3, s > 0 ? 0 : Math.PI, pick(r, HUES));
          if (d > 60) for (let k = Math.floor(w / 14); k > 0; k--) {
            const sx = x + (r() - .5) * (w - 10), sz = az - s * (6 + r() * 4);
            prop('box', sx, 1, sz, 2.4, 2, 1.6, pick(r, BOX));
            prop('box', sx, 2.5, sz, 3, .2, 2.2, dim(pick(r, HUES), .3));
            glow(sx, 2.2, sz, 2, .3, 1.2, [.9, .75, .5]);
          }
        }
        ringLamps(x, z, w - 1, d - 1, 16, 6, [1, .85, .6]);
        if (d > 50) hopper(x + (r() - .5) * w * .5, 1.3, z + (hd / 2 + 4) * (r() < .5 ? -1 : 1), r, Math.PI / 2);
        holo(x, z, w * .8, hd, 30 + r() * 20, r, undefined, 18);
      },
    },

    // Mountainside warehouses: a rock shelf cut with numbered vault bays, a warehouse on the shelf top,
    // a freight lift up the face and trucks queued at the lit bays.

    rockvault: {
      zone: 'chakana',
      build(x, z, w, d, st, r) {
        const cs = chak(st, { lit: .2 }), rh = 18 + r() * 16, rd = d * .55, rz = z - d / 2 + rd / 2, fz = rz + rd / 2;
        slab(x, z, w, d);

        // The rock: a mass with a stepped crest and a few skewed boulders at the back.

        prop('box', x, rh / 2, rz, w, rh, rd, ROCK);
        prop('box', x, rh + 2, rz - rd * .25, w * .9, 4, rd * .45, dim(ROCK, .8));
        for (let k = 0; k < 6; k++) {
          prop('box', x + (r() - .5) * w * .9, rh + 3 + r() * 3, rz - rd * .3 + (r() - .5) * rd * .25, 6 + r() * 8, 4 + r() * 5, 5 + r() * 6, dim(ROCK, .7 + r() * .4), r() * 3);
        }
        const wh = 7 + r() * 6;
        bld(x - w * .1, rz + rd * .2, w * .65, rd * .35, wh, cs, r, { y0: rh, skin: SKINS.sparse, lit: .2 });
        glow(x - w * .1, rh + wh + .2, rz + rd * .2, w * .6, .2, 1.2, dim(COLD, .4));

        // A lit railing runs along the crest, and sodium lamps light the back of the rock.

        glow(x, rh + .6, fz - .4, w - 2, .3, .2, dim(SEA, .5));
        for (let k = -w / 2 + 8; k < w / 2; k += 20) lamp(x + k, rz - rd / 2 - 1.5, 7, SEA);

        // Vault bays: carbosteel frames, red lintel lights, and a truck at each open bay.

        const nb = Math.max(1, Math.floor(w / 16));
        for (let i = 0; i < nb; i++) {
          const bx = x - w / 2 + (i + .5) * w / nb, bw = Math.min(10, w / nb - 3), bh = Math.min(rh - 4, 9);
          prop('box', bx, bh / 2 + .5, fz + .3, bw + 1.6, bh + 1, .8, CARBO);
          glow(bx, bh + 1.6, fz + .8, bw + 1, .3, .2, [1.3, .25, .1]);
          textSign(`BAY ${1 + (i + Math.floor(r() * 9)) % 9}`, bx, bh + 3.4, fz + .5, 6, 1.5, 0, COLD);
          if (r() < .7) {
            glow(bx, bh / 2, fz + .8, bw, bh, .2, dim(SEA, .55));
            pool(bx, fz + 6, 8, dim(SEA, .1));
            if (d - rd > 22) truck(bx, fz + 9, r, 8, -1);
          } else glow(bx, bh / 2, fz + .8, bw, bh, .2, [.05, .045, .03]);
        }

        // Freight lift up the rock face, and the operator's name across the crest.

        const lx = x + w / 2 - 5;
        prop('box', lx, rh / 2 + 2, fz + 1.5, 4, rh + 4, 3, CARBO);
        glow(lx, rh / 2 + 2, fz + 3.1, 1.2, rh, .2, dim(CYAN, .6));
        prop('box', lx, 4 + r() * (rh - 6), fz + 3.4, 3, 2.5, 2, pick(r, BOX));
        textSign(pick(r, VAULTS), x - w * .1, rh - 3, fz + .5, Math.min(w * .5, 28), Math.min(w * .5, 28) / 4, 0, dim(SEA, 1.1));
        if (d - rd > 40) containers(x - w * .2, z + d / 2 - 8, w * .5, 6, 3, r);
        for (let k = -w / 2 + 6; k < w / 2; k += 18) lamp(x + k, z + d / 2 - 2, 8, COLD);
        mast(x - w / 2 + 4, rz - rd / 2 + 4, rh + 14, r);
      },
    },
  };
}

// Northern Chakana landmarks. The Shuttle Hotel, the Weyland Hopper Park and the Museum of Space Travel come from
// Shadow of the Beanstalk. The Luna Rock Bazaar and the Helium-3 depot are invented to fit the district.

export function landmarks(H) {
  const { THREE, SKINS, GLOWS, bld, glow, prop, put, puff, beacon, helipad, holo, textSign, stringLights } = H;
  const { pool, ROCK, HUES, bothFaces, CARBO, DARK, SEA, COLD, CYAN, BOX, pick, dim, chak, slab, lamp, mast, ringLamps, hopper, gantry, truck } = tools(H);
  const GOLD = [2, 1.25, .35], WHITE = [.8, .81, .83], ORANGE = [.7, .28, .07], FROST = [.55, .85, 1.3], WARM = [1.2, .85, .5];

  // Animated parts are plain meshes in the landmark's group. One box geometry serves them all.

  const BOXG = new THREE.BoxGeometry(1, 1, 1);
  const mesh = (mat, x, y, z, sx, sy, sz) => {
    const m = new THREE.Mesh(BOXG, mat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.userData.y = y;
    H.decor.add(m);
    return m;
  };
  const LIFT = { parts: [], top: 0, depth: 0 }, POD = { parts: [], y0: 0, y1: 0 };

  // A rocket on its tail: body, nose cone and lit bands.

  const rocket = (x, z, dia, h, rgb, bands = 2) => {
    prop('cyl', x, h / 2, z, dia, h, dia, rgb);
    prop('cone', x, h + dia * .6, z, dia, dia * 1.2, dia, rgb);
    for (let k = 1; k <= bands; k++) put(GLOWS.ring, x, h * k / (bands + 1), z, dia * 1.06, 1, dia * 1.06, 0, 0, dim(COLD, .35));
    pool(x, z, dia * 1.6, [.12, .12, .14]);
    glow(x, h * .45, z + dia / 2 + .05, dia * .2, h * .85, .1, dim(COLD, .3));
    glow(x, .6, z + dia / 2 + 1.5, 1, .6, .4, [1.1, 1, .9]);
  };

  return {

    // Shuttle Hotel: a space-themed hotel tower behind a podium, with the restaurant inside a full-size
    // replica of the Atlantis launch stack on the podium roof.

    chk_shuttle: {
      at: [630, 45], label: 'Shuttle Hotel', minSide: 50, reach: 420, labelY: 150, face: [0, 1],
      build(x, z, w, d, st, r) {
        const S = chak(st, { lit: .4, win: [1, .8, .55] }), pw = w * .9, pd = d * .8, ph = 14;
        slab(x, z, w, d, [.05, .05, .055]);
        bld(x, z, pw, pd, ph, S, r, { roof: false, skin: SKINS.curtain, lit: .7, glow: .25 });
        glow(x, ph - .5, z + pd / 2 + .3, pw, .5, .2, dim(FROST, .6));

        // The tower stands at the back, with a warm sky lobby every 30 m and an orbit ring round its crown.

        const tw = Math.min(36, w * .4), td = Math.min(26, d * .3), tz = z - pd / 2 + td / 2 + 3, th = 130 + r() * 30;
        for (let y = ph; y < th - 2; y += 30) {
          const seg = Math.min(30, th - y);
          bld(x, tz, tw, td, seg - 2, S, r, { y0: y, roof: false, skin: SKINS.fins });
          bld(x, tz, tw * .97, td * .95, 2, S, r, { y0: y + seg - 2, roof: false, skin: SKINS.curtain, lit: .9 });
        }
        prop('dish', x, th + .5, tz, 9, 6, 9, [.2, .2, .22]);
        put(GLOWS.ring, x, th + 6, tz, tw * 1.5, 1, tw * 1.5, 0, 0, dim(FROST, .8));
        bothFaces('SHUTTLE HOTEL', x, th - 9, tz, td / 2, tw * .9, [.5, .9, 1.6]);
        beacon(x, th + 7, tz, r);
        holo(x, tz, tw, td, 55, r, 0, 24);
        holo(x, tz, tw, td, 90, r, 1, 24);

        // The launch stack: external tank, two boosters, and the orbiter on the side facing the street.

        const sz = z + pd * .18, y0 = ph;
        prop('cyl', x, y0 + 25.5, sz, 8.4, 47, 8.4, ORANGE);
        prop('cone', x, y0 + 51.5, sz, 8.4, 5, 8.4, ORANGE);
        for (const s of [-1, 1]) {
          prop('cyl', x + s * 6.6, y0 + 23.5, sz, 3.7, 45, 3.7, WHITE);
          prop('cone', x + s * 6.6, y0 + 48.5, sz, 3.7, 5, 3.7, WHITE);
          prop('cyl', x + s * 6.6, y0 + .5, sz, 4.6, 1, 4.6, DARK);
          glow(x + s * 6.6, y0 + 23, sz + 1.9, .5, 44, .1, dim(COLD, .45));
        }

        // Floodlights wash the stack from the podium roof.

        glow(x, y0 + 26, sz + 4.3, 2, 46, .1, dim([1.4, .6, .2], .4));
        const oz = sz + 7;
        prop('cyl', x, y0 + 21, oz, 5.2, 30, 5.2, WHITE);
        prop('cone', x, y0 + 39, oz, 5.2, 6, 5.2, WHITE);
        prop('box', x, y0 + 21, oz - 2.5, 4.6, 28, .4, [.04, .04, .045]);
        prop('box', x, y0 + 13, oz, 24, 14, .8, WHITE);
        prop('box', x, y0 + 22, oz, 13, 6, .8, WHITE);
        prop('box', x, y0 + 10, oz + 5, .8, 10, 6, WHITE);
        for (let k = -1; k <= 1; k++) prop('cyl', x + k * 1.5, y0 + 5, oz, 1.3, 2, 1.3, DARK);

        // The restaurant inside the orbiter: lit window strips and a warm cockpit.

        glow(x, y0 + 22, oz + 2.7, 1.4, 16, .2, WARM);
        glow(x, y0 + 34, oz + 2.4, 2.4, 1.2, .2, [1.4, 1.1, .7]);
        for (const s of [-1, 1]) glow(x + s * 1.9, y0 + 22, oz + 1.8, .2, 14, .8, dim(WARM, .6));
        textSign('ATLANTIS', x, ph + 3, z + pd / 2 + .4, 14, 3.5, 0, [1.6, .9, .3]);
        prop('lattice', x - 12, y0 + 30, sz - 4, 4, 60, 4, [.3, .1, .05]);
        for (const s of [-1, 1]) {
          glow(x + s * 14, y0 + .8, oz + 8, 1.2, 1.2, .6, [1.4, 1.3, 1.1]);
          pool(x + s * 8, sz, 12, [.18, .17, .15]);
        }

        // Drop-off: hoppers at the door, lamps round the block.

        for (let k = 0; k < 3; k++) hopper(x + (k - 1) * 10, 1.3, z + pd / 2 + 5, r, Math.PI / 2);
        ringLamps(x, z, w - 1, d - 1, 16, 7, [1, .85, .6]);
      },
    },

    // Weyland Hopper Park: a parking vault sunk into the mountainside. Hoppers land on the rooftop pads,
    // and a lift pad lowers them into the rock.

    chk_hopperpark: {
      at: [545, 55], label: 'Weyland Hopper Park', minSide: 50, reach: 420, labelY: 60, face: [0, 1],
      build(x, z, w, d, st, r) {
        const S = chak(st, { lit: .3 }), rh = 26, z0 = z - d / 2, z1 = z + d * .3, fz = z1;
        slab(x, z, w, d);

        // The rock in four pieces round an open lift well, then the deck on top in the same pieces.

        const wx = x + w * .25, wz = (z0 + z1) / 2, wr = 6.5;
        const around = (y, h, rgb) => {
          const cut = (ax, bx, az, bz) => bx - ax > .5 && bz - az > .5 && prop('box', (ax + bx) / 2, y + h / 2, (az + bz) / 2, bx - ax, h, bz - az, rgb);
          cut(x - w / 2, wx - wr, z0, z1);
          cut(wx + wr, x + w / 2, z0, z1);
          cut(wx - wr, wx + wr, z0, wz - wr);
          cut(wx - wr, wx + wr, wz + wr, z1);
        };
        around(0, rh, ROCK);

        // Raw mountainside breaks through at the back and the flanks.

        for (let k = 0; k < 10; k++) {
          const side = k % 3, bx = side ? x + (side === 1 ? -1 : 1) * (w / 2 - 2) : x + (r() - .5) * w, bz = side ? z0 + r() * (z1 - z0) * .8 : z0 + 2;
          prop('box', bx, rh * (.5 + r() * .4), bz, 5 + r() * 7, rh * (.8 + r() * .6), 5 + r() * 7, dim(ROCK, .8 + r() * .5), r() * 3);
        }
        around(rh, .8, [.06, .06, .065]);
        glow(wx, rh - 14, wz, wr * 2 - .5, .2, wr * 2 - .5, dim(SEA, .5));
        for (const s of [-1, 1]) {
          glow(wx + s * wr, rh + .9, wz, .2, .2, wr * 2, dim(SEA, .9));
          glow(wx, rh + .9, wz + s * wr, wr * 2, .2, .2, dim(SEA, .9));
        }

        // Pads in a grid on the deck, most with a hopper parked.

        const dw = w - 8, dd = z1 - z0 - 8, nx = Math.max(1, Math.floor(dw / 16)), nz = Math.max(1, Math.floor(dd / 16));
        for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
          const px = x - dw / 2 + (i + .5) * dw / nx, pz = z0 + 4 + (j + .5) * dd / nz;
          if (Math.abs(px - wx) < wr + 6 && Math.abs(pz - wz) < wr + 6) continue;
          helipad(px, pz, 11, rh + .8, r);
          if (r() < .6) hopper(px, rh + 3.2, pz, r);
        }

        // The automated ticket office for ID and DNA checks.

        const ox = x - w / 2 + 10, oz = z1 - 7;
        bld(ox, oz, 6, 5, 4, S, r, { y0: rh + .8, roof: false, skin: SKINS.curtain, lit: .9, glow: .4 });
        textSign('ID · DNA', ox, rh + 6.6, oz + 2.9, 6, 1.5, 0, [.4, 1.6, .7]);

        // Street face: two parking levels behind lit slits, the vault door and the Weyland name.

        for (const y of [4, 9]) glow(x, y, fz + .2, w * .92, .7, .2, [.42, .3, .12]);
        glow(x - w * .3, 2.6, fz + .2, 10, 5, .2, dim(SEA, .6));
        pool(x - w * .3, fz + 6, 10, dim(SEA, .1));
        const nw = Math.min(w * .6, 48);
        textSign('WEYLAND HOPPER PARK', x, rh - 7, fz + .5, nw, nw / 4, 0, GOLD);
        for (const [sx, sz] of [[-1, z0 + 2], [1, z0 + 2], [-1, z1 - 2], [1, z1 - 2]]) mast(x + sx * (w / 2 - 2), sz, rh + 12, r, [1.3, 1.1, .7]);
        for (let k = 3 + Math.floor(r() * 3); k > 0; k--) hopper(x + (r() - .5) * w, rh + 20 + r() * 40, z + (r() - .5) * d, r);
        for (let k = -w / 2 + 6; k < w / 2; k += 16) lamp(x + k, z + d / 2 - 2, 7, COLD);

        // The lift pad with its hopper. update() lowers it into the well and brings it back up.

        const dark = new THREE.MeshStandardMaterial({ color: 0x1a1b1f, roughness: .6, metalness: .5 });
        const blue = new THREE.MeshBasicMaterial({ color: new THREE.Color(.25, .55, 1.1) });
        LIFT.top = rh + .6; LIFT.depth = 13;
        LIFT.parts = [mesh(dark, wx, 0, wz, wr * 2 - .8, .6, wr * 2 - .8), mesh(dark, wx, 1.5, wz, 3, 1.6, 6), mesh(blue, wx, .6, wz, 1.6, .15, 4)];
      },
      update(t) {
        const p = (t * .04) % 1, f = p < .35 ? 0 : p < .5 ? (p - .35) / .15 : p < .85 ? 1 : 1 - (p - .85) / .15;
        const y = LIFT.top - LIFT.depth * f * f * (3 - 2 * f);
        for (const m of LIFT.parts) m.position.y = y + m.userData.y;
      },
    },

    // Jack Weyland Museum of Space Travel: a glass hall with a planetarium cone, a rocket garden out front
    // and a model of the Beanstalk with a beanpod climbing it.

    chk_museum: {
      at: [700, 115], label: 'Museum of Space Travel', minSide: 50, reach: 420, labelY: 120, face: [0, 1],
      build(x, z, w, d, st, r) {
        const S = chak(st, { lit: .5, win: [.95, .9, .8] }), hz = z - d * .28, hd = d * .3, hw = w * .8;
        slab(x, z, w, d, [.06, .06, .065]);
        bld(x, hz, hw, hd, 16, S, r, { roof: false, skin: SKINS.curtain, lit: .7, glow: .3 });
        glow(x, 7, hz + hd / 2 + .3, hw * .95, 12, .2, [.25, .32, .4]);
        const nw = Math.min(hw * .6, 48);
        textSign('MUSEUM OF SPACE TRAVEL', x, 19, hz + hd / 2 + .4, nw, nw / 4, 0, GOLD);
        textSign('JACK WEYLAND', x, 10, hz - hd / 2 - .4, Math.min(hw * .4, 30), Math.min(hw * .4, 30) / 4, Math.PI, GOLD);

        // Planetarium: a dark cone roof with a lit ring and stars on the hall roof.

        const px = x - hw * .28;
        prop('cyl', px, 18, hz, 22, 4, 22, [.1, .1, .12]);
        prop('cone', px, 25, hz, 22, 10, 22, [.08, .08, .1]);
        put(GLOWS.ring, px, 20.2, hz, 22.4, 1, 22.4, 0, 0, dim(CYAN, .8));
        for (let k = 0; k < 12; k++) glow(x + (r() - .5) * hw * .5 + hw * .2, 16.2, hz + (r() - .5) * hd * .8, .3, .1, .3, [1.2, 1.2, 1.4]);

        // Rocket garden in a lit arc across the front court.

        const fz = z + d * .2, sp = Math.min(w * .14, 16);
        const fleet = [[2.6, 30, WHITE, 1], [3.4, 38, [.4, .42, .38], 2], [10, 92, WHITE, 3], [3.7, 48, [.45, .46, .5], 2], [2.2, 24, [.5, .45, .3], 1]];
        fleet.forEach(([dia, h, rgb, b], i) => rocket(x + (i - 2) * sp, fz + Math.abs(i - 2) * 4 - 4, dia, h, rgb, b));

        // Moon-dust footprint court with its sign.

        const mz = z + d / 2 - 7;
        prop('box', x - w * .4, .3, mz, 8, .4, 6, [.32, .32, .33]);
        glow(x - w * .4, .55, mz, 7.4, .1, 5.4, [.18, .18, .2]);
        textSign('REAL MOON DUST', x - w * .4, 3, mz - 3.2, 8, 2, 0, COLD);

        // The Beanstalk model: a lit cable from a dark base up to a counterweight, and a pod climbing it.

        const bx = x + w * .4, bz = hz + hd / 2 + 5, top = 70;
        prop('cone', bx, 3, bz, 9, 6, 9, [.08, .08, .09]);
        glow(bx, top / 2 + 3, bz, .5, top, .5, dim(FROST, .9));
        prop('box', bx, top + 4, bz, 3, 2, 3, [.2, .2, .22]);
        textSign('BEANSTALK MODEL', bx, 7.5, bz + 4.8, 8, 2, 0, dim(FROST, 1.2));
        const podMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.4, .5) });
        POD.y0 = 7; POD.y1 = top;
        POD.parts = [mesh(podMat, bx, 7, bz, 1.6, 2.4, 1.6)];

        for (let k = -w / 2 + 6; k < w / 2; k += 14) lamp(x + k, z + d / 2 - 2, 6, WARM);
        for (const s of [-1, 1]) lamp(x + s * (w / 2 - 2), fz, 6, WARM);
        holo(x, hz, hw, hd, 36, r, 3, 20);
      },
      update(t) {
        const p = (t * .03) % 1, f = p < .5 ? p * 2 : 2 - p * 2;
        for (const m of POD.parts) m.position.y = POD.y0 + (POD.y1 - POD.y0) * f * f * (3 - 2 * f);
      },
    },

    // Luna Rock Bazaar (invented): an open souvenir market under neon-edged canopies. Traders sell
    // Martian-made trinkets and chunks of Luna rock to tourists, under a fake moon on a mast.

    chk_bazaar: {
      at: [585, 125], label: 'Luna Rock Bazaar', minSide: 40, reach: 420, labelY: 45, face: [0, 1],
      build(x, z, w, d, st, r) {
        slab(x, z, w, d, [.06, .055, .05]);

        // Striped canopies on posts, each with a coloured rim. The gaps show the stalls below.

        const cw = w - 8, cd = d - 8, nx = Math.max(1, Math.floor(cw / 30)), nz = Math.max(1, Math.floor(cd / 30));
        for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
          const cx = x - cw / 2 + (i + .5) * cw / nx, cz = z - cd / 2 + (j + .5) * cd / nz, aw = cw / nx - 3, ad = cd / nz - 3, ay = 7 + r() * 2, col = pick(r, HUES);
          for (let k = -ad / 2 + 1.5; k < ad / 2 - 1; k += 4) prop('box', cx, ay, cz + k, aw, .2, 2.4, dim(col, k % 8 < 4 ? .3 : .12));
          for (const s of [-1, 1]) {
            glow(cx, ay - .2, cz + s * ad / 2, aw, .25, .2, dim(col, .7));
            glow(cx + s * aw / 2, ay - .2, cz, .2, .25, ad, dim(col, .7));
            for (const q of [-1, 1]) prop('cyl', cx + s * (aw / 2 - .5), ay / 2, cz + q * (ad / 2 - .5), .35, ay, .35, DARK);
          }
          stringLights([cx - aw / 2, ay - .4, cz], [cx + aw / 2, ay - .4, cz], 1.2, 8, [1.2, .9, .5]);

          // Stalls in two rows under each canopy, lit counters and crates of rock behind.

          for (const q of [-1, 1]) for (let k = -aw / 2 + 3; k < aw / 2 - 2; k += 4.5) {
            const sz = cz + q * ad * .25;
            prop('box', cx + k, .6, sz, 3, 1.2, 1.6, pick(r, BOX));
            glow(cx + k, 1.25, sz - q * .85, 2.6, .25, .1, dim(pick(r, HUES), .45));
            if (r() < .5) prop('box', cx + k + (r() - .5), 1.5, sz + q * .5, .8, .6, .8, ROCK);
          }
        }

        // Shop names over the aisles, and the fake moon on its mast.

        const words = ['GENUINE LUNA ROCK', 'MARS-MADE', 'HE-3 CANDY', 'SOUVENIRS', 'TWO FOR ONE'];
        for (let k = 0; k < 5; k++) {
          const tx = x + (r() - .5) * cw * .8, tz = z + (r() - .5) * cd * .8, ry = r() < .5 ? 0 : Math.PI;
          textSign(words[k], tx, 10.5, tz, 10, 2.5, ry, pick(r, HUES));
        }
        prop('cyl', x, 16, z, .8, 32, .8, DARK);
        put(GLOWS.sphere, x, 36, z, 7, 7, 7, 0, 0, [.42, .42, .4]);
        pool(x, z, 24, [.16, .16, .15]);
        textSign('LUNA ROCK BAZAAR', x, 26, z + .6, 18, 4.5, 0, [1.6, 1.4, .9]);

        // Tour hoppers waiting at the kerb.

        for (let k = 0; k < 2; k++) {
          const tx = x - w / 2 + 8 + k * 12;
          prop('box', tx, 2, z + d / 2 - 3, 10, 3.2, 3.2, [.3, .26, .08]);
          glow(tx, 2.4, z + d / 2 - 1.3, 8.6, .9, .1, WARM);
        }
        ringLamps(x, z, w - 1, d - 1, 14, 6, WARM);
      },
    },

    // Helium-3 Down-Stalk Depot (invented): a walled cryo yard where cargo pods from the Beanstalk unload
    // helium-3 into frost-ringed tanks under SEA customs seals.

    chk_helium: {
      at: [610, 205], label: 'Helium-3 Depot', minSide: 50, reach: 420, labelY: 50, face: [0, 1],
      build(x, z, w, d, st, r) {
        const S = chak(st, { lit: .3 }), hw = w / 2 - 1.5, hd = d / 2 - 1.5;
        slab(x, z, w, d, [.05, .052, .056]);
        for (const [fx, fz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          prop('box', x + fx * hw, 3, z + fz * hd, fx ? 1 : w - 3, 6, fx ? d - 3 : 1, [.07, .075, .08]);
          glow(x + fx * (hw + .6), 5.6, z + fz * (hd + .6), fx ? .1 : w - 3, .2, fx ? d - 3 : .1, dim(SEA, .5));
        }

        // Tank farm on the back half: tall cryo tanks with frost rings and stencilled names.

        const tz0 = z - d / 2 + 10, tz1 = z - 4, nx = Math.max(1, Math.floor((w - 12) / 13)), nz = Math.max(1, Math.floor((tz1 - tz0) / 13));
        for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
          const tx = x - (w - 12) / 2 + (i + .5) * (w - 12) / nx, tz = tz0 + (j + .5) * (tz1 - tz0) / nz, th = 18 + r() * 8;
          prop('cyl', tx, th / 2, tz, 9, th, 9, [.24, .25, .27]);
          prop('cone', tx, th + 1.2, tz, 9, 2.4, 9, [.22, .23, .25]);
          for (const f of [.3, .7]) put(GLOWS.ring, tx, th * f, tz, 9.3, 1, 9.3, 0, 0, dim(FROST, .6));
          if (j === nz - 1) textSign('HE-3', tx, th * .5, tz + 4.7, 5, 1.25, 0, [1.4, .3, .2]);
          if (r() < .3) puff(tx + (r() - .5) * 4, th + 2.5, tz, 3 + r() * 2, [.18, .21, .25]);
        }

        // The pod cradle on the front half: a down-Stalk cargo pod on its rails, under a gantry.

        const pz = z + d * .22, pl = Math.min(30, w * .5);
        for (const s of [-1, 1]) prop('box', x, .4, pz + s * 3, w - 6, .4, .5, [.2, .2, .22]);
        prop('box', x, 6, pz, pl, 10, 9, [.16, .17, .19]);
        for (let k = -pl / 2 + 2; k < pl / 2; k += 4) prop('box', x + k, 6, pz, .8, 10.6, 9.6, CARBO);
        for (const s of [-1, 1]) glow(x, 6, pz + s * 4.85, pl - 2, .3, .1, dim(FROST, .8));
        glow(x + pl / 2 + .2, 9, pz, .1, 1.2, 1.2, [.3, 1.5, .4]);
        textSign('SEA SEALED', x, 12.6, pz + 4.6, 9, 2.25, 0, [.4, 1.5, .5]);
        gantry(x, pz, 16, 18, r);

        // Pipe rack from the cradle to the tanks, and a customs booth at the gate.

        for (const s of [-1, 1]) prop('box', x + s * 4, 8, (pz + tz1) / 2, 1, 1, pz - tz1, [.2, .2, .22]);
        for (let k = tz1; k < pz; k += 6) prop('box', x, 4, k, 9, 8, .4, [.12, .12, .13]);
        const gx = x - w / 2 + 8, gz = z + d / 2 - 6;
        bld(gx, gz, 6, 5, 4, S, r, { roof: false, skin: SKINS.curtain, lit: .9, glow: .4 });
        textSign('HE-3 BONDED', gx, 5.6, gz + 2.8, 8, 2, 0, [1.4, .9, .2]);
        truck(x + w * .3, gz, r, 10, 1);
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mast(x + sx * (w / 2 - 3), z + sz * (d / 2 - 3), 24, r, [.9, 1, 1.2]);
      },
    },
  };
}
