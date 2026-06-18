"use client";

import { useCallback, useMemo } from "react";
import { ArrowUp, Loader2, MapPin, Upload } from "lucide-react";
import { MentionsTextarea } from "@/components/canvas/mentions/MentionsTextarea";
import { useCanvasStore } from "@/lib/canvas/store";
import { PRO2_DOCK_TEXTAREA_CLASS } from "@/lib/canvas/story-pro2-node-chrome";
import { buildPro2DockMentionables } from "@/lib/canvas/pro2-dock-mentionables";
import {
  resolvePro2DockUpstreamLinks,
  resolvePro2DockStyleFromUpstream,
} from "@/lib/canvas/pro2-dock-upstream-links";
import { dockActiveRefIdsFromPrompt } from "@/lib/canvas/dock-mention-ref-urls";
import { usePruneStaleDockMentions } from "@/lib/canvas/use-prune-stale-dock-mentions";
import type { Sbv1ImageNodeData } from "@/lib/canvas/sbv1-workspace-types";
import { RF_FORM_CONTROL, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";
import { Pro2DockPasteZone } from "../pro2/pro2-dock-paste-zone";
import { Pro2DockRefImages } from "../pro2/pro2-dock-ref-images";
import { Pro2DockStyleButton } from "../pro2/pro2-dock-style-button";
import { Pro2DockUpstreamChips } from "../pro2/pro2-dock-upstream-chips";
import {
  Pro2DockContextBar,
  Pro2DockToolbar,
  Pro2EmbeddedInputDock,
} from "../pro2/pro2-input-dock-shell";

export function sbv1ImageNodeUsesEmbeddedDock(
  _d: Sbv1ImageNodeData,
  _opts: { selected: boolean; soleSelected: boolean },
): boolean {
  /** 与视频合成一致：空态整卡可拖，输入坞浮动在节点下方（见 libtv §2.3） */
  return false;
}

/** 分镜视频 1.0 · 图片节点内嵌输入坞（空态 · 对齐 Pro2） */
export function Sbv1ImageNodeEmbeddedDock({
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
    (value: string, _refs?: string[], meta?: { commit?: boolean }) => {
      if (!storeNode) return;
      updateNodeData(
        storeNode.id,
        { dockInput: value },
        { commit: meta?.commit ?? true },
      );
    },
    [storeNode, updateNodeData],
  );

  const onOpenStyleLibrary = useCallback(() => {
    setPro2StyleLibImageNodeId(nodeId);
    window.dispatchEvent(new CustomEvent("canvas:open-pro2-style-library"));
  }, [nodeId, setPro2StyleLibImageNodeId]);

  if (!storeNode) return null;

  const styleRef = d.dockStyleRef;
  const linkedStyle = resolvePro2DockStyleFromUpstream(upstreamLinks);
  const styleActive = Boolean(styleRef || linkedStyle);
  const styleLabel = styleRef?.name ?? linkedStyle?.name;

  return (
    <Pro2EmbeddedInputDock
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
            className="nodrag flex size-8 items-center justify-center rounded-lg bg-white text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            title="发送（即将推出）"
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
        anchorNodeType="sbv1-image"
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
          placeholder="描述你想生成的画面，或输入 @ 引用已链接的图片…"
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
