"use client";

import { useCallback, useMemo } from "react";
import { ArrowUp, Loader2, MapPin, Upload } from "lucide-react";
import { MentionsTextarea } from "@/components/canvas/mentions/MentionsTextarea";
import { useCanvasStore } from "@/lib/canvas/store";
import { batchRunStoryRowsSequential } from "@/lib/canvas/batch-run-nodes";
import { PRO2_DOCK_TEXTAREA_CLASS } from "@/lib/canvas/story-pro2-node-chrome";
import { buildPro2DockMentionables } from "@/lib/canvas/pro2-dock-mentionables";
import { resolvePro2DockUpstreamLinks } from "@/lib/canvas/pro2-dock-upstream-links";
import { pro2DockRefImageCatalog } from "@/lib/canvas/pro2-dock-ref-catalog";
import { dockActiveRefIdsFromPrompt } from "@/lib/canvas/dock-mention-ref-urls";
import { usePruneStaleDockMentions } from "@/lib/canvas/use-prune-stale-dock-mentions";
import type {
  StoryPro2ImageNodeData,
  StoryProFrameRow,
} from "@/lib/canvas/story-pro2-workspace-types";
import { RF_FORM_CONTROL, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";
import {
  Pro2DockContextBar,
  Pro2DockToolbar,
  Pro2EmbeddedInputDock,
} from "./pro2-input-dock-shell";
import { Pro2DockPasteZone } from "./pro2-dock-paste-zone";
import { Pro2DockRefImages } from "./pro2-dock-ref-images";
import { Pro2DockStyleButton } from "./pro2-dock-style-button";
import { Pro2DockUpstreamChips } from "./pro2-dock-upstream-chips";

function framePromptPlaceholder(role?: string): string {
  if (role === "frame") {
    return "编辑本镜画面描述；输入 @ 引用角色三视图或风格参考…";
  }
  return "描述你想生成的画面，或输入 @ 引用已链接的图片…";
}

export function pro2ImageNodeUsesEmbeddedDock(
  _d: StoryPro2ImageNodeData,
  _opts: { selected: boolean; soleSelected: boolean },
): boolean {
  /** 与三视图 / sbv1-image 一致：空态整卡可拖，输入坞仅浮动（见 libtv-unified-node-catalog.md §3） */
  return false;
}

/** 2.0 图片节点 · 内嵌输入区（空态时占满卡片，不再浮动在节点下方） */
export function Pro2ImageNodeEmbeddedDock({
  nodeId,
  onUpload,
}: {
  nodeId: string;
  onUpload?: () => void;
}) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setPro2StyleLibImageNodeId = useCanvasStore(
    (s) => s.setPro2StyleLibImageNodeId,
  );

  const storeNode = useMemo(
    () => nodes.find((n) => n.id === nodeId) ?? null,
    [nodes, nodeId],
  );
  const d = (storeNode?.data ?? {}) as StoryPro2ImageNodeData;
  const dockInput = d.dockInput ?? "";
  const mediaRole = d.pro2MediaRole ?? "generic";
  const isRunning = Boolean(d.uploading);

  const upstreamLinks = useMemo(() => {
    if (!storeNode) return [];
    return resolvePro2DockUpstreamLinks(
      storeNode.id,
      "story-pro2-image",
      nodes,
      edges,
    );
  }, [storeNode, nodes, edges]);

  const mentionables = useMemo(
    () => buildPro2DockMentionables(upstreamLinks),
    [upstreamLinks],
  );
  const activeRefIds = useMemo(
    () => dockActiveRefIdsFromPrompt(dockInput),
    [dockInput],
  );

  usePruneStaleDockMentions({
    nodeId: storeNode?.id ?? null,
    prompt: dockInput,
    mentionables,
    field: "dockInput",
    updateNodeData,
  });

  const syncFrameRowPrompt = useCallback(
    (value: string) => {
      if (!storeNode || mediaRole !== "frame") return;
      const controllerId = d.pro2ControllerNodeId;
      const rowKey = d.pro2RowKey;
      if (!controllerId || !rowKey) return;
      const controller = nodes.find((n) => n.id === controllerId);
      if (!controller) return;
      const rows = (controller.data as { rows?: StoryProFrameRow[] }).rows ?? [];
      const refImages = pro2DockRefImageCatalog(upstreamLinks);
      updateNodeData(controllerId, {
        rows: rows.map((r) =>
          r.key === rowKey ? { ...r, prompt: value, refImages } : r,
        ),
      });
    },
    [storeNode, mediaRole, d.pro2ControllerNodeId, d.pro2RowKey, nodes, updateNodeData, upstreamLinks],
  );

  const onPromptChange = useCallback(
    (value: string) => {
      if (!storeNode) return;
      updateNodeData(storeNode.id, { dockInput: value });
      syncFrameRowPrompt(value);
    },
    [storeNode, updateNodeData, syncFrameRowPrompt],
  );

  const onRegenerate = useCallback(() => {
    if (!storeNode || mediaRole !== "frame") return;
    const controllerId = d.pro2ControllerNodeId;
    const rowKey = d.pro2RowKey;
    if (!controllerId || !rowKey) return;
    batchRunStoryRowsSequential(controllerId, [rowKey], "frameImage", {
      forceFresh: true,
    });
  }, [storeNode, mediaRole, d.pro2ControllerNodeId, d.pro2RowKey]);

  const onOpenStyleLibrary = useCallback(() => {
    setPro2StyleLibImageNodeId(nodeId);
    window.dispatchEvent(new CustomEvent("canvas:open-pro2-style-library"));
  }, [nodeId, setPro2StyleLibImageNodeId]);

  if (!storeNode) return null;

  const styleRef = d.dockStyleRef;
  const canRegenerate =
    mediaRole === "frame" &&
    Boolean(d.pro2ControllerNodeId && d.pro2RowKey && dockInput.trim());

  return (
    <Pro2EmbeddedInputDock
      header={
        <Pro2DockContextBar>
          <Pro2DockStyleButton
            active={Boolean(styleRef)}
            label={styleRef?.name}
            disabled={isRunning}
            onClick={onOpenStyleLibrary}
          />
          <button
            type="button"
            disabled
            title="标记（即将推出）"
            className="nodrag flex size-9 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-white/12 bg-white/[0.04] text-[9px] text-white/35"
          >
            <MapPin className="size-4" strokeWidth={1.75} />
            <span>标记</span>
          </button>
          {onUpload ? (
            <button
              type="button"
              title="上传图片"
              className="nodrag flex size-9 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-white/12 bg-white/[0.04] text-[9px] text-white/70 transition hover:bg-white/[0.07]"
              onClick={onUpload}
            >
              <Upload className="size-4" strokeWidth={1.75} />
              <span>上传</span>
            </button>
          ) : null}
          <Pro2DockUpstreamChips
            links={upstreamLinks}
            anchorNodeId={storeNode.id}
            activeIds={activeRefIds}
          />
          <Pro2DockRefImages
            refs={[]}
            onChange={() => {}}
            disabled={isRunning}
            pasteActive={false}
            spawnAnchor={{
              nodeId: storeNode.id,
              nodeType: "story-pro2-image",
            }}
            maxCount={12}
          />
        </Pro2DockContextBar>
      }
      footer={
        <Pro2DockToolbar>
          <div className="min-w-0 flex-1" />
          <button
            type="button"
            disabled={!canRegenerate || isRunning}
            className="nodrag flex size-8 items-center justify-center rounded-lg bg-white text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            title={canRegenerate ? "重新生成" : "发送（即将推出）"}
            onClick={onRegenerate}
          >
            {isRunning ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ArrowUp className="size-3.5" />
            )}
          </button>
        </Pro2DockToolbar>
      }
    >
      <Pro2DockPasteZone
        anchorNodeId={storeNode.id}
        anchorNodeType="story-pro2-image"
        disabled={isRunning}
        maxImages={12}
      >
        <MentionsTextarea
          className={cn(
            PRO2_DOCK_TEXTAREA_CLASS,
            RF_FORM_CONTROL,
            RF_NO_WHEEL,
            "min-h-[72px] px-3 py-2 text-[12px]",
          )}
          placeholder={framePromptPlaceholder(mediaRole)}
          value={dockInput}
          mentionables={mentionables}
          disabled={isRunning}
          rows={2}
          onChange={onPromptChange}
        />
      </Pro2DockPasteZone>
    </Pro2EmbeddedInputDock>
  );
}
