"""Bake landmarks/terrain.png from AWS Terrain Tiles (terrarium, open data) through the canon map warp.

World frame: metres, x east, z down the map. world = (map px - [680, 390]) * 3.6.
A thin-plate spline through the anchors in design/map-trace.json maps map px to real km east / north
of Cayambe. The traced coast wins over the real shoreline inside the map frame.

Output: SIZE x SIZE RGB, covering world [CX - EXT, CX + EXT] x [CZ - EXT, CZ + EXT].
R * 256 + G = elevation + 11000 (metres, sea below 0).
Run: python3 -I gen/terrain.py <tile-cache-dir>
"""
import json, math, os, sys, urllib.request
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt, gaussian_filter, map_coordinates

HERE = os.path.dirname(os.path.abspath(__file__))
TRACE = json.load(open(os.path.join(HERE, '..', 'design', 'map-trace.json')))
OUT = os.path.join(HERE, '..', 'landmarks', 'terrain.png')

PX0, M = np.array([680.0, 390.0]), 3.6
CX, CZ, EXT, SIZE = -158.0, 1476.0, 13000.0, 1600
Z = 8
SUMMIT = (0.0292, -77.9869)

# The Root anchor stands for Cayambe. The summit moves east of Chakana so the city stays flat
# and the peak rises behind the Root. Chone fits poorly, so the spline may miss it.
SUMMIT_PX = (1150.0, 110.0)
SMOOTH = {'Chone': 0.04}


def ll_to_km(lat, lon):
    return np.array([(lon - SUMMIT[1]) * 111.32 * math.cos(math.radians(lat)), (lat - SUMMIT[0]) * 110.574])


def km_to_ll(e, n):
    lat = SUMMIT[0] + n / 110.574
    return lat, SUMMIT[1] + e / (111.32 * np.cos(np.radians(lat)))


# ---------- thin-plate spline: map px -> km ----------

names, src, dst, lam = [], [], [], []
for a in TRACE['anchors']:
    px = SUMMIT_PX if a['name'].startswith('Root') else a['px']
    names.append(a['name'].split(' = ')[-1])
    src.append(np.array(px, float) / 1000)
    dst.append(ll_to_km(a['lat'], a['lon']))
    lam.append(next((v for k, v in SMOOTH.items() if a['name'].startswith(k)), 0.0))
src, dst = np.array(src), np.array(dst)
U = lambda r: np.where(r > 0, r * r * np.log(np.maximum(r, 1e-12)), 0)
n = len(src)
K = U(np.linalg.norm(src[:, None] - src[None], axis=2)) + np.diag(lam)
P = np.hstack([np.ones((n, 1)), src])
A = np.block([[K, P], [P.T, np.zeros((3, 3))]])
coef = np.linalg.solve(A, np.vstack([dst, np.zeros((3, 2))]))


def warp(px):
    q = px / 1000
    r = np.linalg.norm(q[:, None] - src[None], axis=2)
    return U(r) @ coef[:n] + coef[n] + q @ coef[n + 1:]


res = np.linalg.norm(warp(src * 1000) - dst, axis=1)
for nm, r in zip(names, res): print(f'  residual {nm:32s} {r:6.1f} km')
root_ll = km_to_ll(*warp(np.array([[860.0, 115.0]]))[0])
print('  Root lands at', root_ll)

# ---------- fold check over the frame ----------

gx, gy = np.meshgrid(np.linspace(0, 1272, 60), np.linspace(0, 1600, 75))
g = np.stack([gx.ravel(), gy.ravel()], 1)
e = 1.0
dx, dy = (warp(g + [e, 0]) - warp(g)) / e, (warp(g + [0, e]) - warp(g)) / e
det = dx[:, 0] * dy[:, 1] - dx[:, 1] * dy[:, 0]
print('  jacobian det over frame: min', det.min(), 'max', det.max(), '(same sign = no fold)')

# ---------- sample the tiles ----------

cache = sys.argv[1]
os.makedirs(cache, exist_ok=True)
tiles = {}


def tile(tx, ty):
    if (tx, ty) not in tiles:
        p = os.path.join(cache, f'{Z}_{tx}_{ty}.png')
        if not os.path.exists(p):
            url = f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{tx}/{ty}.png'
            with urllib.request.urlopen(url) as r, open(p, 'wb') as f: f.write(r.read())
        t = np.asarray(Image.open(p).convert('RGB')).astype(np.float64)
        tiles[(tx, ty)] = t[..., 0] * 256 + t[..., 1] + t[..., 2] / 256 - 32768
    return tiles[(tx, ty)]


