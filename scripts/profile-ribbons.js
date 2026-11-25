// Original Canvas artwork: every ribbon includes two illustrated trees.
// Draw in a fixed design space so preview, repositioning and PNG export agree.
const DESIGN_WIDTH = 960;
const DESIGN_HEIGHT = 200;
const RATIO = DESIGN_WIDTH / DESIGN_HEIGHT;

export const RIBBONS = Object.freeze([
  Object.freeze({ id: 'christmas', label: 'Merry Christmas', tree: 'evergreen', season: 'christmas', colors: ['#812932', '#bc3b43', '#681d29'], foliage: ['#124f38', '#25875b', '#81b875'] }),
  Object.freeze({ id: 'thanksgiving', label: 'Happy Thanksgiving', tree: 'oak', season: 'autumn', colors: ['#793b18', '#b86b27', '#653013'], foliage: ['#a94b21', '#e49a36', '#f2c765'] }),
  Object.freeze({ id: 'holidays', label: 'Happy Holidays', tree: 'evergreen', season: 'winter', colors: ['#154d47', '#247563', '#103e3b'], foliage: ['#154c3d', '#38846c', '#b0d3bd'] }),
  Object.freeze({ id: 'website', label: 'Tree-Token.xyz', tree: 'oak', season: 'canopy', colors: ['#143c2b', '#377345', '#102f23'], foliage: ['#245a31', '#5a9a45', '#b2c760'] }),
  Object.freeze({ id: 'buy-tree', label: 'Buy Tree', tree: 'oak', season: 'canopy', colors: ['#25452a', '#538245', '#1d3e26'], foliage: ['#20532f', '#6b9d40', '#c2d272'] }),
  Object.freeze({ id: 'nftrees', label: 'NFTrees', secondary: 'Grow Your Grove', tree: 'oak', season: 'grove', colors: ['#3b2458', '#665081', '#302044'], foliage: ['#205637', '#7eaa50', '#c2d878'] }),
]);

export function ribbonDimensions(width = 650) {
  const value = Number(width);
  const w = Number.isFinite(value) && value > 0 ? value : 650;
  return { w, h: w / RATIO };
}

