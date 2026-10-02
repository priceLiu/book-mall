"use client";

import { useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { BrandViSketchGenerateDialog } from "@/components/brand-vi/brand-vi-sketch-generate-dialog";
import { EcomAssetPickerDialog } from "@/components/media/ecom-asset-picker-dialog";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import { BRAND_VI_SKETCH_MAX, type BrandViReference } from "@/lib/brand-vi-types";

type Props = {
  references: BrandViReference[];
  onUpload: (file: File) => Promise<void>;
  onRemove?: (id: string) => void | Promise<void>;
  onAttachAssets?: (assetIds: string[]) => Promise<void>;
  onGenerateSketch?: (prompt: string) => Promise<void>;
  busy?: boolean;
  sketchGenBusy?: boolean;
  uploadProgress?: number | null;
  className?: string;
};

export function BrandViRefUploader({
  references,
  onUpload,
  onRemove,
  onAttachAssets,
  onGenerateSketch,
  busy,
  sketchGenBusy = false,
  uploadProgress = null,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [genDialogOpen, setGenDialogOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const atLimit = references.length >= BRAND_VI_SKETCH_MAX;
  const disabled = Boolean(busy) || atLimit;
  const genDisabled = Boolean(busy) || Boolean(sketchGenBusy) || !onGenerateSketch;

  async function handleFiles(files: File[]) {
    if (!files.length || disabled) return;
    let remaining = BRAND_VI_SKETCH_MAX - references.length;
    for (const file of files) {
      if (remaining <= 0) break;
      await onUpload(file);
      remaining -= 1;
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleGenerate(prompt: string) {
    if (!onGenerateSketch) return;
    setGenDialogOpen(false);
    try {
      await onGenerateSketch(prompt);
    } catch {
      /* 错误由上层 alert */
    }
  }

  return (
    <div className={className ?? "space-y-2"}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
          手绘参考图
          <span className="ml-1 font-normal normal-case text-[#ff3b30]">（必传）</span>
        </span>
        <span className="text-[10px] text-[#86868b]">
          {references.length}/{BRAND_VI_SKETCH_MAX} · {IMAGE_UPLOAD_DROP_HINT}
        </span>
      </div>

      <EcomRefUploadCard
        title="手绘参考图"
        items={references.map((r) => ({ id: r.id, ossUrl: r.ossUrl, label: r.label }))}
        emptyHint={`上传 1～${BRAND_VI_SKETCH_MAX} 张参考图（第 1 张为主参考图）。全程 1:1 保留参考图造型、发型、配饰与体态。${IMAGE_UPLOAD_DROP_HINT}`}
        removeLabel="删除参考图"
        busy={disabled || sketchGenBusy}
        generating={sketchGenBusy}
        generatingLabel="AI 生成参考图中…"
        showUploadProgress={sketchGenBusy || typeof uploadProgress === "number"}
        uploadProgress={sketchGenBusy ? null : uploadProgress}
        uploadProgressLabel={
          sketchGenBusy ? "AI 生成参考图中，请稍候…" : undefined
        }
        inputRef={inputRef}
        onOpenFilePicker={() => inputRef.current?.click()}
        onOpenAssetPicker={
          onAttachAssets && !atLimit ? () => setPickerOpen(true) : undefined
        }
        onUploadFiles={(files) => void handleFiles(files)}
        onRemove={onRemove}
        toolbarPrefix={
          onGenerateSketch ? (
            <EcomButtonSecondary
              size="sm"
              type="button"
              disabled={genDisabled}
              className="h-7 px-2 text-[10px]"
              onClick={() => setGenDialogOpen(true)}
            >
              {sketchGenBusy ? (
                <>
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                  生成中…
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3 shrink-0" />
                  生成参考图
                </>
              )}
            </EcomButtonSecondary>
          ) : null
        }
      />

      {onAttachAssets ? (
        <EcomAssetPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          maxSelect={Math.max(1, BRAND_VI_SKETCH_MAX - references.length)}
          onConfirm={async (assets) => {
            setPickerOpen(false);
            await onAttachAssets(assets.map((a) => a.id));
          }}
        />
      ) : null}

      {genDialogOpen ? (
        <BrandViSketchGenerateDialog
          open={genDialogOpen}
          onOpenChange={setGenDialogOpen}
          nativeOverlay
          busy={sketchGenBusy}
          hasSeedSketch={references.length > 0}
          onConfirm={handleGenerate}
        />
      ) : null}
    </div>
  );
}
