"use client";

import { useCallback, useMemo } from "react";
import { ArrowUp, Loader2, MapPin } from "lucide-react";
import { useNodes } from "@xyflow/react";
import { MentionsTextarea } from "@/components/canvas/mentions/MentionsTextarea";
import { useCanvasStore } from "@/lib/canvas/store";
import { PRO2_DOCK_TEXTAREA_CLASS } from "@/lib/canvas/story-pro2-node-chrome";
import { buildPro2DockMentionables } from "@/lib/canvas/pro2-dock-mentionables";
import { resolvePro2DockUpstreamLinks } from "@/lib/canvas/pro2-dock-upstream-links";
import { dockActiveRefIdsFromPrompt } from "@/lib/canvas/dock-mention-ref-urls";
import { usePruneStaleDockMentions } from "@/lib/canvas/use-prune-stale-dock-mentions";
import type { Sbv1ImageNodeData } from "@/lib/canvas/sbv1-workspace-types";
import { RF_FORM_CONTROL, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";
import { usePro2DockPlacement } from "../pro2/use-pro2-dock-placement";
import { Pro2DockPasteZone } from "../pro2/pro2-dock-paste-zone";
import { Pro2DockRefImages } from "../pro2/pro2-dock-ref-images";
import { Pro2DockStyleButton } from "../pro2/pro2-dock-style-button";
import { Pro2DockUpstreamChips } from "../pro2/pro2-dock-upstream-chips";
import {
  Pro2DockContextBar,
  Pro2DockToolbar,
  Pro2InputDockShell,
} from "../pro2/pro2-input-dock-shell";
import { sbv1ImageNodeUsesEmbeddedDock } from "./sbv1-image-node-embedded-dock";

/** 分镜视频 1.0 · 图片节点底部浮动输入坞（有图时 · 对齐 Pro2） */
export function Sbv1ImageInputDock() {
  const rfNodes = useNodes();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setPro2StyleLibImageNodeId = useCanvasStore(
    (s) => s.setPro2StyleLibImageNodeId,
  );

  const selectedImage = useMemo(() => {
    const picked = rfNodes.filter(
      (n) => n.selected && n.type === "sbv1-image",
    );
    return picked.length === 1 ? picked[0] : null;
  }, [rfNodes]);

  const storeNode = useMemo(() => {
    if (!selectedImage) return null;
    return nodes.find((n) => n.id === selectedImage.id) ?? null;
  }, [selectedImage, nodes]);

  const placement = usePro2DockPlacement(selectedImage?.id ?? null);
  const d = (storeNode?.data ?? {}) as Sbv1ImageNodeData;
  const dockInput = d.dockInput ?? "";
  const isRunning = Boolean(d.uploading);

  const upstreamLinks = useMemo(() => {
    if (!storeNode) return [];
    return resolvePro2DockUpstreamLinks(
      storeNode.id,
      "sbv1-image",
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

  const onPromptChange = useCallback(
    (value: string) => {
      if (!storeNode) return;
      updateNodeData(storeNode.id, { dockInput: value });
    },
    [storeNode, updateNodeData],
  );

  const onOpenStyleLibrary = useCallback(() => {
    if (!storeNode) return;
    setPro2StyleLibImageNodeId(storeNode.id);
    window.dispatchEvent(new CustomEvent("canvas:open-pro2-style-library"));
  }, [storeNode, setPro2StyleLibImageNodeId]);

  if (!storeNode || !placement) return null;
  if (
    sbv1ImageNodeUsesEmbeddedDock(d, {
      selected: true,
      soleSelected: true,
    })
  ) {
    return null;
  }

  const styleRef = d.dockStyleRef;

  return (
    <Pro2InputDockShell
      left={placement.left}
      top={placement.top}
      dockClassName="sbv1-image-dock"
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
              nodeType: "sbv1-image",
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
            disabled
            className="nodrag flex size-9 items-center justify-center rounded-xl bg-white text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            title="发送（即将推出）"
          >
            {isRunning ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </button>
        </Pro2DockToolbar>
      }
    >
      <Pro2DockPasteZone
        anchorNodeId={storeNode.id}
        anchorNodeType="sbv1-image"
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
          placeholder="描述你想生成的画面，或输入 @ 引用已链接的图片…"
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
