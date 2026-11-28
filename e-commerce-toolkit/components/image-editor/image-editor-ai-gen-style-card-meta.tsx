"use client";

import { aiGenStylePromptTip, type AiGenStyleModel } from "@/lib/image-editor-ai-gen-style-models";

type Props = {
  model: AiGenStyleModel;
};

/** 风格模型卡片文案：标题 + 单行提示词（悬停完整 tip） */
export function ImageEditorAiGenStyleCardMeta({ model }: Props) {
  const promptTip = aiGenStylePromptTip(model);

  return (
    <div className="space-y-0.5 px-2 py-2">
      <p className="truncate text-[12px] font-medium text-[var(--ie-ink)]">{model.label}</p>
      <span className="group/prompt relative block min-w-0">
        <span
          className="block truncate text-[11px] leading-snug text-[var(--ie-muted)]"
          title={promptTip}
        >
          {promptTip}
        </span>
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-0 z-50 mb-1.5 hidden max-w-[min(200px,90vw)] rounded-md bg-[#1d1d1f] px-2.5 py-1.5 text-left text-[11px] font-normal leading-snug text-white shadow-lg group-hover/prompt:block"
        >
          {promptTip}
        </span>
      </span>
    </div>
  );
}