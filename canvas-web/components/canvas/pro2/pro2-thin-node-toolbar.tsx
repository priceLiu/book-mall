"use client";

import { BookmarkPlus, Copy } from "lucide-react";
import { useStore } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { computeLibtvNodeToolbarTransformScale } from "@/lib/canvas/libtv-node-toolbar-scale";
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
  const zoom = useStore((s) => s.transform[2]);
  const toolbarScale = computeLibtvNodeToolbarTransformScale(zoom);

  if (!onSaveAsAsset && !onDuplicateNode) return null;
  return (
    <div
      className={cn(
        PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS,
        "nodrag pointer-events-auto absolute left-1/2 z-40",
        className,
      )}
      style={{
        ...style,
        transform: `translateX(-50%) scale(${toolbarScale})`,
        transformOrigin: "center bottom",
        transition: "transform 120ms ease",
      }}
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
