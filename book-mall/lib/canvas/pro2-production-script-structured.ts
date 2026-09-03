/**
 * Pro2 制作包 · JSON 围栏提取与 Zod 校验
 * book-mall/lib/canvas/pro2-production-script-structured.ts 须保持同步（runner 校验）
 */
import {
  normalizePro2CreativeShotDurations,
  pro2ProductionScriptPatchSchema,
  PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION,
  resolvePro2ScriptSource,
  type Pro2ProductionScriptPatch,
  type Pro2ProductionScriptStep,
} from "./data/pro2-production-script-schema";
import { normalizePro2ProductionScriptPatchChinese, pro2PlaceholderSlug } from "./pro2-chinese-prompt-normalize";
import { enrichPro2CharacterRecordForParse } from "./pro2-character-script-fields";
import type { StoryLlmSection } from "./story-workspace-types";

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

const DEFAULT_V2_CAMERA_MOVE = "固定机位，镜头平稳推进，画面稳定";
const DEFAULT_V2_LIGHTING = "自然光，场景氛围与画面描述一致";

function coerceShotRecordForV2Parse(
  shot: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...shot };
  if (!String(out.sceneDescription ?? "").trim()) {
    const desc = String(
      out.description ?? out.scene ?? out.summary ?? "",
    ).trim();
    if (desc) out.sceneDescription = desc;
  }
  if (!String(out.lighting ?? "").trim()) {
    out.lighting = DEFAULT_V2_LIGHTING;
  }
  const move = String(out.cameraMove ?? "").trim();
  if (!move || move.length < 12) {
    out.cameraMove = DEFAULT_V2_CAMERA_MOVE;
  }
  if (!String(out.sfxNote ?? "").trim()) out.sfxNote = "—";
  if (!String(out.audioNote ?? "").trim()) out.audioNote = "—";
  const dur = out.durationSec;
  if (typeof dur !== "number" || !Number.isFinite(dur) || dur <= 0) {
    out.durationSec = 10;
  }
  if (!String(out.dialogue ?? "").trim()) out.dialogue = "—";
  if (!Array.isArray(out.propIds) && Array.isArray(out.props)) {
    out.propIds = out.props;
    delete out.props;
  }
  if (Array.isArray(out.propIds)) {
    out.propIds = out.propIds.map((id) => pro2PlaceholderSlug(String(id)));
  }
  return out;
}

/** LLM 常漏 v2 必填列 · apply 前补默认值以便落库与 Tab 渲染 */
export function coercePro2ProductionScriptEnvelopeForParse(
  parsed: unknown,
): unknown {
  const normalized = normalizePro2ProductionScriptEnvelope(parsed);
  if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
    return normalized;
  }
  const o = { ...(normalized as Record<string, unknown>) };
  const patchRaw = o.patch;
  if (!patchRaw || typeof patchRaw !== "object" || Array.isArray(patchRaw)) {
    return o;
  }
  const patch = { ...(patchRaw as Record<string, unknown>) };
  const schemaVersion =
    typeof o.schemaVersion === "number" ? o.schemaVersion : PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION;
  if (Array.isArray(patch.shots) && patch.shots.length > 0) {
    patch.shots = patch.shots.map((shot) =>
      shot && typeof shot === "object" && !Array.isArray(shot)
        ? coerceShotRecordForV2Parse(shot as Record<string, unknown>)
        : shot,
    );
    const source = resolvePro2ScriptSource(
      patch.meta && typeof patch.meta === "object" && !Array.isArray(patch.meta)
        ? (patch.meta as { source?: string; packProfile?: string })
        : undefined,
    );
    patch.shots = normalizePro2CreativeShotDurations(
      patch.shots as { durationSec?: number }[],
      source,
    );
    o.schemaVersion = schemaVersion >= 2 ? schemaVersion : PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION;
  }
  if (Array.isArray(patch.characters) && patch.characters.length > 0) {
    patch.characters = patch.characters.map((c) =>
      c && typeof c === "object" && !Array.isArray(c)
        ? enrichPro2CharacterRecordForParse(c as Record<string, unknown>)
        : c,
    );
  }
  o.patch = patch;
  return o;
}

export type Pro2ProductionScriptParseResult =
  | { ok: true; patch: Pro2ProductionScriptPatch }
  | { ok: false; error: string };

