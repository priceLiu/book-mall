/** 画布顶栏 · 悬停提示（向下展开，避免贴顶时被 overflow 裁切） */

export const CANVAS_TOOLBAR_TOOLTIP_CLASS =
  "pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-[5000] -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#0d0d12] px-2.5 py-1 text-[11px] leading-snug text-white opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.55)] transition-opacity duration-150 group-hover/canvas-tb-tip:opacity-100 group-focus-visible/canvas-tb-tip:opacity-100";

export function canvasToolbarTooltipTitle(label: string, hint?: string): string {
  return hint ? `${label} — ${hint}` : label;
}

export function CanvasToolbarTooltip({
  label,
  hint,
}: {
  label: string;
  hint?: string;
}) {
  return (
    <span role="tooltip" className={CANVAS_TOOLBAR_TOOLTIP_CLASS}>
      {hint ? (
        <>
          <span className="font-medium">{label}</span>
          <span className="ml-1 text-white/55">{hint}</span>
        </>
      ) : (
        label
      )}
    </span>
  );
}
