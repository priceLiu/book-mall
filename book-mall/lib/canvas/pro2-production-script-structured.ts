/**
 * Pro2 制作包 · JSON 围栏提取与 Zod 校验
 * book-mall/lib/canvas/pro2-production-script-structured.ts 须保持同步（runner 校验）
 */
import {
  pro2ProductionScriptPatchSchema,
  PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION,
  type Pro2ProductionScriptPatch,
  type Pro2ProductionScriptStep,
} from "./data/pro2-production-script-schema";

const FENCE_TAG = "pro2-production-script";

const PATCH_BODY_KEYS = new Set([
  "meta",
  "visualStyle",
  "coreConflict",
  "scenes",
  "characters",
  "shots",
  "handoff",
  "props",
  "moods",
  "audios",
]);

/** 仅做 envelope 结构修正（tier 别名、patch 误类型）；字段名须与 schema 一致，不做 alias 兼容 */
export function normalizePro2ProductionScriptEnvelope(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const o = { ...(raw as Record<string, unknown>) };

  if (o.tier === "pro2") o.tier = "pro";

  const patchRaw = o.patch;
  const patchInvalid =
    patchRaw == null ||
    typeof patchRaw !== "object" ||
    Array.isArray(patchRaw);
  if (patchInvalid) {
    const patch: Record<string, unknown> = {};
    if (patchRaw && typeof patchRaw === "object" && !Array.isArray(patchRaw)) {
      Object.assign(patch, patchRaw as Record<string, unknown>);
    }
    for (const key of PATCH_BODY_KEYS) {
      if (o[key] != null) {
        patch[key] = o[key];
        delete o[key];
      }
    }
    o.patch = patch;
  }

  return o;
}

export type Pro2ProductionScriptParseResult =
  | { ok: true; patch: Pro2ProductionScriptPatch }
  | { ok: false; error: string };

/** 严格 Zod 校验；失败返回可读错误（供 Gateway 重试） */
export function parsePro2ProductionScriptEnvelope(
  parsed: unknown,
): Pro2ProductionScriptParseResult {
  const normalized = normalizePro2ProductionScriptEnvelope(parsed);
  const result = pro2ProductionScriptPatchSchema.safeParse(normalized);
  if (result.success) {
    return { ok: true, patch: result.data };
  }
  const issues = result.error.issues
    .slice(0, 8)
    .map((i) => {
      const path = i.path.length ? i.path.join(".") : "root";
      return `${path}: ${i.message}`;
    })
    .join("；");
  return { ok: false, error: issues || "Zod 校验失败" };
}

/** outlineMd / textOutput 是否为未解析的 Pro2 JSON 落库 */
export function isUnparsedPro2ProductionJsonBlob(text: string): boolean {
  const t = text.trim();
  if (!t.startsWith("{")) return false;
  return (
    t.includes('"schemaVersion"') ||
    t.includes('"pro2-production-script"') ||
    t.includes('"patch"')
  );
}

function tryParseJson(raw: string): unknown | null {
  const t = raw.trim();
  if (!t.startsWith("{") && !t.includes("{")) return null;
  const slice = extractBalancedJsonObject(t) ?? t;
  try {
    return JSON.parse(slice) as unknown;
  } catch {
    return null;
  }
}

/** 从文本中提取首个平衡 `{…}`（容忍前缀噪声） */
function extractBalancedJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** 去掉 machine-readable 围栏（含流式未闭合） */
export function stripPro2ProductionScriptFence(text: string): string {
  return text
    .replace(new RegExp(`\`\`\`${FENCE_TAG}[\\s\\S]*?\`\`\``, "gi"), "")
    .replace(new RegExp(`\`\`\`${FENCE_TAG}[\\s\\S]*$`, "gi"), "")
    .trim();
}

/** 围栏已闭合（流式未写完时为 false） */
export function isPro2ProductionScriptFenceComplete(text: string): boolean {
  return new RegExp(`\`\`\`${FENCE_TAG}[\\s\\S]*?\`\`\``, "i").test(text);
}

function extractFenceBody(text: string): string | null {
  const closed = text.match(
    new RegExp(`\`\`\`${FENCE_TAG}\\s*([\\s\\S]*?)\`\`\``, "i"),
  );
  if (closed?.[1]?.trim()) return closed[1].trim();
  const open = text.match(new RegExp(`\`\`\`${FENCE_TAG}\\s*([\\s\\S]*)$`, "i"));
  if (open?.[1]?.trim()) return open[1].trim();
  return null;
}

export function extractPro2ProductionScriptPatch(
  text: string,
): Pro2ProductionScriptPatch | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    const parsed = tryParseJson(trimmed);
    if (parsed) {
      const fromWhole = parsePro2ProductionScriptEnvelope(parsed);
      if (fromWhole.ok) return fromWhole.patch;
    }
  }

  const body = extractFenceBody(text);
  if (body) {
    const parsed = tryParseJson(body);
    if (parsed) {
      const fromFence = parsePro2ProductionScriptEnvelope(parsed);
      if (fromFence.ok) return fromFence.patch;
    }
  }

  const markers = ['{"schemaVersion"', '{"step"', '{"patch"'];
  let idx = -1;
  for (const m of markers) {
    idx = Math.max(idx, text.lastIndexOf(m));
  }
  if (idx >= 0) {
    const sliced = extractBalancedJsonObject(text.slice(idx));
    if (sliced) {
      const parsed = tryParseJson(sliced);
      if (parsed) {
        const fromSlice = parsePro2ProductionScriptEnvelope(parsed);
        if (fromSlice.ok) return fromSlice.patch;
      }
    }
  }
  return null;
}

/** 提取失败时返回 Zod 错误摘要（供 LLM 重试） */
export function describePro2ProductionScriptParseFailure(
  text: string,
): string | null {
  const candidates: string[] = [];
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) candidates.push(trimmed);
  const body = extractFenceBody(text);
  if (body) candidates.push(body);
  const markers = ['{"schemaVersion"', '{"step"', '{"patch"'];
  for (const m of markers) {
    const idx = text.lastIndexOf(m);
    if (idx >= 0) {
      const sliced = extractBalancedJsonObject(text.slice(idx));
      if (sliced) candidates.push(sliced);
    }
  }
  for (const raw of candidates) {
    const parsed = tryParseJson(raw);
    if (!parsed) return "JSON 语法错误（无法 parse）";
    const result = parsePro2ProductionScriptEnvelope(parsed);
    if (!result.ok) return result.error;
  }
  return "未找到 pro2-production-script JSON";
}

export function hasPro2ProductionScriptFence(text: string): boolean {
  return new RegExp(`\`\`\`${FENCE_TAG}`, "i").test(text);
}

/** step 是否匹配 hub LLM section */
export function pro2PatchStepMatchesSection(
  step: Pro2ProductionScriptStep,
  section: "outline" | "character" | "scene" | "storyboard",
): boolean {
  if (section === "outline") {
    return step === "full_pack" || step === "outline";
  }
  if (section === "character") return step === "character" || step === "full_pack";
  if (section === "scene") return step === "scene" || step === "full_pack";
  return step === "storyboard" || step === "full_pack";
}

export { PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION };
