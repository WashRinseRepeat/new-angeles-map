// The undercity: the old ground level under the plaza, shown by the Undercity layer.
// Every district gets caverns under its blocks in its own style, plus shared tunnels, coolant mains and metro tubes.
// It is a New Angeles layer. The engine loads it on the first switch to the layer and shows group and labels.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CENTRE, CITY, DX, DZ, PLACES, QUARTERS, centroidOf, hash, lerp, quarterAt, rng, styleAt, vnoise } from '../../engine/core.js';
import { flatGeo, label, scene } from '../../engine/render.js';
import { put } from '../../engine/instances.js';
import { insidePoly } from '../../engine/grammar.js';
import { STREETS, pts, sweep } from '../../engine/transport.js';

export const UNDER = new THREE.Group();
UNDER.visible = false;
scene.add(UNDER);
export const UNDER_LABELS = [];
const inMercado = (x, z) => quarterAt(x, z)?.id === 'mercado-baja';

// One brief per district, from design/districts/<id>.md.
// floor: cavern floor height. share: rough fraction of blocks with caverns. fill: shacks per area.
// stack: most shacks per pile. tint: shack colour. lamps: lit colours. litP: chance a shack is lit.
// flood: water height. halls: barracks rows. lifts: home-built lifts up to the plaza. gallows: market caverns.

const UC = {
  chakana: { label: 'Chakana root vaults', floor: -24, share: .4, fill: .8, stack: 2, tint: [.22, .2, .2], lamps: [[.4, 1.3, 1.8], [1.4, .8, .3]], litP: .55 },
  'base-de-cayambe': { label: 'Cayambe undercity', floor: -26, share: .5, fill: 1, stack: 3, tint: [.3, .2, .13], lamps: [[1.4, .7, .25], [1.4, .7, .25], [1.4, .7, .25], [.25, 1.1, 1.2]], litP: .6 },
  rutherford: { label: 'Rutherford service decks', floor: -28, share: .3, fill: .45, stack: 1, tint: [.12, .16, .2], lamps: [[.3, 1.3, 1.8]], litP: .85 },
  esmeraldas: { label: 'Esmeraldas shallows', floor: -14, share: .6, fill: .8, stack: 2, tint: [.28, .22, .16], lamps: [[1.5, .95, .5]], litP: .55 },
  nihongai: { label: 'Nihongai clone warrens', floor: -22, share: .65, halls: true, tint: [.26, .28, .28], lamps: [[1.1, 1.15, 1.1]], litP: 1 },
  'laguna-velasco': { label: 'Velasco sweep zone', floor: -24, share: .55, fill: 1.1, stack: 2, tint: [.2, .17, .15], lamps: [[1.7, .15, .12], [.2, .5, 1.9], [1.4, 1.4, 1.5]], litP: .35 },
  manta: { label: 'Manta sand cellars', floor: -8, share: .15, fill: .5, stack: 1, tint: [.36, .31, .24], lamps: [[1.6, .4, 1.2], [.3, 1.4, 1.5]], litP: .6 },
  rabotgorod: { label: 'Rabotgorod pits', floor: -28, share: .7, fill: 1.1, stack: 5, tint: [.17, .18, .17], lamps: [[.6, 1.3, .8], [.4, .7, 1.5]], litP: .4, lifts: true },
  'la-costa': { label: 'La Costa root cellars', floor: -8, share: .12, fill: .4, stack: 1, tint: [.26, .22, .15], lamps: [[1.3, .9, .4]], litP: .4 },
  quinde: { label: 'Quinde dark streets', floor: -20, share: .75, fill: 1.2, stack: 3, tint: [.15, .12, .09], lamps: [[1.4, .6, .12]], litP: .15 },
  akeidito: { label: 'Akeidito Gallows', floor: -28, share: 1, tint: [.3, .16, .12], lamps: [[1.9, .2, .12], [1.6, .75, .25], [1.9, .25, 1], [.25, 1.3, 1.8]], litP: .6, gallows: true },
  guayaquil: { label: 'Drowned Guayaquil', floor: -26, share: .6, fill: .9, stack: 3, tint: [.2, .16, .12], lamps: [[1.5, .5, .2], [.3, 1.3, .9]], litP: .45, flood: -20 },
};
const PACHINKO = { ...UC.nihongai, halls: false, fill: 1.3, stack: 2, tint: [.14, .1, .14], lamps: [[1.9, .2, 1.1], [1.8, 1.3, .3], [.3, 1.4, 1.8]], litP: .95 };
const LAKESIDE_FLOOD = -19;

