"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  ChevronDown,
  ImageIcon,
  Loader2,
  Plus,
  ScanFace,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  MentionsTextarea,
  type MentionableItem,
} from "@/components/canvas/mentions/MentionsTextarea";
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
  estimateSbv1ListCostYuan,
  getSbv1VolcengineModelById,
  migrateSbv1ModelVariantId,
} from "@/lib/canvas/sbv1-video-models";
import type { Sbv1UpstreamRefLink } from "@/lib/canvas/sbv1-upstream-ref-links";
import type { Sbv1VideoEngineNodeData } from "@/lib/canvas/sbv1-workspace-types";
import { dockActiveRefIdsFromPrompt } from "@/lib/canvas/dock-mention-ref-urls";
import {
  SBV1_DOCK_ACTIVE_REF_BORDER_CLASS,
  SBV1_DOCK_REF_IDLE_BORDER_CLASS,
} from "@/lib/canvas/dock-active-ref-chrome";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { cn } from "@/lib/utils";
import {
  Sbv1VideoGenerateSettingsModal,
  sbv1VideoSettingsTriggerLabel,
} from "./sbv1-video-generate-settings-modal";
import { useSbv1PortraitLivenessStatus } from "@/lib/canvas/use-sbv1-portrait-liveness-status";
import { Sbv1PortraitLivenessModal } from "./sbv1-portrait-liveness-modal";

function RefPreviewCard({
  link,
  active,
  onDisconnect,
}: {
  link: Sbv1UpstreamRefLink;
  active: boolean;
  onDisconnect: () => void;
}) {
  return (
    <div
      className={cn(
        SBV1_REF_THUMB_CLASS,
        "border-2 transition-shadow",
        active ? SBV1_DOCK_ACTIVE_REF_BORDER_CLASS : SBV1_DOCK_REF_IDLE_BORDER_CLASS,
      )}
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
      <button
        type="button"
        className="nodrag absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded bg-black/75 text-white/70 opacity-0 transition hover:text-white group-hover:opacity-100"
        title="断开连线"
        onClick={onDisconnect}
      >
        <X className="size-2.5" />
      </button>
    </div>
  );
}

export function Sbv1VideoEngineChatInput({
  nodeId,
  data,
  upstreamLinks,
  mentionables,
  isGenerating,
  onPatch,
  onRun,
  placement,
}: {
  nodeId: string;
  data: Sbv1VideoEngineNodeData;
  upstreamLinks: Sbv1UpstreamRefLink[];
  mentionables: MentionableItem[];
  isGenerating: boolean;
  onPatch: (patch: Partial<Sbv1VideoEngineNodeData>) => void;
  onRun: () => void;
  placement: { left: number; top: number; dockW: number };
}) {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const { providers } = useUserProviders();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [livenessOpen, setLivenessOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { groupId, verifiedAt, refresh, isVerified } =
    useSbv1PortraitLivenessStatus(Boolean(base));

  const smartMulti = data.referenceMode === "smart_multi";
  const variantId = migrateSbv1ModelVariantId(
    data.volcengineVariantId ?? data.jimengModelId,
  );
  const selectedModel = getSbv1VolcengineModelById(variantId, providers);
  const settingsLabel = sbv1VideoSettingsTriggerLabel(data, providers);
  const estCostYuan = estimateSbv1ListCostYuan({
    listCostYuanPerSec: selectedModel.listCostYuanPerSec,
    durationSec: smartMulti && data.durationSec <= 0 ? 4 : data.durationSec,
  });

  const hasRefs = upstreamLinks.some((l) => l.previewUrl);
  const hasPrompt = Boolean((data.prompt ?? "").trim());
  const activeRefIds = useMemo(
    () => dockActiveRefIdsFromPrompt(data.prompt ?? ""),
    [data.prompt],
  );
  const canSend =
    (hasPrompt || hasRefs) &&
    !isGenerating &&
    Boolean(data.engine?.providerId && data.engine?.modelKey);

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
    [base, nodeId, nodes, edges, addNode, setEdges, updateNodeData, alert],
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
          {upstreamLinks.map((link) => (
            <RefPreviewCard
              key={link.id}
              link={link}
              active={activeRefIds.includes(link.id)}
              onDisconnect={() => onDisconnect(link)}
            />
          ))}
        </div>
      </Pro2DockContextBar>
    ) : null;

  const toolbar = (
    <Pro2DockToolbar>
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
        <button
          type="button"
          title="真人人像 · 活体认证"
          disabled={isGenerating}
          className={cn(
            "nodrag rounded-md p-1.5 transition hover:bg-white/[0.06] hover:text-white/75 disabled:cursor-not-allowed disabled:opacity-40",
            isVerified ? "text-cyan-300/90" : "text-white/40",
          )}
          onClick={() => setLivenessOpen(true)}
        >
          <ScanFace className="size-4" />
        </button>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
        <button
          type="button"
          disabled={isGenerating}
          className="nodrag flex h-8 min-w-0 max-w-[min(220px,45%)] items-center gap-1 rounded-md px-2 text-[13px] text-white/65 hover:bg-white/[0.06] hover:text-white/90"
          onClick={() => setSettingsOpen(true)}
        >
          <span className="truncate">{settingsLabel}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-45" />
        </button>
        {estCostYuan != null ? (
          <span className="shrink-0 text-[10px] tabular-nums text-white/35">
            ≈¥{estCostYuan.toFixed(2)}
          </span>
        ) : null}
        <button
          type="button"
          disabled={!canSend}
          title={isGenerating ? "生成中" : "生成视频"}
          className="nodrag flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={onRun}
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
        left={placement.left}
        top={placement.top}
        width={placement.dockW}
        dockClassName="sbv1-video-engine-dock"
        footer={
          <>
            {refBar}
            {toolbar}
          </>
        }
      >
        <div
          className="relative min-h-0"
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
            wrapperClassName="min-h-[72px]"
            fillHeight
            placeholder="描述你想生成的视频… 使用 @ 引用参考图，或粘贴/上传图片"
            value={data.prompt ?? ""}
            mentionables={mentionables}
            disabled={isGenerating}
            onChange={(prompt) => onPatch({ prompt })}
            onPaste={onPaste}
            mentionPickerTitle="参考图 · ←→ Enter 插入"
            mentionPickerEmptyHint="暂无已连接参考图，请先连线或上传图片。"
            onKeyDownCapture={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing &&
                canSend
              ) {
                e.preventDefault();
                onRun();
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

      <Sbv1PortraitLivenessModal
        open={livenessOpen}
        existingGroupId={groupId}
        verifiedAt={verifiedAt}
        onClose={() => setLivenessOpen(false)}
        onSuccess={() => {
          void refresh();
        }}
      />
    </>
  );
}
