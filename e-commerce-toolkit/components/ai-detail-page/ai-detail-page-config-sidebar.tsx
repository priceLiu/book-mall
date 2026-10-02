"use client";

import { ChevronDown, ChevronUp, Cpu, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EcomSellpointSectionTitle } from "@/components/media/ecom-sellpoint-five-part-help-trigger";
import { detailPageModuleCardSubtitle } from "@/lib/ecom-detail-page-module-ui";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import {
  detailTemplateSettingsPatch,
  EcomGenerationSettingsSection,
  generationCountryLabel,
  generationPlatformLabel,
} from "@/components/ecom-generation-settings/ecom-generation-settings-section";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  normalizeEcomCountryValue,
  normalizeEcomLanguageValue,
  normalizeEcomPlatformValue,
} from "@/lib/ecom-generation-settings/constants";
import {
  DEFAULT_ECOM_DETAIL_TEMPLATE_ID,
  type EcomDetailTemplateId,
} from "@/lib/ecom-generation-settings/detail-template";
import {
  updateAiDetailPageProject,
  visionAiDetailPageSellpoints,
} from "@/lib/ecom-ai-detail-page-api";
import {
  ECOM_SELLPOINT_FIVE_PART_PLACEHOLDER,
  briefPatchFromSellpointDraft,
  formatDetailPageSuiteSellpointDraft,
} from "@/lib/ecom-sellpoint-five-part";
import type { DetailPageSuiteModuleState, DetailPageSuiteProject } from "@/lib/detail-page-suite-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

