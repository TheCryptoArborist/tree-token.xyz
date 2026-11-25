// Original Canvas artwork. The entire design is an annular sector, including
// its folded tails and the two green/gold circuit-leaf ornaments.
const DESIGN_WIDTH = 960;
const DESIGN_HEIGHT = 360;
const ARC_X = 480;
const ARC_Y = 600;
const OUTER_RADIUS = 570;
const INNER_RADIUS = 480;
const HALF_ANGLE = 55 * Math.PI / 180;
const DEFAULT_WIDTH = 760;

export const RIBBONS = Object.freeze([
  Object.freeze({ id: 'christmas', label: 'Merry Christmas', colors: ['#852633', '#bd4049', '#581b29'] }),
  Object.freeze({ id: 'thanksgiving', label: 'Happy Thanksgiving', colors: ['#824618', '#bb792d', '#663617'] }),
  Object.freeze({ id: 'holidays', label: 'Happy Holidays', colors: ['#164e49', '#2f7b6d', '#103d3b'] }),
  Object.freeze({ id: 'website', label: 'Tree-Token.xyz', colors: ['#153e2e', '#397c4b', '#102e25'] }),
  Object.freeze({ id: 'buy-tree', label: 'Buy Tree', colors: ['#28512f', '#578f44', '#173b29'] }),
  Object.freeze({ id: 'nftrees', label: 'NFTrees', secondary: 'Grow Your Grove', colors: ['#42275e', '#73518c', '#302044'] }),
]);

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const positive = (value, fallback) => {
  const result = finite(value, fallback);
  return result > 0 ? result : fallback;
};
const orientation = direction => direction === 'bottom' ? -1 : 1;

export function ribbonDimensions(width = DEFAULT_WIDTH) {
  const w = positive(width, DEFAULT_WIDTH);
  return { w, h: w * (DESIGN_HEIGHT / DESIGN_WIDTH) };
}

export function defaultRibbonPosition({ width = DEFAULT_WIDTH, direction = 'top' } = {}) {
  const scale = ribbonDimensions(width).w / DESIGN_WIDTH;
  // Align the ribbon's underlying circle with the profile circle, rather than
  // aligning the rectangular image box with the edge of the profile.
  return { x: 0, y: -orientation(direction) * (ARC_Y - DESIGN_HEIGHT / 2) * scale };
}

function supportDistance(x, y, scale, side) {
  const cy = y + side * (ARC_Y - DESIGN_HEIGHT / 2) * scale;
  // For either radial edge, squared distance is a sinusoid in angle. Its
  // maximum occurs at an angular endpoint or at this stationary direction.
  const angles = [-HALF_ANGLE, HALF_ANGLE];
  const peak = Math.atan2(x, -side * cy);
  if (peak >= -HALF_ANGLE && peak <= HALF_ANGLE) angles.push(peak);
  let maximum = 0;
  for (const radius of [INNER_RADIUS * scale, OUTER_RADIUS * scale]) {
    for (const angle of angles) {
      maximum = Math.max(maximum, Math.hypot(x + radius * Math.sin(angle), cy - side * radius * Math.cos(angle)));
    }
  }
  return maximum;
}

export function constrainRibbonPosition({ x = 0, y = 0, width = DEFAULT_WIDTH, direction = 'top', radius = 490 } = {}) {
  const requested = { x: finite(x), y: finite(y) };
  const scale = ribbonDimensions(width).w / DESIGN_WIDTH;
  const cropRadius = positive(radius, 490);
  const side = orientation(direction);
  const fits = point => supportDistance(point.x, point.y, scale, side) <= cropRadius;
  if (fits(requested)) return requested;

  let anchor = { x: 0, y: 0 };
  if (!fits(anchor)) {
    // This anchor centers the widest pair of painted points vertically. It
    // also handles smaller custom crops whenever the sector can fit at all.
    anchor = { x: 0, y: side * (OUTER_RADIUS * Math.cos(HALF_ANGLE) - ARC_Y + DESIGN_HEIGHT / 2) * scale };
    if (!fits(anchor)) return { x: 0, y: 0 }; // An oversized design cannot fit.
  }
  const dx = requested.x - anchor.x;
  const dy = requested.y - anchor.y;
  const largest = Math.max(Math.abs(dx), Math.abs(dy));
  if (!largest || !Number.isFinite(largest)) return anchor;
  const normalizedLength = Math.hypot(dx / largest, dy / largest);
  const ux = dx / largest / normalizedLength;
  const uy = dy / largest / normalizedLength;
  let lower = 0;
  // Two feasible translations of the same nonempty artwork are at most a
  // crop diameter apart. This keeps huge finite inputs numerically stable.
  let upper = Math.min(Math.hypot(dx, dy), cropRadius * 2, Number.MAX_VALUE);
  for (let step = 0; step < 52; step++) {
    const distance = lower + (upper - lower) / 2;
    const point = { x: anchor.x + ux * distance, y: anchor.y + uy * distance };
    if (fits(point)) lower = distance; else upper = distance;
  }
  return { x: anchor.x + ux * lower, y: anchor.y + uy * lower };
}

