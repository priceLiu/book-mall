"use client";

import Image from "next/image";
import { Download, Eye, FileText, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import {
  ECOM_MEDIA_TILE_ACTION_ICON_CLASS,
  ECOM_SLOT_HOVER_ACTION_BTN_CLASS,
  ECOM_SLOT_HOVER_ACTIONS_ROW_CLASS,
  ECOM_SLOT_HOVER_OVERLAY_CLASS,
} from "@/components/media/ecom-media-library-tile";
import {
  ProductDesignGalleryPreviewDialog,
  type ProductDesignGalleryPreviewItem,
} from "@/components/product-design/product-design-gallery-preview-dialog";
import { ProductDesignPromptDialog } from "@/components/product-design/product-design-prompt-dialog";
import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  detailPageAspectClass,
  detailPageCardWidth,
  type EcomDetailPageRatio,
} from "@/lib/detail-page-suite-platform-ratio";
import { groupProductImageSetSlotsByStructure } from "@/lib/product-image-set-slot-sections";
import type {
  ProductImageSetProject,
  ProductImageSetSlot,
  ProductImageSetSlotKind,
} from "@/lib/product-image-set-types";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<ProductImageSetSlotKind, string> = {
  white_bg: "白底图",
  sellpoint: "卖点图",
  scene: "场景图",
  other: "其他",
};

function mapDisplayRatio(ratio: string): EcomDetailPageRatio {
  if (ratio === "1:1" || ratio === "3:4" || ratio === "4:5" || ratio === "16:9") {
    return ratio;
  }
  return "1:1";
}

function downloadImageFile(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[^\w\u4e00-\u9fff.-]+/g, "_");
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

type Props = {
  project: ProductImageSetProject;
  ratio: string;
  disabled?: boolean;
  generatingSlotIds: Set<string>;
  onProjectChange: () => void | Promise<void>;
  onSaveSlots: (slots: ProductImageSetSlot[]) => Promise<void>;
  onGenerateSlots: (slotIds: string[], opts?: { regenerate?: boolean }) => void | Promise<void>;
};

