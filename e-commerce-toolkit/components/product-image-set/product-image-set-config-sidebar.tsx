"use client";

import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Cpu,
  LayoutGrid,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { EcomSellpointFivePartHint } from "@/components/media/ecom-sellpoint-five-part-hint";
import { ProductImageSetLayoutPickerDialog } from "@/components/product-image-set/product-image-set-layout-picker-dialog";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { fetchEcomStylePresets } from "@/lib/ecom-style-preset-api";
import type { EcomStylePreset } from "@/lib/ecom-style-preset-types";
import {
  suggestProductImageSetBrief,
  updateProductImageSetProject,
} from "@/lib/ecom-product-image-set-api";
import { ECOM_SELLPOINT_FIVE_PART_PLACEHOLDER } from "@/lib/ecom-sellpoint-five-part";
import type { ProductImageSetProject } from "@/lib/product-image-set-types";
import {
  formatProductImageSetElapsed,
  productImageSetGenerateBusyDetail,
  productImageSetPlanBusyDetail,
} from "@/lib/product-image-set-busy";
import {
  LANGUAGE_OPTIONS,
  MARKET_OPTIONS,
  PLATFORM_OPTIONS,
  RATIO_OPTIONS,
  totalStructureCount,
} from "@/lib/product-image-set-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

type Props = {
  project: ProductImageSetProject;
  disabled?: boolean;
  planning?: boolean;
  generating?: boolean;
  imageModels: StoryboardGatewayModel[];
  imageModelKey: string;
  modelsLoading?: boolean;
  onProjectChange: () => void | Promise<void>;
  onOpenModelPicker: () => void;
  onRequestPlan: () => void;
};

function Stepper({
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={disabled || value <= min}
        className="flex h-6 w-6 items-center justify-center rounded border border-[#e8e8ed] text-xs disabled:opacity-40"
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <span className="min-w-[1.25rem] text-center text-xs tabular-nums">{value}</span>
      <button
        type="button"
        disabled={disabled || value >= max}
        className="flex h-6 w-6 items-center justify-center rounded border border-[#e8e8ed] text-xs disabled:opacity-40"
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );
}

