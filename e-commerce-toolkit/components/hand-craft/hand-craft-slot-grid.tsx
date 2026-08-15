"use client";

import Image from "next/image";
import { Download, Eye, FileText, Loader2, RefreshCw, RotateCcw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { ProductDesignPromptDialog } from "@/components/product-design/product-design-prompt-dialog";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  patchHandCraftStepPrompts,
  resetHandCraftStepPrompts,
} from "@/lib/ecom-hand-craft-api";
import type { HandCraftProject, HandCraftSlot } from "@/lib/hand-craft-types";
import {
  missingRequirements,
  stepState,
  type HandCraftStepMeta,
} from "@/lib/hand-craft-workflow";
import {
  productDesignCssAspectRatio,
  productDesignRatioFrameClass,
} from "@/lib/product-design-ratio-display";
import { cn } from "@/lib/utils";

const SLOT_ICON_BTN =
  "flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-white/95 text-[#1d1d1f] ring-1 ring-black/10 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50";
const SLOT_ICON = "h-8 w-8";

type Props = {
  project: HandCraftProject;
  step: HandCraftStepMeta;
  disabled?: boolean;
  onProjectChange: () => void | Promise<void>;
  /** 触发出图：indexes 为空表示生成本步全部 */
  onGenerate: (indexes: number[]) => void | Promise<void>;
  slotGeneratingFor: (index: number) => boolean;
  onPreview?: (index: number) => void;
  onDownload?: (index: number) => void;
};

