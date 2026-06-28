"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUp,
  ChevronDown,
  Loader2,
  SlidersHorizontal,
  Zap,
} from "lucide-react";
import { useNodes } from "@xyflow/react";
import { MentionsEditable } from "@/components/canvas/mentions/MentionsEditable";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { busEnqueueStoryRun } from "@/lib/canvas/canvas-run-bus";
import { batchRunStoryRowsSequential } from "@/lib/canvas/batch-run-nodes";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  useLibtvFloatingDock,
  useLibtvSoleSelectedNodeId,
} from "@/lib/canvas/use-libtv-floating-dock";
import { PRO2_DOCK_TEXTAREA_CLASS, PRO2_DOCK_TEXTAREA_INSET_CLASS } from "@/lib/canvas/story-pro2-node-chrome";
import { buildPro2DockMentionables } from "@/lib/canvas/pro2-dock-mentionables";
import {
  resolvePro2DockUpstreamLinks,
  resolvePro2DockStyleFromUpstream,
} from "@/lib/canvas/pro2-dock-upstream-links";
import { pro2DockRefImageCatalog } from "@/lib/canvas/pro2-dock-ref-catalog";
import { dockActiveRefIdsFromPrompt } from "@/lib/canvas/dock-mention-ref-urls";
import { usePruneStaleDockMentions } from "@/lib/canvas/use-prune-stale-dock-mentions";
import { pickDefaultSbv1ImageEngine } from "@/lib/canvas/sbv1-image-models";
import type { Sbv1ImageNodeData } from "@/lib/canvas/sbv1-workspace-types";
import {
  isLibtvFreestandingImageNode,
  isLibtvPipelineImageCell,
  optimisticLibtvMediaRunStart,
  revertOptimisticLibtvMediaRunStart,
} from "@/lib/canvas/libtv-image-node-run";
import { resolveLibtvFloatingDockSelection } from "@/lib/canvas/libtv-floating-dock-selection";
import { isLibtvPro2ImageDockNodeType } from "@/lib/canvas/libtv-pro2-image-dock-types";
import type { StoryProFrameRow } from "@/lib/canvas/story-pro-workspace-types";
import type { StoryPro2ImageNodeData } from "@/lib/canvas/story-pro2-workspace-types";
import { isLibtvMediaGenerating } from "@/components/canvas/libtv-media-generating-state";
import { RF_FORM_CONTROL, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import { useModelCreditsPreview } from "@/lib/canvas/use-model-credits-preview";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { cn } from "@/lib/utils";
import { pro2ImageNodeUsesEmbeddedDock } from "./pro2/pro2-image-node-embedded-dock";
import { Pro2DockPasteZone } from "./pro2/pro2-dock-paste-zone";
import { Pro2DockRefImages } from "./pro2/pro2-dock-ref-images";
import { Pro2DockStyleButton } from "./pro2/pro2-dock-style-button";
import { Pro2DockUpstreamChips } from "./pro2/pro2-dock-upstream-chips";
import {
  Pro2DockHeader,
  Pro2DockToolbar,
  Pro2InputDockShell,
} from "./pro2/pro2-input-dock-shell";
import { sbv1ImageNodeUsesEmbeddedDock } from "./sbv1/sbv1-image-node-embedded-dock";
import {
  Sbv1ImageGenerateSettingsModal,
  sbv1ImageSettingsTriggerLabel,
} from "./sbv1/sbv1-image-generate-settings-modal";

type DockImageNodeType =
  | "sbv1-image"
  | "story-pro2-image"
  | "story-pro2-prop"
  | "story-pro2-mood"
  | "story-pro2-audio";

function placeholderDockLabel(type: string | undefined): string | undefined {
  if (type === "story-pro2-prop") return "描述道具外观与材质；输入 @ 引用风格或场景…";
  if (type === "story-pro2-mood") return "描述氛围、光线与情绪；输入 @ 引用风格…";
  if (type === "story-pro2-audio") return "描述环境音效或 BGM 意向…";
  return undefined;
}

function framePromptPlaceholder(role?: string): string {
  if (role === "frame") {
    return "编辑本镜画面描述；输入 @ 引用角色三视图或风格参考…";
  }
  if (role === "scene") {
    return "编辑场景生图关键词；输入 @ 引用风格或上游图片…";
  }
  return "可直接文字生图，或上传图片输入文字指令对图片进行编辑，如：将背景改为雪夜";
}

/** LibTV 统一图片节点 · 底部浮动输入坞（分镜 1.0 · 影视专业 2.0） */
export function LibtvImageInputDock() {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const { providers } = useUserProviders();
  const rfNodes = useNodes();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeRuntime = useCanvasStore((s) => s.setNodeRuntime);
  const setPro2StyleLibImageNodeId = useCanvasStore(
    (s) => s.setPro2StyleLibImageNodeId,
  );

  const [settingsOpen, setSettingsOpen] = useState(false);

  const sbv1DockNodeId = useLibtvSoleSelectedNodeId("sbv1-image");
  const pro2DockNodeId = useMemo(() => {
    const sel = resolveLibtvFloatingDockSelection(rfNodes);
    if (!sel || !isLibtvPro2ImageDockNodeType(sel.nodeType)) return null;
    const rf = rfNodes.find((n) => n.id === sel.nodeId);
    if (
      sel.nodeType === "story-pro2-image" &&
      (rf?.data as { pro2MediaRole?: string })?.pro2MediaRole ===
        "character-three-view"
    ) {
      return null;
    }
    return sel.nodeId;
  }, [rfNodes]);

  const dockNodeId = sbv1DockNodeId ?? pro2DockNodeId;

  const storeNode = useMemo(() => {
    if (!dockNodeId) return null;
    return nodes.find((n) => n.id === dockNodeId) ?? null;
  }, [dockNodeId, nodes]);
  const { placement, hidden: dockHidden, active: dockActive } =
    useLibtvFloatingDock(dockNodeId);

  const nodeType = (storeNode?.type ?? "sbv1-image") as DockImageNodeType;
  const isPro2 = isLibtvPro2ImageDockNodeType(nodeType);
  const pro2Data = (storeNode?.data ?? {}) as StoryPro2ImageNodeData;
  const isPipelineCell = isLibtvPipelineImageCell(storeNode ?? undefined);
  const showModelPicker = !isPipelineCell;

  const settingsData = (storeNode?.data ?? {}) as Sbv1ImageNodeData;
  const dockInput = settingsData.dockInput ?? "";
  const previewUrl = settingsData.ossUrl ?? settingsData.blobUrl ?? "";
  const hasImage = Boolean(previewUrl);
  const isRunning = isLibtvMediaGenerating(
    (storeNode?.data ?? {}) as { uploading?: boolean; runtime?: { status?: string } },
  );

  const engine = settingsData.engine;
  const modelKey = engine?.modelKey?.trim() ?? "";
  const outputCount = settingsData.outputCount ?? 1;
  const settingsLabel = sbv1ImageSettingsTriggerLabel(settingsData, providers);
  const estCredits = useModelCreditsPreview(
    modelKey,
    0,
    undefined,
    outputCount,
    settingsData.resolution ?? "2K",
  );

  useEffect(() => {
    if (!storeNode || !showModelPicker || engine?.providerId?.trim()) return;
    const seed = pickDefaultSbv1ImageEngine(providers);
    if (!seed) return;
    updateNodeData(storeNode.id, { engine: seed });
  }, [storeNode, showModelPicker, engine?.providerId, providers, updateNodeData]);

  const upstreamLinks = useMemo(() => {
    if (!storeNode) return [];
    return resolvePro2DockUpstreamLinks(
      storeNode.id,
      nodeType,
      nodes,
      edges,
    );
  }, [storeNode, nodeType, nodes, edges]);

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
      if (!storeNode || pro2Data.pro2MediaRole !== "frame") return;
      const controllerId = pro2Data.pro2ControllerNodeId;
      const rowKey = pro2Data.pro2RowKey;
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
    [
      storeNode,
      pro2Data.pro2MediaRole,
      pro2Data.pro2ControllerNodeId,
      pro2Data.pro2RowKey,
      nodes,
      updateNodeData,
      upstreamLinks,
    ],
  );

  const onPromptChange = useCallback(
    (value: string, _refs?: string[], meta?: { commit?: boolean }) => {
      if (!storeNode) return;
      updateNodeData(
        storeNode.id,
        { dockInput: value },
        { commit: meta?.commit ?? true },
      );
      if (meta?.commit !== false) {
        syncFrameRowPrompt(value);
      }
    },
    [storeNode, updateNodeData, syncFrameRowPrompt],
  );

  const onOpenStyleLibrary = useCallback(() => {
    if (!storeNode) return;
    setPro2StyleLibImageNodeId(storeNode.id);
    window.dispatchEvent(new CustomEvent("canvas:open-pro2-style-library"));
  }, [storeNode, setPro2StyleLibImageNodeId]);

  const onRunPipeline = useCallback(() => {
    if (!storeNode || !isPipelineCell) return;
    const controllerId = pro2Data.pro2ControllerNodeId;
    const rowKey = pro2Data.pro2RowKey;
    if (!controllerId || !rowKey || pro2Data.pro2MediaRole !== "frame") return;
    batchRunStoryRowsSequential(controllerId, [rowKey], "frameImage", {
      forceFresh: true,
    });
  }, [storeNode, isPipelineCell, pro2Data]);

  const onRunFreestanding = useCallback(async () => {
    if (!storeNode || !isLibtvFreestandingImageNode(storeNode)) return;
    if (isRunning) return;
    optimisticLibtvMediaRunStart(storeNode.id, updateNodeData, setNodeRuntime);
    const revertPending = () =>
      revertOptimisticLibtvMediaRunStart(storeNode.id, updateNodeData, setNodeRuntime);

    let runEngine = engine;
    if (!runEngine?.providerId?.trim()) {
      const seed = pickDefaultSbv1ImageEngine(providers);
      if (seed) {
        runEngine = seed;
        updateNodeData(storeNode.id, { engine: seed });
      }
    }
    if (!runEngine?.providerId?.trim() || !runEngine.modelKey?.trim()) {
      revertPending();
      await alert({
        title: "请选择模型",
        message:
          "请先在「图片生成设置」中选择 KIE 生图模型（nano-banana-pro），并确认 Gateway 已绑定 KIE 凭证。",
        variant: "warning",
      });
      return;
    }
    const prompt = dockInput.trim();
    const linkedStyle = resolvePro2DockStyleFromUpstream(upstreamLinks);
    const hasRefs =
      hasImage ||
      upstreamLinks.some((l) => l.previewUrl) ||
      Boolean(settingsData.dockStyleRef?.imageUrl) ||
      Boolean(linkedStyle);
    if (!prompt && !hasRefs) {
      revertPending();
      await alert({
        title: "请输入提示词",
        message: "可直接文字生图，或上传/连接图片后输入编辑指令。",
        variant: "warning",
      });
      return;
    }
    if (!base) {
      revertPending();
      await alert({
        title: "画布未就绪",
        message: "请刷新页面后重试。",
        variant: "error",
      });
      return;
    }
    busEnqueueStoryRun({ nodeId: storeNode.id, forceFresh: true });
  }, [
    storeNode,
    engine,
    providers,
    updateNodeData,
    setNodeRuntime,
    dockInput,
    hasImage,
    upstreamLinks,
    settingsData.dockStyleRef,
    base,
    alert,
    isRunning,
  ]);

  const onRun = isPipelineCell ? onRunPipeline : () => void onRunFreestanding();

  if (!storeNode || !dockActive || !placement) return null;

  const usesEmbedded =
    nodeType === "sbv1-image"
      ? sbv1ImageNodeUsesEmbeddedDock(settingsData, {
          selected: true,
          soleSelected: true,
        })
      : pro2ImageNodeUsesEmbeddedDock(pro2Data, {
          selected: true,
          soleSelected: true,
        });
  if (usesEmbedded) return null;

  const styleRef = settingsData.dockStyleRef ?? pro2Data.dockStyleRef;
  const linkedStyle = resolvePro2DockStyleFromUpstream(upstreamLinks);
  const styleActive = Boolean(styleRef || linkedStyle);
  const styleLabel = styleRef?.name ?? linkedStyle?.name;

  const canSendPipeline =
    isPipelineCell &&
    Boolean(pro2Data.pro2ControllerNodeId && pro2Data.pro2RowKey) &&
    !isRunning &&
    (Boolean(dockInput.trim()) || hasImage);

  const canSendFreestanding =
    showModelPicker &&
    Boolean(engine?.providerId && engine?.modelKey) &&
    !isRunning &&
    (Boolean(dockInput.trim()) ||
      hasImage ||
      upstreamLinks.some((l) => l.previewUrl) ||
      Boolean(styleRef?.imageUrl) ||
      Boolean(linkedStyle));

  const canSend = isPipelineCell ? canSendPipeline : canSendFreestanding;

  const placeholder = hasImage
    ? "输入文字指令对图片进行编辑，如：将背景改为雪夜"
    : placeholderDockLabel(nodeType) ??
      framePromptPlaceholder(pro2Data.pro2MediaRole);

  const mentionEdition = nodeType === "sbv1-image" ? "sbv1" : "pro2";

  return (
    <>
      <Pro2InputDockShell
        flowAnchor={placement}
        dockClassName={isPro2 ? "pro2-image-dock" : "sbv1-image-dock"}
        hidden={dockHidden}
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
                <Pro2DockRefImages
                  refs={[]}
                  onChange={() => {}}
                  disabled={isRunning}
                  pasteActive={false}
                  spawnAnchor={{
                    nodeId: storeNode.id,
                    nodeType,
                  }}
                  maxCount={12}
                />
              </>
            }
          />
        }
        footer={
          <Pro2DockToolbar className="gap-2">
            {!isPipelineCell ? (
              <>
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
              </>
            ) : (
              <div className="min-w-0 flex-1" />
            )}
            <div className="flex shrink-0 items-center gap-1.5">
              {!isPipelineCell && estCredits?.credits != null ? (
                <span
                  className="flex shrink-0 items-center gap-1 text-[13px] tabular-nums text-amber-200/90"
                  title={`${estCredits.canonicalModelKey} · 挂牌 ${estCredits.creditsPerUnit} 积分/${estCredits.unit === "PER_IMAGE" ? "张" : "次"}`}
                >
                  <Zap className="size-3.5 fill-amber-300/90 text-amber-300/90" />
                  {estCredits.credits}
                </span>
              ) : null}
              <button
                type="button"
                disabled={!canSend}
                title={
                  isRunning
                    ? "生成中"
                    : isPipelineCell
                      ? "重新生成"
                      : "生成图片"
                }
                className="nodrag flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={onRun}
              >
                {isRunning ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowUp className="size-4" />
                )}
              </button>
            </div>
          </Pro2DockToolbar>
        }
      >
        <Pro2DockPasteZone
          anchorNodeId={storeNode.id}
          anchorNodeType={nodeType}
          disabled={isRunning}
          maxImages={12}
        >
          <MentionsEditable
            className={cn(
              PRO2_DOCK_TEXTAREA_CLASS,
              RF_FORM_CONTROL,
              RF_NO_WHEEL,
              PRO2_DOCK_TEXTAREA_INSET_CLASS,
            )}
            placeholder={placeholder}
            value={dockInput}
            mentionables={mentionables}
            disabled={isRunning}
            rows={3}
            mentionInlineThumb
            mentionInlineThumbHoverOnText
            mentionEdition={mentionEdition}
            onChange={onPromptChange}
          />
        </Pro2DockPasteZone>
      </Pro2InputDockShell>

      {!isPipelineCell ? (
        <Sbv1ImageGenerateSettingsModal
          open={settingsOpen}
          data={settingsData}
          onClose={() => setSettingsOpen(false)}
          onConfirm={(patch) => {
            if (!storeNode) return;
            updateNodeData(storeNode.id, patch);
          }}
        />
      ) : null}
    </>
  );
}

/** @deprecated 使用 LibtvImageInputDock */
export const Sbv1ImageInputDock = LibtvImageInputDock;

/** @deprecated 使用 LibtvImageInputDock */
export const Pro2ImageInputDock = LibtvImageInputDock;
