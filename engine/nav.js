// Player navigation: search, atlas, session tours, minimap and filter chips.

import * as THREE from 'three';
import { CITY, PLACES, STALK_PLACE, STANDALONE } from './core.js';
import { camera, controls, scene } from './render.js';
import { insidePoly } from './grammar.js';
import { FIND_FAMILIES, LANDMARK_SITES } from './api.js';
import { centroidOf } from './undercity.js';
import { DISTRICT_LABELS, LOCAL, card, flyTo, hideCard, pins, select, viewPlace } from './ui.js';
import { fireworks } from './fireworks.js';
import { EPISODES, initAudioTour, resumeAt, startAudioTour, stopAudioTour } from './audiotour.js';
import { TOURS, startRide, stopRide } from './ride.js';

const $ = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' }[c]};`);
// ui.js imports this module, so its bindings are read only after it loads.

const site = () => LOCAL ? 'http://localhost:1313/' : '../';
const PHONE = matchMedia('(max-width: 600px)').matches;
const V = (x, z, y = 0) => new THREE.Vector3(x, y, z);

// Places with a card: campaign pins, the Beanstalk and landmarks with a slug.

const CARDS = [...PLACES, STALK_PLACE, ...LANDMARK_SITES.map(l => l.place).filter(Boolean)].filter(p => p.top);
const bySlug = new Map(CARDS.map(p => [p.slug, p]));

const DISTRICTS = CITY.districts.map(d => {
  const xs = d.poly.map(p => p[0]), zs = d.poly.map(p => p[1]);
  const [cx, cz] = centroidOf(d.poly);
  return { ...d, cx, cz, size: Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)), places: [], marks: [] };
});
const districtAt = (x, z) => DISTRICTS.find(d => insidePoly(x, z, d.poly));

// District names show without the trailing "District".

export const nameOf = d => d.name.replace(/\s+District$/i, '');

// Offshore builds sit outside every outline. They belong to the district with the closest outline point.

const districtNear = (x, z) => districtAt(x, z) ?? DISTRICTS.reduce((a, d) => {
  const g = Math.min(...d.poly.map(([px, pz]) => Math.hypot(px - x, pz - z)));
  return g < a.g ? { d, g } : a;
}, { d: null, g: Infinity }).d;
for (const p of CARDS) if (p !== STALK_PLACE) districtAt(p.x ?? p.top.x, p.z ?? p.top.z)?.places.push(p);
// A landmark without a label, such as a second block of a larger site, stays out of the lists.

for (const l of LANDMARK_SITES) if (l.el) districtNear(l.x, l.z)?.marks.push(l);

// Category chips. Campaign places fall into a group by their free-text type; landmarks carry one from their card.

const TYPES = { food: /bar|caf|noodle|food|restaurant/i, shop: /shop|market|outfit/i, corp: /corp|industr|facility|lab/i };
const typeOf = p => Object.keys(TYPES).find(k => TYPES[k].test(p.type ?? ''));

// ---------- district and landmark cards ----------

let LORE = { districts: {}, landmarks: {} };

// A card's text runs on into its crew paragraphs, the campaign's history at that spot. The public copy has none.

const loreText = lore => lore && [lore.text, lore.crew ?? []].flat();
const districtCard = d => {
  const lore = LORE.districts[d.id], page = pageOf(d);
  return { title: nameOf(d), district: 'District', type: lore?.kicker, summary: loreText(lore) ?? SUMMARY[d.id] ?? '',
    link: page && `${site()}locations/${page.slug}/`, view: () => showDistrict(d) };
};
const markCard = l => {
  const lore = LORE.landmarks[l.name], base = l.place ?? { title: l.name, top: V(l.x, l.z, l.y), frame: l.frame };
  return Object.assign(base, { district: districtNear(l.x, l.z) ? nameOf(districtNear(l.x, l.z)) : '', type: lore?.kicker ?? base.type, summary: loreText(lore) ?? base.summary ?? '' });
};
const openMark = l => select(markCard(l));