export function ProductImageSetSlotWorkspace({
  project,
  ratio,
  disabled,
  generatingSlotIds,
  onProjectChange,
  onSaveSlots,
  onGenerateSlots,
}: Props) {
  const { alert, toast } = useDialogs();
  const [rows, setRows] = useState<ProductImageSetSlot[]>(() => project.output.slots);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [promptSlotId, setPromptSlotId] = useState<string | null>(null);
  const [promptReadOnly, setPromptReadOnly] = useState(false);
  const [galleryPreview, setGalleryPreview] = useState<{
    items: ProductDesignGalleryPreviewItem[];
    initialIndex: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const displayRatio = mapDisplayRatio(ratio);
  const cardWidth = detailPageCardWidth(displayRatio);
  const aspectClass = detailPageAspectClass(displayRatio);

  useEffect(() => {
    setRows(project.output.slots);
  }, [project.id, project.output.slots]);

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const row of project.output.slots) {
        if (row.imageUrl?.trim() && next.has(row.id)) {
          next.delete(row.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [project.output.slots]);

  const sections = useMemo(() => groupProductImageSetSlotsByStructure(rows), [rows]);
  const doneCount = rows.filter((r) => r.imageUrl?.trim()).length;
  const promptRow = promptSlotId ? rows.find((r) => r.id === promptSlotId) : null;

  const previewItems = useMemo((): ProductDesignGalleryPreviewItem[] => {
    return rows
      .filter((r) => r.imageUrl?.trim())
      .map((r) => ({
        url: r.imageUrl!,
        title: r.title,
        ratio: displayRatio,
        downloadFilename: `${KIND_LABEL[r.kind]}-${r.index}-${r.title}`,
      }));
  }, [rows, displayRatio]);

  const selectedIds = useMemo(
    () => rows.filter((r) => selected.has(r.id)).map((r) => r.id),
    [rows, selected],
  );

  const persist = useCallback(
    async (next: ProductImageSetSlot[], quiet?: boolean) => {
      if (!quiet) setBusy(true);
      try {
        await onSaveSlots(next);
        await onProjectChange();
      } catch (e) {
        await alert({
          title: "保存失败",
          message: e instanceof Error ? e.message : "未知错误",
          variant: "error",
        });
        throw e;
      } finally {
        if (!quiet) setBusy(false);
      }
    },
    [alert, onProjectChange, onSaveSlots],
  );

  const isSlotGenerating = useCallback(
    (id: string) =>
      generatingSlotIds.has(id) ||
      rows.find((r) => r.id === id)?.status === "generating",
    [generatingSlotIds, rows],
  );

  const toggleSelect = (id: string) => {
    if (isSlotGenerating(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (Boolean(disabled) || busy) return;
    const selectable = rows.filter((r) => !isSlotGenerating(r.id));
    if (selected.size === selectable.length && selectable.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectable.map((r) => r.id)));
    }
  };

  const toggleSectionSelect = (slotIds: string[], selectAll: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of slotIds) {
        if (isSlotGenerating(id)) continue;
        if (selectAll) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const sectionPickState = (slotIds: string[]) => {
    const selectable = slotIds.filter((id) => !isSlotGenerating(id));
    const picked = selectable.filter((id) => selected.has(id)).length;
    if (selectable.length === 0 || picked === 0) return "none" as const;
    if (picked === selectable.length) return "all" as const;
    return "partial" as const;
  };

  const pendingSelectedIds = useMemo(
    () =>
      selectedIds.filter((id) => {
        const row = rows.find((r) => r.id === id);
        return Boolean(row && !row.imageUrl?.trim() && !isSlotGenerating(id));
      }),
    [rows, selectedIds, isSlotGenerating],
  );

  const handleGenerateSelected = async () => {
    const skippedDone =
      selectedIds.length > 0
        ? selectedIds.filter((id) => {
            const row = rowsRef.current.find((r) => r.id === id);
            return Boolean(row?.imageUrl?.trim());
          }).length
        : 0;

    const ids =
      selectedIds.length > 0
        ? pendingSelectedIds
        : rows
            .filter((r) => !r.imageUrl?.trim() && !isSlotGenerating(r.id))
            .map((r) => r.id);

    if (ids.length === 0) {
      await alert({
        title: "无法出图",
        message:
          skippedDone > 0
            ? "已勾选的槽位都已出图。请只勾选未出图的占位，或在已出图悬停菜单点「重新生成」。"
            : "请勾选要生成的槽位，或确保仍有未出图的占位。",
        variant: "error",
      });
      return;
    }
    if (skippedDone > 0) {
      toast({
        title: "已跳过已出图",
        message: `本次只生成 ${ids.length} 张未出图；${skippedDone} 张已出图未纳入批量。`,
        variant: "success",
      });
    }
    await persist(rowsRef.current, true);
    onGenerateSlots(ids, { regenerate: false });
  };

  const handleGenerateOne = async (id: string, regenerate?: boolean) => {
    if (isSlotGenerating(id)) return;
    const row = rowsRef.current.find((r) => r.id === id);
    if (!row?.prompt.trim()) {
      await alert({ title: "无法出图", message: "请先填写本条生图 Prompt。", variant: "error" });
      return;
    }
    await persist(rowsRef.current, true);
    onGenerateSlots([id], { regenerate: regenerate ?? !row.imageUrl?.trim() });
  };

  const commitPrompt = (id: string, prompt: string) => {
    if (promptReadOnly) return;
    const next = rowsRef.current.map((row) =>
      row.id === id ? { ...row, prompt, promptEdited: true } : row,
    );
    setRows(next);
    void persist(next);
  };

  const openPreview = (row: ProductImageSetSlot) => {
    if (!row.imageUrl?.trim() || previewItems.length === 0) return;
    const idx = previewItems.findIndex((i) => i.url === row.imageUrl);
    setGalleryPreview({
      items: previewItems,
      initialIndex: idx >= 0 ? idx : 0,
    });
  };

  const openEditPrompt = (id: string) => {
    setPromptReadOnly(false);
    setPromptSlotId(id);
  };

  const openViewPrompt = (id: string) => {
    setPromptReadOnly(true);
    setPromptSlotId(id);
  };

  const workspaceFrozen = Boolean(disabled) || busy;

  return (
    <section className="rounded-xl border border-[#e8e8ed] bg-[#fafafa] px-4 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#1d1d1f]">套图工作区</h3>
          <p className="mt-0.5 text-[11px] text-[#6e6e73]">
            按侧栏套图结构分组 · 比例 {ratio} · 勾选后批量出图；单张生成时其它槽位仍可继续出图。
            {rows.length > 0 ? (
              <span className="ml-1">
                已出 {doneCount}/{rows.length}
              </span>
            ) : null}
          </p>
        </div>
        <EcomButtonPrimary
          size="sm"
          type="button"
          disabled={workspaceFrozen || rows.length === 0}
          onClick={() => void handleGenerateSelected()}
        >
          {pendingSelectedIds.length > 0
            ? `生成选中 (${pendingSelectedIds.length})`
            : selectedIds.length > 0
              ? "所选均已出图"
              : "生成全部未出图"}
        </EcomButtonPrimary>
      </div>

      {rows.length > 0 ? (
        <div className="mb-3 flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[#6e6e73]">
            <input
              type="checkbox"
              className="rounded border-[#d2d2d7]"
              checked={
                rows.filter((r) => !isSlotGenerating(r.id)).length > 0 &&
                selected.size === rows.filter((r) => !isSlotGenerating(r.id)).length
              }
              onChange={toggleSelectAll}
              disabled={workspaceFrozen}
            />
            全选全部模块
          </label>
        </div>
      ) : null}

      <div className="space-y-4">
        {sections.map((section) => {
          const ids = section.slots.map((s) => s.id);
          const pick = sectionPickState(ids);
          const sectionDone = section.slots.filter((s) => s.imageUrl?.trim()).length;

          return (
            <div
              key={section.kind}
              className="rounded-xl border border-[#e8e8ed] bg-white p-4"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-[#1d1d1f]">{section.label}</span>
                <label className="flex items-center gap-1 text-xs text-[#6e6e73]">
                  <input
                    type="checkbox"
                    className="rounded border-[#d2d2d7]"
                    checked={pick === "all"}
                    ref={(el) => {
                      if (el) el.indeterminate = pick === "partial";
                    }}
                    disabled={workspaceFrozen}
                    onChange={() => toggleSectionSelect(ids, pick !== "all")}
                  />
                  全选
                </label>
                <span className="text-[11px] text-[#86868b]">
                  {sectionDone}/{section.slots.length} 张 · 与侧栏「{section.label}」数量一致
                </span>
              </div>

              <div className="flex flex-wrap gap-4">
                {section.slots.map((row) => (
                  <SlotCard
                    key={row.id}
                    row={row}
                    kindLabel={KIND_LABEL[row.kind]}
                    cardWidth={cardWidth}
                    aspectClass={aspectClass}
                    selected={selected.has(row.id)}
                    generating={isSlotGenerating(row.id)}
                    workspaceFrozen={workspaceFrozen}
                    onToggleSelect={() => toggleSelect(row.id)}
                    onEditPrompt={() => openEditPrompt(row.id)}
                    onViewPrompt={() => openViewPrompt(row.id)}
                    onPreview={() => openPreview(row)}
                    onDownload={() => {
                      if (!row.imageUrl) return;
                      downloadImageFile(
                        row.imageUrl,
                        `${KIND_LABEL[row.kind]}-${row.index}-${row.title}`,
                      );
                    }}
                    onGenerate={(regenerate) => void handleGenerateOne(row.id, regenerate)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {busy ? (
        <p className="mt-2 flex items-center gap-2 text-[11px] text-[#6e6e73]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          正在保存…
        </p>
      ) : null}

      {promptRow ? (
        <ProductDesignPromptDialog
          open={promptSlotId != null}
          onOpenChange={(open) => {
            if (!open) {
              setPromptSlotId(null);
              setPromptReadOnly(false);
            }
          }}
          value={promptRow.prompt}
          onCommit={(prompt) => {
            commitPrompt(promptRow.id, prompt);
            setPromptSlotId(null);
            setPromptReadOnly(false);
          }}
          disabled={promptReadOnly || workspaceFrozen || isSlotGenerating(promptRow.id)}
          title={
            promptReadOnly
              ? `查看 Prompt · ${promptRow.title}`
              : `编辑 Prompt · ${promptRow.title}`
          }
          subtitle={KIND_LABEL[promptRow.kind]}
          referenceImages={[]}
        />
      ) : null}

      <ProductDesignGalleryPreviewDialog
        items={galleryPreview?.items ?? []}
        initialIndex={galleryPreview?.initialIndex ?? 0}
        open={Boolean(galleryPreview?.items.length)}
        nativeOverlay
        onOpenChange={(open) => {
          if (!open) setGalleryPreview(null);
        }}
      />
    </section>
  );
}

function SlotCard({
  row,
  kindLabel,
  cardWidth,
  aspectClass,
  selected,
  generating,
  workspaceFrozen,
  onToggleSelect,
  onEditPrompt,
  onViewPrompt,
  onPreview,
  onDownload,
  onGenerate,
}: {
  row: ProductImageSetSlot;
  kindLabel: string;
  cardWidth: number;
  aspectClass: string;
  selected: boolean;
  generating: boolean;
  workspaceFrozen: boolean;
  onToggleSelect: () => void;
  onEditPrompt: () => void;
  onViewPrompt: () => void;
  onPreview: () => void;
  onDownload: () => void;
  onGenerate: (regenerate?: boolean) => void;
}) {
  const slotLocked = generating;
  const actionDisabled = workspaceFrozen || slotLocked;

  return (
    <article
      className={cn(
        "group relative isolate flex shrink-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition",
        generating && "ecom-media-generating-sweep border-[#0071e3]/40",
        !generating && selected
          ? "border-[var(--ecom-primary)] ring-2 ring-[#0071e3]/25"
          : !generating && "border-[#e8e8ed]",
      )}
      style={{ width: cardWidth }}
      onClick={(e) => {
        const t = e.target as HTMLElement;
        if (t.closest("button, input, label, textarea")) return;
        if (!workspaceFrozen && !slotLocked) onToggleSelect();
      }}
    >
      <div className="flex items-center gap-1.5 border-b border-[#f0f0f2] px-2 py-1.5">
        <input
          type="checkbox"
          className="rounded border-[#d2d2d7]"
          checked={selected}
          onChange={onToggleSelect}
          disabled={workspaceFrozen || slotLocked}
        />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[#1d1d1f]">
          {row.title}
        </span>
      </div>

      <div
        className={cn(
          "group/image relative w-full shrink-0 overflow-hidden bg-[#f5f5f7]",
          aspectClass,
        )}
      >
        <span className="absolute left-1.5 top-1.5 z-20 rounded bg-black/60 px-1 py-0.5 text-[9px] font-medium text-white">
          {kindLabel} {row.index}
        </span>

        {generating ? (
          <>
            {row.imageUrl ? (
              <Image
                src={row.imageUrl}
                alt=""
                fill
                className="object-contain object-center"
                sizes="(max-width: 1024px) 33vw, 280px"
                unoptimized
              />
            ) : null}
            <EcomMediaGeneratingBusy className="absolute inset-0" />
          </>
        ) : row.imageUrl ? (
          <>
            <Image
              src={row.imageUrl}
              alt=""
              fill
              className="object-contain object-center"
              sizes="(max-width: 1024px) 33vw, 280px"
              unoptimized
            />
            <div aria-hidden className={ECOM_SLOT_HOVER_OVERLAY_CLASS} />
            <div className={ECOM_SLOT_HOVER_ACTIONS_ROW_CLASS}>
              <button
                type="button"
                title="预览"
                disabled={actionDisabled}
                className={cn(ECOM_SLOT_HOVER_ACTION_BTN_CLASS, "pointer-events-auto")}
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview();
                }}
              >
                <Eye className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
              </button>
              <button
                type="button"
                title="重新生成"
                disabled={actionDisabled}
                className={cn(ECOM_SLOT_HOVER_ACTION_BTN_CLASS, "pointer-events-auto")}
                onClick={(e) => {
                  e.stopPropagation();
                  onGenerate(true);
                }}
              >
                <RefreshCw className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
              </button>
              <button
                type="button"
                title="下载"
                disabled={actionDisabled}
                className={cn(ECOM_SLOT_HOVER_ACTION_BTN_CLASS, "pointer-events-auto")}
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload();
                }}
              >
                <Download className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
              </button>
              <button
                type="button"
                title="查看 Prompt"
                disabled={workspaceFrozen}
                className={cn(ECOM_SLOT_HOVER_ACTION_BTN_CLASS, "pointer-events-auto")}
                onClick={(e) => {
                  e.stopPropagation();
                  onViewPrompt();
                }}
              >
                <FileText className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex h-full min-h-[8rem] flex-wrap items-center justify-center gap-1.5 px-1">
            <button
              type="button"
              title="编辑 Prompt"
              disabled={actionDisabled}
              className={ECOM_SLOT_HOVER_ACTION_BTN_CLASS}
              onClick={onEditPrompt}
            >
              <FileText className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
            </button>
            <button
              type="button"
              title="生成"
              disabled={actionDisabled}
              className={ECOM_SLOT_HOVER_ACTION_BTN_CLASS}
              onClick={() => onGenerate(false)}
            >
              <Sparkles className={ECOM_MEDIA_TILE_ACTION_ICON_CLASS} />
            </button>
          </div>
        )}
      </div>

      <p className="line-clamp-4 border-t border-[#f0f0f2] px-2 py-2 text-[10px] leading-snug text-[#6e6e73]">
        {row.prompt.trim() || "（空 Prompt）"}
      </p>
      {row.failMessage ? (
        <p className="border-t border-[#f0f0f2] px-2 py-1 text-[10px] text-red-600">
          {row.failMessage}
        </p>
      ) : null}
    </article>
  );
}
