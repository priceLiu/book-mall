"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  ChevronDown,
  ImageIcon,
  Loader2,
  Plus,
  SlidersHorizontal,
  X,
  Zap,
} from "lucide-react";
import {
  MentionsTextarea,
  type MentionableItem,
  type MentionsTextareaCommitHandle,
} from "@/components/canvas/mentions/MentionsTextarea";
import { MentionHoverPreviewPortal } from "@/components/canvas/mentions/mention-hover-preview";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  Pro2DockContextBar,
  Pro2DockToolbar,
  Pro2InputDockShell,
} from "@/components/canvas/pro2/pro2-input-dock-shell";
import { RF_FORM_CONTROL, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import { spawnSbv1PastedImages } from "@/lib/canvas/spawn-sbv1-paste-images";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  SBV1_CHAT_INPUT_TEXTAREA_CLASS,
  SBV1_REF_THUMB_CLASS,
} from "@/lib/canvas/sbv1-node-chrome";
import {
  getSbv1VolcengineModelById,
  migrateSbv1ModelVariantId,
  resolveSbv1VariantIdFromEngine,
} from "@/lib/canvas/sbv1-video-models";
import { useModelCreditsPreview } from "@/lib/canvas/use-model-credits-preview";
import type { Sbv1UpstreamRefLink } from "@/lib/canvas/sbv1-upstream-ref-links";
import type { Sbv1VideoEngineNodeData } from "@/lib/canvas/sbv1-workspace-types";
import { dockActiveRefIdsFromPrompt } from "@/lib/canvas/dock-mention-ref-urls";
import {
  SBV1_DOCK_ACTIVE_REF_BORDER_CLASS,
  SBV1_DOCK_REF_IDLE_BORDER_CLASS,
} from "@/lib/canvas/dock-active-ref-chrome";
import type { LibtvDockFlowPlacement } from "@/lib/canvas/libtv-dock-flow-placement";
import {
  portraitImportUiState,
  type CanvasPortraitNodeFields,
} from "@/lib/canvas/portrait-node-data";
import { usePruneStaleDockMentions } from "@/lib/canvas/use-prune-stale-dock-mentions";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { cn } from "@/lib/utils";
import {
  Sbv1VideoGenerateSettingsModal,
  sbv1VideoSettingsTriggerLabel,
} from "./sbv1-video-generate-settings-modal";

function RefPreviewCard({
  link,
  active,
  importState,
  onDisconnect,
}: {
  link: Sbv1UpstreamRefLink;
  active: boolean;
  importState: ReturnType<typeof portraitImportUiState>;
  onDisconnect: () => void;
}) {
  const [hoverPreview, setHoverPreview] = useState<DOMRect | null>(null);
  const mentionItem: MentionableItem = {
    id: link.id,
    label: link.label,
    kind: "image",
    previewUrl: link.previewUrl,
  };

  return (
    <>
      <div
        className={cn(
          SBV1_REF_THUMB_CLASS,
          "group border-2 transition-shadow",
          active ? SBV1_DOCK_ACTIVE_REF_BORDER_CLASS : SBV1_DOCK_REF_IDLE_BORDER_CLASS,
        )}
        onMouseEnter={(e) => {
          if (!link.previewUrl) return;
          setHoverPreview(e.currentTarget.getBoundingClientRect());
        }}
        onMouseLeave={() => setHoverPreview(null)}
      >
      {link.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={link.previewUrl}
          alt={link.label}
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center text-white/30">
          <ImageIcon className="size-4" />
        </div>
      )}
      <p className="pointer-events-none absolute bottom-0 left-0 right-0 truncate bg-black/65 px-1 py-0.5 text-[9px] text-white/80">
        {link.label}
      </p>
      {importState === "active" ? (
        <span className="pointer-events-none absolute left-0.5 top-0.5 rounded bg-emerald-600/90 px-1 py-px text-[8px] font-medium text-white">
          已入库
        </span>
      ) : importState === "pending" ? (
        <span className="pointer-events-none absolute left-0.5 top-0.5 rounded bg-amber-600/90 px-1 py-px text-[8px] font-medium text-white">
          入库中
        </span>
      ) : link.previewUrl ? (
        <span className="pointer-events-none absolute left-0.5 top-0.5 rounded bg-rose-600/90 px-1 py-px text-[8px] font-medium text-white">
          未入库
        </span>
      ) : null}
      <button
        type="button"
        className="nodrag absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded bg-black/75 text-white/70 opacity-0 transition hover:text-white group-hover:opacity-100"
        title="断开连线"
        onClick={onDisconnect}
      >
        <X className="size-2.5" />
      </button>
      </div>
      <MentionHoverPreviewPortal
        item={hoverPreview ? mentionItem : null}
        anchorRect={hoverPreview}
      />
    </>
  );
}

