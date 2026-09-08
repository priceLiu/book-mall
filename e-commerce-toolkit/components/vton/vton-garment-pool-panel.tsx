"use client";

import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { EcomAssetPickerDialog } from "@/components/media/ecom-asset-picker-dialog";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import {
  ECOM_VTON_MAX_BATCH_LOOKS,
  VTON_GARMENT_KIND_LABELS,
  type VtonGarmentItem,
  type VtonGarmentKind,
} from "@/lib/vton-types";
import { cn } from "@/lib/utils";

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
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadKind, setUploadKind] = useState<VtonGarmentKind>("top");

  function openUpload(kind: VtonGarmentKind) {
    setUploadKind(kind);
    fileRef.current?.click();
  }

  function openAssets(kind: VtonGarmentKind) {
    setAssetKind(kind);
    setAssetOpen(true);
  }

  const grouped: Record<VtonGarmentKind, VtonGarmentItem[]> = {
    top: pool.filter((g) => g.kind === "top"),
    bottom: pool.filter((g) => g.kind === "bottom"),
    one_piece: pool.filter((g) => g.kind === "one_piece"),
  };

  return (
    <section className="space-y-3 rounded-xl border border-[#e8e8ed] bg-[#fafafa] p-3">
      <div>
        <h3 className="text-xs font-semibold text-[#1d1d1f]">服装池</h3>
        <p className="text-[11px] text-[#6e6e73]">
          上传或从资产选择，用于编排最多 {ECOM_VTON_MAX_BATCH_LOOKS} 套搭配。
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(["top", "bottom", "one_piece"] as VtonGarmentKind[]).map((kind) => (
          <div key={kind} className="space-y-2 rounded-lg border border-[#e8e8ed] bg-white p-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-[#1d1d1f]">
                {VTON_GARMENT_KIND_LABELS[kind]}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="text-[10px] text-[#0071e3] hover:underline disabled:opacity-50"
                  disabled={busy || disabled}
                  onClick={() => openUpload(kind)}
                >
                  上传
                </button>
                <button
                  type="button"
                  className="text-[10px] text-[#0071e3] hover:underline disabled:opacity-50"
                  disabled={busy || disabled}
                  onClick={() => openAssets(kind)}
                >
                  资产
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {grouped[kind].map((g) => (
                <div
                  key={g.id}
                  className="group relative overflow-hidden rounded-md border border-[#e8e8ed] bg-[#fafafa]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.ossUrl} alt={g.label ?? kind} className="aspect-square w-full object-cover" />
                  <button
                    type="button"
                    className={cn(
                      "absolute right-1 top-1 rounded bg-black/50 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100",
                      (busy || disabled) && "pointer-events-none opacity-30",
                    )}
                    disabled={busy || disabled}
                    onClick={() => void onRemove([g.id])}
                    aria-label="删除"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                  <p className="truncate px-1 py-0.5 text-[10px] text-[#6e6e73]">{g.label ?? g.id.slice(0, 6)}</p>
                </div>
              ))}
              {grouped[kind].length === 0 ? (
                <p className="col-span-2 py-4 text-center text-[10px] text-[#86868b]">{IMAGE_UPLOAD_DROP_HINT}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onUploadGarment(uploadKind, f);
          e.target.value = "";
        }}
      />

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
