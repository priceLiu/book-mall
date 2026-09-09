"use client";

import { useCallback, useRef, type Ref } from "react";
import { Plus, X } from "lucide-react";

import { EcomRefImageThumb } from "@/components/media/ecom-ref-image-thumb";
import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { useImageDropPaste } from "@/hooks/use-image-drop-paste";
import {
  VTON_BOTTOM_GARMENT_SCOPE,
  VTON_TOP_GARMENT_SCOPE,
  type VtonGarmentItem,
} from "@/lib/vton-types";
import {
  fullSetGarmentDisplayLabel,
  isFullSetGarmentReady,
  type VtonFullSetUploadSlot,
} from "@/lib/vton-full-set-garment";
import { cn } from "@/lib/utils";

export const VTON_GARMENT_PIECE_SLOT_SIZE = 72;

type ManualSlot = Exclude<VtonFullSetUploadSlot, "composite">;

function PieceSlot({
  label,
  url,
  emptyLabel,
  busy,
  disabled,
  parsing,
  onPickFile,
  onUploadFile,
  onOpenAssets,
  onPreview,
}: {
  label: string;
  url?: string;
  emptyLabel: string;
  busy?: boolean;
  disabled?: boolean;
  parsing?: boolean;
  onPickFile: () => void;
  /** 有值且槽位为空时启用拖放 / 粘贴 */
  onUploadFile?: (file: File) => void;
  onOpenAssets?: () => void;
  onPreview?: () => void;
}) {
  const size = VTON_GARMENT_PIECE_SLOT_SIZE;
  const canUpload = !url && !busy && !disabled && !parsing && Boolean(onUploadFile);
  const { dragOver, focusZone, dropZoneProps } = useImageDropPaste({
    enabled: canUpload,
    multiple: false,
    onFiles: (files) => {
      if (files[0] && onUploadFile) onUploadFile(files[0]);
    },
  });

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <span className="max-w-full truncate text-[10px] font-medium text-[#6e6e73]">{label}</span>
      {url ? (
        <div className="relative">
          <EcomRefImageThumb
            src={url}
            alt={label}
            size={size}
            onPreview={onPreview}
            className={cn(onPreview && "cursor-zoom-in")}
          />
          {parsing ? (
            <div className="absolute inset-0 overflow-hidden rounded-md">
              <EcomMediaGeneratingBusy
                label="分割中"
                className="rounded-md"
                background="light"
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div
          {...(canUpload ? dropZoneProps : {})}
          className={cn(
            "rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/30",
            dragOver && "ring-1 ring-[#0071e3]/30",
          )}
        >
          <button
            type="button"
            disabled={busy || disabled || parsing}
            onClick={() => {
              if (canUpload) focusZone();
              onPickFile();
            }}
            className={cn(
              "flex flex-col items-center justify-center rounded-md border border-dashed bg-white text-[#86868b] transition hover:border-[#0071e3]/50 hover:text-[#0071e3] disabled:opacity-50",
              dragOver ? "border-[#0071e3] bg-white" : "border-[#c7c7cc]",
            )}
            style={{ width: size, height: size }}
            title={emptyLabel}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      )}
      <div className="flex h-4 items-center justify-center">
        {onOpenAssets ? (
          <button
            type="button"
            className="text-[9px] text-[#0071e3] hover:underline disabled:opacity-50"
            disabled={busy || disabled || parsing}
            onClick={() => {
              if (canUpload) focusZone();
              onOpenAssets();
            }}
          >
            资产
          </button>
        ) : (
          <span className="invisible text-[9px]" aria-hidden>
            资产
          </span>
        )}
      </div>
    </div>
  );
}

function bindFileInput(ref: Ref<HTMLInputElement>, onFile: (file: File) => void) {
  return (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) onFile(file);
      }}
    />
  );
}

/** 整图套装 · 展示原图 + 分割后的上装 / 下装双槽 */
export function VtonCompositeFullSetCard({
  garment,
  index,
  busy,
  disabled,
  onRemove,
  onPreview,
}: {
  garment: VtonGarmentItem;
  index: number;
  busy?: boolean;
  disabled?: boolean;
  onRemove: () => void;
  onPreview?: (url: string, title: string) => void;
}) {
  const label = fullSetGarmentDisplayLabel(garment, index);
  const ready = isFullSetGarmentReady(garment);
  const parsing = Boolean(garment.ossUrl?.trim() && !ready);

  return (
    <div className="rounded-lg border border-[#e8e8ed] bg-white p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-[#1d1d1f]">{label}</p>
          <p className="text-[9px] text-[#86868b]">
            {ready
              ? "已自动分割 · 可试衣"
              : parsing
                ? "正在分割上下装…"
                : "分割未完成，请重新上传整图"}
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#ff3b30] disabled:opacity-40"
          disabled={busy || disabled}
          aria-label={`删除${label}`}
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex items-start gap-2">
        <PieceSlot
          label="原图"
          url={garment.ossUrl}
          emptyLabel="原图"
          busy={busy}
          disabled={disabled}
          onPickFile={() => {}}
          onPreview={
            onPreview ? () => onPreview(garment.ossUrl, `${label} · 原图`) : undefined
          }
        />
        <PieceSlot
          label="上装"
          url={garment.parsedTopUrl}
          emptyLabel="待分割"
          busy={busy}
          disabled={disabled}
          parsing={parsing && !garment.parsedTopUrl}
          onPickFile={() => {}}
          onPreview={
            garment.parsedTopUrl && onPreview
              ? () => onPreview(garment.parsedTopUrl!, `${label} · 上装`)
              : undefined
          }
        />
        <PieceSlot
          label="下装"
          url={garment.parsedBottomUrl}
          emptyLabel="待分割"
          busy={busy}
          disabled={disabled}
          parsing={parsing && !garment.parsedBottomUrl}
          onPickFile={() => {}}
          onPreview={
            garment.parsedBottomUrl && onPreview
              ? () => onPreview(garment.parsedBottomUrl!, `${label} · 下装`)
              : undefined
          }
        />
      </div>
    </div>
  );
}

