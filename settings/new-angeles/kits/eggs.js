// Easter eggs in the city. Each takes a small block and has no label or card, so only a sharp eye finds it.
// The sea, the jungle and the mountains hold the rest (landmarks/eggs.js).

const dim = (rgb, k) => rgb.map(c => c * k);
const PINK = [1.8, .35, 1.1], EMBER = [1.9, .55, .12], CYAN = [.4, 1.4, 1.7], WARM = [1.4, .85, .4];

function eggs(H) {
  const { beam, glow, prop, puff, textSign, flickerGlow } = H;
  const pool = (x, z, rad, rgb) => H.pool?.(x, z, rad, rgb);
  const front = () => { const f = H.frame()?.front ?? { x: 0, z: 1 }; return [f.x, f.z, Math.atan2(f.x, f.z)]; };

  // A figure in a dark coat, standing. Bioroids get cyan eyes.

  const figure = (x, z, ry, coat, eyes) => {
    prop('box', x, .9, z, .55, 1.8, .35, coat, ry);
    prop('box', x, 2, z, .32, .38, .32, [.5, .48, .46], ry);
    if (eyes) for (const s of [-.08, .08]) glow(x + Math.cos(ry) * s + Math.sin(ry) * .17, 2.05, z - Math.sin(ry) * s + Math.cos(ry) * .17, .05, .04, .02, eyes, ry);
  };

  return {

    // "Gabe was here": Gabriel Santiago's tag on a tall old water tower over the Rabotgorod blocs.

    egg_gabe: {
      at: [657, 1001], minSide: 12, reach: 220,
      build(x, z, w, d, st, r) {
        const [fx, fz, fy] = front(), R = 3.4, Y = 34, LEG = [.12, .1, .09];
        prop('box', x, .1, z, w, .2, d, [.045, .042, .04]);
        for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) prop('cyl', x + a * 2.6, Y / 2, z + b * 2.6, .4, Y, .4, LEG);
        for (let y = 6; y < Y - 2; y += 8) for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]].map((p, i, A) => [p, A[(i + 1) % 4]]))
          beam([x + a[0] * 2.6, y, z + a[1] * 2.6], [x + b[0] * 2.6, y + 8, z + b[1] * 2.6], .14, LEG);
        prop('cyl', x, Y + 2.6, z, R * 2, 5.2, R * 2, [.2, .17, .14]);
        prop('cone', x, Y + 6.2, z, R * 2.2, 2, R * 2.2, [.14, .12, .1]);
        for (const s of [1, -1]) {
          textSign('GABE WAS HERE', x + s * fx * (R + .05), Y + 2.7, z + s * fz * (R + .05), 5.6, 1.3, fy + (s < 0 ? Math.PI : 0), [1.6, .3, .25]);
          glow(x + s * fx * (R + .04) - fz * 1.9, Y + 1.4, z + s * fz * (R + .04) + fx * 1.9, .9, .12, .05, dim(CYAN, .8), fy);
        }
        flickerGlow(x + fx * 2.6, Y + .6, z + fz * 2.6, .4, .3, .4, WARM, r);
        pool(x, z, 9, [.08, .05, .02]);
      },
    },

    // Hedge Fund: a pink vending machine in a Rabotgorod back lot, with a bored bioroid waiting at it.

    egg_hedge: {
      at: [535, 985], minSide: 24, reach: 260,
      build(x, z, w, d, st, r) {
        // The machine stands in the middle of the lot with its lit front to the street side, where the bioroid waits.

        const [fx, fz, fy] = front(), mx = x + fx * 1.5, mz = z + fz * 1.5;
        prop('box', x, .1, z, w, .2, d, [.04, .04, .045]);
        prop('box', mx - fx * .5, 1.05, mz - fz * .5, 1.3, 2.1, .9, [.25, .08, .18], fy);
        glow(mx - fx * .97, 1.15, mz - fz * .97, 1, 1.5, .05, PINK, fy);
        textSign('HEDGE FUND', mx - fx * .99, 2.35, mz - fz * .99, 1.2, .3, fy + Math.PI, [1.8, 1.6, 1.7]);
        figure(mx - fx * 2.2, mz - fz * 2.2, fy, [.32, .34, .36], [.4, 1.6, 1.8]);
        for (let k = 0; k < 4; k++) prop('box', mx + (r() - .5) * 4, .35, mz - fx * (r() - .5) * 3 - fz * 2, .8, .7, .7, [.03, .03, .03], r() * 3);
        pool(mx, mz, 6, [.12, .03, .08]);
      },
    },

    // Scorched Earth: a lot burnt to a crater, a melted car on its rim and embers still glowing in the ash.

    egg_scorched: {
      at: [500, 935], minSide: 24, reach: 250,
      build(x, z, w, d, st, r) {
        const R = Math.min(w, d) * .42;
        prop('box', x, .1, z, w, .2, d, [.03, .025, .02]);
        prop('cyl', x, .14, z, R * 2.3, .2, R * 2.3, [.018, .015, .013]);
        for (let k = 0; k < 14; k++) {
          const a = k / 14 * 6.3 + r() * .3;
          prop('box', x + Math.cos(a) * R, .5, z + Math.sin(a) * R, 3 + r() * 3, 1 + r(), 2 + r() * 2, [.04, .033, .028], -a);
        }
        prop('box', x + R * .55, .7, z - R * .3, 2, .9, 4.4, [.05, .04, .035], .5, .25);
        prop('box', x + R * .55, 1.2, z - R * .3, 1.6, .5, 2, [.03, .025, .02], .5, .35);
        beam([x - R * .4, .2, z + R * .2], [x - R * .2, 4.5, z + R * .45], .3, [.06, .05, .045]);
        for (let k = 0; k < 16; k++) {
          const a = r() * 6.3, rr = r() * R * .8;
          flickerGlow(x + Math.cos(a) * rr, .3, z + Math.sin(a) * rr, .25 + r() * .3, .1, .25 + r() * .3, dim(EMBER, .5 + r() * .6), r);
        }
        for (let k = 0; k < 4; k++) puff(x + (r() - .5) * R, 3 + k * 4, z + (r() - .5) * R, 2 + k * 1.2, [.06, .05, .045]);
        pool(x, z, R * 1.4, [.12, .04, .01]);
      },
    },
  };
}

export const kits = () => ({});
export const landmarks = H => eggs(H);
