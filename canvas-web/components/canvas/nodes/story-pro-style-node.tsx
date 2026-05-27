"use client";

import { useEffect, useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { GitBranch, Palette, Sparkles } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import { busEnqueueStoryRun } from "@/lib/canvas/canvas-run-bus";
import { spawnStoryProMediaColumns } from "@/lib/canvas/spawn-story-pro-workspace";
import { syncStoryProColumnRows } from "@/lib/canvas/story-pro-column-sync";
import { reflowStoryProWorkspace } from "@/lib/canvas/story-pro-workspace-layout";
import { resolveStarterForHub } from "@/lib/canvas/story-workspace-resolver";
import type {
  StoryProMainStyle,
  StoryProScriptHubNodeData,
  StoryProStyleNodeData,
} from "@/lib/canvas/story-pro-workspace-types";
import {
  STORY_CONTROL_NODE_HEIGHT,
  STORY_CONTROL_NODE_WIDTH,
  STORY_NODE_ACTION_BTN_CLASS,
  STORY_NODE_ACTION_BTN_SPLIT_CLASS,
} from "@/lib/canvas/story-node-chrome";
import { STORY_HINT_LABEL_CLASS } from "@/lib/canvas/story-column-sync";
import { nodeMeasuredSize } from "@/lib/canvas/normalize-graph-nodes";
import { NodeShell, ENGINE_ACCENT, NodeStatusBadge } from "../node-shell";
import { StoryNodeFooterShell } from "../story-node-footer-shell";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { pickDefaultStoryLlmEngine } from "@/lib/canvas/system-providers";

const MAIN_STYLE_OPTIONS: { value: StoryProMainStyle; label: string }[] = [
  { value: "anime", label: "日系动漫" },
  { value: "american-comic", label: "美漫" },
  { value: "webtoon", label: "韩漫条漫" },
  { value: "chibi", label: "Q 版" },
  { value: "cg", label: "CG 插画" },
  { value: "photorealistic", label: "写实" },
  { value: "game-cg", label: "游戏 CG" },
  { value: "chinese-3d", label: "国风 3D" },
  { value: "other", label: "其他" },
];

export function StoryProStyleNode({ id, data, selected }: NodeProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const resizeNode = useCanvasStore((s) => s.resizeNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const { providers } = useUserProviders();
  const d = data as unknown as StoryProStyleNodeData;
  const [outputBusy, setOutputBusy] = useState(false);

  const hubNodeId = d.hubNodeId;
  const hub = hubNodeId
    ? nodes.find((n) => n.id === hubNodeId)
    : undefined;
  const hubData = (hub?.data ?? {}) as StoryProScriptHubNodeData;
  const scriptFinalized = Boolean(hubData.scriptFinalized);
  const styleFinalized = Boolean(d.styleFinalized);

  const refCount = d.refImages?.length ?? 0;
  const anchorsReady =
    Boolean(d.styleAnchorZh?.trim()) && Boolean(d.styleAnchorEn?.trim());
  const canFinalizeStyle =
    scriptFinalized &&
    anchorsReady &&
    refCount >= 3 &&
    !styleFinalized;

  const hasMediaColumns = useMemo(() => {
    if (!hubNodeId) return false;
    return nodes.some(
      (n) =>
        (n.type === "story-pro-character" ||
          n.type === "story-pro-scene" ||
          n.type === "story-pro-frame") &&
        (n.data as { hubNodeId?: string }).hubNodeId === hubNodeId,
    );
  }, [nodes, hubNodeId]);

  const runtimeStatus = d.runtime?.status ?? "idle";
  const isGenerating = runtimeStatus === "running" || runtimeStatus === "pending";

  useEffect(() => {
    if (d.providerId?.trim() && d.modelKey?.trim()) return;
    const pick = pickDefaultStoryLlmEngine(providers);
    if (!pick) return;
    updateNodeData(id, {
      providerId: pick.providerId,
      modelKey: pick.modelKey,
    });
  }, [d.providerId, d.modelKey, providers, id, updateNodeData]);

  useEffect(() => {
    const targetH = STORY_CONTROL_NODE_HEIGHT + 80;
    const targetW = STORY_CONTROL_NODE_WIDTH;
    const node = useCanvasStore.getState().nodes.find((n) => n.id === id);
    if (!node) return;
    const { w, h } = nodeMeasuredSize(node);
    if (Math.abs(h - targetH) < 4 && Math.abs(w - targetW) < 4) return;
    resizeNode(id, { width: targetW, height: targetH });
  }, [id, resizeNode]);

  const reflowProLayout = () => {
    const state = useCanvasStore.getState();
    setNodes(() => reflowStoryProWorkspace(state.nodes, state.edges));
  };

  const onGenerateDraft = () => {
    if (!scriptFinalized || isGenerating) return;
    busEnqueueStoryRun({ nodeId: id, forceFresh: Boolean(d.styleAnchorZh) });
  };

  const onFinalizeStyle = async () => {
    if (!canFinalizeStyle || hasMediaColumns) return;
    const starter = hubNodeId
      ? resolveStarterForHub(nodes, edges, hubNodeId)
      : undefined;
    if (!starter || !hubNodeId) return;
    setOutputBusy(true);
    try {
      const state = useCanvasStore.getState();
      const ids = spawnStoryProMediaColumns({
        starterNodeId: starter.id,
        scriptHubId: hubNodeId,
        systemPrompt:
          (starter.data as { systemPrompt?: string }).systemPrompt ?? "",
        providerId: d.providerId ?? hubData.providerId,
        modelKey: d.modelKey ?? hubData.modelKey,
        params: d.params ?? hubData.params ?? {},
        nodes: state.nodes,
        edges: state.edges,
        addNode: (type, position, nodeData) =>
          addNode(type, position, nodeData),
        setEdges,
        updateNodeData,
      });

      const afterSpawn = useCanvasStore.getState().nodes;
      const hubNode = afterSpawn.find((n) => n.id === hubNodeId);
      const hubPayload = (hubNode?.data ?? hubData) as StoryProScriptHubNodeData;
      const synced = syncStoryProColumnRows(hubPayload, {
        characterRows: (
          afterSpawn.find((n) => n.id === ids.characterColumnId)?.data as {
            rows?: unknown[];
          }
        )?.rows as import("@/lib/canvas/story-pro-workspace-types").StoryProCharacterRow[],
        sceneRows: (
          afterSpawn.find((n) => n.id === ids.sceneColumnId)?.data as {
            rows?: unknown[];
          }
        )?.rows as import("@/lib/canvas/story-pro-workspace-types").StoryProSceneRow[],
        frameRows: (
          afterSpawn.find((n) => n.id === ids.frameColumnId)?.data as {
            rows?: unknown[];
          }
        )?.rows as import("@/lib/canvas/story-pro-workspace-types").StoryProFrameRow[],
        videoRows: (
          afterSpawn.find((n) => n.id === ids.videoColumnId)?.data as {
            rows?: unknown[];
          }
        )?.rows as import("@/lib/canvas/story-pro-workspace-types").StoryProVideoRow[],
      });

      if (ids.characterColumnId) {
        updateNodeData(ids.characterColumnId, {
          rows: synced.characterRows,
          hubNodeId,
        });
      }
      if (ids.sceneColumnId) {
        updateNodeData(ids.sceneColumnId, {
          rows: synced.sceneRows,
          hubNodeId,
        });
      }
      if (ids.frameColumnId) {
        updateNodeData(ids.frameColumnId, {
          rows: synced.frameRows,
          hubNodeId,
        });
      }
      if (ids.videoColumnId) {
        updateNodeData(ids.videoColumnId, {
          rows: synced.videoRows,
          hubNodeId,
          frameColumnId: ids.frameColumnId,
        });
      }

      updateNodeData(id, { styleFinalized: true });
      updateNodeData(starter.id, { pipelineStage: "style_finalized" });
      reflowProLayout();
    } finally {
      setOutputBusy(false);
    }
  };

  const fieldsLocked = styleFinalized || !scriptFinalized;

  return (
    <NodeShell
      title="风格定义"
      subtitle={
        styleFinalized
          ? "风格已定稿 · 工作流已生成"
          : scriptFinalized
            ? "填写锚定词与参考图后定稿"
            : "请先完成故事定稿"
      }
      selected={selected}
      engine
      accent={ENGINE_ACCENT}
      minWidth={STORY_CONTROL_NODE_WIDTH}
      minHeight={STORY_CONTROL_NODE_HEIGHT + 80}
      inputs={[{ id: "in_text", label: "故事剧本", kind: "text" }]}
      outputs={[{ id: "text", label: "风格", kind: "text" }]}
      headerRight={
        <NodeStatusBadge
          status={
            isGenerating
              ? "running"
              : runtimeStatus === "error"
                ? "error"
                : styleFinalized
                  ? "done"
                  : "idle"
          }
          message={d.runtime?.failMessage ?? null}
        />
      }
      footer={
        <StoryNodeFooterShell
          hint={
            <span>
              参考图 {refCount}/3
              {!anchorsReady ? " · 锚定词中英必填" : ""}
            </span>
          }
        >
          <div className="flex w-full gap-2">
            <button
              type="button"
              disabled={!scriptFinalized || isGenerating || styleFinalized}
              className={STORY_NODE_ACTION_BTN_SPLIT_CLASS}
              onClick={onGenerateDraft}
            >
              <Sparkles className="size-3.5 shrink-0" />
              {isGenerating ? "生成中…" : "生成风格草稿"}
            </button>
            <button
              type="button"
              disabled={
                outputBusy || !canFinalizeStyle || hasMediaColumns
              }
              className={STORY_NODE_ACTION_BTN_SPLIT_CLASS}
              onClick={() => void onFinalizeStyle()}
            >
              <GitBranch className="size-3.5 shrink-0" />
              {outputBusy
                ? "生成中…"
                : hasMediaColumns
                  ? "工作流已生成"
                  : "风格定稿 · 生成工作流"}
            </button>
          </div>
        </StoryNodeFooterShell>
      }
    >
      <div className="nodrag flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
        <p className={STORY_HINT_LABEL_CLASS}>主风格</p>
        <select
          className="w-full rounded border border-white/15 bg-black/30 px-2 py-1.5 text-[12px] text-white"
          value={d.mainStyle ?? ""}
          disabled={fieldsLocked}
          onChange={(e) =>
            updateNodeData(id, {
              mainStyle: (e.target.value || undefined) as StoryProMainStyle,
            })
          }
        >
          <option value="">选择主风格…</option>
          {MAIN_STYLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <label className="block space-y-1">
          <span className={STORY_HINT_LABEL_CLASS}>中文锚定词</span>
          <textarea
            className="min-h-[72px] w-full resize-y rounded border border-white/15 bg-black/30 px-2 py-1.5 text-[12px] text-white"
            value={d.styleAnchorZh ?? ""}
            disabled={fieldsLocked}
            onChange={(e) =>
              updateNodeData(id, { styleAnchorZh: e.target.value })
            }
            placeholder="画面风格、光影、材质…"
          />
        </label>

        <label className="block space-y-1">
          <span className={STORY_HINT_LABEL_CLASS}>English anchor</span>
          <textarea
            className="min-h-[72px] w-full resize-y rounded border border-white/15 bg-black/30 px-2 py-1.5 text-[12px] text-white"
            value={d.styleAnchorEn ?? ""}
            disabled={fieldsLocked}
            onChange={(e) =>
              updateNodeData(id, { styleAnchorEn: e.target.value })
            }
            placeholder="Style anchor in English…"
          />
        </label>

        <label className="block space-y-1">
          <span className={STORY_HINT_LABEL_CLASS}>Negative prompt</span>
          <textarea
            className="min-h-[56px] w-full resize-y rounded border border-white/15 bg-black/30 px-2 py-1.5 text-[12px] text-white"
            value={d.negativePrompt ?? ""}
            disabled={fieldsLocked}
            onChange={(e) =>
              updateNodeData(id, { negativePrompt: e.target.value })
            }
            placeholder="low quality, blurry, …"
          />
        </label>

        <div className="flex items-center gap-2 rounded border border-white/10 bg-white/5 px-2 py-2 text-[11px] text-white/80">
          <Palette className="size-3.5 shrink-0 text-[#fb923c]" />
          参考图 {refCount} 张
          {refCount < 3 ? (
            <span className="text-amber-200/90">（定稿需 ≥3）</span>
          ) : null}
        </div>
      </div>
    </NodeShell>
  );
}
