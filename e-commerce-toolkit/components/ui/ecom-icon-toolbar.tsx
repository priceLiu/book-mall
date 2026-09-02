"use client";

import { cn } from "@/lib/utils";

type ToolbarProps = {
  children: React.ReactNode;
  className?: string;
};

/** 工作区顶栏图标工具条容器 */
export function EcomIconToolbar({ children, className }: ToolbarProps) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      role="toolbar"
      aria-label="工作区操作"
    >
      {children}
    </div>
  );
}

type GroupProps = {
  children: React.ReactNode;
  /** 分组名称（aria-label，悬停分组边框时可读屏识别） */
  label: string;
  className?: string;
};

/** 同类操作分组：项目 / 工作流 / 资产 / 交付 等 */
export function EcomIconToolbarGroup({ children, label, className }: GroupProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-lg border border-[#e8e8ed] bg-[#fafafa] p-0.5",
        className,
      )}
      role="group"
      aria-label={label}
    >
      {children}
    </div>
  );
}
