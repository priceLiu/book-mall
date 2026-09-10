import { CANVAS_LIST_GRID_CLASS } from "@/components/canvas/canvas-list-cover";
import { cn } from "@/lib/utils";

function CanvasListCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--canvas-border)] bg-[var(--canvas-surface)] p-4">
      <div className="aspect-[340/190] animate-pulse overflow-hidden rounded-xl bg-[var(--canvas-surface-2)]" />
      <div className="mt-3 space-y-2">
        <div className="h-4 w-3/5 animate-pulse rounded bg-white/[0.06]" />
        <div className="h-3 w-2/5 animate-pulse rounded bg-white/[0.04]" />
      </div>
    </div>
  );
}

/** 我的画布列表 · 首屏骨架（与首页最近项目 defer 后展示方式一致） */
export function CanvasListSkeleton({
  sections = 3,
  cardsPerSection = 5,
  className,
}: {
  sections?: number;
  cardsPerSection?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-10", className)}>
      {Array.from({ length: sections }, (_, sectionIdx) => (
        <section key={sectionIdx}>
          <div className="mb-4 h-5 w-36 animate-pulse rounded bg-white/[0.06]" />
          <div className={CANVAS_LIST_GRID_CLASS}>
            {Array.from({ length: cardsPerSection }, (_, cardIdx) => (
              <CanvasListCardSkeleton key={cardIdx} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
