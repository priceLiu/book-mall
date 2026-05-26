"use client";

import { useCallback, useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Clapperboard } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import { STORY_VIDEO_MODEL_KEYS } from "@/lib/canvas/types";
import {
  displayCharacterRows,
  displayFrameRows,
  displayVideoRows,
  findStoryWorkspaceIds,
} from "@/lib/canvas/story-column-display";
import { busEnqueueStoryRun } from "@/lib/canvas/canvas-run-bus";
import { batchRunStoryRowsSequential } from "@/lib/canvas/batch-run-nodes";
import { pushStoryRevision } from "@/lib/canvas/story-revision";
import {
  storyGeneratedCharacterMentionables,
  storyCharacterRefCatalog,
  storyRefImagesFromPrompt,
} from "@/lib/canvas/story-ref-image";
import {
  FRAME_ROW_AT_HINT,
  patchVideoRowsFromFrameRows,
  sanitizeLegacyFramePrompt,
  stripFrameRowAtHint,
} from "@/lib/canvas/story-column-sync";
import type {
  StoryFrameColumnNodeData,
  StoryVideoColumnNodeData,
} from "@/lib/canvas/story-workspace-types";
import {
  aggregateStoryColumnRuntime,
  storyColumnIsGenerating,
} from "@/lib/canvas/story-column-runtime";
import { StoryColumnBatchFooter } from "../story-column-batch-footer";
import { StoryNodeFooterShell } from "../story-node-footer-shell";
import { StoryColumnRowCard } from "../story-row-prompt-field";
import { NodeShell, ENGINE_ACCENT } from "../node-shell";
import { EnginePicker } from "../engine-picker";

