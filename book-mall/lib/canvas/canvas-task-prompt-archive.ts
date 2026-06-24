import type { CanvasGenerationKind, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  extractPromptTextFromPayload,
  inferPromptMediaKind,
  type PromptHistoryMediaKind,
} from "@/lib/canvas/prompt-history";
import { resolveGenerationRecordPreview } from "@/lib/canvas/generation-record-preview";

export function computeTaskPromptArchive(args: {
  kind: CanvasGenerationKind;
  inputPayload: unknown;
  textOutput?: string | null;
  ossUrl?: string | null;
  ephemeralUrl?: string | null;
}): {
  archivePromptText: string | null;
  archiveMediaKind: PromptHistoryMediaKind | null;
} {
  const preview = resolveGenerationRecordPreview({
    ossUrl: args.ossUrl,
    ephemeralUrl: args.ephemeralUrl,
    inputPayload: args.inputPayload,
  });
  const promptText = extractPromptTextFromPayload({
    inputPayload: args.inputPayload,
    kind: args.kind,
    textOutput: args.textOutput,
  });
  if (!promptText) {
    return { archivePromptText: null, archiveMediaKind: null };
  }
  return {
    archivePromptText: promptText.slice(0, 4000),
    archiveMediaKind: inferPromptMediaKind({
      kind: args.kind,
      inputPayload: args.inputPayload,
      previewKind: preview.previewKind,
    }),
  };
}

/** 任务 create / update 时写入提示词归档列，供「我的提示词」索引查询。 */
export function promptArchiveFieldsForTask(args: {
  kind: CanvasGenerationKind;
  inputPayload: unknown;
  textOutput?: string | null;
  ossUrl?: string | null;
  ephemeralUrl?: string | null;
}): Pick<
  Prisma.CanvasGenerationTaskCreateInput,
  "archivePromptText" | "archiveMediaKind"
> {
  const { archivePromptText, archiveMediaKind } = computeTaskPromptArchive(args);
  return {
    archivePromptText,
    archiveMediaKind,
  };
}

export function promptArchiveFieldsForTaskUpdate(args: {
  kind: CanvasGenerationKind;
  inputPayload: unknown;
  textOutput?: string | null;
  ossUrl?: string | null;
  ephemeralUrl?: string | null;
}): Pick<
  Prisma.CanvasGenerationTaskUpdateInput,
  "archivePromptText" | "archiveMediaKind"
> {
  const fields = promptArchiveFieldsForTask(args);
  return {
    archivePromptText: fields.archivePromptText,
    archiveMediaKind: fields.archiveMediaKind,
  };
}

/** 终态后补写归档（TEXT 等依赖 textOutput 的场景）。 */
export async function syncTaskPromptArchiveById(taskId: string): Promise<void> {
  const task = await prisma.canvasGenerationTask.findUnique({
    where: { id: taskId },
    select: {
      kind: true,
      inputPayload: true,
      textOutput: true,
      ossUrl: true,
      ephemeralUrl: true,
      archivePromptText: true,
    },
  });
  if (!task) return;
  if (task.archivePromptText?.trim()) return;
  const fields = promptArchiveFieldsForTaskUpdate(task);
  if (!fields.archivePromptText) return;
  await prisma.canvasGenerationTask.update({
    where: { id: taskId },
    data: fields,
  });
}
