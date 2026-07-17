"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  ImageIcon,
  Loader2,
  Zap,
} from "lucide-react";
import {
  type MentionableItem,
  type MentionsTextareaCommitHandle,
} from "@/components/canvas/mentions/MentionsTextarea";
import { MentionsEditable } from "@/components/canvas/mentions/MentionsEditable";
import { DockUpstreamRefPreviewCard } from "@/components/canvas/pro2/dock-upstream-ref-preview-card";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  Pro2DockHeader,
  Pro2DockToolbar,
  Pro2InputDockShell,
} from "@/components/canvas/pro2/pro2-input-dock-shell";
import { Pro2DockUpstreamChips } from "@/components/canvas/pro2/pro2-dock-upstream-chips";
import { RF_FORM_CONTROL, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import { spawnSbv1PastedImages } from "@/lib/canvas/spawn-sbv1-paste-images";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  SBV1_CHAT_INPUT_TEXTAREA_CLASS,
  SBV1_VIDEO_DOCK_TEXTAREA_INSET_CLASS,
} from "@/lib/canvas/sbv1-node-chrome";
import {
  getSbv1VolcengineModelById,
  migrateSbv1ModelVariantId,
  resolveSbv1VariantIdFromEngine,
} from "@/lib/canvas/sbv1-video-models";
import { useModelCreditsPreview } from "@/lib/canvas/use-model-credits-preview";
import type { Sbv1UpstreamRefLink } from "@/lib/canvas/sbv1-upstream-ref-links";
import type { Sbv1UpstreamTextLink } from "@/lib/canvas/sbv1-upstream-text-links";
import { sbv1TextLinksToDockUpstream } from "@/lib/canvas/sbv1-upstream-text-links";
import type { Pro2DockUpstreamLink } from "@/lib/canvas/pro2-dock-upstream-links";
import type { Sbv1VideoEngineNodeData } from "@/lib/canvas/sbv1-workspace-types";
import { dockActiveRefIdsFromPrompt } from "@/lib/canvas/dock-mention-ref-urls";
import type { LibtvDockFlowPlacement } from "@/lib/canvas/libtv-dock-flow-placement";
import { VIDEO_DOCK_HEADER_CHIP_FONT_AT_100, VIDEO_DOCK_TOOLBAR_FONT_SCREEN_AT_100 } from "@/lib/canvas/libtv-dock-scale";
import { useLibtvDockRefThumbMetrics } from "@/lib/canvas/use-libtv-dock-ref-thumb-metrics";
import {
  portraitImportUiState,
  type CanvasPortraitNodeFields,
} from "@/lib/canvas/portrait-node-data";
import { resolvePro2VideoBoardCellDefaultPrompt } from "@/lib/canvas/pro2-video-board-dock-links";
import { usePruneStaleDockMentions } from "@/lib/canvas/use-prune-stale-dock-mentions";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { cn } from "@/lib/utils";
import {
  dockInputModeToPatch,
  getSbv1VideoDockModeChips,
  resolveSbv1DockInputMode,
  sbv1DockRefCornerLabelForModel,
} from "@/lib/canvas/sbv1-video-model-reference";
import { Sbv1VideoDockModeBar } from "./sbv1-video-dock-mode-bar";
import {
  Sbv1VideoDockModelPicker,
  Sbv1VideoDockParamsPicker,
} from "./sbv1-video-dock-pickers";
import { Sbv1HdVideoDockToolbar } from "./sbv1-hd-video-dock-pickers";
import { isSbv1HdVideoNode } from "@/lib/canvas/sbv1-hd-video-params";

