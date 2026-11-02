// The canon map trace and the world share one transform. A map pixel [u, v] lands at
// ((u - cx) * scale, (v - cy) * scale) world metres. gen/gen.ts reads it too, so city.json and the engine agree.

export const MAP = { cx: 680, cy: 390, scale: 3.6 };