/** 双槽套装 · 上装 + 下装两个上传格（空状态与条目共用） */
export function VtonManualDualSlotRow({
  garment,
  index,
  garmentId,
  busy,
  disabled,
  onUpload,
  onOpenAssets,
  onRemove,
  onPreview,
}: {
  garment?: VtonGarmentItem;
  index?: number;
  garmentId?: string;
  busy?: boolean;
  disabled?: boolean;
  onUpload: (slot: ManualSlot, file: File, garmentId?: string) => void;
  onOpenAssets?: (slot: ManualSlot, garmentId?: string) => void;
  onRemove?: () => void;
  onPreview?: (url: string, title: string) => void;
}) {
  const topRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLInputElement>(null);
  const id = garmentId ?? garment?.id;
  const label = garment
    ? fullSetGarmentDisplayLabel(garment, index ?? 0)
    : "双槽套装";
  const ready = garment ? isFullSetGarmentReady(garment) : false;

  const routeFilesToSlots = useCallback(
    (files: File[]) => {
      const queue = [...files];
      if (!garment?.parsedTopUrl && queue.length > 0) {
        onUpload("top", queue.shift()!, id);
      }
      if (!garment?.parsedBottomUrl && queue.length > 0) {
        onUpload("bottom", queue.shift()!, id);
      }
    },
    [garment?.parsedBottomUrl, garment?.parsedTopUrl, id, onUpload],
  );

  const { dragOver: rowDragOver, dropZoneProps: rowDropZoneProps } = useImageDropPaste({
    enabled: !busy && !disabled,
    multiple: true,
    onFiles: routeFilesToSlots,
  });

  return (
    <div
      {...rowDropZoneProps}
      className={cn(
        "rounded-lg border bg-white p-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#0071e3]/30",
        rowDragOver ? "border-[#0071e3] ring-1 ring-[#0071e3]/30" : "border-[#e8e8ed]",
      )}
    >
      {garment && onRemove ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium text-[#1d1d1f]">{label}</p>
            <p className="text-[9px] text-[#86868b]">
              {ready ? "上下装已齐 · 可试衣" : "请分别上传上装与下装"}
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#ff3b30] disabled:opacity-40"
            disabled={busy || disabled}
            aria-label={`删除${label}`}
            onClick={onRemove}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <div className="flex items-start gap-2">
        <PieceSlot
          label="上装"
          url={garment?.parsedTopUrl}
          emptyLabel={`上传上装（${VTON_TOP_GARMENT_SCOPE}）`}
          busy={busy}
          disabled={disabled}
          onPickFile={() => topRef.current?.click()}
          onUploadFile={(file) => onUpload("top", file, id)}
          onOpenAssets={onOpenAssets ? () => onOpenAssets("top", id) : undefined}
          onPreview={
            garment?.parsedTopUrl && onPreview
              ? () => onPreview(garment.parsedTopUrl!, `${label} · 上装`)
              : undefined
          }
        />
        <PieceSlot
          label="下装"
          url={garment?.parsedBottomUrl}
          emptyLabel={`上传下装（${VTON_BOTTOM_GARMENT_SCOPE}）`}
          busy={busy}
          disabled={disabled}
          onPickFile={() => bottomRef.current?.click()}
          onUploadFile={(file) => onUpload("bottom", file, id)}
          onOpenAssets={onOpenAssets ? () => onOpenAssets("bottom", id) : undefined}
          onPreview={
            garment?.parsedBottomUrl && onPreview
              ? () => onPreview(garment.parsedBottomUrl!, `${label} · 下装`)
              : undefined
          }
        />
      </div>

      {bindFileInput(topRef, (file) => onUpload("top", file, id))}
      {bindFileInput(bottomRef, (file) => onUpload("bottom", file, id))}
    </div>
  );
}

/** @deprecated 使用 VtonManualDualSlotRow */
export function VtonManualFullSetCard(props: {
  garment: VtonGarmentItem;
  index: number;
  busy?: boolean;
  disabled?: boolean;
  onUpload: (slot: ManualSlot, file: File) => void;
  onOpenAssets?: (slot: ManualSlot) => void;
  onRemove: () => void;
  onPreview?: (url: string, title: string) => void;
}) {
  return (
    <VtonManualDualSlotRow
      garment={props.garment}
      index={props.index}
      garmentId={props.garment.id}
      busy={props.busy}
      disabled={props.disabled}
      onUpload={(slot, file, id) => props.onUpload(slot, file)}
      onOpenAssets={
        props.onOpenAssets
          ? (slot) => props.onOpenAssets!(slot)
          : undefined
      }
      onRemove={props.onRemove}
      onPreview={props.onPreview}
    />
  );
}
