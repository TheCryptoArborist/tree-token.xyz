import {TREE_PALETTE} from './theme.js';
const PICKUP_ATLAS='/play/canopy-breaker/assets/pickups.png';
// src/pickup-art.js
function loadPickupArt() {
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      atlas = img;
      resolve();
    };
    img.onerror = () => reject(new Error("The illustrated power-ups could not load. Reload to retry."));
    img.src = PICKUP_ATLAS;
  });
  return loading;
}
function drawPickup(c, type, x, y, { size = 68, time = 0, motion: motion2 = true } = {}) {
  const art = PICKUP_ART[type];
  if (!art || !atlas) return;
  const [sx, sy, sw, sh] = art.rect, scale = size / Math.max(sw, sh), w = sw * scale, h = sh * scale;
  c.save();
  c.translate(x, y);
  if (motion2) c.rotate(Math.sin(time * 2.3 + x * 0.01) * 0.055);
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = "high";
  c.drawImage(atlas, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
  c.restore();
}
function pickupIcon(type, { size = 48, label = null } = {}) {
  const art = PICKUP_ART[type];
  if (!art) return null;
  const ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg"), img = document.createElementNS(ns, "image");
  const [x, y, w, h] = art.rect, side = Math.max(w, h);
  svg.setAttribute("viewBox", `${x - (side - w) / 2} ${y - (side - h) / 2} ${side} ${side}`);
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("focusable", "false");
  svg.classList.add("pickup-icon");
  svg.style.overflow = "hidden";
  if (label) {
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", label);
  } else svg.setAttribute("aria-hidden", "true");
  const crop = document.createElementNS(ns, "svg");
  for (const [key, value] of Object.entries({ x, y, width: w, height: h, viewBox: `${x} ${y} ${w} ${h}`, overflow: "hidden" })) crop.setAttribute(key, value);
  img.setAttribute("href", PICKUP_ATLAS);
  img.setAttribute("width", "1774");
  img.setAttribute("height", "887");
  crop.append(img);
  svg.append(crop);
  return svg;
}
var PICKUP_ART, atlas, loading;
PICKUP_ART = {
  wide: { color: TREE_PALETTE.emerald, rect: [18, 126, 410, 263] },
  tether: { color: TREE_PALETTE.teal, rect: [496, 103, 339, 316] },
  hot: { color: TREE_PALETTE.gold, rect: [948, 24, 328, 406] },
  laser: { color: TREE_PALETTE.cyan, rect: [1342, 109, 415, 281] },
  multi: { color: TREE_PALETTE.emerald, rect: [44, 481, 359, 375] },
  fast: { color: TREE_PALETTE.amber, rect: [512, 487, 315, 367] },
  slow: { color: TREE_PALETTE.amber, rect: [913, 538, 373, 279] },
  wild: { color: "#b194ff", rect: [1364, 479, 375, 365] }
};
atlas = null;
loading = null;
export {PICKUP_ART, loadPickupArt, drawPickup, pickupIcon};
