/**
 * Pro2 剧本 Hub · LLM 原始版本快照（首次 full_pack / 重生成时归档上一版）
 */
import type { Pro2ProductionScript } from "./data/pro2-production-script-schema";
import type {
  StoryProProductionScriptOrigin,
  StoryProScriptHubNodeData,
} from "./story-pro-workspace-types";
import type { CanvasNodeRuntime } from "./types";
import type { StoryLlmSection } from "./story-workspace-types";
import { storyboardMdHasParseableRows } from "./parse-md-tables";

export const PRO2_PRODUCTION_SCRIPT_ORIGIN_HISTORY_MAX = 3;

function cloneProductionScript(
  script?: Pro2ProductionScript,
): Pro2ProductionScript | undefined {
  if (!script) return undefined;
  try {
    return structuredClone(script);
  } catch {
    return JSON.parse(JSON.stringify(script)) as Pro2ProductionScript;
  }
}

function patchHasScriptPayload(
  patch: Partial<StoryProScriptHubNodeData>,
): boolean {
  if (patch.productionScript?.shots?.length) return true;
  if (storyboardMdHasParseableRows(patch.storyboardMd ?? "")) return true;
  if ((patch.outlineMd ?? "").trim().length > 80) return true;
  return false;
}

/** LLM 成功返回后 · 写入原始版本（不覆盖用户后续编辑的工作副本） */
export function buildProductionScriptOriginPatch(
  prev: StoryProScriptHubNodeData,
  section: StoryLlmSection,
  runtime: CanvasNodeRuntime,
  rawTextOutput: string,
  applied: Partial<StoryProScriptHubNodeData>,
): Partial<StoryProScriptHubNodeData> {
  if (runtime.status !== "done") return {};
  const raw = rawTextOutput.trim();
  if (!raw || !patchHasScriptPayload(applied)) return {};

  const capturesOrigin =
    section === "outline" ||
    section === "storyboard" ||
    section === "shot_prompts" ||
    Boolean(applied.productionScript);
  if (!capturesOrigin) return {};

  const taskId = runtime.taskId?.trim();
  const existing = prev.productionScriptOrigin;
  if (existing?.taskId && taskId && existing.taskId === taskId) {
    return {};
  }

  const merged = { ...prev, ...applied } as StoryProScriptHubNodeData;
  const nextOrigin: StoryProProductionScriptOrigin = {
    savedAt: new Date().toISOString(),
    taskId,
    section,
    step: applied.productionScript ? "full_pack" : section,
    rawTextOutput: raw,
    outlineMd: merged.outlineMd ?? "",
    characterMd: merged.characterMd ?? "",
    sceneMd: merged.sceneMd ?? "",
    storyboardMd: merged.storyboardMd ?? "",
    productionScript: cloneProductionScript(
      merged.productionScript ?? applied.productionScript,
    ),
  };

  const patch: Partial<StoryProScriptHubNodeData> = {
    productionScriptOrigin: nextOrigin,
  };

  if (existing?.rawTextOutput?.trim()) {
    patch.productionScriptOriginHistory = [
      existing,
      ...(prev.productionScriptOriginHistory ?? []),
    ].slice(0, PRO2_PRODUCTION_SCRIPT_ORIGIN_HISTORY_MAX);
  }

  return patch;
}
