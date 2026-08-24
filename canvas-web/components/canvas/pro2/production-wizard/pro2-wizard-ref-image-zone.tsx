"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { uploadCanvasImage } from "@/lib/canvas-api";
import {
  allImageFilesFromDataTransfer,
  useImagePasteWhenActive,
} from "@/lib/canvas/image-upload-handlers";
import {
  compressImageFileForUpload,
  ensureCanvasUploadFileMeta,
} from "@/lib/canvas/normalize-canvas-image-file";
import type { StoryRefImage } from "@/lib/canvas/story-ref-image";
import { MediaHoverBox } from "@/components/canvas/media-hover-box";
import { PRO2_WIZARD_DROPZONE_CLASS } from "./pro2-production-wizard-chrome";
import { cn } from "@/lib/utils";

function newRefId() {
  return `wiz-ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function resolveWizardRefUploadFile(file: File): Promise<File> {
  try {
    return await compressImageFileForUpload(file);
  } catch {
    return ensureCanvasUploadFileMeta(file);
  }
}

function formatUploadErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/^upload failed:\s*/i, "").trim() || "上传失败，请稍后重试";
}

export type Pro2WizardRefImageZoneProps = {
  refs: StoryRefImage[];
  onChange: (next: StoryRefImage[]) => void;
  disabled?: boolean;
  maxCount?: number;
  className?: string;
};

/** 向导 · 参考图上传（拖 / 粘贴 / 点击 · 不 spawn 画布节点） */
export function Pro2WizardRefImageZone({
  refs,
  onChange,
  disabled,
  maxCount = 9,
  className,
}: Pro2WizardRefImageZoneProps) {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const ingestFiles = useCallback(
    async (files: File[]) => {
      if (disabled || !base || !files.length) return;
      const room = maxCount - refs.length;
      if (room <= 0) return;
      setUploading(true);
      try {
        const next = [...refs];
        for (const file of files.slice(0, room)) {
          try {
            const uploadFile = await resolveWizardRefUploadFile(file);
            const url = await uploadCanvasImage(base, uploadFile);
            next.push({
              id: newRefId(),
              label: file.name.replace(/\.[^.]+$/, "") || "参考图",
              url,
            });
          } catch (e) {
            await alert({
              title: "参考图上传失败",
              message: formatUploadErrorMessage(e),
              variant: "error",
            });
            break;
          }
        }
        if (next.length > refs.length) onChange(next);
      } finally {
        setUploading(false);
      }
    },
    [alert, base, disabled, maxCount, onChange, refs],
  );

  useImagePasteWhenActive(
    !disabled,
    {
      onFiles: (files) => void ingestFiles(files),
    },
    true,
    "pro2-wizard-ref-zone",
    "zone",
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (disabled) return;
    void ingestFiles(allImageFilesFromDataTransfer(e.dataTransfer));
  };

  const canAdd = refs.length < maxCount;

  const openPicker = () => {
    if (disabled || uploading || !canAdd) return;
    inputRef.current?.click();
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="添加参考图"
        className={cn(
          "pro2-wizard-ref-zone relative flex min-h-[72px] flex-col rounded-lg border border-dashed p-2 transition",
          PRO2_WIZARD_DROPZONE_CLASS,
          canAdd && !disabled && "cursor-pointer hover:border-white/14 hover:bg-white/[0.03]",
          dragOver ? "border-violet-400/35 bg-violet-500/10" : "",
          disabled && "pointer-events-none opacity-60",
        )}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-ref-thumb]")) return;
          openPicker();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragOver(false);
        }}
        onDrop={onDrop}
      >
        {refs.length > 0 ? (
          <div
            className="mb-2 flex flex-wrap gap-2"
            data-ref-thumb
            onClick={(e) => e.stopPropagation()}
          >
            {refs.map((ref) => (
              <div
                key={ref.id}
                className="group relative size-20 shrink-0 overflow-hidden rounded-lg border border-white/[0.06] bg-black/30"
                data-ref-thumb
              >
                {ref.url ? (
                  <MediaHoverBox
                    src={ref.url}
                    alt={ref.label}
                    fit="cover"
                    variant="generated"
                    previewChrome="ecom"
                    className="size-full"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-[10px] text-white/40">
                    无预览
                  </div>
                )}
                <button
                  type="button"
                  className="absolute right-0.5 top-0.5 z-[3] rounded bg-black/70 p-0.5 text-white/80 opacity-0 transition group-hover:opacity-100"
                  aria-label="移除参考图"
                  onClick={() => onChange(refs.filter((r) => r.id !== ref.id))}
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {canAdd ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-3 text-center">
            {uploading ? (
              <Loader2 className="size-8 animate-spin text-violet-300/80" />
            ) : (
              <ImagePlus className="size-8 text-white/35" />
            )}
            <p className="text-[11px] text-white/40">
              {refs.length
                ? "拖拽、粘贴或点击添加更多参考图"
                : "拖拽、粘贴或点击添加参考图"}
            </p>
          </div>
        ) : (
          <p className="py-2 text-center text-[11px] text-white/35">
            已达参考图上限（{maxCount} 张）
          </p>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files ? [...e.target.files] : [];
          e.target.value = "";
          void ingestFiles(files);
        }}
      />
    </div>
  );
}
