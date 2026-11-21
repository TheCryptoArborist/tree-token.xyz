/** Original, code-drawn Forest Kingdoms scene. No external rendering dependencies. */
const W = 1600, H = 1000;
const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function ellipse(c, x, y, rx, ry, fill, stroke) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.stroke(); }
}
function poly(c, points, fill, stroke, width = 2) {
  c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.lineJoin = 'round'; c.stroke(); }
}
function roundRect(c, x, y, w, h, r, fill, stroke) {
  c.beginPath(); c.roundRect(x, y, w, h, r);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.stroke(); }
}
function line(c, points, color, width = 2) {
  c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
}
function shadow(c, x, y, rx = 23, ry = 9) { ellipse(c, x, y + 3, rx, ry, '#061e2290'); }
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.camera = { x: 800, y: 520, scale: 1 };
    this.width = 1; this.height = 1; this.dpr = 1;
    this.clock = 0; this.lastHero = null; this.walk = 0; this.initialCamera = true;
    this.ground = this.makeGround();
    this.treeSprites = Array.from({ length: 7 }, (_, i) => this.makeTree(i + 1));
    this.trees = this.makeTrees();
    this.observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.resize()) : null;
    this.observer?.observe(canvas);
    this.resize();
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
    this.width = w; this.height = h; this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.round(w * this.dpr), bh = Math.round(h * this.dpr);
    if (this.canvas.width !== bw || this.canvas.height !== bh) { this.canvas.width = bw; this.canvas.height = bh; }
  }
  screenToWorld(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (clientX - r.left - this.width / 2) / this.camera.scale + this.camera.x,
      y: (clientY - r.top - this.height / 2) / this.camera.scale + this.camera.y };
  }
  destroy() { this.observer?.disconnect(); }
  makeGround() {
    const cv = makeCanvas(W, H), c = cv.getContext('2d'), rand = rng(71219);
    const grad = c.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#183b30'); grad.addColorStop(.45, '#365a3d'); grad.addColorStop(1, '#174238');
    c.fillStyle = grad; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 220; i++) {
      const x = rand() * W, y = rand() * H;
      ellipse(c, x, y, 15 + rand() * 80, 8 + rand() * 38,
        ['#244a34', '#35563b', '#31573a', '#49633e', '#1c4435'][i % 5] + '55');
    }
    // Soft, worn trails tie the caravan, crossing, and settlement together.
    const trail = (points, width) => {
      line(c, points, '#152f2540', width + 26);
      line(c, points, '#616344', width + 10);
      line(c, points, '#78754d', width);
      line(c, points, '#93905c50', width - 21);
    };
    trail([[205, 1000], [265, 770], [310, 663], [430, 568], [530, 531], [744, 518]], 79);
    trail([[876, 518], [1010, 516], [1120, 467], [1240, 425], [1325, 337], [1430, 280]], 77);
    trail([[1120, 467], [1134, 550], [1130, 700], [1220, 830]], 49);
    ellipse(c, 1240, 430, 174, 118, '#6d76504a');
    ellipse(c, 1130, 695, 116, 73, '#54704a');
    for (let i = 0; i < 7400; i++) {
      const x = rand() * W, y = rand() * H;
      c.fillStyle = ['#99ad6920', '#b1b9801f', '#0b352a30', '#e1cb8917'][i % 4];
      c.fillRect(x, y, 1 + rand() * 4, 1 + rand() * 3);
    }
    // Riverbanks lie outside the engine's water collision strip.
    c.fillStyle = '#102e2e'; c.fillRect(728, 0, 164, H);
    c.fillStyle = '#52765b'; c.fillRect(735, 0, 150, H);
    const water = c.createLinearGradient(744, 0, 876, 0);
    water.addColorStop(0, '#194d52'); water.addColorStop(.34, '#287479'); water.addColorStop(.69, '#24686d'); water.addColorStop(1, '#15474c');
    c.fillStyle = water; c.fillRect(744, 0, 132, H);
    for (let y = 20; y < 1000; y += 28) {
      for (const x of [728 + rand() * 8, 880 + rand() * 8]) {
        if (y > 455 && y < 575) continue;
        ellipse(c, x + 3, y + 5, 10 + rand() * 9, 6 + rand() * 5, '#0a292d80');
        ellipse(c, x, y, 8 + rand() * 8, 5 + rand() * 4, ['#527063', '#849079', '#385b50'][Math.floor(rand() * 3)]);
        line(c, [[x - 5, y - 2], [x + 2, y - 4], [x + 7, y - 1]], '#a2ae8a60', 2);
      }
    }
    for (let i = 0; i < 190; i++) {
      const x = rand() * W, y = rand() * H;
      if (x > 705 && x < 915) continue;
      if ((x > 200 && x < 700 && y > 440 && y < 760) || (x > 1030 && x < 1430 && y > 290 && y < 770)) continue;
      if (i % 4 === 0) this.rock(c, x, y, .5 + rand() * .7);
      else this.fern(c, x, y, .45 + rand() * .85, i % 3);
    }
    // Caravan is a permanent landmark on the western approach.
    this.cart(c, 382, 608);
    this.sign(c, 615, 615, 'RIVER GATE');
    this.sign(c, 1020, 605, 'HEARTHGLEN');
    return cv;
  }
  makeTrees() {
    const rand = rng(5173), trees = [];
    for (let x = -30; x < W + 60; x += 74) {
      if (x > 675 && x < 930) continue;
      trees.push({ x: x + rand() * 40, y: 70 + rand() * 130, s: 1.1 + rand() * .45, i: Math.floor(rand() * 7) });
      trees.push({ x: x + rand() * 35, y: 940 + rand() * 100, s: 1.15 + rand() * .5, i: Math.floor(rand() * 7) });
    }
    for (let y = 200; y < 950; y += 92) {
      trees.push({ x: 25 + rand() * 90, y, s: .95 + rand() * .4, i: Math.floor(rand() * 7) });
      trees.push({ x: 1510 + rand() * 90, y: y - 30, s: 1.1 + rand() * .3, i: Math.floor(rand() * 7) });
    }
    [[200, 270], [305, 245], [494, 294], [608, 260], [680, 342], [655, 776], [460, 861], [190, 810],
      [956, 240], [1040, 275], [1435, 600], [1390, 780], [1300, 882], [978, 811], [928, 650], [545, 740]].forEach(([x, y], i) =>
      trees.push({ x, y, s: .8 + rand() * .3, i: i % 7 }));
    return trees;
  }
  makeTree(seed) {
    const cv = makeCanvas(200, 210), c = cv.getContext('2d'), rand = rng(seed * 923);
    c.translate(100, 185);
    poly(c, [[-15, 0], [-8, -63], [4, -82], [14, -12], [24, 3]], '#72553a', '#203c2e', 3);
    line(c, [[-4, -4], [0, -60], [-20, -91]], '#a07e49', 4);
    line(c, [[8, -22], [33, -66], [38, -88]], '#6c5038', 6);
    line(c, [[-14, 3], [-28, 10]], '#6c583b', 5);
    line(c, [[14, 1], [34, 9]], '#5e5136', 5);
    const crown = c.createRadialGradient(-18, -110, 10, 3, -105, 77);
    crown.addColorStop(0, seed % 3 ? '#547b49' : '#64834d'); crown.addColorStop(.55, '#2b6241'); crown.addColorStop(1, '#174c36');
    const blobs = [[-45, -88, 35], [44, -89, 36], [-18, -130, 38], [27, -130, 39], [0, -102, 47], [-56, -111, 24]];
    blobs.forEach(([x, y, r]) => ellipse(c, x, y + 8, r + 3, r * .72, '#102f2b'));
    blobs.forEach(([x, y, r]) => ellipse(c, x, y, r, r * .8, crown));
    for (let i = 0; i < 90; i++) {
      const a = rand() * TAU, r = Math.sqrt(rand()) * 65, x = Math.cos(a) * r, y = -111 + Math.sin(a) * r * .63;
      ellipse(c, x, y, 3 + rand() * 8, 2 + rand() * 3, ['#7f9c504c', '#97b45b3d', '#143e303e', '#417b4b80'][i % 4]);
    }
    return cv;
  }
  rock(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s); shadow(c, 2, 3, 17, 7);
    poly(c, [[-17, 0], [-11, -13], [5, -18], [20, -5], [16, 6], [-5, 9]], '#617a6a', '#304d41', 2);
    poly(c, [[-11, -13], [5, -18], [20, -5], [0, -3]], '#91a18a');
    line(c, [[-11, 3], [-2, -1], [7, 2]], '#adc09b55', 2); c.restore();
  }
  fern(c, x, y, s, kind = 0) {
    c.save(); c.translate(x, y); c.scale(s, s);
    if (kind === 2) {
      for (let i = 0; i < 3; i++) { const xx = (i - 1) * 8; line(c, [[xx, 1], [xx, -9 - i * 2]], '#c4c6a0', 3); ellipse(c, xx, -10 - i * 2, 7, 4, '#c38b60'); ellipse(c, xx - 2, -12 - i * 2, 1.5, 1, '#fff1ba'); }
    } else {
      for (let i = -2; i < 3; i++) { c.strokeStyle = i % 2 ? '#81a464' : '#5d8e56'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 3); c.quadraticCurveTo(i * 6, -10, i * 10, -15 + Math.abs(i) * 3); c.stroke();
        for (let j = 0; j < 3; j++) ellipse(c, i * (4 + j * 2.4), -5 - j * 3, 4.5, 2, i % 2 ? '#80a35c' : '#60914f'); }
    }
    c.restore();
  }
  cart(c, x, y) {
    c.save(); c.translate(x, y); shadow(c, 0, 5, 48, 16);
    ellipse(c, -32, 6, 11, 15, '#26362d', '#97815a'); ellipse(c, 34, 6, 11, 15, '#26362d', '#97815a');
    poly(c, [[-44, -33], [23, -42], [43, -16], [-26, -7]], '#936b44', '#3e402a');
    poly(c, [[-44, -33], [-26, -7], [-25, 8], [-44, -15]], '#68472f', '#3e402a');
    poly(c, [[-26, -7], [43, -16], [43, 2], [-25, 8]], '#82603e', '#3e402a');
    for (let i = 0; i < 4; i++) line(c, [[-22 + i * 16, -3], [-22 + i * 16, 5]], '#b8985a', 2);
    poly(c, [[-30, -36], [-23, -61], [3, -66], [28, -48], [32, -22]], '#ab9462', '#4c5035');
    line(c, [[-18, -61], [-8, -30]], '#e0c58a', 2);
    line(c, [[42, -9], [80, -18]], '#a27b4c', 6); c.restore();
  }
  sign(c, x, y, text) {
    line(c, [[x, y], [x, y - 44]], '#755c3c', 6);
    roundRect(c, x - 39, y - 48, 80, 24, 3, '#694e34', '#ad9862');
    c.font = 'bold 9px system-ui'; c.textAlign = 'center'; c.fillStyle = '#eee1b1'; c.fillText(text, x, y - 32);
  }
  river(c, t) {
    c.save(); c.beginPath(); c.rect(746, 0, 128, H); c.clip();
    for (let i = 0; i < 40; i++) {
      const y = (i * 31 + t * 23) % (H + 35) - 18, x = 752 + Math.sin(i * 4.7) * 8 + (i % 4) * 24;
      c.strokeStyle = i % 3 ? '#7ac4b72e' : '#b2e2cd60'; c.lineWidth = i % 3 ? 1.4 : 2;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 14, y - 4, x + 33 + Math.sin(t + i) * 9, y); c.stroke();
    }
    c.restore();
    for (let i = 0; i < 5; i++) { const y = (i * 203 + t * 14) % 1000; ellipse(c, 765 + i * 19, y, 2.8, 1.2, '#bee4b277'); }
  }
  bridge(c, fixed, t) {
    c.save(); c.translate(718, 470); shadow(c, 90, 69, 104, 23);
    const gold = fixed ? '#d1bb79' : '#b49a64';
    for (const y of [12, 80]) line(c, [[0, y], [184, y]], '#3b4636', 12);
    for (let i = 0; i < 14; i++) {
      if (!fixed && i > 3 && i < 10) continue;
      const x = i * 13 + 1, off = !fixed && (i === 3 || i === 10) ? Math.sin(i) * 8 : 0;
      poly(c, [[x, 7], [x + 11, 7 + off], [x + 12, 89 + off], [x, 89]], i % 3 ? '#92754b' : '#a58a58', '#4d4d34', 1);
      line(c, [[x + 4, 16], [x + 5, 73]], '#c5a86b70', 1);
      ellipse(c, x + 6, 16, 1.2, 1.2, '#454431'); ellipse(c, x + 6, 78, 1.2, 1.2, '#454431');
    }
    for (const x of [1, 182]) for (const y of [8, 87]) {
      roundRect(c, x - 5, y - 24, 11, 30, 2, '#6c5538', '#393f2d'); ellipse(c, x + 1, y - 23, 6, 3, gold);
    }
    if (fixed) { line(c, [[2, -10], [50, -4], [130, -5], [184, -10]], '#cbb680', 3); line(c, [[2, 69], [70, 76], [125, 76], [184, 69]], '#cbb680', 3); }
    else {
      c.setLineDash([5, 8]); c.strokeStyle = '#d2be8c55'; c.lineWidth = 2; c.strokeRect(55, 19, 73, 54); c.setLineDash([]);
      line(c, [[37, 75], [65, 90], [73, 84]], '#947244', 7);
    }
    c.restore();
  }
  camp(c, state, t) {
    const x = 1240, y = 420;
    c.save(); c.translate(x, y); shadow(c, 8, 10, 84, 25);
    poly(c, [[-64, -12], [-4, -93], [70, -18], [20, 12]], '#574e7d', '#223c39', 3);
    poly(c, [[-64, -12], [-4, -93], [-4, -10]], '#786195');
    poly(c, [[-4, -93], [70, -18], [20, 12], [-4, -10]], '#4c416c');
    line(c, [[-4, -93], [20, 12]], '#c1a765', 4); line(c, [[-64, -12], [-4, -10], [70, -18]], '#a4915e', 3);
    poly(c, [[1, -50], [23, -5], [-5, 0]], '#152e2b');
    line(c, [[-66, -13], [-83, 8]], '#b7a274', 2); line(c, [[70, -18], [91, 5]], '#b7a274', 2);
    line(c, [[-77, 5], [-77, 17]], '#8d6e41', 4);
    line(c, [[87, -65], [87, 15]], '#78603d', 5);
    poly(c, [[88, -66], [122, -61 + Math.sin(t * 2) * 2], [115, -40], [88, -43]], '#7658a3', '#c0a463', 1.5);
    line(c, [[100, -57], [106, -50], [112, -56]], '#b6d783', 2); c.restore();
    // Warm, small fire makes the home destination legible.
    const fx = 1204, fy = 488;
    ellipse(c, fx, fy, 27, 11, '#26382d');
    for (let i = 0; i < 7; i++) ellipse(c, fx + Math.cos(i / 7 * TAU) * 22, fy + Math.sin(i / 7 * TAU) * 8, 6, 4, '#7c8065');
    line(c, [[fx - 11, fy + 2], [fx + 10, fy - 3]], '#845b36', 5); line(c, [[fx - 8, fy - 4], [fx + 10, fy + 3]], '#694934', 5);
    const glow = c.createRadialGradient(fx, fy - 10, 1, fx, fy - 10, 53); glow.addColorStop(0, '#f4b65d33'); glow.addColorStop(1, '#f4b65d00');
    c.fillStyle = glow; c.fillRect(fx - 55, fy - 65, 110, 110);
    poly(c, [[fx - 8, fy], [fx - 6, fy - 16], [fx + 1, fy - 27 - Math.sin(t * 7) * 4], [fx + 8, fy - 14], [fx + 9, fy]], '#e4a151');
    poly(c, [[fx - 3, fy], [fx, fy - 15], [fx + 5, fy - 6], [fx + 4, fy]], '#ffe3a0');
  }
  workshop(c, built, t) {
    const x = 1320, y = 330; c.save(); c.translate(x, y); shadow(c, 0, 8, 79, 22);
    poly(c, [[-68, -18], [12, -34], [68, -1], [-15, 17]], '#5c6552', '#324b3a');
    if (!built) {
      for (const [xx, yy] of [[-55, -8], [45, -15], [5, -31]]) line(c, [[xx, yy], [xx, yy - 35]], '#7a6645', 9);
      line(c, [[-45, -21], [-3, -1], [48, -23]], '#9a7a4c', 9); this.rock(c, 10, 2, 1);
      poly(c, [[-35, -7], [-17, -19], [-4, -11], [-20, 4]], '#a18a57');
    } else {
      poly(c, [[-59, -18], [-59, -64], [21, -73], [58, -39], [58, 0], [-10, 12]], '#916d45', '#34432f', 3);
      for (let j = 0; j < 5; j++) line(c, [[-56, -56 + j * 12], [-9, -31 + j * 9], [55, -43 + j * 10]], '#614d32', 2);
      poly(c, [[-72, -65], [-10, -110], [74, -57], [12, -20]], '#31796b', '#193e34', 3);
      poly(c, [[-72, -65], [-10, -110], [12, -20]], '#479981');
      for (let j = 0; j < 5; j++) line(c, [[-60 + j * 12, -62 - j * 8], [12 + j * 12, -27 - j * 7]], '#73b59b44', 2);
      roundRect(c, -17, -31, 23, 39, 3, '#294136'); roundRect(c, 27, -44, 18, 18, 2, '#e5b76c', '#e3d097');
      line(c, [[31, -44], [31, -26]], '#664c32', 2); line(c, [[27, -35], [45, -35]], '#664c32', 2);
      line(c, [[-77, -76], [-77, 9]], '#927749', 5);
      poly(c, [[-76, -75], [-44, -70 + Math.sin(t * 2) * 2], [-48, -39], [-76, -46]], '#4da696', '#c8be7b');
      ellipse(c, -63, -59, 6, 6, '#e4d69d'); roundRect(c, -67, -53, 8, 5, 1, '#e4d69d');
    }
    c.restore();
  }
  grove(c, planted, t) {
    const x = 1130, y = 700;
    ellipse(c, x, y + 6, 60, 24, '#254432'); ellipse(c, x, y, 54, 21, '#736545');
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; this.rock(c, x + Math.cos(a) * 57, y + Math.sin(a) * 21, .3); }
    if (!planted) {
      line(c, [[x - 11, y + 2], [x + 11, y - 2]], '#baa674', 2); line(c, [[x - 9, y - 5], [x + 11, y + 5]], '#baa674', 2);
      return;
    }
    c.save(); c.translate(x, y); c.drawImage(this.treeSprites[2], -60, -111, 120, 126);
    for (let i = 0; i < 6; i++) ellipse(c, -26 + i * 11, -56 + Math.sin(i * 2.4) * 17, 4, 4, i % 2 ? '#f0bd68' : '#db8c53', '#5c5234');
    for (let i = 0; i < 7; i++) { const a = t * .35 + i; ellipse(c, Math.cos(a) * 48, -38 + Math.sin(a * 1.4) * 33, 1.6, 1.6, '#e1edaa'); }
    c.restore();
  }
  cache(c, claimed) {
    const x = 1090, y = 430; c.save(); c.translate(x, y); shadow(c, 0, 7, 28, 10);
    poly(c, [[-23, -19], [9, -28], [28, -13], [-6, -3]], '#b5985a', '#4c4c32');
    poly(c, [[-23, -19], [-6, -3], [-6, 15], [-23, -1]], '#7f643c', '#41452f');
    poly(c, [[-6, -3], [28, -13], [28, 6], [-6, 15]], '#9c7d44', '#41452f');
    line(c, [[7, -6], [7, 10]], '#d7ba77', 3);
    if (!claimed) { poly(c, [[-23, -20], [9, -29], [28, -14], [-6, -4]], '#b3955d', '#4f5136'); line(c, [[-10, -23], [10, -8]], '#e0c689', 3); }
    else poly(c, [[-24, -21], [8, -31], [7, -48], [-25, -40]], '#856e44', '#384532');
    c.restore();
  }
  beaver(c, actor, t, companion = false) {
    if (!actor) return;
    c.save(); c.translate(actor.x, actor.y); shadow(c, 0, 2, 21, 8);
    c.rotate(Math.sin(t * 2) * .012);
    ellipse(c, 12, 1, 10, 16, '#624a35', '#333d2a');
    for (let i = -1; i < 3; i++) line(c, [[7, -9 + i * 5], [19, -1 + i * 4]], '#896847', 1);
    ellipse(c, -8, 0, 7, 4, '#574733'); ellipse(c, 8, 0, 7, 4, '#574733');
    ellipse(c, 0, -15, 17, 19, '#946d43', '#3e4530'); ellipse(c, 0, -11, 11, 13, '#b5915c');
    ellipse(c, -12, -33, 6, 6, '#977348', '#3f4431'); ellipse(c, 12, -33, 6, 6, '#977348', '#3f4431');
    ellipse(c, 0, -29, 17, 14, '#ad8351', '#3e4530'); ellipse(c, -2, -24, 11, 8, '#d1b17a');
    ellipse(c, -7, -31, 2, 2.5, '#182c26'); ellipse(c, 7, -31, 2, 2.5, '#182c26'); ellipse(c, 0, -25, 3.5, 2.5, '#293c2e');
    roundRect(c, -3, -19, 6, 6, 1, '#f5e3ad'); line(c, [[0, -19], [0, -13]], '#c6ad7d', 1);
    poly(c, [[-17, -18], [-10, -17], [-7, -7], [13, -8], [17, -17], [18, -4], [-16, -2]], companion ? '#64518b' : '#397d75');
    line(c, [[-20, -9], [-23, -32]], '#b29458', 4); roundRect(c, -30, -36, 15, 7, 2, '#9caaa0', '#3b5247');
    c.restore();
  }
  animal(c, a, t) {
    c.save(); c.translate(a.x, a.y); shadow(c, 0, 3, 16, 6);
    const fox = a.kind === 'fox', fur = fox ? '#ca7d41' : '#d3cbb0', dark = fox ? '#654b34' : '#7b8771';
    if (fox) { c.save(); c.rotate(-.45 + Math.sin(t * 3) * .05); ellipse(c, 18, -2, 16, 7, fur, '#384a33'); ellipse(c, 29, -3, 7, 5, '#e8d9b6'); c.restore(); }
    else ellipse(c, 14, 0, 6, 6, '#e8dfc5');
    ellipse(c, -6, 2, 5, 3, dark); ellipse(c, 7, 2, 5, 3, dark);
    ellipse(c, 0, -10, 12, 14, fur, '#3f503b');
    if (fox) {
      poly(c, [[-12, -22], [-11, -39], [-2, -29]], fur, '#3f503b'); poly(c, [[4, -29], [13, -39], [13, -22]], fur, '#3f503b');
      poly(c, [[-14, -25], [0, -32], [15, -24], [0, -11]], fur, '#3f503b');
      poly(c, [[-11, -21], [0, -18], [11, -21], [0, -12]], '#eddbb2');
    } else {
      ellipse(c, -7, -34, 4, 15, fur, '#687960'); ellipse(c, 7, -35, 4, 16, fur, '#687960');
      ellipse(c, -7, -36, 1.6, 9, '#b29b89'); ellipse(c, 7, -37, 1.6, 9, '#b29b89'); ellipse(c, 0, -23, 13, 12, fur, '#5d7258');
    }
    ellipse(c, -5, -25, 1.8, 2, '#1a362a'); ellipse(c, 6, -25, 1.8, 2, '#1a362a'); ellipse(c, 0, -18, 2.5, 2, '#3c4938');
    poly(c, [[-11, -13], [10, -13], [5, -6], [-4, -9]], fox ? '#819660' : '#846496'); c.restore();
  }
  hero(c, h, t) {
    if (!h) return; const moving = this.walk > .01;
    const stride = Math.sin(t * 13) * this.walk, bob = moving ? Math.abs(Math.sin(t * 13)) * 1.6 : Math.sin(t * 2.8) * .7;
    c.save(); c.translate(h.x, h.y); shadow(c, 0, 3, 24, 9);
    ellipse(c, 0, 5, 28, 11, '#9bdc7a15', '#b4d99188');
    c.translate(0, -bob); c.scale(h.dirX < -.15 ? -1 : 1, 1);
    if (h.hit > 0 && Math.sin(t * 70) > 0) c.globalAlpha = .6;
    // Short gold mantle keeps the existing hero's silhouette recognizable.
    poly(c, [[-18, -50], [17, -51], [27 + Math.sin(t * 5) * 3, -5], [11, -9], [-3, -3], [-28 - Math.sin(t * 4) * 2, -7]], '#b18b3d', '#423c36', 2);
    poly(c, [[-17, -49], [-11, -13], [-25, -8]], '#d0a847');
    // Boots, legs and leaf seams.
    poly(c, [[-13, -25], [-2, -25], [-4 + stride * .5, -5], [-15 + stride, -4]], '#655092', '#233b37');
    poly(c, [[2, -25], [14, -25], [16 - stride, -4], [5 - stride * .5, -4]], '#694b99', '#233b37');
    line(c, [[-9, -23], [-10 + stride, -7]], '#74a44f', 3); line(c, [[8, -23], [11 - stride, -7]], '#7db64f', 3);
    poly(c, [[-16 + stride, -8], [-4 + stride, -8], [-5 + stride, 0], [-20 + stride, 0]], '#b79648', '#3d4331');
    poly(c, [[5 - stride, -8], [16 - stride, -8], [21 - stride, 0], [5 - stride, 0]], '#c2a350', '#3d4331');
    // V-shaped muscular purple torso and glowing green living vines.
    poly(c, [[-17, -52], [15, -52], [18, -38], [10, -24], [-11, -24], [-18, -38]], '#7651a5', '#263637', 2.5);
    ellipse(c, -8, -44, 8, 7, '#956fc2'); ellipse(c, 7, -44, 8, 7, '#8b5eb8');
    line(c, [[0, -51], [0, -30]], '#a6cd62', 3.5);
    line(c, [[-13, -49], [-6, -40], [0, -39], [9, -46], [14, -49]], '#87bc56', 3);
    line(c, [[-12, -37], [-3, -34], [0, -27], [4, -34], [12, -38]], '#8ac956', 2.5);
    for (const [xx, yy] of [[-8, -46], [7, -46], [-6, -39], [5, -39]]) ellipse(c, xx, yy, 3.6, 2.2, '#b9df79');
    // Belt and two normal-length arms.
    roundRect(c, -12, -28, 25, 5, 1, '#d2ad54', '#544931'); ellipse(c, 0, -25.5, 4, 4, '#ebce78', '#8b6b34');
    const punch = h.attack > 0 ? 15 : 0;
    poly(c, [[-17, -48], [-24, -44], [-25, -29 + stride], [-19, -26 + stride], [-15, -40]], '#7750a6', '#273a35');
    poly(c, [[15, -48], [23, -45], [25 + punch, -30 - punch * .45], [18 + punch, -26 - punch * .45], [14, -40]], '#8057ac', '#273a35');
    poly(c, [[-25, -33 + stride], [-18, -32 + stride], [-18, -25 + stride], [-26, -26 + stride]], '#bf9b45', '#4d4b32');
    poly(c, [[22 + punch, -35 - punch * .45], [27 + punch, -32 - punch * .45], [24 + punch, -25 - punch * .45], [17 + punch, -28 - punch * .45]], '#cba94d', '#4d4b32');
    ellipse(c, -22, -24 + stride, 5, 5, '#7750a6', '#273a35'); ellipse(c, 23 + punch, -25 - punch * .45, 5, 5, '#895eb5', '#273a35');
    poly(c, [[-21, -49], [-18, -56], [-9, -53], [-14, -45]], '#d7b75d', '#5d5036');
    poly(c, [[10, -53], [20, -56], [24, -47], [14, -45]], '#e1c066', '#5d5036');
    // Purple hood/mask, bright eyes, green bark mouth.
    ellipse(c, 0, -60, 11, 14, '#7c51ac', '#223a34');
    poly(c, [[-8, -60], [-1, -57], [-4, -54], [-9, -56]], '#1b342e');
    poly(c, [[2, -57], [9, -61], [9, -56], [4, -54]], '#1b342e');
    line(c, [[-7, -57], [-3, -56]], '#c7ed78', 1.7); line(c, [[4, -56], [8, -58]], '#c7ed78', 1.7);
    poly(c, [[0, -55], [6, -47], [1, -45], [-5, -48]], '#8fb84f', '#344c30', 1);
    line(c, [[-2, -69], [1, -63]], '#bd94da66', 1.5);
    c.restore();
    this.health(c, h.x, h.y - 89, h.hp, h.maxHp || 100, '#b0dc70', 45);
    if (h.attack > 0) {
      const angle = Math.atan2(h.dirY || 0, h.dirX || 1);
      c.save(); c.translate(h.x, h.y - 24); c.rotate(angle); c.strokeStyle = '#e4efb8d9'; c.lineWidth = 5;
      c.beginPath(); c.arc(4, 0, 61, -.85, .85); c.stroke(); c.strokeStyle = '#b7dd7380'; c.lineWidth = 12;
      c.beginPath(); c.arc(4, 0, 54, -.75, .75); c.stroke(); c.restore();
    }
    if (h.snare > 0) {
      c.strokeStyle = '#b4dc8290'; c.lineWidth = 3; ellipse(c, h.x, h.y, 120 + Math.sin(t * 11) * 14, 54, null, '#a1d77577');
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; line(c, [[h.x + Math.cos(a) * 25, h.y + Math.sin(a) * 15], [h.x + Math.cos(a + .15) * 78, h.y + Math.sin(a + .15) * 35], [h.x + Math.cos(a) * 126, h.y + Math.sin(a) * 55]], '#9cbd65a0', 3); }
    }
  }
  health(c, x, y, hp, max, color, w = 32) {
    const ratio = clamp(Number(hp || 0) / Math.max(1, max || 1), 0, 1);
    roundRect(c, x - w / 2 - 2, y - 2, w + 4, 8, 3, '#102b2be6');
    roundRect(c, x - w / 2, y, w, 4, 2, '#415144');
    if (ratio > 0) roundRect(c, x - w / 2, y, Math.max(2, w * ratio), 4, 2, color);
  }
  raider(c, a, t) {
    if (a.hp <= 0) return;
    c.save(); c.translate(a.x, a.y); const heavy = a.kind === 'heavy'; c.scale(heavy ? 1.2 : 1, heavy ? 1.2 : 1);
    shadow(c, 0, 3, 20, 8);
    if (a.attackCooldown < .25 && !a.rooted) ellipse(c, 0, 3, 31, 13, '#dc835633', '#d69a6c88');
    const walk = a.rooted > 0 ? 0 : Math.sin(t * 10 + a.x) * 2;
    poly(c, [[-13, -15], [-3, -15], [-5, 2 + walk], [-17, 2 + walk]], '#455047', '#20372f');
    poly(c, [[3, -15], [13, -15], [17, 2 - walk], [5, 2 - walk]], '#455047', '#20372f');
    poly(c, [[-17, -39], [15, -39], [18, -21], [10, -10], [-11, -10], [-19, -24]], '#8e5945', '#22372e');
    poly(c, [[-13, -37], [10, -37], [12, -19], [-11, -20]], heavy ? '#72776b' : '#b17450', '#353e30');
    line(c, [[-11, -30], [11, -30]], '#ddad6a66', 2);
    poly(c, [[-18, -36], [-26, -25], [-23, -14], [-16, -17], [-10, -31]], '#71614d', '#2f3b2c');
    poly(c, [[17, -35], [25, -27], [23, -12], [16, -15], [12, -29]], '#71614d', '#2f3b2c');
    line(c, [[25, -13], [32, -44]], '#6a543d', 4); poly(c, [[27, -45], [42, -48], [41, -33], [28, -36]], '#a5a38a', '#374737');
    ellipse(c, 0, -45, 13, 12, '#596051', '#233a2d');
    poly(c, [[-15, -45], [-9, -59], [5, -61], [15, -49], [14, -43]], '#696e61', '#263b30');
    line(c, [[-8, -47], [-2, -47]], '#e8b974', 2); line(c, [[3, -47], [8, -47]], '#e8b974', 2);
    poly(c, [[-4, -42], [7, -43], [9, -36], [-4, -36]], '#a7a28b');
    if (a.hit > 0) {
      line(c, [[-27, -49], [-34, -56]], '#f5e6ad', 2);
      line(c, [[24, -51], [32, -59]], '#f5e6ad', 2);
      line(c, [[1, -66], [1, -73]], '#f5e6ad', 2);
    }
    c.restore(); this.health(c, a.x, a.y - (heavy ? 83 : 72), a.hp, a.maxHp || 60, '#d8996f');
    if (a.rooted > 0) {
      for (let i = 0; i < 4; i++) { const xx = a.x - 20 + i * 13; c.beginPath(); c.moveTo(xx, a.y + 7); c.bezierCurveTo(xx - 14, a.y - 8, xx + 12, a.y - 17, xx, a.y - 34); c.strokeStyle = '#739e50'; c.lineWidth = 4; c.stroke(); }
      ellipse(c, a.x, a.y + 3, 27, 10, null, '#bbd684');
    }
  }
  marker(c, x, y, label, t, small = false) {
    const pulse = .5 + Math.sin(t * 2.5) * .5;
    ellipse(c, x, y + 4, 30 + pulse * 4, 12 + pulse * 1.5, '#c6dfa51a', '#c4dfa477');
    const yy = y - (small ? 55 : 84) - Math.sin(t * 2) * 3;
    const font = clamp(14 / this.camera.scale, 16, 25);
    c.font = `700 ${font}px system-ui, sans-serif`; c.textAlign = 'center';
    const tw = c.measureText(label).width;
    roundRect(c, x - tw / 2 - 11, yy - font - 3, tw + 22, font + 13, 5, '#102e2cde', '#8ba56a99');
    c.fillStyle = '#eee4bc'; c.fillText(label, x, yy + 1);
    poly(c, [[x - 5, yy + 14], [x + 5, yy + 14], [x, yy + 20]], '#d7d7a0');
  }
  render(state, dt = 0) {
    if (!state || !this.ctx) return;
    const c = this.ctx, h = state.hero || { x: 270, y: 650 }, w = state.world || {};
    const t = performance.now() / 1000;
    this.clock = t;
    if (this.lastHero) { const speed = Math.hypot(h.x - this.lastHero.x, h.y - this.lastHero.y); this.walk += ((speed > .1 ? 1 : 0) - this.walk) * .25; }
    this.lastHero = { x: h.x, y: h.y };
    // Portrait tablets need the same follow camera as phones: a width-only
    // phone breakpoint can leave the western approach outside their viewport.
    const narrow = this.width < 1000 || this.width / this.height < 1.2;
    const scale = narrow ? Math.max(this.width / 720, this.height / 1000) : Math.max(this.width / 1600, this.height / 1000);
    const halfW = this.width / scale / 2, halfH = this.height / scale / 2;
    const tx = narrow ? clamp(h.x + 80, halfW, W - halfW) : 800;
    // A little vertical overscan lets upper destinations sit below the phone
    // HUD even when a tall viewport already spans the world's full height.
    const ty = narrow ? clamp(h.y - 40, halfH - 200, H - halfH + 200) : 510;
    const follow = this.initialCamera || this.followHero !== narrow ? 1 : 1 - Math.exp(-Math.max(dt || .016, .001) * 5);
    this.followHero = narrow;
    this.camera.x += (tx - this.camera.x) * follow; this.camera.y += (ty - this.camera.y) * follow; this.camera.scale = scale; this.initialCamera = false;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.fillStyle = '#102c27'; c.fillRect(0, 0, this.width, this.height);
    c.save(); c.translate(this.width / 2, this.height / 2); c.scale(scale, scale); c.translate(-this.camera.x, -this.camera.y);
    c.drawImage(this.ground, 0, 0); this.river(c, t); this.bridge(c, w.bridge, t);
    // A shaft of filtered light lands on the route, without washing out the playfield.
    const shaft = c.createLinearGradient(930, 0, 610, 850); shaft.addColorStop(0, '#e1df8d12'); shaft.addColorStop(1, '#e1df8d00');
    poly(c, [[540, 0], [650, 0], [1150, 900], [840, 900]], shaft);
    for (const tr of this.trees) shadow(c, tr.x + 16 * tr.s, tr.y + 3, 61 * tr.s, 24 * tr.s);
    const drawables = this.trees.map(tr => ({ y: tr.y, draw: () => c.drawImage(this.treeSprites[tr.i], tr.x - 100 * tr.s, tr.y - 185 * tr.s, 200 * tr.s, 210 * tr.s) }));
    const workshopOccludesHero = w.workshop && h.x > 1226 && h.x < 1412 && h.y > 210 && h.y <= 330;
    drawables.push(
      { y: 420, draw: () => this.camp(c, state, t) },
      { y: 330, draw: () => {
        c.save();
        if (workshopOccludesHero) c.globalAlpha = .34;
        this.workshop(c, w.workshop, t);
        c.restore();
      } },
      { y: 700, draw: () => this.grove(c, w.grove, t) },
      { y: 430, draw: () => this.cache(c, w.cache) }
    );
    if (state.engineer) drawables.push({ y: state.engineer.y, draw: () => this.beaver(c, state.engineer, t) });
    for (const a of state.villagers || []) drawables.push({ y: a.y, draw: () => this.animal(c, a, t) });
    for (const e of state.enemies || []) if (e.hp > 0) drawables.push({ y: e.y, draw: () => this.raider(c, e, t) });
    if (w.recruit) drawables.push({ y: 490, draw: () => this.beaver(c, { x: 1280, y: 490 }, t, true) });
    drawables.push({ y: h.y, draw: () => this.hero(c, h, t) });
    drawables.sort((a, b) => a.y - b.y).forEach(d => d.draw());
    // Field labels represent actionable places, not decorative HUD.
    if (state.stage === 'meet' && state.engineer) this.marker(c, state.engineer.x, state.engineer.y, 'BRAM · ENGINEER', t);
    if (state.stage === 'repair') this.marker(c, 703, 525, 'REPAIR CROSSING', t, true);
    if (state.stage === 'cross') this.marker(c, 958, 518, 'LEAD THE CARAVAN', t, true);
    if (state.stage === 'plant') this.marker(c, 1130, 700, 'PLANT THE GROVE', t);
    if (state.stage === 'restore') this.marker(c, 1320, 330, 'RESTORE THE GUILD', t);
    if (['plant', 'restore'].includes(state.stage) && !w.cache) this.marker(c, 1090, 430, 'SUPPLIES', t, true);
    if (state.stage === 'complete' && w.bonus) this.marker(c, 1320, 330, 'BEAVER GUILD · −20%', t);
    // Ambient spores and fireflies.
    for (let i = 0; i < 32; i++) {
      const xx = 100 + ((i * 147.3 + Math.sin(t * .3 + i) * 19) % 1400), yy = 180 + ((i * 87.7 + Math.sin(t * .55 + i * 3) * 16) % 700);
      const a = .15 + (Math.sin(t * 1.5 + i) + 1) * .16;
      c.globalAlpha = a; ellipse(c, xx, yy, i % 4 ? 1.5 : 2.5, i % 4 ? 1.5 : 2.5, '#e9ebad');
    }
    c.globalAlpha = 1; c.restore();
    // Subtle vignette anchors the map inside the interface.
    const vg = c.createRadialGradient(this.width * .5, this.height * .48, this.height * .18, this.width * .5, this.height * .48, Math.max(this.width, this.height) * .67);
    vg.addColorStop(0, '#061b1700'); vg.addColorStop(.65, '#061b1708'); vg.addColorStop(1, '#061b17a0');
    c.fillStyle = vg; c.fillRect(0, 0, this.width, this.height);
  }
}
