"use client";

import Image from "next/image";
import { Eye } from "lucide-react";
import { useState } from "react";

import { EcomImagePreviewDialog } from "@/components/media/ecom-image-preview-dialog";
import { EcomVideoThumb } from "@/components/media/ecom-video-player";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StoryboardSheetLiveThumb } from "@/components/storyboard/storyboard-sheet-live-thumb";
import { StoryboardSheetPreviewDialog } from "@/components/storyboard/storyboard-sheet-preview-dialog";
import type { StoryboardDeliverableSnapshot } from "@/lib/storyboard-types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: StoryboardDeliverableSnapshot;
  onPreviewVideo: (src: string, title?: string) => void;
};

function formatSavedAt(iso: string) {
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return iso;
  }
}

/** 交付快照查阅：产品/角色图、分镜图、镜头视频、成片，只读预览 */
export function StoryboardDeliverableReviewDialog({
  open,
  onOpenChange,
  snapshot,
  onPreviewVideo,
}: Props) {
  const [sheetPreviewOpen, setSheetPreviewOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ src: string; title: string } | null>(null);

  const products = snapshot.references.filter((r) => r.role === "product");
  const characters = snapshot.references.filter((r) => r.role === "character");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92vh] max-w-[96vw] flex-col gap-4 overflow-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>交付快照查阅</DialogTitle>
            <p className="text-xs text-[#86868b]">
              {snapshot.title} · 保存于 {formatSavedAt(snapshot.savedAt)}
              {snapshot.videoMode === "merged_panels"
                ? " · 分镜合并成片"
                : snapshot.videoMode === "full_sheet"
                  ? " · 整图成片"
                  : ""}
            </p>
          </DialogHeader>

          <div className="ecom-scrollbar-thin min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
            <section>
              <h3 className="mb-2 text-sm font-semibold text-[#1d1d1f]">场景图</h3>
              <div className="flex flex-wrap gap-4">
                <RefPreviewCard
                  title="产品图"
                  refs={products}
                  onPreview={(src, title) => setImagePreview({ src, title })}
                />
                <RefPreviewCard
                  title="角色图"
                  refs={characters}
                  onPreview={(src, title) => setImagePreview({ src, title })}
                />
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#1d1d1f]">完整分镜图</h3>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-[#d2d2d7] px-2.5 py-1 text-xs font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]"
                  onClick={() => setSheetPreviewOpen(true)}
                >
                  <Eye className="h-3.5 w-3.5" />
                  放大查阅
                </button>
              </div>
              <button
                type="button"
                className="relative aspect-[16/9] w-full max-w-xl overflow-hidden rounded-lg border border-[#e8e8ed] bg-white"
                onClick={() => setSheetPreviewOpen(true)}
              >
                <StoryboardSheetLiveThumb
                  sheet={snapshot.sheet}
                  references={snapshot.references}
                  productName={snapshot.productName}
                  productHighlight={snapshot.productHighlight}
                  projectKeywords={snapshot.projectKeywords}
                  thumbId="deliverable-sheet-thumb"
                />
              </button>
              {snapshot.sheetPngUrl ? (
                <button
                  type="button"
                  className="mt-2 text-xs text-[#6e6e73] underline-offset-2 hover:text-[#1d1d1f] hover:underline"
                  onClick={() =>
                    setImagePreview({ src: snapshot.sheetPngUrl!, title: "完整分镜图 PNG" })
                  }
                >
                  查看合成 PNG
                </button>
              ) : null}
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-[#1d1d1f]">各镜头分镜图</h3>
              <div className="flex flex-wrap gap-3">
                {snapshot.sheet.panels.map((panel) => (
                  <div key={panel.index} className="w-[120px]">
                    <button
                      type="button"
                      disabled={!panel.imageUrl}
                      className="relative mb-1 h-[72px] w-full overflow-hidden rounded-lg border border-[#e8e8ed] bg-[#f5f5f7] disabled:opacity-50"
                      onClick={() =>
                        panel.imageUrl &&
                        setImagePreview({
                          src: panel.imageUrl,
                          title: `镜头 ${panel.index} 分镜图`,
                        })
                      }
                    >
                      {panel.imageUrl ? (
                        <Image
                          src={panel.imageUrl}
                          alt={`镜头${panel.index}`}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="text-[10px] text-[#86868b]">无图</span>
                      )}
                    </button>
                    <p className="text-center text-[10px] text-[#6e6e73]">镜头 {panel.index}</p>
                  </div>
                ))}
              </div>
            </section>

            {snapshot.panelVideos.length > 0 ? (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-[#1d1d1f]">各镜头视频</h3>
                <div className="flex flex-wrap gap-3">
                  {snapshot.panelVideos.map((pv) => (
                    <div key={pv.index} className="w-[100px]">
                      <EcomVideoThumb
                        src={pv.videoUrl}
                        className="mb-1 h-[120px] w-full rounded-lg"
                        onClick={() => onPreviewVideo(pv.videoUrl, `镜头 ${pv.index} 视频`)}
                      />
                      <p className="text-center text-[10px] text-[#6e6e73]">镜头 {pv.index}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {snapshot.videoUrl ? (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-[#1d1d1f]">完整成片</h3>
                <div className="max-w-[200px]">
                  <EcomVideoThumb
                    src={snapshot.videoUrl}
                    className="h-[200px] w-full rounded-lg"
                    onClick={() => onPreviewVideo(snapshot.videoUrl!, snapshot.title)}
                  />
                </div>
              </section>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <StoryboardSheetPreviewDialog
        open={sheetPreviewOpen}
        onOpenChange={setSheetPreviewOpen}
        sheet={snapshot.sheet}
        references={snapshot.references}
        productName={snapshot.productName}
        productHighlight={snapshot.productHighlight}
        projectKeywords={snapshot.projectKeywords}
        title={`交付快照 · ${snapshot.title}`}
      />

      {imagePreview ? (
        <EcomImagePreviewDialog
          src={imagePreview.src}
          title={imagePreview.title}
          open
          onOpenChange={(o) => {
            if (!o) setImagePreview(null);
          }}
        />
      ) : null}
    </>
  );
}

function RefPreviewCard({
  title,
  refs,
  onPreview,
}: {
  title: string;
  refs: Array<{ label: string; ossUrl: string }>;
  onPreview: (src: string, title: string) => void;
}) {
  const primary = refs[0];
  return (
    <div className="w-[140px] rounded-lg border border-[#e8e8ed] bg-white p-3">
      <p className="mb-2 text-xs font-semibold text-[#1d1d1f]">{title}</p>
      {primary ? (
        <button
          type="button"
          className="relative mb-1 h-[88px] w-full overflow-hidden rounded-md border border-[#e8e8ed] bg-[#f5f5f7]"
          onClick={() => onPreview(primary.ossUrl, `${title} · ${primary.label}`)}
        >
          <Image src={primary.ossUrl} alt={primary.label} fill className="object-cover" unoptimized />
        </button>
      ) : (
        <div className="mb-1 flex h-[88px] items-center justify-center rounded-md border border-dashed border-[#d2d2d7] text-[10px] text-[#86868b]">
          未上传
        </div>
      )}
      <p className="truncate text-[10px] text-[#6e6e73]">{primary?.label ?? "—"}</p>
    </div>
  );
}
