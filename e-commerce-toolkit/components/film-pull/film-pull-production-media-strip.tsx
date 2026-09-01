"use client";

import { Film, Loader2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { EcomVideoSlot } from "@/components/media/ecom-video-slot";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { StoryboardPanelCard } from "@/components/storyboard/storyboard-panel-card";
import { StoryboardPanelVideoCard } from "@/components/storyboard/storyboard-panel-video-card";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  generateFilmPullProductionImage,
  generateFilmPullShotVideo,
  generateFilmPullShotsBatch,
  mockFilmPullBatchGenerate,
  mockFilmPullFinalRender,
  renderFilmPullFinalVideo,
} from "@/lib/ecom-film-pull-api";
import { filmPullShotToStoryboardPanel } from "@/lib/film-pull-confirm-table";
import { isFilmPullMockDevUiEnabled } from "@/lib/film-pull-mock-dev";
import type { FilmPullProductionShot, FilmPullProject } from "@/lib/film-pull-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

type PickerTarget =
  | { kind: "idle" }
  | { kind: "image"; shotNo: number; mock?: boolean }
  | { kind: "video"; shotNo: number }
  | { kind: "batch-image"; shotNos: number[] }
  | { kind: "batch-video" };

type Props = {
  project: FilmPullProject;
  shots: FilmPullProductionShot[];
  aspectRatio?: "16:9" | "9:16";
  imageModels: StoryboardGatewayModel[];
  imageModelKey: string;
  videoModels: StoryboardGatewayModel[];
  videoModelKey: string;
  onImageModelChange: (key: string) => void;
  onVideoModelChange: (key: string) => void;
  modelsLoading?: boolean;
  onRefreshModels?: () => void;
  busy?: boolean;
  onProjectUpdated: (project: FilmPullProject) => void;
  onPreviewVideo: (src: string, title?: string) => void;
  onPreviewImage?: (src: string, title: string) => void;
  onAlert: (opts: { title: string; message: string; variant?: "error" }) => Promise<void>;
};

