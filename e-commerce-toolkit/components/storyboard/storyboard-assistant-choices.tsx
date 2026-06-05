"use client";

import { inferAssistantChoices } from "@/lib/storyboard-workflow";
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

  const isPlanChoice = choices.includes("按默认方案A");

  return (
    <div className={cn(compact ? "mt-3 border-t border-[#e8e8ed] pt-3" : "px-4 pb-2")}>
      {!compact ? (
        <p className="mb-2 px-0 text-xs text-[#6e6e73]">
          {isPlanChoice ? "请选择策划方式（无需输入）：" : "请选择（无需输入）："}
        </p>
      ) : (
        <p className="mb-2 text-[11px] text-[#6e6e73]">请选择（无需输入）：</p>
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
