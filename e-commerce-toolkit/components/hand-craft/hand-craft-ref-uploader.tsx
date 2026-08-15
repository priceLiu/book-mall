"use client";

import { useRef } from "react";

import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import { HAND_CRAFT_SKETCH_MAX, type HandCraftReference } from "@/lib/hand-craft-types";

type Props = {
  references: HandCraftReference[];
  onUpload: (file: File) => Promise<void>;
  onRemove?: (id: string) => void | Promise<void>;
  busy?: boolean;
  uploadProgress?: number | null;
  className?: string;
};

export function HandCraftRefUploader({
  references,
  onUpload,
  onRemove,
  busy,
  uploadProgress = null,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const atLimit = references.length >= HAND_CRAFT_SKETCH_MAX;
  const disabled = Boolean(busy) || atLimit;

  async function handleFiles(files: File[]) {
    if (!files.length || disabled) return;
    let remaining = HAND_CRAFT_SKETCH_MAX - references.length;
    for (const file of files) {
      if (remaining <= 0) break;
      await onUpload(file);
      remaining -= 1;
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={className ?? "space-y-2"}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
          手绘线稿
          <span className="ml-1 font-normal normal-case text-[#ff3b30]">（必传）</span>
        </span>
        <span className="text-[10px] text-[#86868b]">
          {references.length}/{HAND_CRAFT_SKETCH_MAX} · {IMAGE_UPLOAD_DROP_HINT}
        </span>
      </div>

      <EcomRefUploadCard
        title="手绘线稿"
        items={references.map((r) => ({ id: r.id, ossUrl: r.ossUrl, label: r.label }))}
        emptyHint={`上传 1～${HAND_CRAFT_SKETCH_MAX} 张线稿（第 1 张为主线稿）。全程 1:1 保留线稿造型、发型、配饰与体态。${IMAGE_UPLOAD_DROP_HINT}`}
        removeLabel="删除线稿"
        busy={disabled}
        uploadProgress={uploadProgress}
        inputRef={inputRef}
        onOpenFilePicker={() => inputRef.current?.click()}
        onUploadFiles={(files) => void handleFiles(files)}
        onRemove={onRemove}
      />
    </div>
  );
}
