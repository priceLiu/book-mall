"use client";

import { Cpu, Film, ImageIcon, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  generateFilmPullProductionImage,
  generateFilmPullShotVideo,
  generateFilmPullShotsBatch,
  mockFilmPullBatchGenerate,
  mockFilmPullFinalRender,
  patchFilmPullProductionShot,
  renderFilmPullFinalVideo,
} from "@/lib/ecom-film-pull-api";
import { isFilmPullMockDevUiEnabled } from "@/lib/film-pull-mock-dev";
import type { FilmPullProject } from "@/lib/film-pull-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

type Props = {
  project: FilmPullProject;
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
  onAlert: (opts: { title: string; message: string; variant?: "error" }) => Promise<void>;
};

type PickerTarget =
  | { kind: "idle" }
  | { kind: "image"; shotNo: number; mock?: boolean }
  | { kind: "video"; shotNo: number }
  | { kind: "batch-video" };

export function FilmPullProductionPanel({
  project,
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
  onAlert,
}: Props) {
  const plan = project.productionPlan;
  const [actionBusy, setActionBusy] = useState(false);
  const [picker, setPicker] = useState<PickerTarget>({ kind: "idle" });
  const [draftModelKey, setDraftModelKey] = useState("");

  if (!plan?.shots.length || !project.meta?.productionScriptConfirmedAt) return null;

  const finalUrl = plan.render?.finalVideoUrl ?? project.meta?.finalVideoUrl;
  const allHaveVideo = plan.shots.every((s) => s.videoUrl?.trim());

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

  async function runVideo(shotNo: number, modelKey: string) {
    setActionBusy(true);
    try {
      onProjectUpdated(
        await generateFilmPullShotVideo(project.id, shotNo, { modelKey }),
      );
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
    setActionBusy(true);
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
      setActionBusy(false);
    }
  }

  const locked = busy || actionBusy;
  const pickerMode = picker.kind === "image" ? "image" : "video";
  const pickerModels = picker.kind === "image" ? imageModels : videoModels;

  return (
    <div className="space-y-3 rounded-xl border border-[#e8e8ed] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[#1d1d1f]">制作成片</h2>
          <p className="text-[11px] text-[#6e6e73]">可选逐镜生图，再逐镜生视频；也可直接生视频。</p>
        </div>
        <div className="flex flex-wrap gap-2">
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
          <EcomButtonPrimary
            size="sm"
            type="button"
            disabled={locked || !allHaveVideo}
            onClick={() => void runCompose()}
          >
            {actionBusy ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Film className="mr-1 h-3.5 w-3.5" />
            )}
            合成成片
          </EcomButtonPrimary>
        </div>
      </div>

      {finalUrl ? (
        <div className="rounded-lg border border-[#d4edda] bg-[#f6fff8] p-3">
          <p className="mb-2 text-xs font-medium text-[#1d1d1f]">成片预览</p>
          <EcomButtonSecondary size="sm" type="button" onClick={() => onPreviewVideo(finalUrl, "制作成片")}>
            播放成片
          </EcomButtonSecondary>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#e8e8ed] text-left text-[#6e6e73]">
              <th className="px-2 py-2 font-medium">镜</th>
              <th className="px-2 py-2 font-medium">时间</th>
              <th className="px-2 py-2 font-medium">生图 Prompt</th>
              <th className="px-2 py-2 font-medium">分镜图</th>
              <th className="px-2 py-2 font-medium">生视频 Prompt</th>
              <th className="px-2 py-2 font-medium">分镜视频</th>
              <th className="px-2 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {plan.shots.map((shot) => (
              <tr key={shot.shotNo} className="border-b border-[#f0f0f2] align-top">
                <td className="px-2 py-2 font-medium">{shot.shotNo}</td>
                <td className="whitespace-nowrap px-2 py-2 text-[#6e6e73]">
                  {shot.startTimeSec.toFixed(1)}–{shot.endTimeSec.toFixed(1)}s
                </td>
                <td className="max-w-[10rem] px-2 py-2">
                  <textarea
                    key={`img-${shot.shotNo}-${shot.imagePrompt}`}
                    className="min-h-[3rem] w-full rounded border border-[#e8e8ed] p-1 text-[10px]"
                    defaultValue={shot.imagePrompt}
                    disabled={locked}
                    onBlur={(e) => {
                      if (e.target.value === shot.imagePrompt) return;
                      void patchFilmPullProductionShot(project.id, shot.shotNo, {
                        imagePrompt: e.target.value,
                      }).then(onProjectUpdated);
                    }}
                  />
                </td>
                <td className="px-2 py-2">
                  {shot.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={shot.imageUrl} alt="" className="h-14 w-14 rounded object-cover ring-1 ring-[#e8e8ed]" />
                  ) : (
                    <span className="text-[#86868b]">—</span>
                  )}
                </td>
                <td className="max-w-[10rem] px-2 py-2">
                  <textarea
                    key={`vid-${shot.shotNo}-${shot.videoPrompt}`}
                    className="min-h-[3rem] w-full rounded border border-[#e8e8ed] p-1 text-[10px]"
                    defaultValue={shot.videoPrompt}
                    disabled={locked}
                    onBlur={(e) => {
                      if (e.target.value === shot.videoPrompt) return;
                      void patchFilmPullProductionShot(project.id, shot.shotNo, {
                        videoPrompt: e.target.value,
                      }).then(onProjectUpdated);
                    }}
                  />
                </td>
                <td className="px-2 py-2">
                  {shot.videoUrl ? (
                    <button
                      type="button"
                      className="text-[#0071e3] underline"
                      onClick={() => onPreviewVideo(shot.videoUrl!, `镜 ${shot.shotNo}`)}
                    >
                      预览
                    </button>
                  ) : (
                    <span className="text-[#86868b]">—</span>
                  )}
                </td>
                <td className="px-2 py-2">
                  <div className="flex flex-col gap-1">
                    <EcomButtonSecondary
                      size="sm"
                      type="button"
                      disabled={locked}
                      onClick={() => {
                        setDraftModelKey(imageModelKey);
                        setPicker({ kind: "image", shotNo: shot.shotNo });
                      }}
                    >
                      <ImageIcon className="mr-1 h-3 w-3" />
                      生图
                    </EcomButtonSecondary>
                    {isFilmPullMockDevUiEnabled() ? (
                      <EcomButtonSecondary
                        size="sm"
                        type="button"
                        disabled={locked}
                        onClick={() => {
                          setDraftModelKey(imageModelKey);
                          setPicker({ kind: "image", shotNo: shot.shotNo, mock: true });
                        }}
                      >
                        Mock 图
                      </EcomButtonSecondary>
                    ) : null}
                    <EcomButtonSecondary
                      size="sm"
                      type="button"
                      disabled={locked}
                      onClick={() => {
                        setDraftModelKey(videoModelKey);
                        setPicker({ kind: "video", shotNo: shot.shotNo });
                      }}
                    >
                      <Cpu className="mr-1 h-3 w-3" />
                      生视频
                    </EcomButtonSecondary>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <StoryboardModelPickerDialog
        open={picker.kind !== "idle"}
        onOpenChange={(open) => {
          if (!open) setPicker({ kind: "idle" });
        }}
        nativeOverlay
        mode={pickerMode}
        dialogTitle={picker.kind === "image" ? "选择生图模型" : "选择生视频模型"}
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
