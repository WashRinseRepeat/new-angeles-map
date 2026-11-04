// The NBN Ascension: a 362 m resort ship that NBN parks in the bay off Esmeraldas for Beanstalk launch season.
// Two tall cabin wings frame an open park canyon. A pool deck, a glass dome and a swept stack crown the bow half,
// an aqua theatre opens at the stern, and a holo ring turns over the stack. Bow points local +x, starboard is +z.

const L = 362, B = 62, KEEL = -9, WL = -2, D = 16;
const DARK = [.05, .052, .058], GUN = [.08, .085, .095], DECK = [.07, .062, .055];
const WARM = [1.6, .9, .45], CYAN = [.25, 1.3, 1.6], MAGENTA = [1.6, .2, 1.1], GOLD = [1.5, 1, .35], LEAF = [.05, .13, .045];
const dim = (rgb, k) => rgb.map(c => c * k);

// Half beam of the hull plan at s in [-1, 1], stern to bow. The bow tapers to a point, the stern ends in a transom.

const plan = s => B / 2 * (s > .3 ? (1 - ((s - .3) / .7) ** 2.4) ** .55 : s < -.8 ? .93 + .07 * (s + 1) / .2 : 1);

// The stem rakes forward, so the bow at deck level stands ahead of the bow at the keel.

const hullX = (s, yt) => s * L / 2 * (s > 0 ? .9 + .1 * yt : 1);
const hullZ = (s, yt) => plan(s) * (.8 + .2 * yt ** .6);

const A = { holo: null, core: null };

