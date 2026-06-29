"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUp, ChevronDown, Loader2, MapPin, SlidersHorizontal } from "lucide-react";
import { useNodes } from "@xyflow/react";
import { MentionsEditable } from "@/components/canvas/mentions/MentionsEditable";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import { useLibtvFloatingDock } from "@/lib/canvas/use-libtv-floating-dock";
import { batchRunStoryRowsSequential } from "@/lib/canvas/batch-run-nodes";
import { busEnqueueStoryRun } from "@/lib/canvas/canvas-run-bus";
import {
  optimisticLibtvMediaRunStart,
  revertOptimisticLibtvMediaRunStart,
} from "@/lib/canvas/libtv-image-node-run";
import { PRO2_DOCK_TEXTAREA_CLASS, PRO2_DOCK_TEXTAREA_INSET_CLASS } from "@/lib/canvas/story-pro2-node-chrome";
import { buildPro2DockMentionables } from "@/lib/canvas/pro2-dock-mentionables";
import {
  resolvePro2DockUpstreamLinks,
  resolvePro2DockStyleFromUpstream,
  enrichPro2DockUpstreamLinks,
  pro2DockStyleShownAsChip,
} from "@/lib/canvas/pro2-dock-upstream-links";
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
  Pro2InputDockShell,
} from "./pro2-input-dock-shell";
import { Pro2DockStyleButton } from "./pro2-dock-style-button";
import { Pro2DockUpstreamChips } from "./pro2-dock-upstream-chips";
import { pro2ThreeViewNodeUsesEmbeddedDock } from "./pro2-three-view-node-embedded-dock";

