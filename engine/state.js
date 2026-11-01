// Shared mutable engine state. Modules read and assign these through S, because imported bindings are read-only.

export const H = {};
export const S = { FRAME: null, DECOR: null, flicker: [], BASE: new Map(), trafficT: 0 };
