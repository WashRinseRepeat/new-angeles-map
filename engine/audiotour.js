// Narrated audio tours. An episode is an MP3 plus the cue file podcast/render.py writes next to it: every spoken
// line for the subtitles, and every camera cue. The audio clock drives the camera, so pause, seek and playback
// speed keep both in step.

import * as THREE from 'three';
import { CENTRE_API } from './api.js';
import { CENTRE, STANDALONE } from './core.js';
import { SETTING } from './setting.js';
import { camera, controls } from './render.js';
import { LOCAL, flying, flyTo, hideCard, tourFade, viewPlace } from './ui.js';
import { fireworks } from './fireworks.js';
import { clearStoryFx, storyFx, updateStoryFx } from './storyfx.js';

// Episodes come from the setting pack. Session podcasts belong to the archive site, so the public copy keeps
// only the guide.

export const EPISODES = SETTING.audio.episodes.filter(e => !STANDALONE || !e.session);
// ui.js imports this module through nav.js, so its exports are read on use, not at load.

const src = e => `${STANDALONE ? 'audio/' : LOCAL ? '/static/podcasts/' : '../podcasts/'}${e.path ?? `tour/${e.id}`}-en`;

// Speeds match the archive's podcast player, and both share one saved choice.

const SPEEDS = [.8, 1, 1.25, 1.5, 1.75, 2], SPEED_KEY = 'podcast-speed';
const UP = new THREE.Vector3(0, 1, 0), DRIFT = .03;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// The start view of the map frames the whole city.

const WIDE_T = V(...SETTING.camera.target), WIDE_C = V(...SETTING.camera.position);
const WIDE_DIR = WIDE_C.clone().sub(WIDE_T).normalize(), WIDE_D = WIDE_C.distanceTo(WIDE_T);

const $ = id => document.getElementById(id);
const bar = $('atour'), sub = $('atSub'), seek = $('atSeek'), speedBtn = $('atSpeed'), cc = $('atCC'), followBtn = $('atFollow');
const audio = new Audio();
audio.preload = 'auto';

let rate = 1, hooks = null, ep = null, cams = [], fxs = [], lines = [], fired = -1, quick = false, follow = true, drift = true, spin = 1, anim = null, raf = 0, last = 0, savedAt = 0, label = '', heard = 0, cut = false;
// nav.js calls this while it still loads, so the restore waits until every module is ready.

export const initAudioTour = h => { hooks = h; setTimeout(restore); };

// A phone may unload the page while the browser is in the background. The episode that was playing comes back
// paused at the saved spot, unless the listener closed it or a link points somewhere else. ?listen=<id> opens
// that episode paused.

const ACTIVE = `${SETTING.storage}-tour-active`;
const setActive = id => { try { id ? localStorage.setItem(ACTIVE, id) : localStorage.removeItem(ACTIVE); } catch {} };
function restore() {
  const q = new URLSearchParams(location.search), asked = EPISODES.find(x => x.id === q.get('listen'));
  if (asked) return startAudioTour(asked, true, false);
  let id = null;
  try { id = localStorage.getItem(ACTIVE); } catch {}
  const e = EPISODES.find(x => x.id === id);
  if (e && resumeAt(e) && !q.has('focus')) startAudioTour(e, true, false);
}

// A cue reads `verb "Name" t=6 az=40`: a verb, an optional place name and numeric options. t is the length in audio seconds.

const parse = c => {
  const o = Object.fromEntries([...c.cue.matchAll(/(\w+)=(-?[\d.]+)/g)].map(m => [m[1], +m[2]]));
  return { ...o, t: c.t, verb: c.cue.split(/\s+/)[0], name: c.cue.match(/"([^"]+)"/)?.[1], dur: o.t ?? 3 };
};
// Moves play on the audio clock, so seeking and speed changes land on the right frame. pose(e, C, T) sets the
// camera C and its target T for progress e. The first `blend` seconds ease in from wherever the camera was.
// The setting pack adds its own moves and the player's label for each of them.