export const Sbv1VideoEngineChatInput = memo(function Sbv1VideoEngineChatInput({
  nodeId,
  data,
  upstreamLinks,
  mentionables,
  isGenerating,
  onPatch,
  onRun,
  placement,
  hidden,
}: {
  nodeId: string;
  data: Sbv1VideoEngineNodeData;
  upstreamLinks: Sbv1UpstreamRefLink[];
  mentionables: MentionableItem[];
  isGenerating: boolean;
  onPatch: (patch: Partial<Sbv1VideoEngineNodeData>) => void;
  onRun: () => void;
  placement: LibtvDockFlowPlacement;
  hidden?: boolean;
}) {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const { providers } = useUserProviders();
  const addNode = useCanvasStore((s) => s.addNode);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptCommitRef = useRef<MentionsTextareaCommitHandle | null>(null);
  const [livePrompt, setLivePrompt] = useState(data.prompt ?? "");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setLivePrompt(data.prompt ?? "");
  }, [data.prompt, nodeId]);

  const smartMulti = data.referenceMode === "smart_multi";
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
  const settingsLabel = sbv1VideoSettingsTriggerLabel(data, providers);
  const estCredits = useModelCreditsPreview(modelKey, billableDurationSec, variantId);

  const hasRefs = upstreamLinks.some((l) => l.previewUrl);
  const hasPrompt = Boolean(livePrompt.trim());
  const activeRefIds = useMemo(
    () => dockActiveRefIdsFromPrompt(livePrompt),
    [livePrompt],
  );

  usePruneStaleDockMentions({
    nodeId,
    prompt: livePrompt,
    mentionables,
    field: "prompt",
    updateNodeData,
  });

  const canSend =
    (hasPrompt || hasRefs) &&
    !isGenerating &&
    Boolean(data.engine?.providerId && data.engine?.modelKey);

  const runWithCommittedPrompt = useCallback(async () => {
    promptCommitRef.current?.flushDraft();
    await onRun();
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

  const refBar =
    upstreamLinks.length > 0 ? (
      <Pro2DockContextBar>
        <div className="hide-scroll-bar flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
          {upstreamLinks.map((link) => {
            const sourceNode = useCanvasStore
              .getState()
              .nodes.find((n) => n.id === link.sourceNodeId);
            const importState = portraitImportUiState(
              sourceNode?.data as CanvasPortraitNodeFields | undefined,
            );
            return (
            <RefPreviewCard
              key={link.id}
              link={link}
              active={activeRefIds.includes(link.id)}
              importState={importState}
              onDisconnect={() => onDisconnect(link)}
            />
            );
          })}
        </div>
      </Pro2DockContextBar>
    ) : null;

  const toolbar = (
    <Pro2DockToolbar className="gap-2">
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          title="上传参考图"
          disabled={isGenerating}
          className="nodrag rounded-md p-1.5 text-white/40 transition hover:bg-white/[0.06] hover:text-white/75 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => fileInputRef.current?.click()}
        >
          <Plus className="size-4" />
        </button>
        <button
          type="button"
          title="视频生成设置"
          disabled={isGenerating}
          className="nodrag rounded-md p-1.5 text-white/40 transition hover:bg-white/[0.06] hover:text-white/75 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => setSettingsOpen(true)}
        >
          <SlidersHorizontal className="size-4" />
        </button>
      </div>

      <button
        type="button"
        disabled={isGenerating}
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
            title={`${billableDurationSec}s 封顶 · ${estCredits.canonicalModelKey} · 预计扣 ${estCredits.credits} 积分（按当前套餐折算，与实扣一致）`}
          >
            <Zap className="size-3.5 fill-amber-300/90 text-amber-300/90" />
            {estCredits.credits}
          </span>
        ) : null}
        <button
          type="button"
          disabled={!canSend}
          title={isGenerating ? "生成中" : "生成视频"}
          className="nodrag flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={runWithCommittedPrompt}
        >
          {isGenerating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowUp className="size-4" />
          )}
        </button>
      </div>
    </Pro2DockToolbar>
  );

  return (
    <>
      <Pro2InputDockShell
        flowAnchor={placement}
        dockClassName="sbv1-video-engine-dock"
        hidden={hidden}
        footer={
          <>
            {refBar}
            {toolbar}
          </>
        }
      >
        <div
          className="relative min-h-0 overflow-visible"
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
          {isDragging ? (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-cyan-950/55 backdrop-blur-[1px]">
              <p className="flex items-center gap-2 text-sm text-cyan-100/90">
                <ImageIcon className="size-4 opacity-70" />
                拖放图片到此处添加参考
              </p>
            </div>
          ) : null}
          <MentionsTextarea
            className={cn(
              SBV1_CHAT_INPUT_TEXTAREA_CLASS,
              RF_FORM_CONTROL,
              RF_NO_WHEEL,
              "min-h-0 px-4 py-3",
            )}
            placeholder="描述你想生成的视频… 使用 @ 引用参考图，或粘贴/上传图片"
            value={data.prompt ?? ""}
            mentionables={mentionables}
            disabled={isGenerating}
            rows={3}
            commitHandleRef={promptCommitRef}
            onChange={(prompt, _refs, meta) => {
              setLivePrompt(prompt);
              if (meta?.commit === false) return;
              updateNodeData(nodeId, { prompt }, { commit: true });
            }}
            onPaste={onPaste}
            mentionPickerTitle="参考图 · ←→ Enter 插入"
            mentionPickerEmptyHint="暂无已连接参考图，请先连线或上传图片。"
            mentionInlineThumb
            mentionEdition="sbv1"
            onKeyDownCapture={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing &&
                canSend
              ) {
                e.preventDefault();
                void runWithCommittedPrompt();
              }
            }}
          />
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

      <Sbv1VideoGenerateSettingsModal
        open={settingsOpen}
        data={data}
        onClose={() => setSettingsOpen(false)}
        onConfirm={onPatch}
      />
    </>
  );
});
