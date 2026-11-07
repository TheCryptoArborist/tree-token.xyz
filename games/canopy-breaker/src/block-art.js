import {TREE_PALETTE,BLOCK_STYLES} from './theme.js';
const BLOCK_ATLAS='/play/canopy-breaker/assets/blocks.png';
// src/block-art.js
function shape(d) {
  if (!cache.has(d)) cache.set(d, new Path2D(d));
  return cache.get(d);
}
function loadBlockArt() {
  if (loading2) return loading2;
  loading2 = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      atlas2 = img;
      resolve();
    };
    img.onerror = () => reject(new Error("The illustrated blocks could not load. Reload to retry."));
    img.src = BLOCK_ATLAS;
  });
  return loading2;
}
function emblemBox(b) {
  const rect = emblems[b.kind % BLOCK_STYLES.length], size = b.h - 1, scale = size / Math.max(rect[2], rect[3]);
  const w = rect[2] * scale, h = rect[3] * scale;
  return { rect, x: (b.w - w) / 2, y: (b.h - h) / 2, w, h };
}
function armor(b) {
  if (b.maxHp <= 1) return [];
  return [
    { d: `M8 3H12V${b.h - 3}H8Q4 ${b.h - 3} 4 ${b.h - 7}V7Q4 3 8 3Z`, fill: TREE_PALETTE.gold, stroke: "#493314", width: 1.3 },
    { d: `M${b.w - 12} 3H${b.w - 8}Q${b.w - 4} 3 ${b.w - 4} 7V${b.h - 7}Q${b.w - 4} ${b.h - 3} ${b.w - 8} ${b.h - 3}H${b.w - 12}Z`, fill: TREE_PALETTE.gold, stroke: "#493314", width: 1.3 }
  ];
}
function drawBlock(c, b) {
  const p = BLOCK_STYLES[b.kind % BLOCK_STYLES.length], w = b.w, h = b.h, face = shape(outline(w, h));
  c.save();
  c.translate(b.x, b.y);
  c.save();
  c.translate(0, 2);
  c.fillStyle = p.deep;
  c.fill(face);
  c.restore();
  const fill = c.createLinearGradient(0, 0, 0, h);
  fill.addColorStop(0, p.light);
  fill.addColorStop(0.45, p.face);
  fill.addColorStop(1, p.base);
  c.fillStyle = fill;
  c.fill(face);
  c.strokeStyle = "#031b23";
  c.lineWidth = 2;
  c.stroke(face);
  c.strokeStyle = p.top;
  c.lineWidth = 2;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(9, 4);
  c.lineTo(w - 9, 4);
  c.stroke();
  const icon = emblemBox(b);
  if (atlas2) {
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    c.drawImage(atlas2, ...icon.rect, icon.x, icon.y, icon.w, icon.h);
  }
  for (const part of armor(b)) {
    c.fillStyle = part.fill;
    c.strokeStyle = part.stroke;
    c.lineWidth = part.width;
    c.fill(shape(part.d));
    c.stroke(shape(part.d));
  }
  if (b.maxHp > 1) for (let i = 0; i < b.maxHp; i++) {
    c.beginPath();
    c.arc(w - 22 + i * 5, h - 6, 1.5, 0, Math.PI * 2);
    c.fillStyle = i < b.hp ? "#fff3be" : "#24332c";
    c.fill();
  }
  if (b.hp < b.maxHp) {
    c.strokeStyle = "#032027";
    c.lineWidth = 2;
    c.stroke(shape(crack(b)));
  }
  c.restore();
}
var emblems, outline, cache, atlas2, loading2, crack;
emblems = [[119, 112, 505, 566], [863, 63, 446, 619], [1551, 45, 518, 649]];
outline = (w, h) => `M7 1H${w - 7}Q${w - 1} 1 ${w - 1} 7V${h - 7}Q${w - 1} ${h - 1} ${w - 7} ${h - 1}H7Q1 ${h - 1} 1 ${h - 7}V7Q1 1 7 1Z`;
cache = /* @__PURE__ */ new Map();
atlas2 = null;
loading2 = null;
crack = (b) => `M${b.w * 0.28} 1L${b.w * 0.23} ${b.h * 0.42}L${b.w * 0.31} ${b.h * 0.59}L${b.w * 0.26} ${b.h - 1}`;
export {loadBlockArt, drawBlock};
