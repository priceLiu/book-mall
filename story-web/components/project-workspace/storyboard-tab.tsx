"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight, Loader2, RefreshCcw, Sparkles, Timer, Trash2 } from "lucide-react";
import { PromptEditModal } from "@/components/project-workspace/prompt-edit-modal";
import {
  FrameVideoEditModal,
  type FrameVideoEditValue,
} from "@/components/project-workspace/frame-video-edit-modal";
import { MediaPlaceholder } from "@/components/project-workspace/media-placeholder";
import { MediaHoverActions } from "@/components/project-workspace/media-hover-actions";
import { MediaLightbox } from "@/components/project-workspace/media-lightbox";
import { DestructiveConfirmModal } from "@/components/common/destructive-confirm-modal";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  apiDeleteFrame,
  apiGenerateStoryboard,
  apiPatchFrame,
  apiSubmitFrameImage,
  apiSubmitFrameVideo,
  BookMallApiError,
  STORYBOARD_FRAME_COUNT_OPTIONS,
  type StoryboardFrameCount,
  type StoryVideoModelId,
  type StoryVideoOptions,
} from "@/lib/projects/api";
import type { ComicProject, StoryboardFrame } from "@/lib/projects/types";
import { formatStoryTaskError } from "@/lib/friendly-task-error";
import { storyApiErrorText } from "@/lib/story-api-error-message";
import { cn } from "@/lib/utils";
import {
  formatCostMs,
  getStoryVideoModelLabel,
} from "@/lib/projects/video-models";

type ImagePromptTarget = {
  frameId: string;
  title: string;
  value: string;
  /** 是否已有图（决定按钮文案） */
  existing: boolean;
  canGenerate: boolean;
  disabledHint?: string;
};

type VideoEditTarget = {
  frameId: string;
  index: number;
  videoPrompt: string;
  hasVideo: boolean;
  videoInflight: boolean;
  hasFrameImage: boolean;
  initialModelId: string | null;
};

type Props = {
  project: ComicProject;
  onProjectChange: (project: ComicProject) => void;
  reload: () => Promise<void>;
};

/**
 * 进行中 / 失败状态：pendingTasks + frame.*TaskStatus 双通道（提交时已回写 *TaskId）。
 */
function hasPendingFor(
  pendingTasks: ComicProject["pendingTasks"],
  frameId: string,
  kind: "FRAME_IMAGE" | "FRAME_VIDEO",
): boolean {
  return pendingTasks.some(
    (t) =>
      t.frameId === frameId &&
      t.kind === kind &&
      (t.status === "PENDING" || t.status === "SUBMITTED"),
  );
}

function isFrameImageInflight(
  pendingTasks: ComicProject["pendingTasks"],
  frame: StoryboardFrame,
): boolean {
  return (
    hasPendingFor(pendingTasks, frame.id, "FRAME_IMAGE") ||
    frame.imageTaskStatus === "PENDING" ||
    frame.imageTaskStatus === "SUBMITTED"
  );
}

function isFrameVideoInflight(
  pendingTasks: ComicProject["pendingTasks"],
  frame: StoryboardFrame,
): boolean {
  return (
    hasPendingFor(pendingTasks, frame.id, "FRAME_VIDEO") ||
    frame.videoTaskStatus === "PENDING" ||
    frame.videoTaskStatus === "SUBMITTED"
  );
}

function isFrameImageFailed(frame: StoryboardFrame): boolean {
  return frame.imageTaskStatus === "FAILED";
}

function isFrameVideoFailed(frame: StoryboardFrame): boolean {
  return frame.videoTaskStatus === "FAILED";
}

type LightboxRequest = {
  kind: "image" | "video";
  src: string;
  poster?: string;
  caption: string;
  alt?: string;
};

