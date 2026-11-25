// Photo placement uses the frame's visible opening, not its outer canvas.
export const PHOTO_CENTER = 512;
export const PHOTO_DIAMETER = 992;

export function photoDimensions(width, height, rotation = 0) {
  return Math.abs(rotation % 180) === 90
    ? { width: height, height: width }
    : { width, height };
}

export function photoFillScale(width, height, rotation = 0) {
  const size = photoDimensions(width, height, rotation);
  return PHOTO_DIAMETER / Math.min(size.width, size.height);
}

// All four image corners must fit inside the circle AND above the badge.
// A rectangular "contain" fit alone still crops a square photo's corners.
export function fitFullPhoto({ width, height, rotation = 0, radius = 449, badgeTop = null }) {
  const size = photoDimensions(width, height, rotation);
  const safeRadius = Math.max(1, radius - 4);
  const bottom = badgeTop == null ? safeRadius : badgeTop - PHOTO_CENTER - 12;
  let low = 0;
  let high = safeRadius * 2 / Math.hypot(size.width, size.height);
  for (let i = 0; i < 40; i++) {
    const scale = (low + high) / 2;
    const halfWidth = size.width * scale / 2;
    const halfHeight = size.height * scale / 2;
    const verticalRoom = Math.sqrt(Math.max(0, safeRadius ** 2 - halfWidth ** 2)) - halfHeight;
    if (halfHeight - verticalRoom <= bottom) low = scale;
    else high = scale;
  }
  const y = Math.min(0, bottom - size.height * low / 2);
  return { zoom: low / photoFillScale(width, height, rotation), x: 0, y };
}

export function photoPanLimits({ width, height, rotation = 0, zoom = 1 }) {
  const size = photoDimensions(width, height, rotation);
  const scale = photoFillScale(width, height, rotation) * zoom;
  return {
    x: Math.max(512, (size.width * scale - PHOTO_DIAMETER) / 2 + 128),
    y: Math.max(512, (size.height * scale - PHOTO_DIAMETER) / 2 + 128),
  };
}

export function frameOpeningRadius(image) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, 1024, 1024);
  const pixels = context.getImageData(0, 0, 1024, 1024).data;
  let opening = 449;
  for (let step = 0; step < 180; step++) {
    const angle = step * Math.PI / 90;
    for (let radius = 128; radius < 496; radius++) {
      const x = Math.round(PHOTO_CENTER + Math.cos(angle) * radius);
      const y = Math.round(PHOTO_CENTER + Math.sin(angle) * radius);
      if (pixels[(y * 1024 + x) * 4 + 3] >= 160) {
        opening = Math.min(opening, radius - 6);
        break;
      }
    }
  }
  return opening;
}

// Match the empty space to the photo's edges. This keeps a fitted photo opaque
// inside the frame without stretching the portrait or changing corner alpha.
export function photoBackdropColors(image, rotation = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.fillStyle = '#143c2a';
  context.fillRect(0, 0, 32, 32);
  context.translate(16, 16);
  context.rotate(rotation * Math.PI / 180);
  context.drawImage(image, -16, -16, 32, 32);
  const pixels = context.getImageData(0, 0, 32, 32).data;
  return [0, 8, 16, 24, 31].map(y => {
    const color = [0, 0, 0];
    for (const x of [0, 1, 30, 31]) {
      for (let channel = 0; channel < 3; channel++) color[channel] += pixels[(y * 32 + x) * 4 + channel] / 4;
    }
    return `rgb(${color.map(Math.round).join(',')})`;
  });
}
