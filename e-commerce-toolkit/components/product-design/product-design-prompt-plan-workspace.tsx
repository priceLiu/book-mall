"use client";

import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { ProductDesignPromptExpandableTextarea } from "@/components/product-design/product-design-prompt-expandable-textarea";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  confirmProductDesignImagePlan,
  decomposeProductDesignImagePlan,
  deriveProductDesignImagePlan,
  patchProductDesignImagePlan,
} from "@/lib/ecom-product-design-api";
import type {
  ImageGenPlan,
  ImageGenPlanItem,
  ProductContext,
  ProductDesignProject,
} from "@/lib/product-design-types";
import { cn } from "@/lib/utils";

type Props = {
  project: ProductDesignProject;
  target: "main" | "detail";
  visionModelKey?: string;
  disabled?: boolean;
  onProjectChange: () => void | Promise<void>;
  onConfirmed?: () => void;
  /** 拆解路径：由父级打开视觉模型弹窗并调用 decompose API */
  onRequestAnalyze?: () => void | Promise<void>;
  /** 拆解/生成草稿前的用户意图（参考图路径） */
  intentPrompt?: string;
  decomposeSource?: "reference-decompose" | "reference-intent";
  mode: "decompose" | "derive";
  title?: string;
};

function emptyItem(index: number): ImageGenPlanItem {
  return {
    index,
    title: `第 ${index} 张`,
    purpose: "",
    prompt: "",
  };
}