// ---------- camera moves ----------

let outline = null, current = null;
function showDistrict(d) {
  current = d;
  if (outline) { scene.remove(outline); outline.geometry.dispose(); }
  outline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(d.poly.map(([x, z]) => V(x, z, 4))),
    new THREE.LineBasicMaterial({ color: 0x7ff3ff, fog: false, transparent: true, opacity: .9 }));
  scene.add(outline);
  flyTo(V(d.cx, d.cz), Math.min(2600, d.size * .9));
  drawMinimap();
}

// A location slug opens its card, or flies to its district when it is a district page.

let INDEX = { locations: [], recaps: [] };
const locOf = slug => INDEX.locations.find(l => l.slug === slug);
const norm = t => String(t ?? '').toLowerCase().replace(/ district$/, '');
function districtOfSlug(slug) {
  const loc = locOf(slug);
  return DISTRICTS.find(d => slug === d.id || slug === `${d.id}-district`) ?? DISTRICTS.find(d => loc && norm(loc.district) === norm(d.name));
}
const pageOf = d => INDEX.locations.find(l => l.slug === d.id || l.slug === `${d.id}-district`);

// ---------- search ----------

const q = $('q'), results = $('results');
const KIND = ['Location', 'Landmark', 'District'];
let ROWS = [], hits = [], sel = 0;
function buildRows() {
  ROWS = [
    ...CARDS.filter(p => !LANDMARK_SITES.some(l => l.place === p)).map(p => ({ kind: 'Location', name: p.title, alt: locOf(p.slug)?.title, sub: p.district || districtAt(p.top.x, p.top.z)?.name, go: () => select(p) })),
    ...DISTRICTS.flatMap(d => [
      ...d.marks.map(l => ({ kind: 'Landmark', name: l.name, sub: nameOf(d), go: () => openMark(l) })),
      { kind: 'District', name: nameOf(d), sub: `${d.places.length + d.marks.length} places`, go: () => { openDistrict(d); select(districtCard(d)); } },
    ]),
  ];
}

// Lower is better: exact name, prefix, word start, substring, then letters in order.

function score(name, t) {
  const n = name.toLowerCase(), i = n.indexOf(t);
  if (i === 0) return n.length === t.length ? 0 : .5;
  if (i > 0) return /\W/.test(n[i - 1]) ? 1 : 2;
  let k = 0, gap = 0;
  for (const c of n) { if (c === t[k]) k++; else if (k) gap++; if (k === t.length) return gap <= t.length ? 3 + gap / 20 : -1; }
  return -1;
}
function search() {
  const t = q.value.trim().toLowerCase();
  hits = !t ? [] : ROWS.map(r => ({ r, s: Math.min(...[r.name, r.alt].filter(Boolean).map(n => score(n, t)).map(s => s < 0 ? 99 : s)) }))
    .filter(h => h.s < 99).sort((a, b) => a.s - b.s).slice(0, 10);

  // Groups follow their best hit, so an exact district name leads over a location that merely contains it.

  const best = {};
  for (const h of hits) best[h.r.kind] = Math.min(best[h.r.kind] ?? 99, h.s);
  hits = hits.sort((a, b) => best[a.r.kind] - best[b.r.kind] || KIND.indexOf(a.r.kind) - KIND.indexOf(b.r.kind) || a.s - b.s).map(h => h.r);
  sel = 0;
  let last = '';
  const re = t && new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i');
  results.innerHTML = hits.map((r, i) => `${r.kind !== last ? `<div class="grp">${(last = r.kind)}</div>` : ''}<button class="r${i ? '' : ' sel'}" data-i="${i}"><span>${esc(r.name).replace(re, '<mark>$1</mark>')}</span><small>${esc(r.sub)}</small></button>`).join('')
    || (t ? '<div class="none">No match</div>' : '');
}
function pick(r) { r.go(); q.value = ''; search(); q.blur(); }
q.oninput = search;
q.onkeydown = e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    sel = (sel + (e.key === 'ArrowDown' ? 1 : hits.length - 1)) % Math.max(hits.length, 1);
    results.querySelectorAll('.r').forEach((el, i) => el.classList.toggle('sel', i === sel));
    e.preventDefault();
  }
  if (e.key === 'Enter' && hits[sel]) pick(hits[sel]);
  if (e.key === 'Escape') { q.value = ''; search(); q.blur(); }
};
results.onclick = e => { const b = e.target.closest('.r'); if (b) pick(hits[+b.dataset.i]); };

