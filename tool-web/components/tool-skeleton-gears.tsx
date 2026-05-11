/**
 * Suspense 骨架用小齿轮组（路径来自 lucide-react Cog，ISC）
 */
function SkelCogSvg({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
      <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
      <path d="M12 2v2" />
      <path d="M12 22v-2" />
      <path d="m17 20.66-1-1.73" />
      <path d="M11 10.27 7 3.34" />
      <path d="m20.66 17-1.73-1" />
      <path d="m3.34 7 1.73 1" />
      <path d="M14 12h8" />
      <path d="M2 12h2" />
      <path d="m20.66 7-1.73 1" />
      <path d="m3.34 17 1.73-1" />
      <path d="m17 3.34-1 1.73" />
      <path d="m11 13.73-4 6.93" />
    </svg>
  );
}

/** 与 book-mall `/tools-open` AiToolsLoader 同款三齿轮咬合布局（缩小版） */
export function ToolSkeletonGearCluster({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "hero";
}) {
  const root =
    variant === "hero" ? "tool-sk-gears tool-sk-gears--hero" : "tool-sk-gears tool-sk-gears--sidebar";

  return (
    <div className={root}>
      <div className="tool-sk-gears-glow" aria-hidden />
      <span className="tool-sk-cog-slot tool-sk-cog-slot--a">
        <SkelCogSvg className="tool-sk-cog-svg tool-sk-cog-svg--cw" />
      </span>
      <span className="tool-sk-cog-slot tool-sk-cog-slot--b">
        <SkelCogSvg className="tool-sk-cog-svg tool-sk-cog-svg--ccw" />
      </span>
      <span className="tool-sk-cog-slot tool-sk-cog-slot--c">
        <SkelCogSvg className="tool-sk-cog-svg tool-sk-cog-svg--slow" />
      </span>
    </div>
  );
}
