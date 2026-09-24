"use client";

import { Brush, Eraser, Grid3x3, SquareDashed, Undo2, XCircle } from "lucide-react";

import { EcomIconButton } from "@/components/ui/ecom-icon-button";
import { EcomIconToolbar, EcomIconToolbarGroup } from "@/components/ui/ecom-icon-toolbar";
import type {
  ImageLayerCanvasToolMode,
  ImageLayerSelectionSubTool,
} from "@/lib/image-layer-tool-mode";
import { cn } from "@/lib/utils";

type Props = {
  toolMode: ImageLayerCanvasToolMode;
  selectionSubTool: ImageLayerSelectionSubTool;
  brushSize: number;
  showTransparentMask: boolean;
  pendingBboxCount?: number;
  busy?: boolean;
  onSelectionSubToolChange: (tool: ImageLayerSelectionSubTool) => void;
  onBrushSizeChange: (size: number) => void;
  onToggleTransparentMask: () => void;
  onClearSelection: () => void;
  onUndoBbox?: () => void;
  /** 万相 2.7 等仅支持框选时隐藏笔刷 / 橡皮 */
  hideBrushToggle?: boolean;
  /** 右栏局部编辑：更紧凑间距、省略重复提示 */
  compact?: boolean;
};

export function ImageLayerSelectionTools({
  toolMode,
  selectionSubTool,
  brushSize,
  showTransparentMask,
  pendingBboxCount = 0,
  busy = false,
  onSelectionSubToolChange,
  onBrushSizeChange,
  onToggleTransparentMask,
  onClearSelection,
  onUndoBbox,
  hideBrushToggle = false,
  compact = false,
}: Props) {
  const usesMaskBrush =
    toolMode === "erase" ||
    (toolMode === "retouch" &&
      (selectionSubTool === "brush" || selectionSubTool === "eraser") &&
      !hideBrushToggle);
  const showSubToolToggle =
    (toolMode === "erase" || toolMode === "retouch") && !hideBrushToggle;
  const showMaskPreviewToggle = usesMaskBrush;

  return (
    <div className={cn(compact ? "space-y-2" : "space-y-3")}>
      {showSubToolToggle ? (
        <EcomIconToolbar>
          <EcomIconToolbarGroup label="选区工具">
            <EcomIconButton
              label="笔刷涂抹"
              icon={Brush}
              variant={selectionSubTool === "brush" ? "accent" : "default"}
              disabled={busy}
              onClick={() => onSelectionSubToolChange("brush")}
            />
            <EcomIconButton
              label="橡皮擦"
              icon={Eraser}
              variant={selectionSubTool === "eraser" ? "accent" : "default"}
              disabled={busy}
              onClick={() => onSelectionSubToolChange("eraser")}
            />
            <EcomIconButton
              label="框选区域"
              icon={SquareDashed}
              variant={selectionSubTool === "bbox" ? "accent" : "default"}
              disabled={busy}
              onClick={() => onSelectionSubToolChange("bbox")}
            />
            {showMaskPreviewToggle ? (
              <EcomIconButton
                label="透明蒙版预览"
                icon={Grid3x3}
                variant={showTransparentMask ? "accent" : "default"}
                disabled={busy}
                onClick={onToggleTransparentMask}
              />
            ) : null}
            <EcomIconButton
              label="清除选区"
              icon={XCircle}
              disabled={busy}
              onClick={onClearSelection}
            />
          </EcomIconToolbarGroup>
        </EcomIconToolbar>
      ) : null}

      {usesMaskBrush ? (
        <div
          className={cn(
            "rounded-lg border border-[#e5e7eb] bg-[#fafafa]",
            compact ? "px-2.5 py-2" : "px-3 py-3",
          )}
        >
          <label className="flex items-center gap-3">
            {selectionSubTool === "eraser" ? (
              <Eraser className="h-4 w-4 shrink-0 text-[#6b7280]" aria-hidden />
            ) : (
              <Brush className="h-4 w-4 shrink-0 text-[#6b7280]" aria-hidden />
            )}
            <input
              type="range"
              min={8}
              max={80}
              value={brushSize}
              disabled={busy}
              onChange={(e) => onBrushSizeChange(Number(e.target.value))}
              className="h-1.5 flex-1 accent-[#2563eb]"
              aria-label={selectionSubTool === "eraser" ? "橡皮擦大小" : "笔触大小"}
            />
            <span className="w-8 text-right text-xs tabular-nums text-[#6b7280]">
              {brushSize}
            </span>
          </label>
        </div>
      ) : null}

      {toolMode === "decompose-bbox" ? (
        <div className="space-y-2">
          <p className="text-xs text-[#6b7280]">
            在画布上连续框选最多 16 个拆分区域，无需填写提示词。
          </p>
          <p className="text-xs font-medium text-[#374151]">
            已框选 {pendingBboxCount} 个区域
          </p>
          <EcomIconToolbar>
            <EcomIconToolbarGroup label="框选">
              <EcomIconButton
                label="撤销上一框"
                icon={Undo2}
                disabled={busy || pendingBboxCount === 0}
                onClick={() => onUndoBbox?.()}
              />
              <EcomIconButton
                label="清除全部框"
                icon={XCircle}
                disabled={busy || pendingBboxCount === 0}
                onClick={onClearSelection}
              />
            </EcomIconToolbarGroup>
          </EcomIconToolbar>
        </div>
      ) : null}

      {!compact && toolMode === "erase" && selectionSubTool === "bbox" ? (
        <p className="text-xs text-[#6b7280]">
          框选需要擦除的区域；其余画面保持不变，将自动补全背景。
        </p>
      ) : null}

      {!compact && toolMode === "erase" && selectionSubTool === "brush" ? (
        <p className="text-xs text-[#6b7280]">
          涂抹需要擦除的区域；其余画面保持不变，将自动补全背景。
        </p>
      ) : null}

      {!compact && toolMode === "retouch" && selectionSubTool === "bbox" ? (
        <p className="text-xs text-[#6b7280]">
          框选需要重绘的区域，并在下方描述替换内容。
        </p>
      ) : null}

      {!compact && toolMode === "retouch" && selectionSubTool === "brush" ? (
        <p className="text-xs text-[#6b7280]">
          涂抹需要修改的区域，并在下方描述替换内容。
        </p>
      ) : null}

      {!compact &&
      (toolMode === "erase" || toolMode === "retouch") &&
      selectionSubTool === "eraser" ? (
        <p className="text-xs text-[#6b7280]">
          用橡皮擦修正涂抹选区；透明蒙版预览可查看实际选区范围。
        </p>
      ) : null}
    </div>
  );
}
