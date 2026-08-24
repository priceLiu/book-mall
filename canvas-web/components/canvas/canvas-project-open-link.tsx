"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { flushSync } from "react-dom";

import { cn } from "@/lib/utils";

type CanvasProjectOpenLinkProps = {
  projectId: string;
  className?: string;
  children: React.ReactNode;
  openingProjectId: string | null;
  onOpeningProject: (id: string | null) => void;
  onPrefetchProject?: (id: string) => void;
};

/** 项目卡片 → 画布编辑器：pointerdown 即显示加载，避免等路由 chunk 才反馈。 */
export function CanvasProjectOpenLink({
  projectId,
  className,
  children,
  openingProjectId,
  onOpeningProject,
  onPrefetchProject,
}: CanvasProjectOpenLinkProps) {
  const isOpening = openingProjectId === projectId;

  const markOpening = () => {
    if (isOpening) return;
    flushSync(() => {
      onOpeningProject(projectId);
    });
  };

  return (
    <Link
      href={`/canvas/${projectId}`}
      className={cn("relative block", className, isOpening && "pointer-events-none")}
      prefetch
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        onPrefetchProject?.(projectId);
        markOpening();
      }}
      onClick={markOpening}
    >
      {children}
      {isOpening ? (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-[var(--canvas-bg,#0a0a0f)]/85 backdrop-blur-[1px]"
          aria-hidden
        >
          <Loader2 className="size-6 animate-spin text-[var(--canvas-accent,#7c6cff)]" />
          <span className="text-xs font-medium text-[var(--canvas-accent,#7c6cff)]">
            正在打开…
          </span>
        </div>
      ) : null}
    </Link>
  );
}

export function CanvasProjectOpeningOverlay({
  visible,
  label = "正在打开画布…",
}: {
  visible: boolean;
  label?: string;
}) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-3 bg-[var(--canvas-bg,#0a0a0f)]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="size-8 animate-spin text-[var(--canvas-accent,#7c6cff)]" />
      <p className="text-sm text-[var(--canvas-muted,#888)]">{label}</p>
    </div>
  );
}