// ---------- atlas ----------

const atlas = $('atlas');
const leaf = (name, kind, i, color) => `<button class="leaf" data-k="${kind}" data-i="${i}"><i style="background:${color}"></i>${esc(name)}</button>`;
const rgb = c => `rgb(${c.map(v => Math.min(255, v * 95)).join(',')})`;
function buildAtlas() {
  atlas.innerHTML = DISTRICTS.map((d, di) => {
    const page = pageOf(d);
    return `<details class="d" data-d="${di}"><summary><span>${esc(nameOf(d))}</span><b>${d.places.length + d.marks.length}</b></summary>
      <p class="sum">${esc(SUMMARY[d.id] ?? '')}${page ? ` <a href="${site()}locations/${page.slug}/" target="_blank">District page →</a>` : ''}</p>
      ${d.places.length ? `<div class="hd">Crew places</div>${d.places.map((p, i) => leaf(p.title, 'p', i, rgb(p.color ?? [1, 1, 1]))).join('')}` : ''}
      ${d.marks.length ? `<div class="hd">Landmarks</div>${d.marks.map((l, i) => leaf(l.name, 'm', i, '#bfefff')).join('')}` : ''}
    </details>`;
  }).join('');
}
// Opening a district closes the others, so one list reads at a time.

atlas.addEventListener('toggle', e => {
  if (!e.target.open) return;
  for (const o of atlas.querySelectorAll('details.d[open]')) if (o !== e.target) o.open = false;
  showDistrict(DISTRICTS[+e.target.dataset.d]);
}, true);
atlas.onclick = e => {
  const b = e.target.closest('.leaf');
  if (!b) return;
  const d = DISTRICTS[+b.closest('.d').dataset.d], i = +b.dataset.i;
  ({ p: () => select(d.places[i]), m: () => openMark(d.marks[i]) })[b.dataset.k]();
};
function openDistrict(d) {
  tab('atlas', true);
  const el = atlas.querySelector(`[data-d="${DISTRICTS.indexOf(d)}"]`);
  if (el.open) showDistrict(d); else el.open = true;
  el.scrollIntoView({ block: 'nearest' });
}

// ---------- tabs: atlas and sessions share the rail ----------

const rail = $('nav');
function tab(name, force) {
  const open = force || (name && rail.dataset.tab !== name);
  rail.dataset.tab = open ? name : '';
  for (const b of rail.querySelectorAll('[data-tab]')) b.classList.toggle('on', open && b.dataset.tab === name);
}
for (const b of rail.querySelectorAll('[data-tab]')) b.onclick = () => tab(b.dataset.tab);

// ---------- session tours ----------

const tourEl = $('tour'), sessions = $('sessions');
let tour = null, route = null;

// A stop is a place card, a map landmark (by its label, slugged like the importer slugs file names) or a district.
// Repeated links to the same stop in a row merge.

const slugOf = t => t.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function stopsOf(recap) {
  const out = [];
  for (const s of recap.stops) {
    if (out.at(-1)?.slug === s.slug) continue;
    const place = bySlug.get(s.slug), mark = !place && LANDMARK_SITES.find(l => slugOf(l.name) === s.slug), d = !place && !mark && districtOfSlug(s.slug);
    if (place) out.push({ ...s, name: place.title, at: V(place.top.x, place.top.z, Math.min(place.top.y, 30)), place });
    else if (mark) out.push({ ...s, name: mark.name, at: V(mark.x, mark.z, Math.min(mark.y, 30)), place: markCard(mark) });
    else if (d) out.push({ ...s, name: nameOf(d), at: V(d.cx, d.cz), d });
  }
  return out;
}
// The audio guide comes first: narrated flights through the city. The newest session's tour follows.

