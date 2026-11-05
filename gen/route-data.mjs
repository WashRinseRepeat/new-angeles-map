// Writes the route editor's data: tools/routes/data.json (tracks, stations, districts, labels, loop waypoints)
// and tools/routes/aerial.jpg and height.jpg (top-down renders of the whole city).
//   node gen/route-data.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { MAP, openMap } from './harness.mjs';

const OUT = resolve(MAP, 'tools/routes');
mkdirSync(OUT, { recursive: true });
const { page, browser, server, errors } = await openMap();

try {
  const data = await page.evaluate(async () => {
    const T = await import(new URL('engine/transport.js', location.href).href);
    const { labelRoot } = await import(new URL('engine/render.js', location.href).href);
    const { CITY } = window.spike, r1 = v => Math.round(v * 10) / 10;

    // Track paths keep one point per ~12 m, enough to see curves and clashes.

    const routes = T.ROUTES.map(R => {
      const n = Math.max(8, Math.round(R.len / 12)), path = [];
      for (let i = 0; i <= n; i++) { const p = R.curve.getPointAt(i / n); path.push([r1(p.x), r1(p.z), r1(p.y)]); }
      return { name: R.name ?? (R.loop ? 'City Loop' : 'track'), lap: !!R.lap, closed: !!R.closed, root: !!R.root, len: Math.round(R.len), path };
    });
    const stations = T.STATIONS.map(st => {
      const p = st.route.curve.getPointAt(st.u);
      return { name: st.name, route: st.route.name ?? 'City Loop', x: r1(p.x), z: r1(p.z), hand: st.snap != null || !!st.of };
    });
    const labels = labelRoot.children.map(o => ({ text: o.element.textContent.trim(), kind: ['landmark', 'quarter', 'place', 'link', 'district'].find(c => o.element.classList.contains(c)) ?? 'place', x: r1(o.position.x), z: r1(o.position.z) }))
      .filter(l => l.text);
    return {
      districts: CITY.districts.map(d => ({ id: d.id, name: d.name, poly: d.poly })),
      water: CITY.water ?? [], coast: CITY.coast ?? [],
      maglev: CITY.maglev, spurs: CITY.spurs, rings: CITY.rings,
      loops: CITY.loops, stops: window.spike.SETTING.transport.maglev.stops, routes, stations, labels,
    };
  });

  // The aerial is an orthographic top-down render at 2 m per pixel, drawn tile by tile, once lit and once as a
  // height map (depth from a camera 700 m up, so ground is dark and tall buildings bright). The far plane drops
  // clouds and aircraft.

  const all = data.districts.flatMap(d => d.poly), pad = 150;
  const box = [Math.min(...all.map(p => p[0])) - pad, Math.min(...all.map(p => p[1])) - pad,
    Math.max(...all.map(p => p[0])) + pad, Math.max(...all.map(p => p[1])) + pad];
  data.aerial = { box, mpp: 2 };
  const shots = await page.evaluate(async ({ box, mpp }) => {
    const THREE = await import('three');
    const { renderer, scene } = window.spike, TILE = 1024, size = TILE * mpp, TOP = 700;
    const W = Math.ceil((box[2] - box[0]) / mpp), H = Math.ceil((box[3] - box[1]) / mpp);
    const canvas = () => Object.assign(document.createElement('canvas'), { width: W, height: H });
    const lit = canvas(), height = canvas(), litCtx = lit.getContext('2d'), heightCtx = height.getContext('2d');
    const fog = scene.fog, sun = new THREE.HemisphereLight(0xdde6ff, 0x404650, 3), depth = new THREE.MeshDepthMaterial();
    scene.fog = null;
    scene.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    renderer.setPixelRatio(1);
    renderer.setSize(TILE, TILE, false);
    for (let ty = 0; ty < H; ty += TILE) for (let tx = 0; tx < W; tx += TILE) {
      const x0 = box[0] + tx * mpp, z0 = box[1] + ty * mpp;
      const cam = new THREE.OrthographicCamera(x0, x0 + size, -z0, -(z0 + size), 1, TOP + 60);
      cam.position.set(0, TOP, 0);
      cam.up.set(0, 0, -1);
      cam.lookAt(0, 0, 0);
      scene.add(sun);
      renderer.render(scene, cam);
      litCtx.drawImage(renderer.domElement, tx, ty);
      scene.remove(sun);
      scene.overrideMaterial = depth;
      renderer.render(scene, cam);
      heightCtx.drawImage(renderer.domElement, tx, ty);
      scene.overrideMaterial = null;
    }
    scene.fog = fog;
    return [lit.toDataURL('image/jpeg', .82), height.toDataURL('image/jpeg', .85)];
  }, data.aerial);
  writeFileSync(resolve(OUT, 'aerial.jpg'), Buffer.from(shots[0].split(',')[1], 'base64'));
  writeFileSync(resolve(OUT, 'height.jpg'), Buffer.from(shots[1].split(',')[1], 'base64'));
  writeFileSync(resolve(OUT, 'data.json'), JSON.stringify(data));
  console.log(`routes ${data.routes.length}, stations ${data.stations.length}, labels ${data.labels.length}, aerial ${data.aerial.box}`);
  if (errors.length) console.log(`page errors:\n  ${errors.join('\n  ')}`);
} finally {
  await browser.close();
  server.close();
}
