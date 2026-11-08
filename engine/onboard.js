// The guided tour. Coach marks show a first-time visitor how to move and where search, tours, rides, settings
// and help live. The welcome card's "Show me around" starts it, and a link in the help panel replays it.
//
// The two movement steps move on when the camera moves. The first one also learns the device from the gesture,
// so the second names the right gestures. A visitor who clicks through without trying gets every gesture in a
// list. A step whose buttons are all hidden drops out. Escape or "Skip tour" ends the tour.

import { camera, controls, padLike } from './render.js';

const coarse = matchMedia('(pointer: coarse)').matches;
let device = null;
let toursText = () => 'Tours has informative audio guides that show new arrivals around the city.';

// Each movement step compares the camera with where it stood when the step began.

let from = null;
const look = () => ({ t: controls.target.clone(), d: camera.position.distanceTo(controls.target), a: controls.getAzimuthalAngle(), p: controls.getPolarAngle() });
const moved = () => controls.target.distanceTo(from.t) > from.d * .12;
const zoomedOrTurned = () => {
  const now = look();
  return Math.abs(Math.log(now.d / from.d)) > .15 || Math.abs(now.a - from.a) > .3 || Math.abs(now.p - from.p) > .15;
};

const GESTURES = {
  mouse: 'Scroll to zoom, right-click-drag to turn.',
  pad: 'Pinch to zoom, ⌥ and two fingers to turn.',
  touch: 'Pinch to zoom, twist to turn.',
  all: '<dl><dt>Mouse</dt><dd>Drag to move, scroll to zoom, right-click-drag to turn.</dd>'
    + '<dt>Trackpad</dt><dd>Slide two fingers to move, pinch to zoom, ⌥ and two fingers to turn.</dd></dl>',
};
const QI = '<span class="qi" aria-hidden="true">?</span>';

const STEPS = [
  { text: () => coarse ? 'Drag to move.' : 'Drag to move. On a trackpad, slide two fingers.', done: moved },
  { text: () => GESTURES[coarse ? 'touch' : device ?? 'all'], done: zoomedOrTurned },
  { at: ['.qwrap', '[data-tab=filters]', '[data-tab=atlas]'], text: () => 'Search, browse or filter for landmarks.' },
  { at: ['[data-tab=sessions]'], text: () => toursText() },
  { at: ['[data-tab=ride]'], text: () => 'Maglev takes you on a relaxing train ride along any line.' },
  { at: ['#gfx', '#help'], text: () => `The sliders set the graphics for your machine. ${QI} explains the controls and replays this tour.` },
];

const spot = Object.assign(document.createElement('div'), { id: 'obSpot' });
const box = Object.assign(document.createElement('div'), { id: 'obBox', className: 'panel' });
box.setAttribute('role', 'dialog');
box.innerHTML = '<span class="step"></span><div class="text"></div>'
  + '<div class="row"><button data-back>Back</button><button class="on" data-next></button><button data-skip>Skip tour</button></div>';
spot.hidden = box.hidden = true;
document.body.append(spot, box);

let steps = [], i = -1, raf = 0;
const targets = s => (s.at ?? []).map(q => document.querySelector(q)).filter(el => el?.getClientRects().length);
const shown = s => !s.at || targets(s).length > 0;

function show() {
  const last = i === steps.length - 1;
  box.querySelector('.step').textContent = `${i + 1} of ${steps.length}`;
  box.querySelector('.text').innerHTML = steps[i].text();
  box.querySelector('[data-back]').hidden = i === 0;
  box.querySelector('[data-next]').textContent = last ? 'Done' : 'Next';
  box.querySelector('[data-skip]').hidden = last;
  from = look();
  place();
}

// A button step rings its buttons and sets the box below them. A map step dims the map lightly and sets the box
// low in the middle, clear of the city's centre.

function place() {
  const els = targets(steps[i]);
  spot.classList.toggle('map', !els.length);
  box.classList.toggle('at', !!els.length);
  box.style.left = box.style.top = '';
  if (!els.length) { spot.style.cssText = ''; return; }
  const rs = els.map(el => el.getBoundingClientRect()), pad = 4;
  const l = Math.min(...rs.map(r => r.left)), t = Math.min(...rs.map(r => r.top));
  const r = Math.max(...rs.map(r => r.right)), b = Math.max(...rs.map(r => r.bottom));
  Object.assign(spot.style, { left: `${l - pad}px`, top: `${t - pad}px`, width: `${r - l + pad * 2}px`, height: `${b - t + pad * 2}px` });
  const w = box.offsetWidth;
  box.style.left = `${Math.max(12, Math.min(innerWidth - w - 12, (l + r) / 2 - w / 2))}px`;
  box.style.top = `${b + 14}px`;
}

function tick() {
  raf = requestAnimationFrame(tick);
  if (steps[i]?.done?.()) go(1);
}

function go(k) {
  i = Math.max(0, i + k);
  if (i >= steps.length) return endOnboard();
  show();
}

export function endOnboard() {
  cancelAnimationFrame(raf);
  i = -1;
  spot.hidden = box.hidden = true;
}

export function startOnboard() {
  steps = STEPS.filter(shown);
  i = 0;
  spot.hidden = box.hidden = false;
  show();
  cancelAnimationFrame(raf);
  tick();
}

box.querySelector('[data-back]').onclick = () => go(-1);
box.querySelector('[data-next]').onclick = () => go(1);
box.querySelector('[data-skip]').onclick = endOnboard;
addEventListener('keydown', e => { if (e.key === 'Escape' && i >= 0) endOnboard(); });
addEventListener('resize', () => { if (i >= 0) place(); });

// The first step learns the device from the gesture on the map. A trackpad slide arrives as a wheel event.

addEventListener('wheel', e => { if (i === 0 && e.target.tagName === 'CANVAS') device = padLike(e) ? 'pad' : 'mouse'; }, { capture: true, passive: true });
addEventListener('pointerdown', e => { if (i === 0 && e.target.tagName === 'CANVAS' && e.pointerType === 'mouse') device = 'mouse'; }, true);

// The help panel gets a link that replays the tour.

const replay = Object.assign(document.createElement('button'), { id: 'obReplay', textContent: 'Replay the tour' });
replay.onclick = () => { document.getElementById('helpClose')?.click(); startOnboard(); };
document.getElementById('back')?.before(replay);

export const initOnboard = opts => { toursText = opts.toursText; };