let RECAPS = [];
function buildSessions() {
  RECAPS = [...INDEX.recaps].sort((a, b) => b.session - a.session).slice(0, 1);
  const guide = EPISODES.filter(e => !e.session);
  const audioTours = guide.map(e => `<div class="ses audio"><div class="kicker">Episode ${e.n} · ${Math.round(e.min)} min</div><b>${esc(e.title)}</b>
    <p>${esc(e.route)}</p><div class="listen" data-ep="${EPISODES.indexOf(e)}"></div></div>`).join('');
  const sessionTours = RECAPS.map((r, i) => {
    const n = stopsOf(r).length, k = EPISODES.findIndex(e => e.session === +r.session), e = EPISODES[k];

    // A session with a podcast offers it as a narrated tour above the stop-by-stop one.

    const pod = e ? `<div class="pod"><div class="kicker">${esc(e.show)} · Episode ${e.n} · ${Math.round(e.min)} min</div><div class="listen" data-ep="${k}"></div></div>` : '';
    return `<div class="ses"><div class="kicker">S-${String(r.session).padStart(2, '0')}</div><b>${esc(r.title.replace(/^S-\d+\s*/, '').replace(/ Recap$/, ''))}</b>
      <p>${esc(r.summary)}</p>${pod}<button data-r="${i}" ${n ? '' : 'disabled'}>▶ Play tour · ${n} stop${n === 1 ? '' : 's'}</button></div>`;
  }).join('');
  sessions.innerHTML = `<details class="d" open><summary><span>Audio guide</span><b>${guide.length}</b></summary>${audioTours}</details>`
    + (RECAPS.length ? `<details class="d"><summary><span>Session tours</span><b>${RECAPS.length}</b></summary>${sessionTours}</details>` : '');
  listenButtons();
}

// Like the atlas, opening one section closes the other.

sessions.addEventListener('toggle', e => {
  if (e.target.open) for (const o of sessions.querySelectorAll('details.d[open]')) if (o !== e.target) o.open = false;
}, true);
// A started episode offers to resume where the listener left it, or to start over.

const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function listenButtons() {
  for (const el of sessions.querySelectorAll('.listen')) {
    const i = el.dataset.ep, t = resumeAt(EPISODES[i]);
    el.innerHTML = t ? `<button data-a="${i}" data-resume="1">▶ Resume at ${clock(t)}</button> <button data-a="${i}">↺ From the start</button>`
      : `<button data-a="${i}">▶ ${EPISODES[i].session ? 'Start listening tour' : 'Listen'}</button>`;
  }
}
sessions.onclick = e => {
  const b = e.target.closest('[data-r], [data-a]');
  if (b?.dataset.a) startAudioTour(EPISODES[+b.dataset.a], !!b.dataset.resume);
  else if (b) startTour(RECAPS[+b.dataset.r]);
};