const mix = (a, b, e) => a + (b - a) * e;
const ease = e => e < .5 ? 2 * e * e : 1 - (-2 * e + 2) ** 2 / 2;
const smooth = (a, b, x) => { const k = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const LABELS = SETTING.audio.labels ?? {};

const MOVES = {

  // Circles a map point (x, z) at height y like an orbit, for shots wider than any one place: the whole city,
  // a landmark against the hills. It defaults to the city's centre. el2 and r2 tilt and pull in or out on the way.
  // A quoted name is only the player's label.

  sky: c => {
    const O = V(c.x ?? WIDE_T.x, c.y ?? 0, c.z ?? WIDE_T.z), r0 = c.r ?? 3000;
    return { blend: c.blend ?? 3, pose(e, C, T) {
      const k = ease(e), a = ((c.az ?? 0) + (c.turn ?? 30) * k) * Math.PI / 180, el = mix(c.el ?? .6, c.el2 ?? c.el ?? .6, k);
      C.copy(V(Math.cos(a), el, Math.sin(a)).normalize().multiplyScalar(mix(r0, c.r2 ?? r0, k)).add(O));
      T.copy(O);
    } };
  },

  // Circles a place from compass angle az through turn degrees, tilting from el to el2, at distance r.
  // el is the height of the view direction, as in a view cue, so 2 looks steeply down and .15 looks up.

  orbit: c => {
    const p = hooks.find(c.name);
    if (!p) return null;
    const h = p.top.y, O = V(p.frame?.cx ?? p.top.x, h * .35, p.frame?.cz ?? p.top.z), r = c.r ?? THREE.MathUtils.clamp(h * 2.2, 220, 1400);
    return { blend: c.blend ?? 3, pose(e, C, T) {
      const k = ease(e), a = (c.az ?? 0) + (c.turn ?? 40) * k, el = mix(c.el ?? .5, c.el2 ?? c.el ?? .5, k);
      C.copy(V(Math.cos(a * Math.PI / 180), el, Math.sin(a * Math.PI / 180)).normalize().multiplyScalar(r).add(O));
      T.copy(O);
    } };
  },

  // Holds the camera where an orbit would start and turns the view: turn degrees sideways (positive to the right),
  // tilt degrees up (negative looks down). It starts looking at the place.

  pan: c => {
    const p = hooks.find(c.name);
    if (!p) return null;
    const h = p.top.y, O = V(p.frame?.cx ?? p.top.x, h * .35, p.frame?.cz ?? p.top.z), r = c.r ?? THREE.MathUtils.clamp(h * 2.2, 220, 1400);
    const a = (c.az ?? 0) * Math.PI / 180, C0 = V(Math.cos(a), c.el ?? .5, Math.sin(a)).normalize().multiplyScalar(r).add(O);
    const look = O.clone().sub(C0), yaw0 = Math.atan2(look.z, look.x), pitch0 = Math.atan2(look.y, Math.hypot(look.x, look.z));
    return { blend: c.blend ?? 3, pose(e, C, T) {
      const k = ease(e), yaw = yaw0 + (c.turn ?? 0) * k * Math.PI / 180, pitch = pitch0 + (c.tilt ?? 0) * k * Math.PI / 180;
      C.copy(C0);
      T.set(Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch)).multiplyScalar(r).add(C0);
    } };
  },

  // Slides the camera without turning it, past the spot where an orbit would start: side metres to the right
  // (negative left), push metres forward (negative back) and rise metres up. The place is centred halfway through.

  dolly: c => {
    const p = hooks.find(c.name);
    if (!p) return null;
    const h = p.top.y, O = V(p.frame?.cx ?? p.top.x, h * .35, p.frame?.cz ?? p.top.z), r = c.r ?? THREE.MathUtils.clamp(h * 2.2, 220, 1400);
    const a = (c.az ?? 0) * Math.PI / 180, C0 = V(Math.cos(a), c.el ?? .5, Math.sin(a)).normalize().multiplyScalar(r).add(O);
    const fwd = O.clone().sub(C0).setY(0).normalize(), right = V(-fwd.z, 0, fwd.x);
    const move = fwd.multiplyScalar(c.push ?? 0).add(right.multiplyScalar(c.side ?? 0)).add(V(0, c.rise ?? 0, 0));
    return { blend: c.blend ?? 3, pose(e, C, T) {
      const k = ease(e);
      C.copy(C0).addScaledVector(move, k - .5);
      T.copy(O).addScaledVector(move, k - .5);
    } };
  },

  // Spirals up a tower, looking in at it, and ends above its crown looking out over the skyline.

  spiral: c => {
    const p = hooks.find(c.name);
    if (!p) return null;
    const h = p.top.y, cx = p.frame?.cx ?? p.top.x, cz = p.frame?.cz ?? p.top.z, r = c.r ?? 160;
    return { blend: 3, pose(e, C, T) {
      const k = ease(e), a = ((c.az ?? 0) + (c.turns ?? 1) * 360 * k) * Math.PI / 180, y = mix(h * .25, h + 90, k);
      C.set(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r);
      T.set(cx, mix(y - 10, h * .6, smooth(.75, 1, e)), cz).lerp(V(cx - Math.cos(a) * r * 4, h * .4, cz - Math.sin(a) * r * 4), smooth(.8, 1, e));
    } };
  },
};