type Props = {
  project: DetailPageSuiteProject;
  disabled?: boolean;
  planning?: boolean;
  prompting?: boolean;
  imageModels: StoryboardGatewayModel[];
  imageModelKey: string;
  modelsLoading?: boolean;
  onProjectChange: () => void | Promise<void>;
  onOpenModelPicker: () => void;
  onRequestPlanSlots: () => void;
  onRequestPrompts: () => void;
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

function totalEnabledSlots(modules: DetailPageSuiteModuleState[]): number {
  return modules
    .filter((m) => m.enable && m.generate_count > 0)
    .reduce((n, m) => n + m.generate_count, 0);
}

export function AiDetailPageConfigSidebar({
  project,
  disabled,
  planning,
  prompting,
  imageModels,
  imageModelKey,
  modelsLoading,
  onProjectChange,
  onOpenModelPicker,
  onRequestPlanSlots,
  onRequestPrompts,
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [modulesOpen, setModulesOpen] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [sellpointDraft, setSellpointDraft] = useState(() =>
    formatDetailPageSuiteSellpointDraft(project.brief),
  );

  useEffect(() => {
    setSellpointDraft(formatDetailPageSuiteSellpointDraft(project.brief));
  }, [project.id, project.brief]);

  const total = useMemo(() => totalEnabledSlots(project.suite.modules), [project.suite.modules]);

  const persist = useCallback(
    async (patch: Parameters<typeof updateAiDetailPageProject>[1]) => {
      await updateAiDetailPageProject(project.id, patch);
      await onProjectChange();
    },
    [onProjectChange, project.id],
  );

  const patchModule = useCallback(
    (moduleId: string, patch: Partial<DetailPageSuiteModuleState>) => {
      const modules = project.suite.modules.map((m) =>
        m.module_id === moduleId ? { ...m, ...patch } : m,
      );
      void persist({ suite: { ...project.suite, modules } });
    },
    [persist, project.suite],
  );

  const modelLabel =
    imageModels.find((m) => m.modelKey === imageModelKey)?.displayName ?? imageModelKey;

  const platformCode = normalizeEcomPlatformValue(project.brief?.platformCode);
  const marketCode = normalizeEcomCountryValue(project.brief?.marketCode);
  const language = normalizeEcomLanguageValue(project.brief?.outputLanguage);

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
          <EcomGenerationSettingsSection
            showDetailTemplate
            disabled={disabled || Boolean(busy)}
            defaultOpen={settingsOpen}
            value={{
              platform: platformCode,
              country: marketCode,
              language,
              detailTemplateId:
                project.brief?.detailTemplateId ?? DEFAULT_ECOM_DETAIL_TEMPLATE_ID,
            }}
            onChange={(patch) => {
              const brief = { ...(project.brief ?? {}) };
              const settings = { ...project.settings };
              let touchedBrief = false;
              let touchedSettings = false;

              if (patch.platform !== undefined) {
                brief.platformCode = patch.platform;
                brief.platform = generationPlatformLabel(patch.platform);
                touchedBrief = true;
              }
              if (patch.country !== undefined) {
                brief.marketCode = patch.country;
                brief.market = generationCountryLabel(patch.country);
                touchedBrief = true;
              }
              if (patch.language !== undefined) {
                brief.outputLanguage = patch.language;
                touchedBrief = true;
              }
              if (patch.detailTemplateId !== undefined) {
                brief.detailTemplateId = patch.detailTemplateId;
                const tpl = detailTemplateSettingsPatch(
                  patch.detailTemplateId as EcomDetailTemplateId,
                );
                settings.imageRatio = tpl.imageRatio;
                settings.imageSize = tpl.imageSize;
                touchedBrief = true;
                touchedSettings = true;
              }

              void persist({
                ...(touchedBrief ? { brief } : {}),
                ...(touchedSettings ? { settings } : {}),
              });
            }}
          />

          <section
            className={cn(
              "mb-3 rounded-xl border border-[#e8e8ed] bg-white px-3 py-3",
              busy === "AI 帮写" && "ecom-media-generating-sweep border-[#0071e3]/30",
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <EcomSellpointSectionTitle>
                <span className="text-xs font-semibold">商品卖点 &amp; 要求</span>
              </EcomSellpointSectionTitle>
              <EcomButtonSecondary
                size="sm"
                type="button"
                className="h-7 gap-1 px-2 text-[10px]"
                disabled={disabled || Boolean(busy) || project.references.length === 0}
                onClick={() => {
                  setBusy("AI 帮写");
                  void visionAiDetailPageSellpoints(project.id)
                    .then(() => onProjectChange())
                    .finally(() => setBusy(null));
                }}
              >
                {busy === "AI 帮写" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                AI 帮写
              </EcomButtonSecondary>
            </div>
            <textarea
              className="mt-2 min-h-[100px] w-full rounded-lg border border-[#e8e8ed] px-2 py-2 font-mono text-[11px]"
              placeholder={ECOM_SELLPOINT_FIVE_PART_PLACEHOLDER}
              value={sellpointDraft}
              disabled={disabled || Boolean(busy)}
              onChange={(e) => setSellpointDraft(e.target.value)}
              onBlur={() => {
                void persist({
                  brief: {
                    ...(project.brief ?? {}),
                    ...briefPatchFromSellpointDraft(sellpointDraft, project.brief),
                  },
                });
              }}
            />
          </section>

          <section className="mb-3 rounded-xl border border-[#e8e8ed] bg-white">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2.5"
              onClick={() => setModulesOpen((o) => !o)}
            >
              <span className="text-xs font-semibold">包含模块</span>
              {modulesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {modulesOpen ? (
              <div className="grid grid-cols-2 gap-2 border-t border-[#e8e8ed] px-3 py-3">
                {project.suite.modules.map((mod) => (
                  <div
                    key={mod.module_id}
                    className={cn(
                      "rounded-lg border px-2 py-2",
                      mod.enable ? "border-[#1d1d1f] bg-[#fafafa]" : "border-[#e8e8ed]",
                    )}
                  >
                    <label className="flex items-start gap-2 text-[10px] font-medium text-[#1d1d1f]">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={mod.enable}
                        disabled={disabled || Boolean(busy)}
                        onChange={(e) => {
                          const on = e.target.checked;
                          const count = on ? Math.max(1, mod.generate_count || 1) : 0;
                          const selected = on
                            ? mod.candidate_pool.slice(0, count)
                            : [];
                          patchModule(mod.module_id, {
                            enable: on,
                            generate_count: count,
                            selected_item_list: selected,
                          });
                        }}
                      />
                      <span className="min-w-0">
                        <span className="block leading-snug">{mod.module_name}</span>
                        <span className="mt-0.5 block text-[9px] font-normal leading-snug text-[#86868b]">
                          {detailPageModuleCardSubtitle(mod.candidate_pool)}
                        </span>
                      </span>
                    </label>
                    {mod.enable ? (
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[9px] text-[#86868b]">张数</span>
                        <Stepper
                          value={mod.generate_count}
                          min={1}
                          max={mod.max_num}
                          disabled={disabled || Boolean(busy)}
                          onChange={(n) => {
                            patchModule(mod.module_id, {
                              generate_count: n,
                              selected_item_list: mod.candidate_pool.slice(0, n),
                            });
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="mb-3 rounded-xl border border-[#e8e8ed] bg-white px-3 py-3">
            <p className="mb-2 text-xs font-semibold">生图模型</p>
            <div className="flex items-center gap-2 rounded-lg border border-[#e8e8ed] bg-[#fafafa] px-2.5 py-2">
              <Cpu className="h-4 w-4 shrink-0 text-[#007aff]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium">{modelsLoading ? "…" : modelLabel}</p>
                <p className="truncate text-[10px] text-[#86868b]">{imageModelKey}</p>
              </div>
              <EcomButtonSecondary
                size="sm"
                type="button"
                className="h-7 shrink-0 px-2 text-[10px]"
                disabled={disabled || modelsLoading}
                onClick={onOpenModelPicker}
              >
                模型与参数
              </EcomButtonSecondary>
            </div>
          </section>
        </div>

        <div className="shrink-0 border-t border-[var(--ecom-assistant-border)] p-4">
          {planning ? (
            <StoryboardTaskStatus
              active
              sweep
              title="生成详情页点位"
              detail="正在根据已选模块创建占位格…"
              className="mx-0 mb-3"
            />
          ) : null}
          {prompting ? (
            <StoryboardTaskStatus
              active
              sweep
              title="生成 Prompt"
              detail="LLM 正在为各点位写提示词…"
              className="mx-0 mb-3"
            />
          ) : null}
          <EcomButtonPrimary
            size="sm"
            type="button"
            className="mb-2 w-full"
            disabled={disabled || planning || prompting || total === 0 || project.references.length === 0}
            onClick={onRequestPlanSlots}
          >
            {planning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                生成点位…
              </>
            ) : (
              `生成详情页点位（${total} 张）`
            )}
          </EcomButtonPrimary>
          <EcomButtonSecondary
            size="sm"
            type="button"
            className="w-full"
            disabled={disabled || planning || prompting || total === 0}
            onClick={onRequestPrompts}
          >
            {prompting ? "生成 Prompt…" : "生成全部 Prompt"}
          </EcomButtonSecondary>
        </div>
      </div>
    </>
  );
}
