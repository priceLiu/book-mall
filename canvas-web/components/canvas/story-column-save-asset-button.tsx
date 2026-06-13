"use client";

import { BookmarkPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS,
} from "./pro2/pro2-image-node-toolbar";

/** Story-Pro 1.0 列节点 · 「保存为资产」（与 LibTV 顶栏同壳层） */
export function StoryColumnSaveAssetButton({
  onClick,
  disabled,
  className,
  compact,
}: {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  /** 嵌入引擎条窄列 */
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS,
        "nodrag pointer-events-auto shrink-0",
        className,
      )}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS}
        disabled={disabled}
        title="保存整列为项目资产"
        onClick={onClick}
      >
        <BookmarkPlus className="size-3.5" />
        {compact ? null : <span>保存为资产</span>}
      </button>
    </div>
  );
}