function startTour(recap) {
  const stops = stopsOf(recap);
  if (!stops.length) return;
  stopAudioTour();
  stopRide();
  endTour();
  tour = { recap, stops, i: 0 };
  focus(true);
  if (stops.length > 1) {
    const curve = new THREE.CatmullRomCurve3(stops.map(s => s.at.clone().setY(90)), false, 'centripetal');
    route = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(stops.length * 24)), new THREE.LineBasicMaterial({ color: 0x7ff3ff, fog: false }));
    scene.add(route);
  }
  if (PHONE) tab('');
  drawMinimap();
  showStop();
}
function showStop() {
  const { recap, stops, i } = tour, s = stops[i];
  card.style.display = 'none';
  $('tKick').textContent = `S-${String(recap.session).padStart(2, '0')} · Stop ${i + 1} / ${stops.length}`;
  $('tName').textContent = s.name;
  $('tHead').textContent = s.h;
  $('tText').textContent = s.text || [s.place?.summary ?? ''].flat()[0];
  $('tRecap').href = `${site()}${recap.url}`;
  $('tLoc').href = `${site()}locations/${s.slug}/`;
  $('tPrev').disabled = i === 0;
  $('tNext').textContent = i === stops.length - 1 ? 'Finish' : 'Next →';
  tourEl.hidden = false;

  // Stops with a footprint get the same view as a click on the building.

  if (s.d) showDistrict(s.d); else if (s.place?.frame) viewPlace(s.place); else flyTo(s.at, 220);
}
function step(k) {
  if (!tour) return;
  if (tour.i + k >= tour.stops.length) {
    const top = tour.stops.at(-1).place?.top?.y ?? 0;
    endTour();
    return fireworks(top);
  }
  tour.i = Math.max(0, tour.i + k);
  showStop();
}
// Tours, the audio guide and the maglev ride (ride.js) hide the search rail and the help button. The compass stays.

const focus = on => document.body.classList.toggle('focus', on);
function endTour() {
  focus(false);
  tour = null;
  tourEl.hidden = true;
  if (route) { scene.remove(route); route.geometry.dispose(); route = null; }
  drawMinimap();
}
// ---------- maglev ride: pick a station, then ride the train from there ----------

const ridePick = $('ridePick');
// The picker offers the tours, which together pass every station. The single lines still run on the map.

const RIDES = TOURS;
ridePick.innerHTML = RIDES.map((R, i) => `<details class="d"${i ? '' : ' open'}><summary><span>${esc(R.name)}</span><b>${R.stops.length}</b></summary>
  <div class="stns">${R.stops.map(st => `<button data-r="${i}" data-s="${R.stops.indexOf(st)}">${esc(st.name)}</button>`).join('')}</div></details>`).join('');
ridePick.addEventListener('toggle', e => {
  if (e.target.open) for (const o of ridePick.querySelectorAll('details.d[open]')) if (o !== e.target) o.open = false;
}, true);
ridePick.onclick = e => {
  const b = e.target.closest('[data-s]');
  if (!b) return;
  stopAudioTour(); endTour(); hideCard(); tab('');
  startRide(RIDES[+b.dataset.r].stops[+b.dataset.s]);
};

// Audio tour cues name places, landmarks and districts by their card titles.

initAudioTour({
  find: name => { const l = LANDMARK_SITES.find(x => x.name === name); return l ? markCard(l) : CARDS.find(p => p.title === name) ?? null; },
  district: name => { const d = DISTRICTS.find(d => nameOf(d) === name || d.name === name); return d && { target: V(d.cx, d.cz), dist: Math.min(2600, d.size * .9) }; },
  onStart: () => { stopRide(); endTour(); hideCard(); tab(''); focus(true); },
  onStop: () => { listenButtons(); focus(false); },
});

// The first visit opens a welcome card that offers the audio guide. A deep link to a place skips it,
// and ?new=1 shows it again. Exploring alone opens the help with a pointer to the guide.

const WELCOME_KEY = 'na-map-welcomed', welcome = $('welcome');
const closeWelcome = () => { welcome.hidden = true; try { localStorage.setItem(WELCOME_KEY, '1'); } catch {} };
let welcomed = true;
try { welcomed = !!localStorage.getItem(WELCOME_KEY); } catch {}
const params = new URLSearchParams(location.search);
welcome.hidden = params.get('new') !== '1' && (welcomed || params.has('focus') || params.has('listen'));
$('wTour').onclick = () => { closeWelcome(); startAudioTour(EPISODES[0]); };
$('wSkip').onclick = () => {
  closeWelcome();
  $('helpGuide').hidden = false;
  if ($('helpPanel').hidden) $('help').click();
};
addEventListener('keydown', e => { if (e.key === 'Escape' && !welcome.hidden) closeWelcome(); });
addEventListener('pointerdown', e => { if (e.target.tagName === 'CANVAS' && !welcome.hidden) closeWelcome(); }, true);
$('tPrev').onclick = () => step(-1);
$('tNext').onclick = () => step(1);
$('tExit').onclick = endTour;

