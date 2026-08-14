"use client";

import { Loader2, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ProductDesignPromptMentionTextarea } from "@/components/product-design/product-design-prompt-mention-textarea";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { SeedVideoRefUploader } from "@/components/seed-video/seed-video-ref-uploader";
import { SeedVideoShotTable } from "@/components/seed-video/seed-video-shot-table";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  generateSeedVideoDirect,
  generateSeedVideoShot,
  generateSeedVideoTts,
  pollSeedVideoDirect,
  pollSeedVideoRender,
  renderSeedVideo,
  updateSeedVideoProject,
} from "@/lib/ecom-seed-video-api";
import { buildSeedVideoMentionRefs, SEED_VIDEO_PROMPT_PLACEHOLDER } from "@/lib/seed-video-mention-refs";
import { filterVideoModelsForMode, isDirectMode } from "@/lib/seed-video-workflow";
import type { SeedVideoPlan, SeedVideoProject, SeedVideoShot } from "@/lib/seed-video-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const DIRECT_POLL_MS = 4000;
const DIRECT_POLL_MAX = 180;
const RENDER_POLL_MS = 3000;
const RENDER_POLL_MAX = 120;

type Props = {
  project: SeedVideoProject;
  videoModels: StoryboardGatewayModel[];
  videoModelKey: string;
  onVideoModelChange: (key: string) => void;
  onProjectChange: () => void | Promise<void>;
  onPreviewVideo: (src: string, title?: string) => void;
  onAlert: (opts: { title: string; message: string; variant?: "error" }) => Promise<void>;
  onUploadRef: (file: File) => Promise<void>;
  onRemoveRef?: (id: string) => void | Promise<void>;
  refBusy?: boolean;
  planningPrompt: string;
  onPlanningPromptChange: (value: string) => void;
  onStartPlanning: () => void;
  onNewProject?: () => void | Promise<void>;
  streaming?: boolean;
};

