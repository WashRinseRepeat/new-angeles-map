// Shape rules for places.json, shared by the dev server (POST /api/places) and the network check.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAP = fileURLToPath(new URL('..', import.meta.url));

// places.json belongs to the pack that index.html names, the same pack the engine loads place modules from.

const PACK = /<meta name="setting" content="([\w-]+)">/.exec(readFileSync(join(MAP, 'index.html'), 'utf8'))?.[1] || 'new-angeles';
const num = v => typeof v === 'number' && Number.isFinite(v);
const pair = v => Array.isArray(v) && v.length === 2 && v.every(num);
const SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;

export function validPlaces(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false;

  // Landmark seats (`lm:<name>`) carry only a world point.

  return Object.entries(o).every(([slug, p]) => slug.startsWith('lm:') ? /^lm:[A-Za-z0-9_]+$/.test(slug) && pair(p?.at) : SLUG.test(slug) && existsSync(join(MAP, 'settings', PACK, 'places', `${slug}.js`))
    && pair(p?.at) && pair(p.size) && p.size.every(v => v >= 8 && v <= 600)
    && (p.rot === null || num(p.rot)) && typeof p.snap === 'boolean');
}
