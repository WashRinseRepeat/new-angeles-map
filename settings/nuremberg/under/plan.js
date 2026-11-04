// The catacomb plan: where each landmark sits and where the network meets it.
// Coordinates are world metres: x east, z south (north is -z), y up. Ground is about 3 m in the river plain,
// 10 to 25 m in the old town and 55 m at the Kaiserburg. Levels by floor height:
//   cellars   from just under the ground down to -10
//   dungeons  -12 to -25
//   deep      -28 to -50
//   abyss     -53 and below
// A landmark builds inside its box (x0..x1, z0..z1) and leaves a 3 m wide doorway at each anchor [x, y, z],
// where y is the floor height. The network's tunnels end at the anchors.

export const ZONES = {
  burg: { name: 'Kaiserburg casemates', x0: -200, x1: 60, z0: -520, z1: -395, floor: 44, anchors: { south: [-60, 44, -395] } },
  holle: { name: 'Frau Holles Grund', x0: -220, x1: 100, z0: -600, z1: -360, floor: -80, anchors: {} },
  rathaus: { name: 'Lochgefängnisse', x0: -60, x1: 40, z0: -125, z1: -65, floor: 10, anchors: { west: [-60, 10, -95], south: [-10, 10, -65] } },
  ossuary: { name: 'Beinhaus of St. Sebald', x0: -145, x1: -25, z0: -185, z1: -135, floor: 13, anchors: { east: [-25, 13, -160], west: [-145, 13, -160] } },
  felsen: { name: 'Felsengänge', x0: -265, x1: -150, z0: -330, z1: -195, floor: 18, anchors: { north: [-200, 18, -330], east: [-150, 11, -260], south: [-200, -14, -195] } },
  nix: { name: 'Grotto of the Pegnitz Nix', x0: -400, x1: -255, z0: 25, z1: 150, floor: -12, anchors: { east: [-255, -12, 85], north: [-320, -12, 25] } },
  rumpel: { name: 'Rumpelstilzchen’s Kammer', x0: -320, x1: -175, z0: 245, z1: 360, floor: -18, anchors: { north: [-240, -18, 245], east: [-175, -18, 300] } },
  hort: { name: 'Alberich’s Hort', x0: -170, x1: 10, z0: -390, z1: -255, floor: -42, anchors: { south: [-80, -42, -255], east: [10, -42, -320] } },
  walpurgis: { name: 'Walpurgissaal', x0: 15, x1: 210, z0: 375, z1: 530, floor: -48, anchors: { north: [110, -48, 375], west: [15, -48, 450] } },
  lair: { name: 'Lair of the Lindworm', x0: 370, x1: 620, z0: 200, z1: 460, floor: -92, anchors: { west: [370, -92, 330] } },
};
