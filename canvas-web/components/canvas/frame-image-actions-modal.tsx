"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Mic, Play, RefreshCw, Video, X } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import type { ImageEngineNodeData } from "@/lib/canvas/types";
import {
  STORY_TTS_MODEL_KEYS,
  STORY_VIDEO_MODEL_KEYS,
} from "@/lib/canvas/types";
import {
  spawnFrameTtsForImage,
  spawnFrameVideoForImage,
  resolveFrameMediaForImage,
} from "@/lib/canvas/story-batch-spawn";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { busEnqueueNode } from "@/lib/canvas/canvas-run-bus";
import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import { EnginePicker } from "./engine-picker";
import {
  MentionsTextarea,
  type MentionableItem,
} from "./mentions/MentionsTextarea";

export type FrameImageModalTab =
  | "regenerate"
  | "video"
  | "dialogue"
  | "both";

const TAB_LABELS: Record<Exclude<FrameImageModalTab, "regenerate">, string> = {
  video: "生成视频",
  dialogue: "生成对白",
  both: "视频+对白",
};

function frameRegenerateTabLabel(hasGenerated: boolean): string {
  return hasGenerated ? "重新生成" : "分镜图生成";
}

function frameImageRunButtonLabel(
  hasGenerated: boolean,
  isGenerating: boolean,
): string {
  if (isGenerating) return "生成中…";
  if (hasGenerated) return "重新生成";
  return "分镜图生成";
}

const TAB_IDS: FrameImageModalTab[] = [
  "regenerate",
  "video",
  "dialogue",
  "both",
];

function isRunning(status?: string) {
  return status === "running" || status === "pending";
}