export function ProductImageSetConfigSidebar({
  project,
  disabled,
  planning,
  generating,
  imageModels,
  imageModelKey,
  modelsLoading,
  onProjectChange,
  onOpenModelPicker,
  onRequestPlan,
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [sellpointDraft, setSellpointDraft] = useState(
    () => project.meta.sellpointDocument ?? "",
  );
  const [trendingCards, setTrendingCards] = useState<EcomStylePreset[]>([]);
  const vertical = project.meta.inferredVertical ?? "generic";

  useEffect(() => {
    setSellpointDraft(project.meta.sellpointDocument ?? "");
  }, [project.id, project.meta.sellpointDocument]);

  const persist = useCallback(
    async (patch: Parameters<typeof updateProductImageSetProject>[1]) => {
      await updateProductImageSetProject(project.id, patch);
      await onProjectChange();
    },
    [project.id, onProjectChange],
  );

  const loadTrending = useCallback(
    async (seed?: string) => {
      const nextSeed = seed ?? String(Date.now());
      const res = await fetchEcomStylePresets({
        kind: "trending_visual",
        vertical,
        suggest: true,
        limit: 4,
        seed: nextSeed,
      });
      setTrendingCards(res.presets);
      await persist({
        settings: { trendingStyleSeed: nextSeed },
      });
    },
    [vertical, persist],
  );

  useEffect(() => {
    if (project.settings.trendingStyleEnabled && trendingCards.length === 0) {
      void loadTrending(project.settings.trendingStyleSeed);
    }
  }, [project.settings.trendingStyleEnabled, trendingCards.length, loadTrending, project.settings.trendingStyleSeed]);

  const total = totalStructureCount(project.settings.structure);
  const sellCount = project.settings.structure.sellpoint;
  const aiBriefBusy = busy === "AI 分析产品图…";
  const planBusy = planning && !generating;
  const genBusy = generating && !planning;
  const busyStartedAt = planBusy
    ? project.meta.planStartedAt
    : genBusy
      ? project.meta.genStartedAt
      : undefined;
  const [elapsedLabel, setElapsedLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!planBusy && !genBusy) {
      setElapsedLabel(null);
      return;
    }
    const tick = () => {
      setElapsedLabel(formatProductImageSetElapsed(busyStartedAt) ?? null);
    };
    tick();
    const iv = window.setInterval(tick, 1000);
    return () => window.clearInterval(iv);
  }, [planBusy, genBusy, busyStartedAt]);
  const layoutLabel =
    project.settings.selectedSellpointLayoutIds.length > 0
      ? `已选择 ${project.settings.selectedSellpointLayoutIds.length} 个卖点图版式参考`
      : "选择卖点图版式参考";
  const modelLabel =
    imageModels.find((m) => m.modelKey === imageModelKey)?.displayName ??
    imageModelKey ??
    "未选择";

  return (
    <>
      <div
        className="flex h-full min-h-0 flex-col bg-[var(--ecom-assistant-bg)]"
        data-ecom-config-sidebar
        data-ecom-no-assistant-collapse
      >
        <div className="shrink-0 border-b border-[var(--ecom-assistant-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[#1d1d1f]">配置侧栏</h2>
          <p className="mt-0.5 text-[11px] text-[#86868b]">
            左侧上传商品原图；在此配置平台与套图结构后一键生成。
          </p>
        </div>

        <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <section className="mb-3 rounded-xl border border-[#e8e8ed] bg-white">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2.5"
              onClick={() => setSettingsOpen((o) => !o)}
            >
              <span className="text-xs font-semibold">生成设置</span>
              {settingsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {settingsOpen ? (
              <div className="grid grid-cols-2 gap-2 border-t border-[#e8e8ed] px-3 py-3">
                <select
                  className="rounded-lg border border-[#e8e8ed] bg-[#fafafa] px-2 py-1.5 text-[11px]"
                  value={project.settings.platform ?? "amazon"}
                  disabled={disabled || Boolean(busy)}
                  onChange={(e) =>
                    void persist({ settings: { platform: e.target.value } })
                  }
                >
                  {PLATFORM_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-lg border border-[#e8e8ed] bg-[#fafafa] px-2 py-1.5 text-[11px]"
                  value={project.settings.market ?? "us"}
                  disabled={disabled || Boolean(busy)}
                  onChange={(e) => void persist({ settings: { market: e.target.value } })}
                >
                  {MARKET_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-lg border border-[#e8e8ed] bg-[#fafafa] px-2 py-1.5 text-[11px]"
                  value={project.settings.language ?? "英文"}
                  disabled={disabled || Boolean(busy)}
                  onChange={(e) =>
                    void persist({ settings: { language: e.target.value } })
                  }
                >
                  {LANGUAGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-lg border border-[#e8e8ed] bg-[#fafafa] px-2 py-1.5 text-[11px]"
                  value={project.settings.imageRatio ?? "1:1"}
                  disabled={disabled || Boolean(busy)}
                  onChange={(e) =>
                    void persist({
                      settings: {
                        imageRatio: e.target.value as ProductImageSetProject["settings"]["imageRatio"],
                      },
                    })
                  }
                >
                  {RATIO_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </section>

          <section
            className={cn(
              "mb-3 rounded-xl border border-[#e8e8ed] bg-white px-3 py-3",
              aiBriefBusy && "ecom-media-generating-sweep border-[#0071e3]/30",
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold">商品卖点 &amp; 要求</span>
              <EcomButtonSecondary
                size="sm"
                type="button"
                className="h-7 gap-1 px-2 text-[10px]"
                disabled={disabled || Boolean(busy) || project.references.length === 0}
                onClick={() => {
                  setBusy("AI 分析产品图…");
                  void suggestProductImageSetBrief(project.id)
                    .then(() => onProjectChange())
                    .finally(() => setBusy(null));
                }}
              >
                {aiBriefBusy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                AI 帮写
              </EcomButtonSecondary>
            </div>
            {aiBriefBusy ? (
              <StoryboardTaskStatus
                active
                sweep
                title="AI 帮写"
                detail="正在分析商品原图并生成五段式卖点…"
                className="mb-2"
              />
            ) : null}
            <EcomSellpointFivePartHint />
            <textarea
              className={cn(
                "mt-2 min-h-[120px] w-full rounded-lg border border-[#e8e8ed] px-2 py-2 font-mono text-[11px]",
                aiBriefBusy && "opacity-80",
              )}
              placeholder={ECOM_SELLPOINT_FIVE_PART_PLACEHOLDER}
              value={sellpointDraft}
              disabled={disabled || Boolean(busy)}
              onChange={(e) => setSellpointDraft(e.target.value)}
              onBlur={() =>
                void persist({ meta: { sellpointDocument: sellpointDraft } })
              }
            />
          </section>

          <section className="mb-3 rounded-xl border border-[#e8e8ed] bg-white px-3 py-3">
            <p className="mb-2 text-xs font-semibold">套图结构配置</p>
            {(
              [
                ["whiteBg", "白底图", 0, 5],
                ["sellpoint", "卖点图", 0, 9],
                ["scene", "场景 / 模特场景", 0, 12],
                ["other", "细节 / 辅助图", 0, 5],
              ] as const
            ).map(([key, label, min, max]) => (
              <div key={key} className="mb-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-[11px] text-[#6e6e73]">
                    {label}
                    {key === "other" ? (
                      <span className="rounded bg-[#e8f0ff] px-1 text-[9px] text-[#007aff]">
                        AI 智能匹配
                      </span>
                    ) : null}
                  </span>
                  <Stepper
                    value={project.settings.structure[key]}
                    min={min}
                    max={max}
                    disabled={disabled || Boolean(busy)}
                    onChange={(n) => {
                      const patch: Parameters<typeof updateProductImageSetProject>[1] = {
                        settings: {
                          structure: { ...project.settings.structure, [key]: n },
                        },
                      };
                      if (key === "sellpoint" && n < sellCount) {
                        patch.settings = {
                          ...patch.settings,
                          selectedSellpointLayoutIds:
                            project.settings.selectedSellpointLayoutIds.slice(0, n),
                        };
                      }
                      void persist(patch);
                    }}
                  />
                </div>
                {key === "sellpoint" && sellCount > 0 ? (
                  <button
                    type="button"
                    className="mt-1.5 flex w-full items-center gap-2 rounded-lg border border-[#e8e8ed] px-2.5 py-2 text-left text-[11px] hover:bg-[#fafafa]"
                    onClick={() => setLayoutOpen(true)}
                  >
                    <LayoutGrid className="h-4 w-4 shrink-0 text-[#007aff]" />
                    <span className="flex-1">{layoutLabel}</span>
                    <ChevronRight className="h-4 w-4 text-[#86868b]" />
                  </button>
                ) : null}
              </div>
            ))}
          </section>

          <section className="mb-3 rounded-xl border border-[#e8e8ed] bg-white px-3 py-3">
            <p className="mb-2 text-xs font-semibold">生图模型</p>
            <div className="flex items-center gap-2 rounded-lg border border-[#e8e8ed] bg-[#fafafa] px-2.5 py-2">
              <Cpu className="h-4 w-4 shrink-0 text-[#007aff]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium text-[#1d1d1f]">
                  {modelsLoading ? "加载模型…" : modelLabel}
                </p>
                <p className="truncate text-[10px] text-[#86868b]">{imageModelKey}</p>
              </div>
              <EcomButtonSecondary
                size="sm"
                type="button"
                className="h-7 shrink-0 px-2 text-[10px]"
                disabled={disabled || generating || modelsLoading}
                onClick={onOpenModelPicker}
              >
                模型与参数
              </EcomButtonSecondary>
            </div>
          </section>

          <section className="mb-3 rounded-xl border border-[#e8e8ed] bg-white px-3 py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold">附加功能</span>
            </div>
            <label className="mb-3 flex items-center justify-between text-[11px]">
              <span>爆款风格分析</span>
              <input
                type="checkbox"
                checked={project.settings.trendingStyleEnabled}
                disabled={disabled || Boolean(busy)}
                onChange={(e) => {
                  const on = e.target.checked;
                  void persist({ settings: { trendingStyleEnabled: on } });
                  if (on) void loadTrending();
                }}
              />
            </label>
            {project.settings.trendingStyleEnabled ? (
              <>
                <div className="mb-2 grid grid-cols-2 gap-2">
                  {trendingCards.map((card) => {
                    const selected = project.settings.selectedTrendingStyleIds.includes(
                      card.id,
                    );
                    return (
                      <button
                        key={card.id}
                        type="button"
                        disabled={disabled || Boolean(busy)}
                        className={cn(
                          "rounded-lg border px-2 py-2 text-left text-[10px]",
                          selected ? "border-[#1d1d1f] bg-[#fafafa]" : "border-[#e8e8ed]",
                        )}
                        onClick={() => {
                          const ids = selected
                            ? project.settings.selectedTrendingStyleIds.filter(
                                (x) => x !== card.id,
                              )
                            : [...project.settings.selectedTrendingStyleIds, card.id];
                          void persist({ settings: { selectedTrendingStyleIds: ids } });
                        }}
                      >
                        <p className="font-semibold text-[#1d1d1f]">{card.title}</p>
                        <p className="mt-0.5 text-[#86868b]">{card.subtitle}</p>
                        <div className="mt-1 flex gap-1">
                          {(card.palette ?? []).slice(0, 3).map((c) => (
                            <span
                              key={c}
                              className="h-2 w-2 rounded-full"
                              style={{ background: c }}
                            />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <EcomButtonSecondary
                  size="sm"
                  type="button"
                  className="w-full gap-1 text-[10px]"
                  disabled={disabled || Boolean(busy)}
                  onClick={() => void loadTrending(String(Date.now()))}
                >
                  <RefreshCw className="h-3 w-3" />
                  换一批风格
                </EcomButtonSecondary>
              </>
            ) : null}
            <label className="mt-3 flex items-center justify-between border-t border-[#e8e8ed] pt-3 text-[11px]">
              <span>商品上架文案生成</span>
              <input
                type="checkbox"
                checked={project.settings.listingCopyEnabled}
                disabled={disabled || Boolean(busy)}
                onChange={(e) =>
                  void persist({ settings: { listingCopyEnabled: e.target.checked } })
                }
              />
            </label>
          </section>
        </div>

        <div className="shrink-0 border-t border-[var(--ecom-assistant-border)] p-4">
          {busy ? (
            <p className="mb-2 flex items-center gap-2 text-[11px] text-[#6e6e73]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {busy}
            </p>
          ) : null}
          {planBusy ? (
            <StoryboardTaskStatus
              active
              sweep
              title="AI 规划套图 Prompt"
              detail={[
                productImageSetPlanBusyDetail(project),
                elapsedLabel,
              ]
                .filter(Boolean)
                .join(" ")}
              className="mx-0 mb-3"
            />
          ) : null}
          {genBusy ? (
            <StoryboardTaskStatus
              active
              sweep
              title="槽位出图中"
              detail={[
                productImageSetGenerateBusyDetail(project),
                elapsedLabel,
              ]
                .filter(Boolean)
                .join(" ")}
              className="mx-0 mb-3"
            />
          ) : null}
          <EcomButtonPrimary
            size="sm"
            type="button"
            className="w-full gap-2"
            disabled={
              disabled ||
              planning ||
              generating ||
              project.references.length === 0 ||
              total === 0
            }
            onClick={() => {
              void (async () => {
                await persist({ meta: { sellpointDocument: sellpointDraft } });
                onRequestPlan();
              })();
            }}
          >
            {planning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                AI 规划 Prompt…
              </>
            ) : generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                出图中…
              </>
            ) : (
              `生成套图占位（${total} 张）`
            )}
          </EcomButtonPrimary>
        </div>
      </div>

      <ProductImageSetLayoutPickerDialog
        open={layoutOpen}
        onClose={() => setLayoutOpen(false)}
        projectId={project.id}
        vertical={vertical}
        maxSelect={sellCount}
        selectedIds={project.settings.selectedSellpointLayoutIds}
        onApply={(ids) =>
          persist({ settings: { selectedSellpointLayoutIds: ids } })
        }
      />
    </>
  );
}