// The pack's moves read the centre landmark's api on use, because api.js fills it while it loads.

Object.assign(MOVES, SETTING.audio.moves?.({ V, mix, ease, smooth, CENTRE, WIDE_T, camera, find: name => hooks.find(name),
  get landmark() { return CENTRE_API; } }));

// Moves may tilt past the map's angle limit and fly far out, so the limits relax while one plays.

const LIMITS = { maxPolarAngle: controls.maxPolarAngle, maxDistance: controls.maxDistance };
const FREE = { maxPolarAngle: Math.PI * .8, maxDistance: SETTING.camera.tourDistance };
const _C = V(0, 0, 0), _T = V(0, 0, 0), _P = { y: null };

function apply(c) {
  const dur = quick ? .8 : c.dur / audio.playbackRate;
  anim = null; drift = true;
  CENTRE_API.pod?.(null);
  spin = c.spin ?? (cams.indexOf(c) % 2 ? -1 : 1);
  const move = MOVES[c.verb]?.(c);
  if (move) {
    anim = { ...move, t0: c.t, dur: c.dur, fromC: camera.position.clone(), fromT: controls.target.clone() };
    if (quick) anim.blend = Math.min(anim.blend, .6);
    drift = false;
  }
  else if (c.verb === 'view') {
    const p = hooks.find(c.name);
    if (p) viewPlace(p, dur, c.az == null ? null : V(Math.cos(c.az * Math.PI / 180), c.el ?? .5, Math.sin(c.az * Math.PI / 180)));
  }
  else if (c.verb === 'district') { const d = hooks.district(c.name); if (d) flyTo(d.target, d.dist, null, dur); }
  else if (c.verb === 'wide') flyTo(WIDE_T, WIDE_D, WIDE_DIR.clone(), dur);
  label = c.name ?? LABELS[c.verb] ?? label;
  quick = false;

  // A move the pack marks as a centre gaze thins out what stands in front of the centre. A place shot does so
  // only with fade=1, because a moving camera drags the thinned window across the buildings in front.

  const p = c.fade && hooks.find(c.name);
  tourFade(SETTING.audio.centreGaze?.includes(c.verb) ? (c.fade === 0 ? null : 'centre') : p?.top ? p : null);
}

// Plays the current move at audio time t. The pod keeps climbing while the listener holds the camera.

