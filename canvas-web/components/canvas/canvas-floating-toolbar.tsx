"use client";

import type { ReactNode } from "react";

/** 与框选工具条一致的胶囊容器 */
export function CanvasPillToolbar({
  children,
  badge,
  className = "",
}: {
  children: ReactNode;
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-1 rounded-full border border-white/15 bg-[#161618]/95 px-1.5 py-1.5 shadow-xl ${className}`}
    >
      {children}
      {badge}
    </div>
  );
}

export function CanvasToolIcon({
  children,
  label,
  hint,
  danger,
  active,
  disabled,
  onClick,
}: {
  children: ReactNode;
  label: string;
  hint: string;
  danger?: boolean;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      disabled={disabled}
      aria-label={`${label} — ${hint}`}
      className={`group/tooltip relative flex size-9 items-center justify-center rounded-full transition ${
        disabled
          ? "cursor-not-allowed text-white/30"
          : danger
            ? "text-white/85 hover:bg-red-500/20 hover:text-red-200"
            : active
              ? "bg-white/15 text-white"
              : "text-white/85 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-black/95 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition group-hover/tooltip:opacity-100"
      >
        <span className="font-medium">{label}</span>
        <span className="ml-1 text-white/55">· {hint}</span>
      </span>
    </button>
  );
}

export function CanvasToolbarBadge({ children }: { children: ReactNode }) {
  return (
    <span className="ml-0.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/85">
      {children}
    </span>
  );
}
