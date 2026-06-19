"use client";

import { useCallback, useState } from "react";
import { AlignLeft, FileText, ImageIcon, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { canvasNotify } from "@/lib/canvas/canvas-notify";
import type { Pro2DockUpstreamLink } from "@/lib/canvas/pro2-dock-upstream-links";
import { validateStoryPipelineDeletion } from "@/lib/canvas/story-pipeline-delete-guard";
import { PRO2_DOCK_BORDER, PRO2_DOCK_SHELL_BG } from "@/lib/canvas/story-pro2-node-chrome";
import { useCanvasStore } from "@/lib/canvas/store";
import { PRO2_DOCK_ACTIVE_REF_BORDER_CLASS, PRO2_DOCK_REF_IDLE_BORDER_CLASS } from "@/lib/canvas/dock-active-ref-chrome";
import { cn } from "@/lib/utils";

function UpstreamChip({
  link,
  index,
  anchorNodeId,
  active,
}: {
  link: Pro2DockUpstreamLink;
  index: number;
  anchorNodeId: string;
  active?: boolean;
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
      <div className="group relative size-10 shrink-0">
        <button
          type="button"
          className={cn(
            "nodrag flex size-full items-center justify-center overflow-hidden rounded-lg border bg-white/[0.04] text-white/70 transition hover:bg-white/[0.07] hover:text-white/90",
            active
              ? PRO2_DOCK_ACTIVE_REF_BORDER_CLASS
              : PRO2_DOCK_REF_IDLE_BORDER_CLASS,
          )}
          title={`已链接：${link.label}`}
          onClick={() => setOpen(true)}
        >
          {link.kind === "image" && link.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={link.previewUrl}
              alt={link.label}
              className="size-full rounded-[7px] object-cover"
            />
          ) : (
            <Icon className="size-4" />
          )}
        </button>
        <span
          className="pointer-events-none absolute left-0 top-0 z-10 flex size-3 items-center justify-center rounded-br-md bg-black/75 text-[8px] font-medium text-white/90"
          aria-hidden
        >
          {index + 1}
        </span>
        {deletable ? (
          <button
            type="button"
            className={cn(
              "nodrag absolute right-0 top-0 z-10 flex size-4 items-center justify-center rounded-bl-md bg-black/75 text-white/80 transition hover:bg-red-950/90 hover:text-white",
              "opacity-0 group-hover:opacity-100 focus:opacity-100",
            )}
            title={`删除「${link.label}」`}
            onClick={(e) => {
              e.stopPropagation();
              void onDelete();
            }}
          >
            <X className="size-2.5" />
          </button>
        ) : null}
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

export function Pro2DockUpstreamChips({
  links,
  anchorNodeId,
  activeIds = [],
}: {
  links: Pro2DockUpstreamLink[];
  anchorNodeId: string;
  activeIds?: string[];
}) {
  if (!links.length) return null;
  return (
    <>
      {links.map((link, i) => (
        <UpstreamChip
          key={link.id}
          link={link}
          index={i}
          anchorNodeId={anchorNodeId}
          active={activeIds.includes(link.id)}
        />
      ))}
    </>
  );
}