function arcPoint(radius, degrees) {
  const angle = degrees * Math.PI / 180;
  return [ARC_X + radius * Math.sin(angle), ARC_Y - radius * Math.cos(angle)];
}

function sectorPath(ctx, inner = INNER_RADIUS, outer = OUTER_RADIUS, start = -55, end = 55) {
  const a = -Math.PI / 2 + start * Math.PI / 180;
  const b = -Math.PI / 2 + end * Math.PI / 180;
  ctx.beginPath();
  ctx.arc(ARC_X, ARC_Y, outer, a, b);
  ctx.arc(ARC_X, ARC_Y, inner, b, a, true);
  ctx.closePath();
}

function polygon(ctx, points, fill, stroke = null, width = 1) {
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

function line(ctx, points, color, width = 2) {
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}

function strokeArc(ctx, radius, start, end, color, width) {
  ctx.beginPath();
  ctx.arc(ARC_X, ARC_Y, radius, -Math.PI / 2 + start * Math.PI / 180, -Math.PI / 2 + end * Math.PI / 180);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}

function ribbonBody(ctx, style) {
  const [dark, light, deepest] = style.colors;
  const satin = ctx.createRadialGradient(ARC_X, ARC_Y, INNER_RADIUS, ARC_X, ARC_Y, OUTER_RADIUS);
  satin.addColorStop(0, deepest); satin.addColorStop(.25, dark);
  satin.addColorStop(.73, light); satin.addColorStop(1, dark);

  for (const sign of [-1, 1]) {
    // The tails continue tangentially around the same circle. Their inward
    // notch and contrasting fold make the ribbon ends legible at small size.
    const tail = [[481, 46], [568, 46], [568, 54.7], [526, 51.2], [482, 54.7]].map(([r, a]) => arcPoint(r, sign * a));
    polygon(ctx, tail, dark, '#d2ad60', 2.5);
    polygon(ctx, [[482, 45], [523, 49], [482, 52]].map(([r, a]) => arcPoint(r, sign * a)), deepest, '#b18b49', 1.6);
  }

  sectorPath(ctx, 482, 568, -49, 49);
  ctx.fillStyle = satin; ctx.fill(); ctx.strokeStyle = '#edcf87'; ctx.lineWidth = 3.6; ctx.stroke();
  strokeArc(ctx, 561, -48.2, 48.2, '#fff0bd83', 1.4);
  strokeArc(ctx, 489, -48.2, 48.2, '#e9cb7c6e', 1.3);
  strokeArc(ctx, 555, -30, 30, '#fff0be30', 1.1);
  for (const sign of [-1, 1]) {
    polygon(ctx, [[483, 46.5], [515, 49], [483, 51]].map(([r, a]) => arcPoint(r, sign * a)), deepest, '#d1a959', 1.1);
  }
}

function node(ctx, x, y, radius = 4.5) {
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#ffe39a'; ctx.fill(); ctx.strokeStyle = '#b68b35'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, radius * .37, 0, Math.PI * 2);
  ctx.fillStyle = '#315d35'; ctx.fill();
}

function cryptoLeaf(ctx, degrees, inward) {
  const [x, y] = arcPoint(525, degrees);
  ctx.save(); ctx.translate(x, y); ctx.rotate(degrees * Math.PI / 180);
  ctx.scale(inward, 1);
  const green = ctx.createLinearGradient(-64, -32, 62, 29);
  green.addColorStop(0, '#8fb94e'); green.addColorStop(.34, '#2f8752');
  green.addColorStop(.68, '#13583b'); green.addColorStop(1, '#0b352c');
  ctx.beginPath(); ctx.moveTo(-66, 3);
  ctx.bezierCurveTo(-42, -40, 25, -43, 68, -3);
  ctx.bezierCurveTo(31, 34, -24, 42, -66, 3); ctx.closePath();
  ctx.fillStyle = '#092e26'; ctx.lineWidth = 7; ctx.strokeStyle = '#102b22'; ctx.stroke();
  ctx.fillStyle = green; ctx.fill(); ctx.strokeStyle = '#ebcf7b'; ctx.lineWidth = 3.2; ctx.stroke();
  // Angular, branching traces and terminal nodes make these branded crypto
  // leaves recognizably different from the previous generic tree drawings.
  line(ctx, [[-64, 3], [-27, 3], [-15, -3], [52, -3]], '#f4d889', 3.3);
  line(ctx, [[-30, 3], [-30, -10], [-15, -23]], '#e6cd7d', 2.6);
  line(ctx, [[-5, -3], [8, -16], [28, -16]], '#e6cd7d', 2.6);
  line(ctx, [[-13, 3], [0, 18], [20, 18]], '#e6cd7d', 2.6);
  line(ctx, [[27, -3], [38, 8]], '#e6cd7d', 2.6);
  for (const [nx, ny] of [[-15, -23], [28, -16], [20, 18], [38, 8]]) node(ctx, nx, ny, 4.3);
  node(ctx, -36, 3, 5.2);
  ctx.restore();
}

function curvedText(ctx, text, { radius, size, direction, secondary = false, maxAngle = 34 }) {
  const family = secondary ? '"Trebuchet MS", Arial, sans-serif' : 'Georgia, "Times New Roman", serif';
  const glyphs = [...text];
  let spacing = secondary ? 1.05 : .7;
  const measure = () => {
    ctx.font = `bold ${size}px ${family}`;
    return glyphs.map(glyph => ctx.measureText(glyph).width);
  };
  let widths = measure();
  let length = widths.reduce((sum, width) => sum + width, 0) + spacing * Math.max(0, glyphs.length - 1);
  const available = radius * maxAngle * 2 * Math.PI / 180;
  if (length > available) {
    const fit = available / length;
    size *= fit; spacing *= fit; widths = measure();
    length = widths.reduce((sum, width) => sum + width, 0) + spacing * Math.max(0, glyphs.length - 1);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = secondary ? '#f6e6b5' : '#fff0c3';
  ctx.strokeStyle = '#18251dcc'; ctx.lineWidth = secondary ? 1.7 : 2.7;
  const bottom = direction === 'bottom';
  let advance = -length / 2;
  for (let index = 0; index < glyphs.length; index++) {
    const angle = (advance + widths[index] / 2) / radius;
    const x = ARC_X + radius * Math.sin(angle);
    const topY = ARC_Y - radius * Math.cos(angle);
    ctx.save(); ctx.translate(x, bottom ? DESIGN_HEIGHT - topY : topY);
    // Mirroring the arc reverses its tangent; the letters themselves remain
    // upright and advance from left to right on both placements.
    ctx.rotate(bottom ? -angle : angle);
    ctx.strokeText(glyphs[index], 0, 0); ctx.fillText(glyphs[index], 0, 0);
    ctx.restore();
    advance += widths[index] + spacing;
  }
}

function ribbonText(ctx, style, direction) {
  const bottom = direction === 'bottom';
  if (style.secondary) {
    curvedText(ctx, style.label, { radius: bottom ? 522 : 524, size: 52, direction });
    curvedText(ctx, style.secondary, { radius: bottom ? 558 : 490, size: 32, direction, secondary: true });
  } else {
    curvedText(ctx, style.label, { radius: bottom ? 548 : 511, size: 60, direction });
  }
}

export function drawRibbon(ctx, id, placement, { direction = 'top' } = {}) {
  const style = RIBBONS.find(ribbon => ribbon.id === id);
  if (!style || !placement) return false;
  const { x, y, w, h } = placement;
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return false;
  ctx.save();
  try {
    ctx.translate(x, y); ctx.scale(w / DESIGN_WIDTH, h / DESIGN_HEIGHT);
    ctx.beginPath(); ctx.rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT); ctx.clip();
    // Canvas stores the transformed path. Restore before clipping so the same
    // exact footprint applies to mirrored artwork and upright bottom text.
    ctx.save();
    if (direction === 'bottom') { ctx.translate(0, DESIGN_HEIGHT); ctx.scale(1, -1); }
    sectorPath(ctx);
    ctx.restore(); ctx.clip();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    ctx.save();
    if (direction === 'bottom') { ctx.translate(0, DESIGN_HEIGHT); ctx.scale(1, -1); }
    ribbonBody(ctx, style);
    cryptoLeaf(ctx, -43, 1); cryptoLeaf(ctx, 43, -1);
    ctx.restore();
    ribbonText(ctx, style, direction);
  } finally {
    ctx.restore();
  }
  return true;
}
