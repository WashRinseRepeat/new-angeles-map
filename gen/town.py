#!/usr/bin/env python3
"""Generate a walled town as a city file for the map engine.

    python3 spikes/map/gen/town.py spikes/map/settings/<pack>

It reads <pack>/town.json and writes <pack>/city.json in the shape gen/gen.ts writes for New Angeles. The same
seed always gives the same town. The town has an irregular wall with gates, a market square at the centre, main
streets out through the gates, a ring lane inside the wall, winding lanes between them, and narrow deep plots
along every street. Named sites (a church, a keep, a market hall) stay free of plots, and city.json lists them
under sites, so the pack's landmarks can stand there. Fields, woods and a river lie outside the wall.

town.json keys, with their defaults:
    seed 1           the random seed
    radius 260       mean wall radius in metres
    wobble 0.12      how far the wall strays from a circle, as a share of the radius
    walls true       whether the town has walls. An open town keeps the same outline as its edge but writes no wall
                     and no gates, so the pack builds none. Its gate streets still run out into the country.
    square 34        radius of the market square
    gates [...]      gate bearings in degrees, 0 east, 90 south (world +z), 270 north
    road 60          how far the gate roads run past the wall
    widths {...}     street widths by kind, default main 7, major 5, minor 3.5
    suburbs {...}    {length, clear, names}: plots along the gate roads past the wall, from clear metres (20) out to
                     length metres (0, none). Each suburb is a ward, suburb-<gate bearing>, named from names by
                     the gate's bearing.
    far 0            country roads run on from each gate road's end out to this distance from the centre
    guards 24        walkers on the wall walk, 8 m up; city.json lists the walk under paths
    roads {}         per gate, by its bearing in degrees as a string, a road length that overrides road
    lanes 3          lanes between each pair of gate streets
    districts [...]  {id, name, from, to}: wards as bearing ranges in degrees, clockwise from `from`
    sites [...]      {name, kind, bearing, dist, w, d, rot, high, search}: plot-free sites, dist from the centre, rot
                     in degrees; high moves a site to the highest ground within search metres
    river {...}      {bearing, dist, width}: a river past the wall, square to the bearing, or null
    greens [...]     {name, from, to, inner, outer}: greens past the wall. A name with "park" grows woods, any
                     other name fields. inner and outer are metres past the wall.
    relief {...}     the lie of the land, copied into city.json for the engine (engine/relief.js): hills, a list of
                     {at: [x, z], r, h, shape, top}, each a smooth rise of h metres over radius r (a negative h is a
                     hollow); shape "mound" gives a flat top over the inner share top (default .55) and steep sides,
                     as a castle motte. terrace (default 1.5) is the height band lot platforms round to. moat
                     {offset, width, depth, water} digs a ditch round the wall with bridges at the gates; hump
                     (default 2.5) is how high a bridge over water rises. On a
                     relief the cross lanes follow the contours. Without it the town is flat.
"""

import json
import math
import random
import sys
from pathlib import Path

PACK = Path(sys.argv[1]).resolve()
P = json.loads((PACK / 'town.json').read_text())
rnd = random.Random(P.get('seed', 1))
R = P.get('radius', 260)
SQ = P.get('square', 34)
WIDTH = {'main': 7, 'major': 5, 'minor': 3.5, **P.get('widths', {})}
SUB = {'length': 0, 'clear': 20, 'names': {}, **P.get('suburbs', {})}
FAR = P.get('far', 0)
DEG = math.pi / 180


# ---------- the wall: a star-shaped outline, r(a) round the centre ----------

WAVES = [(k, rnd.uniform(0, 2 * math.pi), rnd.uniform(.4, 1)) for k in (2, 3, 5)]
norm = sum(w for _, _, w in WAVES)


def wall_r(a):
    return R * (1 + P.get('wobble', .12) * sum(w * math.sin(k * a + ph) for k, ph, w in WAVES) / norm)


def polar(a, r):
    return [math.cos(a) * r, math.sin(a) * r]


def bearing(x, z):
    return math.atan2(z, x) % (2 * math.pi)


WALL = [polar(k / 72 * 2 * math.pi, wall_r(k / 72 * 2 * math.pi)) for k in range(72)]


