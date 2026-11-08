// The guided tour. Five coach marks show a first-time visitor how to move and where the rides, tours and
// settings live. The welcome card's "Show me around" starts it, and a link in the help panel replays it.
//
// The two movement steps move on when the camera moves. The first one also learns the device, so the second
// names the right gestures. A step whose button is hidden drops out. Escape or "Skip tour" ends the tour.

import { camera, controls, padLike } from './render.js';

const coarse = matchMedia('(pointer: coarse)').matches;
let device = coarse ? 'touch' : 'mouse';
let toursText = () => 'Tours has the audio guide.';

// Each movement step compares the camera with where it stood when the step began.

let from = null;
const look = () => ({ t: controls.target.clone(), d: camera.position.distanceTo(controls.target), a: controls.getAzimuthalAngle(), p: controls.getPolarAngle() });
const moved = () => controls.target.distanceTo(from.t) > from.d * .12;
const zoomedOrTurned = () => {
  const now = look();
  return Math.abs(Math.log(now.d / from.d)) > .15 || Math.abs(now.a - from.a) > .3 || Math.abs(now.p - from.p) > .15;
};

const STEPS = [
  { text: () => coarse ? 'Drag to move.' : 'Drag to move. On a trackpad, slide two fingers.', done: moved },
  { text: () => ({ mouse: 'Scroll to zoom, right-click-drag to turn.', pad: 'Pinch to zoom, ⌥ and two fingers to turn.', touch: 'Pinch to zoom, twist to turn.' })[device], done: zoomedOrTurned },
  { at: '[data-tab=ride]', text: () => 'Maglev takes you on a train ride along any line.' },
  { at: '[data-tab=sessions]', text: () => toursText() },
  { at: '#gfx', text: () => 'Set the graphics for your machine here.' },
];

const spot = Object.assign(document.createElement('div'), { id: 'obSpot' });
const box = Object.assign(document.createElement('div'), { id: 'obBox', className: 'panel' });
box.setAttribute('role', 'dialog');
box.innerHTML = '<span class="step"></span><p></p><div class="row"><button class="on" data-next></button><button data-skip>Skip tour</button></div>';
spot.hidden = box.hidden = true;
document.body.append(spot, box);

let steps = [], i = -1, raf = 0;
const shown = s => !s.at || !!document.querySelector(s.at)?.getClientRects().length;

function show() {
  const s = steps[i], last = i === steps.length - 1;
  box.querySelector('.step').textContent = `${i + 1} of ${steps.length}`;
  box.querySelector('p').textContent = s.text();
  box.querySelector('[data-next]').textContent = last ? 'Done' : 'Next';
  box.querySelector('[data-skip]').hidden = last;
  from = look();
  place();
}

// A button step rings its button and sets the box below it. A map step dims the map lightly and sets the box
// low in the middle, clear of the city's centre.

function place() {
  const el = steps[i].at && document.querySelector(steps[i].at);
  spot.classList.toggle('map', !el);
  box.classList.toggle('at', !!el);
  box.style.left = box.style.top = '';
  if (!el) { spot.style.cssText = ''; return; }
  const r = el.getBoundingClientRect(), pad = 4;
  Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
  const w = box.offsetWidth;
  box.style.left = `${Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2))}px`;
  box.style.top = `${r.bottom + 14}px`;
}

function tick() {
  raf = requestAnimationFrame(tick);
  if (steps[i]?.done?.()) next();
}

function next() {
  if (++i >= steps.length) return endOnboard();
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

box.querySelector('[data-next]').onclick = next;
box.querySelector('[data-skip]').onclick = endOnboard;
addEventListener('keydown', e => { if (e.key === 'Escape' && i >= 0) endOnboard(); });
addEventListener('resize', () => { if (i >= 0) place(); });

// The first step learns the device from the gesture that moves the map. A trackpad slide arrives as a wheel event.

addEventListener('wheel', e => { if (i === 0 && !coarse) device = padLike(e) ? 'pad' : 'mouse'; }, { capture: true, passive: true });
addEventListener('pointerdown', e => { if (i === 0 && e.pointerType === 'touch') device = 'touch'; }, true);

// The help panel gets a link that replays the tour.

const replay = Object.assign(document.createElement('button'), { id: 'obReplay', textContent: 'Replay the tour' });
replay.onclick = () => { document.getElementById('helpClose')?.click(); startOnboard(); };
document.getElementById('back')?.before(replay);

export const initOnboard = opts => { toursText = opts.toursText; };
