"""Grow Guayaquil's south-east corner down to the southern highway.

The generator lays streets only inside the map frame, so this strip south of the frame is added by hand to each
city file. It extends the north-south streets to a new service street along the highway, fills the blocks between
them with two rows of lots, ends the southern highway over the file's main street, and keeps the strip solid
against the frayed edge. It also moves Guayaquil's outline in design/map-trace.json.

Run after gen/gen.ts and gen/stitch.py: python3 -I gen/se-strip.py. A second run changes nothing.
"""
import json, os, random

HERE = os.path.dirname(os.path.abspath(__file__))
MAP = os.path.join(HERE, '..')
W = lambda u, v: [round((u - 680) * 3.6, 4), round((v - 390) * 3.6, 4)]

X_W, X_E = 1556.0, 2095.2      # strip ends: the estuary bank and the frame edge
Z_EDGE, Z_S = 4327.2, 4378.0   # the old district edge and the new service street
Z_DIST = Z_S + 10              # the new district edge, just north of the highway deck
OFF = {'main': 8, 'major': 6.5, 'minor': 4.5, 'edge': 0}

# The southern highway from its branch over the bridge to the estuary's east bank, in world metres.

HW_WEST = [W(*p) for p in [[810, 1561.33], [810.56, 1584.44], [824.44, 1609.44], [874.44, 1617.78], [943.89, 1616.39],
                           [993.89, 1612.22], [1124.44, 1612.22]]]
HW_START = W(810, 1561.33)


def strip(city, rng):
    g = next(d for d in city['districts'] if d['id'] == 'guayaquil')
    if any(abs(p[1] - Z_DIST) < .1 for p in g['poly']):
        return False

    # The outline drops from the frame edge to the new edge between the estuary bank and the east frame edge.

    poly = g['poly']
    i = next(k for k, p in enumerate(poly) if abs(p[0] - X_E) < .5 and abs(p[1] - Z_EDGE) < .5)
    poly[i] = [X_E, Z_DIST]
    poly[i + 1:i + 1] = [[X_W, Z_DIST], [X_W, Z_EDGE]]

    # The new blocks start one street's width south of the lowest old lots.

    z_n = max(p[1] for lot in city['lots'] for p in lot if X_W < p[0] < X_E) + 5.5

    # North-south streets that reach the old edge run on south to the service street.

    cross = []
    for kind, lines in city['streets'].items():
        for line in lines:
            for end in (0, -1):
                x, z = line[end]
                px = line[1 if end == 0 else -2][0]
                if z > Z_EDGE - 12 and X_W < x < X_E - 4 and abs(px - x) < 2:
                    ext = [[x, round(zz, 1)] for zz in [z + 4 * k for k in range(1, 100)] if zz <= Z_S]
                    if end == -1:
                        line.extend(ext)
                    else:
                        line[0:0] = ext[::-1]
                    cross.append((x, kind, line))
    city['streets']['minor'].append([[round(x, 1), Z_S] for x in [X_W + 4 * k for k in range(int((X_E - X_W) / 4) + 1)]])

    cols = sorted([(X_W, 'edge')] + [(x, k) for x, k, _ in cross] + [(X_E - 3, 'edge')])
    z0, z1 = z_n + 5.5, Z_S - 5.5
    zm = (z0 + z1) / 2
    for (xa, ka), (xb, kb) in zip(cols, cols[1:]):
        a, b = xa + OFF[ka], xb - OFF[kb]
        if b - a < 18:
            continue
        city['blocks'].append([[a, z0], [b, z0], [b, z1], [a, z1], [a, z0]])
        for r0, r1 in [(z0, zm - .5), (zm + .5, z1)]:
            n = max(1, round((b - a) / (22 + rng.random() * 12)))
            cuts = sorted(a + (b - a) * (k + (rng.random() - .5) * .3) / n for k in range(1, n))
            for u, v in zip([a] + cuts, cuts + [b]):
                u0, v0 = (u + .5 if u > a else u), (v - .5 if v < b else v)
                city['lots'].append([[round(u0, 1), round(r0, 1)], [round(v0, 1), round(r0, 1)], [round(v0, 1), round(r1, 1)], [round(u0, 1), round(r1, 1)]])

    # The highway crosses the estuary, runs east along the strip and climbs north over the main street, where it
    # ramps down into the city.

    main = min((c for c in cross if c[1] == 'main' and c[0] > 1900), key=lambda c: abs(c[0] - 1960))
    xs, line = main[0], main[2]
    up = sorted([p for p in line if 4130 <= p[1] <= 4345], key=lambda p: -p[1])[::12]
    hw = HW_WEST + [[1700, 4402], [1800, 4400], [round(xs - 70, 1), 4398], [round(xs - 20, 1), 4374]] + up
    k = next(k for k, h in enumerate(city['highways']) if abs(h['pts'][0][0] - HW_START[0]) < 1 and abs(h['pts'][0][1] - HW_START[1]) < 1)
    city['highways'][k]['pts'] = hw

    # Circles along the strip hold the edge solid, so the new lots build in full.

    city['keep'] = city.get('keep', []) + [[x, 4340, 55] for x in range(1590, 2071, 60)]
    return True


for name in ['city.json', 'city-bend.json', 'city-blend.json', 'city-stitch.json']:
    path = os.path.join(MAP, name)
    city = json.load(open(path))
    if strip(city, random.Random(name)):
        open(path, 'w').write(json.dumps(city, separators=(',', ':')))
        print('patched', name)

# The trace keeps the same outline in map pixels.

path = os.path.join(MAP, 'design', 'map-trace.json')
trace = json.load(open(path))
g = next(d for d in trace['districts'] if d['id'] == 'guayaquil')
v = round(Z_DIST / 3.6 + 390, 2)
if not any(abs(p[1] - v) < .01 for p in g['poly']):
    i = g['poly'].index([1262, 1592])
    g['poly'][i] = [1262, v]
    g['poly'][i + 1:i + 1] = [[round(X_W / 3.6 + 680, 2), v], [round(X_W / 3.6 + 680, 2), 1592]]
    open(path, 'w').write(json.dumps(trace, indent=1))
    print('patched map-trace.json')
