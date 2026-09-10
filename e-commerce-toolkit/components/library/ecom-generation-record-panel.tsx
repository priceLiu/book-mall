"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, History } from "lucide-react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomImagePreviewHost, useEcomImagePreview } from "@/components/media";
import { mapPreviewItemsFromEntries } from "@/lib/media/ecom-image-preview";
import {
  EcomMediaLibraryTile,
  ECOM_LIBRARY_MEDIA_GRID_CLASS,
} from "@/components/media/ecom-media-library-tile";
import { EcomMediaSkeletonGrid } from "@/components/media/ecom-media-skeleton";
import { EcomVideoPreviewDialog } from "@/components/media/ecom-video-preview-dialog";
import { buildEcomOssThumbUrl } from "@/lib/ecom-oss-image-url";
import { downloadMediaUrl, mediaDownloadFilename } from "@/lib/ecom-media-download";
import {
  deleteGenerationRecord,
  generationRecordSourceLabel,
  listGenerationRecords,
  type EcomGenerationRecordItem,
} from "@/lib/ecom-generation-record-api";

function formatVersionLabel(item: EcomGenerationRecordItem): string {
  const meta = item.meta;
  const source = generationRecordSourceLabel(meta);
  const model = meta?.modelKey?.trim();
  const panel =
    typeof meta?.panelIndex === "number" ? ` · 镜头 ${meta.panelIndex}` : "";
  const date = new Date(item.createdAt).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${source}${panel}${model ? ` · ${model}` : ""} · ${date}`;
}

export function EcomGenerationRecordPageHeader() {
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-[#e8e8ed] bg-white px-4 py-4 sm:px-6">
      <Link
        href="/library"
        className="inline-flex size-9 items-center justify-center rounded-lg text-[#6e6e73] hover:bg-[#f5f5f7]"
        aria-label="返回我的资产"
      >
        <ArrowLeft className="size-5" />
      </Link>
      <div>
        <h1 className="text-lg font-semibold text-[#1d1d1f]">生成记录</h1>
        <p className="text-xs text-[#6e6e73]">成功生成的图片与视频，按版本归档；未被工作流引用的可删除</p>
      </div>
    </header>
  );
}

export function EcomGenerationRecordPanel() {
  const { confirm, doubleConfirm, alert } = useDialogs();
  const [items, setItems] = useState<EcomGenerationRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listGenerationRecords());
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const imageItems = useMemo(
    () => items.filter((i) => i.kind !== "video"),
    [items],
  );
  const previewItems = useMemo(
    () =>
      mapPreviewItemsFromEntries(
        imageItems.map((a) => ({
          url: a.ossUrl,
          title: a.title ?? "生成图片",
          thumbUrl: buildEcomOssThumbUrl(a.ossUrl, a.thumbnailUrl),
        })),
      ),
    [imageItems],
  );
  const { preview, openPreview, closePreview } = useEcomImagePreview(previewItems);

  async function handleDelete(item: EcomGenerationRecordItem) {
    const label = item.title ?? "生成记录";
    if (
      !(await confirm({
        title: "删除生成记录",
        message: `确定删除「${label}」？若已被工作流引用将无法删除。`,
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
        secondMessage:
          "删除后记录将移除；若云端存储（OSS）无其他引用将尝试一并删除。",
        confirmLabel: "确认删除",
      }))
    ) {
      return;
    }
    try {
      await deleteGenerationRecord(item.id);
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
        ) : items.length < 1 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[#e8e8ed] bg-[#fafafa] px-6 py-16 text-center">
            <History className="size-10 text-[#86868b]" />
            <p className="text-sm text-[#6e6e73]">暂无生成记录</p>
            <p className="max-w-md text-xs text-[#86868b]">
              各模块生成成功后会自动写入此处；文生试衣成片同时写入试衣库。
            </p>
          </div>
        ) : (
          <ul className={ECOM_LIBRARY_MEDIA_GRID_CLASS}>
            {items.map((item) => {
              const title = item.title ?? (item.kind === "video" ? "生成视频" : "生成图片");
              const versionLabel = formatVersionLabel(item);
              const isVideo = item.kind === "video";
              return (
                <li key={item.id} className="flex flex-col gap-1">
                  <EcomMediaLibraryTile
                    kind={isVideo ? "video" : "image"}
                    src={item.ossUrl}
                    thumbnailSrc={item.thumbnailUrl ?? item.ossUrl}
                    alt={title}
                    aspectClass={isVideo ? "aspect-video" : "aspect-[3/4]"}
                    onPreview={() => {
                      if (isVideo) setVideoPreviewUrl(item.ossUrl);
                      else openPreview(item.ossUrl, title, previewItems);
                    }}
                    onDownload={() =>
                      void downloadMediaUrl(
                        item.ossUrl,
                        mediaDownloadFilename(title, item.kind, item.ossUrl),
                      )
                    }
                    onDelete={() => void handleDelete(item)}
                  />
                  <p className="truncate px-0.5 text-xs font-medium text-[#1d1d1f]" title={title}>
                    {title}
                  </p>
                  <p className="truncate px-0.5 text-[11px] text-[#86868b]" title={versionLabel}>
                    {versionLabel}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <EcomImagePreviewHost preview={preview} galleryItems={previewItems} onClose={closePreview} />
      <EcomVideoPreviewDialog
        open={Boolean(videoPreviewUrl)}
        url={videoPreviewUrl ?? ""}
        onClose={() => setVideoPreviewUrl(null)}
      />
    </>
  );
}
