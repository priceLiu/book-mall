"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { ModalPortal } from "@/components/common/modal-portal";
import {
  STORY_VIDEO_MODEL_LIST,
  getStoryVideoModel,
} from "@/lib/projects/video-models";
import type {
  StoryVideoModelId,
  StoryVideoOptions,
} from "@/lib/projects/api";
import { cn } from "@/lib/utils";

export type FrameVideoEditValue = {
  prompt: string;
  modelId: StoryVideoModelId;
  options: Required<
    Pick<StoryVideoOptions, "resolution" | "duration">
  > &
    StoryVideoOptions;
};

type Props = {
  open: boolean;
  /** 弹层标题，例如「分镜 2 · 视频生成」 */
  title: string;
  /** 当前 prompt（仅 frame.videoPrompt） */
  prompt: string;
  /** 已有视频时是否禁用「保存并立即生成」 */
  hasVideo: boolean;
  /** 是否有进行中的视频任务（用于禁用提交） */
  videoInflight: boolean;
  /** 是否有 frame.imageUrl（image-to-video 模型必需） */
  hasFrameImage: boolean;
  /** 该 frame 上次提交所用模型 id */
  initialModelId?: string | null;

  onClose: () => void;
  /** 仅保存 prompt（不提交生成）。返回 Promise 时弹层显示进度 */
  onSavePrompt: (prompt: string) => void | Promise<void>;
  /** 保存 prompt 并立即提交生成 */
  onSubmit: (value: FrameVideoEditValue) => void | Promise<void>;
};

