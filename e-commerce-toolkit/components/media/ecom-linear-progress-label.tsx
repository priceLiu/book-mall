"use client";

import { cn } from "@/lib/utils";

type Props = {
  /** 0–100；null 为不确定进度 */
  progress?: number | null;
  label?: string;
  className?: string;
};

/** 与 EcomRefUploadCard 上传进度条一致的行内进度展示 */
export function EcomLinearProgressLabel({ progress = null, label, className }: Props) {
  if (progress == null && !label?.trim()) return null;

  return (
    <div className={cn("space-y-1", className)}>
      <div
        className={cn(
          "ecom-upload-progress",
          typeof progress !== "number" && "ecom-upload-progress-indeterminate",
        )}
      >
        <span
          style={
            typeof progress === "number"
              ? { width: `${Math.min(100, Math.max(0, progress))}%` }
              : undefined
          }
        />
      </div>
      {label?.trim() ? (
        <p className="text-[10px] text-[#0071e3]">{label.trim()}</p>
      ) : null}
    </div>
  );
}
