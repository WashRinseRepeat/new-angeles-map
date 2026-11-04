// What Nuremberg's landmark families share: the palette, and helpers that seat one landmark per city.json site of a
// kind. Each stands free at its site; the engine seats a free landmark unturned, so a turned site turns its own
// parts through at(u, v). Every part stands on the ground at its own spot.

export const HALF_PI = Math.PI / 2;
export const SAND = [.32, .22, .16], PLASTER = [.44, .4, .32], RED = [.38, .15, .08], BROWN = [.28, .12, .07];
export const SLATE = [.16, .16, .17], COPPER = [.16, .3, .24], GOLD = [.62, .46, .16], DARK = [.1, .09, .08], WOOD = [.16, .11, .06];

export function helpers(H, out) {
  const { bld, prop, glow, SKINS, CITY } = H;
  const sitesOf = kind => (CITY.sites ?? []).filter(s => s.kind === kind);
  const site = kind => sitesOf(kind)[0];
  const slug = s => s.name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const turn = (a, u, v) => [u * Math.cos(a) - v * Math.sin(a), u * Math.sin(a) + v * Math.cos(a)];
  const opt = o => ({ roof: false, kibble: false, ...o });
  const STONE = (st, lit = 0, base = SAND) => ({ ...st, base, lit, grime: .4 });
  const pick3 = r => [[.9, .2, .15], [.2, .35, 1], [.9, .7, .2], [.25, .7, .3]][Math.floor(r() * 4)];

  // A landmark per site, keyed by kind and index, with its label and slug.

  const add = (s, i, lm) => { out[`nb_${s.kind}_${i}`] = { at: s.at, free: [s.w, s.d], label: s.name, slug: slug(s), labelY: 24, ...lm }; };
  const each = (kind, make) => sitesOf(kind).forEach((s, i) => add(s, i, make(s, (u, v) => turn(s.rot, u, v), s.rot)));

  // A church tower: a square shaft, an octagonal belfry and a slate spire.

  const tower = (x, z, side, h, spire, st, r, ry = 0) => {
    bld(x, z, side, side, h, STONE(st, .05), r, opt({ skin: SKINS.stone, ry }));
    bld(x, z, side * .8, side * .8, side * 1.2, STONE(st, .05), r, opt({ y0: h, shape: 'oct', skin: SKINS.stone }));
    prop('cone', x, h + side * 1.2 + spire / 2, z, side * .85, spire, side * .85, SLATE);
    prop('box', x, h + side * 1.2 + spire + 1, z, .2, 2, .2, GOLD);
  };

  // Coloured windows down both sides of a hall, as glows.

  const windows = (at, a, u0, u1, half, y, h, r) => {
    for (let u = u0; u <= u1; u += 6) for (const v of [-1, 1]) {
      const [gx, gz] = at(u, v * (half + .05));
      const along = Math.abs(Math.cos(a)) > .5;
      glow(gx, y, gz, along ? 1.6 : .06, h, along ? .06 : 1.6, pick3(r).map(c => c * .45));
    }
  };
  return { sitesOf, site, slug, turn, opt, STONE, pick3, add, each, tower, windows };
}

// The town's house palette. bld() varies each part's base by up to 30 %, so these are mid tones. Stones run from
// red-brown Burgsandstein to yellow-grey, pinkish and dark weathered. Plasters run ochre, white, pale pink, cream,
// grey-green and ox-blood. Roofs run through reds and browns.

export const STONES = [[.34, .2, .14], [.32, .22, .16], [.36, .31, .23], [.38, .25, .2], [.23, .18, .15]];
export const PLASTERS = [[.46, .35, .18], [.5, .48, .43], [.48, .38, .33], [.48, .42, .3], [.4, .41, .35], [.34, .12, .08]];
export const ROOF_TONES = [[.38, .15, .08], [.38, .15, .08], [.28, .12, .07], [.44, .2, .1], [.3, .1, .06], [.27, .18, .13]];
export const FRAME_FILL = [[.5, .48, .43], [.48, .42, .3], [.46, .38, .24], [.48, .4, .35]];
export const LEAF = [[.06, .13, .05], [.08, .15, .06], [.1, .16, .06], [.05, .11, .06], [.07, .12, .04]];

// Trees for yards, courts and gardens. A crown is clumps of an upright and a lying cylinder, crossed, which read
// as rounded. The kinds are round (linden, oak, chestnut), fruit, poplar and fir. tree() picks one by chance.

export function trees(H) {
  const { prop } = H;
  const pickOf = (r, list) => list[Math.floor(r() * list.length)];
  const leaf = r => { const v = .85 + .3 * r(); return r() < .05 ? [.14 * v, .07 * v, .06 * v] : pickOf(r, LEAF).map(c => c * v); };
  const bark = r => r() < .5 ? [.12, .08, .05] : [.1, .09, .07];
  const clump = (x, y, z, dia, rgb, r) => {
    prop('cyl', x, y, z, dia, dia * .7, dia, rgb, r() * Math.PI);
    prop('cyl', x, y, z, dia * .75, dia * .95, dia * .85, rgb, r() * Math.PI, HALF_PI);
  };
  const KINDS = {
    round(x, z, r) {
      const h = 8 + r() * 4, dia = 5 + r() * 2.5, cy = h * .62, rgb = leaf(r);
      prop('cyl', x, h * .3, z, .45, h * .6, .45, bark(r));
      clump(x, cy, z, dia, rgb, r);
      for (let k = 1 + (r() < .5); k > 0; k--) {
        const a = r() * 2 * Math.PI, sub = rgb.map(c => c * (.9 + .2 * r()));
        clump(x + Math.cos(a) * dia * .35, cy + (r() - .3) * dia * .3, z + Math.sin(a) * dia * .35, dia * (.55 + r() * .15), sub, r);
      }
    },
    fruit(x, z, r) {
      const dia = 3 + r() * 1.5, cy = 2.4 + r() * .6, rgb = leaf(r);
      prop('cyl', x, .8, z, .25, 1.6, .25, bark(r));
      prop('cyl', x, cy, z, dia, dia * .45, dia, rgb, r() * Math.PI);
      prop('cyl', x, cy + .2, z, dia * .7, dia * .9, dia * .7, rgb, r() * Math.PI, HALF_PI);
      if (r() < .3) {
        const c = r() < .6 ? [.45, .1, .05] : [.5, .4, .1];
        for (let k = 0; k < 4; k++) {
          const a = r() * 2 * Math.PI;
          prop('box', x + Math.cos(a) * dia * .48, cy - .1 + r() * .4, z + Math.sin(a) * dia * .48, .2, .2, .2, c);
        }
      }
    },
    poplar(x, z, r) {
      const h = 12 + r() * 5, dia = 2 + r() * .7, rgb = leaf(r);
      prop('cyl', x, 1.5, z, .35, 3, .35, bark(r));
      prop('cyl', x, 2.5 + (h - 4.5) / 2, z, dia, h - 4.5, dia, rgb, r() * Math.PI);
      prop('cone', x, h - 1, z, dia, 3, dia, rgb);
    },
    fir(x, z, r) {
      const h = 7 + r() * 5, rgb = [.04, .09 + r() * .03, .05];
      prop('cyl', x, h * .15, z, .35, h * .3, .35, bark(r));
      prop('cone', x, h * .55, z, h * .45, h * .85, h * .45, rgb);
    },
  };
  const tree = (x, z, r, kind) => KINDS[kind ?? (r() < .5 ? 'round' : r() < .65 ? 'fruit' : r() < .7 ? 'poplar' : 'fir')](x, z, r);
  return { tree, KINDS };
}