function polygon(ctx, points, fill, stroke = null, lineWidth = 1) {
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

function ellipse(ctx, x, y, rx, ry, angle, fill, stroke = null, width = 1) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

function line(ctx, points, color, width = 2) {
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}

function ribbonBody(ctx, style) {
  const [dark, light, deepest] = style.colors;
  const tail = ctx.createLinearGradient(0, 76, 0, 180);
  tail.addColorStop(0, dark); tail.addColorStop(.45, light); tail.addColorStop(1, deepest);
  for (const mirrored of [false, true]) {
    ctx.save();
    if (mirrored) { ctx.translate(DESIGN_WIDTH, 0); ctx.scale(-1, 1); }
    polygon(ctx, [[3, 91], [111, 68], [111, 163], [3, 183], [27, 136]], '#081b1780');
    polygon(ctx, [[3, 85], [110, 63], [110, 157], [3, 177], [27, 130]], tail, '#d8b970', 2.3);
    line(ctx, [[13, 91], [100, 73], [100, 150], [14, 167]], '#f5df9e85', 1.3);
    polygon(ctx, [[83, 149], [125, 167], [83, 188]], deepest, '#b28b43', 1.5);
    line(ctx, [[86, 156], [116, 168], [87, 181]], '#e5c27b70', 1.2);
    ctx.restore();
  }
  ctx.save();
  ctx.translate(0, 5);
  ctx.beginPath();
  ctx.moveTo(83, 48); ctx.quadraticCurveTo(480, 25, 877, 48);
  ctx.lineTo(877, 166); ctx.quadraticCurveTo(480, 188, 83, 166); ctx.closePath();
  ctx.fillStyle = '#05171180'; ctx.fill(); ctx.restore();

  const satin = ctx.createLinearGradient(0, 34, 0, 183);
  satin.addColorStop(0, dark); satin.addColorStop(.22, light); satin.addColorStop(.52, dark); satin.addColorStop(1, deepest);
  ctx.beginPath();
  ctx.moveTo(83, 44); ctx.quadraticCurveTo(480, 23, 877, 44);
  ctx.lineTo(877, 162); ctx.quadraticCurveTo(480, 184, 83, 162); ctx.closePath();
  ctx.fillStyle = satin; ctx.fill(); ctx.strokeStyle = '#e9cc83'; ctx.lineWidth = 3.6; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(93, 52); ctx.quadraticCurveTo(480, 34, 867, 52);
  ctx.lineTo(867, 154); ctx.quadraticCurveTo(480, 174, 93, 154); ctx.closePath();
  ctx.strokeStyle = '#f6e4b45c'; ctx.lineWidth = 1.2; ctx.stroke();
  line(ctx, [[221, 54], [310, 49], [390, 47]], '#fff1c34a', 1.5);
  line(ctx, [[570, 47], [650, 49], [739, 54]], '#fff1c34a', 1.5);
}

function star(ctx, x, y, radius, color = '#ffe4a1') {
  const points = Array.from({ length: 10 }, (_, i) => {
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    const r = i % 2 ? radius * .43 : radius;
    return [x + Math.cos(angle) * r, y + Math.sin(angle) * r];
  });
  polygon(ctx, points, color, '#8e6a28', 1.1);
}

function evergreen(ctx, style) {
  const [deep, middle, bright] = style.foliage;
  polygon(ctx, [[-8, 47], [8, 47], [10, 80], [-11, 80]], '#9c713b', '#49331e', 2.4);
  line(ctx, [[1, 53], [2, 77]], '#dcb974', 2);
  const crown = ctx.createLinearGradient(-45, -60, 48, 68);
  crown.addColorStop(0, bright); crown.addColorStop(.32, middle); crown.addColorStop(.85, deep);
  polygon(ctx, [[0, -77], [-20, -40], [-12, -43], [-35, -8], [-22, -12], [-48, 24], [-32, 20], [-58, 58], [-21, 52], [0, 62], [23, 52], [58, 58], [33, 20], [48, 24], [23, -12], [35, -8], [12, -43], [20, -40]], crown, '#082f25', 3.1);
  line(ctx, [[0, -63], [-10, -30], [-28, 2]], '#a5ce9690', 2.2);
  line(ctx, [[-27, 12], [-39, 38], [-49, 49]], '#a5ce9685', 2);
  line(ctx, [[6, -33], [20, -11]], '#d5d78f70', 1.4);
  line(ctx, [[6, 1], [31, 23]], '#d5d78f70', 1.4);
  if (style.season === 'christmas') {
    star(ctx, 0, -80, 10);
    ctx.beginPath(); ctx.moveTo(-13, -29); ctx.quadraticCurveTo(18, -14, 24, -3);
    ctx.moveTo(-29, 8); ctx.quadraticCurveTo(-4, 28, 38, 32);
    ctx.strokeStyle = '#edd08a'; ctx.lineWidth = 2.3; ctx.stroke();
    for (const [x, y, color] of [[-7, -30, '#d5494d'], [19, -1, '#f1cf78'], [-26, 13, '#e4bc65'], [9, 34, '#ca3949'], [35, 43, '#f4d896'], [-36, 43, '#d5494d']]) {
      ellipse(ctx, x, y, 4.8, 4.8, 0, color, '#55351f', .8);
      ellipse(ctx, x - 1, y - 1.5, 1.3, 1.2, 0, '#fff8dc');
    }
  } else {
    for (const points of [[[-1, -72], [-14, -45], [2, -48]], [[-13, -29], [-29, -9], [-8, -13]], [[10, 0], [31, 21], [12, 18]], [[-24, 22], [-44, 48], [-19, 43]]]) {
      polygon(ctx, points, '#e3ede3', '#aec8b9', .7);
    }
    star(ctx, 0, -81, 7, '#f5edc4');
  }
  line(ctx, [[-20, 82], [-8, 77], [0, 79], [13, 76], [22, 81]], '#ead49a', 2.1);
}

function oak(ctx, style) {
  const [deep, middle, bright] = style.foliage;
  polygon(ctx, [[-9, 10], [8, 9], [9, 46], [16, 65], [28, 78], [10, 73], [1, 68], [-11, 77], [-28, 80], [-16, 66], [-7, 45]], '#a77c43', '#543c24', 2.7);
  line(ctx, [[1, 13], [-1, 41], [3, 66]], '#e6bd73', 3.1);
  line(ctx, [[-4, 39], [-22, 17], [-33, 5]], '#8c612f', 6.5);
  line(ctx, [[5, 35], [26, 12], [30, -8]], '#a77c43', 6.5);
  const clusters = [[-37, -7, 25, 26], [36, -8, 26, 26], [-24, -39, 28, 27], [20, -41, 30, 29], [0, -61, 28, 26], [-4, -19, 38, 32], [-46, -28, 20, 21], [44, -29, 21, 23]];
  for (const [x, y, rx, ry] of clusters) ellipse(ctx, x, y, rx, ry, 0, deep, '#163f2a', 2.7);
  for (const [x, y, rx, ry] of clusters) ellipse(ctx, x - 3, y - 4, rx * .84, ry * .79, -.18, middle);
  for (const [x, y, rx, ry] of [[-21, -47, 16, 9], [1, -69, 15, 8], [23, -46, 16, 10], [-40, -29, 11, 8], [34, -18, 12, 8], [-5, -23, 15, 9]]) ellipse(ctx, x, y, rx, ry, -.2, bright);
  for (const [x, y, angle] of [[-36, -14, -.7], [-18, -49, .5], [4, -56, -.6], [26, -31, .7], [14, -13, -.5]]) {
    line(ctx, [[x - 5, y + 2], [x + 5, y - 2]], '#e1d88b95', 1.4);
    ellipse(ctx, x, y - 1, 5.3, 2.3, angle, style.season === 'grove' ? '#b6ca77' : '#e9d3869e');
  }
  if (style.season === 'grove') {
    for (const [x, y] of [[-33, -33], [18, -53], [33, -2]]) ellipse(ctx, x, y, 5, 4.3, -.4, '#b89bda', '#574069', 1);
  }
  line(ctx, [[-27, 82], [-10, 78], [4, 80], [25, 81]], '#dcc181', 1.8);
}

function leaf(ctx, x, y, angle, color, length = 12) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(-length, 0); ctx.quadraticCurveTo(0, -8, length, 0); ctx.quadraticCurveTo(0, 7, -length, 0); ctx.closePath();
  ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#153f26'; ctx.lineWidth = 1; ctx.stroke();
  line(ctx, [[-length + 3, 0], [length - 2, 0]], '#e6d58f8c', .9);
  ctx.restore();
}

