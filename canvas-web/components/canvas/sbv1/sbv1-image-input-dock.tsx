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
import { MentionsTextarea } from "@/components/canvas/mentions/MentionsTextarea";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { busEnqueueStoryRun } from "@/lib/canvas/canvas-run-bus";
import { useCanvasStore } from "@/lib/canvas/store";
import { libtvFloatingDockHidden } from "@/lib/canvas/use-viewport-transform-active";
import { PRO2_DOCK_TEXTAREA_CLASS } from "@/lib/canvas/story-pro2-node-chrome";
import { buildPro2DockMentionables } from "@/lib/canvas/pro2-dock-mentionables";
import {
  resolvePro2DockUpstreamLinks,
  resolvePro2DockStyleFromUpstream,
} from "@/lib/canvas/pro2-dock-upstream-links";
import { dockActiveRefIdsFromPrompt } from "@/lib/canvas/dock-mention-ref-urls";
import { usePruneStaleDockMentions } from "@/lib/canvas/use-prune-stale-dock-mentions";
import { pickDefaultSbv1ImageEngine } from "@/lib/canvas/sbv1-image-models";
import type { Sbv1ImageNodeData } from "@/lib/canvas/sbv1-workspace-types";
import { isLibtvMediaGenerating } from "@/components/canvas/libtv-media-generating-state";
import { RF_FORM_CONTROL, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import { useModelCreditsPreview } from "@/lib/canvas/use-model-credits-preview";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
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
import {
  Sbv1ImageGenerateSettingsModal,
  sbv1ImageSettingsTriggerLabel,
} from "./sbv1-image-generate-settings-modal";

/** 分镜视频 1.0 · 图片节点底部浮动输入坞 */
export function Sbv1ImageInputDock() {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const { providers } = useUserProviders();
  const rfNodes = useNodes();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const dockHidden = useCanvasStore((s) =>
    libtvFloatingDockHidden(s.canvasGeometryDragging, s.canvasViewportMoving),
  );
  const setPro2StyleLibImageNodeId = useCanvasStore(
    (s) => s.setPro2StyleLibImageNodeId,
  );

  const [settingsOpen, setSettingsOpen] = useState(false);

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
  const previewUrl = d.ossUrl ?? d.blobUrl ?? "";
  const hasImage = Boolean(previewUrl);
  const isRunning = isLibtvMediaGenerating(d);

  const engine = d.engine;
  const modelKey = engine?.modelKey?.trim() ?? "";
  const outputCount = d.outputCount ?? 1;
  const settingsLabel = sbv1ImageSettingsTriggerLabel(d, providers);
  const estCredits = useModelCreditsPreview(
    modelKey,
    0,
    undefined,
    outputCount,
    d.resolution ?? "2K",
  );

  useEffect(() => {
    if (!storeNode || engine?.providerId?.trim()) return;
    const seed = pickDefaultSbv1ImageEngine(providers);
    if (!seed) return;
    updateNodeData(storeNode.id, { engine: seed });
  }, [storeNode, engine?.providerId, providers, updateNodeData]);

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

  const onRun = useCallback(async () => {
    if (!storeNode) return;
    let runEngine = engine;
    if (!runEngine?.providerId?.trim()) {
      const seed = pickDefaultSbv1ImageEngine(providers);
      if (seed) {
        runEngine = seed;
        updateNodeData(storeNode.id, { engine: seed });
      }
    }
    if (!runEngine?.providerId?.trim() || !runEngine.modelKey?.trim()) {
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
      Boolean(d.dockStyleRef?.imageUrl) ||
      Boolean(linkedStyle);
    if (!prompt && !hasRefs) {
      await alert({
        title: "请输入提示词",
        message: "可直接文字生图，或上传/连接图片后输入编辑指令。",
        variant: "warning",
      });
      return;
    }
    if (!base) {
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
    dockInput,
    hasImage,
    upstreamLinks,
    d.dockStyleRef,
    base,
    alert,
  ]);

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
  const linkedStyle = resolvePro2DockStyleFromUpstream(upstreamLinks);
  const styleActive = Boolean(styleRef || linkedStyle);
  const styleLabel = styleRef?.name ?? linkedStyle?.name;
  const canSend =
    Boolean(engine?.providerId && engine?.modelKey) &&
    !isRunning &&
    (Boolean(dockInput.trim()) ||
      hasImage ||
      upstreamLinks.some((l) => l.previewUrl) ||
      Boolean(styleRef?.imageUrl) ||
      Boolean(linkedStyle));

  const placeholder = hasImage
    ? "输入文字指令对图片进行编辑，如：将背景改为雪夜"
    : "可直接文字生图，或上传图片输入文字指令对图片进行编辑，如：将背景改为雪夜";

  return (
    <>
      <Pro2InputDockShell
        flowAnchor={placement}
        dockClassName="sbv1-image-dock"
        hidden={dockHidden}
        header={
          <Pro2DockContextBar>
            <Pro2DockStyleButton
              active={styleActive}
              label={styleLabel}
              disabled={isRunning}
              onClick={onOpenStyleLibrary}
            />
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
          <>
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

            <div className="flex shrink-0 items-center gap-1.5">
              {estCredits?.credits != null ? (
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
                title={isRunning ? "生成中" : "生成图片"}
                className="nodrag flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => void onRun()}
              >
                {isRunning ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowUp className="size-4" />
                )}
              </button>
            </div>
          </Pro2DockToolbar>
          </>
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
            placeholder={placeholder}
            value={dockInput}
            mentionables={mentionables}
            disabled={isRunning}
            rows={3}
            mentionInlineThumb
            mentionEdition="sbv1"
            onChange={onPromptChange}
          />
        </Pro2DockPasteZone>
      </Pro2InputDockShell>

      <Sbv1ImageGenerateSettingsModal
        open={settingsOpen}
        data={d}
        onClose={() => setSettingsOpen(false)}
        onConfirm={(patch) => {
          if (!storeNode) return;
          updateNodeData(storeNode.id, patch);
        }}
      />
    </>
  );
}
