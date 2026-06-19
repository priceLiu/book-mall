"use client";

import { useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Download, Video } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import type { VideoEngineNodeData } from "@/lib/canvas/types";
import { STORY_VIDEO_MODEL_KEYS } from "@/lib/canvas/types";
import { resolveReferencedNodeIds } from "@/lib/canvas/referenced-nodes";
import { useNodeTaskHistory } from "@/lib/canvas/use-node-task-history";
import { pickTaskResultMediaUrl } from "@/lib/canvas/task-media-url";
import { SaveVideoToLibraryButton } from "../save-video-to-library-button";
import { NodeShell } from "../node-shell";
import { EnginePicker } from "../engine-picker";
import { EnginePreviewTrigger } from "../engine-preview-trigger";
import { MediaHoverBox } from "../media-hover-box";
import {
  MentionsTextarea,
  type MentionableItem,
} from "../mentions/MentionsTextarea";
import { UpstreamChipRow, useUpstreamChips, sortUpstreamChips } from "../upstream-chips";
import {
  NODE_BTN_GHOST,
  NODE_MEDIA_ENGINE_HEIGHT,
  NODE_MEDIA_MIN_WIDTH,
  NODE_PROMPT_CLASS,
  NodeEngineFooter,
  NodeEngineLayout,
  NodeEngineShellFooter,
  NodeMediaEmpty,
  NodeMediaGallery,
  NodeMediaItem,
  NodeMediaStage,
} from "../node-ui";

export function VideoEngineNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const d = data as unknown as VideoEngineNodeData;
  const { succeeded } = useNodeTaskHistory(id);

  const chips = sortUpstreamChips(useUpstreamChips(id));
  const mentionables = useMemo<MentionableItem[]>(
    () => chips.map((c) => ({ id: c.id, label: c.label, kind: c.kind })),
    [chips],
  );
  const referenced = useMemo(
    () => resolveReferencedNodeIds(d.prompt ?? "", chips),
    [d.prompt, chips],
  );

  const videoUrl =
    d.runtime?.ossUrl ??
    d.runtime?.ephemeralUrl ??
    pickTaskResultMediaUrl(succeeded[succeeded.length - 1] ?? {}) ??
    succeeded[succeeded.length - 1]?.ossUrl ??
    succeeded[succeeded.length - 1]?.ephemeralUrl;
  const posterUrl =
    d.runtime?.posterUrl ?? succeeded[succeeded.length - 1]?.posterUrl ?? undefined;

  const hasGenerated =
    Boolean(videoUrl) ||
    succeeded.length > 0 ||
    d.runtime?.status === "done";

  const isGenerating =
    d.runtime?.status === "running" || d.runtime?.status === "pending";

  const onRun = (forceFresh: boolean) => {
    window.dispatchEvent(
      new CustomEvent("canvas:run-node", { detail: { nodeId: id, forceFresh } }),
    );
  };

  return (
    <NodeShell
      title={d.frameIndex ? `视频 · 镜${d.frameIndex}` : "视频引擎"}
      subtitle={d.modelKey || "KIE 图生视频"}
      selected={selected}
      engine
      minWidth={NODE_MEDIA_MIN_WIDTH}
      minHeight={NODE_MEDIA_ENGINE_HEIGHT}
      inputs={[
        { id: "in_text", label: "视频提示", kind: "text" },
        { id: "in_image", label: "分镜图", kind: "image" },
      ]}
      outputs={[{ id: "video", label: "视频", kind: "image" }]}
      headerRight={
        <EnginePreviewTrigger
          title={d.frameIndex ? `视频 · 镜${d.frameIndex}` : "视频引擎"}
          kind="video"
          mediaUrl={videoUrl ?? undefined}
          status={d.runtime?.status}
          failMessage={d.runtime?.failMessage}
        />
      }
      footer={
        <NodeEngineShellFooter
          hint={
            d.frameIndex != null
              ? "右侧输出连 video-preview 或导出节点"
              : "连接分镜图 · 图生视频"
          }
          tag="VIDEO"
        />
      }
    >
      <NodeEngineLayout
        engineFooter={
          <NodeEngineFooter
            picker={
              <EnginePicker
                role="VIDEO"
                allowedModelKeys={[...STORY_VIDEO_MODEL_KEYS]}
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
            runLabel="生成"
            runAgainLabel="重新生成"
            isGenerating={isGenerating}
            hasGenerated={hasGenerated}
            runDisabled={!d.providerId || !d.modelKey}
            onRun={() => onRun(hasGenerated)}
          />
        }
      >
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        {chips.length > 0 ? (
          <UpstreamChipRow chips={chips} referenced={referenced} />
        ) : null}
        <MentionsTextarea
          value={d.prompt ?? ""}
          onChange={(v) =>
            updateNodeData(id, {
              prompt: v,
              referencedNodeIds: resolveReferencedNodeIds(v, chips),
            })
          }
          mentionables={mentionables}
          placeholder="运镜 / 动效描述"
          rows={2}
          className={NODE_PROMPT_CLASS}
        />

        <NodeMediaGallery className="max-h-none min-h-0 flex-1">
          {videoUrl ? (
            <NodeMediaItem
              stage={
                <NodeMediaStage>
                  <MediaHoverBox
                    src={videoUrl}
                    posterUrl={posterUrl}
                    mediaKind="video"
                    variant="generated"
                    alt={d.frameIndex ? `镜${d.frameIndex} 视频` : "分镜视频"}
                    fit="contain"
                    clickToPreview
                  />
                </NodeMediaStage>
              }
              actions={
                <>
                  <SaveVideoToLibraryButton
                    variant="inline"
                    videoUrl={videoUrl}
                    saveInput={{
                      mode: "i2v",
                      prompt: d.prompt,
                      modelLabel: d.modelKey,
                    }}
                  />
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${NODE_BTN_GHOST} ml-auto`}
                  >
                    <Download className="size-3" /> 下载 mp4
                  </a>
                </>
              }
            />
          ) : (
            <NodeMediaEmpty
              icon={<Video className="size-6 opacity-30" />}
              message={
                isGenerating
                  ? "视频生成中，请稍候…"
                  : "连接分镜图后点击「生成」"
              }
            />
          )}
        </NodeMediaGallery>
      </div>
      </NodeEngineLayout>
    </NodeShell>
  );
}
