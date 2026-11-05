"""Write the maglev loop routes from gen/loops.json into each city file.

Run after gen/gen.ts and gen/stitch.py: python3 -I gen/loops.py. It also empties the city files' branch lines,
which the loops replace. A second run changes nothing.
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
MAP = os.path.join(HERE, '..')
loops = json.load(open(os.path.join(HERE, 'loops.json')))['loops']

for name in ['city.json', 'city-bend.json', 'city-blend.json', 'city-stitch.json']:
    path = os.path.join(MAP, name)
    city = json.load(open(path))
    if city.get('loops') != loops or city.get('lines'):
        city['loops'] = loops
        city['lines'] = []
        open(path, 'w').write(json.dumps(city, separators=(',', ':')))
        print('patched', name)
