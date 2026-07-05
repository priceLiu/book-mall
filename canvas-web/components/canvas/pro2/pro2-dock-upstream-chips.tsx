"use client";

import { useCallback, useState } from "react";
import { AlignLeft, FileText, ImageIcon, X } from "lucide-react";
import { DockRefCornerBadge } from "@/components/canvas/pro2/dock-ref-corner-badge";
import { DockUpstreamRefPreviewCard } from "@/components/canvas/pro2/dock-upstream-ref-preview-card";
import { createPortal } from "react-dom";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { canvasNotify } from "@/lib/canvas/canvas-notify";
import type { Pro2DockUpstreamLink } from "@/lib/canvas/pro2-dock-upstream-links";
import { isPro2DockUpstreamEdgeLink } from "@/lib/canvas/pro2-dock-upstream-links";
import { validateStoryPipelineDeletion } from "@/lib/canvas/story-pipeline-delete-guard";
import { PRO2_DOCK_BORDER, PRO2_DOCK_SHELL_BG } from "@/lib/canvas/story-pro2-node-chrome";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  PRO2_DOCK_ACTIVE_REF_BORDER_CLASS,
  PRO2_DOCK_REF_IDLE_BORDER_CLASS,
} from "@/lib/canvas/dock-active-ref-chrome";
import { useLibtvDockRefThumbMetrics } from "@/lib/canvas/use-libtv-dock-ref-thumb-metrics";
import { cn } from "@/lib/utils";

