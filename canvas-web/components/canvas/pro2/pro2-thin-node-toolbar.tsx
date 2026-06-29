"use client";

import { BookmarkPlus, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PRO2_IMAGE_NODE_TOOLBAR_ICON_BTN_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS,
} from "./pro2-image-node-toolbar";

/** LibTV 薄卡 · 选中时浮动工具条（复制 · 保存为资产） */
export function Pro2ThinNodeToolbar({
  onSaveAsAsset,
  onDuplicateNode,
  className,
  style,
}: {
  onSaveAsAsset?: () => void;
  onDuplicateNode?: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (!onSaveAsAsset && !onDuplicateNode) return null;
  return (
    <div
      className={cn(
        PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS,
        "nodrag pointer-events-auto absolute left-1/2 z-40 -translate-x-1/2",
        className,
      )}
      style={style}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {onSaveAsAsset ? (
        <button
          type="button"
          className={PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS}
          onClick={onSaveAsAsset}
        >
          <BookmarkPlus className="size-3.5" />
          <span>保存为资产</span>
        </button>
      ) : null}
      {onDuplicateNode ? (
        <button
          type="button"
          className={PRO2_IMAGE_NODE_TOOLBAR_ICON_BTN_CLASS}
          title="复制节点"
          onClick={onDuplicateNode}
        >
          <Copy className="size-5" />
        </button>
      ) : null}
    </div>
  );
}
