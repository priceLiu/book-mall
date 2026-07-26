"use client";

import { useState } from "react";
import {
  ChevronDown,
  CornerDownLeft,
  Expand,
  ImageUpscale,
  Scan,
} from "lucide-react";
import { useStore } from "@xyflow/react";
import { computeLibtvNodeToolbarTransformScale } from "@/lib/canvas/libtv-node-toolbar-scale";
import {
  LIBTV_GRID_HD_SCALE_OPTIONS,
  type LibtvGridHdScaleId,
} from "@/lib/canvas/libtv-grid-split-hd";
import { useLibtvToolbarPortaled } from "@/components/canvas/libtv-node-toolbar-portal";
import {
  PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS,
} from "./pro2-image-node-toolbar";
import {
  Pro2ToolbarDropdownItem,
  Pro2ToolbarDropdownMenu,
  usePro2ToolbarDropdownAnchor,
} from "./pro2-toolbar-dropdown-menu";
import { cn } from "@/lib/utils";

const TOOL_BTN = PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS;

export function Pro2ImageGridSplitToolbar({
  selectedCount,
  onCancel,
  onExpandImage,
  onCreateFrameGroup,
  onGenerateHd,
  passNodeDrag = false,
  className,
  style,
}: {
  selectedCount: number;
  onCancel: () => void;
  onExpandImage: () => void;
  onCreateFrameGroup: () => void;
  onGenerateHd: (scaleId: LibtvGridHdScaleId) => void;
  passNodeDrag?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const hdMenu = usePro2ToolbarDropdownAnchor();
  const [hdScale, setHdScale] = useState<LibtvGridHdScaleId>("2");
  const zoom = useStore((s) => s.transform[2]);
  const portaled = useLibtvToolbarPortaled();
  const toolbarScale = portaled
    ? 1
    : computeLibtvNodeToolbarTransformScale(zoom);
  const effectivePassNodeDrag = portaled ? false : passNodeDrag;

  const hdLabel =
    LIBTV_GRID_HD_SCALE_OPTIONS.find((o) => o.id === hdScale)?.label ?? "2倍";

  return (
    <>
      <div
        className={cn(
          PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS,
          effectivePassNodeDrag
            ? "pointer-events-none [&_button]:pointer-events-auto"
            : "nodrag pointer-events-auto",
          !portaled && !style && "absolute left-1/2 z-30",
          className,
        )}
        style={
          portaled
            ? style
            : {
                ...style,
                transform: `translateX(-50%) scale(${toolbarScale})`,
                transformOrigin: "center bottom",
                transition: "transform 120ms ease",
              }
        }
        {...(effectivePassNodeDrag
          ? {}
          : {
              onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
              onClick: (e: React.MouseEvent) => e.stopPropagation(),
            })}
      >
        <button
          type="button"
          className={TOOL_BTN}
          title="取消宫格切分 (Esc)"
          onClick={onCancel}
        >
          <CornerDownLeft className="size-3.5" />
        </button>

        {selectedCount > 0 ? (
          <>
            <div className={PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS} />
            <span className="nodrag shrink-0 rounded-full bg-violet-500/20 px-2.5 py-1 text-[13px] font-medium tabular-nums text-violet-100">
              已选 {selectedCount}
            </span>
          </>
        ) : null}

        <div className={PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS} />

        <button
          type="button"
          className={TOOL_BTN}
          disabled={selectedCount === 0}
          onClick={onExpandImage}
        >
          <Expand className="size-3.5" />
          <span>扩图</span>
        </button>

        <button
          type="button"
          className={TOOL_BTN}
          disabled={selectedCount === 0}
          onClick={onCreateFrameGroup}
        >
          <Scan className="size-3.5" />
          <span>创建分镜组</span>
        </button>

        <button
          type="button"
          ref={hdMenu.anchorRef}
          className={TOOL_BTN}
          disabled={selectedCount === 0}
          onClick={() => hdMenu.setOpen(!hdMenu.open)}
        >
          <ImageUpscale className="size-3.5" />
          <span>生成高清图片</span>
          <span className="text-white/45">{hdLabel}</span>
          <ChevronDown className="size-3 opacity-50" />
        </button>
      </div>

      <Pro2ToolbarDropdownMenu
        open={hdMenu.open}
        setOpen={hdMenu.setOpen}
        rect={hdMenu.rect}
        minWidth={120}
      >
        {LIBTV_GRID_HD_SCALE_OPTIONS.map((opt) => (
          <Pro2ToolbarDropdownItem
            key={opt.id}
            icon={ImageUpscale}
            label={opt.label}
            onClick={() => {
              setHdScale(opt.id);
              hdMenu.setOpen(false);
              onGenerateHd(opt.id);
            }}
          />
        ))}
      </Pro2ToolbarDropdownMenu>
    </>
  );
}
