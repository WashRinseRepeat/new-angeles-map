// Easter eggs in the city. None has a label or a card, so only a sharp eye finds them.
// The sea, the jungle and the mountains hold the rest (landmarks/eggs.js).

const dim = (rgb, k) => rgb.map(c => c * k);
const PINK = [1.8, .35, 1.1], EMBER = [1.9, .55, .12], CYAN = [.4, 1.4, 1.7], WARM = [1.4, .85, .4];

function eggs(H) {
  const { beam, glow, prop, puff, textSign, flickerGlow } = H;
  const pool = (x, z, rad, rgb) => H.pool?.(x, z, rad, rgb);
  const front = () => { const f = H.frame()?.front ?? { x: 0, z: 1 }; return [f.x, f.z, Math.atan2(f.x, f.z)]; };

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

    // Hedge Fund: a pink vending machine on a small Rabotgorod lot, with a tall bioroid reaching for its keypad.
    // It claims only the one lot under it.

    egg_hedge: {
      at: [533.81, 963.28], free: [16, 18, -.718], claim: true,
      build(x, z, w, d, st, r) {

        // u runs across the machine, v out from its lit front toward the bioroid.

        const [fx, fz, fy] = front(), rx = fz, rz = -fx;
        const at = (u, y, v) => [x + rx * u + fx * v, y, z + rz * u + fz * v];
        const P = (u, y, v, sx, sy, sz, rgb) => { const [px, , pz] = at(u, y, v); prop('box', px, y, pz, sx, sy, sz, rgb, fy); };
        const G = (u, y, v, sx, sy, sz, rgb) => { const [px, , pz] = at(u, y, v); glow(px, y, pz, sx, sy, sz, rgb, fy); };

        // The machine: a pink cabinet with a lit window of products, a keypad and coin slot, a tray and a logo band.

        const CASE = [.22, .06, .15], DARK = [.05, .04, .05], GOODS = [[1.6, .5, .3], [.3, 1.2, 1.5], [1.5, 1.3, .3], [.4, 1.5, .5], [1.6, .3, 1]];
        P(0, .1, 0, 2.8, .2, 2, DARK);
        P(0, 2.2, 0, 2.6, 4.2, 1.8, CASE);
        G(-.3, 2.5, .91, 1.7, 2.4, .03, dim(PINK, .45));
        for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) G(-.3 + (col - 1) * .52, 1.55 + row * .6, .95, .36, .3, .03, GOODS[(row * 3 + col) % GOODS.length]);
        P(.95, 2.5, .92, .44, 1.3, .05, DARK);
        for (let k = 0; k < 9; k++) G(.84 + (k % 3) * .11, 2.75 - Math.floor(k / 3) * .14, .95, .07, .07, .02, [1.4, 1.4, 1.5]);
        G(.95, 2.05, .95, .22, .05, .02, CYAN);
        P(0, .6, .92, 2.1, .5, .14, DARK);
        G(0, .86, .96, 1.9, .04, .02, PINK);
        G(0, 4.05, .93, 2.5, .38, .03, PINK);
        const [tx, , tz] = at(0, 4.05, .96);
        textSign('HEDGE FUND', tx, 4.05, tz, 2.3, .34, fy, [1.9, 1.8, 1.9]);
        for (const s of [-1, 1]) G(s * 1.32, 2.2, 0, .03, 3.9, .12, PINK);

        // The bioroid: about 3.8 m tall, pale synthetic plates, a cyan chest light and visor, one arm on the keypad.

        const SKIN = [.55, .57, .6], JOINT = [.2, .21, .23], V = 3.3;
        for (const s of [-1, 1]) {
          P(s * .36, .95, V, .4, 1.9, .45, SKIN);
          P(s * .36, .12, V - .12, .46, .24, .72, JOINT);
          P(s * .36, 1.92, V, .44, .18, .5, JOINT);
          P(s * .76, 3.32, V, .42, .36, .52, SKIN);
        }
        P(0, 2.05, V, 1, .36, .52, JOINT);
        P(0, 2.8, V, 1.16, 1.3, .62, SKIN);
        G(0, 3.0, V - .32, .3, .3, .03, CYAN);
        P(-.82, 2.62, V, .26, 1.25, .3, SKIN);
        beam(at(.78, 3.3, V), at(.95, 2.75, 1.05), .3, SKIN);
        P(0, 3.6, V, .26, .24, .26, JOINT);
        P(0, 3.97, V, .52, .56, .56, SKIN);
        G(0, 4.0, V - .29, .44, .1, .03, CYAN);
        pool(x + fx * 1.5, z + fz * 1.5, 9, [.14, .03, .09]);
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
