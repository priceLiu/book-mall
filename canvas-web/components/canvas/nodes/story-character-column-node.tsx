"use client";

import { useEffect, useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Users } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  storyEditionAccent,
  storyEditionFromNodeType,
} from "@/lib/canvas/story-edition-chrome";
import { PRO_NODE_SHELL_FOOTER_CLASS } from "@/lib/canvas/story-pro-node-chrome";
import { NODE_DEFAULT_SIZE, THREE_VIEW_ENGINE_MODEL_KEYS } from "@/lib/canvas/types";
import {
  autoFillStoryProCharacterSlotsFromThreeView,
  saveStoryProCharacterAssetRef,
} from "@/lib/canvas-api";
import { normalizeStoryProCharacterKey } from "@/lib/canvas/story-pro-character-key";
import { formatAutoFillSlotsMessage } from "@/lib/canvas/story-pro-character-asset-auto-fill";
import { findAssetForCharacterRow } from "@/lib/canvas/story-pro-character-asset-catalog";
import { useStoryProCharacterAssets, notifyStoryProCharacterAssetsChanged } from "@/lib/canvas/use-story-pro-character-assets";
import { nodeMeasuredSize } from "@/lib/canvas/normalize-graph-nodes";
import { busEnqueueStoryRun } from "@/lib/canvas/canvas-run-bus";
import { batchRunStoryRowsSequential } from "@/lib/canvas/batch-run-nodes";
import { displayCharacterRows } from "@/lib/canvas/story-column-display";
import { pushStoryRevision } from "@/lib/canvas/story-revision";
import {
  aggregateStoryColumnRuntime,
  storyColumnIsGenerating,
} from "@/lib/canvas/story-column-runtime";
import type { StoryCharacterColumnNodeData } from "@/lib/canvas/story-workspace-types";
import { StoryColumnBatchFooter } from "../story-column-batch-footer";
import { StoryNodeFooterShell } from "../story-node-footer-shell";
import { StoryColumnRowCard } from "../story-row-prompt-field";
import { StoryMediaPreviewModal } from "../story-column-media-panel";
import { NodeShell } from "../node-shell";
import { EnginePicker } from "../engine-picker";
import { StoryProCharacterAssetSlots } from "../story-pro-character-asset-slots";

