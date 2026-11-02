// Sandbox kits. A house of plaster, timber frame or stone under a tiled or thatched pitched roof, and a yard with
// a tree. Kit signature: (x, z, s, st, b, r) in the lot frame.

export function kits(H) {
  const { bld, prop, glow, SKINS } = H;
  const WALLS = [SKINS.plaster, SKINS.timber, SKINS.timber, SKINS.stone];
  const ROOFS = [[SKINS.tile, [.32, .12, .07]], [SKINS.tile, [.22, .1, .08]], [SKINS.thatch, [.28, .22, .12]]];
  return {
    sb_house(x, z, s, st, b, r) {
      const w = s * (.6 + r() * .3), d = s * (.6 + r() * .3), h = 5 + r() * 5 * b;
      const [roof, base] = ROOFS[Math.floor(r() * ROOFS.length)];
      bld(x, z, w, d, h, st, r, { skin: WALLS[Math.floor(r() * WALLS.length)], roof: false, kibble: false });
      bld(x, z, w + .8, d + .8, Math.min(w, d) * .55, st, r, { y0: h, shape: 'gable', skin: roof, base, lit: 0, roof: false });
      glow(x, 2.2, z + d / 2 + .05, .9, 1.4, .05, [1.2, .75, .35]);
    },
    sb_yard(x, z, s, st, b, r) {
      prop('box', x, .1, z, s * .9, .2, s * .9, [.05, .09, .05]);
      prop('cyl', x, 2, z, .5, 4, .5, [.12, .08, .05]);
      prop('cone', x, 5.5, z, 4 + r() * 2, 5, 4 + r() * 2, [.05, .14, .06]);
    },
  };
}
export const tiers = {};
