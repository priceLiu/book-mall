/**
 * Pro2 画布 · JSON-only v13 格式标记与旧项目退役判定
 * book-mall/lib/canvas/pro2-project-format.ts 须保持语义同步
 */
import {
  canvasProjectEditionFromGraph,
  canvasProjectEditionFromListHints,
} from "./project-edition-detect";

export const PRO2_SCRIPT_FORMAT_JSON_ONLY_V13 = "json-only-v13";

export const PRO2_SCRIPT_HUB_NODE_TYPE = "story-pro2-script-hub";

type Pro2GraphMeta = {
  edition?: string;
  pro2ScriptFormat?: string;
  linkedScriptPackageAssetId?: string;
};

function readMeta(meta: unknown): Pro2GraphMeta | null {
  if (!meta || typeof meta !== "object") return null;
  return meta as Pro2GraphMeta;
}

export function readPro2ScriptFormat(meta: unknown): string | undefined {
  const format = readMeta(meta)?.pro2ScriptFormat?.trim();
  return format || undefined;
}

export function isActivePro2ScriptFormatV13(meta: unknown): boolean {
  return readPro2ScriptFormat(meta) === PRO2_SCRIPT_FORMAT_JSON_ONLY_V13;
}

/** Hub 节点是否 JSON-only v13（prompt 版本或 promptOutline 标记） */
export function isPro2JsonOnlyHubData(
  data: {
    storyPro2PackPromptVersion?: number;
    promptOutline?: string;
  } | null | undefined,
): boolean {
  if (!data) return false;
  if (
    typeof data.storyPro2PackPromptVersion === "number" &&
    data.storyPro2PackPromptVersion >= 13
  ) {
    return true;
  }
  const outline = String(data.promptOutline ?? "");
  return (
    outline.includes("json-only-v13") || outline.includes("JSON-only")
  );
}

/** 是否曾接入 Pro2 剧本链路（脚本 Hub 或关联剧本包）· 纯 starter/生图项目不算 */
export function pro2ProjectHasScriptUsageFromListHints(
  meta: unknown,
  nodeTypes: Iterable<string> | null | undefined,
): boolean {
  const linked = readMeta(meta)?.linkedScriptPackageAssetId?.trim();
  if (linked) return true;
  if (!nodeTypes) return false;
  for (const type of nodeTypes) {
    if (type === PRO2_SCRIPT_HUB_NODE_TYPE) return true;
  }
  return false;
}

export function pro2CanvasHasScriptUsage(canvas: unknown): boolean {
  if (!canvas || typeof canvas !== "object") return false;
  const c = canvas as { meta?: unknown; nodes?: unknown };
  if (pro2ProjectHasScriptUsageFromListHints(c.meta, null)) return true;
  if (!Array.isArray(c.nodes)) return false;
  for (const raw of c.nodes) {
    if (!raw || typeof raw !== "object") continue;
    if ((raw as { type?: unknown }).type === PRO2_SCRIPT_HUB_NODE_TYPE) {
      return true;
    }
  }
  return false;
}

/** edition=pro2 · 无 v13 · 且曾用剧本链路 → 退役（列表不可见、API 404） */
export function isRetiredLegacyPro2FromListHints(
  meta: unknown,
  nodeTypes: Iterable<string> | null | undefined,
): boolean {
  const edition = canvasProjectEditionFromListHints(meta, nodeTypes);
  if (edition !== "pro2") return false;
  if (isActivePro2ScriptFormatV13(meta)) return false;
  return pro2ProjectHasScriptUsageFromListHints(meta, nodeTypes);
}

export function isRetiredLegacyPro2Canvas(canvas: unknown): boolean {
  const edition = canvasProjectEditionFromGraph(canvas);
  if (edition !== "pro2") return false;
  if (!canvas || typeof canvas !== "object") return false;
  const meta = (canvas as { meta?: unknown }).meta;
  if (isActivePro2ScriptFormatV13(meta)) return false;
  return pro2CanvasHasScriptUsage(canvas);
}

/** 新建 Pro2 画布 · 写入 v13 标记 */
export function withPro2ScriptFormatV13Meta<T extends { meta?: unknown }>(
  graph: T,
): T {
  const prev = (graph.meta && typeof graph.meta === "object"
    ? graph.meta
    : {}) as Record<string, unknown>;
  return {
    ...graph,
    meta: {
      ...prev,
      edition: "pro2",
      pro2ScriptFormat: PRO2_SCRIPT_FORMAT_JSON_ONLY_V13,
    },
  };
}