export function FilmPullProductionMediaStrip({
  project,
  shots,
  aspectRatio = "9:16",
  imageModels,
  imageModelKey,
  videoModels,
  videoModelKey,
  onImageModelChange,
  onVideoModelChange,
  modelsLoading,
  onRefreshModels,
  busy,
  onProjectUpdated,
  onPreviewVideo,
  onPreviewImage,
  onAlert,
}: Props) {
  const [actionBusy, setActionBusy] = useState(false);
  const [composeBusy, setComposeBusy] = useState(false);
  const [picker, setPicker] = useState<PickerTarget>({ kind: "idle" });
  const [draftModelKey, setDraftModelKey] = useState("");
  const [selectedImageShots, setSelectedImageShots] = useState<Set<number>>(() => new Set());

  const panels = useMemo(
    () => shots.map((s) => filmPullShotToStoryboardPanel(s)),
    [shots],
  );

  const finalUrl = project.productionPlan?.render?.finalVideoUrl ?? project.meta?.finalVideoUrl;
  const allHaveVideo = shots.every((s) => s.videoUrl?.trim());
  const panelVideoCount = shots.filter((s) => s.videoUrl?.trim()).length;
  const locked = busy || actionBusy || composeBusy;

  const selectedImageList = useMemo(
    () => [...selectedImageShots].sort((a, b) => a - b),
    [selectedImageShots],
  );

  function toggleImageSelect(shotNo: number) {
    setSelectedImageShots((prev) => {
      const next = new Set(prev);
      if (next.has(shotNo)) next.delete(shotNo);
      else next.add(shotNo);
      return next;
    });
  }

  async function runImage(shotNo: number, modelKey: string, mock?: boolean) {
    setActionBusy(true);
    try {
      onProjectUpdated(
        await generateFilmPullProductionImage(project.id, shotNo, { modelKey }, mock),
      );
    } catch (e) {
      await onAlert({
        title: "生图失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setActionBusy(false);
    }
  }

  async function runImagesSequential(shotNos: number[], modelKey: string) {
    setActionBusy(true);
    try {
      let current = project;
      for (const shotNo of shotNos) {
        current = await generateFilmPullProductionImage(project.id, shotNo, { modelKey });
        onProjectUpdated(current);
      }
    } catch (e) {
      await onAlert({
        title: "批量生图失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setActionBusy(false);
    }
  }

  async function runVideo(shotNo: number, modelKey: string) {
    setActionBusy(true);
    try {
      onProjectUpdated(await generateFilmPullShotVideo(project.id, shotNo, { modelKey }));
    } catch (e) {
      await onAlert({
        title: "生视频失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setActionBusy(false);
    }
  }

  async function runBatchVideo(modelKey: string) {
    setActionBusy(true);
    try {
      if (isFilmPullMockDevUiEnabled()) {
        onProjectUpdated(await mockFilmPullBatchGenerate(project.id));
      } else {
        onProjectUpdated(await generateFilmPullShotsBatch(project.id, { modelKey }));
      }
    } catch (e) {
      await onAlert({
        title: "批量生视频失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setActionBusy(false);
    }
  }

  async function runCompose() {
    setComposeBusy(true);
    try {
      if (isFilmPullMockDevUiEnabled()) {
        onProjectUpdated(await mockFilmPullFinalRender(project.id));
      } else {
        onProjectUpdated(await renderFilmPullFinalVideo(project.id));
      }
    } catch (e) {
      await onAlert({
        title: "合成失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setComposeBusy(false);
    }
  }

  const pickerMode = picker.kind === "image" || picker.kind === "batch-image" ? "image" : "video";
  const pickerModels = pickerMode === "image" ? imageModels : videoModels;

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-[#1d1d1f]">各镜头分镜图</p>
          <div className="flex flex-wrap items-center gap-2">
            <EcomButtonSecondary
              size="sm"
              type="button"
              disabled={locked}
              onClick={() => {
                const targets =
                  selectedImageList.length > 0 ? selectedImageList : shots.map((s) => s.shotNo);
                setDraftModelKey(imageModelKey);
                setPicker({ kind: "batch-image", shotNos: targets });
              }}
            >
              {selectedImageList.length > 0
                ? `生成分镜图（${selectedImageList.length}）`
                : "生成全部分镜图"}
            </EcomButtonSecondary>
            <EcomButtonSecondary
              size="sm"
              type="button"
              disabled={locked}
              onClick={() => {
                setDraftModelKey(videoModelKey);
                setPicker({ kind: "batch-video" });
              }}
            >
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              批量生视频
            </EcomButtonSecondary>
          </div>
        </div>
        <p className="mb-3 text-[11px] leading-relaxed text-[#86868b]">
          勾选镜头后可批量生图；逐镜点卡片内「生成」可单独重试。
        </p>
        <div className="flex flex-wrap gap-4">
          {panels.map((panel) => (
            <StoryboardPanelCard
              key={`fp-img-${panel.index}`}
              panel={panel}
              aspectRatio={aspectRatio}
              imageUrl={panel.imageUrl}
              selectable
              selected={selectedImageShots.has(panel.index)}
              onToggleSelect={() => toggleImageSelect(panel.index)}
              busy={actionBusy}
              indexLabel="镜"
              onRegenerateImage={() => {
                setDraftModelKey(imageModelKey);
                setPicker({ kind: "image", shotNo: panel.index });
              }}
              onPreviewImage={
                panel.imageUrl && onPreviewImage
                  ? () => onPreviewImage(panel.imageUrl!, `镜 ${panel.index}`)
                  : undefined
              }
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-[#e8e8ed] bg-[#fafafa] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-[#1d1d1f]">各镜头单镜视频</p>
            <p className="mt-0.5 text-[11px] text-[#86868b]">
              已生成 {panelVideoCount} / {shots.length} 镜
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          {panels.map((panel) => (
            <StoryboardPanelVideoCard
              key={`fp-vid-${panel.index}`}
              panel={panel}
              aspectRatio={aspectRatio}
              videoUrl={panel.videoUrl}
              posterUrl={panel.imageUrl}
              busy={actionBusy}
              onPreview={
                panel.videoUrl
                  ? () => onPreviewVideo(panel.videoUrl!, `镜 ${panel.index}`)
                  : undefined
              }
              onRegenerateVideo={() => {
                setDraftModelKey(videoModelKey);
                setPicker({ kind: "video", shotNo: panel.index });
              }}
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-[#e8e8ed] bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-[#1d1d1f]">合成成片</p>
            <p className="mt-0.5 text-[11px] text-[#86868b]">
              {finalUrl
                ? "各镜头已云端合成"
                : composeBusy
                  ? "正在合成…"
                  : allHaveVideo
                    ? "全部单镜视频就绪，可合成成片"
                    : "全部镜有视频后可合成"}
            </p>
          </div>
          <EcomButtonPrimary
            size="sm"
            type="button"
            disabled={locked || !allHaveVideo}
            onClick={() => void runCompose()}
          >
            {composeBusy ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Film className="mr-1 h-3.5 w-3.5" />
            )}
            合成成片
          </EcomButtonPrimary>
        </div>
        <div className="mx-auto w-full max-w-sm">
          <EcomVideoSlot
            src={finalUrl}
            aspectRatio={aspectRatio}
            generating={composeBusy}
            emptyLabel={composeBusy ? "合成中…" : "待合成"}
            playSize="md"
            layout="gallery-workspace"
            className="!bg-black"
            onPreview={
              finalUrl && !composeBusy ? () => onPreviewVideo(finalUrl, "制作成片") : undefined
            }
          />
        </div>
      </section>

      <StoryboardModelPickerDialog
        open={picker.kind !== "idle"}
        onOpenChange={(open) => {
          if (!open) setPicker({ kind: "idle" });
        }}
        mode={pickerMode}
        dialogTitle={
          picker.kind === "batch-image" || picker.kind === "image"
            ? "选择生图模型"
            : "选择生视频模型"
        }
        dialogDescription="确认后将开始生成。"
        confirmLabel="开始生成"
        models={pickerModels}
        modelsLoading={modelsLoading}
        onRetryLoadModels={onRefreshModels}
        value={draftModelKey}
        onChange={setDraftModelKey}
        onConfirm={(key) => {
          if (picker.kind === "image") {
            onImageModelChange(key);
            void runImage(picker.shotNo, key, picker.mock);
          } else if (picker.kind === "batch-image") {
            onImageModelChange(key);
            void runImagesSequential(picker.shotNos, key);
          } else if (picker.kind === "video") {
            onVideoModelChange(key);
            void runVideo(picker.shotNo, key);
          } else if (picker.kind === "batch-video") {
            onVideoModelChange(key);
            void runBatchVideo(key);
          }
          setPicker({ kind: "idle" });
        }}
      />
    </div>
  );
}
