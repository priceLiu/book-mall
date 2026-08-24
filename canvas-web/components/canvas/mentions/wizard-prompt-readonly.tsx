"use client";

import { useMemo, type ReactNode } from "react";
import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";
import {
  WIZARD_MENTION_PROMPT_BODY_CLASS,
  WIZARD_MENTION_PROMPT_RE,
} from "@/lib/canvas/wizard-mention-chrome";
import { cn } from "@/lib/utils";
import { WizardMentionBadge } from "./wizard-mention-badge";

function splitWizardPromptSegments(
  value: string,
  byId: Map<string, MentionableItem>,
): ReactNode[] {
  if (!value) return [];
  const nodes: ReactNode[] = [];
  WIZARD_MENTION_PROMPT_RE.lastIndex = 0;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = WIZARD_MENTION_PROMPT_RE.exec(value)) !== null) {
    const id = m[1] ?? m[2];
    if (!id) continue;
    if (m.index > last) {
      nodes.push(
        <span key={`t-${key++}`}>{value.slice(last, m.index)}</span>,
      );
    }
    nodes.push(
      <WizardMentionBadge
        key={`m-${key++}`}
        id={id}
        item={byId.get(id)}
      />,
    );
    last = m.index + m[0].length;
  }
  if (last < value.length) {
    nodes.push(<span key={`t-${key++}`}>{value.slice(last)}</span>);
  }
  return nodes;
}

export type WizardPromptReadonlyProps = {
  value: string;
  mentionables?: MentionableItem[];
  className?: string;
};

/** 向导只读 prompt · @ 引用与分镜编辑弹层 MentionsEditable(wizard) 同款 */
export function WizardPromptReadonly({
  value,
  mentionables = [],
  className,
}: WizardPromptReadonlyProps) {
  const byId = useMemo(
    () => new Map(mentionables.map((m) => [m.id, m] as const)),
    [mentionables],
  );
  const segments = useMemo(
    () => splitWizardPromptSegments(value, byId),
    [value, byId],
  );

  return (
    <div className={cn(WIZARD_MENTION_PROMPT_BODY_CLASS, className)}>
      {segments.length ? segments : value}
    </div>
  );
}