ws = CX - EXT + (np.arange(SIZE) + .5) / SIZE * 2 * EXT
zs = CZ - EXT + (np.arange(SIZE) + .5) / SIZE * 2 * EXT
WX, WZ = np.meshgrid(ws, zs)
PXY = np.stack([WX.ravel(), WZ.ravel()], 1) / M + PX0
lat, lon = km_to_ll(*warp(PXY).T)
k = 256 * 2 ** Z
mx = (lon + 180) / 360 * k
my = (1 - np.log(np.tan(np.radians(lat)) + 1 / np.cos(np.radians(lat))) / math.pi) / 2 * k
tx0, ty0 = int(mx.min()) // 256, int(my.min()) // 256
tx1, ty1 = int(mx.max()) // 256, int(my.max()) // 256
mosaic = np.vstack([np.hstack([tile(tx, ty) for tx in range(tx0, tx1 + 1)]) for ty in range(ty0, ty1 + 1)])
print('  tiles', (tx1 - tx0 + 1) * (ty1 - ty0 + 1))
real = map_coordinates(mosaic, [my - ty0 * 256 - .5, mx - tx0 * 256 - .5], order=1, mode='nearest').reshape(SIZE, SIZE)

# At 82 real m per world m and 14x height, peaks turn to needles. A light blur widens them.
# Cayambe gets a broad lift so it stands above Chimborazo and Cotopaxi behind the Root.
real = gaussian_filter(real, 1.5)
sx, sz = (np.array(SUMMIT_PX) - PX0) * M
gi, gj = (sx - CX + EXT) / (2 * EXT) * SIZE, (sz - CZ + EXT) / (2 * EXT) * SIZE
ii, jj = np.meshgrid(np.arange(SIZE), np.arange(SIZE))
j0, i0 = np.unravel_index(np.argmax(np.where((ii - gi) ** 2 + (jj - gj) ** 2 < 100, real, -1e9)), real.shape)
lift = max(0.0, 6600 - real[j0, i0])
real = real + lift * np.exp(-((ii - i0) ** 2 + (jj - j0) ** 2) / (2 * 14.0 ** 2)) * (real > 0)
print('  Cayambe peak at world', CX - EXT + (i0 + .5) / SIZE * 2 * EXT, CZ - EXT + (j0 + .5) / SIZE * 2 * EXT, 'lift', round(lift))

# ---------- traced coast: sea west of the line, ends extended ----------

coast = np.array(TRACE['coast'][0], float)
head = coast[0] + (coast[0] - coast[1]) / np.linalg.norm(coast[0] - coast[1]) * 6000
tail = coast[-1] + (coast[-1] - coast[-2]) / np.linalg.norm(coast[-1] - coast[-2]) * 6000
line = np.vstack([head, coast, tail])
to_img = lambda p: ((p - PX0) * M - [CX - EXT, CZ - EXT]) / (2 * EXT) * SIZE
far = 1e5
sea_poly = np.vstack([to_img(line), [[-far, to_img(tail)[1]], [-far, to_img(head)[1]]]])
im = Image.new('L', (SIZE, SIZE))
ImageDraw.Draw(im).polygon([tuple(p) for p in sea_poly], fill=1)
sea = np.asarray(im).astype(bool)
d_sea, d_land = distance_transform_edt(sea), distance_transform_edt(~sea)

# Inside the frame's coast span the traced line decides; past its ends the real shoreline returns.
py = PXY[:, 1].reshape(SIZE, SIZE)
w = np.clip(1 - np.maximum(8 - py, py - 1592) / 250, 0, 1)
land_fix = np.maximum(real, np.minimum(2 + 15 * d_land, 60))
sea_fix = np.minimum(real, -5 - 40 * np.minimum(d_sea, 10))
elev = real * (1 - w) + np.where(sea, sea_fix, land_fix) * w

v = np.clip(np.round(elev + 11000), 0, 65535).astype(np.uint32)
rgb = np.stack([v >> 8, v & 255, np.zeros_like(v)], -1).astype(np.uint8)
Image.fromarray(rgb).save(OUT, optimize=True)
print('  wrote', OUT, 'elev', round(elev.min()), round(elev.max()))
