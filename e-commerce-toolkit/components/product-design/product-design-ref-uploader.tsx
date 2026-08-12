"use client";

import { useRef, useState } from "react";

import { EcomAssetPickerDialog } from "@/components/media/ecom-asset-picker-dialog";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import { getMaxRefsForRoleClient } from "@/lib/product-design-ref-rules";
import type { ProductDesignReference, ProductDesignReferenceRole } from "@/lib/product-design-types";

const ROLE_COPY: Record<
  ProductDesignReferenceRole,
  { title: string; emptyHint: string; removeLabel: string }
> = {
  product: {
    title: "产品实拍",
    emptyHint:
      "请上传至少 1 张产品实拍图（必传）。后续主图/详情 AI 出图将依据此图分析商品外观；支持 Ctrl+V / ⌘V 粘贴。",
    removeLabel: "删除产品图",
  },
  "main-style": {
    title: "主图风格参考",
    emptyHint:
      "可选：上传场景/调性/竞品风格参考（1–N 张）。不上传时 AI 将按文案与平台规范自动补视觉方向。",
    removeLabel: "删除主图参考",
  },
  "detail-style": {
    title: "详情页风格参考",
    emptyHint:
      "可选：上传详情长图排版或信息密度参考。不上传时将沿用已出主图的视觉基准。",
    removeLabel: "删除详情参考",
  },
  scene: {
    title: "场景参考",
    emptyHint: "上传场景参考图。",
    removeLabel: "删除参考图",
  },
  model: {
    title: "模特参考",
    emptyHint: "上传模特参考图。",
    removeLabel: "删除参考图",
  },
  other: {
    title: "参考图",
    emptyHint: "上传参考图。",
    removeLabel: "删除参考图",
  },
};

type Props = {
  role: ProductDesignReferenceRole;
  references: ProductDesignReference[];
  required?: boolean;
  visionModelKey?: string;
  imageModelKey?: string;
  onUpload: (
    file: File,
    opts: { label: string; role: ProductDesignReferenceRole },
  ) => Promise<void>;
  onRemove?: (id: string) => void | Promise<void>;
  onAttachAssets?: (assets: Array<{ id: string; ossUrl: string; title: string }>) => Promise<void>;
  busy?: boolean;
  uploadProgress?: number | null;
  className?: string;
};

export function ProductDesignRefUploader({
  role,
  references,
  required,
  visionModelKey,
  imageModelKey,
  onUpload,
  onRemove,
  onAttachAssets,
  busy,
  uploadProgress = null,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const items = references.filter((r) => r.role === role);
  const maxCount = getMaxRefsForRoleClient(role, { visionModelKey, imageModelKey });
  const atLimit = items.length >= maxCount;
  const copy = ROLE_COPY[role];

  const disabled = Boolean(busy) || atLimit;

  async function handleFiles(files: File[]) {
    if (!files.length || disabled) return;
    let remaining = maxCount - items.length;
    for (const file of files) {
      if (remaining <= 0) break;
      const label = file.name.replace(/\.[^.]+$/, "").slice(0, 20) || copy.title;
      await onUpload(file, { label, role });
      remaining -= 1;
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={className ?? "space-y-2"}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
          {copy.title}
          {required ? (
            <span className="ml-1 font-normal normal-case text-[#ff3b30]">（必传）</span>
          ) : (
            <span className="ml-1 font-normal normal-case text-[#86868b]">（可选）</span>
          )}
        </span>
        <span className="text-[10px] text-[#86868b]">
          {items.length}/{maxCount} · {IMAGE_UPLOAD_DROP_HINT}
        </span>
      </div>

      <EcomRefUploadCard
        title={copy.title}
        items={items.map((r) => ({ id: r.id, ossUrl: r.ossUrl, label: r.label }))}
        emptyHint={copy.emptyHint}
        busy={disabled}
        uploadProgress={uploadProgress}
        onUploadFiles={(files) => void handleFiles(files)}
        onOpenFilePicker={() => inputRef.current?.click()}
        onOpenAssetPicker={onAttachAssets && !atLimit ? () => setPickerOpen(true) : undefined}
        onRemove={onRemove}
        removeLabel={copy.removeLabel}
        inputRef={inputRef}
      />

      {onAttachAssets ? (
        <EcomAssetPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onConfirm={async (assets) => {
            setPickerOpen(false);
            await onAttachAssets(assets);
          }}
        />
      ) : null}
    </div>
  );
}
