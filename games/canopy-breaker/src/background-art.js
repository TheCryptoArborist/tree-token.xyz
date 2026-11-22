const background_gateway_default='/play/canopy-breaker/assets/gateway.png';
const background_worlds_default='/play/canopy-breaker/assets/worlds.png';
// src/background-art.js
function loadBackgroundArt() {
  if (loading3) return loading3;
  loading3 = Promise.all(Object.entries(sources).map(([key, src]) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      images.set(key, img);
      resolve();
    };
    img.onerror = () => reject(new Error("The world artwork could not load. Reload to retry."));
    img.src = src;
  })));
  return loading3;
}
function sourceRect(index) {
  const view = BACKGROUND_VIEWS[index];
  if (!view) throw new RangeError("Unknown world background");
  let [x, y, w, h] = view.rect;
  if (w / h > 8 / 9) {
    const width = h * 8 / 9;
    x += (w - width) / 2;
    w = width;
  } else {
    const height = w * 9 / 8;
    y += (h - height) / 2;
    h = height;
  }
  return { source: view.source, rect: [x, y, w, h] };
}
function drawBackground(c, index, { time = 0, motion: motion2 = true } = {}) {
  const view = sourceRect(index), img = images.get(view.source);
  c.save();
  c.fillStyle = "#030810";
  c.fillRect(0, 0, 800, 900);
  if (img) {
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    c.drawImage(img, ...view.rect, 0, 0, 800, 900);
  }
  c.fillStyle = "#02071026";
  c.fillRect(0, 0, 800, 900);
  const header = c.createLinearGradient(0, 0, 0, 115);
  header.addColorStop(0, "#020710e6");
  header.addColorStop(1, "#02071000");
  c.fillStyle = header;
  c.fillRect(0, 0, 800, 115);
  const floor = c.createLinearGradient(0, 790, 0, 900);
  floor.addColorStop(0, "#02071000");
  floor.addColorStop(1, "#02071080");
  c.fillStyle = floor;
  c.fillRect(0, 790, 800, 110);
  c.strokeStyle = "#74e8da5c";
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(18, 94);
  c.lineTo(18, 864);
  c.moveTo(782, 94);
  c.lineTo(782, 864);
  c.stroke();
  const t = motion2 ? time : 0;
  for (let i = 0; i < 12; i++) {
    const x = i % 2 ? 725 + i * 13 % 46 : 28 + i * 13 % 46, y = 140 + i * 71 % 630;
    c.globalAlpha = 0.08 + (Math.sin(t * 0.6 + i) * 0.5 + 0.5) * 0.14;
    c.fillStyle = index === 2 ? "#ffe05e" : index === 4 ? "#d995ff" : "#53e8d8";
    c.beginPath();
    c.arc(x + Math.sin(t * 0.25 + i) * 3, y + Math.cos(t * 0.3 + i) * 4, 1.1, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}
var sources, images, BACKGROUND_VIEWS, loading3;
sources = { gateway: background_gateway_default, worlds: background_worlds_default };
images = /* @__PURE__ */ new Map();
BACKGROUND_VIEWS = [
  { source: "gateway", rect: [0, 0, 1182, 1330] },
  { source: "worlds", rect: [8, 8, 575, 610] },
  { source: "worlds", rect: [600, 8, 574, 610] },
  { source: "worlds", rect: [8, 671, 575, 607] },
  { source: "worlds", rect: [600, 671, 574, 607] }
];
loading3 = null;
export {BACKGROUND_VIEWS, loadBackgroundArt, sourceRect, drawBackground};
