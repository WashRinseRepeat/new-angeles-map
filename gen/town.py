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
    lanes 3          lanes between each pair of gate streets
    districts [...]  {id, name, from, to}: wards as bearing ranges in degrees, clockwise from `from`
    sites [...]      {name, kind, bearing, dist, w, d, rot}: plot-free sites, dist from the centre, rot in degrees
    river {...}      {bearing, dist, width}: a river past the wall, square to the bearing, or null
    greens [...]     {name, from, to, inner, outer}: greens past the wall. A name with "park" grows woods, any
                     other name fields. inner and outer are metres past the wall.
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
WIDTH = {'main': 8, 'major': 6, 'minor': 4}
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


gates = [g * DEG for g in P.get('gates', [10, 100, 190, 320])]
streets = {'main': [], 'major': [], 'minor': []}
for g in gates:
    streets['main'].append(resample(wander(g, SQ + 2, g + rnd.uniform(-.05, .05), wall_r(g) + P.get('road', 60), 24, 10)))
ring = [polar(k / 180 * 2 * math.pi, wall_r(k / 180 * 2 * math.pi) - 12) for k in range(181)]
streets['major'].append(resample(ring))

# Lanes run out from near the square to the ring lane between each pair of gate streets. A cross lane joins
# neighbouring lanes halfway out.

inner = SQ + 26
for g0, g1 in zip(gates, gates[1:] + [gates[0] + 2 * math.pi]):
    n = P.get('lanes', 3)
    angles = [g0 + (g1 - g0) * (k + 1) / (n + 1) + rnd.uniform(-.06, .06) for k in range(n)]
    for a in angles:
        streets['minor'].append(resample(wander(a, inner, a + rnd.uniform(-.08, .08), wall_r(a) - 12, 16, 9)))
    for a0, a1 in zip([g0] + angles, angles + [g1]):
        mid = (inner + wall_r((a0 + a1) / 2) - 12) / 2 + rnd.uniform(-25, 25)
        arc = [polar(a0 + (a1 - a0) * k / 12, mid + 6 * math.sin(k / 12 * math.pi * 2 + a0)) for k in range(13)]
        streets['minor'].append(resample(arc))
    arc = [polar(g0 + (g1 - g0) * k / 16, inner) for k in range(17)]
    streets['major'].append(resample(arc))

# ---------- sites: plot-free rectangles for the pack's landmarks ----------

sites = []
for s in P.get('sites', []):
    a, rot = s['bearing'] * DEG, s.get('rot', s['bearing'] + 90) * DEG
    x, z = polar(a, s['dist'])
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

# ---------- plots: narrow, deep lots along every street ----------
# A 1 m occupancy grid holds the streets, the square, the sites and the plots laid so far. Main streets take
# their frontage first, then the ring and the inner lanes, then the minor lanes.

EXT = int(R * 1.4) + 60
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


def clear(fx, fz, tx, tz, nx, nz, w, d):
    for u in range(-2, 3):
        for v in range(4):
            px = fx + tx * w / 2 * u / 2.2 + nx * (d * (v + .5) / 4)
            pz = fz + tz * w / 2 * u / 2.2 + nz * (d * (v + .5) / 4)
            k = cell(px, pz)
            if k is None or taken[k] or not inside(px, pz, 6) or in_site(px, pz, 3) or math.hypot(px, pz) < SQ + 3:
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


lots = []
for kind in ('main', 'major', 'minor'):
    deep = {'main': (22, 32), 'major': (16, 26), 'minor': (14, 22)}[kind]
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
                for d in (d0, d0 * .75, d0 * .55):
                    if d >= 9 and clear(fx, fz, tx, tz, nx, nz, seg, d):
                        poly = corners(fx, fz, tx, tz, nx, nz, seg - .4, d)
                        lots.append([[round(x, 1), round(z, 1)] for x, z in poly])
                        fill(corners(fx, fz, tx, tz, nx, nz, seg + .4, d + .6))
                        break
                k += span

# ---------- wards, greens and the river ----------

def sector(a0, a1, r_of, n=24):
    return [[0, 0]] + [[round(v, 1) for v in polar(a0 + (a1 - a0) * k / n, r_of(a0 + (a1 - a0) * k / n))] for k in range(n + 1)]


districts = []
for d in P.get('districts', [{'id': 'town', 'name': 'Town', 'from': 0, 'to': 360}]):
    a0, a1 = d['from'] * DEG, d['to'] * DEG
    if a1 <= a0:
        a1 += 2 * math.pi
    districts.append({'id': d['id'], 'name': d['name'], 'poly': sector(a0, a1, lambda a: wall_r(a) + 1)})

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

# ---------- city.json ----------

pts = [p for l in [WALL] + [d['poly'] for d in districts] + [g['poly'] for g in parks] + [w['poly'] for w in water]
       + [l for ls in streets.values() for l in ls] for p in l]
x0, z0 = min(p[0] for p in pts) - 60, min(p[1] for p in pts) - 60
x1, z1 = max(p[0] for p in pts) + 60, max(p[1] for p in pts) + 60
city = {
    'seed': P.get('seed', 1), 'origin': [round(x0), round(z0)], 'dims': [round(x1 - x0), round(z1 - z0)], 'placeHalf': 34,
    'root': [0, 0], 'districts': districts, 'streets': streets, 'lots': lots, 'blocks': lots,
    'water': water, 'parks': parks,
    'sites': [{k: s[k] for k in ('name', 'kind', 'at', 'w', 'd')} | {'rot': round(s['a'], 4)} for s in sites],
}
if P.get('walls', True):
    city['wall'] = [[round(x, 1), round(z, 1)] for x, z in WALL]
    city['gates'] = [[round(v, 1) for v in polar(g, wall_r(g))] + [round(g / DEG, 1)] for g in gates]
out = PACK / 'city.json'
out.write_text(json.dumps(city, separators=(',', ':')))
print(f'wrote {out.relative_to(PACK.parent.parent)}: {len(lots)} plots, {sum(map(len, streets.values()))} streets, '
      f'{len(districts)} wards, {len(sites)} sites')