export function SeedVideoContentPanel({
  project,
  videoModels,
  videoModelKey,
  onVideoModelChange,
  onProjectChange,
  onPreviewVideo,
  onAlert,
  onUploadRef,
  onRemoveRef,
  refBusy,
  planningPrompt,
  onPlanningPromptChange,
  onStartPlanning,
  onNewProject,
  streaming,
}: Props) {
  const direct = isDirectMode(project);
  const shots = project.plan?.shots ?? [];
  const directPlan = project.plan?.directVideo;
  const finalUrl =
    project.plan?.render?.finalVideoUrl?.trim() ||
    project.videoOssUrl?.trim() ||
    directPlan?.videoUrl?.trim() ||
    null;

  const filteredModels = useMemo(() => {
    const keys = filterVideoModelsForMode(
      videoModels.map((m) => m.modelKey),
      direct,
    );
    return videoModels.filter((m) => keys.includes(m.modelKey));
  }, [videoModels, direct]);

  const [localShots, setLocalShots] = useState<SeedVideoShot[]>(shots);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPanelIndex, setPickerPanelIndex] = useState<number | null>(null);
  const [pickerTarget, setPickerTarget] = useState<"panel" | "fullSheet">("fullSheet");
  const [shotBusy, setShotBusy] = useState<number | null>(null);
  const [ttsBusy, setTtsBusy] = useState(false);
  const [renderBusy, setRenderBusy] = useState(false);
  const [directBusy, setDirectBusy] = useState(false);
  const [directPollCount, setDirectPollCount] = useState(0);
  const directPollLock = useRef(false);

  const mentionRefs = useMemo(
    () => buildSeedVideoMentionRefs(project.references),
    [project.references],
  );
  const materialCount = project.references.filter((r) => r.role === "seed-material").length;
  const canStartPlanning =
    materialCount > 0 && planningPrompt.trim().length > 0 && !streaming;

  useEffect(() => {
    setLocalShots(shots);
  }, [shots]);

  const savePlan = useCallback(
    async (patch: Partial<SeedVideoPlan>) => {
      await updateSeedVideoProject(project.id, {
        plan: { ...(project.plan ?? {}), ...patch },
      });
      await onProjectChange();
    },
    [onProjectChange, project.id, project.plan],
  );

  async function handleSaveShots() {
    await savePlan({ shots: localShots });
  }

  function openVideoPicker(opts: { panelIndex?: number; fullSheet?: boolean }) {
    setPickerTarget(opts.fullSheet ? "fullSheet" : "panel");
    setPickerPanelIndex(opts.panelIndex ?? null);
    setPickerOpen(true);
  }

  async function runPanelGenerate(modelKey: string, panelIndex: number) {
    setShotBusy(panelIndex);
    try {
      const shot = localShots.find((s) => s.index === panelIndex);
      await savePlan({ shots: localShots });
      const result = await generateSeedVideoShot({
        projectId: project.id,
        shotIndex: panelIndex,
        modelKey,
        durationSec: shot?.durationSec ?? 8,
        aspectRatio: project.settings.aspectRatio ?? "9:16",
      });
      setLocalShots((prev) =>
        prev.map((s) =>
          s.index === panelIndex ? { ...s, videoUrl: result.videoUrl } : s,
        ),
      );
      await onProjectChange();
    } catch (e) {
      await onAlert({
        title: "镜头生成失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setShotBusy(null);
    }
  }

  async function runAllShots(modelKey: string) {
    for (const shot of localShots) {
      if (shot.videoUrl) continue;
      await runPanelGenerate(modelKey, shot.index);
    }
  }

  async function runTts() {
    setTtsBusy(true);
    try {
      await savePlan({ shots: localShots });
      await generateSeedVideoTts({ projectId: project.id });
      await onProjectChange();
    } catch (e) {
      await onAlert({
        title: "TTS 失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setTtsBusy(false);
    }
  }

  async function runRender() {
    setRenderBusy(true);
    try {
      const { jobId } = await renderSeedVideo(project.id);
      for (let i = 0; i < RENDER_POLL_MAX; i++) {
        await new Promise((r) => setTimeout(r, RENDER_POLL_MS));
        const status = await pollSeedVideoRender(project.id);
        if (status.status === "done" && status.outputUrl) {
          await onProjectChange();
          return;
        }
        if (status.status === "failed") {
          throw new Error(status.failMessage ?? "合成失败");
        }
        if (status.status === "idle" && i > 2) break;
        void jobId;
      }
      throw new Error("合成超时，请稍后刷新");
    } catch (e) {
      await onAlert({
        title: "合成失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setRenderBusy(false);
    }
  }

  const pollDirect = useCallback(async () => {
    if (directPollLock.current) return;
    directPollLock.current = true;
    try {
      for (let i = 0; i < DIRECT_POLL_MAX; i++) {
        setDirectPollCount(i + 1);
        const status = await pollSeedVideoDirect(project.id);
        if (status.status === "done" && status.videoUrl) {
          await onProjectChange();
          return;
        }
        if (status.status === "failed") {
          throw new Error("直接生成失败");
        }
        await new Promise((r) => setTimeout(r, DIRECT_POLL_MS));
      }
      throw new Error("直接生成超时");
    } catch (e) {
      await onAlert({
        title: "生成失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setDirectBusy(false);
      directPollLock.current = false;
    }
  }, [onAlert, onProjectChange, project.id]);

  useEffect(() => {
    const pending = project.meta?.pendingDirectVideo;
    if (pending?.taskId && !directBusy && !directPlan?.videoUrl) {
      setDirectBusy(true);
      void pollDirect();
    }
  }, [directBusy, directPlan?.videoUrl, pollDirect, project.meta?.pendingDirectVideo]);

  async function runDirectGenerate(modelKey: string) {
    setDirectBusy(true);
    setDirectPollCount(0);
    try {
      await generateSeedVideoDirect({
        projectId: project.id,
        modelKey,
        durationSec: project.settings.targetDurationSec ?? 30,
        aspectRatio: project.settings.aspectRatio ?? "9:16",
      });
      await pollDirect();
    } catch (e) {
      setDirectBusy(false);
      await onAlert({
        title: "提交失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    }
  }

  async function onPickerConfirm(modelKey: string) {
    setPickerOpen(false);
    onVideoModelChange(modelKey);
    if (pickerTarget === "fullSheet") {
      await runDirectGenerate(modelKey);
    } else if (pickerPanelIndex != null) {
      await runPanelGenerate(modelKey, pickerPanelIndex);
    } else {
      await runAllShots(modelKey);
    }
  }

  const hasShots = localShots.length > 0;
  const showProduction = hasShots || Boolean(directPlan?.globalPrompt);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white">
      <div className="ecom-scrollbar-overlay h-full min-h-0 w-full overflow-x-hidden overflow-y-auto overscroll-y-contain [overflow-anchor:none]">
        <header className="sticky top-0 z-20 border-b border-[#e8e8ed] bg-white px-5 py-3 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#1d1d1f]">
                {project.title ?? "图片生种草视频"}
              </h2>
              <p className="text-[11px] text-[#6e6e73]">种草短视频 · 素材策划与成片</p>
            </div>
            {onNewProject ? (
              <EcomButtonSecondary
                size="sm"
                type="button"
                dark
                disabled={Boolean(refBusy) || streaming}
                onClick={() => void onNewProject()}
              >
                新建
              </EcomButtonSecondary>
            ) : null}
          </div>
        </header>

        <section className="border-b border-[#e8e8ed] px-5 py-4">
          <SeedVideoRefUploader
            references={project.references}
            onUpload={onUploadRef}
            onRemove={onRemoveRef}
            busy={refBusy}
          />
        </section>

        <section className="border-b border-[#e8e8ed] px-5 py-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
            素材 + Prompt
          </p>
          <p className="mb-4 text-[11px] leading-relaxed text-[#6e6e73]">
            上传素材后填写 Prompt（可 @ 图片），点击「开始策划」进入 Skill 流程；脚本、模式与风格点选请在右侧助手完成。
          </p>
          <p className="mb-2 text-[11px] font-semibold text-[#1d1d1f]">Prompt（可 @ 图片）</p>
          <ProductDesignPromptMentionTextarea
            value={planningPrompt}
            referenceImages={mentionRefs}
            disabled={Boolean(refBusy) || streaming}
            onChange={onPlanningPromptChange}
          />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <EcomButtonPrimary
              size="sm"
              type="button"
              disabled={!canStartPlanning || Boolean(refBusy)}
              onClick={onStartPlanning}
            >
              开始策划
            </EcomButtonPrimary>
            {!planningPrompt.trim() ? (
              <button
                type="button"
                className="text-[11px] text-[#0071e3] hover:underline disabled:opacity-50"
                disabled={Boolean(refBusy) || streaming}
                onClick={() => onPlanningPromptChange(SEED_VIDEO_PROMPT_PLACEHOLDER)}
              >
                填入示例 Prompt
              </button>
            ) : null}
          </div>
        </section>

        {!showProduction && !streaming ? (
          <div className="flex min-h-[24vh] flex-col items-center justify-center px-6 py-10 text-center">
            <p className="max-w-md text-sm text-[#6e6e73]">
              完成素材上传与 Prompt 并点击「开始策划」后，定稿脚本、镜头表与视频 Prompt 将显示在此。
            </p>
          </div>
        ) : (
          <div className="px-4 py-4 sm:px-6">
      {finalUrl ? (
        <section className="mb-6 rounded-xl border border-[#e8e8ed] bg-[#f5f5f7] p-4">
          <h2 className="mb-2 text-sm font-semibold text-[#1d1d1f]">成片预览</h2>
          <button
            type="button"
            className="group relative flex aspect-[9/16] max-h-[420px] w-full max-w-[240px] items-center justify-center overflow-hidden rounded-xl bg-black"
            onClick={() => onPreviewVideo(finalUrl, project.title ?? "种草视频")}
          >
            <Play className="h-10 w-10 text-white opacity-90 group-hover:scale-105" />
          </button>
        </section>
      ) : null}

      {direct && directPlan ? (
        <section className="mb-6 space-y-3">
          <h2 className="text-sm font-semibold text-[#1d1d1f]">方案① · 直接连贯生成</h2>
          <label className="block text-xs text-[#6e6e73]">全局视频 Prompt</label>
          <textarea
            className="ecom-scrollbar-thin w-full min-h-[6rem] rounded-xl border border-[#e8e8ed] px-3 py-2 text-sm"
            value={directPlan.globalPrompt}
            onChange={(e) =>
              void savePlan({
                directVideo: { ...directPlan, globalPrompt: e.target.value },
              })
            }
          />
          <label className="block text-xs text-[#6e6e73]">完整口播</label>
          <textarea
            className="ecom-scrollbar-thin w-full min-h-[4rem] rounded-xl border border-[#e8e8ed] px-3 py-2 text-sm"
            value={directPlan.fullVoiceover}
            onChange={(e) =>
              void savePlan({
                directVideo: { ...directPlan, fullVoiceover: e.target.value },
              })
            }
          />
          <div className="flex flex-wrap gap-2">
            <EcomButtonPrimary
              type="button"
              disabled={directBusy}
              onClick={() => openVideoPicker({ fullSheet: true })}
            >
              {directBusy ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  生成中…
                </>
              ) : (
                "选择视频模型并生成"
              )}
            </EcomButtonPrimary>
            {directBusy ? (
              <StoryboardTaskStatus
                title={`轮询任务 (${directPollCount})`}
                active
                surface="content"
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {!direct && hasShots ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#1d1d1f]">方案② · 精细成片</h2>
            <div className="flex flex-wrap gap-2">
              <EcomButtonSecondary type="button" onClick={() => void handleSaveShots()}>
                保存编辑
              </EcomButtonSecondary>
              <EcomButtonSecondary
                type="button"
                disabled={shotBusy != null}
                onClick={() => openVideoPicker({})}
              >
                逐镜生成视频
              </EcomButtonSecondary>
              <EcomButtonSecondary type="button" disabled={ttsBusy} onClick={() => void runTts()}>
                {ttsBusy ? "TTS…" : "批量 TTS"}
              </EcomButtonSecondary>
              <EcomButtonPrimary type="button" disabled={renderBusy} onClick={() => void runRender()}>
                {renderBusy ? "合成中…" : "合成成片"}
              </EcomButtonPrimary>
            </div>
          </div>
          <SeedVideoShotTable
            shots={localShots}
            references={project.references}
            onChange={setLocalShots}
            disabled={shotBusy != null || renderBusy}
          />
          <div className="flex flex-wrap gap-2 pt-2">
            {localShots.map((shot) => (
              <EcomButtonSecondary
                key={shot.index}
                type="button"
                disabled={shotBusy != null}
                onClick={() => openVideoPicker({ panelIndex: shot.index })}
              >
                {shotBusy === shot.index ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : null}
                镜 {shot.index} 生成
              </EcomButtonSecondary>
            ))}
          </div>
        </section>
      ) : null}

      <StoryboardModelPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        mode="video"
        videoTarget={pickerTarget}
        panelIndex={pickerPanelIndex}
        models={filteredModels.length ? filteredModels : videoModels}
        value={videoModelKey}
        onChange={onVideoModelChange}
        onConfirm={() => void onPickerConfirm(videoModelKey)}
        durationSec={project.settings.targetDurationSec ?? 30}
        panelDurationSec={
          pickerPanelIndex != null
            ? localShots.find((s) => s.index === pickerPanelIndex)?.durationSec ?? 8
            : undefined
        }
        aspectRatio={project.settings.aspectRatio ?? "9:16"}
      />
          </div>
        )}
      </div>
    </div>
  );
}