function play(t) {
  const since = t - anim.t0, e = THREE.MathUtils.clamp(since / anim.dur, 0, 1);
  _P.y = null;
  anim.pose(e, _C, _T, _P);
  if (anim.pod) CENTRE_API.pod?.(_P.y);
  if (!follow) return;
  const w = anim.blend ? smooth(0, anim.blend, since) : 1;
  camera.position.lerpVectors(anim.fromC, _C, w);
  controls.target.lerpVectors(anim.fromT, _T, w);
}

// An effect cue reads `fx verb "Place" lx=0 lz=-6 y=3 wait=2`. lx and lz are metres in the place's own frame,
// so +lz points out of a landmark's front. wait starts it that many seconds into the line that follows.

function fxAt(c) {
  const p = hooks.find(c.name);
  if (!p) return;
  const f = p.frame ?? {}, x0 = f.cx ?? p.top.x, z0 = f.cz ?? p.top.z, cs = f.c ?? 1, sn = f.s ?? 0, lx = c.lx ?? 0, lz = c.lz ?? 0;
  storyFx(c.verb, V(x0 + lx * cs + lz * sn, c.y ?? 2, z0 - lx * sn + lz * cs), { ...c, t: c.own ? c.dur : undefined });
}

const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function tick(now) {
  raf = requestAnimationFrame(tick);
  const dt = Math.min(.1, (now - last) / 1000), t = audio.currentTime;
  last = now;

  // The newest cue at or before the playhead owns the camera.

  const i = cams.findLastIndex(c => c.t <= t + .05);
  if (i !== fired) { fired = i; if (i >= 0) follow ? apply(cams[i]) : flash(); }

  // Effects start when the playhead runs over their cue and age on the audio clock. A jump clears them.

  if (cut) { cut = false; clearStoryFx(); }
  else if (t > heard) {
    for (const c of fxs) if (c.t > heard && c.t <= t) fxAt(c);
    updateStoryFx(Math.min(t - heard, .1));
  }
  heard = t;
  Object.assign(controls, follow && (anim || flying()) ? FREE : LIMITS);
  if (anim) play(t);
  else if (follow && drift && !audio.paused && !flying()) {
    camera.position.sub(controls.target).applyAxisAngle(UP, DRIFT * spin * dt * audio.playbackRate).add(controls.target);
  }

  const line = lines.findLast(l => l.t <= t);
  const showSub = cc.getAttribute('aria-pressed') === 'true' && line && t < line.t + line.d + .4;
  sub.hidden = !showSub;
  if (showSub && sub.textContent !== line.text) sub.textContent = line.text;
  $('atStop').textContent = label;
  $('atTime').textContent = `${clock(t)} / ${clock(audio.duration || ep.min * 60)}`;
  if (document.activeElement !== seek) seek.value = t;
  $('atPlay').textContent = audio.ended ? '↺' : audio.paused ? '▶' : '❚❚';
  if (now - savedAt > 5000) { savedAt = now; save(); }
}

const KEY = () => `${SETTING.storage}-tour-${ep.id}`;
function save() { try { localStorage.setItem(KEY(), audio.ended ? '0' : String(audio.currentTime)); } catch {} }

// Where a listener left an episode, in seconds, or 0 when it is not worth resuming.

export function resumeAt(e) {
  let t = 0;
  try { t = +localStorage.getItem(`${SETTING.storage}-tour-${e.id}`) || 0; } catch {}
  return t > 10 && t < e.min * 60 - 15 ? t : 0;
}
// Some phones load nothing until play, so the jump waits for the file's length to be known.

function jump(t) {
  const go = () => { quick = true; fired = -2; cut = true; audio.currentTime = Math.max(0, t); };
  audio.readyState ? go() : audio.addEventListener('loadedmetadata', go, { once: true });
}

