import { Loader2 } from "lucide-react";

export default function CanvasProjectLoading() {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-3 bg-[var(--canvas-bg,#0a0a0f)] text-[var(--canvas-muted,#888)]">
      <Loader2 className="size-8 animate-spin text-[var(--canvas-accent,#7c6cff)]" />
      <p className="text-sm">加载画布…</p>
    </div>
  );
}
