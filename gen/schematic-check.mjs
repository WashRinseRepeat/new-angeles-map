// Schematic geometry check. Each check prints PASS <name> or FAIL <name>: <detail>. The run exits with 1 on any failure.
//
//   node spikes/map/gen/schematic-check.mjs

import assert from 'node:assert/strict';
import { legPoints, isOctilinear, offsetLine, stationOrder, missingStops } from '../engine/schematic.js';

const checks = {
  'leg diagonal first': () => assert.deepEqual(legPoints([0, 0], [3, 5], false), [[0, 0], [3, 3], [3, 5]]),
  'leg straight first': () => assert.deepEqual(legPoints([0, 0], [3, 5], true), [[0, 0], [0, 2], [3, 5]]),
  'leg pure diagonal drops the middle': () => assert.equal(legPoints([0, 0], [4, 4], false).length, 2),
  'octilinear': () => {
    assert.equal(isOctilinear([[0, 0], [2, 2], [2, 5]]), true);
    assert.equal(isOctilinear([[0, 0], [1, 2]]), false);
  },
  'offset keeps one side': () => {
    const ys = offsetLine([[0, 0], [4, 0]], 1).map(p => p[1]);
    assert.ok(ys.every(y => Math.abs(y) === 1) && ys[0] === ys[1]);
  },
  'station order': () => assert.deepEqual(stationOrder({ path: ['A', 'J', '|B', 'A'] }, { A: [0, 0], B: [2, 2] }), ['A', 'B']),
  'missing stops': () => assert.deepEqual(missingStops({ stations: { A: [0, 0] } }, [{ name: 'L', stops: [{ name: 'A' }, { name: 'B' }] }]), ['L: B']),
};

let bad = 0;
for (const [name, fn] of Object.entries(checks)) {
  try { fn(); console.log(`PASS ${name}`); } catch (e) { bad++; console.log(`FAIL ${name}: ${e.message.split('\n')[0]}`); }
}
process.exit(bad ? 1 : 0);