export function StoryCharacterColumnNode({ id, data, selected, type }: NodeProps) {
  const base = useBookMallBaseUrl();
  const projectId = useCanvasStore((s) => s.projectId);
  const { alert } = useDialogs();
  const edition = storyEditionFromNodeType(type);
  const sizeKey =
    type && type in NODE_DEFAULT_SIZE
      ? (type as keyof typeof NODE_DEFAULT_SIZE)
      : "story-character-column";
  const nodes = useCanvasStore((s) => s.nodes);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const resizeNode = useCanvasStore((s) => s.resizeNode);
  const d = data as unknown as StoryCharacterColumnNodeData;
  const stored = d.rows ?? [];
  const { assets: characterAssets } = useStoryProCharacterAssets(
    edition === "pro" ? projectId : null,
  );
  const [preview, setPreview] = useState<{
    url: string;
    title: string;
  } | null>(null);

  const displayRows = useMemo(
    () => displayCharacterRows(nodes, id, stored),
    [nodes, id, stored],
  );

  const nodeRuntime = useMemo(
    () => aggregateStoryColumnRuntime(displayRows),
    [displayRows],
  );
  const columnGenerating = storyColumnIsGenerating(nodeRuntime);

  useEffect(() => {
    const def = NODE_DEFAULT_SIZE[sizeKey];
    const node = useCanvasStore.getState().nodes.find((n) => n.id === id);
    if (!node) return;
    const { w, h } = nodeMeasuredSize(node);
    if (Math.abs(h - def.height) < 4 && Math.abs(w - def.width) < 4) return;
    resizeNode(id, { width: def.width, height: def.height });
  }, [id, resizeNode]);

  const updateRows = (next: typeof displayRows) => {
    updateNodeData(id, { rows: next });
  };

  const onPickImage = (next: {
    providerId: string;
    modelKey: string;
    params: Record<string, unknown>;
  }) => {
    updateNodeData(id, {
      batchImage: {
        providerId: next.providerId,
        modelKey: next.modelKey,
        params: next.params,
      },
    });
  };

  const runRow = (key: string, forceFresh?: boolean) => {
    updateRows(displayRows);
    busEnqueueStoryRun({
      nodeId: id,
      rowKey: key,
      mediaKind: "threeView",
      forceFresh,
    });
  };

  const runAll = () => {
    const keys = displayRows.map((r) => r.key);
    if (!keys.length || !d.batchImage?.providerId) return;
    updateRows(displayRows);
    batchRunStoryRowsSequential(id, keys, "threeView");
  };

  const saveRowPrompt = (key: string, prompt: string) => {
    const next = displayRows.map((r) =>
      r.key === key
        ? {
            ...r,
            prompt: prompt.trim(),
            promptHistory: pushStoryRevision(r.promptHistory, prompt),
          }
        : r,
    );
    updateRows(next);
  };

  const saveRowToAssetLibrary = async (row: (typeof displayRows)[number]) => {
    if (edition !== "pro" || !base?.trim()) return;
    const url = row.runtime?.ossUrl ?? row.runtime?.ephemeralUrl;
    if (!url || !/^https?:\/\//.test(url)) {
      void alert({
        title: "无法入库",
        message: "请先生成三视图，再保存到角色资产库。",
        variant: "warning",
      });
      return;
    }
    try {
      const asset = await saveStoryProCharacterAssetRef(base, {
        characterKey: normalizeStoryProCharacterKey(row.key),
        displayName: row.name,
        projectId: projectId ?? null,
        kind: "three_view",
        ossUrl: url,
        label: `${row.name} · 三视图`,
        sourceTaskId: row.runtime?.taskId ?? null,
      });
      let fillMessage = "";
      try {
        const fill = await autoFillStoryProCharacterSlotsFromThreeView(base, {
          characterKey: row.key,
          displayName: row.name,
          projectId: projectId ?? null,
          threeViewUrl: url,
          sourceTaskId: row.runtime?.taskId ?? null,
          onlyEmpty: true,
        });
        fillMessage = formatAutoFillSlotsMessage({
          filled: fill.filled,
          skipped: fill.skipped,
        });
      } catch (e) {
        fillMessage = formatAutoFillSlotsMessage({
          filled: [],
          skipped: [],
          error: e instanceof Error ? e.message : String(e),
        });
      }
      updateRows(
        displayRows.map((r) =>
          r.key === row.key ? { ...r, assetId: asset.id } : r,
        ),
      );
      notifyStoryProCharacterAssetsChanged();
      void alert({
        title: "已保存",
        message: `「${row.name}」三视图已入库。${fillMessage}`,
        variant: "success",
      });
    } catch (e) {
      void alert({
        title: "保存失败",
        message: e instanceof Error ? e.message : String(e),
        variant: "error",
      });
    }
  };

  const patchCharacterRow = (
    key: string,
    patch: Partial<(typeof displayRows)[number]>,
  ) => {
    updateRows(displayRows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  return (
    <NodeShell
      title="角色设定与三视图"
      subtitle={
        columnGenerating
          ? "三视图生成中…"
          : nodeRuntime.status === "error"
            ? "部分生成失败"
            : "定位来自角色设定"
      }
      selected={selected}
      engine
      bodyScroll
      runtime={nodeRuntime}
      accent={storyEditionAccent(edition)}
      minWidth={NODE_DEFAULT_SIZE[sizeKey].width}
      minHeight={NODE_DEFAULT_SIZE[sizeKey].height}
      inputs={[
        { id: "in_text", label: "角色设定", kind: "text" },
      ]}
      outputs={[{ id: "text", label: "三视图", kind: "image" }]}
      footerClassName={
        edition === "pro" ? PRO_NODE_SHELL_FOOTER_CLASS : undefined
      }
      footer={
        <StoryNodeFooterShell>
          <StoryColumnBatchFooter
            edition={edition}
            disabled={
              columnGenerating ||
              !displayRows.length ||
              !d.batchImage?.providerId
            }
            onClick={runAll}
          >
            <Users className="mr-1 inline size-3.5" />
            全部生成三视图
          </StoryColumnBatchFooter>
        </StoryNodeFooterShell>
      }
    >
      <div className="flex shrink-0 flex-col gap-2">
        <EnginePicker
          role="IMAGE"
          allowedModelKeys={[...THREE_VIEW_ENGINE_MODEL_KEYS]}
          requiredCapabilities={edition === "pro" ? ["image_multi_ref"] : undefined}
          capabilityHint="角色多参考图生图需支持 multi_ref 的模型（如 nano-banana-pro）"
          providerId={d.batchImage?.providerId ?? ""}
          modelKey={d.batchImage?.modelKey ?? ""}
          params={d.batchImage?.params ?? {}}
          onChange={onPickImage}
        />
        <div className="space-y-2">
          {!displayRows.length ? (
            <p className="text-[11px] text-[var(--canvas-muted)]">
              定稿大纲中若无角色设定，此列可为空；需要时再生成三视图。
            </p>
          ) : (
            displayRows.map((row) => {
              const url = row.runtime?.ossUrl ?? row.runtime?.ephemeralUrl;
              const st = row.runtime?.status ?? "idle";
              const running = st === "running" || st === "pending";
              const rowAsset =
                edition === "pro"
                  ? findAssetForCharacterRow(
                      characterAssets,
                      row.key,
                      projectId,
                    )
                  : undefined;
              return (
                <div key={row.key} className="space-y-1">
                  <StoryColumnRowCard
                    edition={edition}
                    rowTitle={row.name}
                    promptValue={row.prompt}
                    onSavePrompt={(p) => saveRowPrompt(row.key, p)}
                    generating={running}
                    generateDisabled={
                      !d.batchImage?.providerId?.trim() ||
                      !d.batchImage?.modelKey?.trim()
                    }
                    mediaMode="character"
                    imageUrl={url}
                    mediaError={
                      st === "error" ? row.runtime?.failMessage : undefined
                    }
                    onGenerate={() => runRow(row.key, Boolean(url))}
                    onPreview={
                      url
                        ? () =>
                            setPreview({ url, title: `${row.name} · 三视图` })
                        : undefined
                    }
                  />
                  {edition === "pro" ? (
                    <StoryProCharacterAssetSlots
                      row={row}
                      asset={rowAsset}
                      projectId={projectId}
                      onRowPatch={(patch) =>
                        patchCharacterRow(row.key, patch as Partial<(typeof displayRows)[number]>)
                      }
                      onPreview={(u, title) => setPreview({ url: u, title })}
                    />
                  ) : null}
                  {edition === "pro" && url ? (
                    <button
                      type="button"
                      className="nodrag w-full rounded border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-500/20"
                      onClick={() => void saveRowToAssetLibrary(row)}
                    >
                      快捷保存上方三视图到资产库
                    </button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
      {preview ? (
        <StoryMediaPreviewModal
          url={preview.url}
          title={preview.title}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </NodeShell>
  );
}