function ship(H) {
  const { THREE, GLOWS, SKINS, bld, glow, prop, put, beam, beacon, textSign, stringLights, helipad, laser, canvasTexture } = H;
  const own = m => { m.userData.noTile = true; m.frustumCulled = false; H.decor.add(m); return m; };
  const add = m => { H.decor.add(m); return m; };
  const line = (a, b, t, rgb) => beam(a, b, t, rgb, 'glow');

  // Hull side texture, stern on the left. The paint map holds navy and white with dark glass. The light map holds
  // the lit cabin rows, the cyan waterline and the name, which is painted at both ends so each side shows it at the bow.

  const hullMaps = () => {
    const W = 4096, Hh = 200, Y = y => Hh - (y - KEEL) / (D - KEEL) * Hh, X = x => (x + L / 2) / L * W, ppm = W / L;
    const rows = [[7.2, 1.15, .7], [10.2, 1.15, .72], [13.2, 1.15, .65]];
    const name = (g, fill, glow) => {
      g.save(); g.font = 'bold 34px "Avenir Next Condensed", "Arial Narrow", sans-serif'; g.textBaseline = 'middle';
      g.fillStyle = fill; g.shadowColor = glow; g.shadowBlur = glow ? 8 : 0;
      g.textAlign = 'right'; g.fillText('NBN  ASCENSION', X(158), Y(10.6));
      g.textAlign = 'left'; g.fillText('NBN  ASCENSION', X(-158), Y(10.6));
      g.restore();
    };
    const named = x => Math.abs(x) > 104 && Math.abs(x) < 160;
    const paint = canvasTexture(W, Hh, (g) => {
      g.fillStyle = '#3a0d0b'; g.fillRect(0, Y(WL), W, Hh);
      g.fillStyle = '#0b1526'; g.fillRect(0, Y(5.6), W, Y(WL) - Y(5.6));
      g.fillStyle = '#b4bac3'; g.fillRect(0, 0, W, Y(5.6));
      for (let x = -178; x < 178; x += 1.6) {
        if (Math.random() < .4) continue;
        g.fillStyle = '#0d1014'; g.fillRect(X(x), Y(3), .55 * ppm, .5 * ppm);
      }
      for (const [y, h] of rows) for (let x = -175; x < 175; x += 2.6) {
        if (named(x)) continue;
        g.fillStyle = '#121820'; g.fillRect(X(x), Y(y + h / 2), 1.7 * ppm, h * ppm);
      }
      name(g, '#0b1526', '');
    });
    const light = canvasTexture(W, Hh, (g) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, W, Hh);
      g.fillStyle = '#131518'; g.fillRect(0, 0, W, Y(5.6));
      g.fillStyle = '#030508'; g.fillRect(0, Y(5.6), W, Y(WL) - Y(5.6));
      const gr = g.createLinearGradient(0, 0, W, 0);
      gr.addColorStop(0, '#7a2ad8'); gr.addColorStop(.5, '#2a7ee0'); gr.addColorStop(1, '#2ee0f0');
      g.fillStyle = gr; g.fillRect(0, Y(6), W, .5 * ppm); g.fillRect(0, Y(-1.4), W, .45 * ppm);
      for (let x = -178; x < 178; x += 1.6) if (Math.random() < .3) { g.fillStyle = '#4a5a70'; g.fillRect(X(x), Y(3), .55 * ppm, .5 * ppm); }
      for (const [y, h, p] of rows) for (let x = -175; x < 175; x += 2.6) {
        if (named(x) || Math.random() > p) continue;
        const k = .6 + .4 * Math.random();
        g.fillStyle = `rgb(${255 * k | 0},${170 * k | 0},${95 * k | 0})`; g.fillRect(X(x), Y(y + h / 2), 1.7 * ppm, h * ppm);
      }
      name(g, '#c8f4ff', '#6fdcff');
    });
    return { paint, light };
  };

  // Hull: a loft of stations from stern to bow, both sides, with a deck cap and a transom.

  const hull = () => {
    const NX = 96, NY = 10, pos = [], uv = [], idx = [];
    for (const side of [1, -1]) {
      const v0 = pos.length / 3;
      for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
        const s = i / NX * 2 - 1, yt = j / NY, x = hullX(s, yt);
        pos.push(x, KEEL + yt * (D - KEEL), side * hullZ(s, yt));
        uv.push(side > 0 ? (x + L / 2) / L : 1 - (x + L / 2) / L, yt);
      }
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const a = v0 + j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const { paint, light } = hullMaps();
    add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: paint, emissiveMap: light, emissive: new THREE.Color(1.5, 1.5, 1.5),
      roughness: .45, metalness: .3, side: THREE.DoubleSide })));

    const outline = [];
    for (let i = 0; i <= 64; i++) { const s = i / 32 - 1; outline.push(new THREE.Vector2(hullX(s, 1), hullZ(s, 1))); }
    for (let i = 64; i >= 0; i--) { const s = i / 32 - 1; outline.push(new THREE.Vector2(hullX(s, 1), -hullZ(s, 1))); }
    const cap = add(new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(outline)).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(...DECK), roughness: .9, side: THREE.DoubleSide })));
    cap.position.y = D;

    // Rail lights run round the deck edge.

    for (let i = 0; i < 64; i++) for (const sd of [1, -1]) {
      const s0 = i / 32 - 1, s1 = (i + 1) / 32 - 1;
      line([hullX(s0, 1), D + .9, sd * hullZ(s0, 1)], [hullX(s1, 1), D + .9, sd * hullZ(s1, 1)], .22, dim(WARM, .5));
    }
    return outline;
  };

  // A swept stack, extruded from a sail profile and edged in cyan.

  const stack = (x, y, r) => {
    const prof = [[-10, 0], [16, 0], [-3, 34], [-14, 34]].map(([a, b]) => new THREE.Vector2(a, b));
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(prof), { depth: 9, bevelEnabled: false }).translate(0, 0, -4.5);
    const m = add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: new THREE.Color(...GUN), roughness: .5, metalness: .6 })));
    m.position.set(x, y, 0);
    for (const z of [-4.7, 4.7]) {
      line([x + 16, y + .5, z], [x - 3, y + 34, z], .45, CYAN);
      line([x - 10, y + 4, z], [x - 14, y + 34, z], .3, dim(MAGENTA, .7));
      for (let k = 1; k < 4; k++) line([x - 10 - k, y + 8 * k + 4, z], [x + 16 - k * 4.75, y + 8 * k + 4, z], .25, dim(CYAN, .35));
    }
    prop('box', x - 8.5, y + 34.6, 0, 11, 1.2, 9.6, DARK);
    for (const dx of [-12, -8.5, -5]) put(GLOWS.ring, x + dx, y + 35.4, 0, 2.6, 20, 2.6, 0, 0, dim(WARM, .4));
    beacon(x - 8.5, y + 36, 0, r);
  };

  // A slide tube spiralling out over the side from a tower on the wing roof.

  const slide = (x, z, top, rgb) => {
    const sd = Math.sign(z), pts = [];
    for (let k = 0; k <= 60; k++) {
      const t = k / 60, a = t * Math.PI * 5 - Math.PI / 2, rad = 7;
      pts.push(new THREE.Vector3(x + Math.cos(a) * rad, top - t * 30, sd * (38 + Math.sin(a) * rad)));
    }
    add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 1.1, 8),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb), transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false })));
    prop('box', x, top - 5, sd * 31, 4, 10, 4, GUN);
    glow(x, top + .3, sd * 31, 4.2, .4, 4.2, dim(rgb, .6));
  };

  return {
    // Open water in the bay between Base de Cayambe and Esmeraldas, parallel to the Esmeraldas shore, bow east.

    at: [390, 215], free: [380, 90, .04], label: 'NBN Ascension', labelY: 115,
    build(x0, z0, w, d, st, r) {
      const cst = { ...st, base: [.12, .125, .135], win: dim(WARM, .9), lit: .55, grime: 0 };
      const opt = (o = {}) => ({ roof: false, kibble: false, skin: SKINS.grid, ...o });
      hull();

      // A soft light pool on the water round the hull.

      const glowTex = canvasTexture(128, 128, (g) => {
        const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        gr.addColorStop(0, 'rgba(255,190,120,1)'); gr.addColorStop(.45, 'rgba(255,170,110,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      });
      const water = add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
        map: glowTex, color: new THREE.Color(.08, .075, .08), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })));
      water.position.y = WL + .05; water.scale.set(L * 1.45, 1, B * 4);

      // Cabin wings, terraced down toward the stern. Balconies face both the sea and the canyon.

      for (const sd of [1, -1]) {
        for (const [xa, xb, top] of [[-140, -112, 40], [-112, -82, 53], [-82, 92, 66]])
          bld((xa + xb) / 2, sd * 21, xb - xa, 18, top - D, cst, r, opt({ y0: D }));
        for (const [xa, xb, top] of [[-140, -112, 40], [-112, -82, 53], [-82, 92, 66]]) {
          prop('box', (xa + xb) / 2, top + .15, sd * 21, xb - xa - .6, .3, 17.4, DECK);
          line([xa, top + .2, sd * 30.2], [xb, top + .2, sd * 30.2], .3, dim(WARM, .7));
          line([xa, top + .2, sd * 11.8], [xb, top + .2, sd * 11.8], .25, dim(GOLD, .5));
        }

        // Lifeboats hang in a row under the wing overhang.

        for (let x = -78; x <= 84; x += 9) {
          prop('box', x, 19.2, sd * 31.6, 8, 2.6, 2.8, [.9, .32, .04]);
          prop('box', x, 20.8, sd * 31.6, 6, .8, 2.2, [.6, .6, .6]);
        }
        glow(-30, 22.5, sd * 33, 170, .15, .15, dim(WARM, .25));

        // Roof lounges, cabanas and a running track ring on the high wing roofs.

        for (const x of [-60, -20, 20]) bld(x, sd * 21, 14, 10, 4, cst, r, opt({ y0: 66, skin: SKINS.curtain, lit: .9 }));
        put(GLOWS.ring, 70, 66.4, sd * 21, 34, 20, 16, 0, 0, dim(CYAN, .45));

        // A big NBN sign stands on each wing roof, facing out to sea and to the city.

        textSign('NBN', -38, 73, sd * 30.4, 30, 7.5, 0, dim(MAGENTA, 1.1));
        textSign('ASCENSION', -2, 70.5, sd * 30.4, 34, 8.5, 0, dim(CYAN, .8));
      }

      // The Central Park canyon: a garden floor between the wings, lit trees and strings of lights overhead.

      bld(-35, 0, 150, 24, 8, cst, r, opt({ y0: D, lit: .8 }));
      prop('box', -35, 24.3, 0, 150, .6, 23, [.03, .05, .025]);
      for (let k = 0; k < 44; k++) {
        const x = -108 + r() * 136, z = (r() - .5) * 18, s = 3 + r() * 3.5;
        put(GLOWS.sphere, x, 26 + s * .5, z, s * 1.2, s, s * 1.2, 0, 0, dim(LEAF, .7 + r() * .6));
        glow(x, 24.8, z, .3, .5, .3, dim(GOLD, .6));
      }
      for (let x = -104; x <= 26; x += 13) line([x, 24.8, -8], [x + 13, 24.8, 8], .2, dim(GOLD, .35));
      for (let x = -100; x <= 24; x += 20) for (const y of [38, 52]) stringLights([x, y, -12], [x + 6, y, 12], 2, 10, dim(GOLD, .9));

      // The boardwalk aft of the park with a carousel ring.

      bld(-126, 0, 28, 24, 4, cst, r, opt({ y0: D, lit: .9, skin: SKINS.curtain }));
      prop('box', -126, 20.3, 0, 28, .5, 23, DECK);
      for (const [y, s] of [[21.5, 9], [24, 7]]) put(GLOWS.ring, -126, y, 0, s, 60, s, 0, 0, dim(GOLD, .9));
      prop('cone', -126, 26, 0, 9, 3, 9, [.2, .05, .08]);

      // The aqua theatre at the stern: a cyan pool, tiered seats facing aft and two high-dive towers.

      bld(-160, 0, 40, 56, 4, cst, r, opt({ y0: D, lit: .5 }));
      glow(-168, 20.2, 0, 16, .3, 22, CYAN);
      for (let k = 0; k < 6; k++) prop('box', -154 + k * 2.3, 20.6 + k * 1.1, 0, 2.3, 1.2 + k * 2.2, 40 - k * 2, [.12, .1, .12]);
      for (let k = 0; k < 6; k++) line([-154 + k * 2.3, 21.3 + k * 2.2, -19 + k], [-154 + k * 2.3, 21.3 + k * 2.2, 19 - k], .2, dim(CYAN, .4));
      for (const z of [-14, 14]) { prop('box', -176, 30, z, 2.4, 20, 2.4, GUN); glow(-174.5, 40.2, z, 3.5, .3, 1.6, dim(CYAN, .8)); }
      textSign('AQUA THEATRE', -140.5, 30, 0, 22, 4, Math.PI / 2, dim(CYAN, .9));

      // The pool deck closes the canyon forward. Pools, hot tubs and the swept stack stand on it.

      bld(61, 0, 62, 24, 58 - D, cst, r, opt({ y0: D }));
      prop('box', 61, 58.2, 0, 62, .4, 24, DECK);
      for (const [x, z, pw, pd] of [[73, -4.5, 16, 8], [73, 6, 12, 5], [87, 0, 5, 16]]) {
        prop('box', x, 58.6, z, pw + 1, .8, pd + 1, [.18, .18, .2]);
        glow(x, 58.9, z, pw, .25, pd, CYAN);
      }
      for (const z of [-8, 8]) put(GLOWS.ring, 64, 58.8, z, 3, 20, 3, 0, 0, dim(CYAN, .9));
      stack(44, 58.4, r);
      slide(80, 21, 74, MAGENTA);
      slide(80, -21, 74, GOLD);

      // The forward block and the bridge, with wings that reach past the hull and the navigation lights.

      bld(110, 0, 36, 58, 60 - D, cst, r, opt({ y0: D }));
      bld(134, 0, 12, 52, 54 - D, { ...cst, win: [1.2, 1.3, 1.5], lit: .9 }, r, opt({ y0: D, skin: SKINS.curtain }));
      prop('box', 133, 52.5, 0, 9, 1.6, 72, [.36, .37, .4]);
      glow(137.6, 51, 0, .2, 1.2, 50, dim([.9, 1, 1.3], .5));
      glow(133, 53.6, -36.2, .9, .9, .9, [2, .08, .05]);
      glow(133, 53.6, 36.2, .9, .9, .9, [.08, 2, .4]);

      // The Halo Dome: a glass hemisphere on the forward block, ribbed in steel, with a violet lounge glowing inside.

      const dx = 110, dy = 60, dr = 17;
      const dome = add(new THREE.Mesh(new THREE.SphereGeometry(dr, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({
        color: new THREE.Color(.06, .07, .13), transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
      dome.position.set(dx, dy, 0);
      for (let k = 0; k < 10; k++) put(GLOWS.ring, dx, dy, 0, dr * 2 + .3, dr * 2 + .3, dr * 2 + .3, k / 10 * Math.PI, Math.PI / 2, [.06, .07, .09]);
      for (const y of [5, 10, 14]) { const rr = Math.sqrt(dr * dr - y * y) * 2 + .3; put(GLOWS.ring, dx, dy + y, 0, rr, 25, rr, 0, 0, [.06, .07, .09]); }
      put(GLOWS.ring, dx, dy + .4, 0, dr * 2 + 1, 40, dr * 2 + 1, 0, 0, dim(CYAN, .8));
      A.core = own(new THREE.Mesh(new THREE.SphereGeometry(3.5, 20, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(...MAGENTA) })));
      A.core.position.set(dx, dy + 6, 0);
      prop('cyl', dx, dy + .6, 0, 20, 1.2, 20, [.1, .06, .12]);

      // The mast: radar, satcom domes, a white masthead light and an aviation beacon.

      prop('cyl', 126, 71, 0, .9, 22, .9, GUN);
      prop('box', 126, 76, 0, 1, 1, 14, GUN);
      prop('dish', 126, 77, 6, 3, 3, 3, [.3, .3, .32], 0, -.6);
      for (const z of [-5, 5]) put(GLOWS.sphere, 124, 63, z, 3.2, 3.2, 3.2, 0, 0, [.14, .14, .15]);
      glow(126, 80, 0, .9, .9, .9, [2, 2, 1.9]);
      beacon(126, 82.5, 0, r);

      // The foredeck: a hopper pad and mooring gear on the bow.

      helipad(158, 0, 18, D, r);
      for (const z of [-9, 9]) prop('cyl', 146, D + 1, z, 2, 2, 2, GUN);
      glow(hullX(1, 1) - 1, D + 2, 0, .8, .8, .8, [2, 2, 1.9]);
      glow(hullX(-1, 1) + .5, D + 3, 0, .8, .8, .8, [2, 2, 1.9]);

      // Searchlights sweep the sky from the wing roofs for the launch-night crowd.

      for (const [x, z, ph] of [[-70, 21, 0], [-70, -21, 2.1], [86, 21, 4.2]])
        laser([x, 67, z], [x + 60, 520, z + Math.sign(z) * 260], .7, [.16, .2, .38], { sweep: [.5, .18, .22, ph] });

      // Tenders and a water taxi wait alongside, lit at the bow and stern.

      for (const [x, z, a] of [[-40, 46, 0], [-12, 47, 0], [40, -48, .3], [150, 60, -.8]]) {
        prop('box', x, -1.4, z, 14, 2.2, 4.4, [.4, .41, .44], a);
        prop('box', x - Math.cos(a) * 1.5, .6, z + Math.sin(a) * 1.5, 7, 2, 3.6, [.1, .12, .16], a);
        glow(x - Math.cos(a) * 1.5, .7, z + Math.sin(a) * 1.5, 7.2, .5, 3.8, dim(WARM, .5), a);
        glow(x + Math.cos(a) * 7.2, .2, z - Math.sin(a) * 7.2, .4, .4, .4, [2, 2, 1.9]);
      }

      // The holo ring turns over the stack and carries the ship's NBN feed.

      const ringTex = canvasTexture(2048, 128, (g) => {
        g.font = 'bold 76px "Avenir Next Condensed", "Arial Narrow", sans-serif'; g.textBaseline = 'middle';
        g.fillStyle = '#fff'; g.shadowColor = '#7ff'; g.shadowBlur = 14;
        g.fillText('NBN  ·  ASCENSION  ·  LIVE FROM NEW ANGELES  ·  ', 20, 64);
        g.fillRect(0, 4, 2048, 5); g.fillRect(0, 119, 2048, 5);
      });
      A.holo = own(new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 6, 64, 1, true), new THREE.MeshBasicMaterial({
        map: ringTex, color: new THREE.Color(.6, 1.4, 1.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
      A.holo.position.set(36, 103, 0);
      put(GLOWS.ring, 36, 99.6, 0, 30, 30, 30, 0, 0, dim(CYAN, .6));
      put(GLOWS.ring, 36, 106.4, 0, 30, 30, 30, 0, 0, dim(MAGENTA, .6));

      return { focus: [0, 0], face: [0, 1], span: 400 };
    },

    update(t) {
      if (!A.holo) return;
      A.holo.rotation.y = t * .15;
      const p = .45 + .15 * Math.sin(t * 1.3);
      A.core.material.color.setRGB(MAGENTA[0] * p, MAGENTA[1] * p, MAGENTA[2] * p);
    },
  };
}

// The showcase builds the ship once, in the middle slot.

export const kits = H => ({ cruise(x, z, s, st, b, r) { if (!x && !z) ship(H).build(0, 0, 370, 80, st, r); } });

export const landmarks = H => ({ cr_ascension: ship(H) });
