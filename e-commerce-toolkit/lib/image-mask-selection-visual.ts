/** 选区涂抹 · 棋盘格预览（与 canvas-web selection-visual 一致） */

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

export const MASK_OVERLAY_SOLID = "rgba(34, 197, 94, 0.75)";