def inside(x, z, margin=0):
    return math.hypot(x, z) < wall_r(bearing(x, z)) - margin


# ---------- streets: polylines sampled every 4 m ----------

def resample(pts, step=4):
    """A polyline through pts, with points every step metres along it."""
    out, carry = [pts[0]], 0
    for (ax, az), (bx, bz) in zip(pts, pts[1:]):
        seg = math.hypot(bx - ax, bz - az)
        t = step - carry
        while t <= seg:
            out.append([ax + (bx - ax) * t / seg, az + (bz - az) * t / seg])
            t += step
        carry = seg - (t - step)
    return [[round(x, 1), round(z, 1)] for x, z in out]


def wander(a0, r0, a1, r1, n, amp):
    """Points from polar (a0, r0) to (a1, r1) with a smooth sideways wander of up to amp metres."""
    ph, pts = rnd.uniform(0, 6.3), []
    for k in range(n + 1):
        t = k / n
        a, r = a0 + (a1 - a0) * t, r0 + (r1 - r0) * t
        side = amp * math.sin(t * math.pi) * math.sin(ph + t * 4)
        x, z = polar(a, r)
        pts.append([x - math.sin(a) * side, z + math.cos(a) * side])
    return pts


# ---------- the relief, as engine/relief.js reads it ----------

REL = P.get('relief')


