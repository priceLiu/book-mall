"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { EcomAssistantEdgeCollapseButton } from "@/components/layout/ecom-assistant-edge-collapse-button";
import { EcomAssistantPanelHeader } from "@/components/layout/ecom-assistant-panel-header";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import { generateModelShotPosePlan, updateModelShotProject } from "@/lib/ecom-model-shot-api";
import {
  MODEL_SHOT_COUNT_CHOICES,
  MODEL_SHOT_STYLE_CHOICES,
  MODEL_SHOT_USAGE_CHOICES,
  buildModelShotCollectionSummaryRows,
  deriveModelShotPhaseFromState,
  inferModelShotPhase,
  isMetaBriefComplete,
  posePlanGenerateChoiceLabel,
} from "@/lib/model-shot-workflow";
import type { ModelShotBrief, ModelShotProject } from "@/lib/model-shot-types";
import {
  hasGarmentReference,
  isModelShotOptionalRefDone,
  isModelShotPropStepDone,
  refByRole,
} from "@/lib/model-shot-types";
import { cn } from "@/lib/utils";

type Props = {
  project: ModelShotProject;
  disabled?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onProjectChange: (next?: ModelShotProject) => void | Promise<void>;
  onAlert: (opts: { title: string; message: string; variant?: "error" }) => Promise<void>;
};

const sectionClass = "mb-3 rounded-xl border border-[#e8e8ed] bg-white px-3 py-3";
const optionBtnClass = (active: boolean) =>
  cn(
    "w-full rounded-lg border px-2.5 py-2 text-left text-[11px] transition",
    active
      ? "border-[var(--ecom-outline-border)] bg-[#f0f6ff]"
      : "border-transparent hover:border-[#e8e8ed] hover:bg-[#fafafa]",
  );