/** 2.0 三视图节点 · 底部输入坞（图标区固定 / 正文可滚动） */
export function Pro2ThreeViewInputDock() {
  const rfNodes = useNodes();
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const { providers } = useUserProviders();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeRuntime = useCanvasStore((s) => s.setNodeRuntime);
  const setPro2StyleLibImageNodeId = useCanvasStore(
    (s) => s.setPro2StyleLibImageNodeId,
  );

  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const dockNodeId = selected?.id ?? storeNode?.id ?? null;
  const { placement, hidden: dockHidden, active: dockActive } =
    useLibtvFloatingDock(dockNodeId);

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
    const patch = sbv1PatchToThreeViewNodeData({
      engine: {
        providerId: pick.providerId,
        modelKey: pick.modelKey,
        params: pick.params,
      },
      aspectRatio: "16:9",
      resolution: "2K",
      outputCount: 1,
    });
    updateNodeData(storeNode.id, patch);
    if (controllerId) {
      updateNodeData(controllerId, { batchImage: pick });
    }
  }, [
    storeNode,
    hasImageModel,
    providers,
    updateNodeData,
    controllerId,
  ]);

  const upstreamLinks = useMemo(() => {
    if (!storeNode) return [];
    return resolvePro2DockUpstreamLinks(
      storeNode.id,
      "story-pro2-three-view",
      nodes,
      edges,
    );
  }, [storeNode, nodes, edges]);

  const displayLinks = useMemo(
    () =>
      enrichPro2DockUpstreamLinks(
        upstreamLinks,
        d.dockStyleRef,
        storeNode?.id,
      ),
    [upstreamLinks, d.dockStyleRef, storeNode?.id],
  );
  const showStyleButton = !pro2DockStyleShownAsChip(
    upstreamLinks,
    d.dockStyleRef,
  );

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

  const onRegenerate = useCallback(async () => {
    if (!storeNode || isRunning) return;

    if (controllerId && d.pro2RowKey) {
      const ctrl = nodes.find((n) => n.id === controllerId);
      if (ctrl) {
        batchRunStoryRowsSequential(controllerId, [d.pro2RowKey], "threeView", {
          forceFresh: true,
        });
        return;
      }
    }

    let runEngine = settingsData.engine;
    if (!runEngine?.providerId?.trim() || !runEngine.modelKey?.trim()) {
      const seed = pickDefaultPro2ThreeViewImageEngine(providers);
      if (seed) {
        runEngine = {
          providerId: seed.providerId,
          modelKey: seed.modelKey,
          params: seed.params,
        };
        updateNodeData(
          storeNode.id,
          sbv1PatchToThreeViewNodeData({ engine: runEngine }),
        );
      }
    }
    if (!runEngine?.providerId?.trim() || !runEngine.modelKey?.trim()) {
      await alert({
        title: "请选择模型",
        message:
          "请先在「图片生成设置」中选择 IMAGE 模型，并确认 Gateway 已绑定凭证。",
        variant: "warning",
      });
      return;
    }

    const prompt = dockInput.trim();
    const linkedStyle = resolvePro2DockStyleFromUpstream(upstreamLinks);
    const hasRefs =
      upstreamLinks.some((l) => l.previewUrl) ||
      Boolean(settingsData.dockStyleRef?.imageUrl) ||
      Boolean(linkedStyle);
    if (!prompt && !hasRefs) {
      await alert({
        title: "请输入提示词",
        message: "请填写角色外观描述，或连接风格/参考图后再生成。",
        variant: "warning",
      });
      return;
    }
    if (!base?.trim()) {
      await alert({
        title: "画布未就绪",
        message: "请刷新页面后重试。",
        variant: "error",
      });
      return;
    }

    optimisticLibtvMediaRunStart(storeNode.id, updateNodeData, setNodeRuntime);
    const queued = busEnqueueStoryRun({
      nodeId: storeNode.id,
      forceFresh: true,
    });
    if (!queued) {
      revertOptimisticLibtvMediaRunStart(
        storeNode.id,
        updateNodeData,
        setNodeRuntime,
      );
      await alert({
        title: "无法开始生成",
        message: "该节点已有进行中的生成任务，请稍候完成后再试。",
        variant: "warning",
      });
    }
  }, [
    storeNode,
    isRunning,
    controllerId,
    d.pro2RowKey,
    nodes,
    updateNodeData,
    setNodeRuntime,
    settingsData,
    providers,
    dockInput,
    upstreamLinks,
    alert,
    base,
  ]);

  const onOpenStyleLibrary = useCallback(() => {
    if (!storeNode) return;
    setPro2StyleLibImageNodeId(storeNode.id);
    window.dispatchEvent(new CustomEvent("canvas:open-pro2-style-library"));
  }, [storeNode, setPro2StyleLibImageNodeId]);

  if (!storeNode || !dockActive || !placement) return null;
  if (
    pro2ThreeViewNodeUsesEmbeddedDock(d, {
      selected: true,
      soleSelected: true,
    })
  ) {
    return null;
  }

  const styleRef = d.dockStyleRef;
  const canRegenerate = Boolean(dockInput.trim() && hasImageModel);

  return (
    <>
      <Pro2InputDockShell
        flowAnchor={placement}
        dockClassName="pro2-three-view-dock"
        hidden={dockHidden}
        header={
          <Pro2DockHeader
            refRow={
              displayLinks.length > 0 ? (
                <Pro2DockUpstreamChips
                  links={displayLinks}
                  anchorNodeId={storeNode.id}
                  activeIds={activeRefIds}
                />
              ) : null
            }
            actionRow={
              <>
                {showStyleButton ? (
                  <Pro2DockStyleButton
                    active={Boolean(styleRef)}
                    label={styleRef?.name}
                    disabled={isRunning}
                    onClick={onOpenStyleLibrary}
                  />
                ) : null}
                <button
                  type="button"
                  disabled
                  title="标记（即将推出）"
                  className="nodrag flex size-10 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-white/12 bg-white/[0.04] text-[9px] text-white/35"
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
              className="nodrag flex h-8 min-w-0 flex-1 items-center gap-1 rounded-md px-2 text-left text-[13px] text-white/65 hover:bg-white/[0.06] hover:text-white/90"
              onClick={() => setSettingsOpen(true)}
            >
              <span className="truncate">{settingsLabel}</span>
              <ChevronDown className="size-3.5 shrink-0 opacity-45" />
            </button>
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
        }
      >
        <MentionsEditable
          className={cn(
            PRO2_DOCK_TEXTAREA_CLASS,
            RF_FORM_CONTROL,
            RF_NO_WHEEL,
            PRO2_DOCK_TEXTAREA_INSET_CLASS,
          )}
          placeholder="编辑角色外观提示词；输入 @ 引用风格或参考图…"
          value={dockInput}
          mentionables={mentionables}
          disabled={isRunning}
          rows={4}
          onChange={onPromptChange}
          mentionInlineThumb
          mentionEdition="pro2"
        />
      </Pro2InputDockShell>

      <Sbv1ImageGenerateSettingsModal
        open={settingsOpen}
        data={settingsData}
        onClose={() => setSettingsOpen(false)}
        onConfirm={onConfirmSettings}
      />
    </>
  );
}
