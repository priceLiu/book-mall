"use client";

import { Eye } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  EcomMediaLibraryTile,
} from "@/components/media/ecom-media-library-tile";
import { StoryboardSheetLiveThumb } from "@/components/storyboard/storyboard-sheet-live-thumb";
import { StoryboardSheetPreviewDialog } from "@/components/storyboard/storyboard-sheet-preview-dialog";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { fetchStoryboardLibraryDeliverable } from "@/lib/ecom-storyboard-api";
import { downloadMediaUrl, mediaDownloadFilename } from "@/lib/ecom-media-download";
import { STORYBOARD_PREVIEW_MIN_H, storyboardPreviewAspectClass } from "@/lib/storyboard-aspect";
import type { StoryboardDeliverableSnapshot } from "@/lib/storyboard-types";

type Props = {
  projectId: string;
  title: string;
  /** 列表侧已有快照，展开时仍会拉取合并后的最新媒体 */
  initialSnapshot?: StoryboardDeliverableSnapshot;
  savedAt?: string;
  bundleTitle?: string;
  onPreviewVideo: (src: string, title?: string) => void;
  onPreviewImage: (src: string, title?: string) => void;
};

/** 资产库 · 故事版展开区：完整分镜图 + 各镜图 + 成片/分镜视频 */
export function StoryboardLibraryDeliverablePanel({
  projectId,
  title,
  initialSnapshot,
  savedAt,
  bundleTitle,
  onPreviewVideo,
  onPreviewImage,
}: Props) {
  const [snapshot, setSnapshot] = useState<StoryboardDeliverableSnapshot | null>(
    initialSnapshot ?? null,
  );
  const [mediaLoading, setMediaLoading] = useState(true);
  const [sheetPreviewOpen, setSheetPreviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMediaLoading(true);
    void fetchStoryboardLibraryDeliverable(projectId, {
      savedAt,
      title: bundleTitle,
    })
      .then((fresh) => {
        if (!cancelled) setSnapshot(fresh);
      })
      .catch(() => {
        /* 保留 initialSnapshot */
      })
      .finally(() => {
        if (!cancelled) setMediaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, savedAt, bundleTitle]);

  const panelVideos = useMemo(() => {
    if (!snapshot) return [];
    if (snapshot.panelVideos.length > 0) return snapshot.panelVideos;
    return snapshot.sheet.panels
      .filter((p) => p.videoUrl?.trim())
      .map((p) => ({ index: p.index, videoUrl: p.videoUrl!.trim() }));
  }, [snapshot]);

  const finalVideo = snapshot?.videoUrl?.trim();
  const hasPanelImages =
    snapshot?.sheet.panels.some((p) => Boolean(p.imageUrl?.trim())) ?? false;
  const hasSheet = Boolean(snapshot?.sheet?.panels?.length);

  if (mediaLoading && !snapshot) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-[#e8e8ed] bg-white px-4 py-6">
        <p className="text-xs text-[#86868b]">加载完整故事版…</p>
      </div>
    );
  }

  if (!snapshot || !hasSheet) {
    return (
      <div className="flex min-h-[120px] items-center rounded-xl border border-dashed border-[#d2d2d7] bg-white px-4 py-4">
        <p className="text-xs text-[#86868b]">暂无分镜内容；可在工作室生成后刷新本页。</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-[#6e6e73]">完整故事版</p>
            {hasPanelImages ? (
              <EcomButtonSecondary
                size="sm"
                type="button"
                className="h-7 px-2.5 text-[11px]"
                onClick={() => setSheetPreviewOpen(true)}
              >
                <Eye className="h-3.5 w-3.5 shrink-0" />
                放大查阅
              </EcomButtonSecondary>
            ) : null}
          </div>
          <button
            type="button"
            disabled={!hasPanelImages}
            className={`relative w-full overflow-hidden rounded-xl border border-[#e8e8ed] bg-white shadow-sm disabled:cursor-default ${STORYBOARD_PREVIEW_MIN_H} ${storyboardPreviewAspectClass("16:9")}`}
            onClick={() => hasPanelImages && setSheetPreviewOpen(true)}
          >
            {mediaLoading ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-xs text-[#86868b]">
                刷新媒体…
              </div>
            ) : null}
            <StoryboardSheetLiveThumb
              sheet={snapshot.sheet}
              references={snapshot.references}
              productName={snapshot.productName}
              productHighlight={snapshot.productHighlight}
              projectKeywords={snapshot.projectKeywords}
              thumbId="library-storyboard-sheet"
            />
          </button>
        </section>

        {hasPanelImages ? (
          <section>
            <p className="mb-1.5 text-[11px] font-medium text-[#6e6e73]">各镜头分镜图</p>
            <ul className="flex flex-wrap gap-2">
              {snapshot.sheet.panels.map((panel) => (
                <li key={panel.index} className="w-[100px]">
                  {panel.imageUrl?.trim() ? (
                    <EcomMediaLibraryTile
                      kind="image"
                      src={panel.imageUrl}
                      alt={`镜头 ${panel.index}`}
                      onPreview={() =>
                        onPreviewImage(panel.imageUrl!, `${title} · 镜头 ${panel.index}`)
                      }
                      onDownload={() =>
                        void downloadMediaUrl(
                          panel.imageUrl!,
                          mediaDownloadFilename(
                            `镜头${panel.index}`,
                            "image",
                            panel.imageUrl!,
                          ),
                        )
                      }
                    />
                  ) : (
                    <div className="flex aspect-[9/16] items-center justify-center rounded-lg border border-dashed border-[#d2d2d7] bg-[#f5f5f7] text-[10px] text-[#86868b]">
                      无图
                    </div>
                  )}
                  <p className="mt-1 text-center text-[10px] text-[#6e6e73]">
                    镜头 {panel.index}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {finalVideo || panelVideos.length > 0 ? (
          <section className="space-y-3">
            {finalVideo ? (
              <div>
                <p className="mb-1.5 text-[11px] font-medium text-[#6e6e73]">完整成片</p>
                <div className="max-w-[160px]">
                  <EcomMediaLibraryTile
                    kind="video"
                    src={finalVideo}
                    alt={`${title} 成片`}
                    onPreview={() => onPreviewVideo(finalVideo, `${title} · 完整成片`)}
                    onDownload={() =>
                      void downloadMediaUrl(
                        finalVideo,
                        mediaDownloadFilename(title, "video", finalVideo),
                      )
                    }
                  />
                </div>
              </div>
            ) : null}
            {panelVideos.length > 0 ? (
              <div>
                <p className="mb-1.5 text-[11px] font-medium text-[#6e6e73]">分镜视频</p>
                <ul className="flex flex-wrap gap-2">
                  {panelVideos.map((pv) => (
                    <li key={pv.index} className="w-[100px]">
                      <EcomMediaLibraryTile
                        kind="video"
                        src={pv.videoUrl}
                        alt={`镜头 ${pv.index}`}
                        onPreview={() =>
                          onPreviewVideo(pv.videoUrl, `${title} · 镜头 ${pv.index}`)
                        }
                        onDownload={() =>
                          void downloadMediaUrl(
                            pv.videoUrl,
                            mediaDownloadFilename(`镜头${pv.index}`, "video", pv.videoUrl),
                          )
                        }
                      />
                      <p className="mt-1 text-center text-[10px] text-[#6e6e73]">
                        镜头 {pv.index}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      <StoryboardSheetPreviewDialog
        open={sheetPreviewOpen}
        onOpenChange={setSheetPreviewOpen}
        sheet={snapshot.sheet}
        references={snapshot.references}
        productName={snapshot.productName}
        productHighlight={snapshot.productHighlight}
        projectKeywords={snapshot.projectKeywords}
        title={title}
      />
    </>
  );
}