function ChoiceRow({
  label,
  description,
  active,
  onClick,
  disabled,
}: {
  label: string;
  description?: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={optionBtnClass(Boolean(active))}
      onClick={onClick}
    >
      <p className="font-medium text-[#1d1d1f]">{label}</p>
      {description ? (
        <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-[#86868b]">
          {description}
        </p>
      ) : null}
    </button>
  );
}

export function ModelShotConfigSidebar({
  project,
  disabled,
  collapsed = false,
  onCollapsedChange,
  onProjectChange,
  onAlert,
}: Props) {
  const projectId = project.id;
  const garmentReady = hasGarmentReference(project.references);
  const modelRef = refByRole(project.references, "model");
  const brief = project.brief ?? {};
  const phase = inferModelShotPhase(project);
  const derivedPhase = deriveModelShotPhaseFromState(project);

  const [busy, setBusy] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const persistBrief = useCallback(
    async (patch: Partial<ModelShotBrief>) => {
      if (!garmentReady) return;
      setBusy("保存…");
      try {
        const nextBrief = { ...brief, ...patch };
        await updateModelShotProject(projectId, { brief: nextBrief });
        await onProjectChange();
      } catch (e) {
        await onAlert({
          title: "保存失败",
          message: e instanceof Error ? e.message : "无法保存",
          variant: "error",
        });
      } finally {
        setBusy(null);
      }
    },
    [brief, garmentReady, onAlert, onProjectChange, projectId],
  );

  const readyForPosePlan = useMemo(() => {
    return (
      garmentReady &&
      Boolean(modelRef) &&
      isModelShotOptionalRefDone(project.references, "scene") &&
      isModelShotPropStepDone(project.references, project.meta) &&
      isMetaBriefComplete(brief)
    );
  }, [brief, garmentReady, modelRef, project.meta, project.references]);

  const poseCount = brief.poseCount ?? 6;
  const planLabel = posePlanGenerateChoiceLabel(poseCount);
  const hasPlan = project.plan.items.length > 0;

  const summaryRows = useMemo(
    () => buildModelShotCollectionSummaryRows(project),
    [project],
  );

  const handleGeneratePlan = useCallback(async () => {
    if (!readyForPosePlan) {
      await onAlert({
        title: "请先完成配置",
        message: "请在中栏完成模特参考，并在此选择风格、用途与张数（场景与道具可选）。",
        variant: "error",
      });
      return;
    }
    setPlanning(true);
    try {
      await updateModelShotProject(projectId, {
        meta: {
          ...(project.meta ?? {}),
          wizard: {
            ...(project.meta?.wizard ?? {}),
            summaryAcknowledged: true,
          },
        },
      });
      await generateModelShotPosePlan(projectId);
      await onProjectChange();
    } catch (e) {
      await onAlert({
        title: "生成失败",
        message: e instanceof Error ? e.message : "无法生成姿势方案",
        variant: "error",
      });
    } finally {
      setPlanning(false);
    }
  }, [onAlert, onProjectChange, project.meta, projectId, readyForPosePlan]);

  const sectionDisabled = disabled || Boolean(busy) || !garmentReady;
  const collapseBlocked = planning || Boolean(busy);

  const tryCollapse = useCallback(() => {
    if (collapseBlocked) return;
    onCollapsedChange?.(true);
  }, [collapseBlocked, onCollapsedChange]);

  const tryExpand = useCallback(() => {
    onCollapsedChange?.(false);
  }, [onCollapsedChange]);

  const toggleCollapsed = useCallback(() => {
    if (collapsed) tryExpand();
    else tryCollapse();
  }, [collapsed, tryCollapse, tryExpand]);

  const phaseHint = !garmentReady
    ? null
    : derivedPhase === "generate"
      ? "当前阶段 · 出图"
      : `当前阶段 · ${derivedPhase}`;

  return (
    <div
      className="relative h-full min-h-0 w-full overflow-hidden bg-[var(--ecom-assistant-bg)]"
      data-ecom-config-sidebar
    >
      {onCollapsedChange ? (
        <EcomAssistantEdgeCollapseButton
          collapsed={collapsed}
          disabled={collapseBlocked}
          onClick={toggleCollapsed}
        />
      ) : null}
      <div
        className={cn(
          "flex h-full min-h-0 flex-col",
          collapsed && "pointer-events-none invisible",
        )}
      >
        <EcomAssistantPanelHeader
          title="拍摄采集"
          subtitle="模特 / 场景 / 道具在中栏；此处选风格、用途与张数"
        />
        {!garmentReady ? (
          <p className="shrink-0 border-b border-[var(--ecom-assistant-border)] px-4 py-2 text-[11px] font-medium text-amber-800">
            请先在中栏上传服装参考图。
          </p>
        ) : phaseHint ? (
          <p className="shrink-0 border-b border-[var(--ecom-assistant-border)] px-4 py-2 text-[10px] text-[#6e6e73]">
            {phaseHint}
          </p>
        ) : null}

      <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {garmentReady && !modelRef ? (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
            请在中栏完成模特参考（上传、虚拟人设或文字描述）后再生成姿势方案。
          </p>
        ) : null}

        <section className={sectionClass}>
          <p className="mb-2 text-xs font-semibold text-[#1d1d1f]">风格调性</p>
          <div className="space-y-1">
            {MODEL_SHOT_STYLE_CHOICES.map((s) => {
              const active = Boolean(
                brief.styles?.length &&
                  s.styles.length === brief.styles.length &&
                  s.styles.every((x, i) => brief.styles?.[i] === x),
              );
              return (
                <ChoiceRow
                  key={s.label}
                  label={s.label}
                  description={s.styles.join(" · ")}
                  active={active}
                  disabled={sectionDisabled}
                  onClick={() => void persistBrief({ styles: [...s.styles] })}
                />
              );
            })}
          </div>
        </section>

        <section className={sectionClass}>
          <p className="mb-2 text-xs font-semibold text-[#1d1d1f]">主要用途</p>
          <div className="space-y-1">
            {MODEL_SHOT_USAGE_CHOICES.map((u) => {
              const active = brief.platform === u.platform && brief.industry === u.industry;
              return (
                <ChoiceRow
                  key={u.label}
                  label={u.label}
                  description={`${u.platform} · ${u.industry}`}
                  active={active}
                  disabled={sectionDisabled}
                  onClick={() =>
                    void persistBrief({ platform: u.platform, industry: u.industry })
                  }
                />
              );
            })}
          </div>
        </section>

        <section className={sectionClass}>
          <p className="mb-2 text-xs font-semibold text-[#1d1d1f]">姿势张数</p>
          <div className="flex gap-2">
            {MODEL_SHOT_COUNT_CHOICES.map((c) => (
              <button
                key={c.label}
                type="button"
                disabled={sectionDisabled}
                className={cn(
                  "flex-1 rounded-lg border px-2 py-2 text-[11px] font-medium",
                  brief.poseCount === c.poseCount
                    ? "border-[var(--ecom-outline-border)] bg-[#f0f6ff] text-[#1d1d1f]"
                    : "border-[#e8e8ed] text-[#6e6e73] hover:bg-[#fafafa]",
                )}
                onClick={() => void persistBrief({ poseCount: c.poseCount })}
              >
                {c.label}
              </button>
            ))}
          </div>
        </section>

        {summaryRows.length > 0 ? (
          <section className={sectionClass}>
            <p className="mb-2 text-xs font-semibold text-[#1d1d1f]">采集摘要</p>
            <table className="w-full text-[10px]">
              <tbody>
                {summaryRows.map((row) => (
                  <tr key={row.label} className="border-t border-[#f0f0f5] first:border-t-0">
                    <td className="py-1 pr-2 text-[#86868b]">{row.label}</td>
                    <td className="py-1 text-[#1d1d1f]">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {phase === "confirm" || phase === "generate" ? (
          <p className="text-[10px] leading-relaxed text-[#86868b]">
            姿势脚本与出图请在中栏操作：核对表内 Prompt → 确认计划 → 模特图卡片生成。
          </p>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-[var(--ecom-assistant-border)] p-4">
        {busy ? (
          <p className="mb-2 flex items-center gap-2 text-[11px] text-[#6e6e73]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {busy}
          </p>
        ) : null}
        {planning ? (
          <StoryboardTaskStatus
            active
            sweep
            title="生成姿势方案"
            detail="正在编排姿势脚本…"
            className="mx-0 mb-3"
          />
        ) : null}
        <EcomButtonPrimary
          size="sm"
          type="button"
          className="w-full gap-2"
          disabled={sectionDisabled || planning || !readyForPosePlan}
          onClick={() => void handleGeneratePlan()}
        >
          {planning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              生成中…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {hasPlan ? "重新生成姿势方案" : planLabel}
            </>
          )}
        </EcomButtonPrimary>
        {!readyForPosePlan && garmentReady ? (
          <p className="mt-2 text-[10px] text-[#86868b]">
            中栏完成模特后，在此选择风格、用途与张数即可生成。
          </p>
        ) : null}
      </div>
      </div>
    </div>
  );
}