export const Sbv1VideoEngineChatInput = memo(function Sbv1VideoEngineChatInput({
  nodeId,
  data,
  upstreamLinks,
  upstreamTextLinks,
  extraDockUpstreamLinks,
  mentionables,
  isGenerating,
  onPatch,
  onRun,
  placement,
  hidden,
  sendTitle,
  hasExistingVideo = false,
}: {
  nodeId: string;
  data: Sbv1VideoEngineNodeData;
  upstreamLinks: Sbv1UpstreamRefLink[];
  upstreamTextLinks: Sbv1UpstreamTextLink[];
  extraDockUpstreamLinks?: Pro2DockUpstreamLink[];
  mentionables: MentionableItem[];
  isGenerating: boolean;
  onPatch: (patch: Partial<Sbv1VideoEngineNodeData>) => void;
  onRun: () => void;
  placement: LibtvDockFlowPlacement;
  hidden?: boolean;
  sendTitle?: string;
  /** 节点或任务历史已有成片 · 允许无 prompt/参考图时再次生成 */
  hasExistingVideo?: boolean;
}) {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const { providers } = useUserProviders();
  const {
    thumbStyle: refThumbStyle,
    thumbWidthPx,
    badgeFontPx,
    badgeMinPx,
    headerMinHeightPx,
    chipMinHeightPx,
    logoIconPx,
  } = useLibtvDockRefThumbMetrics();
  const chipFontPx = VIDEO_DOCK_HEADER_CHIP_FONT_AT_100;
  const dockTextFontPx = VIDEO_DOCK_TOOLBAR_FONT_SCREEN_AT_100;
  const creditsFontPx = VIDEO_DOCK_TOOLBAR_FONT_SCREEN_AT_100;
  const sendBtnPx = 44;
  const sendIconPx = 18;
  const addNode = useCanvasStore((s) => s.addNode);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const canvasNodes = useCanvasStore((s) => s.nodes);
  const canvasEdges = useCanvasStore((s) => s.edges);

  const isHdVideo = isSbv1HdVideoNode(data);
  const hasMotionVideo = useMemo(() => {
    if (!isHdVideo) return false;
    for (const e of canvasEdges) {
      if (e.target !== nodeId || e.targetHandle !== "in_motion_video") continue;
      const src = canvasNodes.find((n) => n.id === e.source);
      if (!src || src.type !== "sbv1-video-engine") continue;
      const url = String(
        (src.data as { runtime?: { ossUrl?: string; ephemeralUrl?: string } })
          .runtime?.ossUrl ??
          (src.data as { runtime?: { ephemeralUrl?: string } }).runtime
            ?.ephemeralUrl ??
          "",
      ).trim();
      if (/^https?:\/\//.test(url)) return true;
    }
    return false;
  }, [isHdVideo, nodeId, canvasEdges, canvasNodes]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptCommitRef = useRef<MentionsTextareaCommitHandle | null>(null);
  const storedPrompt = useCanvasStore(
    useCallback(
      (s) =>
        String(
          (s.nodes.find((n) => n.id === nodeId)?.data as Sbv1VideoEngineNodeData | undefined)
            ?.prompt ??
            (s.nodes.find((n) => n.id === nodeId)?.data as Sbv1VideoEngineNodeData | undefined)
              ?.dockInput ??
            "",
        ),
      [nodeId],
    ),
  );
  const [livePrompt, setLivePrompt] = useState(storedPrompt);
  const [isDragging, setIsDragging] = useState(false);
  const [dockMenu, setDockMenu] = useState<"model" | "params" | null>(null);

  useEffect(() => {
    setLivePrompt(storedPrompt);
  }, [storedPrompt, nodeId]);

  useEffect(() => {
    const d = data as Sbv1VideoEngineNodeData & {
      pro2MediaRole?: string;
      pro2ControllerNodeId?: string;
    };
    if (d.pro2MediaRole !== "video" || !d.pro2ControllerNodeId?.trim()) return;
    if (String(d.prompt ?? "").trim() || String(d.dockInput ?? "").trim()) return;
    const { nodes, edges } = useCanvasStore.getState();
    const prompt = resolvePro2VideoBoardCellDefaultPrompt(nodeId, nodes, edges);
    if (!prompt) return;
    updateNodeData(nodeId, { prompt, dockInput: prompt }, { commit: true });
  }, [nodeId, data, updateNodeData]);

  const smartMulti = data.referenceMode === "smart_multi";
  const referenceMode = data.referenceMode ?? "omni";
  /** Dock 预估与财务后台一致：视频按 15s 封顶；智能多帧未设时长时也按 15s 展示 */
  const billableDurationSec = (() => {
    const cap = 15;
    if (smartMulti && (data.durationSec ?? 0) <= 0) return cap;
    const s = Math.max(1, Math.round(data.durationSec || cap));
    return Math.min(s, cap);
  })();
  const variantId = migrateSbv1ModelVariantId(
    data.volcengineVariantId ??
      data.jimengModelId ??
      resolveSbv1VariantIdFromEngine(data.engine, providers),
  );
  const selectedModel = getSbv1VolcengineModelById(variantId, providers);
  const modelKey = selectedModel.engine.modelKey;
  const multiShots = data.engine?.params?.multi_shots === true;
  const dockChips = useMemo(
    () =>
      isHdVideo
        ? []
        : getSbv1VideoDockModeChips(modelKey, {
            multiShots,
            providerId: data.engine?.providerId,
          }),
    [isHdVideo, modelKey, multiShots, data.engine?.providerId],
  );
  const activeDockMode = resolveSbv1DockInputMode(
    referenceMode,
    data.dockInputMode,
    dockChips,
  );
  const showFirstLastSlots = activeDockMode === "first_last";
  const allRefsHighlighted =
    activeDockMode === "omni" || activeDockMode === "multi_ref";
  const textDockLinks = useMemo(() => {
    const base = sbv1TextLinksToDockUpstream(upstreamTextLinks);
    const extra =
      extraDockUpstreamLinks?.filter((l) => l.kind === "text") ?? [];
    const seen = new Set<string>();
    return [...extra, ...base].filter((l) => {
      if (seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    });
  }, [upstreamTextLinks, extraDockUpstreamLinks]);

  useEffect(() => {
    if (
      data.dockInputMode &&
      !dockChips.some((c) => c.id === data.dockInputMode)
    ) {
      onPatch(dockInputModeToPatch(activeDockMode));
    }
  }, [data.dockInputMode, dockChips, activeDockMode, onPatch]);
  const estCredits = useModelCreditsPreview(modelKey, billableDurationSec, variantId);

  const hasRefs = upstreamLinks.some((l) => l.previewUrl);
  const hasPrompt = Boolean(livePrompt.trim());
  const activeRefIds = useMemo(
    () => dockActiveRefIdsFromPrompt(livePrompt),
    [livePrompt],
  );

  usePruneStaleDockMentions({
    nodeId,
    prompt: storedPrompt,
    mentionables,
    field: "prompt",
    updateNodeData,
  });

  const canSend = isHdVideo
    ? hasMotionVideo &&
      !isGenerating &&
      Boolean(data.engine?.providerId && data.engine?.modelKey)
    : (hasPrompt || hasRefs || hasExistingVideo) &&
      !isGenerating &&
      Boolean(data.engine?.providerId && data.engine?.modelKey);

  const runWithCommittedPrompt = useCallback(() => {
    promptCommitRef.current?.flushDraft();
    void onRun();
  }, [onRun]);

  const uploadFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length || !base) {
        if (!base) {
          await alert({
            title: "画布未就绪",
            message: "请刷新页面后重试。",
            variant: "warning",
          });
        }
        return;
      }
      const { nodes, edges } = useCanvasStore.getState();
      await spawnSbv1PastedImages({
        anchorNodeId: nodeId,
        files: Array.from(fileList),
        base,
        nodes,
        edges,
        addNode,
        setEdges,
        updateNodeData,
      });
    },
    [base, nodeId, addNode, setEdges, updateNodeData, alert],
  );

  const onDisconnect = useCallback(
    (link: Sbv1UpstreamRefLink) => {
      setEdges((es) => es.filter((e) => e.id !== link.edgeId));
    },
    [setEdges],
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items).filter(
        (item) => item.kind === "file",
      );
      if (!items.length) return;
      e.preventDefault();
      e.stopPropagation();
      const dt = new DataTransfer();
      for (const item of items) {
        const f = item.getAsFile();
        if (f) dt.items.add(f);
      }
      if (dt.files.length) void uploadFiles(dt.files);
    },
    [uploadFiles],
  );

  const refThumbClass =
    "group relative shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/40";

  const refThumbCorner = useCallback(
    (index: number, total: number) =>
      sbv1DockRefCornerLabelForModel(
        modelKey,
        referenceMode,
        activeDockMode,
        index,
        total,
        {
          multiShots,
          providerId: data.engine?.providerId,
        },
      ),
    [
      modelKey,
      referenceMode,
      activeDockMode,
      multiShots,
      data.engine?.providerId,
    ],
  );

  const refIsActive = useCallback(
    (linkId: string) =>
      allRefsHighlighted ||
      showFirstLastSlots ||
      activeRefIds.includes(linkId),
    [allRefsHighlighted, showFirstLastSlots, activeRefIds],
  );

  const refThumbnails = (() => {
    if (showFirstLastSlots) {
      return (
        <div className="flex min-w-0 items-center gap-1">
          {[0, 1].map((slotIndex) => {
            const link = upstreamLinks[slotIndex];
            const corner = refThumbCorner(slotIndex, 2) ?? "参考";
            if (link) {
              const sourceNode = canvasNodes.find((n) => n.id === link.sourceNodeId);
              const importState = portraitImportUiState(
                sourceNode?.data as CanvasPortraitNodeFields | undefined,
              );
              return (
                  <DockUpstreamRefPreviewCard
                    key={link.id}
                    id={link.id}
                    label={link.label}
                    previewUrl={link.previewUrl}
                    cornerLabel={corner}
                    badgeIndex={slotIndex}
                    active={refIsActive(link.id)}
                    importBadge={importState}
                    className={refThumbClass}
                    style={refThumbStyle}
                    badgeFontPx={badgeFontPx}
                    badgeMinPx={badgeMinPx}
                    onDisconnect={() => onDisconnect(link)}
                  />
              );
            }
            return (
              <Sbv1DockEmptyRefSlot
                key={`empty-${slotIndex}`}
                label={corner}
                style={refThumbStyle}
                iconPx={logoIconPx}
                textFontPx={dockTextFontPx}
              />
            );
          })}
        </div>
      );
    }

    if (upstreamLinks.length === 0) return null;

    return (
      <div className="hide-scroll-bar flex min-w-0 items-center gap-1.5 overflow-x-auto">
        {upstreamLinks.map((link, index) => {
          const sourceNode = canvasNodes.find((n) => n.id === link.sourceNodeId);
          const importState = portraitImportUiState(
            sourceNode?.data as CanvasPortraitNodeFields | undefined,
          );
          const corner = refThumbCorner(index, upstreamLinks.length);
          return (
            <DockUpstreamRefPreviewCard
              key={link.id}
              id={link.id}
              label={link.label}
              previewUrl={link.previewUrl}
              cornerLabel={corner}
              badgeIndex={index}
              active={refIsActive(link.id)}
              importBadge={importState}
              className={refThumbClass}
              style={refThumbStyle}
              badgeFontPx={badgeFontPx}
              badgeMinPx={badgeMinPx}
              onDisconnect={() => onDisconnect(link)}
            />
          );
        })}
      </div>
    );
  })();

  const dockHeader = (() => {
    if (isHdVideo) return null;
    const hasModeBar = dockChips.length > 0;
    const hasRefRow = textDockLinks.length > 0 || refThumbnails;
    if (!hasModeBar && !hasRefRow) return null;

    return (
      <>
        {hasModeBar ? (
          <Sbv1VideoDockModeBar
            chips={dockChips}
            activeMode={activeDockMode}
            disabled={isGenerating}
            chipFontPx={chipFontPx}
            chipMinHeightPx={chipMinHeightPx}
            onSelect={(mode) => onPatch(dockInputModeToPatch(mode))}
          />
        ) : null}
        {hasRefRow ? (
          <Pro2DockHeader
            compact
            minHeightPx={headerMinHeightPx}
            refRow={
              <>
                {textDockLinks.length > 0 ? (
                  <Pro2DockUpstreamChips
                    links={textDockLinks}
                    anchorNodeId={nodeId}
                    activeIds={textDockLinks.map((l) => l.id)}
                  />
                ) : null}
                {refThumbnails}
              </>
            }
          />
        ) : null}
      </>
    );
  })();

  const toolbar = (
    <Pro2DockToolbar compact className="gap-2 py-2.5">
      <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-0.5">
        {isHdVideo ? (
          <Sbv1HdVideoDockToolbar
            data={data}
            disabled={isGenerating}
            onPatch={onPatch}
          />
        ) : (
          <>
            <Sbv1VideoDockModelPicker
              data={data}
              disabled={isGenerating}
              onPatch={onPatch}
              open={dockMenu === "model"}
              onOpenChange={(next) => setDockMenu(next ? "model" : null)}
            />
            <Sbv1VideoDockParamsPicker
              data={data}
              disabled={isGenerating}
              onPatch={onPatch}
              open={dockMenu === "params"}
              onOpenChange={(next) => setDockMenu(next ? "params" : null)}
            />
          </>
        )}
      </div>

      <div className="min-w-0 flex-1" />

      <div
        className="flex shrink-0 items-center gap-1.5 text-white/80"
        style={{ fontSize: dockTextFontPx }}
      >
        {estCredits?.credits != null ? (
          <span
            className="flex shrink-0 items-center gap-1 tabular-nums text-amber-200/90"
            style={{ fontSize: creditsFontPx }}
            title={`${billableDurationSec}s 封顶 · ${estCredits.canonicalModelKey} · 预计扣 ${estCredits.credits} 积分（按当前套餐折算，与实扣一致）`}
          >
            <Zap
              className="fill-amber-300/90 text-amber-300/90"
              style={{ width: 14, height: 14 }}
            />
            {estCredits.credits}
          </span>
        ) : null}
        <button
          type="button"
          disabled={!canSend}
          title={isGenerating ? "生成中" : sendTitle ?? (isHdVideo ? "生成高清视频" : "生成视频")}
          className="nodrag flex shrink-0 items-center justify-center rounded-lg bg-white text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ width: sendBtnPx, height: sendBtnPx }}
          onClick={runWithCommittedPrompt}
        >
          {isGenerating ? (
            <Loader2
              className="animate-spin"
              style={{ width: sendIconPx, height: sendIconPx }}
            />
          ) : (
            <ArrowUp style={{ width: sendIconPx, height: sendIconPx }} />
          )}
        </button>
      </div>
    </Pro2DockToolbar>
  );

  return (
    <>
      <Pro2InputDockShell
        flowAnchor={placement}
        dockClassName="sbv1-image-dock"
        hidden={hidden}
        header={dockHeader}
        footer={toolbar}
      >
        <div
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            void uploadFiles(e.dataTransfer.files);
          }}
        >
          {isDragging && !isHdVideo ? (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-cyan-950/55 backdrop-blur-[1px]">
              <p className="flex items-center gap-2 text-sm text-cyan-100/90">
                <ImageIcon className="size-4 opacity-70" />
                拖放图片到此处添加参考
              </p>
            </div>
          ) : null}
          {isHdVideo ? (
            <div
              className={cn(
                SBV1_CHAT_INPUT_TEXTAREA_CLASS,
                SBV1_VIDEO_DOCK_TEXTAREA_INSET_CLASS,
                "flex min-h-0 flex-1 items-center justify-center px-4 text-center text-white/45",
              )}
              style={{ fontSize: dockTextFontPx }}
            >
              {hasMotionVideo
                ? "已连接上游视频，选择参数后点击生成"
                : "请从左侧连接上游视频节点，或在视频节点右侧 + 选择「高清视频」"}
            </div>
          ) : (
            <MentionsEditable
              key={nodeId}
              className={cn(
                SBV1_CHAT_INPUT_TEXTAREA_CLASS,
                RF_FORM_CONTROL,
                RF_NO_WHEEL,
                SBV1_VIDEO_DOCK_TEXTAREA_INSET_CLASS,
              )}
              dockInsetClassName={SBV1_VIDEO_DOCK_TEXTAREA_INSET_CLASS}
              placeholder="描述你想生成的视频… 使用 @ 引用参考图，或粘贴/上传图片"
              value={storedPrompt}
              mentionables={mentionables}
              disabled={isGenerating}
              rows={3}
              commitHandleRef={promptCommitRef}
              onChange={(prompt, _refs, meta) => {
                setLivePrompt(prompt);
                updateNodeData(
                  nodeId,
                  { prompt, dockInput: prompt },
                  { commit: meta?.commit ?? true },
                );
              }}
              onPaste={onPaste}
              mentionPickerTitle="参考图 · ←→ Enter 插入"
              mentionPickerEmptyHint="暂无已连接参考图，请先连线或上传图片。"
              mentionInlineThumb
              mentionEdition="sbv1"
            />
          )}
        </div>
      </Pro2InputDockShell>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />

    </>
  );
});

function Sbv1DockEmptyRefSlot({
  label,
  style,
  iconPx,
  textFontPx,
}: {
  label: string;
  style?: React.CSSProperties;
  iconPx?: number;
  textFontPx?: number;
}) {
  const iconSize = iconPx ?? 14;
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-md border border-dashed border-white/15 bg-white/[0.02] flex flex-col items-center justify-center"
      style={style}
      title={`${label} · 连接或上传参考图`}
    >
      <ImageIcon
        className="text-white/35"
        style={{ width: iconSize, height: iconSize }}
      />
      <span
        className="absolute bottom-0.5 font-medium text-white/45"
        style={{ fontSize: textFontPx ?? 14 }}
      >
        {label}
      </span>
    </div>
  );
}