function acorn(ctx, x, y, angle) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ellipse(ctx, 0, 3, 6, 8, 0, '#dca658', '#62461e', 1);
  ellipse(ctx, 0, -3, 8, 4.1, 0, '#71532c', '#442f1b', 1.1);
  line(ctx, [[0, -6], [2, -10]], '#ad8b4e', 2);
  line(ctx, [[-3, -3], [1, -1], [5, -3]], '#d6b56b', .7);
  ctx.restore();
}

function holly(ctx, x, y, angle) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  polygon(ctx, [[-18, 0], [-12, -4], [-10, -9], [-5, -5], [1, -6], [2, 0], [9, 3], [1, 7], [-1, 12], [-8, 8], [-14, 10], [-14, 4]], '#356c38', '#b8c36c', 1.2);
  line(ctx, [[-16, 1], [5, 3]], '#d8ca7c', .9); ctx.restore();
}

function endBranches(ctx, style) {
  ctx.beginPath(); ctx.moveTo(-59, 68); ctx.quadraticCurveTo(-37, 93, 3, 86); ctx.quadraticCurveTo(28, 87, 51, 68);
  ctx.strokeStyle = '#d1ae62'; ctx.lineWidth = 2.3; ctx.stroke();
  const colors = style.season === 'autumn' ? ['#d46e2f', '#ebbb58', '#b64f26'] : ['#4e8b43', '#93b65b', '#c5ce78'];
  for (const [i, x, y, angle] of [[0, -46, 78, -.6], [1, -28, 86, -.35], [2, -10, 87, -.08], [0, 21, 84, .35], [1, 40, 75, .6]]) leaf(ctx, x, y, angle, colors[i], 10.5);
  if (style.season === 'autumn') {
    acorn(ctx, -45, 62, -.5); acorn(ctx, 43, 59, .5);
  } else if (style.season === 'christmas') {
    holly(ctx, -38, 64, -.7); holly(ctx, 44, 65, .4);
    for (const [x, y] of [[-40, 65], [-35, 68], [-41, 71], [39, 67], [44, 70]]) ellipse(ctx, x, y, 3.3, 3.3, 0, '#e35150', '#6f252a', .6);
  } else if (style.season === 'winter') {
    for (const [x, y] of [[-48, 61], [40, 57]]) {
      line(ctx, [[x - 6, y], [x + 6, y]], '#e2ebd9', 1.4);
      line(ctx, [[x - 3, y - 5], [x + 3, y + 5]], '#e2ebd9', 1.4);
      line(ctx, [[x - 3, y + 5], [x + 3, y - 5]], '#e2ebd9', 1.4);
    }
  }
}

