# Stitches city-stitch.json: the bent city's streets, blocks and lots inside the named districts, the straight
# city's everywhere else. Streets stop at the district edge. Lots and blocks that cross it drop out, and the
# engine's fill buildings take that ground.
#
#   python3 gen/stitch.py guayaquil chakana quinde

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
straight = json.loads((ROOT / 'city.json').read_text())
bent = json.loads((ROOT / 'city-bend.json').read_text())
polys = [d['poly'] for d in straight['districts'] if d['id'] in sys.argv[1:]]
boxes = [(min(x for x, _ in p), min(z for _, z in p), max(x for x, _ in p), max(z for _, z in p)) for p in polys]


def inside(x, z, poly):
    c = False
    for (ax, az), (bx, bz) in zip(poly, poly[-1:] + poly[:-1]):
        if (az > z) != (bz > z) and x < ax + (z - az) * (bx - ax) / (bz - az):
            c = not c
    return c


def in_bent(p):
    return any(b[0] <= p[0] <= b[2] and b[1] <= p[1] <= b[3] and inside(p[0], p[1], q) for b, q in zip(boxes, polys))


def runs(line, want):
    out, run = [], []
    for p in line:
        if in_bent(p) == want:
            run.append(p)
        else:
            out.append(run)
            run = []
    return [r for r in out + [run] if len(r) > 2]


def polys_of(src, key, want):
    return [p for p in src[key] if all(in_bent(v) == want for v in p)]


city = dict(straight)
city['streets'] = {k: [r for l in straight['streets'][k] for r in runs(l, False)] + [r for l in bent['streets'][k] for r in runs(l, True)]
                   for k in straight['streets']}
for key in ('blocks', 'lots'):
    city[key] = polys_of(straight, key, False) + polys_of(bent, key, True)
(ROOT / 'city-stitch.json').write_text(json.dumps(city, separators=(',', ':')))
print({k: len(v) for k, v in city['streets'].items()}, len(city['blocks']), 'blocks', len(city['lots']), 'lots')
