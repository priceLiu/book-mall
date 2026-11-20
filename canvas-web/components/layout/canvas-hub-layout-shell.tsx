"use client";

/** 画布 Hub 页 · 子入口已收进顶栏「我的画布」下拉 */
export function CanvasHubLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="canvas-page canvas-page-fill py-6 sm:py-8 lg:py-10">{children}</div>;
}