function treeEnd(ctx, style, x, mirrored) {
  ctx.save(); ctx.translate(x, 97); ctx.scale(mirrored ? -.89 : .89, .89);
  if (style.tree === 'evergreen') evergreen(ctx, style); else oak(ctx, style);
  endBranches(ctx, style); ctx.restore();
}

function fitFont(ctx, text, maxWidth, startSize, fontFamily) {
  let size = startSize;
  ctx.font = `bold ${size}px ${fontFamily}`;
  const measured = ctx.measureText(text).width;
  if (measured > maxWidth) { size *= maxWidth / measured; ctx.font = `bold ${size}px ${fontFamily}`; }
  return size;
}

function ribbonText(ctx, style) {
  const family = style.season === 'canopy' || style.season === 'grove' ? '"Trebuchet MS", Arial, sans-serif' : 'Georgia, "Times New Roman", serif';
  const size = style.secondary ? 70 : style.label.length < 10 ? 68 : 61;
  fitFont(ctx, style.label, 522, size, family);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const y = style.secondary ? 91 : 108;
  ctx.strokeStyle = '#102519b3'; ctx.lineWidth = 3; ctx.strokeText(style.label, 480, y + 2);
  const gold = ctx.createLinearGradient(0, y - 35, 0, y + 35);
  gold.addColorStop(0, '#fff8df'); gold.addColorStop(.45, '#fff0bd'); gold.addColorStop(1, '#e7c276');
  ctx.fillStyle = gold; ctx.fillText(style.label, 480, y);
  if (style.secondary) {
    ctx.font = 'bold 34px "Trebuchet MS", Arial, sans-serif';
    ctx.fillStyle = '#eadcad'; ctx.fillText(style.secondary, 480, 140);
    const halfSecondary = ctx.measureText(style.secondary).width / 2;
    line(ctx, [[480 - halfSecondary - 56, 140], [480 - halfSecondary - 18, 140]], '#d1bd77', 1.2);
    line(ctx, [[480 + halfSecondary + 18, 140], [480 + halfSecondary + 56, 140]], '#d1bd77', 1.2);
  } else {
    line(ctx, [[370, 151], [439, 153]], '#e4cd896b', 1.2);
    line(ctx, [[521, 153], [590, 151]], '#e4cd896b', 1.2);
    polygon(ctx, [[480, 148], [486, 153], [480, 158], [474, 153]], '#e5ca88');
  }
}

export function drawRibbon(ctx, id, placement) {
  const style = RIBBONS.find(ribbon => ribbon.id === id);
  if (!style || !placement) return false;
  const { x, y, w, h } = placement;
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return false;
  ctx.save();
  try {
    // Includes the tails, trees, leaves and their strokes; nothing is painted
    // outside the bounds used by the editor's movement constraints.
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.translate(x, y); ctx.scale(w / DESIGN_WIDTH, h / DESIGN_HEIGHT);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ribbonBody(ctx, style);
    treeEnd(ctx, style, 145, false);
    treeEnd(ctx, style, 815, true);
    ribbonText(ctx, style);
  } finally {
    ctx.restore();
  }
  return true;
}
