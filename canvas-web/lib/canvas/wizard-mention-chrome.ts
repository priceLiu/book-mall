import { LIBTV_INPUT_DOCK_BG } from "@/lib/canvas/libtv-node-chrome";
import { mentionBadgeShellClass } from "@/lib/canvas/mention-editable-dom";

/** 与 MentionsEditable · mentionEdition=wizard / 分镜编辑弹层一致（无边框） */
export const WIZARD_MENTION_INLINE_BADGE_CLASS =
  mentionBadgeShellClass("wizard");

export const WIZARD_MENTION_INLINE_BADGE_STYLE = {
  backgroundColor: LIBTV_INPUT_DOCK_BG,
  gap: 2,
  marginInline: "1px",
  verticalAlign: "middle" as const,
};

/** 只读区正文 · 与 PRO2_WIZARD_PROMPT_MENTIONS_CLASS 字号一致 */
export const WIZARD_MENTION_PROMPT_BODY_CLASS =
  "whitespace-pre-wrap break-words text-[13px] leading-relaxed text-white/90";

/** `@<wiz-*>` 与 Pass2 偶发的 `@wiz-*` 裸 token */
export const WIZARD_MENTION_PROMPT_RE =
  /@(?:<([^>\s]+)>|(wiz-(?:char|scene|prop)-[\w-]+))/g;

export function textHasWizardMentionTokens(text: string): boolean {
  return (
    text.includes("@<wiz-") ||
    /@wiz-(?:char|scene|prop)-[\w-]+/.test(text)
  );
}