export function ProductDesignPromptPlanWorkspace({
  project,
  target,
  visionModelKey,
  disabled,
  onProjectChange,
  onConfirmed,
  onRequestAnalyze,
  intentPrompt,
  decomposeSource,
  mode,
  title,
}: Props) {
  const { alert, confirm } = useDialogs();
  const plan = project.design?.imageGenPlans?.[target] ?? null;
  const [busy, setBusy] = useState<string | null>(null);
  const [productContext, setProductContext] = useState<ProductContext>(
    plan?.productContext ?? {},
  );
  const [items, setItems] = useState<ImageGenPlanItem[]>(plan?.items ?? []);
  const [sharedVisualBrief, setSharedVisualBrief] = useState(
    plan?.sharedVisualBrief ?? "",
  );

  useEffect(() => {
    const p = project.design?.imageGenPlans?.[target];
    if (p) {
      setProductContext(p.productContext ?? {});
      setItems(p.items);
      setSharedVisualBrief(p.sharedVisualBrief ?? "");
    }
  }, [project.design?.imageGenPlans, target, project.id]);

  const label = target === "main" ? "主图" : "详情屏";
  const designSlots =
    (target === "main" ? project.design?.mainImages : project.design?.detailPages) ?? [];
  const editedPromptCount = designSlots.filter(
    (s) => s.promptEdited && s.genPrompt?.trim(),
  ).length;
  const sectionTitle = title ?? `${label} · Prompt 计划`;

  const runDecomposeOrDerive = useCallback(async () => {
    if (mode === "decompose" && onRequestAnalyze) {
      await onRequestAnalyze();
      return;
    }
    setBusy(mode === "decompose" ? "正在拆解参考图…" : "正在从文案生成草稿…");
    try {
      if (mode === "decompose") {
        await decomposeProductDesignImagePlan(project.id, {
          target,
          modelKey: visionModelKey,
          intentPrompt: intentPrompt?.trim() || undefined,
          source: decomposeSource,
        });
      } else {
        await deriveProductDesignImagePlan(project.id, { target });
      }
      await onProjectChange();
    } catch (e) {
      await alert({
        title: mode === "decompose" ? "拆解失败" : "生成草稿失败",
        message: e instanceof Error ? e.message : "未知错误",
        variant: "error",
      });
    } finally {
      setBusy(null);
    }
  }, [
    mode,
    onRequestAnalyze,
    project.id,
    target,
    visionModelKey,
    intentPrompt,
    decomposeSource,
    onProjectChange,
    alert,
  ]);

  const saveDraft = useCallback(async () => {
    const validItems = items.filter((i) => i.prompt.trim());
    if (validItems.length === 0) {
      await alert({
        title: "无法保存",
        message: "至少需要 1 条非空生图 Prompt。",
        variant: "error",
      });
      return;
    }
    setBusy("正在保存…");
    try {
      await patchProductDesignImagePlan(project.id, {
        target,
        productContext,
        sharedVisualBrief: sharedVisualBrief.trim() || undefined,
        items: validItems.map((item, i) => ({
          ...item,
          index: i + 1,
          title: item.title.trim() || `第 ${i + 1} 张`,
          prompt: item.prompt.trim(),
        })),
      });
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
  }, [
    items,
    productContext,
    sharedVisualBrief,
    project.id,
    target,
    onProjectChange,
    alert,
  ]);

  const handleConfirm = useCallback(async () => {
    const ok = await confirm({
      title: `确认 ${items.length} 条${label} Prompt`,
      message: `确认后将锁定 Prompt 并创建 ${items.length} 个出图槽位。之后可直接出图；如需大改请重新拆解或生成草稿。`,
    });
    if (!ok) return;

    setBusy("正在确认计划…");
    try {
      await saveDraft();
      await confirmProductDesignImagePlan(project.id, { target });
      await onProjectChange();
      onConfirmed?.();
    } catch (e) {
      await alert({
        title: "确认失败",
        message: e instanceof Error ? e.message : "未知错误",
        variant: "error",
      });
    } finally {
      setBusy(null);
    }
  }, [
    confirm,
    items.length,
    label,
    saveDraft,
    project.id,
    target,
    onProjectChange,
    onConfirmed,
    alert,
  ]);

  const updateItem = (index: number, patch: Partial<ImageGenPlanItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.index === index ? { ...item, ...patch } : item)),
    );
  };

  const removeItem = (index: number) => {
    setItems((prev) =>
      reindexItems(prev.filter((item) => item.index !== index)),
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, emptyItem(prev.length + 1)]);
  };

  function reindexItems(list: ImageGenPlanItem[]): ImageGenPlanItem[] {
    return list.map((item, i) => ({ ...item, index: i + 1 }));
  }

  const confirmed = plan?.status === "confirmed";

  return (
    <section
      id={target === "main" ? "pdt-prompt-plan-main" : "pdt-prompt-plan-detail"}
      className="scroll-mt-20 rounded-xl border border-[#e8e8ed] bg-[#fafafa] px-4 py-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#1d1d1f]">{sectionTitle}</h3>
          <p className="mt-0.5 text-[11px] text-[#6e6e73]">
            出图前须在此确认 N 条生图 Prompt（N = 列表长度，无需预先选张数）。
            {confirmed ? (
              <span className="ml-1 font-medium text-emerald-700">已确认</span>
            ) : (
              <span className="ml-1 font-medium text-amber-700">草稿</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!confirmed ? (
            <>
              {plan && editedPromptCount > 0 ? (
                <span className="text-[11px] text-[#86868b]">
                  已手改的 {editedPromptCount} 条将保留
                </span>
              ) : null}
              <EcomButtonSecondary
                size="sm"
                type="button"
                disabled={Boolean(disabled) || Boolean(busy)}
                onClick={() => void runDecomposeOrDerive()}
              >
                {busy?.includes("拆解") || busy?.includes("草稿") ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                )}
                {mode === "decompose"
                  ? plan
                    ? "重新分析"
                    : "分析"
                  : plan
                    ? "重新生成草稿"
                    : "从文案生成草稿"}
              </EcomButtonSecondary>
              {plan ? (
                <EcomButtonSecondary
                  size="sm"
                  type="button"
                  disabled={Boolean(disabled) || Boolean(busy)}
                  onClick={() => void saveDraft()}
                >
                  保存修改
                </EcomButtonSecondary>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {!plan && !busy ? (
        <p className="mb-3 text-[11px] text-[#86868b]">
          {mode === "decompose"
            ? "上传参考图并（可选）填写意图后，点击「分析」：先选视觉模型，再生成 Prompt 列表。"
            : "完成 Step 文案后，点击「从文案生成草稿」生成 Prompt 列表。"}
        </p>
      ) : null}

      {plan || items.length > 0 ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-[#e8e8ed] bg-white p-3">
            <p className="mb-2 text-[11px] font-semibold text-[#1d1d1f]">产品理解（可编辑）</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className="rounded-lg border border-[#e8e8ed] px-2.5 py-1.5 text-[12px]"
                placeholder="产品名"
                value={productContext.productName ?? ""}
                disabled={confirmed || Boolean(disabled) || Boolean(busy)}
                onChange={(e) =>
                  setProductContext((p) => ({ ...p, productName: e.target.value }))
                }
              />
              <input
                className="rounded-lg border border-[#e8e8ed] px-2.5 py-1.5 text-[12px]"
                placeholder="品类"
                value={productContext.productCategory ?? ""}
                disabled={confirmed || Boolean(disabled) || Boolean(busy)}
                onChange={(e) =>
                  setProductContext((p) => ({ ...p, productCategory: e.target.value }))
                }
              />
            </div>
            <textarea
              className="mt-2 min-h-[3rem] w-full rounded-lg border border-[#e8e8ed] px-2.5 py-1.5 text-[12px]"
              placeholder="卖点（换行分隔）"
              value={(productContext.sellingPoints ?? []).join("\n")}
              disabled={confirmed || Boolean(disabled) || Boolean(busy)}
              onChange={(e) =>
                setProductContext((p) => ({
                  ...p,
                  sellingPoints: e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
            />
            <textarea
              className="mt-2 min-h-[2.5rem] w-full rounded-lg border border-[#e8e8ed] px-2.5 py-1.5 text-[12px]"
              placeholder="描述 / 视觉调性"
              value={[productContext.description, productContext.visualTone]
                .filter(Boolean)
                .join("\n")}
              disabled={confirmed || Boolean(disabled) || Boolean(busy)}
              onChange={(e) => {
                const lines = e.target.value.split("\n");
                setProductContext((p) => ({
                  ...p,
                  description: lines[0] ?? "",
                  visualTone: lines.slice(1).join("\n") || p.visualTone,
                }));
              }}
            />
          </div>

          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-[#1d1d1f]">
              生图 Prompt（{items.length} 条）
            </p>
            {items.map((item) => (
              <div
                key={item.index}
                className="rounded-lg border border-[#e8e8ed] bg-white p-3"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-[#86868b]">
                    #{item.index}
                  </span>
                  <input
                    className="flex-1 rounded border border-[#e8e8ed] px-2 py-1 text-[12px] font-medium"
                    value={item.title}
                    disabled={confirmed || Boolean(disabled) || Boolean(busy)}
                    onChange={(e) => updateItem(item.index, { title: e.target.value })}
                  />
                  {!confirmed && items.length > 1 ? (
                    <button
                      type="button"
                      className="rounded p-1 text-[#86868b] hover:bg-[#f5f5f7] hover:text-red-600"
                      disabled={Boolean(disabled) || Boolean(busy)}
                      onClick={() => removeItem(item.index)}
                      aria-label="删除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
                {item.purpose ? (
                  <p className="mb-1.5 text-[10px] text-[#86868b]">{item.purpose}</p>
                ) : null}
                <ProductDesignPromptExpandableTextarea
                  className={cn("text-[11px]", confirmed && "bg-[#f5f5f7]")}
                  value={item.prompt}
                  disabled={confirmed || Boolean(disabled) || Boolean(busy)}
                  title={`编辑 ${label} #${item.index} Prompt`}
                  subtitle={item.title}
                  onChange={(prompt) => updateItem(item.index, { prompt })}
                />
              </div>
            ))}
            {!confirmed ? (
              <button
                type="button"
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#d2d2d7] py-2 text-[11px] text-[#6e6e73] hover:border-[var(--ecom-chrome-accent)] hover:text-[#1d1d1f]"
                disabled={Boolean(disabled) || Boolean(busy)}
                onClick={addItem}
              >
                <Plus className="h-3.5 w-3.5" />
                增加一张
              </button>
            ) : null}
          </div>

          {!confirmed ? (
            <EcomButtonPrimary
              size="sm"
              type="button"
              disabled={Boolean(disabled) || Boolean(busy) || items.every((i) => !i.prompt.trim())}
              onClick={() => void handleConfirm()}
            >
              确认计划并开始出图
            </EcomButtonPrimary>
          ) : null}
        </div>
      ) : null}

      {busy ? (
        <p className="mt-2 flex items-center gap-2 text-[11px] text-[#6e6e73]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {busy}
        </p>
      ) : null}
    </section>
  );
}
