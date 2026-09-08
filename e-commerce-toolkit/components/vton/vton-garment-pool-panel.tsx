"use client";

import { useRef, useState } from "react";

import { EcomAssetPickerDialog } from "@/components/media/ecom-asset-picker-dialog";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import {
  ECOM_VTON_MAX_BATCH_LOOKS,
  VTON_GARMENT_KIND_LABELS,
  VTON_GARMENT_POOL_KINDS,
  type VtonGarmentItem,
  type VtonGarmentKind,
} from "@/lib/vton-types";

type Props = {
  pool: VtonGarmentItem[];
  busy?: boolean;
  disabled?: boolean;
  onUploadGarment: (kind: VtonGarmentKind, file: File) => Promise<void>;
  onAddFromAssets: (kind: VtonGarmentKind, assets: Array<{ ossUrl: string; title: string }>) => Promise<void>;
  onRemove: (ids: string[]) => Promise<void>;
};

export function VtonGarmentPoolPanel({
  pool,
  busy,
  disabled,
  onUploadGarment,
  onAddFromAssets,
  onRemove,
}: Props) {
  const [assetOpen, setAssetOpen] = useState(false);
  const [assetKind, setAssetKind] = useState<VtonGarmentKind>("top");

  function openAssets(kind: VtonGarmentKind) {
    setAssetKind(kind);
    setAssetOpen(true);
  }

  const grouped: Record<VtonGarmentKind, VtonGarmentItem[]> = {
    top: pool.filter((g) => g.kind === "top"),
    bottom: pool.filter((g) => g.kind === "bottom"),
    one_piece: pool.filter((g) => g.kind === "one_piece"),
    full_set: pool.filter((g) => g.kind === "full_set"),
  };

  return (
    <section className="space-y-3 rounded-xl border border-[#e8e8ed] bg-[#fafafa] p-3">
      <div>
        <h3 className="text-xs font-semibold text-[#1d1d1f]">服装池</h3>
        <p className="text-[11px] text-[#6e6e73]">
          上传或从资产选择，用于编排最多 {ECOM_VTON_MAX_BATCH_LOOKS} 套搭配。
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {VTON_GARMENT_POOL_KINDS.map((kind) => (
          <GarmentKindSlot
            key={kind}
            kind={kind}
            items={grouped[kind]}
            busy={busy}
            disabled={disabled}
            onUpload={onUploadGarment}
            onOpenAssets={openAssets}
            onRemove={onRemove}
          />
        ))}
      </div>

      <EcomAssetPickerDialog
        open={assetOpen}
        onOpenChange={setAssetOpen}
        maxSelect={5}
        onConfirm={async (assets) => {
          setAssetOpen(false);
          if (!assets.length) return;
          await onAddFromAssets(
            assetKind,
            assets.map((a) => ({ ossUrl: a.ossUrl, title: a.title ?? VTON_GARMENT_KIND_LABELS[assetKind] })),
          );
        }}
      />
    </section>
  );
}

function GarmentKindSlot({
  kind,
  items,
  busy,
  disabled,
  onUpload,
  onOpenAssets,
  onRemove,
}: {
  kind: VtonGarmentKind;
  items: VtonGarmentItem[];
  busy?: boolean;
  disabled?: boolean;
  onUpload: (kind: VtonGarmentKind, file: File) => Promise<void>;
  onOpenAssets: (kind: VtonGarmentKind) => void;
  onRemove: (ids: string[]) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const label = VTON_GARMENT_KIND_LABELS[kind];

  return (
    <EcomRefUploadCard
      title={label}
      items={items.map((g) => ({
        id: g.id,
        ossUrl: g.ossUrl,
        label: g.label ?? label,
      }))}
      emptyHint={IMAGE_UPLOAD_DROP_HINT}
      accept="image/*"
      busy={busy || disabled}
      multiple
      onUploadFiles={(files) => {
        for (const file of files) void onUpload(kind, file);
      }}
      onOpenFilePicker={() => inputRef.current?.click()}
      onOpenAssetPicker={() => onOpenAssets(kind)}
      onRemove={(id) => void onRemove([id])}
      removeLabel={`删除${label}`}
      inputRef={inputRef}
    />
  );
}
