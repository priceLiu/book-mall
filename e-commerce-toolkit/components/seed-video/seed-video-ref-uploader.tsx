"use client";

import { useRef, useState } from "react";

import { EcomAssetPickerDialog } from "@/components/media/ecom-asset-picker-dialog";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import type { SeedVideoReference } from "@/lib/seed-video-types";

const MAX_MATERIALS = 9;

type Props = {
  references: SeedVideoReference[];
  onUpload: (file: File) => Promise<void>;
  onRemove?: (id: string) => void | Promise<void>;
  onAttachAssets?: (assetIds: string[]) => Promise<void>;
  busy?: boolean;
  uploadProgress?: number | null;
  className?: string;
};

export function SeedVideoRefUploader({
  references,
  onUpload,
  onRemove,
  onAttachAssets,
  busy,
  uploadProgress = null,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const items = references.filter((r) => r.role === "seed-material");
  const atLimit = items.length >= MAX_MATERIALS;
  const disabled = Boolean(busy) || atLimit;

  async function handleFiles(files: File[]) {
    if (!files.length || disabled) return;
    let remaining = MAX_MATERIALS - items.length;
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
          种草素材
          <span className="ml-1 font-normal normal-case text-[#ff3b30]">（必传）</span>
        </span>
        <span className="text-[10px] text-[#86868b]">
          {items.length}/{MAX_MATERIALS} · {IMAGE_UPLOAD_DROP_HINT}
        </span>
      </div>

      <EcomRefUploadCard
        title="种草素材"
        items={items.map((r) => ({ id: r.id, ossUrl: r.ossUrl, label: r.label }))}
        emptyHint={`上传 1～${MAX_MATERIALS} 张商品/穿搭素材，发送时用 @图片1 … 引用。${IMAGE_UPLOAD_DROP_HINT}`}
        removeLabel="删除素材"
        busy={disabled}
        uploadProgress={uploadProgress}
        inputRef={inputRef}
        onOpenFilePicker={() => inputRef.current?.click()}
        onOpenAssetPicker={
          onAttachAssets && !atLimit ? () => setPickerOpen(true) : undefined
        }
        onUploadFiles={(files) => void handleFiles(files)}
        onRemove={onRemove}
      />

      {onAttachAssets ? (
        <EcomAssetPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          maxSelect={Math.max(1, MAX_MATERIALS - items.length)}
          onConfirm={async (assets) => {
            setPickerOpen(false);
            await onAttachAssets(assets.map((a) => a.id));
          }}
        />
      ) : null}
    </div>
  );
}
