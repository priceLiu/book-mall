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
import { inferAssistantChoices, isAwaitingPlanMode } from "@/lib/storyboard-workflow";
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
  "rounded-full border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-1.5 text-xs font-medium text-[#1d1d1f] transition-colors hover:border-[#86868b] hover:bg-[#ebebed] disabled:opacity-50";

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
  const step = getParamStep(project);
  const scenePresetStep = getScenePresetChoiceLabels().some((l) => choices.includes(l));
  const characterStep = choices.includes(CHARACTER_PRESET_FEMALE_CHOICE);
  const stepLabel = awaitingSellpoint
    ? "请在下方输入产品卖点（一行即可）"
    : collecting
      ? `第 ${step + 1}/${PARAM_COLLECT_TOTAL_STEPS} 步：${getStepPrompt(step)}`
      : awaitingCategory
        ? "请选择产品品类，或点「自动匹配」由系统推断："
        : awaitingPlanMode
          ? "请选择生成方式（无需输入）："
          : characterStep
            ? "未上传角色图？建议选「女主/男主素人」保持全片人物一致，或上传后点「已上传角色图」："
            : scenePresetStep || choices.includes(CUSTOM_SCENE_INPUT_CHOICE)
            ? "未上传场景图？可选预设、自定义描述，或上传后点「已上传场景图」："
            : choices.includes(QUICK_GENERATE_CHOICE) ||
              choices.includes(CUSTOM_PARAMS_CHOICE)
            ? "请选择生成方式（无需输入）："
            : "请选择（无需输入）：";

  return (
    <div className={cn(compact ? "mt-3 border-t border-[#e8e8ed] pt-3" : "px-4 pb-2")}>
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