def smooth(a, b, x):
    t = min(1, max(0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def relief_at(x, z):
    h = 0
    for k in (REL or {}).get('hills', []):
        t = math.hypot(x - k['at'][0], z - k['at'][1]) / k['r']
        if t < 1:
            h += k['h'] * (smooth(1, k.get('top', .55), t) if k.get('shape') == 'mound' else (1 - t * t) ** 2)
    return h


def contour(a0, a1, mid, n=12, reach=30):
    """An arc from bearing a0 to a1 that keeps the height of its middle, straying up to reach metres from radius mid.
    Each point takes the radius nearest mid whose height is closest to the target, and two passes of a 3-point
    average smooth the radii."""
    target = relief_at(*polar((a0 + a1) / 2, mid))
    rs = []
    for k in range(n + 1):
        a = a0 + (a1 - a0) * k / n
        rs.append(mid + min(range(-reach, reach + 1), key=lambda d: (round(abs(relief_at(*polar(a, mid + d)) - target), 1), abs(d))))
    for _ in range(2):
        rs = [rs[0]] + [(rs[i - 1] + rs[i] + rs[i + 1]) / 3 for i in range(1, n)] + [rs[n]]
    return [polar(a0 + (a1 - a0) * k / n, rs[k]) for k in range(n + 1)]


gates = [g * DEG for g in P.get('gates', [10, 100, 190, 320])]
streets = {'main': [], 'major': [], 'minor': []}
for g in gates:
    road = max(P.get('roads', {}).get(str(round(g / DEG)), P.get('road', 60)), SUB['length'] + 20 if SUB['length'] else 0)
    streets['main'].append(resample(wander(g, SQ + 2, g + rnd.uniform(-.05, .05), wall_r(g) + road, 24, 10)))
ring = [polar(k / 180 * 2 * math.pi, wall_r(k / 180 * 2 * math.pi) - 12) for k in range(181)]
streets['major'].append(resample(ring))

# Lanes run out from near the square to the ring lane between each pair of gate streets. A cross lane joins
# neighbouring lanes halfway out; on a relief it keeps to its height, along the contour.

inner = SQ + 26
for g0, g1 in zip(gates, gates[1:] + [gates[0] + 2 * math.pi]):
    n = P.get('lanes', 3)
    angles = [g0 + (g1 - g0) * (k + 1) / (n + 1) + rnd.uniform(-.06, .06) for k in range(n)]
    for a in angles:
        streets['minor'].append(resample(wander(a, inner, a + rnd.uniform(-.08, .08), wall_r(a) - 12, 16, 9)))
    for a0, a1 in zip([g0] + angles, angles + [g1]):
        mid = (inner + wall_r((a0 + a1) / 2) - 12) / 2 + rnd.uniform(-25, 25)
        arc = [polar(a0 + (a1 - a0) * k / 12, mid + 6 * math.sin(k / 12 * math.pi * 2 + a0)) for k in range(13)]
        streets['minor'].append(resample(contour(a0, a1, mid) if REL else arc))
    arc = [polar(g0 + (g1 - g0) * k / 16, inner) for k in range(17)]
    streets['major'].append(resample(arc))

# ---------- sites: plot-free rectangles for the pack's landmarks ----------

# A site with "high": true takes the highest ground within its search metres (default 40) of its bearing and dist,
# on a 4 m grid, so a church or a castle finds its rise.

sites = []
for s in P.get('sites', []):
    a, rot = s['bearing'] * DEG, s.get('rot', s['bearing'] + 90) * DEG
    x, z = polar(a, s['dist'])
    if s.get('high') and REL:
        reach = s.get('search', 40)
        x, z = max(((x + i, z + j) for i in range(-reach, reach + 1, 4) for j in range(-reach, reach + 1, 4)
                    if i * i + j * j <= reach * reach), key=lambda p: (round(relief_at(*p), 1), -math.hypot(p[0] - x, p[1] - z)))
    sites.append({**s, 'at': [round(x, 1), round(z, 1)], 'a': rot})


def in_site(x, z, pad=0):
    for s in sites:
        dx, dz, c, sn = x - s['at'][0], z - s['at'][1], math.cos(s['a']), math.sin(s['a'])
        if abs(dx * c + dz * sn) < s['w'] / 2 + pad and abs(-dx * sn + dz * c) < s['d'] / 2 + pad:
            return True
    return False


# Streets stop where they would cross a site. A street broken into pieces keeps the pieces of at least 8 samples.

for kind, lines in streets.items():
    kept = []
    for l in lines:
        piece = []
        for p in l + [None]:
            if p and not in_site(p[0], p[1], WIDTH[kind] / 2 + 2):
                piece.append(p)
                continue
            if len(piece) >= 8:
                kept.append(piece)
            piece = []
    streets[kind] = kept

# ---------- greens and the river ----------

parks = []
for g in P.get('greens', []):
    a0, a1 = g['from'] * DEG, g['to'] * DEG
    if a1 <= a0:
        a1 += 2 * math.pi
    out = [polar(a0 + (a1 - a0) * k / 16, wall_r(a0 + (a1 - a0) * k / 16) + g.get('outer', 160)) for k in range(17)]
    near = [polar(a1 - (a1 - a0) * k / 16, wall_r(a1 - (a1 - a0) * k / 16) + g.get('inner', 30)) for k in range(17)]
    parks.append({'name': g['name'], 'poly': [[round(x, 1), round(z, 1)] for x, z in out + near]})

water = []
if P.get('river'):
    rv = P['river']
    a, dist, wd = rv['bearing'] * DEG, rv.get('dist', R + 90), rv.get('width', 26)
    cx, cz = polar(a, dist)
    tx, tz = -math.sin(a), math.cos(a)
    ph, bank = rnd.uniform(0, 6.3), []
    for k in range(-20, 21):
        s = k * 30
        sway = 14 * math.sin(s / 140 + ph)
        bank.append((cx + tx * s + math.cos(a) * sway, cz + tz * s + math.sin(a) * sway))
    near = [[round(x - math.cos(a) * wd / 2, 1), round(z - math.sin(a) * wd / 2, 1)] for x, z in bank]
    far = [[round(x + math.cos(a) * wd / 2, 1), round(z + math.sin(a) * wd / 2, 1)] for x, z in reversed(bank)]
    water.append({'name': rv.get('name', 'River'), 'poly': near + far})

# ---------- plots: narrow, deep lots along every street ----------
# A 1 m occupancy grid holds the streets, the square, the sites and the plots laid so far. Main streets take
# their frontage first, then the ring and the inner lanes, then the minor lanes.

EXT = int(R * 1.4) + 100 + int(SUB['length'])
taken = bytearray((2 * EXT) ** 2)


def cell(x, z):
    i, j = int(x + EXT), int(z + EXT)
    return j * 2 * EXT + i if 0 <= i < 2 * EXT and 0 <= j < 2 * EXT else None


def mark_disc(x, z, rad):
    for j in range(int(z - rad), int(z + rad) + 2):
        for i in range(int(x - rad), int(x + rad) + 2):
            if (i - x) ** 2 + (j - z) ** 2 <= rad * rad and (k := cell(i, j)) is not None:
                taken[k] = 1


for kind, lines in streets.items():
    for l in lines:
        for x, z in l:
            mark_disc(x, z, WIDTH[kind] / 2 + 1.5)
mark_disc(0, 0, SQ + 3)


def corners(fx, fz, tx, tz, nx, nz, w, d):
    """A plot's corners: front centre (fx, fz), tangent t along the street, n away from it, w wide, d deep."""
    return [[fx - tx * w / 2, fz - tz * w / 2], [fx + tx * w / 2, fz + tz * w / 2],
            [fx + tx * w / 2 + nx * d, fz + tz * w / 2 + nz * d], [fx - tx * w / 2 + nx * d, fz - tz * w / 2 + nz * d]]


def clear(fx, fz, tx, tz, nx, nz, w, d, out=False):
    """Whether a plot's ground is free: inside the wall, or with out in the suburbs, and off every street, plot,
    site, green and the river."""
    for u in range(-2, 3):
        for v in range(4):
            px = fx + tx * w / 2 * u / 2.2 + nx * (d * (v + .5) / 4)
            pz = fz + tz * w / 2 * u / 2.2 + nz * (d * (v + .5) / 4)
            k = cell(px, pz)
            if k is None or taken[k] or in_site(px, pz, 3) or math.hypot(px, pz) < SQ + 3:
                return False
            if not (suburb(px, pz) if out else inside(px, pz, 6)):
                return False
    return True


def fill(poly):
    xs, zs = [p[0] for p in poly], [p[1] for p in poly]
    for j in range(int(min(zs)), int(max(zs)) + 2):
        for i in range(int(min(xs)), int(max(xs)) + 2):
            if point_in(i + .5, j + .5, poly) and (k := cell(i, j)) is not None:
                taken[k] = 1


def point_in(x, z, poly):
    hit = False
    for (ax, az), (bx, bz) in zip(poly, poly[1:] + poly[:1]):
        if (az > z) != (bz > z) and x < ax + (z - az) * (bx - ax) / (bz - az):
            hit = not hit
    return hit


# Greens and the river keep their ground: the fields and woods fill, and the river with 4 m of bank.

for g in parks:
    fill(g['poly'])
for w in water:
    fill(w['poly'])
    for x, z in resample(w['poly'] + w['poly'][:1], 4):
        mark_disc(x, z, 4)


def suburb(x, z):
    """Whether a point lies in the suburbs: past the wall by at least clear metres and by at most length."""
    r, w = math.hypot(x, z), wall_r(bearing(x, z))
    return SUB['length'] > 0 and w + SUB['clear'] < r < w + SUB['length']


lots, out_lots = [], {}
for kind in ('main', 'major', 'minor'):
    deep = {'main': (28, 46), 'major': (22, 34), 'minor': (16, 28)}[kind]
    for l in streets[kind]:
        for side in (-1, 1):
            k = 1
            while k < len(l) - 3:
                w = rnd.uniform(6.5, 11)
                span = max(1, round(w / 4))
                if k + span >= len(l):
                    break
                (ax, az), (bx, bz) = l[k], l[k + span]
                seg = math.hypot(bx - ax, bz - az) or 1
                tx, tz = (bx - ax) / seg, (bz - az) / seg
                nx, nz = -tz * side, tx * side
                off = WIDTH[kind] / 2 + 1
                fx, fz = (ax + bx) / 2 + nx * off, (az + bz) / 2 + nz * off
                d0 = rnd.uniform(*deep)
                out = kind == 'main' and suburb(fx, fz)
                for d in (d0, d0 * .85, d0 * .7, d0 * .55, d0 * .4):
                    if d >= 9 and clear(fx, fz, tx, tz, nx, nz, seg, d, out):
                        poly = [[round(x, 1), round(z, 1)] for x, z in corners(fx, fz, tx, tz, nx, nz, seg - .1, d)]
                        lots.append(poly)
                        if out:
                            out_lots.setdefault(id(l), []).append(poly)
                        fill(corners(fx, fz, tx, tz, nx, nz, seg + .2, d + .6))
                        break
                k += span

# ---------- wards and suburbs ----------

def sector(a0, a1, r_of, n=24):
    return [[0, 0]] + [[round(v, 1) for v in polar(a0 + (a1 - a0) * k / n, r_of(a0 + (a1 - a0) * k / n))] for k in range(n + 1)]


districts = []
for d in P.get('districts', [{'id': 'town', 'name': 'Town', 'from': 0, 'to': 360}]):
    a0, a1 = d['from'] * DEG, d['to'] * DEG
    if a1 <= a0:
        a1 += 2 * math.pi
    districts.append({'id': d['id'], 'name': d['name'], 'poly': sector(a0, a1, lambda a: wall_r(a) + 1)})

# A suburb is a ward of its own along a gate road: the road's stretch past the wall, 50 m to each side.
# Its id is suburb-<bearing> and its name comes from suburbs.names by the gate's bearing.

def gate_of(l):
    """The gate a street runs out through: the one nearest the bearing of its outer end."""
    b = bearing(*l[-1])
    return min(gates, key=lambda g: abs((b - g + math.pi) % (2 * math.pi) - math.pi))


for l in streets['main']:
    if id(l) not in out_lots:
        continue
    g = gate_of(l)
    pts = [p for p in l if math.hypot(*p) > wall_r(bearing(*p)) + SUB['clear'] - 4]
    if len(pts) < 2:
        continue
    reach = 50
    left, right = [], []
    for i, (x, z) in enumerate(pts):
        a, b = pts[max(0, i - 1)], pts[min(len(pts) - 1, i + 1)]
        t = math.hypot(b[0] - a[0], b[1] - a[1]) or 1
        nx, nz = -(b[1] - a[1]) / t, (b[0] - a[0]) / t
        left.append([round(x + nx * reach, 1), round(z + nz * reach, 1)])
        right.append([round(x - nx * reach, 1), round(z - nz * reach, 1)])
    deg = str(round(g / DEG) % 360)
    districts.append({'id': f'suburb-{deg}', 'name': SUB['names'].get(deg, 'Suburb'), 'poly': left + right[::-1]})

# Country roads: each gate road runs on from its end, wandering, out to far metres from the centre.

roads = []
if FAR:
    for l in streets['main']:
        x, z = l[-1]
        if math.hypot(x, z) < R:
            continue
        a, r0 = bearing(x, z), math.hypot(x, z)
        roads.append(resample([[x, z]] + wander(a, r0, a + rnd.uniform(-.15, .15), FAR, 30, 60)[1:], 8))

# ---------- city.json ----------

pts = [p for l in [WALL] + [d['poly'] for d in districts] + [g['poly'] for g in parks] + [w['poly'] for w in water]
       + [l for ls in streets.values() for l in ls] for p in l]
x0, z0 = min(p[0] for p in pts) - 60, min(p[1] for p in pts) - 60
x1, z1 = max(p[0] for p in pts) + 60, max(p[1] for p in pts) + 60
city = {
    'seed': P.get('seed', 1), 'origin': [round(x0), round(z0)], 'dims': [round(x1 - x0), round(z1 - z0)], 'placeHalf': 34,
    'root': [0, 0], 'districts': districts, 'streets': streets, 'lots': lots, 'blocks': lots,
    'water': water, 'parks': parks, 'roads': roads, 'widths': WIDTH,
    'sites': [{k: s[k] for k in ('name', 'kind', 'at', 'w', 'd')} | {'rot': round(s['a'], 4)} for s in sites],
}
if P.get('relief'):
    city['relief'] = P['relief']
if P.get('walls', True):
    city['paths'] = [{'name': 'wall walk', 'line': resample(WALL + WALL[:1], 4), 'lift': 8, 'n': P.get('guards', 24)}]
    city['wall'] = [[round(x, 1), round(z, 1)] for x, z in WALL]
    city['gates'] = [[round(v, 1) for v in polar(g, wall_r(g))] + [round(g / DEG, 1)] for g in gates]
out = PACK / 'city.json'
out.write_text(json.dumps(city, separators=(',', ':')))
print(f'wrote {out.relative_to(PACK.parent.parent)}: {len(lots)} plots, {sum(map(len, streets.values()))} streets, '
      f'{len(districts)} wards, {len(sites)} sites')
