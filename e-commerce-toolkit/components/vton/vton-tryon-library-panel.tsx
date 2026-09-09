"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Shirt } from "lucide-react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomImagePreviewHost, useEcomImagePreview } from "@/components/media";
import { mapPreviewItemsFromEntries } from "@/lib/media/ecom-image-preview";
import {
  EcomMediaLibraryTile,
  ECOM_LIBRARY_MEDIA_GRID_CLASS,
} from "@/components/media/ecom-media-library-tile";
import { EcomMediaSkeletonGrid } from "@/components/media/ecom-media-skeleton";
import { deleteAsset, listAssets, type EcomAsset } from "@/lib/ecom-api";
import { buildEcomOssThumbUrl } from "@/lib/ecom-oss-image-url";
import { downloadMediaUrl, mediaDownloadFilename } from "@/lib/ecom-media-download";
import { ECOM_VTON_TRYON_ASSET_MODULE } from "@/lib/vton-tryon-library";

export function VtonTryonLibraryPanel() {
  const { confirm, doubleConfirm, alert } = useDialogs();
  const [assets, setAssets] = useState<EcomAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAssets(await listAssets(ECOM_VTON_TRYON_ASSET_MODULE));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const previewItems = useMemo(
    () =>
      mapPreviewItemsFromEntries(
        assets.map((a) => ({
          url: a.ossUrl,
          title: a.title ?? "试衣成片",
          thumbUrl: buildEcomOssThumbUrl(a.ossUrl, a.thumbnailUrl),
        })),
      ),
    [assets],
  );
  const { preview, openPreview, closePreview } = useEcomImagePreview(previewItems);

  async function handleDelete(asset: EcomAsset) {
    const label = asset.title ?? "试衣成片";
    if (
      !(await confirm({
        title: "删除试衣成片",
        message: `确定从试衣库删除「${label}」？`,
        variant: "destructive",
      }))
    ) {
      return;
    }
    if (
      !(await doubleConfirm({
        title: "再次确认",
        message: "此操作不可恢复。",
        secondTitle: "不可恢复",
        secondMessage: "删除后库记录将移除；若文件在云端存储（OSS）将尝试一并删除。",
        confirmLabel: "确认删除",
      }))
    ) {
      return;
    }
    try {
      await deleteAsset(asset.id);
      await load();
    } catch (e) {
      await alert({
        title: "删除失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    }
  }

  return (
    <>
      <div className="mx-auto max-w-6xl">
        {loading ? (
          <EcomMediaSkeletonGrid count={8} gridClass={ECOM_LIBRARY_MEDIA_GRID_CLASS} />
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : assets.length < 1 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[#e8e8ed] bg-[#fafafa] px-6 py-16 text-center">
            <Shirt className="size-10 text-[#86868b]" />
            <p className="text-sm text-[#6e6e73]">试衣库暂无成片</p>
            <Link
              href="/ecom/model-tryon"
              className="text-sm text-[#0071e3] hover:underline"
            >
              去模特试衣生成 →
            </Link>
          </div>
        ) : (
          <ul className={ECOM_LIBRARY_MEDIA_GRID_CLASS}>
            {assets.map((asset) => {
              const title = asset.title ?? "试衣成片";
              return (
                <li key={asset.id} className="flex flex-col gap-1">
                  <EcomMediaLibraryTile
                    kind="image"
                    src={asset.ossUrl}
                    thumbnailSrc={asset.thumbnailUrl ?? asset.ossUrl}
                    alt={title}
                    aspectClass="aspect-[3/4]"
                    onPreview={() => openPreview(asset.ossUrl, title, previewItems)}
                    onDownload={() =>
                      void downloadMediaUrl(
                        asset.ossUrl,
                        mediaDownloadFilename(title, "image", asset.ossUrl),
                      )
                    }
                    onDelete={() => void handleDelete(asset)}
                  />
                  <p className="truncate px-0.5 text-[11px] text-[#6e6e73]" title={title}>
                    {title}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <EcomImagePreviewHost preview={preview} galleryItems={previewItems} onClose={closePreview} />
    </>
  );
}

export function VtonTryonLibraryPageHeader() {
  return (
    <header className="shrink-0 border-b border-[#e8e8ed] bg-white px-4 py-4 sm:px-6 sm:py-5">
      <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#1d1d1f]">试衣库</h1>
          <p className="mt-1 max-w-xl text-sm text-[#6e6e73]">
            电商模特试衣保存的成片；与工具站「试衣间」独立，仅在本工具箱内管理。
          </p>
        </div>
        <Link
          href="/ecom/model-tryon"
          className="inline-flex items-center gap-1 rounded-lg border border-[#e8e8ed] px-3 py-1.5 text-xs text-[#0071e3] hover:bg-[#f0f6ff]"
        >
          <ArrowLeft className="size-3.5" />
          返回模特试衣
        </Link>
      </div>
    </header>
  );
}