function TextUpstreamChip({
  link,
  index,
  anchorNodeId,
  active,
  thumbPx,
  logoIconPx,
  badgeFontPx,
  badgeMinPx,
}: {
  link: Pro2DockUpstreamLink;
  index: number;
  anchorNodeId: string;
  active?: boolean;
  thumbPx: number;
  logoIconPx: number;
  badgeFontPx: number;
  badgeMinPx: number;
}) {
  const [open, setOpen] = useState(false);
  const { doubleConfirm } = useDialogs();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const removeNode = useCanvasStore((s) => s.removeNode);

  const deletable = link.sourceNodeId !== anchorNodeId;
  const Icon =
    link.kind === "outline"
      ? AlignLeft
      : link.kind === "image"
        ? ImageIcon
        : FileText;

  const onDelete = useCallback(async () => {
    if (!deletable) return;
    const validation = validateStoryPipelineDeletion(
      [link.sourceNodeId],
      nodes,
      edges,
    );
    if (!validation.ok) {
      canvasNotify({
        title: "无法删除该节点",
        message: validation.message,
        variant: "error",
      });
      return;
    }
    const id = validation.allowedIds[0];
    if (!id) return;

    const hasOss = link.kind === "image" && Boolean(link.previewUrl);
    const ok = await doubleConfirm({
      first: {
        title: `断开并删除「${link.label}」？`,
        message:
          "将删除画布上该上游节点及其连线；当前脚本节点不会被删除。",
        confirmLabel: "继续",
        danger: true,
      },
      second: {
        title: "再次确认 · 不可恢复",
        message: hasOss
          ? "节点删除后无法撤回；已上传的云端图片不会自动从存储中清除。"
          : "节点删除后无法撤回，是否继续？",
        confirmLabel: "永久删除",
        danger: true,
      },
    });
    if (!ok) return;
    removeNode(id);
  }, [
    deletable,
    link.sourceNodeId,
    link.label,
    link.kind,
    link.previewUrl,
    nodes,
    edges,
    doubleConfirm,
    removeNode,
  ]);

  return (
    <>
      <div
        className="group relative shrink-0 overflow-hidden"
        style={{
          width: thumbPx,
          height: thumbPx,
          minWidth: thumbPx,
          minHeight: thumbPx,
        }}
      >
        <button
          type="button"
          className={cn(
            "nodrag block size-full min-h-0 min-w-0 overflow-hidden rounded-md border bg-white/[0.04] text-white/70 transition hover:bg-white/[0.07] hover:text-white/90",
            active
              ? PRO2_DOCK_ACTIVE_REF_BORDER_CLASS
              : PRO2_DOCK_REF_IDLE_BORDER_CLASS,
          )}
          title={`已链接：${link.label}`}
          onClick={() => setOpen(true)}
        >
          <span className="flex size-full items-center justify-center">
            <Icon
              className="shrink-0"
              style={{ width: logoIconPx, height: logoIconPx }}
            />
          </span>
        </button>
        {deletable &&
        isPro2DockUpstreamEdgeLink(link, anchorNodeId) ? (
          <DockRefCornerBadge
            label={String(index + 1)}
            title={`删除「${link.label}」`}
            onRemove={() => void onDelete()}
            fontSizePx={badgeFontPx}
            minSizePx={badgeMinPx}
          />
        ) : deletable ? null : (
          <span
            className="pointer-events-none absolute right-0.5 top-0.5 z-10 flex min-h-[14px] min-w-[14px] items-center justify-center rounded bg-black/75 px-1 py-px text-[8px] font-medium leading-none text-white/90"
            aria-hidden
          >
            {index + 1}
          </span>
        )}
      </div>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div
                className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border shadow-2xl"
                style={{
                  borderColor: PRO2_DOCK_BORDER,
                  background: PRO2_DOCK_SHELL_BG,
                }}
              >
                <header className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
                  <p className="text-[13px] font-medium text-white/85">
                    {link.label}
                  </p>
                  <button
                    type="button"
                    className="nodrag rounded-md p-1.5 text-white/45 hover:bg-white/8"
                    onClick={() => setOpen(false)}
                  >
                    <X className="size-4" />
                  </button>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  {link.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={link.previewUrl}
                      alt={link.label}
                      className="mx-auto max-h-[60vh] rounded-lg object-contain"
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-white/75">
                      {link.previewMd ?? "（无预览内容）"}
                    </pre>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function ImageUpstreamChip({
  link,
  index,
  anchorNodeId,
  active,
  thumbStyle,
  thumbClass,
  badgeFontPx,
  badgeMinPx,
}: {
  link: Pro2DockUpstreamLink;
  index: number;
  anchorNodeId: string;
  active?: boolean;
  thumbStyle: React.CSSProperties;
  thumbClass: string;
  badgeFontPx: number;
  badgeMinPx: number;
}) {
  const { doubleConfirm } = useDialogs();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const removeNode = useCanvasStore((s) => s.removeNode);

  const deletable = link.sourceNodeId !== anchorNodeId;

  const onDelete = useCallback(async () => {
    if (!deletable) return;
    const validation = validateStoryPipelineDeletion(
      [link.sourceNodeId],
      nodes,
      edges,
    );
    if (!validation.ok) {
      canvasNotify({
        title: "无法删除该节点",
        message: validation.message,
        variant: "error",
      });
      return;
    }
    const id = validation.allowedIds[0];
    if (!id) return;

    const hasOss = Boolean(link.previewUrl);
    const ok = await doubleConfirm({
      first: {
        title: `断开并删除「${link.label}」？`,
        message:
          "将删除画布上该上游节点及其连线；当前脚本节点不会被删除。",
        confirmLabel: "继续",
        danger: true,
      },
      second: {
        title: "再次确认 · 不可恢复",
        message: hasOss
          ? "节点删除后无法撤回；已上传的云端图片不会自动从存储中清除。"
          : "节点删除后无法撤回，是否继续？",
        confirmLabel: "永久删除",
        danger: true,
      },
    });
    if (!ok) return;
    removeNode(id);
  }, [
    deletable,
    link.sourceNodeId,
    link.label,
    link.previewUrl,
    nodes,
    edges,
    doubleConfirm,
    removeNode,
  ]);

  return (
    <DockUpstreamRefPreviewCard
      id={link.id}
      label={link.label}
      previewUrl={link.previewUrl}
      active={Boolean(active)}
      badgeIndex={index}
      showCornerBadge={isPro2DockUpstreamEdgeLink(link, anchorNodeId)}
      className={thumbClass}
      style={thumbStyle}
      badgeFontPx={badgeFontPx}
      badgeMinPx={badgeMinPx}
      onDisconnect={() => {
        if (deletable) void onDelete();
      }}
    />
  );
}

export function Pro2DockUpstreamChips({
  links,
  anchorNodeId,
  activeIds = [],
}: {
  links: Pro2DockUpstreamLink[];
  anchorNodeId: string;
  activeIds?: string[];
}) {
  const {
    thumbPx,
    thumbStyle,
    thumbClass,
    badgeFontPx,
    badgeMinPx,
    logoIconPx,
  } = useLibtvDockRefThumbMetrics();

  if (!links.length) return null;

  return (
    <>
      {links.map((link, i) =>
        link.kind === "image" ? (
          <ImageUpstreamChip
            key={link.id}
            link={link}
            index={i}
            anchorNodeId={anchorNodeId}
            active={activeIds.includes(link.id)}
            thumbStyle={thumbStyle}
            thumbClass={thumbClass}
            badgeFontPx={badgeFontPx}
            badgeMinPx={badgeMinPx}
          />
        ) : (
          <TextUpstreamChip
            key={link.id}
            link={link}
            index={i}
            anchorNodeId={anchorNodeId}
            active={activeIds.includes(link.id)}
            thumbPx={thumbPx}
            logoIconPx={logoIconPx}
            badgeFontPx={badgeFontPx}
            badgeMinPx={badgeMinPx}
          />
        ),
      )}
    </>
  );
}
