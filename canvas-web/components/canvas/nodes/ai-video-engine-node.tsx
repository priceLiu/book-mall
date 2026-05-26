"use client";

import { useEffect, useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Video } from "lucide-react";
import Image from "next/image";

import { useCanvasStore } from "@/lib/canvas/store";
import type { AiVideoEngineNodeData } from "@/lib/canvas/types";
import {
  REF_VIDEO_MODEL_KEYS,
  REF_VIDEO_NODE_SIZE,
} from "@/lib/canvas/ref-video-models";
import { collectRefImageUrlsFromGridNode } from "@/lib/canvas/ref-video-edges";
import { directPredecessors } from "@/lib/canvas/topo";
import { pickDefaultRefVideoEngine } from "@/lib/canvas/system-providers";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { useNodeTaskHistory } from "@/lib/canvas/use-node-task-history";
import { pickTaskResultMediaUrl } from "@/lib/canvas/task-media-url";
import { NodeShell } from "../node-shell";
import { CanvasPromptTextarea } from "../canvas-prompt-textarea";
import { CanvasVideoPreviewSlot } from "../canvas-video-preview-slot";
import { StoryMediaPreviewModal } from "../story-column-media-panel";
import { EnginePicker } from "../engine-picker";
import { EnginePreviewTrigger } from "../engine-preview-trigger";
import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import {
  NodeEngineFooter,
  NodeEngineShellFooter,
} from "../node-ui";

const REF_VIDEO_PROMPT_CLASS = `${RF_NODE_SCROLL} min-h-[128px] max-h-[240px] w-full shrink-0 resize-y rounded-md border border-white/10 bg-black/30 p-2.5 font-mono text-[12px] leading-relaxed text-white placeholder:text-[var(--canvas-muted)] focus:border-[var(--canvas-accent)]/60 focus:outline-none`;

export function AiVideoEngineNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const { providers } = useUserProviders();
  const d = data as unknown as AiVideoEngineNodeData;
  const { succeeded } = useNodeTaskHistory(id);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [runPending, setRunPending] = useState(false);

  useEffect(() => {
    if (d.providerId && d.modelKey) return;
    const pick = pickDefaultRefVideoEngine(providers);
    if (!pick) return;
    updateNodeData(id, {
      providerId: pick.providerId,
      modelKey: pick.modelKey,
      params: pick.params,
    });
  }, [d.providerId, d.modelKey, id, providers, updateNodeData]);

  const refUrls = useMemo(() => {
    for (const pid of directPredecessors(edges, id)) {
      const p = nodes.find((n) => n.id === pid);
      if (!p) continue;
      const urls = collectRefImageUrlsFromGridNode(p);
      if (urls.length) return urls;
    }
    return [];
  }, [nodes, edges, id]);

  const videoUrl =
    d.runtime?.ossUrl ??
    d.runtime?.ephemeralUrl ??
    pickTaskResultMediaUrl(succeeded[succeeded.length - 1] ?? {}) ??
    succeeded[succeeded.length - 1]?.ossUrl ??
    succeeded[succeeded.length - 1]?.ephemeralUrl;

  const hasGenerated =
    Boolean(videoUrl) ||
    succeeded.length > 0 ||
    d.runtime?.status === "done";

  const isGenerating =
    d.runtime?.status === "running" || d.runtime?.status === "pending";

  const showGenerating = isGenerating || runPending;

  useEffect(() => {
    if (!isGenerating) setRunPending(false);
  }, [isGenerating]);

  const onRun = (forceFresh: boolean) => {
    setRunPending(true);
    window.dispatchEvent(
      new CustomEvent("canvas:run-node", { detail: { nodeId: id, forceFresh } }),
    );
  };

  const openPreview = () => {
    if (videoUrl) setPreviewOpen(true);
  };

  return (
    <NodeShell
      title="AI 视频引擎"
      subtitle={d.modelKey || "参考生视频"}
      selected={selected}
      engine
      runtime={d.runtime}
      minWidth={REF_VIDEO_NODE_SIZE.width}
      minHeight={REF_VIDEO_NODE_SIZE.height}
      inputs={[{ id: "in_refs", label: "参考图", kind: "image" }]}
      outputs={[{ id: "out_video", label: "视频", kind: "image" }]}
      headerRight={
        <EnginePreviewTrigger
          title="AI 视频引擎"
          kind="video"
          mediaUrl={videoUrl ?? undefined}
          status={d.runtime?.status}
          failMessage={d.runtime?.failMessage}
        />
      }
      footer={
        <NodeEngineShellFooter
          hint="连接宫格 → 本节点 → 视频生成"
          tag="REF VIDEO"
        />
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          {refUrls.length > 0 ? (
            <div className="flex shrink-0 flex-wrap gap-1.5 px-0.5">
              {refUrls.map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  className="relative size-12 overflow-hidden rounded-md border border-white/10"
                >
                  <Image
                    src={url}
                    alt={`ref ${i + 1}`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <span className="absolute left-0.5 top-0.5 rounded bg-black/60 px-0.5 text-[8px]">
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="shrink-0 text-[11px] text-amber-400/90">
              请连接四 / 六 / 九宫格并上传至少 1 张参考图
            </p>
          )}

          <CanvasPromptTextarea
            value={d.prompt ?? ""}
            onChange={(prompt) => updateNodeData(id, { prompt })}
            placeholder="描述镜头与动作；可用 [Image 1]、[Image 2] 引用参考格"
            rows={6}
            className={REF_VIDEO_PROMPT_CLASS}
          />

          <CanvasVideoPreviewSlot
            className="min-h-0 flex-1 basis-0"
            videoUrl={videoUrl ?? undefined}
            downloadHref={videoUrl ?? undefined}
            downloadFileName="ref-video.mp4"
            generating={showGenerating}
            onPreview={videoUrl && !showGenerating ? openPreview : undefined}
            emptyIcon={<Video className="size-6 opacity-30" />}
            emptyMessage={
              showGenerating ? undefined : "生成结果将显示在此"
            }
            generatingLabel={
              d.runtime?.status === "pending" ? "排队中…" : "视频生成中…"
            }
          />
        </div>

        <div className="shrink-0 pt-2">
          <NodeEngineFooter
            picker={
              <EnginePicker
                role="VIDEO"
                allowedModelKeys={[...REF_VIDEO_MODEL_KEYS]}
                providerId={d.providerId ?? ""}
                modelKey={d.modelKey ?? ""}
                params={d.params ?? {}}
                onChange={(next) =>
                  updateNodeData(id, {
                    providerId: next.providerId,
                    modelKey: next.modelKey,
                    params: next.params,
                  })
                }
              />
            }
            runLabel="生成视频"
            runAgainLabel="重新生成"
            isGenerating={showGenerating}
            hasGenerated={hasGenerated}
            runDisabled={
              !d.providerId ||
              !d.modelKey ||
              !d.prompt?.trim() ||
              refUrls.length < 1
            }
            onRun={() => onRun(hasGenerated)}
          />
        </div>
      </div>

      {previewOpen && videoUrl ? (
        <StoryMediaPreviewModal
          url={videoUrl}
          kind="video"
          title="AI 视频引擎"
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </NodeShell>
  );
}