export function FrameVideoEditModal({
  open,
  title,
  prompt,
  hasVideo,
  videoInflight,
  hasFrameImage,
  initialModelId,
  onClose,
  onSavePrompt,
  onSubmit,
}: Props) {
  const initialModel = useMemo(
    () => getStoryVideoModel(initialModelId),
    [initialModelId],
  );

  const [draft, setDraft] = useState(prompt);
  const [modelId, setModelId] = useState<StoryVideoModelId>(initialModel.id);
  const [resolution, setResolution] = useState<string>(
    initialModel.defaults.resolution,
  );
  const [duration, setDuration] = useState<number>(
    initialModel.defaults.duration,
  );
  const [generateAudio, setGenerateAudio] = useState<boolean>(
    initialModel.defaults.generateAudio ?? false,
  );
  const [promptExtend, setPromptExtend] = useState<boolean>(
    initialModel.defaults.promptExtend ?? true,
  );
  const [watermark, setWatermark] = useState<boolean>(
    initialModel.defaults.watermark ?? false,
  );

  const [busy, setBusy] = useState<null | "save" | "submit">(null);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const desc = STORY_VIDEO_MODEL_LIST.find((m) => m.id === modelId)!;

  // open / 初始值变更时重置
  useEffect(() => {
    if (!open) return;
    setDraft(prompt);
    const m = getStoryVideoModel(initialModelId);
    setModelId(m.id);
    setResolution(m.defaults.resolution);
    setDuration(m.defaults.duration);
    setGenerateAudio(m.defaults.generateAudio ?? false);
    setPromptExtend(m.defaults.promptExtend ?? true);
    setWatermark(m.defaults.watermark ?? false);
    setBusy(null);
    setHint(null);
    setError(null);
  }, [open, prompt, initialModelId]);

  // 切换模型时按新模型 defaults 重置参数
  const handleSelectModel = (id: StoryVideoModelId) => {
    if (id === modelId) return;
    const m = STORY_VIDEO_MODEL_LIST.find((x) => x.id === id)!;
    setModelId(id);
    setResolution(m.defaults.resolution);
    setDuration(m.defaults.duration);
    setGenerateAudio(m.defaults.generateAudio ?? false);
    setPromptExtend(m.defaults.promptExtend ?? true);
    setWatermark(m.defaults.watermark ?? false);
  };

  // ESC 关闭 + body 锁滚
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  const draftEmpty = !draft.trim();
  const isBusy = busy !== null;
  const cannotSubmit =
    isBusy ||
    draftEmpty ||
    videoInflight ||
    (desc.requiresImage && !hasFrameImage);
  const submitDisabledHint = videoInflight
    ? "已有进行中的视频任务"
    : desc.requiresImage && !hasFrameImage
      ? "该模型需要先生成分镜图"
      : undefined;

  const buildOptions = (): StoryVideoOptions => {
    const o: StoryVideoOptions = { resolution, duration };
    if (desc.supports.generateAudio) o.generateAudio = generateAudio;
    if (desc.supports.promptExtend) o.promptExtend = promptExtend;
    if (desc.supports.watermark) o.watermark = watermark;
    return o;
  };

  const runWith = async (
    kind: "save" | "submit",
    successLabel: string,
    fn: () => void | Promise<void>,
  ) => {
    if (busy) return;
    setBusy(kind);
    setError(null);
    try {
      await fn();
      setHint(successLabel);
      setTimeout(() => {
        setHint(null);
        onClose();
      }, 600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(null);
    }
  };

  const handleSave = () =>
    runWith("save", "已保存", () => onSavePrompt(draft.trim()));

  const handleSubmit = () =>
    runWith("submit", "已提交生成", () =>
      onSubmit({
        prompt: draft.trim(),
        modelId,
        options: buildOptions() as FrameVideoEditValue["options"],
      }),
    );

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (!isBusy) onClose();
      }}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 bg-[var(--story-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h3 className="font-medium text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="text-[var(--story-muted)] transition hover:text-white disabled:opacity-50"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {/* 模型选择 */}
          <div>
            <p className="mb-2 text-xs text-[var(--story-muted)]">视频模型</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {STORY_VIDEO_MODEL_LIST.map((m) => {
                const selected = m.id === modelId;
                const disabled = m.requiresImage && !hasFrameImage;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => !disabled && handleSelectModel(m.id)}
                    disabled={isBusy || disabled}
                    title={
                      disabled
                        ? "该模型需要先生成分镜图"
                        : undefined
                    }
                    className={cn(
                      "flex flex-col rounded-lg border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                      selected
                        ? "border-white bg-white/[.06]"
                        : "border-white/15 hover:border-white/40 hover:bg-white/[.03]",
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-white">
                      {m.label}
                      <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-normal text-[var(--story-muted)]">
                        {m.requiresImage ? "图生视频" : "文生视频"}
                      </span>
                    </span>
                    <span className="mt-1 text-xs text-[var(--story-muted)]">
                      {m.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 提示词 */}
          <div>
            <label className="block text-xs text-[var(--story-muted)]">
              提示词（仅描述运动 / 镜头 / 节奏，不要重复风格）
            </label>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={isBusy}
              rows={6}
              className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm leading-6 text-white outline-none focus:ring-1 focus:ring-[var(--story-accent)] disabled:opacity-60"
            />
          </div>

          {/* 参数行 */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-[var(--story-muted)]">
                分辨率
              </label>
              <div className="mt-2 inline-flex overflow-hidden rounded-lg border border-white/15">
                {desc.resolutions.map((r) => (
                  <button
                    key={r}
                    type="button"
                    disabled={isBusy}
                    onClick={() => setResolution(r)}
                    className={cn(
                      "px-3 py-1.5 text-sm transition",
                      resolution === r
                        ? "bg-white text-black"
                        : "text-white/85 hover:bg-white/5",
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-[var(--story-muted)]">
                时长（{desc.durationRange[0]}~{desc.durationRange[1]} 秒）
              </label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={desc.durationRange[0]}
                  max={desc.durationRange[1]}
                  step={1}
                  value={duration}
                  disabled={isBusy}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="flex-1 accent-white"
                />
                <span className="min-w-[3.5rem] rounded-md border border-white/15 px-2 py-1 text-center text-xs text-white/85">
                  {duration} s
                </span>
              </div>
              <p className="mt-1 text-[10px] text-[var(--story-muted)]">
                时长越长，KIE 积分消耗越高。预览推荐 5 秒。
              </p>
            </div>
          </div>

          {/* 模型特定开关 */}
          {(desc.supports.generateAudio ||
            desc.supports.promptExtend ||
            desc.supports.watermark) && (
            <div className="grid gap-3 rounded-lg border border-white/10 bg-black/20 p-3 sm:grid-cols-2">
              {desc.supports.generateAudio ? (
                <label className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={generateAudio}
                    disabled={isBusy}
                    onChange={(e) => setGenerateAudio(e.target.checked)}
                    className="mt-0.5 accent-white"
                  />
                  <span>
                    <span className="font-medium text-white">生成 AI 配音</span>
                    <span className="ml-1 text-[var(--story-muted)]">
                      （会增加积分消耗）
                    </span>
                  </span>
                </label>
              ) : null}
              {desc.supports.promptExtend ? (
                <label className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={promptExtend}
                    disabled={isBusy}
                    onChange={(e) => setPromptExtend(e.target.checked)}
                    className="mt-0.5 accent-white"
                  />
                  <span>
                    <span className="font-medium text-white">
                      启用提示词优化
                    </span>
                    <span className="ml-1 text-[var(--story-muted)]">
                      （Wan 内置 prompt enhancer）
                    </span>
                  </span>
                </label>
              ) : null}
              {desc.supports.watermark ? (
                <label className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={watermark}
                    disabled={isBusy}
                    onChange={(e) => setWatermark(e.target.checked)}
                    className="mt-0.5 accent-white"
                  />
                  <span>
                    <span className="font-medium text-white">显示水印</span>
                  </span>
                </label>
              ) : null}
            </div>
          )}

          {error ? (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          ) : null}
          {hint ? (
            <p className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
              <Check className="size-3" />
              {hint}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white transition hover:bg-white/5 disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isBusy || draftEmpty}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white transition hover:bg-white/5 disabled:opacity-60"
            >
              {busy === "save" ? (
                <span className="inline-flex items-center">
                  <Loader2 className="mr-2 size-3 animate-spin" />
                  保存中…
                </span>
              ) : (
                "仅保存"
              )}
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={cannotSubmit}
              title={submitDisabledHint}
              className="twenty-btn !rounded-lg disabled:opacity-60"
            >
              {busy === "submit" ? (
                <span className="inline-flex items-center">
                  <Loader2 className="mr-2 size-3 animate-spin" />
                  提交中…
                </span>
              ) : hasVideo ? (
                "保存并重新生成视频"
              ) : (
                "保存并生成视频"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