export async function startAudioTour(e, resume = false, autoplay = true) {
  stopAudioTour();
  hooks.onStart();
  ep = e;
  setActive(e.id);

  // ?v=2 skips copies that browsers cached before the tour files sent no-cache.

  audio.src = `${src(e)}.mp3?v=2`;
  audio.defaultPlaybackRate = audio.playbackRate = rate;
  if (autoplay) audio.play().catch(() => {});
  $('atKick').textContent = `${e.show ?? 'Audio guide'} · Episode ${e.n}`;
  $('atTitle').textContent = e.title;
  bar.hidden = false;
  follow = true; followBtn.hidden = true; label = ''; fired = -1; heard = 0;
  const data = await fetch(`${src(e)}.cues.json?v=2`, { cache: 'no-cache' }).then(r => r.json());
  cams = data.cams.map(parse);
  fxs = (data.fx ?? []).map(c => { const f = parse(c); return { ...f, t: f.t + (f.wait ?? 0), own: /\bt=/.test(c.cue) }; });
  lines = data.lines;
  seek.max = data.lines.at(-1).t + data.lines.at(-1).d + 1;
  $('atTicks').innerHTML = cams.map(c => `<i style="left:${c.t / seek.max * 100}%"></i>`).join('');
  if (resume && resumeAt(e)) jump(resumeAt(e));
  last = performance.now();
  raf = requestAnimationFrame(tick);
}
export function stopAudioTour() {
  if (!ep) return;
  save();
  audio.pause();
  cancelAnimationFrame(raf);
  bar.hidden = sub.hidden = true;
  ep = null; anim = null;
  clearStoryFx();
  setActive(null);
  tourFade(null);
  CENTRE_API.pod?.(null);
  Object.assign(controls, LIMITS);
  hooks.onStop?.();
}

// Touching the map hands the camera to the listener. The audio keeps playing until they follow again.

const detach = () => { if (ep && follow) { follow = false; followBtn.hidden = false; tourFade(null); } };
addEventListener('pointerdown', e => { if (e.target.tagName === 'CANVAS') detach(); }, true);
addEventListener('wheel', e => { if (e.target.tagName === 'CANVAS') detach(); }, { capture: true, passive: true });

// A new segment while the listener roams flashes the button that brings the tour back.

function flash() { followBtn.classList.remove('flash'); void followBtn.offsetWidth; followBtn.classList.add('flash'); }
followBtn.onclick = () => { hideCard(); follow = true; followBtn.hidden = true; quick = true; fired = -2; };

audio.addEventListener('ended', () => { save(); setActive(null); hooks.onStop?.(); fireworks(hooks.find(label)?.top?.y ?? Math.max(0, controls.target.y)); });
audio.addEventListener('pause', () => { if (ep) save(); });
$('atPlay').onclick = () => { if (audio.ended) jump(0); audio.paused ? audio.play() : audio.pause(); };
$('atClose').onclick = stopAudioTour;
$('atBack').onclick = () => jump(audio.currentTime - 15);
$('atFwd').onclick = () => jump(Math.min(audio.currentTime + 15, (audio.duration || 1e9) - .5));
seek.oninput = () => jump(+seek.value);

// Subtitles start off. The choice is remembered.

const CC_KEY = `${SETTING.storage}-tour-cc`;
const setCC = on => { cc.setAttribute('aria-pressed', on); try { localStorage.setItem(CC_KEY, on ? '1' : '0'); } catch {} };
try { cc.setAttribute('aria-pressed', localStorage.getItem(CC_KEY) === '1'); } catch {}
cc.onclick = () => setCC(cc.getAttribute('aria-pressed') !== 'true');
addEventListener('keydown', e => {
  if (!ep || e.key !== ' ' || e.target.matches?.('input, textarea, select, button')) return;
  e.preventDefault();
  $('atPlay').click();
});

// The speed button steps through the podcast player's speeds. The camera reads the rate on every move.

try { const v = +localStorage.getItem(SPEED_KEY); if (SPEEDS.includes(v)) rate = v; } catch {}
const showSpeed = () => { speedBtn.textContent = `${rate}×`; };
showSpeed();
speedBtn.onclick = () => {
  rate = SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length];
  audio.defaultPlaybackRate = audio.playbackRate = rate;
  showSpeed();
  try { localStorage.setItem(SPEED_KEY, String(rate)); } catch {}
};
