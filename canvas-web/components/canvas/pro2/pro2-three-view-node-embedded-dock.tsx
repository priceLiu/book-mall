"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUp, ChevronDown, Loader2, MapPin, SlidersHorizontal } from "lucide-react";
import { MentionsEditable } from "@/components/canvas/mentions/MentionsEditable";
import { useCanvasStore } from "@/lib/canvas/store";
import { batchRunStoryRowsSequential } from "@/lib/canvas/batch-run-nodes";
import { busEnqueueNode } from "@/lib/canvas/canvas-run-bus";
import { PRO2_DOCK_TEXTAREA_CLASS } from "@/lib/canvas/story-pro2-node-chrome";
import { buildPro2DockMentionables } from "@/lib/canvas/pro2-dock-mentionables";
import { resolvePro2DockUpstreamLinks, resolvePro2DockStyleFromUpstream } from "@/lib/canvas/pro2-dock-upstream-links";
import { dockActiveRefIdsFromPrompt } from "@/lib/canvas/dock-mention-ref-urls";
import { usePruneStaleDockMentions } from "@/lib/canvas/use-prune-stale-dock-mentions";
import { pickDefaultPro2ThreeViewImageEngine } from "@/lib/canvas/pro2-three-view-batch-image";
import {
  pro2ThreeViewAsSbv1Settings,
  sbv1EngineToBatchImage,
  sbv1PatchToThreeViewNodeData,
} from "@/lib/canvas/pro2-three-view-engine";
import type {
  StoryPro2ThreeViewNodeData,
  StoryProCharacterRow,
} from "@/lib/canvas/story-pro2-workspace-types";
import type { Sbv1ImageNodeData } from "@/lib/canvas/sbv1-workspace-types";
import { RF_FORM_CONTROL, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { cn } from "@/lib/utils";
import {
  Sbv1ImageGenerateSettingsModal,
  sbv1ImageSettingsTriggerLabel,
} from "../sbv1/sbv1-image-generate-settings-modal";
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

  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const settingsData = useMemo(
    () => pro2ThreeViewAsSbv1Settings(d, batchImage ?? null),
    [d, batchImage],
  );

  const settingsLabel = sbv1ImageSettingsTriggerLabel(settingsData, providers);
  const hasImageModel = Boolean(
    settingsData.engine?.providerId?.trim() && settingsData.engine?.modelKey?.trim(),
  );

  useEffect(() => {
    if (!storeNode || hasImageModel) return;
    const pick = pickDefaultPro2ThreeViewImageEngine(providers);
    if (!pick) return;
    updateNodeData(storeNode.id, sbv1PatchToThreeViewNodeData({
      engine: {
        providerId: pick.providerId,
        modelKey: pick.modelKey,
        params: pick.params,
      },
      aspectRatio: "16:9",
      resolution: "2K",
      outputCount: 1,
    }));
    if (controllerId) {
      updateNodeData(controllerId, { batchImage: pick });
    }
  }, [storeNode, hasImageModel, providers, updateNodeData, controllerId]);

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

  const onConfirmSettings = useCallback(
    (patch: Partial<Sbv1ImageNodeData>) => {
      if (!storeNode) return;
      updateNodeData(storeNode.id, sbv1PatchToThreeViewNodeData(patch));
      const batch = sbv1EngineToBatchImage({ ...settingsData, ...patch });
      if (batch && controllerId) {
        updateNodeData(controllerId, { batchImage: batch });
      }
    },
    [storeNode, settingsData, controllerId, updateNodeData],
  );

  const onRegenerate = useCallback(() => {
    if (!storeNode) return;
    if (controllerId && d.pro2RowKey) {
      batchRunStoryRowsSequential(controllerId, [d.pro2RowKey], "threeView", {
        forceFresh: true,
      });
      return;
    }
    // 协作画布 · 无控制列：作为独立生图节点直接生成
    busEnqueueNode(storeNode.id, true);
  }, [storeNode, controllerId, d.pro2RowKey]);

  const onOpenStyleLibrary = useCallback(() => {
    setPro2StyleLibImageNodeId(nodeId);
    window.dispatchEvent(new CustomEvent("canvas:open-pro2-style-library"));
  }, [nodeId, setPro2StyleLibImageNodeId]);

  if (!storeNode) return null;

  const styleRef = d.dockStyleRef;
  const linkedStyle = resolvePro2DockStyleFromUpstream(upstreamLinks);
  const styleActive = Boolean(styleRef || linkedStyle);
  const styleLabel = styleRef?.name ?? linkedStyle?.name;
  const canRegenerate = Boolean(dockInput.trim() && hasImageModel);

  return (
    <>
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
              </>
            }
          />
        }
        footer={
          <Pro2DockToolbar className="gap-2">
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                title="图片生成设置"
                disabled={isRunning}
                className="nodrag rounded-md p-1.5 text-white/40 transition hover:bg-white/[0.06] hover:text-white/75 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => setSettingsOpen(true)}
              >
                <SlidersHorizontal className="size-4" />
              </button>
            </div>
            <button
              type="button"
              disabled={isRunning}
              className="nodrag flex h-8 min-w-0 flex-1 items-center gap-1 rounded-md px-2 text-left text-[12px] text-white/65 hover:bg-white/[0.06] hover:text-white/90"
              onClick={() => setSettingsOpen(true)}
            >
              <span className="truncate">{settingsLabel}</span>
              <ChevronDown className="size-3.5 shrink-0 opacity-45" />
            </button>
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

      <Sbv1ImageGenerateSettingsModal
        open={settingsOpen}
        data={settingsData}
        onClose={() => setSettingsOpen(false)}
        onConfirm={onConfirmSettings}
      />
    </>
  );
}
