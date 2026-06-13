"use client";

import { BookmarkPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS,
} from "./pro2-image-node-toolbar";

/** LibTV 薄卡 · 选中时顶栏（与图片节点同壳层） */
export function Pro2ThinNodeToolbar({
  onSaveAsAsset,
  className,
  style,
}: {
  onSaveAsAsset?: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (!onSaveAsAsset) return null;
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
      <button type="button" className={PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS} onClick={onSaveAsAsset}>
        <BookmarkPlus className="size-3.5" />
        <span>保存为资产</span>
      </button>
    </div>
  );
}
