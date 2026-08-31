import { extractModelShotJson, mergeModelShotPatch } from "@/lib/ecom/ecom-model-shot-phases";
import type { ModelShotProject } from "@/lib/ecom/ecom-model-shot-types";

export function parseModelShotAssistantOutput(
  project: ModelShotProject,
  text: string,
): {
  patch: ReturnType<typeof mergeModelShotPatch>;
  raw: string;
} {
  const json = extractModelShotJson(text);
  const patch = json ? mergeModelShotPatch(project, json) : {};
  return { patch, raw: text };
}

export { extractModelShotJson };
