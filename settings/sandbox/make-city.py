#!/usr/bin/env python3
"""Write the sandbox city: a small town on a street grid, in the shape gen/gen.ts writes for New Angeles.

    python3 spikes/map/settings/sandbox/make-city.py

The town is 480 m square, with its centre at the crossroads. A main street runs east to west, a major street
north to south, and minor streets every 80 m. Two districts split it at x = 0. The file holds only what every city
needs. It leaves out the optional lists (maglev, highways, water, greens, places, quarters) and the centre point.
"""

import json
from pathlib import Path

HALF = 240                  # half the town's side in metres
STEP = 80                   # street spacing
WIDTH = {'main': 12, 'major': 9, 'minor': 7}


def line(a, b):
    """A street from a to b, sampled every 4 m like gen.ts."""
    n = max(1, round(max(abs(b[0] - a[0]), abs(b[1] - a[1])) / 4))
    return [[round(a[0] + (b[0] - a[0]) * k / n, 1), round(a[1] + (b[1] - a[1]) * k / n, 1)] for k in range(n + 1)]


def rect(x0, z0, x1, z1):
    return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]


def kind(v, axis):
    """The kind of the street at grid line v: the main street on z = 0, the major street on x = 0."""
    if v == 0:
        return 'main' if axis == 'z' else 'major'
    return 'minor'


grid = list(range(-HALF, HALF + 1, STEP))
inner = [v for v in grid if abs(v) < HALF]
streets = {'main': [], 'major': [], 'minor': []}
for v in inner:
    streets[kind(v, 'z')].append(line([-HALF, v], [HALF, v]))
    streets[kind(v, 'x')].append(line([v, -HALF], [v, HALF]))

# A block fills each grid cell inside its streets. Each block splits into lots, two rows deep, with fronts
# 12 to 20 m wide.

blocks, lots = [], []
for i in range(len(grid) - 1):
    for j in range(len(grid) - 1):
        x0, x1, z0, z1 = grid[i], grid[i + 1], grid[j], grid[j + 1]
        gx0 = x0 + (WIDTH[kind(x0, 'x')] / 2 if abs(x0) < HALF else 0)
        gx1 = x1 - (WIDTH[kind(x1, 'x')] / 2 if abs(x1) < HALF else 0)
        gz0 = z0 + (WIDTH[kind(z0, 'z')] / 2 if abs(z0) < HALF else 0)
        gz1 = z1 - (WIDTH[kind(z1, 'z')] / 2 if abs(z1) < HALF else 0)
        blocks.append(rect(gx0, gz0, gx1, gz1))
        w, d = gx1 - gx0, gz1 - gz0
        n = max(2, round(w / (12 + 8 * ((i * 7 + j * 3) % 3) / 2)))
        for k in range(n):
            for half in (0, 1):
                lots.append(rect(round(gx0 + w * k / n, 1), round(gz0 + d * half / 2, 1),
                                 round(gx0 + w * (k + 1) / n, 1), round(gz0 + d * (half + 1) / 2, 1)))

districts = [
    {'id': 'old-town', 'name': 'Old Town', 'poly': rect(-HALF, -HALF, 0, HALF)},
    {'id': 'new-town', 'name': 'New Town', 'poly': rect(0, -HALF, HALF, HALF)},
]
city = {
    'seed': 1, 'origin': [-HALF - 40, -HALF - 40], 'dims': [2 * HALF + 80, 2 * HALF + 80], 'placeHalf': 34,
    'districts': districts, 'streets': streets, 'blocks': blocks, 'lots': lots,
}
out = Path(__file__).with_name('city.json')
out.write_text(json.dumps(city, separators=(',', ':')))
print(f'wrote {out.name}: {len(blocks)} blocks, {len(lots)} lots, {sum(map(len, streets.values()))} streets')