export function FrameImageActionsModal({
  open,
  onClose,
  initialTab,
  title,
  imageEngineId,
  data,
  prompt,
  onPromptChange,
  mentionables,
  providerId,
  modelKey,
  params,
  onPickEngine,
  isGenerating,
  hasGenerated,
  onRunRegenerate,
  onCloseAfterRun,
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: FrameImageModalTab;
  title: string;
  imageEngineId: string;
  data: ImageEngineNodeData;
  prompt: string;
  onPromptChange: (v: string) => void;
  mentionables: MentionableItem[];
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
  onPickEngine: (next: {
    providerId: string;
    modelKey: string;
    params: Record<string, unknown>;
  }) => void;
  isGenerating: boolean;
  hasGenerated: boolean;
  onRunRegenerate: (forceFresh: boolean) => void;
  /** 点击生成后关闭弹层（对齐分镜脚本节点） */
  onCloseAfterRun?: () => void;
}) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const addNodeInGroup = useCanvasStore((s) => s.addNodeInGroup);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const reparentNode = useCanvasStore((s) => s.reparentNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const reflowStoryComicLayout = useCanvasStore(
    (s) => s.reflowStoryComicLayout,
  );
  const { alert } = useDialogs();

  const [tab, setTab] = useState<FrameImageModalTab>("regenerate");
  const [mounted, setMounted] = useState(false);

  const fi = data.frameIndex;

  const { videoPromptDisplay, dialogue } = useMemo(
    () =>
      resolveFrameMediaForImage({
        imgData: data,
        nodes,
        edges,
        imageEngineId,
      }),
    [data, nodes, edges, imageEngineId],
  );
  const dialogueDisplay = dialogue.trim();

  const linkedVideo = useMemo(
    () =>
      fi == null
        ? undefined
        : nodes.find(
            (n) =>
              n.type === "video-engine" &&
              (n.data as { frameIndex?: number }).frameIndex === fi,
          ),
    [nodes, fi],
  );
  const linkedTts = useMemo(
    () =>
      fi == null
        ? undefined
        : nodes.find(
            (n) =>
              n.type === "tts-engine" &&
              (n.data as { frameIndex?: number }).frameIndex === fi,
          ),
    [nodes, fi],
  );

  const videoRunning = isRunning(
    (linkedVideo?.data as { runtime?: { status?: string } })?.runtime?.status,
  );
  const ttsRunning = isRunning(
    (linkedTts?.data as { runtime?: { status?: string } })?.runtime?.status,
  );

  const spawnBase = {
    imageEngineId,
    nodes,
    getNodes: () => useCanvasStore.getState().nodes,
    edges,
    addNode,
    addNodeInGroup,
    setEdges,
    reparentNode,
    updateNodeData,
  };

  const runNode = (nodeId: string, forceFresh: boolean) => {
    busEnqueueNode(nodeId, forceFresh);
  };

  const ensureVideo = (): string | null => {
    if (!data.frameVideo?.providerId || !data.frameVideo.modelKey) return null;
    return spawnFrameVideoForImage({
      ...spawnBase,
      videoPick: data.frameVideo,
    });
  };

  const ensureTts = (): string | null => {
    if (!data.frameTts?.providerId || !data.frameTts.modelKey) return null;
    if (!dialogueDisplay) return null;
    return spawnFrameTtsForImage({
      ...spawnBase,
      ttsPick: data.frameTts,
    });
  };

  const onGenerateVideo = async () => {
    if (!data.frameVideo?.providerId || !data.frameVideo.modelKey) {
      await alert({
        title: "请选择 VIDEO 模型",
        message: "在下方选择视频模型后再生成。",
        variant: "warning",
      });
      return;
    }
    const vidId = ensureVideo();
    if (!vidId) {
      await alert({
        title: "无法创建视频节点",
        message: "请确认已连接分镜脚本节点。",
        variant: "error",
      });
      return;
    }
    reflowStoryComicLayout();
    const hasDone =
      (linkedVideo?.data as { runtime?: { status?: string } })?.runtime
        ?.status === "done";
    runNode(vidId, Boolean(hasDone));
  };

  const onGenerateTts = async () => {
    if (!data.frameTts?.providerId || !data.frameTts.modelKey) {
      await alert({
        title: "请选择 TTS 模型",
        message: "在下方选择配音模型后再生成。",
        variant: "warning",
      });
      return;
    }
    const ttsId = ensureTts();
    if (!ttsId) {
      await alert({
        title: "无法创建配音",
        message: "本镜无对白文本，或尚未连接分镜脚本。",
        variant: "warning",
      });
      return;
    }
    reflowStoryComicLayout();
    const hasDone =
      (linkedTts?.data as { runtime?: { status?: string } })?.runtime
        ?.status === "done";
    runNode(ttsId, Boolean(hasDone));
  };

  const onGenerateBoth = async () => {
    await onGenerateVideo();
    await onGenerateTts();
  };

  const runRegenerate = (forceFresh: boolean) => {
    onRunRegenerate(forceFresh);
    onCloseAfterRun?.();
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t =
      initialTab && TAB_IDS.includes(initialTab) ? initialTab : "regenerate";
    setTab(t);
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1090] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} · 操作`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="nodrag flex max-h-[min(92dvh,820px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-white/15 bg-[var(--canvas-surface)] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{title}</p>
            <p className="text-[11px] text-[var(--canvas-muted)]">
              各 Tab 独立选模型 · 节点上仅保留摘要
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-white/10 p-1.5 text-white/70 hover:bg-white/10"
            aria-label="关闭"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 px-3 py-2">
          {TAB_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
                tab === id
                  ? "bg-[#fb923c]/20 text-[#fdba74]"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              {id === "regenerate"
                ? frameRegenerateTabLabel(hasGenerated)
                : TAB_LABELS[id]}
            </button>
          ))}
        </div>

        <div className={`${RF_NODE_SCROLL} min-h-0 flex-1 overflow-y-auto p-4`}>
          {tab === "regenerate" ? (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-[var(--canvas-muted)]">
                  Prompt
                </p>
                <MentionsTextarea
                  value={prompt}
                  onChange={onPromptChange}
                  mentionables={mentionables}
                  placeholder="分镜画面描述，@ 引用角色三视图"
                  rows={8}
                  className={`${RF_NODE_SCROLL} w-full resize-y rounded-md border border-white/10 bg-black/30 p-3 font-mono text-[12px] text-white`}
                />
              </div>
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-[var(--canvas-muted)]">
                  IMAGE 模型
                </p>
                <EnginePicker
                  role="IMAGE"
                  providerId={providerId}
                  modelKey={modelKey}
                  params={params}
                  onChange={onPickEngine}
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={!providerId || !modelKey || isGenerating}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-[#fb923c] px-3 py-2 text-[13px] font-medium text-black disabled:opacity-50"
                  onClick={() => runRegenerate(hasGenerated)}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" /> 生成中…
                    </>
                  ) : (
                    <>
                      {hasGenerated ? (
                        <RefreshCw className="size-3.5" />
                      ) : (
                        <Play className="size-3.5" />
                      )}{" "}
                      {frameImageRunButtonLabel(hasGenerated, isGenerating)}
                    </>
                  )}
                </button>
                {hasGenerated ? (
                  <button
                    type="button"
                    disabled={isGenerating}
                    className="inline-flex items-center justify-center gap-1 rounded-md border border-white/15 px-3 py-2 text-[12px] text-white/85 hover:bg-white/10 disabled:opacity-50"
                    onClick={() => runRegenerate(true)}
                  >
                    强制跳过缓存
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === "video" ? (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-[var(--canvas-muted)]">
                  视频提示
                </p>
                {videoPromptDisplay ? (
                  <p className="whitespace-pre-wrap rounded-md border border-white/10 bg-black/30 p-3 text-[13px] leading-relaxed text-white/90">
                    {videoPromptDisplay}
                  </p>
                ) : (
                  <p className="text-[12px] text-[var(--canvas-muted)]">
                    本镜暂无视频提示，可在分镜脚本中补充后重新创建分镜图节点。
                  </p>
                )}
              </div>
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-[var(--canvas-muted)]">
                  VIDEO 模型
                </p>
                <EnginePicker
                  role="VIDEO"
                  allowedModelKeys={[...STORY_VIDEO_MODEL_KEYS]}
                  providerId={data.frameVideo?.providerId ?? ""}
                  modelKey={data.frameVideo?.modelKey ?? ""}
                  params={data.frameVideo?.params ?? {}}
                  onChange={(next) =>
                    updateNodeData(imageEngineId, {
                      frameVideo: {
                        providerId: next.providerId,
                        modelKey: next.modelKey,
                        params: next.params,
                      },
                    })
                  }
                />
              </div>
              <button
                type="button"
                disabled={videoRunning}
                className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-[#fb923c] px-3 py-2 text-[13px] font-medium text-black disabled:opacity-50"
                onClick={() => void onGenerateVideo()}
              >
                {videoRunning ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" /> 生成中…
                  </>
                ) : linkedVideo ? (
                  <>
                    <RefreshCw className="size-3.5" /> 重新生成视频
                  </>
                ) : (
                  <>
                    <Video className="size-3.5" /> 生成视频
                  </>
                )}
              </button>
            </div>
          ) : null}

          {tab === "dialogue" ? (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-[var(--canvas-muted)]">
                  对白
                </p>
                {dialogueDisplay ? (
                  <p className="whitespace-pre-wrap rounded-md border border-white/10 bg-black/30 p-3 text-[13px] leading-relaxed text-white/90">
                    {dialogueDisplay}
                  </p>
                ) : (
                  <p className="text-[12px] text-[var(--canvas-muted)]">
                    本镜暂无对白文本。可在分镜脚本「台词 / 对白」列补充，或在分镜图
                    Tab 重新创建以刷新带入。
                  </p>
                )}
              </div>
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-[var(--canvas-muted)]">
                  TTS 模型
                </p>
                <EnginePicker
                  role="LLM"
                  allowedModelKeys={[...STORY_TTS_MODEL_KEYS]}
                  providerId={data.frameTts?.providerId ?? ""}
                  modelKey={data.frameTts?.modelKey ?? ""}
                  params={data.frameTts?.params ?? {}}
                  onChange={(next) =>
                    updateNodeData(imageEngineId, {
                      frameTts: {
                        providerId: next.providerId,
                        modelKey: next.modelKey,
                        params: next.params,
                      },
                    })
                  }
                />
              </div>
              <button
                type="button"
                disabled={ttsRunning || !dialogueDisplay}
                className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-[#fb923c] px-3 py-2 text-[13px] font-medium text-black disabled:opacity-50"
                onClick={() => void onGenerateTts()}
              >
                {ttsRunning ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" /> 合成中…
                  </>
                ) : linkedTts ? (
                  <>
                    <RefreshCw className="size-3.5" /> 重新合成对白
                  </>
                ) : (
                  <>
                    <Mic className="size-3.5" /> 生成对白
                  </>
                )}
              </button>
            </div>
          ) : null}

          {tab === "both" ? (
            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <p className="mb-2 text-[11px] uppercase tracking-wider text-[var(--canvas-muted)]">
                    视频提示
                  </p>
                  {videoPromptDisplay ? (
                    <p className="whitespace-pre-wrap rounded-md border border-white/10 bg-black/30 p-3 text-[13px] leading-relaxed text-white/90">
                      {videoPromptDisplay}
                    </p>
                  ) : (
                    <p className="text-[12px] text-[var(--canvas-muted)]">
                      本镜暂无视频提示。
                    </p>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-[11px] uppercase tracking-wider text-[var(--canvas-muted)]">
                    对白
                  </p>
                  {dialogueDisplay ? (
                    <p className="whitespace-pre-wrap rounded-md border border-white/10 bg-black/30 p-3 text-[13px] leading-relaxed text-white/90">
                      {dialogueDisplay}
                    </p>
                  ) : (
                    <p className="text-[12px] text-[var(--canvas-muted)]">
                      本镜暂无对白文本。
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-[11px] uppercase tracking-wider text-[var(--canvas-muted)]">
                    VIDEO 模型
                  </p>
                  <EnginePicker
                    role="VIDEO"
                    allowedModelKeys={[...STORY_VIDEO_MODEL_KEYS]}
                    providerId={data.frameVideo?.providerId ?? ""}
                    modelKey={data.frameVideo?.modelKey ?? ""}
                    params={data.frameVideo?.params ?? {}}
                    onChange={(next) =>
                      updateNodeData(imageEngineId, {
                        frameVideo: {
                          providerId: next.providerId,
                          modelKey: next.modelKey,
                          params: next.params,
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <p className="mb-2 text-[11px] uppercase tracking-wider text-[var(--canvas-muted)]">
                    TTS 模型
                  </p>
                  <EnginePicker
                    role="LLM"
                    allowedModelKeys={[...STORY_TTS_MODEL_KEYS]}
                    providerId={data.frameTts?.providerId ?? ""}
                    modelKey={data.frameTts?.modelKey ?? ""}
                    params={data.frameTts?.params ?? {}}
                    onChange={(next) =>
                      updateNodeData(imageEngineId, {
                        frameTts: {
                          providerId: next.providerId,
                          modelKey: next.modelKey,
                          params: next.params,
                      },
                    })
                  }
                />
                </div>
              </div>
              <button
                type="button"
                disabled={videoRunning || ttsRunning || !dialogueDisplay}
                className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-[#fb923c] px-3 py-2 text-[13px] font-medium text-black disabled:opacity-50"
                onClick={() => void onGenerateBoth()}
              >
                {videoRunning || ttsRunning ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" /> 生成中…
                  </>
                ) : (
                  <>
                    <Play className="size-3.5" /> 视频 + 对白
                  </>
                )}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
