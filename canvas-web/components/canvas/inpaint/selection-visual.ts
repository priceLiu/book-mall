/** 选区统一视觉：棋盘格 + 蓝色描边（笔刷与框选一致，导出仍走 mask 白区） */

export function fillCheckerboard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cell = 8,
) {
  for (let py = 0; py < h; py += cell) {
    for (let px = 0; px < w; px += cell) {
      const alt = (Math.floor(px / cell) + Math.floor(py / cell)) % 2 === 0;
      ctx.fillStyle = alt ? "rgba(255,255,255,0.42)" : "rgba(160,160,160,0.38)";
      ctx.fillRect(
        x + px,
        y + py,
        Math.min(cell, w - px),
        Math.min(cell, h - py),
      );
    }
  }
}

const patternCache = new WeakMap<CanvasRenderingContext2D, CanvasPattern>();

export function checkerboardPattern(
  ctx: CanvasRenderingContext2D,
  cell = 8,
): CanvasPattern {
  const cached = patternCache.get(ctx);
  if (cached) return cached;

  const tile = document.createElement("canvas");
  tile.width = cell * 2;
  tile.height = cell * 2;
  const tctx = tile.getContext("2d");
  if (tctx) {
    tctx.fillStyle = "rgba(255,255,255,0.42)";
    tctx.fillRect(0, 0, cell, cell);
    tctx.fillRect(cell, cell, cell, cell);
    tctx.fillStyle = "rgba(160,160,160,0.38)";
    tctx.fillRect(cell, 0, cell, cell);
    tctx.fillRect(0, cell, cell, cell);
  }
  const pattern = ctx.createPattern(tile, "repeat")!;
  patternCache.set(ctx, pattern);
  return pattern;
}

export const SELECTION_STROKE = "rgba(96, 165, 250, 0.95)";

export function drawCornerHandles(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  size = 7,
) {
  const corners = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ] as const;
  for (const [cx, cy] of corners) {
    ctx.fillStyle = "rgba(12, 12, 14, 0.88)";
    ctx.fillRect(cx - size, cy - size, size * 2, size * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - size, cy - size, size * 2, size * 2);
  }
}
