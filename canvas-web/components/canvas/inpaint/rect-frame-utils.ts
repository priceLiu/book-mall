export type ImageRect = { x1: number; y1: number; x2: number; y2: number };
export type FrameHandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "move";

export function normalizeRect(r: ImageRect): ImageRect {
  return {
    x1: Math.min(r.x1, r.x2),
    y1: Math.min(r.y1, r.y2),
    x2: Math.max(r.x1, r.x2),
    y2: Math.max(r.y1, r.y2),
  };
}

export function pointInRect(
  p: { x: number; y: number },
  r: ImageRect,
  padding = 0,
): boolean {
  const n = normalizeRect(r);
  return (
    p.x >= n.x1 - padding &&
    p.x <= n.x2 + padding &&
    p.y >= n.y1 - padding &&
    p.y <= n.y2 + padding
  );
}

export function hitFrameHandle(
  dp: { x: number; y: number },
  d1: { x: number; y: number },
  d2: { x: number; y: number },
  tol = 16,
): FrameHandleId | null {
  const cx = (d1.x + d2.x) / 2;
  const cy = (d1.y + d2.y) / 2;
  const checks: [FrameHandleId, number, number][] = [
    ["nw", d1.x, d1.y],
    ["ne", d2.x, d1.y],
    ["se", d2.x, d2.y],
    ["sw", d1.x, d2.y],
    ["n", cx, d1.y],
    ["s", cx, d2.y],
    ["e", d2.x, cy],
    ["w", d1.x, cy],
  ];
  for (const [id, hx, hy] of checks) {
    if (Math.abs(dp.x - hx) <= tol && Math.abs(dp.y - hy) <= tol) return id;
  }
  return null;
}

export function clampRectToImage(
  rect: ImageRect,
  natW: number,
  natH: number,
  minSize = 8,
): ImageRect {
  let { x1, y1, x2, y2 } = normalizeRect(rect);
  if (x2 - x1 < minSize) x2 = x1 + minSize;
  if (y2 - y1 < minSize) y2 = y1 + minSize;
  x1 = Math.max(0, x1);
  y1 = Math.max(0, y1);
  x2 = Math.min(natW, x2);
  y2 = Math.min(natH, y2);
  if (x2 - x1 < minSize) x1 = Math.max(0, x2 - minSize);
  if (y2 - y1 < minSize) y1 = Math.max(0, y2 - minSize);
  return { x1, y1, x2, y2 };
}

export function resizeRectByHandle(
  start: ImageRect,
  handle: FrameHandleId,
  ip: { x: number; y: number },
  startPoint: { x: number; y: number },
  natW: number,
  natH: number,
  aspect: number | null,
): ImageRect {
  if (handle === "move") {
    const dx = ip.x - startPoint.x;
    const dy = ip.y - startPoint.y;
    const n = normalizeRect(start);
    const w = n.x2 - n.x1;
    const h = n.y2 - n.y1;
    let x1 = n.x1 + dx;
    let y1 = n.y1 + dy;
    x1 = Math.max(0, Math.min(natW - w, x1));
    y1 = Math.max(0, Math.min(natH - h, y1));
    return { x1, y1, x2: x1 + w, y2: y1 + h };
  }

  const s = normalizeRect(start);
  let x1 = s.x1;
  let y1 = s.y1;
  let x2 = s.x2;
  let y2 = s.y2;

  if (handle.includes("w")) x1 = ip.x;
  if (handle.includes("e")) x2 = ip.x;
  if (handle.includes("n")) y1 = ip.y;
  if (handle.includes("s")) y2 = ip.y;

  let n = normalizeRect({ x1, y1, x2, y2 });

  if (aspect && aspect > 0) {
    const anchorX = handle.includes("w") ? s.x2 : s.x1;
    const anchorY = handle.includes("n") ? s.y2 : s.y1;
    let w = Math.abs(n.x2 - anchorX);
    let h = Math.abs(n.y2 - anchorY);
    if (handle === "n" || handle === "s") {
      w = s.x2 - s.x1;
      h = Math.abs(ip.y - anchorY);
    } else if (handle === "e" || handle === "w") {
      h = s.y2 - s.y1;
      w = Math.abs(ip.x - anchorX);
    }
    if (w / Math.max(h, 1) > aspect) {
      h = w / aspect;
    } else {
      w = h * aspect;
    }
    if (handle.includes("w")) {
      x1 = anchorX - w;
      x2 = anchorX;
    } else {
      x1 = anchorX;
      x2 = anchorX + w;
    }
    if (handle.includes("n")) {
      y1 = anchorY - h;
      y2 = anchorY;
    } else {
      y1 = anchorY;
      y2 = anchorY + h;
    }
    n = normalizeRect({ x1, y1, x2, y2 });
  }

  return clampRectToImage(n, natW, natH);
}
