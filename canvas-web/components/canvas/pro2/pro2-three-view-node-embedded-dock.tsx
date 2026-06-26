"use client";

import { useCallback, useEffect, useMemo } from "react";
import { ArrowUp, Loader2, MapPin } from "lucide-react";
import { MentionsEditable } from "@/components/canvas/mentions/MentionsEditable";
import { useCanvasStore } from "@/lib/canvas/store";
import { batchRunStoryRowsSequential } from "@/lib/canvas/batch-run-nodes";
import { PRO2_DOCK_TEXTAREA_CLASS } from "@/lib/canvas/story-pro2-node-chrome";
import { buildPro2DockMentionables } from "@/lib/canvas/pro2-dock-mentionables";
import { resolvePro2DockUpstreamLinks } from "@/lib/canvas/pro2-dock-upstream-links";
import { dockActiveRefIdsFromPrompt } from "@/lib/canvas/dock-mention-ref-urls";
import { usePruneStaleDockMentions } from "@/lib/canvas/use-prune-stale-dock-mentions";
import {
  PRO2_THREE_VIEW_MODEL_KEYS,
  pickDefaultPro2ThreeViewImageEngine,
} from "@/lib/canvas/pro2-three-view-batch-image";
import type {
  StoryPro2ThreeViewNodeData,
  StoryProCharacterRow,
} from "@/lib/canvas/story-pro2-workspace-types";
import { RF_FORM_CONTROL, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { cn } from "@/lib/utils";
import { EnginePicker } from "../engine-picker";
import {
  Pro2DockHeader,
  Pro2DockToolbar,
  Pro2EmbeddedInputDock,
} from "./pro2-input-dock-shell";
import { Pro2DockStyleButton } from "./pro2-dock-style-button";
import { Pro2DockUpstreamChips } from "./pro2-dock-upstream-chips";

/** 与 `story-pro2-image` · character-three-view 一致：仅用底部浮动 Dock，卡片始终可整卡拖动 */
export function pro2ThreeViewNodeUsesEmbeddedDock(
  _d: StoryPro2ThreeViewNodeData,
  _opts: { selected: boolean; soleSelected: boolean },
): boolean {
  return false;
}

/** 2.0 三视图节点 · 内嵌输入区（空态时占满卡片） */
export function Pro2ThreeViewNodeEmbeddedDock({ nodeId }: { nodeId: string }) {
  const { providers } = useUserProviders();
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
  const d = (storeNode?.data ?? {}) as StoryPro2ThreeViewNodeData;
  const dockInput = d.dockInput ?? "";
  const isRunning = Boolean(d.uploading);
  const controllerId = d.pro2ControllerNodeId;

  const controller = useMemo(() => {
    if (!controllerId) return null;
    return nodes.find((n) => n.id === controllerId) ?? null;
  }, [controllerId, nodes]);

  const batchImage = (controller?.data as {
    batchImage?: {
      providerId?: string;
      modelKey?: string;
      params?: Record<string, unknown>;
    };
  })?.batchImage;

  useEffect(() => {
    if (!controller || batchImage?.providerId?.trim()) return;
    const pick = pickDefaultPro2ThreeViewImageEngine(providers);
    if (!pick) return;
    updateNodeData(controller.id, { batchImage: pick });
  }, [controller, batchImage?.providerId, providers, updateNodeData]);

  const upstreamLinks = useMemo(() => {
    if (!storeNode) return [];
    return resolvePro2DockUpstreamLinks(
      storeNode.id,
      "story-pro2-three-view",
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

  const syncCharacterRowPrompt = useCallback(
    (value: string) => {
      if (!storeNode || !controllerId) return;
      const rowKey = d.pro2RowKey;
      if (!rowKey) return;
      const ctrl = nodes.find((n) => n.id === controllerId);
      if (!ctrl) return;
      const rows =
        (ctrl.data as { rows?: StoryProCharacterRow[] }).rows ?? [];
      updateNodeData(controllerId, {
        rows: rows.map((r) =>
          r.key === rowKey ? { ...r, prompt: value } : r,
        ),
      });
    },
    [storeNode, controllerId, d.pro2RowKey, nodes, updateNodeData],
  );

  const onPromptChange = useCallback(
    (value: string, _refs?: string[], meta?: { commit?: boolean }) => {
      if (!storeNode) return;
      updateNodeData(
        storeNode.id,
        { dockInput: value },
        { commit: meta?.commit ?? true },
      );
      syncCharacterRowPrompt(value);
    },
    [storeNode, updateNodeData, syncCharacterRowPrompt],
  );

  const onPickImageEngine = useCallback(
    (next: {
      providerId: string;
      modelKey: string;
      params: Record<string, unknown>;
    }) => {
      if (!controllerId) return;
      updateNodeData(controllerId, {
        batchImage: {
          providerId: next.providerId,
          modelKey: next.modelKey,
          params: next.params,
        },
      });
    },
    [controllerId, updateNodeData],
  );

  const onRegenerate = useCallback(() => {
    if (!storeNode || !controllerId || !d.pro2RowKey) return;
    batchRunStoryRowsSequential(controllerId, [d.pro2RowKey], "threeView", {
      forceFresh: true,
    });
  }, [storeNode, controllerId, d.pro2RowKey]);

  const onOpenStyleLibrary = useCallback(() => {
    setPro2StyleLibImageNodeId(nodeId);
    window.dispatchEvent(new CustomEvent("canvas:open-pro2-style-library"));
  }, [nodeId, setPro2StyleLibImageNodeId]);

  if (!storeNode) return null;

  const styleRef = d.dockStyleRef;
  const canRegenerate = Boolean(
    controllerId && d.pro2RowKey && dockInput.trim() && batchImage?.modelKey,
  );

  return (
    <Pro2EmbeddedInputDock
      header={
        <Pro2DockHeader
          refRow={
            upstreamLinks.length > 0 ? (
              <Pro2DockUpstreamChips
                links={upstreamLinks}
                anchorNodeId={storeNode.id}
                activeIds={activeRefIds}
              />
            ) : null
          }
          actionRow={
            <>
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
            </>
          }
        />
      }
      footer={
        <Pro2DockToolbar>
          <div className="min-w-0 flex-1">
            <EnginePicker
              role="IMAGE"
              allowedModelKeys={PRO2_THREE_VIEW_MODEL_KEYS}
              providerId={batchImage?.providerId ?? ""}
              modelKey={batchImage?.modelKey ?? ""}
              params={batchImage?.params ?? {}}
              onChange={onPickImageEngine}
            />
          </div>
          <button
            type="button"
            disabled={!canRegenerate || isRunning}
            className="nodrag flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            title={canRegenerate ? "重新生成三视图" : "请先选择生图模型并填写提示词"}
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
      <MentionsEditable
        className={cn(
          PRO2_DOCK_TEXTAREA_CLASS,
          RF_FORM_CONTROL,
          RF_NO_WHEEL,
          "min-h-[72px] px-3 py-2 text-[12px]",
        )}
        placeholder="编辑角色外观提示词；输入 @ 引用风格或参考图…"
        value={dockInput}
        mentionables={mentionables}
        disabled={isRunning}
        rows={2}
        mentionInlineThumb
        mentionEdition="pro2"
        onChange={onPromptChange}
      />
    </Pro2EmbeddedInputDock>
  );
}
