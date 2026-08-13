"use client";

import Image from "next/image";
import {
  Download,
  Eye,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Video,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { ProductDesignPromptDialog } from "@/components/product-design/product-design-prompt-dialog";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  deriveProductDesignImagePlan,
  patchProductDesignImagePlan,
} from "@/lib/ecom-product-design-api";
import type {
  ImageGenPlanItem,
  ProductDesignDetailPage,
  ProductDesignMainImage,
  ProductDesignProject,
} from "@/lib/product-design-types";
import { getImageGenPlan } from "@/lib/product-design-workflow";
import {
  productDesignCssAspectRatio,
  productDesignRatioFrameClass,
} from "@/lib/product-design-ratio-display";
import { cn } from "@/lib/utils";

export type GenSlotRow = {
  index: number;
  title: string;
  purpose?: string;
  prompt: string;
  imageUrl?: string;
  assetId?: string;
  /** 用户手改过 Prompt：重新拆解时会被保留 */
  promptEdited?: boolean;
};

type Props = {
  project: ProductDesignProject;
  target: "main" | "detail";
  ratio: string;
  title: string;
  disabled?: boolean;
  mode: "decompose" | "derive";
  onProjectChange: () => void | Promise<void>;
  onRequestAnalyze?: () => void | Promise<void>;
  onGenerate: (indexes: number[]) => void | Promise<void>;
  cardGeneratingFor: (index: number) => boolean;
  beforeSlots?: React.ReactNode;
  onPreview?: (index: number) => void;
  onDownload?: (index: number) => void;
  onGoToVideo?: (index: number) => void;
};

function mergeGenSlots(project: ProductDesignProject, target: "main" | "detail"): GenSlotRow[] {
  const design = project.design;
  if (!design) return [];

  const plan = getImageGenPlan(project, target);
  const slots =
    target === "main" ? design.mainImages : design.detailPages;

  if (plan?.items.length) {
    return plan.items.map((item) => {
      const slot = slots.find((s) => s.index === item.index);
      return {
        index: item.index,
        title: item.title,
        purpose: item.purpose,
        prompt: item.prompt,
        imageUrl: slot?.imageUrl,
        assetId: slot?.assetId,
        promptEdited: slot?.promptEdited,
      };
    });
  }

  return slots.map((slot) => {
    if (target === "main") {
      const m = slot as ProductDesignMainImage;
      return {
        index: m.index,
        title: m.layers?.title || `主图 ${m.index}`,
        purpose: m.purpose,
        prompt: m.genPrompt ?? "",
        imageUrl: m.imageUrl,
        assetId: m.assetId,
        promptEdited: m.promptEdited,
      };
    }
    const d = slot as ProductDesignDetailPage;
    return {
      index: d.index,
      title: d.title || `详情 ${d.index}`,
      purpose: d.purpose,
      prompt: d.genPrompt ?? "",
      imageUrl: d.imageUrl,
      assetId: d.assetId,
      promptEdited: d.promptEdited,
    };
  });
}

function emptyPlanItem(index: number, target: "main" | "detail"): ImageGenPlanItem {
  return {
    index,
    title: target === "main" ? `主图 ${index}` : `详情 ${index}`,
    purpose: "",
    prompt: "",
  };
}

const SLOT_ICON_BTN =
  "flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-white/95 text-[#1d1d1f] ring-1 ring-black/10 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50";
const SLOT_ICON = "h-8 w-8";

