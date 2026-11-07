// Jinteki's island off the Nihongai shore, in world metres: its centre, the shore direction t, and its size.
// n = [-t.z, t.x] points out to sea. The kit builds it (kits/nihongai.js), and the sea keeps its water clear.

export const ISLE = { at: [-1600, 1193], t: [.421, .907], L: 470, B: 300, road: null };

const n = [-ISLE.t[1], ISLE.t[0]];
const ab = ([x, z]) => {
  const dx = x - ISLE.at[0], dz = z - ISLE.at[1];
  return [dx * ISLE.t[0] + dz * ISLE.t[1], dx * n[0] + dz * n[1]];
};

// The main street that ends nearest the island's landward side runs on into a tunnel under the seawall.
// ISLE.road keeps where it meets the island, as [a, b] along t and n.

export function joinIsle(city) {
  let best = null;
  for (const line of city.streets?.main ?? []) for (const end of [0, line.length - 1]) {
    const [a, b] = ab(line[end]);
    if (Math.abs(a) < ISLE.L / 4 && b > -ISLE.B / 2 - 30 && (!best || b > best.b)) best = { line, end, a, b };
  }
  if (!best) return;
  if (best.end === 0) best.line.reverse();
  const [px, pz] = best.line.at(-1);
  for (let k = 1; k <= Math.ceil((16 - ISLE.B / 2 - best.b) / 4); k++) best.line.push([px + n[0] * 4 * k, pz + n[1] * 4 * k]);
  ISLE.road = [best.a, best.b];
}