/** 严格 Zod 校验（不做中文化 normalize · 供 LLM 英文检测） */
export function parsePro2ProductionScriptEnvelopeRaw(
  parsed: unknown,
): Pro2ProductionScriptParseResult {
  const normalized = coercePro2ProductionScriptEnvelopeForParse(parsed);
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

/** 严格 Zod 校验；失败返回可读错误（供 Gateway 重试） */
export function parsePro2ProductionScriptEnvelope(
  parsed: unknown,
): Pro2ProductionScriptParseResult {
  const raw = parsePro2ProductionScriptEnvelopeRaw(parsed);
  if (!raw.ok) return raw;
  return {
    ok: true,
    patch: normalizePro2ProductionScriptPatchChinese(raw.patch),
  };
}

/** outlineMd / textOutput 是否为未解析的 Pro2 JSON 落库 */
export function hasHumanReadableProductionPackSections(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const hasStyle =
    /(?:^|\n)\s*(?:##\s*)?视觉风格总纲\s*$/im.test(t);
  const hasPackSection =
    /(?:^|\n)\s*(?:##\s*)?(?:场景视觉辞典|角色视觉辞典|核心冲突与结构摘要|核心冲突|分镜脚本|下一步交接清单|道具视觉辞典)\s*$/im.test(
      t,
    );
  const hasCharacterTable =
    /角色视觉辞典/.test(t) && /\|\s*姓名\s*\|/.test(t);
  const hasSceneTable =
    /场景视觉辞典/.test(t) && /\|\s*场景名\s*\|/.test(t);
  const hasStoryboardTable =
    /分镜脚本/.test(t) && /\|\s*镜号\s*\|/.test(t);
  if (hasCharacterTable || hasSceneTable || hasStoryboardTable) return true;
  return hasStyle && hasPackSection;
}

/** 去掉末尾 pro2-production-script JSON · 保留人读 Markdown 段 */
export function stripTrailingPro2ProductionScriptJson(text: string): string {
  const t = text.trim();
  if (!t) return t;
  const markers = [
    '{"schemaVersion"',
    '"schemaVersion"',
    '"step":',
    '"patch":',
  ];
  let cutAt = -1;
  for (const marker of markers) {
    const idx = t.lastIndexOf(marker);
    if (idx < 0) continue;
    const braceIdx = t.lastIndexOf("{", idx);
    if (braceIdx >= 0 && (cutAt < 0 || braceIdx < cutAt)) cutAt = braceIdx;
  }
  if (cutAt <= 0) return t;
  const prefix = t.slice(0, cutAt).trim();
  return prefix || t;
}

/** LLM 完整输出 · 人读 Markdown 前缀（去围栏与尾 JSON · 对齐 docs/画布大模型代码解析.md beforeJSON） */
export function extractPro2HumanProductionPackPrefix(text: string): string {
  return stripPro2ProductionScriptFence(
    stripTrailingPro2ProductionScriptJson(text ?? ""),
  ).trim();
}

export function isUnparsedPro2ProductionJsonBlob(text: string): boolean {
  const t = text.trim();
  if (!t) return false;

  if (hasHumanReadableProductionPackSections(t)) return false;
  const humanPrefix = stripTrailingPro2ProductionScriptJson(t);
  if (
    humanPrefix !== t &&
    hasHumanReadableProductionPackSections(humanPrefix)
  ) {
    return false;
  }

  // 已成功渲染为 GFM 的制作包 Markdown · 不是 raw JSON 落库
  if (/##\s*视觉风格总纲/i.test(t) && /\|\s*维度\s*\|/i.test(t)) return false;
  if (/##\s*核心冲突/i.test(t) && /\|\s*维度\s*\|/i.test(t)) return false;
  if (/##\s*场景视觉辞典/i.test(t)) return false;
  if (/##\s*角色视觉辞典/i.test(t)) return false;
  if (/##\s*分镜脚本/i.test(t) && /^\|\s*镜号/im.test(t)) return false;

  const looksLikePro2Json =
    t.includes('"schemaVersion"') ||
    t.includes('"pro2-production-script"') ||
    (t.includes('"patch"') &&
      (t.includes('"visualStyle"') ||
        t.includes('"shots"') ||
        t.includes('"characters"')));
  if (!looksLikePro2Json) return false;
  if (t.startsWith("{")) return true;
  if (/^##\s*分镜脚本/i.test(t) && t.includes('"patch"')) return true;
  return t.includes('"patch"') && !/^\|\s*镜号/im.test(t);
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

/** 从含 Markdown 噪声的文本中收集可 parse 的 JSON 对象候选 */
function collectPro2ProductionScriptJsonCandidates(text: string): string[] {
  const out: string[] = [];
  const pushUnique = (candidate: string | null | undefined) => {
    const t = candidate?.trim();
    if (!t || !t.startsWith("{")) return;
    if (!out.includes(t)) out.push(t);
  };

  pushUnique(extractBalancedJsonObject(text.trim()));

  const markers = ['{"schemaVersion"', '{"step"', '{"patch"', '"patch"'];
  for (const marker of markers) {
    let from = 0;
    while (from < text.length) {
      const idx = text.indexOf(marker, from);
      if (idx < 0) break;
      const braceIdx = text.lastIndexOf("{", idx);
      if (braceIdx >= 0) {
        pushUnique(extractBalancedJsonObject(text.slice(braceIdx)));
      }
      from = idx + marker.length;
    }
  }

  let from = 0;
  while (from < text.length) {
    const braceIdx = text.indexOf("{", from);
    if (braceIdx < 0) break;
    pushUnique(extractBalancedJsonObject(text.slice(braceIdx)));
    from = braceIdx + 1;
  }

  return out;
}

export function extractPro2ProductionScriptPatch(
  text: string,
): Pro2ProductionScriptPatch | null {
  return extractPro2ProductionScriptPatchInternal(text, "normalized");
}

/** LLM 校验用 · 返回 normalize 前 patch（用于英文检测） */
export function extractPro2ProductionScriptPatchRaw(
  text: string,
): Pro2ProductionScriptPatch | null {
  return extractPro2ProductionScriptPatchInternal(text, "raw");
}

function extractPro2ProductionScriptPatchInternal(
  text: string,
  mode: "raw" | "normalized",
): Pro2ProductionScriptPatch | null {
  const parse = (parsed: unknown) =>
    mode === "raw"
      ? parsePro2ProductionScriptEnvelopeRaw(parsed)
      : parsePro2ProductionScriptEnvelope(parsed);

  const body = extractFenceBody(text);
  if (body) {
    const parsed = tryParseJson(body);
    if (parsed) {
      const fromFence = parse(parsed);
      if (fromFence.ok) return fromFence.patch;
    }
  }

  for (const candidate of collectPro2ProductionScriptJsonCandidates(text)) {
    const parsed = tryParseJson(candidate);
    if (!parsed) continue;
    const result = parse(parsed);
    if (result.ok) return result.patch;
  }
  return null;
}

/** 提取失败时返回 Zod 错误摘要（供 LLM 重试） */
export function describePro2ProductionScriptParseFailure(
  text: string,
): string | null {
  const candidates: string[] = [];
  const body = extractFenceBody(text);
  if (body) candidates.push(body);
  for (const candidate of collectPro2ProductionScriptJsonCandidates(text)) {
    if (!candidates.includes(candidate)) candidates.push(candidate);
  }
  for (const raw of candidates) {
    const parsed = tryParseJson(raw);
    if (!parsed) return "JSON 语法错误（无法 parse）";
    const result = parsePro2ProductionScriptEnvelopeRaw(parsed);
    if (!result.ok) return result.error;
  }
  return "未找到 pro2-production-script JSON";
}

export function hasPro2ProductionScriptFence(text: string): boolean {
  return new RegExp(`\`\`\`${FENCE_TAG}`, "i").test(text);
}

export function pro2PatchStepMatchesSection(
  step: Pro2ProductionScriptStep,
  section: StoryLlmSection,
): boolean {
  if (section === "shot_prompts") return step === "shot_prompts";
  if (section === "outline") {
    return step === "full_pack" || step === "outline";
  }
  if (section === "character") return step === "character" || step === "full_pack";
  if (section === "scene") return step === "scene" || step === "full_pack";
  return step === "storyboard" || step === "full_pack";
}

export { PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION };
