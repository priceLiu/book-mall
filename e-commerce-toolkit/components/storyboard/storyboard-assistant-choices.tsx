"use client";

import {
  CUSTOM_PARAMS_CHOICE,
  getParamStep,
  getStepPrompt,
  isAwaitingCategory,
  isAwaitingSellpointInput,
  isParamCollecting,
  PARAM_COLLECT_TOTAL_STEPS,
  QUICK_GENERATE_CHOICE,
} from "@/lib/storyboard-param-collect";
import { CHARACTER_PRESET_FEMALE_CHOICE } from "@/lib/storyboard-character-presets";
import {
  CUSTOM_SCENE_INPUT_CHOICE,
  getScenePresetChoiceLabels,
} from "@/lib/storyboard-scene-presets";
import {
  inferAssistantChoices,
  isAwaitingInitialProductRef,
  isAwaitingPlanMode,
  isAwaitingPlanDeliverable,
  isAwaitingSceneApplyMode,
  isAwaitingSchemePick,
} from "@/lib/storyboard-workflow";
import { REGENERATE_PLAN_CHOICE } from "@/lib/storyboard-param-collect";
import type { StoryboardProject } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

type Props = {
  project: StoryboardProject;
  onChoose: (text: string) => void;
  disabled?: boolean;
  /** 紧凑样式，用于气泡内嵌 */
  compact?: boolean;
};

/** 助手气泡内快捷按钮统一样式，见 .cursor/rules/ecom-storyboard-assistant-choices.mdc */
export const STORYBOARD_ASSISTANT_CHOICE_CLASS =
  "rounded-full border border-[var(--ecom-assistant-choice-border)] bg-[var(--ecom-assistant-choice-bg)] px-3 py-1.5 text-xs font-medium text-[#1d1d1f] transition-colors hover:border-[var(--ecom-chrome-text-muted)] hover:bg-[var(--ecom-assistant-choice-hover-bg)] disabled:opacity-50";

export function StoryboardAssistantChoices({
  project,
  onChoose,
  disabled,
  compact,
}: Props) {
  const choices = inferAssistantChoices(project);
  if (!choices.length) return null;

  const collecting = isParamCollecting(project);
  const awaitingSellpoint = isAwaitingSellpointInput(project);
  const awaitingCategory = isAwaitingCategory(project);
  const awaitingPlanMode = isAwaitingPlanMode(project);
  const awaitingSchemePick = isAwaitingSchemePick(project);
  const awaitingInitialProductRef = isAwaitingInitialProductRef(project);
  const awaitingSceneApplyMode = isAwaitingSceneApplyMode(project);
  const awaitingPlanDeliverable = isAwaitingPlanDeliverable(project);
  const step = getParamStep(project);
  const scenePresetStep = getScenePresetChoiceLabels().some((l) => choices.includes(l));
  const characterStep = choices.includes(CHARACTER_PRESET_FEMALE_CHOICE);
  const stepLabel = awaitingSellpoint
    ? "请在下方输入产品卖点（一行即可）"
    : awaitingInitialProductRef
      ? "请先在参考图区上传产品图（必填），上传后点击："
      : collecting
      ? `第 ${step + 1}/${PARAM_COLLECT_TOTAL_STEPS} 步：${getStepPrompt(step)}`
      : awaitingCategory
        ? "请选择产品品类，或点「自动匹配」由系统推断："
        : awaitingPlanMode
          ? "请选择生成方式（无需输入）："
          : awaitingSchemePick
            ? "请先选择一套定稿方案（无需输入）："
            : awaitingPlanDeliverable
              ? "策划 JSON 未完整生成，请点「重新生成策划」重试："
            : awaitingSceneApplyMode
              ? "请选择场景应用方式（无需输入）："
            : characterStep
            ? "未上传角色图？建议选「女主/男主素人」保持全片人物一致，或上传后点「已上传角色图」："
            : scenePresetStep || choices.includes(CUSTOM_SCENE_INPUT_CHOICE)
            ? "未上传场景图？可选预设、自定义描述，或上传后点「已上传场景图」："
            : choices.includes(QUICK_GENERATE_CHOICE) ||
              choices.includes(CUSTOM_PARAMS_CHOICE)
            ? "请选择生成方式（无需输入）："
            : "请选择（无需输入）：";

  return (
    <div className={cn(compact ? "mt-3 border-t border-[var(--ecom-assistant-border)] pt-3" : "px-4 pb-2")}>
      {!compact ? (
        <p className="mb-2 px-0 text-xs text-[#6e6e73]">{stepLabel}</p>
      ) : (
        <p className="mb-2 text-[11px] text-[#6e6e73]">{stepLabel}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {choices.map((c) => (
          <button
            key={c}
            type="button"
            disabled={disabled}
            className={STORYBOARD_ASSISTANT_CHOICE_CLASS}
            onClick={() => onChoose(c)}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
