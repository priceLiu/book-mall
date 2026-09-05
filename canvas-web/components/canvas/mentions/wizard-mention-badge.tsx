"use client";

import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";
import {
  INLINE_MENTION_BADGE_GAP_PX,
  INLINE_MENTION_THUMB_PX,
} from "@/lib/canvas/mention-inline-thumb-metrics";
import {
  WIZARD_MENTION_INLINE_BADGE_CLASS,
  WIZARD_MENTION_INLINE_BADGE_STYLE,
} from "@/lib/canvas/wizard-mention-chrome";

export type WizardMentionBadgeProps = {
  id: string;
  item?: MentionableItem;
};

/** 分镜编辑 MentionsEditable · wizard 版同款只读徽标 */
export function WizardMentionBadge({ id, item }: WizardMentionBadgeProps) {
  const label = item?.label ?? id.replace(/^wiz-(?:char|scene|prop)-/, "");
  const previewUrl = item?.previewUrl?.trim();

  return (
    <span
      className={WIZARD_MENTION_INLINE_BADGE_CLASS}
      style={WIZARD_MENTION_INLINE_BADGE_STYLE}
      data-mention-id={id}
    >
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
          className="shrink-0 rounded-[4px] object-cover"
          style={{
            width: INLINE_MENTION_THUMB_PX,
            height: INLINE_MENTION_THUMB_PX,
          }}
        />
      ) : null}
      <span className="min-w-0 truncate">@{label}</span>
    </span>
  );
}
