"use client";

import { saveCanvasTemplate } from "@/lib/canvas-api";
import { pickPersistableProjectThumbnailUrl } from "@/lib/canvas/project-thumbnail";
import { stripRuntimeForTemplate } from "@/lib/canvas/sanitize";
import type { CanvasGraph } from "@/lib/canvas/types";

export type ShareWorkflowInput = {
  base: string;
  name: string;
  description?: string;
  graph: CanvasGraph;
  edition?: string;
  sourceLabel?: string;
  visibility?: "private" | "public";
};

/** 清洗后保存为画布工作流模板（公开分享保留媒体快照）。 */
export async function shareWorkflowAsTemplate(
  input: ShareWorkflowInput,
): Promise<void> {
  const keepMedia = input.visibility === "public";
  const cleaned = stripRuntimeForTemplate(input.graph, {
    keepPersistableMedia: keepMedia,
  });
  const thumbnail = keepMedia
    ? pickPersistableProjectThumbnailUrl(cleaned)
    : "";
  await saveCanvasTemplate(input.base, {
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    canvas: cleaned,
    category: "user",
    edition: input.edition ?? "",
    sourceLabel: input.sourceLabel?.trim() ?? "",
    visibility: input.visibility ?? "private",
    ...(thumbnail ? { thumbnail } : {}),
  });
}
