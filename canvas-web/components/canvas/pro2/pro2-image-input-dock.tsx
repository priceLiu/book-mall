"use client";

import { useCallback, useMemo } from "react";
import { ArrowUp, Loader2, MapPin } from "lucide-react";
import { useNodes } from "@xyflow/react";
import { MentionsTextarea } from "@/components/canvas/mentions/MentionsTextarea";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import { useProjectAssets } from "@/lib/canvas/use-project-assets";
import { batchRunStoryRowsSequential } from "@/lib/canvas/batch-run-nodes";
import { PRO2_DOCK_TEXTAREA_CLASS } from "@/lib/canvas/story-pro2-node-chrome";
import { buildPro2DockMentionables } from "@/lib/canvas/pro2-dock-mentionables";
import {
  resolvePro2DockUpstreamLinks,
  resolvePro2DockStyleFromUpstream,
} from "@/lib/canvas/pro2-dock-upstream-links";
import { pro2DockRefImageCatalog } from "@/lib/canvas/pro2-dock-ref-catalog";
import { dockActiveRefIdsFromPrompt } from "@/lib/canvas/dock-mention-ref-urls";
import { usePruneStaleDockMentions } from "@/lib/canvas/use-prune-stale-dock-mentions";
import type {
  StoryPro2ImageNodeData,
  StoryProFrameRow,
} from "@/lib/canvas/story-pro2-workspace-types";
import { RF_FORM_CONTROL, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";
import { usePro2DockPlacement } from "./use-pro2-dock-placement";
import {
  Pro2DockContextBar,
  Pro2DockToolbar,
  Pro2InputDockShell,
} from "./pro2-input-dock-shell";
import { Pro2DockPasteZone } from "./pro2-dock-paste-zone";
import { Pro2DockRefImages } from "./pro2-dock-ref-images";
import { Pro2DockUpstreamChips } from "./pro2-dock-upstream-chips";
import { Pro2DockStyleButton } from "./pro2-dock-style-button";
import {
  pro2ImageNodeUsesEmbeddedDock,
} from "./pro2-image-node-embedded-dock";

function framePromptPlaceholder(role?: string): string {
  if (role === "frame") {
    return "编辑本镜画面描述；输入 @ 引用角色三视图或风格参考…";
  }
  return "描述你想生成的画面，或输入 @ 引用已链接的图片…";
}

/** 2.0 图片节点 · 底部输入坞（含风格库按钮） */
export function Pro2ImageInputDock() {
  const base = useBookMallBaseUrl();
  const projectId = useCanvasStore((s) => s.projectId);
  const { assets: libraryAssets } = useProjectAssets(base, {
    projectId,
    scope: "library",
  });
  const rfNodes = useNodes();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setPro2StyleLibImageNodeId = useCanvasStore(
    (s) => s.setPro2StyleLibImageNodeId,
  );

  const canvasGeometryDragging = useCanvasStore((s) => s.canvasGeometryDragging);

  const selectedImage = useMemo(() => {
    const picked = rfNodes.filter((n) => {
      if (!n.selected || n.type !== "story-pro2-image") return false;
      return (
        (n.data as { pro2MediaRole?: string }).pro2MediaRole !==
        "character-three-view"
      );
    });
    return picked.length === 1 ? picked[0] : null;
  }, [rfNodes]);

  const storeNode = useMemo(() => {
    if (!selectedImage) return null;
    return nodes.find((n) => n.id === selectedImage.id) ?? null;
  }, [selectedImage, nodes]);

  const placement = usePro2DockPlacement(selectedImage?.id ?? null);
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
    () =>
      buildPro2DockMentionables(
        upstreamLinks,
        [],
        libraryAssets.filter(
          (a) =>
            a.kind === "STORYBOARD_IMAGE" ||
            a.kind === "CHARACTER" ||
            a.kind === "STYLE",
        ),
      ),
    [upstreamLinks, libraryAssets],
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
    if (!storeNode) return;
    setPro2StyleLibImageNodeId(storeNode.id);
    window.dispatchEvent(new CustomEvent("canvas:open-pro2-style-library"));
  }, [storeNode, setPro2StyleLibImageNodeId]);

  if (!storeNode || !placement) return null;
  if (
    pro2ImageNodeUsesEmbeddedDock(d, {
      selected: true,
      soleSelected: true,
    })
  ) {
    return null;
  }

  const styleRef = d.dockStyleRef;
  const linkedStyle = resolvePro2DockStyleFromUpstream(upstreamLinks);
  const styleActive = Boolean(styleRef || linkedStyle);
  const styleLabel = styleRef?.name ?? linkedStyle?.name;
  const canRegenerate =
    mediaRole === "frame" &&
    Boolean(d.pro2ControllerNodeId && d.pro2RowKey && dockInput.trim());

  return (
    <Pro2InputDockShell
      flowAnchor={placement}
      dockClassName="pro2-image-dock"
      hidden={canvasGeometryDragging}
      header={
        <Pro2DockContextBar>
          <Pro2DockStyleButton
            active={styleActive}
            label={styleLabel}
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
        <>
          <Pro2DockToolbar>
            <div className="min-w-0 flex-1" />
            <button
              type="button"
              disabled={!canRegenerate || isRunning}
              className="nodrag flex size-9 items-center justify-center rounded-xl bg-white text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
              title={canRegenerate ? "重新生成" : "发送（即将推出）"}
              onClick={onRegenerate}
            >
              {isRunning ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </button>
          </Pro2DockToolbar>
        </>
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
            "min-h-0 px-4 py-3",
          )}
          placeholder={framePromptPlaceholder(mediaRole)}
          value={dockInput}
          mentionables={mentionables}
          disabled={isRunning}
          rows={3}
          onChange={onPromptChange}
        />
      </Pro2DockPasteZone>
    </Pro2InputDockShell>
  );
}
