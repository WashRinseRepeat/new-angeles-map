"""Add the coast line: from the Esmeraldas line's end at the Malecón along the north coast to the loop in Base de Cayambe.

It matches the last entry of LINES in gen/gen.ts. Its own line keeps the Esmeraldas line's track and name as they were.
Run after gen/gen.ts: python3 -I gen/esm-coast-line.py. A second run changes nothing.
"""
import json, os

MAP = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PX = [[214, 348], [226.9, 323.3], [263.3, 315], [318.9, 316.7], [380, 313.3], [438.3, 314.4], [467.5, 309.4], [482.2, 292.8], [493.9, 267.8], [513.3, 259.4], [563.3, 263.1]]
EXT = [[round((u - 680) * 3.6, 4), round((v - 390) * 3.6, 4)] for u, v in PX]

for name in ['city.json', 'city-bend.json', 'city-blend.json', 'city-stitch.json']:
    path = os.path.join(MAP, name)
    city = json.load(open(path))
    if EXT in city['lines']:
        continue
    city['lines'].append(EXT)
    open(path, 'w').write(json.dumps(city, separators=(',', ':')))
    print('patched', name)