// ---------- chips ----------

const chips = $('chips'), off = new Set();
function applyChips() {
  document.body.classList.toggle('nolabels', off.has('labels'));
  for (const pin of pins) {
    const t = typeOf(pin.userData.place), on = !(t && off.has(t));
    pin.visible = on;
    pin.userData.label.classList.toggle('off', !on);
  }
  for (const l of LANDMARK_SITES) l.el?.classList.toggle('off', off.has(LORE.landmarks[l.name]?.category ?? 'civic'));
}
chips.onclick = e => {
  const b = e.target.closest('[data-f]');
  if (!b) return;
  if (off.has(b.dataset.f)) off.delete(b.dataset.f); else off.add(b.dataset.f);
  b.classList.toggle('on', !off.has(b.dataset.f));
  applyChips();
};

// ---------- minimap ----------

const mm = $('minimap'), svg = $('mmSvg');
const all = DISTRICTS.flatMap(d => d.poly), pad = 120;
const X0 = Math.min(...all.map(p => p[0])) - pad, Z0 = Math.min(...all.map(p => p[1])) - pad;
const W = Math.max(...all.map(p => p[0])) + pad - X0, D = Math.max(...all.map(p => p[1])) + pad - Z0;
svg.setAttribute('viewBox', `${X0} ${Z0} ${W} ${D}`);
const pts = poly => poly.map(p => p.join(',')).join(' ');
// The inside point farthest from every edge, found on a 24 × 24 grid. Long thin districts keep their name inside.

const edgeDist = (x, z, poly) => Math.min(...poly.map(([ax, az], i) => {
  const [bx, bz] = poly[(i + 1) % poly.length], dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - ax - t * dx, z - az - t * dz);
}));
function roomiest(poly) {
  const xs = poly.map(p => p[0]), zs = poly.map(p => p[1]), x0 = Math.min(...xs), z0 = Math.min(...zs), sx = (Math.max(...xs) - x0) / 24, sz = (Math.max(...zs) - z0) / 24;
  let best = centroidOf(poly), bd = -1;
  for (let i = 0; i <= 24; i++) for (let j = 0; j <= 24; j++) {
    const x = x0 + i * sx, z = z0 + j * sz;
    if (!insidePoly(x, z, poly)) continue;
    const e = edgeDist(x, z, poly);
    if (e > bd) { bd = e; best = [x, z]; }
  }
  return best;
}
function drawMinimap() {
  svg.innerHTML = (CITY.coast ?? []).map(c => `<polyline class="coast" points="${pts(c)}"/>`).join('')
    + DISTRICTS.map(d => `<polygon class="${d === current ? 'on' : ''}" points="${pts(d.poly)}"><title>${esc(nameOf(d))}</title></polygon>`).join('')
    + DISTRICTS.map(d => { const [x, z] = d.mm ??= roomiest(d.poly); return `<text x="${x}" y="${z}" font-size="${W / 26}">${esc(nameOf(d))}</text>`; }).join('')
    + CARDS.map(p => `<circle cx="${p.top.x}" cy="${p.top.z}" r="${W / 160}" fill="${rgb(p.color ?? [2, 2, 2])}"/>`).join('')
    + (tour ? `<polyline class="route" points="${tour.stops.map(s => `${s.at.x},${s.at.z}`).join(' ')}"/>` : '')
    + '<polygon id="mmCone" class="cone"/>';
  lastCam = '';
}
let lastCam = '';
function cone() {
  requestAnimationFrame(cone);
  if (mm.classList.contains('shut')) return;
  const c = camera.position, t = controls.target, key = `${c.x | 0},${c.z | 0},${t.x | 0},${t.z | 0},${c.y | 0}`;
  if (key === lastCam) return;
  lastCam = key;

  // The cone runs from the camera to the target, as wide as the view there. Close views grow to stay visible.

  const half = c.distanceTo(t) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
  const dx = t.x - c.x, dz = t.z - c.z, L = Math.hypot(dx, dz) || 1, k = Math.max(1, W / 14 / Math.max(L, half));
  const nx = -dz / L * half * k, nz = dx / L * half * k;
  $('mmCone')?.setAttribute('points', `${t.x - dx * k},${t.z - dz * k} ${t.x + nx},${t.z + nz} ${t.x - nx},${t.z - nz}`);
}
function toWorld(e) {
  const m = svg.getScreenCTM().inverse(), p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
  return V(p.x, p.y);
}
let dragging = false;