export function HandCraftSlotGrid({
  project,
  step,
  disabled,
  onProjectChange,
  onGenerate,
  slotGeneratingFor,
  onPreview,
  onDownload,
}: Props) {
  const { alert, confirm } = useDialogs();
  const state = stepState(project, step.id);
  const [rows, setRows] = useState<HandCraftSlot[]>(state.slots);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [promptDialogIndex, setPromptDialogIndex] = useState<number | null>(null);
  const [generateAllActive, setGenerateAllActive] = useState(false);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  useEffect(() => {
    setRows(stepState(project, step.id).slots);
    setSelected(new Set());
  }, [project, step.id]);

  const blocked = missingRequirements(project, step.id);
  const done = rows.filter((r) => r.imageUrl).length;
  const editedCount = rows.filter((r) => r.promptEdited).length;
  const workspaceDisabled = Boolean(disabled) || Boolean(busy) || blocked.length > 0;

  const selectedIndexes = useMemo(
    () => rows.filter((r) => selected.has(r.index)).map((r) => r.index),
    [rows, selected],
  );

  const promptDialogRow =
    promptDialogIndex != null ? rows.find((r) => r.index === promptDialogIndex) ?? null : null;

  const commitPrompt = useCallback(
    async (index: number, prompt: string) => {
      setBusy("正在保存 Prompt…");
      try {
        await patchHandCraftStepPrompts(project.id, step.id, [{ index, prompt }]);
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
    [alert, onProjectChange, project.id, step.id],
  );

  async function handleResetPrompts() {
    const ok = await confirm({
      title: `恢复第 ${step.no} 步默认说明`,
      message: "会把本步槽位说明恢复为 SOP 默认值；你手改过的条目会保留。",
      confirmLabel: "恢复默认",
    });
    if (!ok) return;
    setBusy("正在恢复默认说明…");
    try {
      await resetHandCraftStepPrompts(project.id, step.id);
      await onProjectChange();
    } catch (e) {
      await alert({
        title: "恢复失败",
        message: e instanceof Error ? e.message : "未知错误",
        variant: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleGenerateSelected() {
    if (blocked.length > 0) {
      await alert({
        title: "还不能生成",
        message: `请先完成：${blocked.join("、")}`,
        variant: "error",
      });
      return;
    }
    const isAll = selectedIndexes.length === 0;
    const indexes = isAll
      ? rowsRef.current.length > 0
        ? rowsRef.current.map((r) => r.index)
        : Array.from({ length: step.count }, (_, i) => i + 1)
      : selectedIndexes;
    if (indexes.length === 0) return;
    if (isAll) setGenerateAllActive(true);
    try {
      await onGenerate(indexes);
    } finally {
      setGenerateAllActive(false);
    }
  }

  return (
    <section
      id={`hand-craft-step-${step.id}`}
      className="scroll-mt-20 rounded-xl border border-[#e8e8ed] bg-[#fafafa] px-4 py-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#1d1d1f]">
            第 {step.no} 步 · {step.label}
          </h3>
          <p className="mt-0.5 text-[11px] text-[#6e6e73]">
            {step.summary} · {step.ratio}
            <span className="ml-1">
              已出 {done}/{rows.length || step.count}
            </span>
            {editedCount > 0 ? (
              <span className="ml-1 text-[#1d1d1f]">· 已手改 {editedCount} 条</span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <EcomButtonSecondary
            size="sm"
            type="button"
            disabled={workspaceDisabled}
            onClick={() => void handleResetPrompts()}
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
            恢复默认说明
          </EcomButtonSecondary>
          <EcomButtonPrimary
            size="sm"
            type="button"
            disabled={workspaceDisabled || generateAllActive}
            onClick={() => void handleGenerateSelected()}
          >
            {selectedIndexes.length > 0
              ? `生成选中 (${selectedIndexes.length})`
              : `生成全部 (${rows.length || step.count})`}
          </EcomButtonPrimary>
        </div>
      </div>

      {blocked.length > 0 ? (
        <p className="mb-3 rounded-lg border border-[#ffd8a8] bg-[#fff8f0] px-3 py-2 text-[11px] text-[#8a5a00]">
          本步依赖尚未齐备：{blocked.join("、")}。完成后本步按钮才会解锁。
        </p>
      ) : null}

      {step.id !== "hero" && !project.meta?.workflow?.heroLockedUrl ? (
        <p className="mb-3 rounded-lg border border-[#ffd8a8] bg-[#fff8f0] px-3 py-2 text-[11px] text-[#8a5a00]">
          第 1 步主形象尚未定稿。后续每步都要以它为参考图锁定五官与配饰。
        </p>
      ) : null}

      {rows.length > 1 ? (
        <div className="mb-2 flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[#6e6e73]">
            <input
              type="checkbox"
              className="rounded border-[#d2d2d7]"
              checked={selected.size === rows.length && rows.length > 0}
              disabled={workspaceDisabled}
              onChange={() =>
                setSelected((prev) =>
                  prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.index)),
                )
              }
            />
            全选
          </label>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => {
          const generating = slotGeneratingFor(row.index);
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
                  disabled={workspaceDisabled || rowLocked}
                  onChange={() =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(row.index)) next.delete(row.index);
                      else next.add(row.index);
                      return next;
                    })
                  }
                />
                <span className="shrink-0 text-[10px] font-semibold text-[#86868b]">
                  #{row.index}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[#1d1d1f]">
                  {row.title}
                </span>
              </div>

              <HandCraftSlotPreview
                ratio={step.ratio}
                label={step.label}
                index={row.index}
                imageUrl={row.imageUrl}
                generating={generating}
                disabled={workspaceDisabled || rowLocked}
                onEditPrompt={() => setPromptDialogIndex(row.index)}
                onGenerate={() => void onGenerate([row.index])}
                onPreview={onPreview ? () => onPreview(row.index) : undefined}
                onDownload={onDownload ? () => onDownload(row.index) : undefined}
              />

              {row.promptEdited ? (
                <p className="border-t border-[#f0f0f2] px-2.5 py-1 text-[10px] text-[#86868b]">
                  已手改说明
                </p>
              ) : null}
            </article>
          );
        })}
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
          onCommit={(prompt) => void commitPrompt(promptDialogRow.index, prompt)}
          disabled={workspaceDisabled || slotGeneratingFor(promptDialogRow.index)}
          title={`编辑 ${step.label} #${promptDialogRow.index} 画面说明`}
          subtitle={`${promptDialogRow.title}｜只写本槽差异，基准风格串由系统自动拼接`}
        />
      ) : null}
    </section>
  );
}

function HandCraftSlotPreview({
  ratio,
  label,
  index,
  imageUrl,
  generating,
  disabled,
  onEditPrompt,
  onGenerate,
  onPreview,
  onDownload,
}: {
  ratio: string;
  label: string;
  index: number;
  imageUrl?: string;
  generating?: boolean;
  disabled?: boolean;
  onEditPrompt: () => void;
  onGenerate: () => void;
  onPreview?: () => void;
  onDownload?: () => void;
}) {
  const actionDisabled = Boolean(disabled) || Boolean(generating);

  return (
    <div
      className={cn("group/image relative w-full shrink-0 overflow-hidden bg-[#f5f5f7]", productDesignRatioFrameClass(ratio))}
      style={{ aspectRatio: productDesignCssAspectRatio(ratio) }}
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
              title="编辑画面说明"
              disabled={actionDisabled}
              className={cn(SLOT_ICON_BTN, "pointer-events-auto")}
              onClick={onEditPrompt}
            >
              <FileText className={SLOT_ICON} />
            </button>
          </div>
        </>
      ) : (
        <div className="flex h-full min-h-[6rem] items-center justify-center gap-5 sm:gap-6">
          <button
            type="button"
            title="编辑画面说明"
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
