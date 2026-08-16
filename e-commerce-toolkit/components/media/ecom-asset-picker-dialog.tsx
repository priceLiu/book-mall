"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EcomImagePreviewDialog } from "@/components/media/ecom-image-preview-dialog";
import {
  EcomMediaLibraryTile,
  ECOM_LIBRARY_MEDIA_GRID_CLASS,
} from "@/components/media/ecom-media-library-tile";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { listAssets, type EcomAsset } from "@/lib/ecom-api";
import { cn } from "@/lib/utils";

/** 可挑选的资产分组，与「我的资产」分组保持一致 */
const GROUPS: Array<{ module: string; label: string }> = [
  { module: "main-image", label: "商品主图" },
  { module: "detail-page", label: "详情页" },
  { module: "model-shot", label: "模特图" },
  { module: "storyboard-micro-drama", label: "分镜图" },
  { module: "hand-craft", label: "手伴创作" },
  { module: "seed-video", label: "种草视频" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (
    assets: Array<{ id: string; ossUrl: string; title: string }>,
  ) => void | Promise<void>;
  maxSelect?: number;
  /** 为 true 时同时展示图片与视频资产（拆图拆视频等） */
  allowVideo?: boolean;
};

export function EcomAssetPickerDialog({
  open,
  onOpenChange,
  onConfirm,
  maxSelect = 8,
  allowVideo = false,
}: Props) {
  const [activeModule, setActiveModule] = useState(GROUPS[0]!.module);
  const [assets, setAssets] = useState<EcomAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelected([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listAssets(activeModule)
      .then((items) => {
        if (!cancelled) {
          setAssets(
            items.filter((a) =>
              allowVideo ? a.kind === "image" || a.kind === "video" : a.kind === "image",
            ),
          );
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, activeModule, allowVideo]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= maxSelect
          ? prev
          : [...prev, id],
    );
  }

  async function handleConfirm() {
    const picked = assets
      .filter((a) => selected.includes(a.id))
      .map((a) => ({ id: a.id, ossUrl: a.ossUrl, title: a.title ?? "资产图" }));
    if (picked.length === 0) return;
    setConfirming(true);
    try {
      await onConfirm(picked);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-[#f0f0f2] px-5 py-4">
          <DialogTitle className="text-[15px]">从我的资产选择</DialogTitle>
          <p className="text-[12px] text-[#86868b]">
            最多选择 {maxSelect} 张，已选 {selected.length} 张。
          </p>
        </DialogHeader>

        <div className="flex gap-2 border-b border-[#f0f0f2] px-5 py-2.5">
          {GROUPS.map((g) => (
            <button
              key={g.module}
              type="button"
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                activeModule === g.module
                  ? "border-[#1d1d1f] bg-[#1d1d1f] text-white"
                  : "border-[#d2d2d7] bg-white text-[#1d1d1f] hover:border-[#86868b]",
              )}
              onClick={() => setActiveModule(g.module)}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="grid place-items-center gap-2 py-14 text-sm text-[#86868b]">
              <Loader2 className="h-5 w-5 animate-spin" />
              正在加载资产…
            </div>
          ) : error ? (
            <p className="py-14 text-center text-sm text-[#c0392b]">{error}</p>
          ) : assets.length === 0 ? (
            <p className="py-14 text-center text-sm text-[#86868b]">
              该分组下还没有{allowVideo ? "图片或视频" : "图片"}资产。
            </p>
          ) : (
            <div className={ECOM_LIBRARY_MEDIA_GRID_CLASS}>
              {assets.map((asset) => {
                const active = selected.includes(asset.id);
                return (
                  <EcomMediaLibraryTile
                    key={asset.id}
                    kind={asset.kind === "video" ? "video" : "image"}
                    src={asset.thumbnailUrl ?? asset.ossUrl}
                    alt={asset.title ?? "资产"}
                    selected={active}
                    onSelect={() => toggle(asset.id)}
                    onPreview={() =>
                      setPreviewSrc(asset.thumbnailUrl ?? asset.ossUrl)
                    }
                  />
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-[#f0f0f2] px-5 py-3">
          <EcomButtonSecondary size="sm" type="button" onClick={() => onOpenChange(false)}>
            取消
          </EcomButtonSecondary>
          <EcomButtonPrimary
            size="sm"
            type="button"
            disabled={selected.length === 0 || confirming}
            onClick={() => void handleConfirm()}
          >
            {confirming ? "正在添加…" : `使用所选 ${selected.length} 张`}
          </EcomButtonPrimary>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {previewSrc ? (
      <EcomImagePreviewDialog
        src={previewSrc}
        open
        onOpenChange={(open) => {
          if (!open) setPreviewSrc(null);
        }}
      />
    ) : null}
  </>
  );
}
