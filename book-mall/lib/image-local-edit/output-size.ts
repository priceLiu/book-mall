/** 局部编辑输出尺寸 · 对齐 Qwen / wan2.7（512–2048，约 16 对齐） */
export function formatLocalEditOutputSize(width: number, height: number): string {
  const snap = (v: number) => {
    let n = Math.round(Math.max(512, Math.min(2048, v)));
    n = Math.round(n / 16) * 16;
    return Math.max(512, Math.min(2048, n));
  };
  const w = snap(width);
  const h = snap(height);
  return `${w}*${h}`;
}

export function mergeLocalEditOutputSize(
  parameters: Record<string, unknown> | undefined,
  sourceSize?: { width: number; height: number },
): Record<string, unknown> | undefined {
  if (!sourceSize?.width || !sourceSize?.height) return parameters;
  const out = { ...(parameters ?? {}) };
  if (typeof out.size === "string" && out.size.trim()) return out;
  out.size = formatLocalEditOutputSize(sourceSize.width, sourceSize.height);
  return out;
}
