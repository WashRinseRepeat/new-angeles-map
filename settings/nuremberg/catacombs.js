// The catacombs under Nuremberg: cellars, dungeons, ritual halls and the old lairs below them, on four levels.
// The engine loads this module on the first switch to a catacomb layer. engine/under.js holds the toolkit,
// under/plan.js the landmark boxes, under/network.js the tunnels between them.

import { dungeon } from '../../engine/under.js';
import { ZONES } from './under/plan.js';

// Each landmark file default-exports build(D, zone). One that fails to load or build is skipped and logged,
// so the rest still show.

const PARTS = ['network', 'castle', 'cellars', 'tales', 'ritual'];
const MODS = await Promise.allSettled(PARTS.map(p => import(`./under/${p}.js`)));
const D = dungeon({ ambient: [.07, .07, .085] });
let built = false;

export function build() {
  if (built) return;
  built = true;
  MODS.forEach((m, i) => {
    if (m.status === 'rejected') return console.error(`catacombs: ${PARTS[i]} failed to load`, m.reason);
    try { m.value.default(D, ZONES); } catch (e) { console.error(`catacombs: ${PARTS[i]} failed to build`, e); }
  });
  console.log('catacombs', D.bake());
}
export function update(t, dt, L) { D.update(t, dt, L); }
export const group = D.group, labels = D.labels;