export function StoryFrameColumnNode({ id, data, selected }: NodeProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const d = data as unknown as StoryFrameColumnNodeData;
  const stored = d.rows ?? [];
  const batchVideo = d.batchVideo ?? d.batchImage;

  const ws = useMemo(() => findStoryWorkspaceIds(nodes), [nodes]);
  const videoColumnId = ws?.videoColumnId;

  const characterRows = useMemo(() => {
    if (!ws?.characterColumnId) return [];
    const charNode = nodes.find((n) => n.id === ws.characterColumnId);
    const storedChar =
      (charNode?.data as { rows?: Parameters<typeof displayCharacterRows>[2] })
        ?.rows ?? [];
    return displayCharacterRows(nodes, ws.characterColumnId, storedChar);
  }, [nodes, ws?.characterColumnId]);

  const characterCatalog = useMemo(
    () => storyCharacterRefCatalog(characterRows),
    [characterRows],
  );

  const characterMentionables = useMemo(
    () => storyGeneratedCharacterMentionables(characterRows),
    [characterRows],
  );

  const displayRows = useMemo(
    () => displayFrameRows(nodes, id, stored),
    [nodes, id, stored],
  );

  const videoRows = useMemo(() => {
    if (!videoColumnId) return [];
    const videoNode = nodes.find((n) => n.id === videoColumnId);
    const videoStored =
      (videoNode?.data as StoryVideoColumnNodeData)?.rows ?? [];
    return displayVideoRows(nodes, videoColumnId, videoStored);
  }, [nodes, videoColumnId]);

  const nodeRuntime = useMemo(
    () => aggregateStoryColumnRuntime(videoRows),
    [videoRows],
  );
  const columnGenerating = storyColumnIsGenerating(nodeRuntime);

  const updateRows = (next: typeof displayRows) => {
    updateNodeData(id, { rows: next });
  };

  const syncVideoRows = useCallback(
    (frameRows: typeof displayRows) => {
      if (!videoColumnId) return;
      const videoNode = nodes.find((n) => n.id === videoColumnId);
      const videoStored =
        (videoNode?.data as StoryVideoColumnNodeData)?.rows ?? [];
      const patched = patchVideoRowsFromFrameRows(videoStored, frameRows);
      updateNodeData(videoColumnId, { rows: patched });
    },
    [nodes, updateNodeData, videoColumnId],
  );

  const runRowVideo = (key: string, forceFresh?: boolean) => {
    if (!videoColumnId || !batchVideo?.providerId) return;
    syncVideoRows(displayRows);
    busEnqueueStoryRun({
      nodeId: videoColumnId,
      rowKey: key,
      mediaKind: "video",
      forceFresh,
    });
  };

  const runAll = () => {
    const keys = displayRows.map((r) => r.key);
    if (!keys.length || !videoColumnId || !batchVideo?.providerId) return;
    syncVideoRows(displayRows);
    batchRunStoryRowsSequential(videoColumnId, keys, "video");
  };

  const saveRowPrompt = (
    key: string,
    prompt: string,
    referencedIds: string[],
  ) => {
    const refImages = storyRefImagesFromPrompt(prompt, characterCatalog);
    const refImageUrls = refImages
      .map((ref) => ref.url)
      .filter((u): u is string => Boolean(u && /^https?:\/\//.test(u)));
    const next = displayRows.map((r) =>
      r.key === key
        ? {
            ...r,
            prompt: sanitizeLegacyFramePrompt(prompt.trim()) || prompt.trim(),
            referencedNodeIds: referencedIds,
            refImages,
            refImageUrls,
            promptHistory: pushStoryRevision(r.promptHistory, prompt),
          }
        : r,
    );
    updateRows(next);
    if (videoColumnId) {
      const videoNode = nodes.find((n) => n.id === videoColumnId);
      const videoStored =
        (videoNode?.data as StoryVideoColumnNodeData)?.rows ?? [];
      updateNodeData(videoColumnId, {
        rows: patchVideoRowsFromFrameRows(videoStored, next),
      });
    }
  };

  return (
    <NodeShell
      title="分镜脚本"
      subtitle={
        columnGenerating
          ? "分镜视频生成中…"
          : nodeRuntime.status === "error"
            ? "部分生成失败"
            : "场景 · 镜头描述 · @ 角色"
      }
      selected={selected}
      engine
      bodyScroll
      runtime={nodeRuntime}
      accent={ENGINE_ACCENT}
      minWidth={880}
      minHeight={520}
      inputs={[{ id: "in_text", label: "分镜脚本", kind: "text" }]}
      outputs={[{ id: "text", label: "视频", kind: "image" }]}
      footer={
        <StoryNodeFooterShell>
          <StoryColumnBatchFooter
            disabled={
              columnGenerating ||
              !displayRows.length ||
              !batchVideo?.providerId ||
              !videoColumnId
            }
            onClick={runAll}
          >
            <Clapperboard className="mr-1 inline size-3.5" />
            生成分镜视频
          </StoryColumnBatchFooter>
        </StoryNodeFooterShell>
      }
    >
      <div className="flex shrink-0 flex-col gap-2">
        <EnginePicker
          role="VIDEO"
          allowedModelKeys={[...STORY_VIDEO_MODEL_KEYS]}
          providerId={batchVideo?.providerId ?? ""}
          modelKey={batchVideo?.modelKey ?? ""}
          params={batchVideo?.params ?? {}}
          onChange={(next) => {
            const pick = {
              providerId: next.providerId,
              modelKey: next.modelKey,
              params: next.params,
            };
            updateNodeData(id, { batchVideo: pick });
            if (videoColumnId) {
              updateNodeData(videoColumnId, { batchVideo: pick });
            }
          }}
        />
        <div className="space-y-2">
          {!displayRows.length ? (
            <p className="text-[11px] text-[var(--canvas-muted)]">
              完成分镜脚本后，在此编辑场景、镜头描述、对白与运镜；@ 角色三视图后点击生成，成片出现在「分镜视频」列。
            </p>
          ) : (
            displayRows.map((row) => {
              const vr = videoRows.find((v) => v.key === row.key);
              const vst = vr?.videoRuntime?.status ?? "idle";
              const running = vst === "running" || vst === "pending";
              const upstreamImages = storyRefImagesFromPrompt(
                row.prompt,
                characterCatalog,
              );
              return (
                <StoryColumnRowCard
                  key={row.key}
                  rowTitle={`镜 ${row.frameIndex}`}
                  promptValue={stripFrameRowAtHint(row.prompt)}
                  promptHint={
                    row.frameIndex === 1 ? FRAME_ROW_AT_HINT : undefined
                  }
                  showUpstream
                  upstreamImages={upstreamImages}
                  mentionables={characterMentionables}
                  onSavePrompt={(p, refs) => saveRowPrompt(row.key, p, refs)}
                  generating={running}
                  generateTitle={vr?.videoRuntime?.ossUrl ? "重新生成" : "生成视频"}
                  onGenerate={() => runRowVideo(row.key, Boolean(vr?.videoRuntime?.ossUrl))}
                />
              );
            })
          )}
        </div>
      </div>
    </NodeShell>
  );
}
