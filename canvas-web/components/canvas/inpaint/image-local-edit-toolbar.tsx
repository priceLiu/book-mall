"use client";

import {
  Eraser,
  Paintbrush,
  Redo2,
  Square,
  Undo2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RF_NO_DRAG, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import type { LibtvInpaintTool } from "@/lib/canvas/libtv-inpaint-session";

type Props = {
  variant?: "inpaint" | "erase";
  tool: LibtvInpaintTool;
  brushSize: number;
  modelKey: string;
  canUndo: boolean;
  canRedo: boolean;
  onToolChange: (tool: LibtvInpaintTool) => void;
  onBrushSizeChange: (size: number) => void;
  onModelChange: (modelKey: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClose: () => void;
  className?: string;
};

function ToolBtn({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg border transition-colors",
        RF_NO_DRAG,
        RF_NO_WHEEL,
        "nopan",
        active
          ? "border-violet-400/60 bg-violet-500/20 text-violet-200"
          : "border-white/10 bg-black/40 text-white/70 hover:bg-white/10",
        disabled && "pointer-events-none opacity-30",
      )}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      {children}
    </button>
  );
}

export function ImageLocalEditToolbar({
  variant = "inpaint",
  tool,
  brushSize,
  modelKey: _modelKey,
  canUndo,
  canRedo,
  onToolChange,
  onBrushSizeChange,
  onModelChange: _onModelChange,
  onUndo,
  onRedo,
  onClose,
  className,
}: Props) {
  const isErase = variant === "erase";

  return (
    <div
      data-libtv-toolbar-interactive
      className={cn(
        "libtv-inpaint-toolbar nodrag nopan nowheel pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/70 px-2 py-1.5 backdrop-blur-md",
        className,
      )}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        title={isErase ? "关闭擦除" : "关闭重绘"}
        className={cn(
          "flex size-8 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-white/70 transition-colors hover:bg-white/10",
          RF_NO_DRAG,
          RF_NO_WHEEL,
          "nopan",
        )}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
      >
        <X className="size-4 pointer-events-none" />
      </button>
      <div className="mx-1 h-5 w-px bg-white/15" />
      <ToolBtn
        active={tool === "brush"}
        onClick={() => onToolChange("brush")}
        title="笔刷"
      >
        <Paintbrush className="size-4" />
      </ToolBtn>
      <ToolBtn
        active={tool === "eraser"}
        onClick={() => onToolChange("eraser")}
        title="橡皮"
      >
        <Eraser className="size-4" />
      </ToolBtn>
      <input
        type="range"
        min={8}
        max={64}
        value={brushSize}
        onChange={(e) => onBrushSizeChange(Number(e.target.value))}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        className="nodrag w-20 accent-violet-400"
        title="笔刷粗细"
      />
      <ToolBtn
        active={tool === "rect"}
        onClick={() => onToolChange("rect")}
        title="框选"
      >
        <Square className="size-4" />
      </ToolBtn>
      <div className="mx-1 h-5 w-px bg-white/15" />
      <ToolBtn disabled={!canUndo} onClick={onUndo} title="撤销">
        <Undo2 className="size-4" />
      </ToolBtn>
      <ToolBtn disabled={!canRedo} onClick={onRedo} title="重做">
        <Redo2 className="size-4" />
      </ToolBtn>
    </div>
  );
}
