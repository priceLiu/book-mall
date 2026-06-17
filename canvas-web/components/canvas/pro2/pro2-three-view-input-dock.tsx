"use client";

import { useCallback, useEffect, useMemo } from "react";
import { ArrowUp, Loader2, MapPin } from "lucide-react";
import { useNodes } from "@xyflow/react";
import { MentionsTextarea } from "@/components/canvas/mentions/MentionsTextarea";
import { useCanvasStore } from "@/lib/canvas/store";
import { libtvFloatingDockHidden } from "@/lib/canvas/use-viewport-transform-active";
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
import { usePro2DockPlacement } from "./use-pro2-dock-placement";
import {
  Pro2DockContextBar,
  Pro2DockToolbar,
  Pro2InputDockShell,
} from "./pro2-input-dock-shell";
import { Pro2DockStyleButton } from "./pro2-dock-style-button";
import { Pro2DockUpstreamChips } from "./pro2-dock-upstream-chips";
import { pro2ThreeViewNodeUsesEmbeddedDock } from "./pro2-three-view-node-embedded-dock";

/** 2.0 三视图节点 · 底部输入坞（图标区固定 / 正文可滚动） */
export function Pro2ThreeViewInputDock() {
  const rfNodes = useNodes();
  const { providers } = useUserProviders();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setPro2StyleLibImageNodeId = useCanvasStore(
    (s) => s.setPro2StyleLibImageNodeId,
  );

  const dockHidden = useCanvasStore((s) =>
    libtvFloatingDockHidden(s.canvasGeometryDragging, s.canvasViewportMoving),
  );

  const selected = useMemo(() => {
    const picked = rfNodes.filter(
      (n) => n.selected && n.type === "story-pro2-three-view",
    );
    return picked.length === 1 ? picked[0] : null;
  }, [rfNodes]);

  const storeNode = useMemo(() => {
    if (!selected) return null;
    return nodes.find((n) => n.id === selected.id) ?? null;
  }, [selected, nodes]);

  const placement = usePro2DockPlacement(selected?.id ?? null);
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
    (value: string) => {
      if (!storeNode) return;
      updateNodeData(storeNode.id, { dockInput: value });
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
    if (!storeNode) return;
    setPro2StyleLibImageNodeId(storeNode.id);
    window.dispatchEvent(new CustomEvent("canvas:open-pro2-style-library"));
  }, [storeNode, setPro2StyleLibImageNodeId]);

  if (!storeNode || !placement) return null;
  if (
    pro2ThreeViewNodeUsesEmbeddedDock(d, {
      selected: true,
      soleSelected: true,
    })
  ) {
    return null;
  }

  const styleRef = d.dockStyleRef;
  const canRegenerate = Boolean(
    controllerId && d.pro2RowKey && dockInput.trim() && batchImage?.modelKey,
  );

  return (
    <Pro2InputDockShell
      flowAnchor={placement}
      dockClassName="pro2-three-view-dock"
      hidden={dockHidden}
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
        </Pro2DockContextBar>
      }
      footer={
        <>
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
            className="nodrag flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            title={canRegenerate ? "重新生成三视图" : "请先选择生图模型并填写提示词"}
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
      <MentionsTextarea
        className={cn(
          PRO2_DOCK_TEXTAREA_CLASS,
          RF_FORM_CONTROL,
          RF_NO_WHEEL,
          "min-h-0 px-4 py-3",
        )}
        placeholder="编辑角色外观提示词；输入 @ 引用风格或参考图…"
        value={dockInput}
        mentionables={mentionables}
        disabled={isRunning}
        rows={4}
        onChange={onPromptChange}
        mentionInlineThumb
      />
    </Pro2InputDockShell>
  );
}
