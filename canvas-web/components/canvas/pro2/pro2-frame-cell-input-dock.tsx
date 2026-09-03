"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { useNodes } from "@xyflow/react";
import { MentionsEditable } from "@/components/canvas/mentions/MentionsEditable";
import { useCanvasStore } from "@/lib/canvas/store";
import { countLibtvSelectedNonGroupNodes } from "@/lib/canvas/libtv-floating-dock-selection";
import { useCanvasMarqueeSelecting } from "@/lib/canvas/use-canvas-marquee-selecting";
import { useLibtvFloatingDockHidden } from "@/lib/canvas/use-libtv-floating-dock";
import { useStableLibtvDockFlowPlacement } from "@/lib/canvas/libtv-dock-flow-placement";
import { batchRunStoryRows } from "@/lib/canvas/batch-run-nodes";
import { optimisticLibtvMediaRunStart } from "@/lib/canvas/libtv-image-node-run";
import { findPro2FrameImageNodeForRow } from "@/lib/canvas/pro2-spawn-frame-image-group";
import { dockActiveRefIdsFromPrompt } from "@/lib/canvas/dock-mention-ref-urls";
import { buildPro2DockMentionables } from "@/lib/canvas/pro2-dock-mentionables";
import {
  buildFrameBoardRefCatalog,
  syncPro2FrameRowUpstreamRefs,
} from "@/lib/canvas/pro2-wire-frame-board-refs";
import { findStoryPro2WorkspaceFromHub } from "@/lib/canvas/spawn-story-pro2-workspace";
import {
  refreshStoryRefImagesFromCatalog,
  storyRefIdsFromPrompt,
  storyRefImagesFromPrompt,
  type StoryRefImage,
} from "@/lib/canvas/story-ref-image";
import {
  PRO2_DOCK_TEXTAREA_CLASS,
  PRO2_DOCK_TEXTAREA_INSET_CLASS,
} from "@/lib/canvas/story-pro2-node-chrome";
import { LIBTV_INPUT_DOCK_SEND_BTN_CLASS } from "@/lib/canvas/libtv-node-chrome";
import type {
  StoryProCharacterRow,
  StoryProFrameRow,
  StoryProPropRow,
  StoryProSceneRow,
  StoryProScriptHubNodeData,
} from "@/lib/canvas/story-pro-workspace-types";
import { RF_FORM_CONTROL, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";
import { Pro2DockRefImages } from "./pro2-dock-ref-images";
import { usePro2FrameCellDockPlacement } from "./use-pro2-frame-cell-dock-placement";
import { Pro2DockToolbar, Pro2InputDockShell } from "./pro2-input-dock-shell";

function frameRowStatus(row: StoryProFrameRow): "idle" | "running" | "error" {
  const st = row.runtime?.status;
  if (st === "running" || st === "pending") return "running";
  return "idle";
}

function rowRefsNeedSync(row: StoryProFrameRow): boolean {
  const prompt = row.prompt ?? row.frameImagePrompt ?? "";
  if (!prompt.trim()) return false;
  const ids = storyRefIdsFromPrompt(prompt);
  if (ids.length) return false;
  return /[\u4e00-\u9fff]{2,}/.test(prompt);
}

function patchFrameRow(
  rows: StoryProFrameRow[],
  rowKey: string,
  patch: Partial<StoryProFrameRow>,
): StoryProFrameRow[] {
  return rows.map((r) => (r.key === rowKey ? { ...r, ...patch } : r));
}

/** 2.0 分镜图板 · 单格底部输入坞 */
export function Pro2FrameCellInputDock() {
  const rfNodes = useNodes();
  const focus = useCanvasStore((s) => s.pro2FrameDockFocus);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeRuntime = useCanvasStore((s) => s.setNodeRuntime);
  const marqueeSelecting = useCanvasMarqueeSelecting();
  const multiSelectActive = useCanvasStore((s) => s.canvasMultiSelectActive);
  const syncedRowKeyRef = useRef<string | null>(null);

  const selectedFrame = useMemo(() => {
    if (marqueeSelecting || multiSelectActive) return null;
    if (countLibtvSelectedNonGroupNodes(rfNodes) >= 2) return null;
    const picked = rfNodes.filter(
      (n) => n.selected && n.type === "story-pro2-frame",
    );
    return picked.length === 1 ? picked[0] : null;
  }, [rfNodes, marqueeSelecting, multiSelectActive]);

  const dockNodeId = selectedFrame?.id ?? null;
  const dockHidden = useLibtvFloatingDockHidden(dockNodeId);

  const activeFocus = useMemo(() => {
    if (!focus || !selectedFrame || focus.nodeId !== selectedFrame.id) {
      return null;
    }
    return focus;
  }, [focus, selectedFrame]);

  const storeNode = useMemo(() => {
    if (!activeFocus) return null;
    return nodes.find((n) => n.id === activeFocus.nodeId) ?? null;
  }, [activeFocus, nodes]);

  const rawPlacement = usePro2FrameCellDockPlacement(
    activeFocus?.nodeId ?? null,
    activeFocus?.rowKey ?? null,
  );
  const placement = useStableLibtvDockFlowPlacement(rawPlacement);

  const hubNodeId = (storeNode?.data as { hubNodeId?: string } | undefined)
    ?.hubNodeId;

  const workspaceRows = useMemo(() => {
    if (!hubNodeId) {
      return {
        characterRows: [] as StoryProCharacterRow[],
        sceneRows: [] as StoryProSceneRow[],
        propRows: [] as StoryProPropRow[],
      };
    }
    const ws = findStoryPro2WorkspaceFromHub(nodes, edges, hubNodeId);
    const hub = nodes.find((n) => n.id === hubNodeId);
    const propRows =
      (hub?.data as StoryProScriptHubNodeData | undefined)
        ?.scriptStudioPropRows ?? [];
    const characterRows =
      (ws?.characterColumnId
        ? nodes.find((n) => n.id === ws.characterColumnId)?.data
        : undefined) as { rows?: StoryProCharacterRow[] } | undefined;
    const sceneRows =
      (ws?.sceneColumnId
        ? nodes.find((n) => n.id === ws.sceneColumnId)?.data
        : undefined) as { rows?: StoryProSceneRow[] } | undefined;
    return {
      characterRows: characterRows?.rows ?? [],
      sceneRows: sceneRows?.rows ?? [],
      propRows,
    };
  }, [hubNodeId, nodes, edges]);

  const refCatalog = useMemo(
    () =>
      buildFrameBoardRefCatalog(
        workspaceRows.characterRows,
        workspaceRows.sceneRows,
        workspaceRows.propRows,
      ),
    [workspaceRows],
  );

  const row = useMemo(() => {
    if (!storeNode || !activeFocus) return null;
    const rows = (storeNode.data as { rows?: StoryProFrameRow[] }).rows ?? [];
    return rows.find((r) => r.key === activeFocus.rowKey) ?? null;
  }, [storeNode, activeFocus]);

  useEffect(() => {
    if (!storeNode || !activeFocus || !row) return;
    const syncKey = `${storeNode.id}:${activeFocus.rowKey}`;
    const needsSync =
      syncedRowKeyRef.current !== syncKey || rowRefsNeedSync(row);
    if (!needsSync) return;

    const synced = syncPro2FrameRowUpstreamRefs(
      row,
      workspaceRows.characterRows,
      workspaceRows.sceneRows,
      workspaceRows.propRows,
    );
    syncedRowKeyRef.current = syncKey;

    if (
      synced.prompt === row.prompt &&
      JSON.stringify(synced.refImages ?? []) ===
        JSON.stringify(row.refImages ?? [])
    ) {
      return;
    }

    const rows = (storeNode.data as { rows?: StoryProFrameRow[] }).rows ?? [];
    updateNodeData(
      storeNode.id,
      {
        rows: patchFrameRow(rows, activeFocus.rowKey, {
          prompt: synced.prompt,
          refImages: synced.refImages,
          refImageUrls: synced.refImageUrls,
          referencedNodeIds: synced.referencedNodeIds,
        }),
      },
      { commit: false },
    );
  }, [storeNode, activeFocus, row, workspaceRows, updateNodeData]);

  const refImages = row?.refImages ?? [];

  const mentionables = useMemo(
    () => buildPro2DockMentionables([], refCatalog),
    [refCatalog],
  );

  const activeRefIds = useMemo(
    () => dockActiveRefIdsFromPrompt(row?.prompt ?? ""),
    [row?.prompt],
  );

  const persistRow = useCallback(
    (
      value: string,
      nextRefImages: StoryRefImage[],
      meta?: { commit?: boolean },
    ) => {
      if (!storeNode || !activeFocus) return;
      const rows = (storeNode.data as { rows?: StoryProFrameRow[] }).rows ?? [];
      const refreshed = refreshStoryRefImagesFromCatalog(
        nextRefImages,
        refCatalog,
      );
      const refImageUrls = refreshed
        .map((ref) => ref.url)
        .filter((u): u is string => Boolean(u && /^https?:\/\//.test(u)));
      updateNodeData(
        storeNode.id,
        {
          rows: patchFrameRow(rows, activeFocus.rowKey, {
            prompt: value,
            refImages: refreshed,
            refImageUrls,
            referencedNodeIds: storyRefIdsFromPrompt(value),
          }),
        },
        { commit: meta?.commit ?? true },
      );
    },
    [storeNode, activeFocus, updateNodeData, refCatalog],
  );

  const onPromptChange = useCallback(
    (value: string, meta?: { commit?: boolean }) => {
      const nextRefs = refreshStoryRefImagesFromCatalog(
        storyRefImagesFromPrompt(value, refCatalog),
        refCatalog,
      );
      persistRow(value, nextRefs, meta);
    },
    [persistRow, refCatalog],
  );

  const onRefImagesChange = useCallback(
    (next: StoryRefImage[]) => {
      persistRow(row?.prompt ?? "", next, { commit: true });
    },
    [persistRow, row?.prompt],
  );

  const onRegenerate = useCallback(() => {
    if (!storeNode || !activeFocus || !row) return;
    const img = findPro2FrameImageNodeForRow(
      nodes,
      storeNode.id,
      activeFocus.rowKey,
    );
    if (img) {
      optimisticLibtvMediaRunStart(img.id, updateNodeData, setNodeRuntime);
    }
    batchRunStoryRows(storeNode.id, [activeFocus.rowKey], "frameImage", {
      forceFresh: true,
    });
  }, [storeNode, activeFocus, row, nodes, updateNodeData, setNodeRuntime]);

  if (!storeNode || !row || !placement || !activeFocus) return null;

  const running = frameRowStatus(row) === "running";
  const prompt = row.prompt ?? "";

  return (
    <Pro2InputDockShell
      flowAnchor={placement}
      dockClassName="pro2-frame-cell-dock"
      hidden={dockHidden}
      anchorNodeId={storeNode.id}
      header={
        <Pro2DockToolbar>
          <Pro2DockRefImages
            refs={refImages}
            onChange={onRefImagesChange}
            promptValue={prompt}
            onPromptChange={(next) => onPromptChange(next, { commit: true })}
            disabled={running}
            pasteActive={false}
            activeIds={activeRefIds}
            spawnAnchor={{
              nodeId: storeNode.id,
              nodeType: "story-pro2-frame",
            }}
            maxCount={12}
          />
        </Pro2DockToolbar>
      }
      footer={
        <Pro2DockToolbar>
          <div className="min-w-0 flex-1" />
          <button
            type="button"
            disabled={running || !prompt.trim()}
            className={cn(LIBTV_INPUT_DOCK_SEND_BTN_CLASS, "size-9")}
            title="重新生成该镜分镜图"
            onClick={onRegenerate}
          >
            {running ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </button>
        </Pro2DockToolbar>
      }
    >
      <MentionsEditable
        key={`${storeNode.id}:${activeFocus.rowKey}`}
        sourceId={`${storeNode.id}:${activeFocus.rowKey}`}
        className={cn(
          PRO2_DOCK_TEXTAREA_CLASS,
          RF_FORM_CONTROL,
          RF_NO_WHEEL,
          PRO2_DOCK_TEXTAREA_INSET_CLASS,
        )}
        placeholder="描述本镜画面… 输入 @ 引用角色/场景/道具"
        value={prompt}
        mentionables={mentionables}
        disabled={running}
        rows={4}
        mentionInlineThumb
        mentionInlineThumbHoverOnText
        mentionEdition="pro2"
        onChange={onPromptChange}
      />
    </Pro2InputDockShell>
  );
}