const subareaAt = (x, z, scale = 1) => {
  let best = null, bd = Infinity;
  for (const a of CITY.subareas ?? []) {
    const d = Math.hypot(x - a.at[0], z - a.at[1]) / a.r;
    if (d < scale && d < bd) { bd = d; best = a.name; }
  }
  return best;
};
const idAt = (x, z) => styleAt(x, z, 1).id;

// The undercity builds on first use. It holds about 2 M triangles and takes seconds to build, so page load skips it.

let built = false;
export function buildUnder() {
  if (built) return;
  built = true;
  const N = { cyl: 20000, box: 74000, lit: 62000 };
  const cyl = new THREE.InstancedMesh(new THREE.CylinderGeometry(.5, .5, 1, 10), new THREE.MeshStandardMaterial({ color: 0x6a5e52, roughness: .8 }), N.cyl);
  const box = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: .9 }), N.box);
  const lit = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), N.lit);
  for (const m of [cyl, box, lit]) { m.count = 0; m.frustumCulled = false; UNDER.add(m); }
  const at = (m, x, y, z, sx, sy, sz, rgb) => put(m, x, y, z, sx, sy, sz, 0, 0, rgb);

  // Tunnels under main and major streets. The lamp strip takes the colour of the district above.

  const rock = new THREE.MeshStandardMaterial({ color: 0x5a4e44, emissive: 0x120c08, roughness: .95, side: THREE.DoubleSide });
  const lampMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const coolMat = new THREE.MeshStandardMaterial({ color: 0x1a4a55, emissive: 0x0a3a48, roughness: .4, metalness: .6 });
  const U_CHANNEL = [[-3.2, 0], [-3.2, -5.2], [3.2, -5.2], [3.2, 0], [2.8, 0], [2.8, -4.8], [-2.8, -4.8], [-2.8, 0]];
  const STRIP = [[-.6, -4.75], [.6, -4.75], [.6, -4.7], [-.6, -4.7]];
  const PIPE = [[4.2, -1.6], [5.2, -1.6], [5.2, -2.6], [4.2, -2.6]];
  const shell = [], strip = [], pipes = [];
  const colourBySegment = (g, path, profileLen, rgbAt) => {
    const per = profileLen * 6, col = new Float32Array(g.attributes.position.count * 3);
    for (let v = 0; v < g.attributes.position.count; v++) col.set(rgbAt(path[Math.floor(v / per)]), v * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  };
  for (const st of STREETS) if (st.kind !== 'minor') {
    const path = st.path.filter((_, i) => i % 3 === 0).map(p => new THREE.Vector3(p.x, -4, p.z));
    if (path.length < 3) continue;
    shell.push(sweep(path, U_CHANNEL, false));
    strip.push(colourBySegment(sweep(path, STRIP, false), path, STRIP.length, p => UC[idAt(p.x, p.z)].lamps[0].map(c => c * .75)));
    if (st.kind === 'main') pipes.push(sweep(path, PIPE, false));
  }
  UNDER.add(new THREE.Mesh(mergeGeometries(shell), rock), new THREE.Mesh(mergeGeometries(strip), lampMat), new THREE.Mesh(mergeGeometries(pipes), coolMat));

  // Service shafts rise from the tunnels to the plaza.

  for (const st of STREETS) if (st.kind !== 'minor') for (let k = 6; k < st.path.length; k += 36) {
    const p = st.path[k], sd = st.side[k], x = p.x + sd.x * 4.2, z = p.z + sd.z * 4.2;
    at(cyl, x, -4.6, z, 2.2, 9.2, 2.2);
    at(lit, x, -.6, z, 1.4, .2, 1.4, [.9, .55, .2]);
  }

  // Metro tubes follow the maglev loop and the transit lines at y −20, with a light strip on top.

  const tubeLines = [pts.filter((_, i) => i % 4 === 0).concat([pts[0]])];
  for (const l of CITY.lines ?? []) tubeLines.push(new THREE.CatmullRomCurve3(l.map(([x, z]) => new THREE.Vector3(x, 0, z))).getSpacedPoints(l.length * 30));
  const TUBE = Array.from({ length: 8 }, (_, k) => [3 * Math.cos(k * Math.PI / 4), 3 * Math.sin(k * Math.PI / 4)]);
  const TUBE_STRIP = [[-.5, 3.05], [.5, 3.05], [.5, 3.15], [-.5, 3.15]];
  const tubes = [], tubeLit = [];
  for (const l of tubeLines) {
    const path = l.map(p => new THREE.Vector3(p.x, -20, p.z));
    tubes.push(sweep(path, TUBE, false));
    tubeLit.push(sweep(path, TUBE_STRIP, false));
    for (let k = 0; k < path.length; k += 40) at(lit, path[k].x, -20, path[k].z, 9, 4, 9, [.5, 1.5, 1.2]);
  }
  UNDER.add(new THREE.Mesh(mergeGeometries(tubes), new THREE.MeshStandardMaterial({ color: 0x3a4450, roughness: .5, metalness: .6, side: THREE.DoubleSide })),
    new THREE.Mesh(mergeGeometries(tubeLit), new THREE.MeshBasicMaterial({ color: new THREE.Color(.6, 1.6, 1.3), side: THREE.DoubleSide })));

  // Caverns sit under blocks where noise passes the district's share, and always under Mercado Baja (the Gullet)
  // and the Akeidito quarter (the Gallows).

  const mercado = PLACES.find(p => p.slug === 'mercado-baja');
  const floorsBy = {}, foam = [], floodG = [], floodL = [], centres = {};
  const shade = (rgb, v) => rgb.map(c => c * v);
  for (const b of CITY.blocks) {
    const [cx, cz] = centroidOf(b), id = quarterAt(cx, cz)?.id === 'akeidito' ? 'akeidito' : idAt(cx, cz), sub = subareaAt(cx, cz, 1.3);
    let D = UC[id];
    const gullet = inMercado(cx, cz) || (mercado && Math.hypot(cx - mercado.x, cz - mercado.z) < 120);
    if (sub === 'Nuevo Guayaquil') { foam.push(b); continue; }
    if (!gullet && vnoise(cx / 170 + 21, cz / 170 + 4) < 1 - D.share) continue;
    if (id === 'nihongai' && subareaAt(cx, cz, 1.6) === 'Tourist Quarter') D = PACHINKO;
    (floorsBy[id] ??= []).push(b);
    (centres[id] ??= []).push([cx, cz]);
    const flood = id === 'guayaquil' ? D.flood : id === 'laguna-velasco' && sub === 'Lakeside' ? LAKESIDE_FLOOD : null;
    if (flood === D.flood && flood != null) floodG.push(b);
    else if (flood != null) floodL.push(b);

    const r = rng(hash(Math.round(cx), Math.round(cz) + 7)), f = D.floor;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of b) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    for (let x = x0 + 6; x < x1; x += 16) for (let z = z0 + 6; z < z1; z += 16)
      if (insidePoly(x, z, b)) at(cyl, x, f / 2, z, 3.2, -f, 3.2);

    // Nihongai barracks: tidy rows of long halls with a light strip along each roof.

    if (D.halls) {
      for (let x = x0 + 4; x < x1 - 2; x += 7) for (let z = z0 + 8; z < z1 - 6; z += 15) {
        if (!insidePoly(x, z, b)) continue;
        for (let t = 0, n = r() < .5 ? 2 : 1; t < n; t++) {
          const y = f + t * 3.4;
          at(box, x, y + 1.6, z, 4.4, 3.2, 12.5, shade(D.tint, .9 + .2 * r()));
          at(lit, x, y + 3.25, z, .5, .1, 11.5, D.lamps[0]);
        }
      }
      continue;
    }

    // Akeidito Gallows: market lanes on the cavern floor, walkway decks at two levels, red lanterns hung in the air.

    if (D.gallows) {
      const any = () => D.lamps[Math.floor(r() * D.lamps.length)];
      for (let z = z0 + 7; z < z1 - 4; z += 14) for (let x = x0 + 4; x < x1 - 3; x += 5) for (const s of [-1, 1]) {
        const sz = z + s * 3.4, h = 2.2 + r() * .8;
        if (r() > .6 || !insidePoly(x, sz, b)) continue;
        at(box, x, f + h / 2, sz, 3.6, h, 2.6, shade(D.tint, .8 + .5 * r()));
        at(box, x, f + h + .1, sz - s * 1.6, 4, .2, 1.4, shade(D.tint, 1.6));
        if (r() < D.litP) at(lit, x, f + 1.1, sz - s * 1.32, 3, .25, .05, any());
      }
      for (const y of [f + 9, f + 17]) for (let z = z0 + 14; z < z1 - 6; z += 28) {
        const mx = (x0 + x1) / 2, L = x1 - x0 - 6;
        if (!insidePoly(mx, z, b)) continue;
        at(box, mx, y, z, L, .4, 3.2, shade(D.tint, .6));
        at(lit, mx, y + .25, z + 1.55, L, .08, .08, D.lamps[1]);
        for (let x = x0 + 6; x < x1 - 6; x += 8) if (r() < .45) {
          at(box, x, y + 1.2, z - .6, 2.4, 2, 1.8, shade(D.tint, .9 + .4 * r()));
          at(lit, x, y + 1.2, z + .32, 1.8, .5, .05, any());
        }
      }
      for (let k = 0; k < 18; k++) {
        const x = lerp(x0, x1, r()), z = lerp(z0, z1, r()), y = -4 - r() * 14;
        if (!insidePoly(x, z, b)) continue;
        at(box, x, (y - 1.5) / 2, z, .06, -1.5 - y, .06, [.05, .04, .04]);
        at(lit, x, y, z, .7, .9, .7, r() < .65 ? D.lamps[0] : D.lamps[1]);
      }
      continue;
    }

    // Everywhere else: piles of shacks, some lit, with a few lamps hung in the cavern air.

    const n = Math.min(60, Math.round((x1 - x0) * (z1 - z0) / 90 * D.fill));
    for (let k = 0; k < n; k++) {
      const x = lerp(x0, x1, r()), z = lerp(z0, z1, r());
      if (!insidePoly(x, z, b)) continue;
      let y = f;
      for (let s = 1 + Math.floor(r() * D.stack); s > 0 && y < -3.5; s--) {
        const w = 3 + r() * 4, d = 3 + r() * 4, h = Math.min(2.6 + r() * 1.6, -1 - y), v = .7 + .6 * r();
        at(box, x, y + h / 2, z, w, h, d, shade(D.tint, v));
        if (r() < D.litP) at(lit, x + w / 2 + .05, y + h * .55, z, .1, h * .35, d * .4, D.lamps[Math.floor(r() * D.lamps.length)]);
        y += h;
      }
      if (r() < .4) at(lit, x, Math.min(-1.5, f + 4 + r() * 6), z, .7, .7, .7, D.lamps[Math.floor(r() * D.lamps.length)]);
    }

    // Rabotgorod: home-built lifts climb from the pit floor to the plaza.

    if (D.lifts) for (let k = 0; k < 3; k++) {
      const x = lerp(x0, x1, r()), z = lerp(z0, z1, r());
      if (!insidePoly(x, z, b)) continue;
      at(cyl, x, f / 2, z, .7, -f, .7);
      for (let y = f + 3; y < -1; y += 5) at(lit, x, y, z, 1.2, .3, 1.2, D.lamps[0]);
    }
  }

  // Chakana: a ring of root pillars round the Beanstalk foundation.

  for (let k = 0; k < 32; k++) {
    const a = k / 32 * Math.PI * 2, x = CENTRE.x + Math.cos(a) * 70, z = CENTRE.y + Math.sin(a) * 70;
    at(cyl, x, -12, z, 9, 24, 9);
    at(lit, x, -22, z, 9.4, .4, 9.4, UC.chakana.lamps[0]);
  }

  // Old tunnels run out of the Gallows under the streets round Akeidito, lit by amber caged lamps.

  const ak = QUARTERS.find(q => q.id === 'akeidito');
  if (ak) {
    const [gx, gz] = centroidOf(ak.poly), old = [];
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + .4, path = [];
      for (let s = 100; s <= 340; s += 8) {
        const w = (vnoise(s / 60 + k * 7, 3) - .5) * 30;
        path.push(new THREE.Vector3(gx + Math.cos(a) * s - Math.sin(a) * w, -24, gz + Math.sin(a) * s + Math.cos(a) * w));
      }
      old.push(sweep(path, TUBE, false));
      for (let i = 1; i < path.length; i += 2) at(lit, path[i].x, -21.3, path[i].z, .6, .3, .6, UC.akeidito.lamps[1]);
    }
    UNDER.add(new THREE.Mesh(mergeGeometries(old), rock));
  }
  for (const m of [cyl, box, lit]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }

  // Cavern floors take a dark shade of the district tint. Floods and the Nuevo hardfoam seal sit on top.

  const floorGeos = [];
  for (const [id, polys] of Object.entries(floorsBy)) {
    const g = flatGeo(polys, UC[id].floor), c = new THREE.Color(...shade(UC[id].tint, .55));
    const col = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < col.length; i += 3) col.set([c.r, c.g, c.b], i);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    floorGeos.push(g);
  }
  UNDER.add(new THREE.Mesh(mergeGeometries(floorGeos), new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0x0c0806, roughness: 1, side: THREE.DoubleSide })));
  const flood = [floodG.length && flatGeo(floodG, UC.guayaquil.flood), floodL.length && flatGeo(floodL, LAKESIDE_FLOOD)].filter(Boolean);
  if (flood.length) UNDER.add(new THREE.Mesh(mergeGeometries(flood), new THREE.MeshStandardMaterial({ color: 0x14586e, emissive: 0x0a3442, roughness: .1, metalness: .5, transparent: true, opacity: .82, side: THREE.DoubleSide })));
  if (foam.length) UNDER.add(new THREE.Mesh(flatGeo(foam, -1.5), new THREE.MeshStandardMaterial({ color: 0x8a8f86, emissive: 0x15171a, roughness: 1, side: THREE.DoubleSide })));

  // Bedrock, and each district's outline traced on its cavern floor in its lamp colour.

  UNDER.add(new THREE.Mesh(new THREE.PlaneGeometry(DX + 40, DZ + 40).rotateX(-Math.PI / 2).translate(0, -30, 0),
    new THREE.MeshStandardMaterial({ color: 0x0d0b0a, roughness: 1 })));
  const seg = [], segCol = [];
  for (const d of CITY.districts) {
    const D = UC[d.id], y = D.floor + .3;
    for (let i = 0; i < d.poly.length; i++) {
      const [ax, az] = d.poly[i], [bx, bz] = d.poly[(i + 1) % d.poly.length];
      seg.push(ax, y, az, bx, y, bz);
      segCol.push(...D.lamps[0], ...D.lamps[0]);
    }
  }
  const lines = new THREE.BufferGeometry();
  lines.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
  lines.setAttribute('color', new THREE.Float32BufferAttribute(segCol, 3));
  UNDER.add(new THREE.LineSegments(lines, new THREE.LineBasicMaterial({ vertexColors: true })));

  // One label per district undercity, over the middle of its caverns.

  for (const d of CITY.districts) {
    const D = UC[d.id], cs = centres[d.id];
    const [x, z] = cs?.length ? centroidOf(cs) : centroidOf(d.poly);
    UNDER_LABELS.push(label(D.label, 'district', new THREE.Vector3(x, D.floor + 8, z), D.lamps[0].map(c => c * 2.6 / Math.max(...D.lamps[0]))));
  }
  if (centres.akeidito) { const [x, z] = centroidOf(centres.akeidito); UNDER_LABELS.push(label('Akeidito Gallows', 'district quarter', new THREE.Vector3(x, -12, z))); }
  if (mercado) UNDER_LABELS.push(label('The Gullet', 'district quarter', new THREE.Vector3(mercado.x, -8, mercado.z)));
  for (const el of UNDER_LABELS) el.obj.visible = false;
  UNDER.userData.stats = { cyl: cyl.count, box: box.count, lit: lit.count, meshes: UNDER.children.length };
}

// The layer contract: the group to show, its labels and an idempotent build.

export { UNDER as group, UNDER_LABELS as labels, buildUnder as build };
