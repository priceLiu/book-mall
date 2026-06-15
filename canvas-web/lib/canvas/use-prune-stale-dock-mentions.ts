"use client";

import { useEffect } from "react";
import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";
import {
  stripStaleMentionTokensFromPrompt,
  type DockMentionPromptField,
} from "./strip-dock-mentions";

/** 上游 chip / 参考图删除后，自动从 dock prompt 剔除失效 @ */
export function usePruneStaleDockMentions(opts: {
  nodeId: string | null;
  prompt: string;
  mentionables: MentionableItem[];
  field: DockMentionPromptField;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
}): void {
  const { nodeId, prompt, mentionables, field, updateNodeData } = opts;

  useEffect(() => {
    if (!nodeId || !prompt.includes("@<")) return;
    const next = stripStaleMentionTokensFromPrompt(
      prompt,
      mentionables.map((m) => m.id),
    );
    if (next === prompt) return;
    updateNodeData(nodeId, { [field]: next });
  }, [nodeId, prompt, mentionables, field, updateNodeData]);
}