// A drag on the minimap leaves the open card's subject, so the card closes without the flight back.

svg.onpointerdown = e => { dragging = true; if (card.style.display === 'block') hideCard(); svg.setPointerCapture(e.pointerId); flyTo(toWorld(e), camera.position.distanceTo(controls.target)); };
svg.onpointermove = e => { if (dragging) flyTo(toWorld(e), camera.position.distanceTo(controls.target)); };
svg.onpointerup = svg.onpointercancel = () => { dragging = false; };
$('mmToggle').onclick = () => { mm.classList.toggle('shut'); lastCam = ''; };

// ---------- keys ----------

addEventListener('keydown', e => {
  const typing = e.target.matches?.('input, textarea');
  if ((e.key === '/' && !typing) || (e.key === 'k' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); q.focus(); q.select(); return; }
  if (typing) return;
  if (e.key === 'Escape' && !tour && card.style.display === 'block') { $('close').click(); return; }
  if (!tour) return;
  if (e.key === 'Escape') endTour();
  if (e.key === 'ArrowRight') step(1);
  if (e.key === 'ArrowLeft') step(-1);
});

// ---------- start ----------

let SUMMARY = {};

export async function initNav() {
  // The map opens clear. Search stays up; filters, atlas, minimap and the info panel open on demand.

  $('hud').open = false;
  mm.classList.add('shut');

  // Landmark and district labels open their cards on a tap.

  for (const l of LANDMARK_SITES) if (l.el) { l.el.classList.add('link'); Object.defineProperty(l.el, 'place', { get: () => markCard(l) }); }
  for (const d of DISTRICTS) {
    const el = DISTRICT_LABELS.get(d.id);
    if (el) { el.classList.add('link'); Object.defineProperty(el, 'place', { get: () => districtCard(d) }); }
  }
  drawMinimap();
  cone();
  applyChips();
  buildRows();
  const get = url => fetch(url).then(r => r.ok ? r.json() : null).catch(() => null);
  const [index, summary, districts, landmarks] = await Promise.all([STANDALONE ? null : get(LOCAL ? '/public/map-index.json' : '../map-index.json'),
    get('districts.json'), get('content/districts.json'), get('content/landmarks.json')]);
  for (const more of await Promise.all(FIND_FAMILIES.map(f => get(`content/${f}.json`)))) Object.assign(landmarks ?? {}, more);
  SUMMARY = summary ?? {};
  LORE = { districts: districts ?? {}, landmarks: landmarks ?? {} };
  const stalkLore = LORE.landmarks['The Beanstalk'];
  if (stalkLore) Object.assign(STALK_PLACE, { type: stalkLore.kicker, summary: stalkLore.text });
  applyChips();

  // The site index fills place cards and adds the session tours. The audio guide shows with or without it.

  if (index) {
    INDEX = index;
    for (const p of CARDS) {
      const loc = locOf(p.slug);
      if (loc && !p.summary) Object.assign(p, { summary: loc.summary, type: loc.type ?? p.type, district: loc.district ?? '' });
    }
  }
  buildSessions();
  rail.querySelector('[data-tab=sessions]').hidden = false;
  buildRows();
  buildAtlas();
}
