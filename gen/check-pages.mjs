// Checks that every setting's page carries the markup the engine looks up. Each page is a copy of the page skeleton,
// so a panel or button added to one page must reach the others too.
//
//   node spikes/map/gen/check-pages.mjs
//
// It collects the element ids the engine reads (getElementById('x'), $('x'), querySelector('#x')) and the data-tab
// values it selects ([data-tab=x]), leaves out ids the engine builds itself (id="x" in its own markup), and lists
// what each page in the map folder lacks. It exits with 1 when a page lacks anything.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAP = fileURLToPath(new URL('../', import.meta.url)), ENGINE = join(MAP, 'engine');
const src = readdirSync(ENGINE).filter(f => f.endsWith('.js')).map(f => readFileSync(join(ENGINE, f), 'utf8')).join('\n');
const all = (re, text) => new Set([...text.matchAll(re)].map(m => m[1]));

const read = new Set([...all(/getElementById\('([\w-]+)'\)/g, src), ...all(/\$\('([\w-]+)'\)/g, src), ...all(/querySelector(?:All)?\('#([\w-]+)/g, src)]);
const built = all(/id="([\w-]+)"/g, src);
const ids = [...read].filter(id => !built.has(id)).sort();
const tabs = [...all(/\[data-tab=([\w-]+)\]/g, src)].sort();

let missing = 0;
for (const page of readdirSync(MAP).filter(f => f.endsWith('.html')).sort()) {
  const html = readFileSync(join(MAP, page), 'utf8'), have = all(/id="([\w-]+)"/g, html), haveTabs = all(/data-tab="([\w-]+)"/g, html);
  const lack = [...ids.filter(id => !have.has(id)), ...tabs.filter(t => !haveTabs.has(t)).map(t => `[data-tab=${t}]`)];
  missing += lack.length;
  console.log(lack.length ? `${page}: missing ${lack.join(', ')}` : `${page}: ok`);
}
console.log(`${ids.length} ids and ${tabs.length} tabs checked.`);
process.exitCode = missing ? 1 : 0;
