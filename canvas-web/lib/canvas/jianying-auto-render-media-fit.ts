/** 自动成片 · 成片就绪后保留外框，禁止 reset mediaFit 触发 635 缩框 */
export function stripAutoRenderMediaFitReset(
  nodeType: string | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  if (nodeType !== "jianying-auto-render-pro2") return patch;
  const next = { ...patch };
  delete next.mediaFit;
  delete next.mediaFitKey;
  delete next.mediaNaturalW;
  delete next.mediaNaturalH;
  return next;
}
