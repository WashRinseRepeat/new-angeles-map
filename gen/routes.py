"""Write a route editor edits file into gen/loops.json and the city files.

python3 -I gen/routes.py tools/routes/edits/<file>.json

The edits give the loops, the City Loop (maglev), the spurs, the rings and the stops in world metres (stops in map px).
This writes the loops to gen/loops.json and the City Loop, spurs and rings to each city file. Then run
gen/loops.py. The stops go into the setting by hand, and so do MAGLEV, SPURS and RINGS in gen/gen.ts. A second run
changes nothing.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
MAP = os.path.join(HERE, '..')
edits = json.load(open(sys.argv[1]))

loops = [{k: v for k, v in l.items() if k != 'closed'} for l in edits['loops']]
path = os.path.join(HERE, 'loops.json')
if json.load(open(path))['loops'] != loops:
    open(path, 'w').write(json.dumps({'loops': loops}, separators=(',', ':')))
    print('patched loops.json')

want = {'maglev': edits['maglev'], 'spurs': [s['pts'] for s in edits['spurs']], 'rings': [r['pts'] for r in edits['rings']]}
for name in ['city.json', 'city-bend.json', 'city-blend.json', 'city-stitch.json']:
    path = os.path.join(MAP, name)
    city = json.load(open(path))
    if any(city.get(k) != v for k, v in want.items()):
        city.update(want)
        open(path, 'w').write(json.dumps(city, separators=(',', ':')))
        print('patched', name)