export function ProductDesignGenSlotWorkspace({
  project,
  target,
  ratio,
  title,
  disabled,
  mode,
  onProjectChange,
  onRequestAnalyze,
  onGenerate,
  cardGeneratingFor,
  beforeSlots,
  onPreview,
  onDownload,
  onGoToVideo,
}: Props) {
  const { alert, doubleConfirm } = useDialogs();
  const [busy, setBusy] = useState<string | null>(null);
  const [rows, setRows] = useState<GenSlotRow[]>(() => mergeGenSlots(project, target));
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [promptDialogIndex, setPromptDialogIndex] = useState<number | null>(null);
  const [generateAllActive, setGenerateAllActive] = useState(false);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  useEffect(() => {
    setRows(mergeGenSlots(project, target));
  }, [project, target, project.design?.imageGenPlans, project.design?.mainImages, project.design?.detailPages]);

  const label = target === "main" ? "主图" : "详情屏";
  const doneCount = rows.filter((r) => r.imageUrl).length;
  const editedCount = rows.filter((r) => r.promptEdited).length;
  const promptDialogRow =
    promptDialogIndex != null
      ? rows.find((r) => r.index === promptDialogIndex) ?? null
      : null;

  const saveRows = useCallback(
    async (nextRows: GenSlotRow[]) => {
      const items: ImageGenPlanItem[] = nextRows.map((row, i) => ({
        index: i + 1,
        title: row.title.trim() || `${label} ${i + 1}`,
        purpose: row.purpose?.trim() || undefined,
        prompt: row.prompt,
      }));
      setBusy("正在保存…");
      try {
        await patchProductDesignImagePlan(project.id, { target, items });
        await onProjectChange();
      } catch (e) {
        await alert({
          title: "保存失败",
          message: e instanceof Error ? e.message : "未知错误",
          variant: "error",
        });
      } finally {
        setBusy(null);
      }
    },
    [alert, label, onProjectChange, project.id, target],
  );

  const runDerive = useCallback(async () => {
    setBusy("正在从文案生成 Prompt…");
    try {
      await deriveProductDesignImagePlan(project.id, { target });
      await onProjectChange();
    } catch (e) {
      await alert({
        title: "生成草稿失败",
        message: e instanceof Error ? e.message : "未知错误",
        variant: "error",
      });
    } finally {
      setBusy(null);
    }
  }, [alert, onProjectChange, project.id, target]);

  const handleAnalyze = useCallback(async () => {
    if (onRequestAnalyze) {
      await onRequestAnalyze();
      return;
    }
    await runDerive();
  }, [onRequestAnalyze, runDerive]);

  const toggleSelect = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.index)));
    }
  };

  const selectedIndexes = useMemo(
    () => rows.filter((r) => selected.has(r.index)).map((r) => r.index),
    [rows, selected],
  );

  const handleGenerateSelected = async () => {
    const current = rowsRef.current;
    const isGenerateAll = selectedIndexes.length === 0;
    const indexes =
      selectedIndexes.length > 0
        ? selectedIndexes
        : current.filter((r) => r.prompt.trim()).map((r) => r.index);
    if (indexes.length === 0) {
      await alert({
        title: "无法出图",
        message: "请至少填写 1 条生图 Prompt，或勾选要生成的条目。",
        variant: "error",
      });
      return;
    }
    await saveRows(current);
    if (isGenerateAll) setGenerateAllActive(true);
    try {
      await onGenerate(indexes);
    } finally {
      setGenerateAllActive(false);
    }
  };

  const handleGenerateOne = async (index: number) => {
    const row = rowsRef.current.find((r) => r.index === index);
    if (!row?.prompt.trim()) {
      await alert({
        title: "无法出图",
        message: "请先填写本条生图 Prompt。",
        variant: "error",
      });
      return;
    }
    await saveRows(rowsRef.current);
    await onGenerate([index]);
  };

  const updateRow = (index: number, patch: Partial<GenSlotRow>) => {
    setRows((prev) =>
      prev.map((row) => (row.index === index ? { ...row, ...patch } : row)),
    );
  };

  const commitPrompt = (index: number, prompt: string) => {
    const next = rowsRef.current.map((row) =>
      row.index === index ? { ...row, prompt, promptEdited: true } : row,
    );
    setRows(next);
    void saveRows(next);
  };

  const removeRow = async (index: number) => {
    if (rows.length <= 1) {
      await alert({
        title: "无法删除",
        message: "至少需要保留 1 个槽位。",
        variant: "error",
      });
      return;
    }
    const row = rows.find((r) => r.index === index);
    const ok = await doubleConfirm({
      title: `删除${label} #${index}`,
      message: `将删除「${row?.title ?? index}」的 Prompt 与占位。`,
      secondTitle: "不可恢复",
      secondMessage: row?.imageUrl
        ? "删除后槽位与 Prompt 不可恢复；已出图文件仍在资产库中。"
        : "删除后槽位与 Prompt 不可恢复。",
    });
    if (!ok) return;
    const next = rows
      .filter((r) => r.index !== index)
      .map((r, i) => ({ ...r, index: i + 1 }));
    setRows(next);
    await saveRows(next);
  };

  const workspaceDisabled = Boolean(disabled) || Boolean(busy);

  return (
    <section
      id={target === "main" ? "pdt-gen-slots-main" : "pdt-gen-slots-detail"}
      className="scroll-mt-20 rounded-xl border border-[#e8e8ed] bg-[#fafafa] px-4 py-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#1d1d1f]">{title}</h3>
          <p className="mt-0.5 text-[11px] text-[#6e6e73]">
            点击槽位内图标编辑 Prompt 或出图；悬停已出图可预览、下载与重新生成。
            {rows.length > 0 ? (
              <span className="ml-1">
                已出 {doneCount}/{rows.length}
              </span>
            ) : null}
            {editedCount > 0 ? (
              <span className="ml-1 text-[#1d1d1f]">
                · 已手改 {editedCount} 条，重新分析时保留
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <EcomButtonSecondary
            size="sm"
            type="button"
            disabled={workspaceDisabled}
            onClick={() => void handleAnalyze()}
          >
            {busy?.includes("Prompt") || busy?.includes("拆解") ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
            )}
            {rows.length > 0
              ? mode === "decompose"
                ? "重新分析"
                : "重新生成草稿"
              : mode === "decompose"
                ? "分析"
                : "从文案生成草稿"}
          </EcomButtonSecondary>
          {rows.length > 0 ? (
            <EcomButtonPrimary
              size="sm"
              type="button"
              disabled={workspaceDisabled}
              onClick={() => void handleGenerateSelected()}
            >
              {selectedIndexes.length > 0
                ? `生成选中 (${selectedIndexes.length})`
                : "生成全部"}
            </EcomButtonPrimary>
          ) : null}
        </div>
      </div>

      {beforeSlots}

      {rows.length === 0 && !busy ? (
        <p className="mb-3 text-[11px] text-[#86868b]">
          {mode === "decompose"
            ? "上传参考图并（可选）填写意图后，点击「分析」生成 Prompt 与占位。"
            : "完成 Step 文案后，点击「从文案生成草稿」。"}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <div className="mb-2 flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[#6e6e73]">
            <input
              type="checkbox"
              className="rounded border-[#d2d2d7]"
              checked={selected.size === rows.length && rows.length > 0}
              onChange={toggleSelectAll}
              disabled={workspaceDisabled}
            />
            全选
          </label>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => {
          const generating = cardGeneratingFor(row.index);
          const rowLocked = generating || generateAllActive;
          return (
            <article
              key={row.index}
              className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#e8e8ed] bg-white"
            >
              <div className="flex items-center gap-1.5 border-b border-[#f0f0f2] px-2.5 py-1.5">
                <input
                  type="checkbox"
                  className="rounded border-[#d2d2d7]"
                  checked={selected.has(row.index)}
                  onChange={() => toggleSelect(row.index)}
                  disabled={workspaceDisabled || rowLocked}
                />
                <span className="shrink-0 text-[10px] font-semibold text-[#86868b]">
                  #{row.index}
                </span>
                <input
                  className="min-w-0 flex-1 rounded border border-[#e8e8ed] px-1.5 py-0.5 text-[11px] font-medium"
                  value={row.title}
                  disabled={workspaceDisabled || rowLocked}
                  onChange={(e) => updateRow(row.index, { title: e.target.value })}
                  onBlur={() => void saveRows(rowsRef.current)}
                />
                {rows.length > 1 ? (
                  <button
                    type="button"
                    className="shrink-0 rounded p-0.5 text-[#86868b] hover:bg-[#f5f5f7] hover:text-red-600"
                    disabled={workspaceDisabled || rowLocked}
                    onClick={() => void removeRow(row.index)}
                    aria-label="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              {row.purpose ? (
                <p className="line-clamp-2 border-b border-[#f0f0f2] px-2.5 py-1 text-[10px] leading-snug text-[#86868b]">
                  {row.purpose}
                </p>
              ) : null}

              <GenSlotPreview
                ratio={ratio}
                label={label}
                index={row.index}
                imageUrl={row.imageUrl}
                generating={generating}
                disabled={rowLocked}
                showVideo={target === "main" && Boolean(row.assetId && onGoToVideo)}
                onEditPrompt={() => setPromptDialogIndex(row.index)}
                onGenerate={() => void handleGenerateOne(row.index)}
                onPreview={onPreview ? () => onPreview(row.index) : undefined}
                onDownload={onDownload ? () => onDownload(row.index) : undefined}
                onGoToVideo={
                  onGoToVideo && row.assetId ? () => onGoToVideo(row.index) : undefined
                }
              />

              {row.promptEdited ? (
                <p className="border-t border-[#f0f0f2] px-2.5 py-1 text-[10px] text-[#86868b]">
                  已手改 Prompt
                </p>
              ) : null}
            </article>
          );
        })}

        <button
          type="button"
          className="col-span-full flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#d2d2d7] py-2.5 text-[11px] text-[#6e6e73] hover:border-[var(--ecom-chrome-accent)] hover:text-[#1d1d1f]"
          disabled={workspaceDisabled}
          onClick={async () => {
            const nextIndex =
              rowsRef.current.length > 0
                ? Math.max(...rowsRef.current.map((r) => r.index)) + 1
                : 1;
            const next = [
              ...rowsRef.current,
              {
                index: nextIndex,
                title: emptyPlanItem(nextIndex, target).title,
                purpose: "",
                prompt: "",
              },
            ];
            setRows(next);
            await saveRows(next);
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          增加一张
        </button>
      </div>

      {busy ? (
        <p className="mt-2 flex items-center gap-2 text-[11px] text-[#6e6e73]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {busy}
        </p>
      ) : null}

      {promptDialogRow ? (
        <ProductDesignPromptDialog
          open={promptDialogIndex != null}
          onOpenChange={(open) => {
            if (!open) setPromptDialogIndex(null);
          }}
          value={promptDialogRow.prompt}
          onCommit={(prompt) => commitPrompt(promptDialogRow.index, prompt)}
          disabled={
            workspaceDisabled ||
            (promptDialogRow ? cardGeneratingFor(promptDialogRow.index) : false)
          }
          title={`编辑 ${label} #${promptDialogRow.index} Prompt`}
          subtitle={promptDialogRow.title}
        />
      ) : null}
    </section>
  );
}

function GenSlotPreview({
  ratio,
  label,
  index,
  imageUrl,
  generating,
  disabled,
  showVideo,
  onEditPrompt,
  onGenerate,
  onPreview,
  onDownload,
  onGoToVideo,
}: {
  ratio: string;
  label: string;
  index: number;
  imageUrl?: string;
  generating?: boolean;
  disabled?: boolean;
  showVideo?: boolean;
  onEditPrompt: () => void;
  onGenerate: () => void;
  onPreview?: () => void;
  onDownload?: () => void;
  onGoToVideo?: () => void;
}) {
  const frameClass = productDesignRatioFrameClass(ratio);
  const aspectStyle = { aspectRatio: productDesignCssAspectRatio(ratio) };
  const actionDisabled = Boolean(disabled) || Boolean(generating);

  return (
    <div
      className={cn(
        "group/image relative w-full shrink-0 overflow-hidden bg-[#f5f5f7]",
        frameClass,
      )}
      style={aspectStyle}
    >
      <span className="absolute left-1.5 top-1.5 z-20 rounded bg-black/60 px-1 py-0.5 text-[9px] font-medium text-white">
        {label} {index}
      </span>

      {generating ? (
        <>
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={`${label} ${index}`}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 33vw, 280px"
              unoptimized
            />
          ) : null}
          <EcomMediaGeneratingBusy className="absolute inset-0" />
        </>
      ) : imageUrl ? (
        <>
          <Image
            src={imageUrl}
            alt={`${label} ${index}`}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 33vw, 280px"
            unoptimized
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 bg-black/45 opacity-0 transition-opacity duration-150 group-hover/image:opacity-100"
          />
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center gap-3 opacity-0 transition-opacity duration-150 group-hover/image:opacity-100 sm:gap-4">
            {onPreview ? (
              <button
                type="button"
                title="预览"
                disabled={actionDisabled}
                className={cn(SLOT_ICON_BTN, "pointer-events-auto")}
                onClick={onPreview}
              >
                <Eye className={SLOT_ICON} />
              </button>
            ) : null}
            <button
              type="button"
              title="重新生成"
              disabled={actionDisabled}
              className={cn(SLOT_ICON_BTN, "pointer-events-auto")}
              onClick={onGenerate}
            >
              <RefreshCw className={SLOT_ICON} />
            </button>
            {onDownload ? (
              <button
                type="button"
                title="下载"
                disabled={actionDisabled}
                className={cn(SLOT_ICON_BTN, "pointer-events-auto")}
                onClick={onDownload}
              >
                <Download className={SLOT_ICON} />
              </button>
            ) : null}
            <button
              type="button"
              title="编辑 Prompt"
              disabled={actionDisabled}
              className={cn(SLOT_ICON_BTN, "pointer-events-auto")}
              onClick={onEditPrompt}
            >
              <FileText className={SLOT_ICON} />
            </button>
            {showVideo && onGoToVideo ? (
              <button
                type="button"
                title="去做视频"
                disabled={actionDisabled}
                className={cn(SLOT_ICON_BTN, "pointer-events-auto")}
                onClick={onGoToVideo}
              >
                <Video className={SLOT_ICON} />
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <div className="flex h-full min-h-[6rem] items-center justify-center gap-5 sm:gap-6">
          <button
            type="button"
            title="编辑 Prompt"
            disabled={actionDisabled}
            className={SLOT_ICON_BTN}
            onClick={onEditPrompt}
          >
            <FileText className={SLOT_ICON} />
          </button>
          <button
            type="button"
            title="生成"
            disabled={actionDisabled}
            className={SLOT_ICON_BTN}
            onClick={onGenerate}
          >
            <Sparkles className={SLOT_ICON} />
          </button>
        </div>
      )}
    </div>
  );
}
