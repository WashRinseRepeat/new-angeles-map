// The Luckier Lotus: corrugated two-tier noodle kiosk with a lotus neon, red stools and a market crowd on the Mercado Baja strip.

export const meta = { title: 'The Luckier Lotus', district: 'Base de Cayambe', type: 'Noodle shop',
  summary: "A noodle shop reborn on the Mercado Baja market strip, with the same 'quality' of noodles and Shotgun Blasters on tap.", color: [3, .3, 1.6] };

export function build(H, p, cx, cz) {
  const { BDC, GLOWS, THREE, bld, canvasTexture, decor, flickerGlow, glow, grey, hash, holo, mixStyle, neonTexture, panel, plate, prop, put, rng, roof, sign, stringLights } = H;
  const st = mixStyle(0), r = rng(hash(9003, 3)), PI = Math.PI;
  plate(cx, cz, [.03, .028, .035]);

  const person = (x, z, rgb) => {
    prop('cyl', x, .5, z, .45, 1, .45, [.04, .04, .05]);
    prop('box', x, 1.3, z, .55, .65, .35, rgb);
    prop('box', x, 1.8, z, .28, .3, .28, [.2, .14, .1]);
  };
  const soft = (tex, x, y, z, w, h, ry, gain) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setScalar(gain),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry; decor.add(m);
  };

  // Market tenement behind: podium and a weathered block with roof clutter, holo and blade signs.

  bld(cx, cz - 14, 44, 30, 16, st, r, { roof: false });
  bld(cx, cz - 16, 30, 22, 30, st, r, { y0: 16, roof: false });
  roof(cx, cz - 16, 30, 22, 46, st, r);
  holo(cx, cz - 16, 30, 22, 32, r, 2);
  for (const dx of [-1, 1]) for (let k = 0; k < 3; k++)
    sign(cx + dx * 14, cz - 14, 14, 30, 16, st, r, BDC.signs[(k + (dx > 0 ? 1 : 0)) % 3], { face: 2, blade: true, y: 20 + k * 8 });

  // Canvas art: corrugated sheet, lit interior, lotus sign, steam puff.

  const corr = canvasTexture(256, 128, (g, w, h) => {
    for (let x = 0; x < w; x += 8) { g.fillStyle = (x / 8) % 2 ? '#3c4a50' : '#56666c'; g.fillRect(x, 0, 8, h); }
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(80,50,30,${.15 + (k % 4) * .08})`; g.fillRect((k * 61) % w, (k * 37) % h, 6, 10 + k % 20); }
  });
  corr.wrapS = THREE.RepeatWrapping;
  const inside = canvasTexture(1024, 384, (g, w, h) => {
    g.fillStyle = '#e8d8b8'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b8a888'; g.lineWidth = 2;
    for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = '#3a2418'; g.fillRect(60, 90, 150, 190);
    g.fillStyle = '#f0e0c0'; for (let k = 0; k < 7; k++) g.fillRect(76, 110 + k * 24, 60 + (k * 37) % 50, 8);
    g.fillStyle = '#c84030'; g.fillRect(300, 70, 160, 110);
    g.shadowBlur = 30; g.shadowColor = '#ffc060'; g.fillStyle = '#fff0b0';
    for (const x of [280, 450, 620, 790]) { g.beginPath(); g.ellipse(x, 40, 34, 22, 0, 0, PI * 2); g.fill(); }
    g.shadowBlur = 0;
    g.fillStyle = '#2a2420'; g.beginPath(); g.arc(640, 150, 26, 0, PI * 2); g.fill();
    g.fillStyle = '#d8d0c0'; g.fillRect(596, 180, 88, 140);
    g.fillStyle = '#6a4024'; g.fillRect(610, 200, 60, 130);
    g.fillStyle = '#101010';
    for (const x of [760, 880]) { g.beginPath(); g.ellipse(x, 290, 60, 18, 0, 0, PI * 2); g.fill(); }
    g.fillStyle = '#ff8020'; for (const x of [760, 880]) g.fillRect(x - 40, 306, 80, 10);
    const sg = g.createRadialGradient(820, 180, 10, 820, 180, 170);
    sg.addColorStop(0, 'rgba(255,255,255,.85)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sg; g.fillRect(620, 0, 404, 330);
  });
  const lotusTex = canvasTexture(1024, 320, (g, w, h) => {
    g.fillStyle = '#0c0e12'; g.fillRect(0, 0, w, h);
    g.lineWidth = 8; g.lineJoin = 'round';
    g.shadowBlur = 24; g.shadowColor = '#30ff90'; g.strokeStyle = '#50ffa0';
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(512, 150); g.quadraticCurveTo(512 + s * 80, 130, 512 + s * 120, 160); g.quadraticCurveTo(512 + s * 70, 175, 512, 150); g.stroke(); }
    g.shadowColor = '#ff3aa0'; g.strokeStyle = '#ff6ac0';
    for (const a of [-1, -.5, 0, .5, 1]) {
      g.save(); g.translate(512, 150); g.rotate(a * .8); g.beginPath();
      g.moveTo(0, 0); g.quadraticCurveTo(-32, -55, 0, -110); g.quadraticCurveTo(32, -55, 0, 0); g.stroke(); g.restore();
    }
    g.fillStyle = '#ff6ac0'; g.font = 'bold 92px "Avenir Next Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('THE LUCKIER LOTUS', 470, 245);
    g.font = 'bold 90px sans-serif'; g.fillText('幸運', 830, 110);
    g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,.5)'; g.fillText('幸運', 830, 110);
    g.font = 'bold 92px "Avenir Next Condensed", "Arial Narrow", sans-serif'; g.fillText('THE LUCKIER LOTUS', 470, 245);
  });
  const puff = canvasTexture(128, 128, (g, w, h) => {
    const sg = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    sg.addColorStop(0, 'rgba(200,205,210,.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sg; g.fillRect(0, 0, w, h);
  });

  // Kiosk: raised deck, lower box with the serving window, overhang, wider sign box, roof slab.

  const fz = cz + 15, w = 18, d = 11, h1 = 5, h2 = 4.2, fr = fz + d / 2;
  prop('box', cx, .45, fz + 2, w + 9, .6, d + 9, [.09, .085, .08]);
  bld(cx, fz, w, d, h1, st, r, { lit: 0, roof: false, skin: H.SKINS.sparse, y0: .75 });
  prop('box', cx, h1 + 1, fz + .6, w + 2.2, .5, d + 2.6, [.1, .11, .12]);
  bld(cx, fz, w + 1.2, d + 1.2, h2, st, r, { lit: 0, roof: false, skin: H.SKINS.sparse, y0: h1 + 1.25 });
  prop('box', cx, h1 + h2 + 1.5, fz, w + 2.4, .5, d + 2.4, [.08, .09, .1]);
  const sheet = (x, y, z, ww, hh, ry) => { const t = corr.clone(); t.repeat.set(ww / 4, 1); t.needsUpdate = true; panel(t, x, y, z, ww, hh, ry, .55); };
  const yU = h1 + 1.25 + h2 / 2, yL = .75 + h1 / 2, U = (w + 1.2) / 2 + .08, V = (d + 1.2) / 2 + .08;
  for (const s of [-1, 1]) {
    sheet(cx, yU, fz + s * V, w + 1.2, h2, 0);
    sheet(cx + s * U, yU, fz, d + 1.2, h2, PI / 2);
    sheet(cx + s * (w / 2 + .08), yL, fz, d, h1, PI / 2);
  }
  sheet(cx, yL, fz - d / 2 - .08, w, h1, 0);

  panel(inside, cx - 2, .75 + 2.6, fr + .1, 12.5, 4.6, 0, 1.15).userData.place = p;
  sheet(cx - 2, .75 + h1 - .2, fr + .09, 13, .5, 0);
  sheet(cx + 6.5, .75 + h1 / 2, fr + .09, 5, h1, 0);
  prop('box', cx + 6, .75 + 2, fr + .15, 2.2, 4, .1, [.12, .14, .15]);
  glow(cx + 6.4, .75 + 2.6, fr + .22, .9, 1.1, .05, [1.2, .9, .6]);
  panel(lotusTex, cx + 1, yU, fr + .75, 14, 4.4, 0, 1.6);
  panel(lotusTex, cx, 11, cz + 1.3, 24, 7.5, 0, 1.4);
  for (const x of [cx - 7, cx - 4, cx - 1, cx + 2]) put(GLOWS.sphere, x, h1 - .2, fr + .5, .7, .55, .7, 0, 0, [2.2, 1.6, .7]);

  // Counter, stools, a Shotgun Blaster tap sign and a holovid on the side.

  prop('box', cx - 2, 1.9, fr + .9, 13, .25, 1.8, [.5, .48, .44]);
  prop('box', cx - 2, 1.2, fr + .3, 13, 1.4, .6, [.14, .15, .16]);
  glow(cx - 2, 1.78, fr + 1.82, 13, .06, .06, [.8, .5, .3]);
  for (let k = 0; k < 6; k++) {
    const x = cx - 7.5 + k * 2.2, z = fr + 2.8;
    prop('cyl', x, 1.4, z, .1, 1.3, .1, grey(r, .5));
    prop('cyl', x, 2.1, z, .8, .22, .8, [.5, .04, .05]);
  }
  for (const x of [cx - 6.4, cx - 3.2, cx + 1.2]) person(x, fr + 2.9, [.12 + .1 * r(), .1, .12]);
  person(cx - .5, fz + 2.5, [.35, .3, .26]);
  panel(neonTexture(['SHOTGUN BLASTER', 'ON TAP'], '#ffd040', { w: 512, h: 192, font: 'bold 58px "Avenir Next Condensed", sans-serif' }),
    cx - w / 2 - .7, h1 + 3.3, fz + 1, 6, 2.2, -PI / 2, 1.5);
  holo(cx, fz, w + 1.3, d, h1 + 3.3, r, 0, 5);
  for (let k = 0; k < 4; k++) soft(puff, cx + 3 + (k % 2), h1 + h2 + 3 + k * 2.5, fz + .5, 5 + k * 1.6, 5 + k * 1.6, k * .8, .6);

  // Market around the kiosk: awninged stalls, umbrellas, crowd, cables with lights.

  const AWN = [[.45, .14, .05], [.4, .2, .06], [.1, .25, .3]];
  for (const [x, z, ry] of [[cx - 25, cz + 10, PI / 2], [cx - 25, cz + 22, PI / 2], [cx + 25, cz + 12, -PI / 2], [cx + 25, cz + 24, -PI / 2]]) {
    const n = Math.sin(ry);
    prop('box', x, 1, z, 3, 2, 5, [.1, .1, .11]);
    prop('box', x + n * 1.6, 3.4, z, 3, .15, 6, AWN[Math.floor(r() * 3)], 0, 0);
    prop('box', x + n * 2.8, .5, z, 1.6, 1, 4.6, [.16, .12, .08]);
    for (let k = 0; k < 4; k++) prop('cyl', x + n * 2.8, 1.25, z - 1.6 + k * 1.1, .7, .5, .7, [[.5, .2, .05], [.3, .3, .1], [.4, .05, .05]][k % 3]);
    glow(x + n * 1.6, 3.2, z, .5, .2, .5, [1.8, 1.2, .6]);
    flickerGlow(x - n * 1.6, 2.4, z, .1, 1.2, 3, [1.4, .2, 1.4], r);
  }
  for (let k = 0; k < 10; k++) {
    const x = cx - 20 + r() * 40, z = cz + 4 + r() * 28;
    if (Math.abs(x - cx) < w / 2 + 5 && z < fr + 4) continue;
    person(x, z, [.08 + .15 * r(), .08 + .08 * r(), .12 + .1 * r()]);
    prop('dish', x, 2.6, z, 2.6, 1.3, 2.6, [.38, .44, .5], 0, PI);
  }
  for (let k = 0; k < 18; k++) {
    const x = cx - 22 + r() * 44, z = cz + 4 + r() * 29;
    if (Math.abs(x - cx) < w / 2 + 5 && z > fz - d / 2 - 1 && z < fr + 4) continue;
    person(x, z, [.08 + .2 * r(), .07 + .1 * r(), .1 + .15 * r()]);
  }
  for (const [ax, bx, bz] of [[-16, -25, 10], [16, 25, 12], [-6, -25, 24], [6, 25, 24]])
    stringLights([cx + ax, 14, cz + 1], [cx + bx, 3.6, cz + bz], 2, 12, [1.5, .6, 1.2]);
  return 50;
}
