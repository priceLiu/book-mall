"use client";

import { UserRound } from "lucide-react";
import { useRef, useState } from "react";

import { EcomModelLibraryPickerDialog } from "@/components/model-shot/ecom-model-library-picker-dialog";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import {
  getMaxRefsForRoleClient,
  getProductDesignRefUploadMaxBytesClient,
  PRODUCT_DESIGN_REF_STORE_MAX_BYTES,
} from "@/lib/product-design-ref-rules";
import type { ProductDesignReference } from "@/lib/product-design-types";

type Props = {
  references: ProductDesignReference[];
  visionModelKey?: string;
  imageModelKey?: string;
  onUpload: (
    file: File,
    opts: { label: string; role: "model" },
  ) => Promise<void>;
  onRemove?: (id: string) => void | Promise<void>;
  onAttachModelFromLibrary?: (entry: {
    id: string;
    name: string;
    ossUrl: string;
  }) => Promise<void>;
  busy?: boolean;
  uploadProgress?: number | null;
  className?: string;
};

export function ProductDesignModelRefUploader({
  references,
  visionModelKey,
  imageModelKey,
  onUpload,
  onRemove,
  onAttachModelFromLibrary,
  busy,
  uploadProgress = null,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const items = references.filter((r) => r.role === "model");
  const maxCount = getMaxRefsForRoleClient("model", { visionModelKey, imageModelKey });
  const maxUploadBytes = getProductDesignRefUploadMaxBytesClient("model");
  const atLimit = items.length >= maxCount;
  const storeMb = Math.round(PRODUCT_DESIGN_REF_STORE_MAX_BYTES / (1024 * 1024));
  const uploadMb = Math.round(maxUploadBytes / (1024 * 1024));
  const disabled = Boolean(busy) || atLimit;

  async function handleFiles(files: File[]) {
    if (!files.length || disabled) return;
    let remaining = maxCount - items.length;
    for (const file of files) {
      if (remaining <= 0) break;
      const label =
        file.name.replace(/\.[^.]+$/, "").slice(0, 20) || "模特图";
      await onUpload(file, { label, role: "model" });
      remaining -= 1;
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={className ?? "space-y-2"}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
          模特上传
          <span className="ml-1 font-normal normal-case text-[#86868b]">（可选）</span>
        </span>
        <span className="text-[10px] text-[#86868b]">
          {items.length}/{maxCount} · 单张 ≤{uploadMb}MB，存 OSS ≤{storeMb}MB · {IMAGE_UPLOAD_DROP_HINT}
        </span>
      </div>

      <EcomRefUploadCard
        title="模特图"
        items={items.map((r) => ({ id: r.id, ossUrl: r.ossUrl, label: r.label }))}
        emptyHint="可选：上传或粘贴模特气质参考；也可从模特库导入。顶栏 @ 引用与产品/风格参考一致。"
        busy={disabled}
        uploadProgress={uploadProgress}
        maxImageBytes={maxUploadBytes}
        onUploadFiles={(files) => void handleFiles(files)}
        onOpenFilePicker={() => inputRef.current?.click()}
        onRemove={onRemove}
        removeLabel="删除模特图"
        inputRef={inputRef}
        headerActions={
          onAttachModelFromLibrary ? (
            <EcomButtonSecondary
              size="sm"
              type="button"
              disabled={disabled}
              className="h-7 gap-1 px-2 text-[10px]"
              onClick={() => setModelPickerOpen(true)}
            >
              <UserRound className="h-3 w-3 shrink-0" aria-hidden />
              模特库导入
            </EcomButtonSecondary>
          ) : undefined
        }
      />

      {onAttachModelFromLibrary ? (
        <EcomModelLibraryPickerDialog
          open={modelPickerOpen}
          onOpenChange={setModelPickerOpen}
          onPick={async (entry) => {
            await onAttachModelFromLibrary(entry);
            setModelPickerOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
