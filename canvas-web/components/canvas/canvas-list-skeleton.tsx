import { CANVAS_LIST_GRID_CLASS } from "@/components/canvas/canvas-list-cover";
import { cn } from "@/lib/utils";

export function CanvasListCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--canvas-border)] bg-[#0F0F0F] p-4">
      <div className="aspect-[340/190] animate-pulse overflow-hidden rounded-xl bg-[#0F0F0F]" />
      <div className="mt-3 space-y-2">
        <div className="h-4 w-3/5 animate-pulse rounded bg-white/[0.06]" />
        <div className="h-3 w-2/5 animate-pulse rounded bg-white/[0.04]" />
      </div>
    </div>
  );
}

/** 单段网格骨架（首屏 / 滚动加载更多复用） */
export function CanvasListGridSkeleton({
  cards = 5,
  gridClassName = CANVAS_LIST_GRID_CLASS,
  className,
}: {
  cards?: number;
  gridClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn(gridClassName, className)} aria-hidden>
      {Array.from({ length: cards }, (_, cardIdx) => (
        <CanvasListCardSkeleton key={cardIdx} />
      ))}
    </div>
  );
}

/** 我的画布列表 · 首屏骨架（与首页最近项目 defer 后展示方式一致） */
export function CanvasListSkeleton({
  sections = 3,
  cardsPerSection = 5,
  className,
  gridClassName,
}: {
  sections?: number;
  cardsPerSection?: number;
  className?: string;
  gridClassName?: string;
}) {
  return (
    <div className={cn("space-y-10", className)}>
      {Array.from({ length: sections }, (_, sectionIdx) => (
        <section key={sectionIdx}>
          <div className="mb-4 h-5 w-36 animate-pulse rounded bg-white/[0.06]" />
          <CanvasListGridSkeleton
            cards={cardsPerSection}
            gridClassName={gridClassName}
          />
        </section>
      ))}
    </div>
  );
}