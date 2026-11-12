// Pure geometry for the schematic train map. Grid units in and out, no imports.

const sgn = Math.sign;

// Two or three points from a to b. The bend sits at the diagonal end, or at the diagonal start when straightFirst.

export const legPoints = (a, b, straightFirst) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.min(Math.abs(dx), Math.abs(dy));
  if (!d || Math.abs(dx) === Math.abs(dy)) return [a, b];
  const mid = straightFirst ? [b[0] - sgn(dx) * d, b[1] - sgn(dy) * d] : [a[0] + sgn(dx) * d, a[1] + sgn(dy) * d];
  return [a, mid, b];
};

// Path entries are node keys. A leading | makes the leg into that node run straight first.

export const linePoints = (line, nodes) => {
  const pts = [], at = [];
  let prev = null;
  line.path.forEach((e, i) => {
    const key = e.replace('|', ''), p = nodes[key];
    if (!Object.hasOwn(nodes, key)) throw new Error('unknown node ' + key);
    if (i) pts.push(...legPoints(prev, p, e.startsWith('|')).slice(1)); else pts.push(p);
    at.push(pts.length - 1);
    prev = p;
  });
  return { pts, at };
};

export const isOctilinear = pts => pts.every((p, i) => {
  if (!i) return true;
  const dx = Math.abs(p[0] - pts[i - 1][0]), dy = Math.abs(p[1] - pts[i - 1][1]);
  return !dx || !dy || dx === dy;
});

// Shifts the polyline sideways by k. Corners are mitred so parallel lines stay parallel.

export const offsetLine = (pts, k) => {
  const n = (p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1; return [-dy / L, dx / L]; };
  return pts.map((p, i) => {
    const a = n(pts[Math.max(0, i - 1)], pts[Math.max(1, i)]), b = n(pts[Math.min(i, pts.length - 2)], pts[Math.min(i + 1, pts.length - 1)]);
    let mx = a[0] + b[0], my = a[1] + b[1];
    const m = Math.hypot(mx, my) || 1;
    mx /= m; my /= m;
    const c = Math.max(0.5, mx * a[0] + my * a[1]);
    return [p[0] + mx * k / c, p[1] + my * k / c];
  });
};

// Path entries that are stations, in order, without the closing repeat of a loop.

export const stationOrder = (line, stations) => {
  const out = line.path.map(e => e.replace('|', '')).filter(k => k in stations);
  if (out.length > 1 && out[0] === out.at(-1)) out.pop();
  return out;
};

export const missingStops = (schematic, rides) =>
  rides.flatMap(r => r.stops.filter(s => !(s.name in schematic.stations)).map(s => `${r.name}: ${s.name}`));
