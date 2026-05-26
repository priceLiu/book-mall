"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { NodeProps } from "@xyflow/react";
import { Loader2, Upload } from "lucide-react";
import Image from "next/image";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { uploadCanvasImage } from "@/lib/canvas-api";
import { useCanvasStore } from "@/lib/canvas/store";
import type { RefImageGridNodeData, RefImageGridSlot } from "@/lib/canvas/types";
import { refGridNodeSize, refGridSlotCount } from "@/lib/canvas/ref-video-models";
import { cn } from "@/lib/utils";
import { NodeShell } from "../node-shell";

const GRID_COLS: Record<number, string> = {
  4: "grid-cols-2",
  6: "grid-cols-3",
  9: "grid-cols-3",
};

const GRID_ROWS: Record<number, string> = {
  4: "grid-rows-2",
  6: "grid-rows-2",
  9: "grid-rows-3",
};

function gridTitle(type: string): string {
  if (type === "ref-grid-4") return "四宫格";
  if (type === "ref-grid-6") return "六宫格";
  return "九宫格";
}

export function RefImageGridNode({ id, data, type, selected }: NodeProps) {
  const base = useBookMallBaseUrl();
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const d = data as unknown as RefImageGridNodeData;
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingSlotRef = useRef(0);

  const slotCount = refGridSlotCount(type ?? "");
  const cols = GRID_COLS[slotCount] ?? "grid-cols-3";
  const rows = GRID_ROWS[slotCount] ?? "grid-rows-2";
  const nodeSize = refGridNodeSize(type ?? "ref-grid-6");

  const slots = useMemo((): RefImageGridSlot[] => {
    const raw = (d.slots ?? []) as RefImageGridSlot[];
    if (raw.length >= slotCount) return raw.slice(0, slotCount);
    return [
      ...raw,
      ...Array.from({ length: slotCount - raw.length }, () => ({})),
    ];
  }, [d.slots, slotCount]);

  const filledCount = slots.filter((s) => s.ossUrl || s.blobUrl).length;

  const uploadToSlot = useCallback(
    async (slotIndex: number, file: File) => {
      const blobUrl = URL.createObjectURL(file);
      const next = [...slots];
      next[slotIndex] = {
        ...next[slotIndex],
        blobUrl,
        ossUrl: undefined,
        uploading: true,
        uploadError: undefined,
      };
      updateNodeData(id, { slots: next, activeSlotIndex: slotIndex });
      try {
        const ossUrl = await uploadCanvasImage(base, file);
        const after = [...(useCanvasStore.getState().nodes.find((n) => n.id === id)?.data as RefImageGridNodeData).slots ?? slots];
        after[slotIndex] = {
          ...after[slotIndex],
          ossUrl,
          uploading: false,
        };
        updateNodeData(id, { slots: after });
      } catch (e) {
        const after = [...slots];
        after[slotIndex] = {
          ...after[slotIndex],
          uploading: false,
          uploadError: e instanceof Error ? e.message : String(e),
        };
        updateNodeData(id, { slots: after });
      }
    },
    [base, id, slots, updateNodeData],
  );

  const onPickSlot = (idx: number) => {
    pendingSlotRef.current = idx;
    updateNodeData(id, { activeSlotIndex: idx });
    inputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void uploadToSlot(pendingSlotRef.current, file);
  };

  const onDropSlot = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      void uploadToSlot(idx, file);
    }
  };

  useEffect(() => {
    if (!selected) return;
    const onPaste = (e: ClipboardEvent) => {
      const dt = e.clipboardData;
      if (!dt) return;
      let file: File | null = null;
      for (const f of Array.from(dt.files)) {
        if (f.type.startsWith("image/")) {
          file = f;
          break;
        }
      }
      if (!file) return;
      const idx =
        typeof d.activeSlotIndex === "number" ? d.activeSlotIndex : 0;
      e.preventDefault();
      void uploadToSlot(idx, file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [selected, d.activeSlotIndex, uploadToSlot]);

  return (
    <NodeShell
      title={gridTitle(type ?? "")}
      subtitle={`${filledCount}/${slotCount} · 点击 / 拖入 / 粘贴`}
      selected={selected}
      minWidth={nodeSize.width}
      minHeight={nodeSize.height}
      outputs={[{ id: "out_refs", label: "参考图", kind: "image" }]}
      footer={
        <span className="text-[10px] text-[var(--canvas-muted)]">
          仅图片 · 同格覆盖保留最新
        </span>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />
      <div className={cn("grid min-h-0 flex-1 gap-4", cols, rows)}>
        {slots.map((slot, idx) => {
          const url = slot.ossUrl ?? slot.blobUrl;
          const isActive = d.activeSlotIndex === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onPickSlot(idx)}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => onDropSlot(idx, e)}
              className={cn(
                "relative min-h-0 min-w-0 overflow-hidden rounded-lg border border-dashed transition",
                isActive
                  ? "border-[var(--canvas-accent)] bg-white/[0.06]"
                  : "border-white/25 bg-black/30 hover:border-white/40 hover:bg-white/[0.04]",
              )}
              aria-label={`格 ${idx + 1} 上传图片`}
            >
              {slot.uploading ? (
                <span className="flex size-full items-center justify-center">
                  <Loader2 className="size-14 animate-spin text-white/50" />
                </span>
              ) : url ? (
                <Image
                  src={url}
                  alt={`参考 ${idx + 1}`}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <span className="flex size-full items-center justify-center text-white/50">
                  <span className="grid size-[5.5rem] place-items-center rounded-full border border-dashed border-white/30 bg-white/[0.06]">
                    <Upload className="size-10" strokeWidth={1.75} />
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </NodeShell>
  );
}
