import { persistEcomGenerationRecord } from "@/lib/ecom/ecom-generation-record";

import type { SimpleFusionProjectDto } from "./types";

export async function recordSimpleFusionGeneration(opts: {
  userId: string;
  project: SimpleFusionProjectDto;
  ossUrl: string;
  kind: "image" | "video";
  title: string;
  prompt?: string;
  modelKey?: string;
  firstOrigin?: string;
}): Promise<void> {
  const workflowSnapshot = {
    module: opts.project.module,
    projectId: opts.project.id,
    settings: opts.project.settings,
    references: opts.project.references,
    prompts: opts.project.meta?.prompts,
    looks: opts.project.meta?.looks,
    composeResult: opts.project.composeResult,
  };
  await persistEcomGenerationRecord({
    userId: opts.userId,
    ossUrl: opts.ossUrl,
    kind: opts.kind,
    title: opts.title,
    prompt: opts.prompt ?? null,
    meta: {
      sourceModule: opts.project.module,
      sourceToolKey: "ecom-toolkit__simple-fusion-video",
      projectId: opts.project.id,
      modelKey: opts.modelKey,
      firstOrigin: opts.firstOrigin,
      ...({ workflowSnapshot } as Record<string, unknown>),
    },
  });
}
