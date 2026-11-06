// Ride sound: a hum that follows the train's speed, a whoosh when a train passes on the partner guideway,
// and one announcement on arrival at the Beanstalk. ride.js calls rideSound once per frame while riding.

import { STANDALONE } from './core.js';

export const RIDE_AUDIO = STANDALONE ? 'audio/ride/' : location.pathname.includes('/spikes/') ? '/static/podcasts/ride/' : '../podcasts/ride/';

// VMAX is the trains' top speed in ride.js.

const ANNOUNCE = { 'The Beanstalk': 'beanstalk-announce.mp3' }, VMAX = 41.6;

// SOUND holds the current target gains, the last announcement and whether it plays, so the checks can read them.

export const SOUND = { hum: 0, whoosh: 0, announced: null, speaking: false };

// Clips decode once per page. The ride's nodes build on its first frame and stop when it ends.

const clips = new Map();
const clip = (actx, file) => {
  if (!clips.has(file)) clips.set(file, fetch(RIDE_AUDIO + file).then(r => r.arrayBuffer()).then(b => actx.decodeAudioData(b)).then(b => clips.set(file, b)).catch(() => null));
  const c = clips.get(file);
  return c instanceof AudioBuffer ? c : null;
};

let nodes = null;
function build(actx, out) {
  for (const file of Object.values(ANNOUNCE)) clip(actx, file);
  const noise = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate), d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = actx.createBufferSource();
  src.buffer = noise; src.loop = true;
  const hum = actx.createGain(), whoosh = actx.createGain(), low = actx.createBiquadFilter(), band = actx.createBiquadFilter();
  hum.gain.value = whoosh.gain.value = 0;
  low.type = 'lowpass'; band.type = 'bandpass'; band.frequency.value = 900; band.Q.value = .8;
  const osc = [-7, 7].map(cents => {
    const o = actx.createOscillator();
    o.type = 'sawtooth'; o.detune.value = cents;
    o.connect(hum);
    o.start();
    return o;
  });
  src.connect(low).connect(hum);
  src.connect(band).connect(whoosh);
  src.start();
  hum.connect(out); whoosh.connect(out);
  nodes = { out, hum, whoosh, low, osc, src, voice: null };
}

function hush() {
  if (!nodes?.voice) return;
  nodes.voice.onended = null;
  nodes.voice.stop();
  nodes.voice = null;
  SOUND.speaking = false;
}

// The hum's pitch, filter and gain rise with speed. The whoosh grows as a train closes in under 40 m, but
// only while the rider's train moves, so two trains standing side by side stay quiet. Muting stops the
// announcement, and unmuting does not restart it.

export function rideSound({ actx, out, speed, passing, arrive, muted }) {
  if (!nodes) build(actx, out);
  const v = Math.min(1, speed / VMAX), near = Math.max(0, 1 - passing / 40), t = actx.currentTime;
  SOUND.hum = muted ? 0 : .02 + .16 * v;
  SOUND.whoosh = muted ? 0 : .6 * near * near * Math.min(1, speed / 15);
  nodes.hum.gain.setTargetAtTime(SOUND.hum, t, .15);
  nodes.whoosh.gain.setTargetAtTime(SOUND.whoosh, t, .08);
  for (const o of nodes.osc) o.frequency.setTargetAtTime(38 + 50 * v, t, .2);
  nodes.low.frequency.setTargetAtTime(180 + 700 * v, t, .2);
  if (muted) hush();
  if (arrive && ANNOUNCE[arrive]) {
    SOUND.announced = arrive;
    const buf = clip(actx, ANNOUNCE[arrive]);
    if (!muted && buf) {
      hush();
      const src = actx.createBufferSource();
      src.buffer = buf;
      src.connect(nodes.out);
      src.onended = () => { if (nodes?.voice === src) { nodes.voice = null; SOUND.speaking = false; } };
      src.start();
      nodes.voice = src;
      SOUND.speaking = true;
    }
  }
}

// Leaving the train stops every sound and frees the nodes. The next ride builds new ones.

export function stopSound() {
  if (!nodes) return;
  hush();
  for (const n of [...nodes.osc, nodes.src]) n.stop();
  for (const n of [nodes.hum, nodes.whoosh]) n.disconnect();
  nodes = null;
  SOUND.hum = SOUND.whoosh = 0;
}
