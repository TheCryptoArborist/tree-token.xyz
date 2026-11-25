// Badge coordinates are center offsets from (512, 512). These helpers never
// read or update the photograph's crop, rotation, or zoom.
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const positive = (value, fallback) => {
  const number = finite(value, fallback);
  return number > 0 ? number : fallback;
};

export function badgeDimensions(width, height, size, medallion = false) {
  const sourceWidth = positive(width, 1);
  const sourceHeight = positive(height, 1);
  const badgeSize = positive(size, 280);
  if (medallion) return { w: badgeSize, h: badgeSize, size: badgeSize };
  return sourceWidth >= sourceHeight
    ? { w: badgeSize, h: badgeSize * (sourceHeight / sourceWidth), size: badgeSize }
    : { w: badgeSize * (sourceWidth / sourceHeight), h: badgeSize, size: badgeSize };
}

export function defaultBadgePosition({ w, h, lift = 0, radius = 490 }) {
  const width = Math.max(0, finite(w));
  const height = Math.max(0, finite(h));
  const safeRadius = positive(radius, 490);
  // Preserve the existing six-o'clock position, including its 10px margin.
  const bottom = safeRadius * Math.sqrt(Math.max(0, 1 - (width / (2 * safeRadius)) ** 2))
    - 10 - finite(lift);
  return constrainBadgePosition({ x: 0, y: bottom - height / 2, w: width, h: height, radius: safeRadius });
}

export function constrainBadgePosition({ x, y, w, h, medallion = false, radius = 490 }) {
  const requested = { x: finite(x), y: finite(y) };
  const halfWidth = Math.max(0, finite(w)) / 2;
  const halfHeight = Math.max(0, finite(h)) / 2;
  const safeRadius = positive(radius, 490);
  const halfExtent = medallion ? Math.max(halfWidth, halfHeight) : Math.hypot(halfWidth, halfHeight);
  // An oversized badge cannot be made to fit by translation. The UI limits its
  // size; returning the center is a finite fallback for malformed dimensions.
  if (halfExtent >= safeRadius) return { x: 0, y: 0 };

  const fits = medallion
    ? Math.hypot(requested.x, requested.y) + halfExtent <= safeRadius
    : Math.hypot(Math.abs(requested.x) + halfWidth, Math.abs(requested.y) + halfHeight) <= safeRadius;
  if (fits) return requested;

  // Normalize before taking the length so even very large pointer offsets stay
  // finite. Project inward along the requested direction, without axis jumps.
  const largest = Math.max(Math.abs(requested.x), Math.abs(requested.y));
  if (!largest) return { x: 0, y: 0 };
  const length = Math.hypot(requested.x / largest, requested.y / largest);
  const ux = requested.x / largest / length;
  const uy = requested.y / largest / length;
  let distance;
  if (medallion) {
    distance = safeRadius - halfExtent;
  } else {
    // The farthest corner meets the circle when
    // (|ux| * distance + halfWidth)^2 + (|uy| * distance + halfHeight)^2 = radius^2.
    // Solve in radius units and rationalize to avoid subtractive cancellation.
    const aw = halfWidth / safeRadius;
    const ah = halfHeight / safeRadius;
    const b = Math.abs(ux) * aw + Math.abs(uy) * ah;
    const remaining = Math.max(0, 1 - aw * aw - ah * ah);
    distance = safeRadius * remaining / (Math.sqrt(b * b + remaining) + b);
  }
  distance *= 1 - 4 * Number.EPSILON;
  return { x: ux * distance, y: uy * distance };
}
