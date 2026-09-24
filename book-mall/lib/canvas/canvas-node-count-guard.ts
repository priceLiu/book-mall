export function countCanvasGraphNodes(canvas: unknown): number {
  if (!canvas || typeof canvas !== "object") return 0;
  const nodes = (canvas as { nodes?: unknown }).nodes;
  return Array.isArray(nodes) ? nodes.length : 0;
}

export type CanvasNodeCountGuardResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * 拦截「大画布被整图替换成极少节点」类误写（跨项目串写常见 36→6）。
 * 恢复历史 / 用户确认后可通过 allowSuspiciousNodeCountDrop 放行。
 */
export function assertCanvasNodeCountNotSuspiciouslyDropped(input: {
  previousCanvas: unknown;
  nextCanvas: unknown;
  allowSuspiciousNodeCountDrop?: boolean;
}): CanvasNodeCountGuardResult {
  if (input.allowSuspiciousNodeCountDrop) return { ok: true };

  const prev = countCanvasGraphNodes(input.previousCanvas);
  const next = countCanvasGraphNodes(input.nextCanvas);
  if (prev < 12) return { ok: true };
  if (next >= prev * 0.35) return { ok: true };
  if (prev - next < 8) return { ok: true };

  return {
    ok: false,
    message:
      "CANVAS_NODE_COUNT_COLLAPSE: 本次保存节点数相对当前版本骤降过多，已拒绝写入以防误覆盖。若确为恢复历史或清空画布，请确认后重试。",
  };
}
