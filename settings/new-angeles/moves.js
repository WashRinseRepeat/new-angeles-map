// New Angeles camera moves for the audio guide. They circle the Beanstalk tether and look out over the coast.
// The engine merges them with its own moves (sky, orbit, pan, dolly, spiral) and plays each on the audio clock.
// pose(e, C, T) sets the camera C and its target T for progress e. The first `blend` seconds ease in from
// wherever the camera was. A move with pod set to true also sets P.y, the beanpod height.

export const LABELS = { descend: 'The Beanstalk', cable: 'The tether', plaza: 'Plaza del Cielo', ocean: 'The Pacific', ride: 'A beanpod',
  top: 'High on the tether', down: 'The Beanstalk', wide: 'New Angeles' };

// E holds the engine's helpers V, mix, ease and smooth, the centre point CENTRE, the start target WIDE_T, the camera,
// the centre landmark's api as landmark, and find(name), which finds a place by its card title.

export function moves(E) {
  const { V, mix, ease, smooth, CENTRE, WIDE_T, camera } = E;
  const ROOT = () => V(CENTRE.x, 0, CENTRE.y), A0 = Math.atan2(.83, -.55);
  const around = (y, r, a) => V(CENTRE.x + Math.cos(a) * r, y, CENTRE.y + Math.sin(a) * r);
  const RIDE_END = 2400, TOP_Y = 8500, TOP_R = 900;
  return {

    // From far up the tether, fast at first, braking and tilting onto the Root.

    descend: () => ({ blend: 0, pose(e, C, T) {
      const k = 1 - (1 - e) ** 2.5, y = mix(5200, 700, k);
      C.copy(around(y, mix(160, 650, k), A0));
      T.copy(ROOT()).setY(y - 400).lerp(ROOT().setY(230), smooth(.55, 1, e));
    } }),

    // Close on the tether, rising slowly and looking up its length.

    cable: c => ({ blend: 3, pose(e, C, T) {
      const y = mix(430, 620, ease(e));
      C.copy(around(y, 150, A0 + .5 * (c.dir ?? 1) * e));
      T.copy(ROOT()).setY(y + 160);
    } }),

    // The crown deck around the dome.

    plaza: c => ({ blend: 3, pose(e, C, T) {
      C.copy(around(520, 230, A0 + (c.dir ?? 1) * (.35 * e - .3)));
      T.copy(ROOT()).setY(350);
    } }),

    // Out over the west coast, facing the open Pacific.

    ocean: () => ({ blend: 4, pose(e, C, T) {
      C.set(mix(-1150, -1300, e), 360, -100);
      T.set(-4600, 0, mix(-200, -900, e));
    } }),

    // A beanpod leaves the dock and climbs. The camera circles the tether with it.

    ride: c => ({ blend: 2.5, pod: true, pose(e, C, T, P) {
      const y = mix(E.landmark.dock, c.to ?? RIDE_END, e ** 2), s = E.landmark.grown(y), r = c.r ?? 90;
      P.y = y;
      C.copy(around(y + mix(20, 80, e) * s, r * s, A0 + (c.turn ?? 1.6) * e));
      T.copy(ROOT()).setY(y - 6 * s);
    } }),

    // Up to the top of the tether. The pod pulls ahead and the view tilts down onto the shrinking city.

    top: c => ({ blend: 2, pod: true, pose(e, C, T, P) {
      P.y = mix(RIDE_END, 9500, e);
      const k = ease(e), y = mix(RIDE_END + 60, TOP_Y, k);
      C.copy(around(y, mix(180, TOP_R, k), A0 + 1.6 + .6 * (c.dir ?? 1) * e));
      T.copy(ROOT()).setY(y - 200).lerp(WIDE_T, smooth(0, .7, e));
    } }),

    // Back down the tether to the Root.

    down: c => ({ blend: 2, pose(e, C, T) {
      const k = ease(e), y = mix(TOP_Y, 650, k);
      C.copy(around(y, mix(TOP_R, 620, k), A0 + 2.2 + .5 * (c.dir ?? 1) * e));
      T.copy(WIDE_T).lerp(ROOT().setY(Math.max(250, y * .5 - 150)), smooth(0, .4, e));
    } }),

    // From a place, look across at the Root.

    gaze: c => {
      const p = E.find(c.name), C0 = p ? V(p.top.x, p.top.y + (c.up ?? 15), p.top.z) : camera.position.clone();
      return { blend: 4, pose(e, C, T) { C.copy(C0); T.copy(ROOT()).setY(mix(140, 180, e)); } };
    },
  };
}