function FrameCard({
  frame,
  project,
  characters,
  onEditImagePrompt,
  onEditVideo,
  onPreview,
  onSubmitImage,
  onDeleteFrame,
  busyImageId,
  busyVideoId,
}: {
  frame: StoryboardFrame;
  project: ComicProject;
  characters: Map<string, string>;
  onEditImagePrompt: (target: ImagePromptTarget) => void;
  onEditVideo: (target: VideoEditTarget) => void;
  onPreview: (req: LightboxRequest) => void;
  /** 仅图片走一键提交；视频统一走 onEditVideo 弹层（让用户先选模型/参数） */
  onSubmitImage: (frameId: string) => Promise<void>;
  onDeleteFrame: (frame: StoryboardFrame) => void;
  busyImageId: string | null;
  busyVideoId: string | null;
}) {
  const aspectRatioStyle =
    project.aspectRatio === "9:16" ? ("9 / 16" as const) : ("16 / 9" as const);

  const imgInflight = isFrameImageInflight(project.pendingTasks, frame);
  const vidInflight = isFrameVideoInflight(project.pendingTasks, frame);
  const imgFailed = isFrameImageFailed(frame);
  const vidFailed = isFrameVideoFailed(frame);
  const imgFailReason = imgFailed
    ? { failCode: frame.imageTaskFailCode, failMessage: frame.imageTaskFailMessage }
    : null;
  const vidFailReason = vidFailed
    ? { failCode: frame.videoTaskFailCode, failMessage: frame.videoTaskFailMessage }
    : null;
  const imgBusy = busyImageId === frame.id || imgInflight;
  const vidBusy = busyVideoId === frame.id || vidInflight;

  const canGenerateVideo = !!frame.imageUrl && !vidBusy;

  const imageCostLabel = formatCostMs(frame.imageCostMs);
  const videoCostLabel = formatCostMs(frame.videoCostMs);
  const videoModelLabel = getStoryVideoModelLabel(frame.videoModelId);

  const editImage = () =>
    onEditImagePrompt({
      frameId: frame.id,
      title: `分镜 ${frame.index} · 图片提示词`,
      value: frame.imagePrompt,
      existing: !!frame.imageUrl,
      canGenerate: !imgInflight,
      disabledHint: imgInflight ? "正在生成中…" : undefined,
    });
  const editVideo = () =>
    onEditVideo({
      frameId: frame.id,
      index: frame.index,
      videoPrompt: frame.videoPrompt,
      hasVideo: !!frame.videoUrl,
      videoInflight: vidInflight,
      hasFrameImage: !!frame.imageUrl,
      initialModelId: frame.videoModelId,
    });

  const previewImage = () => {
    if (!frame.imageUrl) return editImage();
    onPreview({
      kind: "image",
      src: frame.imageUrl,
      caption: `分镜 ${frame.index} · ${frame.sceneText}`,
      alt: frame.sceneText,
    });
  };
  const previewVideo = () => {
    if (!frame.videoUrl) return editVideo();
    onPreview({
      kind: "video",
      src: frame.videoUrl,
      poster: frame.imageUrl || undefined,
      caption: `分镜 ${frame.index} · ${frame.sceneText}`,
    });
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-[var(--story-surface)]">
      <div className="flex">
        <div className="flex w-[28%] min-w-[200px] max-w-[260px] shrink-0 flex-col gap-3 border-r border-white/10 p-4">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="shrink-0 text-xs font-medium text-[var(--story-muted)]">
              分镜 {frame.index} · 文本
            </p>
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
              <p className="text-sm font-medium leading-relaxed text-white">
                {frame.sceneText}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--story-muted)]">
                {frame.sceneDescription}
              </p>
            </div>
          </div>

          <div className="shrink-0 rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs font-medium text-[var(--story-muted)]">角色</p>
            <ul className="mt-2 space-y-1">
              {frame.characterIds.length === 0 ? (
                <li className="text-xs text-[var(--story-muted)]">—</li>
              ) : (
                frame.characterIds.map((id) => (
                  <li key={id} className="truncate text-xs text-white/90">
                    {characters.get(id) ?? "未知角色"}
                  </li>
                ))
              )}
            </ul>
          </div>
          <button
            type="button"
            onClick={() => onDeleteFrame(frame)}
            className="inline-flex items-center justify-center gap-1 self-start rounded-md border border-white/15 px-2 py-0.5 text-[11px] text-white/70 transition hover:border-red-400/60 hover:text-red-300"
          >
            <Trash2 className="size-3" />
            删除该分镜
          </button>
        </div>

        <div className="flex flex-1 items-center gap-3 p-4">
          {/* IMAGE column - 50% */}
          <div className="flex min-w-0 flex-1 flex-col items-stretch gap-2">
            <div
              className="group relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black"
              style={{ aspectRatio: aspectRatioStyle }}
            >
              <MediaHoverActions
                kind="image"
                hasPreview={!!frame.imageUrl}
                onEdit={editImage}
                onPreview={previewImage}
              />
              <button
                type="button"
                onClick={previewImage}
                className="absolute inset-0 cursor-pointer"
                aria-label={
                  frame.imageUrl ? "全屏预览分镜图" : "编辑分镜图提示词"
                }
              >
                <span className="sr-only">分镜图</span>
              </button>
              {frame.imageUrl ? (
                <Image
                  src={frame.imageUrl}
                  alt={frame.sceneText}
                  fill
                  sizes="(max-width: 768px) 50vw, 30vw"
                  className="pointer-events-none object-cover"
                  unoptimized
                />
              ) : (
                <MediaPlaceholder
                  fallbackUrl={project.styleFallbackUrl}
                  state={imgInflight ? "loading" : imgFailed ? "failed" : "empty"}
                  failedReason={formatStoryTaskError(
                    imgFailReason?.failCode,
                    imgFailReason?.failMessage,
                  )}
                  failedCode={imgFailReason?.failCode}
                />
              )}
              <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-md bg-black/55 px-2 py-0.5 text-[10px] text-white">
                分镜图
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={imgBusy}
                onClick={() => void onSubmitImage(frame.id)}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-white/15 bg-black/20 px-2.5 py-1 text-[11px] text-white transition hover:bg-white/5 disabled:opacity-60"
              >
                {imgBusy ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : frame.imageUrl ? (
                  <RefreshCcw className="size-3" />
                ) : (
                  <Sparkles className="size-3" />
                )}
                {frame.imageUrl ? "重新生成图" : "生成分镜图"}
              </button>
              {imageCostLabel ? (
                <span
                  className="inline-flex items-center gap-1 text-[10px] text-[var(--story-muted)]"
                  title={`KIE costTime: ${frame.imageCostMs} ms`}
                >
                  <Timer className="size-3" />
                  {imageCostLabel}
                </span>
              ) : null}
            </div>
          </div>

          <ArrowRight
            className="size-5 shrink-0 self-center text-[var(--story-muted)]"
            aria-hidden
          />

          {/* VIDEO column - 50% */}
          <div className="flex min-w-0 flex-1 flex-col items-stretch gap-2">
            <div
              className="group relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black"
              style={{ aspectRatio: aspectRatioStyle }}
            >
              <MediaHoverActions
                kind="video"
                hasPreview={!!frame.videoUrl}
                onEdit={editVideo}
                onPreview={previewVideo}
              />
              <button
                type="button"
                onClick={previewVideo}
                className="absolute inset-0 cursor-pointer"
                aria-label={
                  frame.videoUrl ? "全屏播放分镜视频" : "编辑分镜视频提示词"
                }
              >
                <span className="sr-only">分镜视频</span>
              </button>
              {frame.videoUrl ? (
                <video
                  className="pointer-events-none h-full w-full object-cover"
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  poster={frame.imageUrl || undefined}
                >
                  <source src={frame.videoUrl} type="video/mp4" />
                </video>
              ) : (
                <MediaPlaceholder
                  fallbackUrl={frame.imageUrl || project.styleFallbackUrl}
                  state={vidInflight ? "loading" : vidFailed ? "failed" : "empty"}
                  loadingLabel="视频生成中…"
                  emptyLabel={!frame.imageUrl ? "先生成分镜图" : "尚未生成"}
                  failedReason={formatStoryTaskError(
                    vidFailReason?.failCode,
                    vidFailReason?.failMessage,
                  )}
                  failedCode={vidFailReason?.failCode}
                />
              )}
              <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-md bg-black/55 px-2 py-0.5 text-[10px] text-white">
                分镜视频
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={!canGenerateVideo}
                onClick={editVideo}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-md border border-white/15 bg-black/20 px-2.5 py-1 text-[11px] text-white transition hover:bg-white/5 disabled:opacity-60",
                )}
                title={
                  !frame.imageUrl
                    ? "需先生成分镜图"
                    : vidInflight
                      ? "正在生成中…"
                      : undefined
                }
              >
                {vidBusy ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : frame.videoUrl ? (
                  <RefreshCcw className="size-3" />
                ) : (
                  <Sparkles className="size-3" />
                )}
                {frame.videoUrl ? "重新生成视频" : "生成分镜视频"}
              </button>
              {videoCostLabel || videoModelLabel ? (
                <span
                  className="inline-flex items-center gap-1 text-[10px] text-[var(--story-muted)]"
                  title={
                    frame.videoCostMs != null
                      ? `KIE costTime: ${frame.videoCostMs} ms`
                      : undefined
                  }
                >
                  <Timer className="size-3" />
                  {[videoModelLabel, videoCostLabel]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function StoryboardTab({ project, onProjectChange, reload }: Props) {
  const base = useBookMallBaseUrl();
  const [imagePromptTarget, setImagePromptTarget] =
    useState<ImagePromptTarget | null>(null);
  const [videoEditTarget, setVideoEditTarget] =
    useState<VideoEditTarget | null>(null);
  const [count, setCount] = useState<StoryboardFrameCount>(5);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [busyImageId, setBusyImageId] = useState<string | null>(null);
  const [busyVideoId, setBusyVideoId] = useState<string | null>(null);
  const [frameError, setFrameError] = useState<string | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmDeleteFrame, setConfirmDeleteFrame] = useState<StoryboardFrame | null>(
    null,
  );
  const [lightbox, setLightbox] = useState<LightboxRequest | null>(null);

  const characterMap = new Map(
    project.characters.map((c) => [c.id, c.name] as const),
  );
  const frames = project.storyboardFrames;

  const initialReady =
    project.storyOutline.trim().length > 0 && project.characters.length > 0;

  const handleGenerate = async (force: boolean) => {
    if (!base) {
      setGenError("Book mall 地址未配置。");
      return;
    }
    setGenerating(true);
    setGenError(null);
    try {
      const r = await apiGenerateStoryboard(base, project.id, { count, force });
      onProjectChange({
        ...r.project,
        characters: r.project.characters,
        storyboardFrames: r.project.frames,
        pendingTasks: r.project.pendingTasks,
      });
    } catch (e) {
      const text =
        e instanceof BookMallApiError
          ? storyApiErrorText(e.code, e.message)
          : e instanceof Error
            ? e.message
            : "生成失败，请稍后重试";
      setGenError(text);
      void reload();
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmitImage = async (frameId: string) => {
    if (!base) return;
    setBusyImageId(frameId);
    setFrameError(null);
    try {
      await apiSubmitFrameImage(base, project.id, frameId);
    } catch (e) {
      setFrameError(
        e instanceof BookMallApiError
          ? storyApiErrorText(e.code, e.message)
          : e instanceof Error
            ? e.message
            : "提交失败",
      );
    } finally {
      setBusyImageId(null);
      void reload();
    }
  };

  const handleSubmitVideo = async (
    frameId: string,
    args: { modelId?: StoryVideoModelId; options?: StoryVideoOptions } = {},
  ) => {
    if (!base) return;
    setBusyVideoId(frameId);
    setFrameError(null);
    try {
      await apiSubmitFrameVideo(base, project.id, frameId, {
        modelId: args.modelId,
        options: args.options,
      });
    } catch (e) {
      setFrameError(
        e instanceof BookMallApiError
          ? storyApiErrorText(e.code, e.message)
          : e instanceof Error
            ? e.message
            : "提交失败",
      );
      throw e;
    } finally {
      setBusyVideoId(null);
      void reload();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-white">分镜设定</h2>
          <p className="mt-1 text-sm text-[var(--story-muted)]">
            左栏为文本与角色，中间为分镜图，右侧为分镜视频；点击媒体可编辑提示词。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-[var(--story-muted)]">
            分镜数
            <select
              value={count}
              onChange={(e) =>
                setCount(Number(e.target.value) as StoryboardFrameCount)
              }
              disabled={generating}
              className="rounded-md border border-white/15 bg-black/40 px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-[var(--story-accent)] disabled:opacity-60"
            >
              {STORYBOARD_FRAME_COUNT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          {frames.length === 0 ? (
            <button
              type="button"
              disabled={!initialReady || generating}
              onClick={() => void handleGenerate(false)}
              className="twenty-btn shrink-0 disabled:opacity-60"
              title={
                initialReady ? undefined : "请先在「故事设定」中完成 AI 初始化"
              }
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  AI 出分镜中…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 size-4" />
                  一键出分镜
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled={generating}
              onClick={() => setConfirmRegenerate(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 text-xs text-white transition hover:border-red-400/60 hover:text-red-300 disabled:opacity-60"
            >
              <RefreshCcw className="size-3" />
              重新生成全部分镜
            </button>
          )}
        </div>
      </div>

      {genError ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {genError}
        </p>
      ) : null}
      {frameError ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {frameError}
        </p>
      ) : null}

      {frames.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 py-20 text-center">
          <p className="text-[var(--story-muted)]">
            {initialReady
              ? "暂无分镜，选择数量后点击「一键出分镜」。"
              : "请先在「故事设定」中完成一键初始化。"}
          </p>
        </div>
      ) : (
        <ul className="space-y-5">
          {frames.map((frame) => (
            <li key={frame.id}>
              <FrameCard
                frame={frame}
                project={project}
                characters={characterMap}
                onEditImagePrompt={setImagePromptTarget}
                onEditVideo={setVideoEditTarget}
                onPreview={setLightbox}
                onSubmitImage={handleSubmitImage}
                onDeleteFrame={(f) => setConfirmDeleteFrame(f)}
                busyImageId={busyImageId}
                busyVideoId={busyVideoId}
              />
            </li>
          ))}
        </ul>
      )}

      <PromptEditModal
        open={!!imagePromptTarget}
        title={imagePromptTarget?.title ?? ""}
        value={imagePromptTarget?.value ?? ""}
        onClose={() => setImagePromptTarget(null)}
        onSave={async (val) => {
          if (!imagePromptTarget) return;
          if (!base) throw new Error("Book mall 地址未配置。");
          const target = imagePromptTarget;
          try {
            await apiPatchFrame(base, project.id, target.frameId, {
              imagePrompt: val,
            });
          } catch (e) {
            if (e instanceof BookMallApiError) {
              throw new Error(`${e.code}: ${e.message}`);
            }
            throw e;
          }
          void reload();
        }}
        extraSubmit={
          imagePromptTarget
            ? {
                label: imagePromptTarget.existing
                  ? "保存并重新生成图"
                  : "保存并生成图",
                savingLabel: "提交中…",
                successLabel: "已提交生成",
                disabled: !imagePromptTarget.canGenerate,
                disabledTitle: imagePromptTarget.disabledHint,
                onClick: async (val) => {
                  if (!imagePromptTarget) return;
                  if (!base) throw new Error("Book mall 地址未配置。");
                  const target = imagePromptTarget;
                  try {
                    await apiPatchFrame(base, project.id, target.frameId, {
                      imagePrompt: val,
                    });
                    await apiSubmitFrameImage(base, project.id, target.frameId);
                  } catch (e) {
                    if (e instanceof BookMallApiError) {
                      throw new Error(`${e.code}: ${e.message}`);
                    }
                    throw e;
                  }
                  void reload();
                },
              }
            : undefined
        }
      />

      <FrameVideoEditModal
        open={!!videoEditTarget}
        title={
          videoEditTarget
            ? `分镜 ${videoEditTarget.index} · 视频生成`
            : ""
        }
        prompt={videoEditTarget?.videoPrompt ?? ""}
        hasVideo={videoEditTarget?.hasVideo ?? false}
        videoInflight={videoEditTarget?.videoInflight ?? false}
        hasFrameImage={videoEditTarget?.hasFrameImage ?? false}
        initialModelId={videoEditTarget?.initialModelId}
        onClose={() => setVideoEditTarget(null)}
        onSavePrompt={async (val) => {
          if (!videoEditTarget) return;
          if (!base) throw new Error("Book mall 地址未配置。");
          try {
            await apiPatchFrame(base, project.id, videoEditTarget.frameId, {
              videoPrompt: val,
            });
          } catch (e) {
            if (e instanceof BookMallApiError) {
              throw new Error(`${e.code}: ${e.message}`);
            }
            throw e;
          }
          void reload();
        }}
        onSubmit={async (value: FrameVideoEditValue) => {
          if (!videoEditTarget) return;
          if (!base) throw new Error("Book mall 地址未配置。");
          const frameId = videoEditTarget.frameId;
          try {
            await apiPatchFrame(base, project.id, frameId, {
              videoPrompt: value.prompt,
            });
            await handleSubmitVideo(frameId, {
              modelId: value.modelId,
              options: value.options,
            });
          } catch (e) {
            if (e instanceof BookMallApiError) {
              throw new Error(`${e.code}: ${e.message}`);
            }
            throw e;
          }
        }}
      />

      <DestructiveConfirmModal
        open={confirmRegenerate}
        content={{
          step1Title: "重新生成全部分镜",
          step1Body: (
            <>
              <p>将根据当前大纲与角色，重新生成共 {count} 个分镜。</p>
              <p className="text-xs text-[var(--story-muted)]">
                影响范围：当前 {frames.length} 个分镜的文本与所有已生成的分镜图、分镜视频。
              </p>
            </>
          ),
          step1ConfirmLabel: "下一步",
          step2Title: "确认重新生成？此操作不可恢复",
          step2Body: (
            <>
              <p className="text-red-300">
                以下数据将被清除且不可恢复：
              </p>
              <ul className="list-inside list-disc text-sm text-white/85">
                <li>当前所有分镜的文本与提示词</li>
                <li>所有已生成的分镜图与分镜视频（云端存储 OSS）</li>
                <li>正在进行中的分镜任务（将被取消）</li>
              </ul>
              <p className="text-xs text-[var(--story-muted)]">
                封面与角色头像不会被影响。
              </p>
            </>
          ),
          step2ConfirmLabel: "确认重新生成",
        }}
        onCancel={() => setConfirmRegenerate(false)}
        onConfirm={async () => {
          await handleGenerate(true);
          setConfirmRegenerate(false);
        }}
      />

      <DestructiveConfirmModal
        open={!!confirmDeleteFrame}
        content={{
          step1Title: `删除分镜 ${confirmDeleteFrame?.index ?? ""}`,
          step1Body: (
            <>
              <p>将从分镜列表中移除此分镜。</p>
              <p className="text-xs text-[var(--story-muted)]">
                场景：{confirmDeleteFrame?.sceneText ?? "—"}
              </p>
            </>
          ),
          step2Title: "确认删除？此操作不可恢复",
          step2Body: (
            <>
              <p className="text-red-300">删除后不可恢复。</p>
              <p className="text-sm text-white/85">
                该分镜对应的分镜图与分镜视频（云端存储 OSS）将一并清理。
              </p>
            </>
          ),
        }}
        onCancel={() => setConfirmDeleteFrame(null)}
        onConfirm={async () => {
          if (!base || !confirmDeleteFrame) return;
          try {
            await apiDeleteFrame(base, project.id, confirmDeleteFrame.id);
          } catch (e) {
            setFrameError(
              e instanceof BookMallApiError
                ? `${e.code}: ${e.message}`
                : e instanceof Error
                  ? e.message
                  : "删除失败",
            );
          }
          setConfirmDeleteFrame(null);
          void reload();
        }}
      />

      <MediaLightbox
        open={!!lightbox}
        kind={lightbox?.kind ?? "image"}
        src={lightbox?.src}
        poster={lightbox?.poster}
        alt={lightbox?.alt}
        caption={lightbox?.caption}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}
