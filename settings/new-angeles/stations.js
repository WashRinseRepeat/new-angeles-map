// Maglev station kits, one per district. The engine lays the bare platforms and calls a kit to dress them.
// A kit builds in the station frame. z runs along the line, x across it and y up from the deck top. Platforms run
// from x 3.4 to 9.4 on both sides, LEN metres long, with their floor at the train's floor (y 1).
// deck and edge colour the platform. sign and board colour the name boards. build(r) adds the rest through A.

export function stationKits(A, { HALF, LEN, SIDES, along }) {
  return {
    chakana: {
      deck: [.42, .46, .52], edge: [.5, 1.6, 2.2], sign: [1.3, 1.9, 2.2], board: [.04, .06, .09],
      build(r) {
        // A ribbed vault of pale steel, open to the sky, with a light line along its crown. A ring at each end
        // wraps the platforms and the vault, so the train runs through it.

        along(5, z => {
          let p = [-11, 1];
          for (let k = 1; k <= 8; k++) {
            const a = Math.PI * (1 - k / 8), q = [Math.cos(a) * 11, 1 + Math.sin(a) * 13];
            A.beam([p[0], p[1], z], [q[0], q[1], z], .35, [.5, .55, .62]);
            p = q;
          }
        }, -HALF, HALF + 1);
        A.glw(0, 14, 0, .3, .3, LEN, [.6, 1.6, 2.2]);
        for (const s of SIDES) A.glw(s * 9, 1.06, 0, .5, .05, LEN, [.3, .8, 1.1]);
        for (const z of [-HALF - 2, HALF + 2]) A.ring(0, 5, z, 30, Math.PI / 2, [.5, 1.4, 2]);
        void r;
      },
    },
    'base-de-cayambe': {
      deck: [.2, .17, .14], edge: [1.6, .7, .15], sign: [1.7, .9, .3], board: [.12, .07, .04],
      build(r) {
        // Patched corrugated roofs on rusty posts, sodium lamps, crates and paint on the back fences.

        const rust = () => [[.26, .12, .06], [.18, .16, .14], [.12, .16, .2], [.3, .2, .08]][Math.floor(r() * 4)];
        for (const s of SIDES) {
          along(8, z => { A.box(s * 9, 3.8, z, .5, 5.6, .5, [.2, .1, .05]); A.box(s * 4, 3.8, z, .4, 5.6, .4, [.2, .1, .05]); }, -HALF + 2);
          along(6, z => A.box(s * (6.6 + r() * .4), 6.7 + r() * .4, z, 7 + r(), .25, 6.3, rust(), r() * .06 - .03));
          along(8, z => A.glw(s * 6.5, 6.3, z, .5, .3, .5, [1.9, .85, .2]));
          A.box(s * 9.6, 2, 0, .2, 2, LEN, [.1, .09, .08]);
          along(5, z => r() < .6 && A.glw(s * 9.48, 1.4 + r() * 1.2, z, .05, .8 + r(), 2 + r() * 3,
            [[1.6, .2, .9], [.2, 1.3, 1.2], [1.6, 1.3, .1], [.9, .3, 1.6]][Math.floor(r() * 4)].map(v => v * .5)));
          along(9, z => r() < .7 && A.box(s * 8.2, 1.6, z + r() * 3, 1.2, 1.2, 1.2, [.22, .15, .08], r()));
        }
      },
    },
    rutherford: {
      deck: [.05, .06, .08], edge: [1.8, .2, 1.4], sign: [1.6, 2, 2.2], board: [.02, .02, .03],
      build(r) {
        // A chrome hall under one thin roof, neon lines below it, gold trim and wall-high adverts behind the platforms.

        A.box(0, 9.2, 0, 22, .4, LEN + 4, [.55, .6, .66]);
        for (const x of [-8, -4, 4, 8]) A.glw(x, 8.9, 0, .15, .1, LEN, [.2, 1.5, 1.9]);
        for (const s of SIDES) {
          A.glw(s * 11, 9.2, 0, .12, .5, LEN + 4, [1.7, 1.25, .45]);
          along(8, z => A.cyl(s * 9.9, 5, z, .5, 8, [.7, .74, .8]), -HALF + 4);
          along(16, z => A.glw(s * 9.6, 4.6, z, .2, 5, 12, [[1.5, .15, 1.1], [.15, 1.2, 1.5], [.2, 1.4, 1.1], [1.1, .2, 1.4]][Math.floor(r() * 4)]));
        }
      },
    },
    esmeraldas: {
      deck: [.2, .2, .19], edge: [1.7, 1.3, .1], sign: [1.8, 1.4, .5], board: [.08, .08, .07],
      build(r) {
        // Steel portal frames with braces, hazard stripes on the edges and stacked containers on both sides.

        along(8, z => {
          for (const s of SIDES) { A.box(s * 10, 5, z, .6, 10, .6, [.22, .24, .26]); A.beam([s * 10, 7, z], [s * 6, 10, z], .25, [.22, .24, .26]); }
          A.box(0, 10, z, 21, .6, .6, [.22, .24, .26]);
          A.glw(0, 9.6, z, .7, .3, .7, [1.8, 1.1, .35]);
        }, -HALF);
        for (const s of SIDES) {
          along(2, z => A.box(s * 3.75, 1.02, z, .5, .06, 1, [1.4, 1.1, .1]));
          along(13, z => {
            const n = 1 + Math.floor(r() * 3);
            for (let k = 0; k < n; k++) A.box(s * 13, -1.4 + k * 2.7, z, 2.5, 2.6, 12, [[.4, .08, .05], [.08, .2, .35], [.35, .3, .08], [.12, .25, .12]][Math.floor(r() * 4)]);
          });
        }
      },
    },
    nihongai: {
      deck: [.16, .1, .07], edge: [1.8, .5, .2], sign: [1.9, 1.6, 1.2], board: [.18, .03, .02],
      build(r) {
        // Tiered tile roofs on red posts, rows of paper lanterns and a red gate at each end of both platforms.

        for (const s of SIDES) {
          along(8, z => { A.cyl(s * 4.2, 3.6, z, .45, 5.2, [.35, .05, .03]); A.cyl(s * 9, 3.6, z, .45, 5.2, [.35, .05, .03]); }, -HALF + 4);
          A.box(s * 6.6, 6.4, 0, 8.4, .35, LEN - 8, [.07, .05, .05]);
          A.box(s * 6.6, 7.2, 0, 6, .35, LEN - 12, [.07, .05, .05]);
          A.box(s * 6.6, 7.6, 0, .4, .3, LEN - 12, [.6, .08, .04]);
          along(4, z => { A.ball(s * 4.8, 5.3, z, .6, [1.2, .22, .08]); A.ball(s * 8.4, 5.3, z, .6, [1.2, .35, .1]); }, -HALF + 6, HALF - 4);
          for (const z of [-HALF + 1, HALF - 1]) {
            for (const x of [4, 9]) A.cyl(s * x, 4.2, z, .55, 6.4, [.75, .08, .04]);
            A.box(s * 6.5, 7.4, z, 7.6, .5, .6, [.75, .08, .04]);
            A.box(s * 6.5, 7.75, z, 8.4, .25, .7, [.06, .04, .04]);
            A.box(s * 6.5, 6.3, z, 5.4, .3, .4, [.75, .08, .04]);
          }
        }
        void r;
      },
    },
    'laguna-velasco': {
      deck: [.5, .48, .44], edge: [1.5, 1.2, .8], sign: [1.4, 1.3, 1.1], board: [.3, .3, .28],
      build(r) {
        // A white canopy that rises and falls in a soft wave, planted trees, a water channel and warm light.

        for (const s of SIDES) {
          along(4, z => A.box(s * 6.6, 7.2 + Math.sin(z / 9) * .9, z, 8, .3, 4.1, [.72, .72, .7]));
          along(12, z => A.cyl(s * 9, 4, z, .35, 6.2, [.7, .7, .68]), -HALF + 6);
          along(4, z => A.glw(s * 6.6, 6.9 + Math.sin(z / 9) * .9, z, 5, .08, .3, [1.4, 1.05, .7]));
          A.glw(s * 9.1, 1.06, 0, .7, .05, LEN - 4, [.15, .6, .8]);
          along(10, z => { A.cyl(s * 7.8, 1.6, z, 1.6, 1.2, [.5, .48, .44]); A.cyl(s * 7.8, 3, z, .25, 2.4, [.15, .1, .06]); A.cone(s * 7.8, 5 + r(), z, 2.6, 3.8, [.06, .2, .08]); }, -HALF + 7);
        }
      },
    },
    manta: {
      deck: [.6, .62, .66], edge: [.4, 1, 2.2], sign: [1.4, 1.8, 2.2], board: [.7, .72, .76],
      build(r) {
        // Thin white fins sweep up over each platform like a wing, a blue strip on their tips, a mast with a beacon.

        for (const s of SIDES) {
          along(2.4, z => A.beam([s * 3, 8.8, z], [s * 11.5, 6.2, z], .3, [.78, .8, .84]));
          A.glw(s * 11.5, 6.2, 0, .25, .25, LEN, [.4, 1, 2.2]);
          along(16, z => A.box(s * 10.5, 3.6, z, .5, 5.2, .5, [.78, .8, .84]), -HALF + 8);
        }
        A.cyl(13, 9, HALF - 6, .9, 18 + 8, [.78, .8, .84]);
        A.blink(13, 22.5, HALF - 6, .9, [2.2, .1, .05]);
        void r;
      },
    },
    rabotgorod: {
      deck: [.2, .2, .19], edge: [.6, 1, .7], sign: [1.2, 1.3, 1.15], board: [.12, .12, .12],
      build(r) {
        // Heavy concrete slabs on square pillars, pale tube lights and red banners on the pillars.

        for (const s of SIDES) {
          A.box(s * 6.6, 6.8, 0, 8.6, 1.4, LEN + 2, [.2, .2, .19]);
          along(4, z => A.glw(s * 6.6, 6.05, z, 6, .1, .3, [.55, .85, .6]));
          along(10, z => {
            A.box(s * 9.4, 3.6, z, 1.3, 5.2, 1.3, [.22, .22, .21]);
            if (r() < .7) A.glw(s * 8.7, 3.6, z, .05, 4, 1.1, [.9, .07, .04]);
          }, -HALF + 2);
        }
      },
    },
    'la-costa': {
      deck: [.24, .2, .16], edge: [1.3, 1, .6], sign: [1.5, 1.2, .8], board: [.22, .14, .07],
      build(r) {
        // A country halt: a small wooden shelter in the middle, benches, lamp posts and palms beside the line.

        for (const s of SIDES) {
          for (const z of [-8, 0, 8]) A.box(s * 8.6, 2.8, z, .3, 3.6, .3, [.25, .15, .08]);
          A.box(s * 7.6, 4.7, 0, 4.2, .25, 18, [.2, .12, .06]);
          for (const z of [-5, 5]) A.box(s * 8, 1.5, z, .6, .4, 2.6, [.3, .18, .09]);
          along(11, z => { A.cyl(s * 4.6, 3, z, .14, 4, [.15, .15, .15]); A.ball(s * 4.6, 5.1, z, .45, [1.2, .9, .5]); });
          along(15, z => {
            const h = 7 + r() * 3, x = s * (12 + r() * 3);
            A.cyl(x, h / 2 - 2, z, .5, h + 4, [.2, .14, .08]);
            for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + r(); A.beam([x, h, z], [x + Math.cos(a) * 3.2, h - 1.4, z + Math.sin(a) * 3.2], .35, [.08, .22, .07]); }
          }, -HALF + 4 + r() * 4);
        }
      },
    },
    quinde: {
      deck: [.16, .14, .12], edge: [1.8, 1.2, .1], sign: [1.8, 1.5, .4], board: [.06, .05, .04],
      build(r) {
        // A factory gate: black steel frames under a truss roof, pipes on the walls with steam, orange beacons.

        along(8, z => {
          for (const s of SIDES) A.box(s * 10.2, 5, z, .8, 10, .8, [.1, .09, .08]);
          A.box(0, 10.2, z, 21.6, 1, .6, [.12, .1, .08]);
        }, -HALF);
        for (const s of SIDES) {
          A.box(s * 6, 10.4, 0, 9, .2, LEN, [.16, .12, .08]);
          along(2, z => A.box(s * 3.75, 1.02, z, .5, .06, 1, [1.6, 1.1, .08]));
          for (const y of [2.6, 3.8]) A.cyl(s * 10, y, 0, .7, LEN, [.3, .22, .12], Math.PI / 2);
          along(16, z => { A.blink(s * 9.6, 7.5, z, .6, [2, .7, .05]); if (r() < .7) A.puff(s * 10, 5, z + 3, 2.2); }, -HALF + 8);
        }
      },
    },
    guayaquil: {
      deck: [.18, .14, .1], edge: [1.6, .4, .2], sign: [1.8, 1.1, .5], board: [.25, .05, .1],
      build(r) {
        // A patchwork of painted roof sheets, market stalls on the platforms, string lights and laundry overhead.

        const paint = () => [[.35, .08, .06], [.06, .2, .3], [.3, .25, .05], [.08, .22, .1], [.25, .1, .28], [.2, .2, .2]][Math.floor(r() * 6)];
        for (const s of SIDES) {
          along(4, z => A.box(s * (6.5 + r() - .5), 6 + r() * .9, z, 6 + r() * 2, .2, 3.4 + r() * 2, paint(), r() * .2 - .1));
          along(6, z => A.box(s * 9, 3.3, z, .3, 4.8, .3, [.15, .12, .1]), -HALF + 3);
          along(8, z => {
            if (r() < .3) return;
            A.box(s * 8.6, 1.9, z, 1.4, 1.8, 4, [.14, .1, .08]);
            A.box(s * 8, 3.1, z, 2.6, .12, 4.6, paint().map(v => v * 3), -s * .2);
          }, -HALF + 5);
          along(.9, z => A.glw(s * (4 + ((z * 7.3) % 1 + 1) % 1 * 5), 5.3 + Math.sin(z * .7) * .3, z, .18, .18, .18,
            [[1.8, .3, .3], [.3, 1.6, .5], [1.8, 1.4, .3], [.4, .6, 1.8]][Math.floor(r() * 4)]));
          along(7, z => { for (let k = 0; k < 4; k++) A.box(s * (5 + k * 1.1), 4.4, z, .9, 1 + r() * .6, .05, paint().map(v => v * 2.5)); }, -HALF + 4);
        }
      },
    },
  };
}
