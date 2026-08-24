import type { CanvasTaskRecord } from "@/lib/canvas-api";
import {
  ensureStoryboardAiVideoPromptsMd,
  stripOutlineCharacterTable,
  stripOutlineEmbeddedPackSections,
  extractCharacterSectionFromOutline,
  extractSceneSectionMd,
  normalizeOutlineSection,
  normalizeStoryboardSectionFromOutline,
  parseStoryboardRows,
  resolveSceneDictionaryMarkdown,
  storyboardMdHasParseableRows,
  convertPro2HumanTabMarkdownToGfm,
  extractPro2OutlineDisplayMdFromHumanGfm,
  extractPro2HumanStoryboardMd,
  promotePro2HumanGfmToHubFields,
} from "./parse-md-tables";
import { storyboardMeetsMinimumShotCount } from "./pro2-storyboard-shot-budget";
import { storyboardMeetsPackQuality } from "./pro2-pack-readiness";
import { isCanvasNodeRunSessionActive } from "./canvas-run-session";
import { isCanvasInflightStatus } from "./story-column-runtime";
import type { CanvasFlowNode, CanvasNodeRuntime } from "./types";
import {
  extractPro2HumanProductionPackPrefix,
  hasHumanReadableProductionPackSections,
  isUnparsedPro2ProductionJsonBlob,
  stripTrailingPro2ProductionScriptJson,
} from "./pro2-production-script-structured";
import { renderHubOutlineDisplayMd, renderProductionScriptStoryboardMd, enrichStoryboardMdShotFields } from "./pro2-production-script-render-md";
import {
  ensurePro2ProductionScriptSchemaVersion,
} from "./data/pro2-production-script-schema";
import {
  resolveHubProductionScript,
  tryRepairHubFromStoredProductionJson,
} from "./pro2-production-script-apply";
import type { StoryProScriptHubNodeData } from "./story-pro-workspace-types";
import type { StoryLlmSection, StoryScriptHubNodeData } from "./story-workspace-types";
import { pushStoryRevision } from "./story-revision";

const HUB_INFLIGHT_SERVER_STATUSES = new Set([
  "QUEUED",
  "DISPATCHING",
  "PENDING",
  "SUBMITTED",
]);

export function hubSectionRuntime(
  node: CanvasFlowNode,
  section: StoryLlmSection,
): CanvasNodeRuntime | undefined {
  const d = node.data as unknown as StoryScriptHubNodeData;
  if (section === "outline") return d.outlineRuntime;
  if (section === "character") return d.characterRuntime;
  if (section === "scene") return d.sceneRuntime;
  return d.storyboardRuntime;
}

/** 故事大纲落库：剥离嵌入段 / 简表，不做预览排版 */
function outlineStripMd(md: string): string {
  return stripOutlineEmbeddedPackSections(stripOutlineCharacterTable(md ?? ""));
}

/** 故事大纲展示用（不含人物表简表与嵌入的制作包段落） */
export function outlineDisplayMd(md: string): string {
  return outlineStripMd(md ?? "");
}

/** 从 Hub 各来源解析人读分镜段（优先 full_pack 原文 · 不用已 normalize 的空道具/音效 storyboardMd） */
function resolvePro2HumanStoryboardFromHubSources(
  d: StoryProScriptHubNodeData,
): string {
  const sources = [
    d.outlineRuntime?.textOutput,
    d.outlineMd,
    d.storyboardRuntime?.textOutput,
  ];
  for (const raw of sources) {
    if (!raw?.trim()) continue;
    const fromPack = resolvePro2StoryboardMdFromPackSource(raw);
    if (storyboardMdHasParseableRows(fromPack)) return fromPack;
  }
  return "";
}

export function resolvePro2HumanGfmFromHubSources(
  d: StoryProScriptHubNodeData,
): string {
  const sources = [
    d.outlineRuntime?.textOutput,
    d.outlineMd,
    d.storyboardRuntime?.textOutput,
    d.storyboardMd,
    d.characterRuntime?.textOutput,
  ];
  for (const raw of sources) {
    if (!raw?.trim()) continue;
    const gfm = convertPro2HumanTabMarkdownToGfm(
      extractPro2HumanProductionPackPrefix(raw),
    );
    if (hasHumanReadableProductionPackSections(gfm)) return gfm;
  }
  return "";
}

/** 统计制作包大纲章节数（GFM ## 或人读标题） */
function countPro2OutlinePackSections(md: string): number {
  const t = md.trim();
  if (!t) return 0;
  const gfm = t.match(
    /^##\s+(?:视觉风格总纲|场景视觉辞典|核心冲突|角色视觉辞典|下一步交接清单)/gm,
  );
  if (gfm?.length) return gfm.length;
  const plain = t.match(
    /^(?:视觉风格总纲|场景视觉辞典|核心冲突与结构摘要|角色视觉辞典|下一步交接清单)$/gm,
  );
  return plain?.length ?? 0;
}

/** Pro2 Hub 大纲 Tab：优先人读 Markdown（docs/画布大模型代码解析.md beforeJSON）；JSON 仅作回落 */
export function resolveHubOutlineMd(d: StoryScriptHubNodeData): string {
  const pro2 = d as StoryProScriptHubNodeData;
  const humanGfm = resolvePro2HumanGfmFromHubSources(pro2);
  if (humanGfm) {
    const outline = extractPro2OutlineDisplayMdFromHumanGfm(humanGfm);
    if (outline.trim() && countPro2OutlinePackSections(outline) >= 1) {
      return outline;
    }
  }

  const raw = (pro2.outlineMd ?? "").trim();
  const script = resolveHubProductionScript(pro2);
  const stored = pro2.productionScript
    ? ensurePro2ProductionScriptSchemaVersion(pro2.productionScript)
    : null;

  if (script) {
    const rendered = renderHubOutlineDisplayMd(
      ensurePro2ProductionScriptSchemaVersion(script),
    );
    if (rendered.trim()) return rendered;
  }
  if (stored) {
    const rendered = renderHubOutlineDisplayMd(stored);
    if (rendered.trim()) return rendered;
  }

  const humanPrefix = convertPro2HumanTabMarkdownToGfm(
    extractPro2HumanProductionPackPrefix(raw),
  );
  if (hasHumanReadableProductionPackSections(humanPrefix)) {
    return extractPro2OutlineDisplayMdFromHumanGfm(humanPrefix);
  }

  if (isUnparsedPro2ProductionJsonBlob(raw)) return "";
  if (pro2.productionScript || script || stored) {
    return extractPro2OutlineDisplayMdFromHumanGfm(humanPrefix) || raw;
  }
  return outlineDisplayMd(raw);
}

/** 解析各 Tab 展示/编辑用 Markdown：优先独立字段，否则从大纲嵌入段回落 */
export function resolveHubSectionMd(
  d: StoryScriptHubNodeData,
  section: HubPreviewSection,
): string {
  if (section === "outline") {
    return resolveHubOutlineMd(d);
  }
  if (section === "character") {
    const dedicated = (d.characterMd ?? "").trim();
    if (dedicated) return dedicated;
    return extractCharacterSectionFromOutline(d.outlineMd ?? "");
  }
  if (section === "scene") {
    return resolveSceneDictionaryMarkdown(d.outlineMd ?? "", d.sceneMd ?? "");
  }
  if (section === "storyboard") {
    const dedicated = (d.storyboardMd ?? "").trim();
    if (dedicated) return dedicated;
    return normalizeStoryboardSectionFromOutline(d.outlineMd ?? "");
  }
  const storyboard = resolveHubSectionMd(d, "storyboard");
  return hubDialoguePreviewMd(storyboard);
}

function resolveHubStoryboardHumanFallbackMd(
  pro2Data: StoryProScriptHubNodeData,
): string {
  const sources = [
    pro2Data.outlineRuntime?.textOutput,
    pro2Data.outlineMd,
    pro2Data.storyboardRuntime?.textOutput,
  ];
  for (const raw of sources) {
    if (!raw?.trim()) continue;
    const fromPack = resolvePro2StoryboardMdFromPackSource(raw);
    if (storyboardMdHasParseableRows(fromPack)) return fromPack;
  }
  return "";
}

function finalizeHubStoryboardMd(
  pro2Data: StoryProScriptHubNodeData,
  storyboardMd: string,
): string {
  if (!storyboardMd.trim() || !storyboardMdHasParseableRows(storyboardMd)) {
    return storyboardMd;
  }
  const script = resolveHubProductionScript(pro2Data);
  if (!script) return ensureStoryboardAiVideoPromptsMd(storyboardMd);
  const fallback = resolveHubStoryboardHumanFallbackMd(pro2Data);
  const enriched = enrichStoryboardMdShotFields(
    storyboardMd,
    fallback && fallback !== storyboardMd ? fallback : fallback || undefined,
    script,
  );
  return ensureStoryboardAiVideoPromptsMd(enriched);
}

export function resolveHubStoryboardMd(d: StoryScriptHubNodeData): string {
  const pro2Data = d as StoryProScriptHubNodeData;
  const humanFallback =
    resolveHubStoryboardHumanFallbackMd(pro2Data) ||
    resolvePro2HumanStoryboardFromHubSources(pro2Data);
  const humanGfm = resolvePro2HumanGfmFromHubSources(pro2Data);
  const resolvedScript = resolveHubProductionScript(pro2Data);

  // 优先 JSON shots 渲染 + 人读 fallback 合并（道具/音效在 JSON propIds / 人读表）
  if (resolvedScript?.shots?.length) {
    const normalized = ensurePro2ProductionScriptSchemaVersion(resolvedScript);
    const rendered = renderProductionScriptStoryboardMd(normalized);
    const enriched = enrichStoryboardMdShotFields(
      rendered,
      humanFallback || undefined,
      normalized,
    );
    if (storyboardMdHasParseableRows(enriched)) {
      return ensureStoryboardAiVideoPromptsMd(enriched);
    }
  }

  if (humanFallback && storyboardMdHasParseableRows(humanFallback)) {
    return finalizeHubStoryboardMd(pro2Data, humanFallback);
  }

  if (humanGfm) {
    const fromHuman = extractPro2HumanStoryboardMd(humanGfm);
    if (storyboardMdHasParseableRows(fromHuman)) {
      return finalizeHubStoryboardMd(pro2Data, fromHuman);
    }
  }

  const synced = hubDataForColumnSync(d);
  const storyboard =
    (pro2Data.storyboardMd ?? "").trim() ||
    (synced.storyboardMd ?? "").trim() ||
    resolveHubSectionMd(synced, "storyboard");
  if (isUnparsedPro2ProductionJsonBlob(storyboard)) return "";
  if (!storyboardMdHasParseableRows(storyboard)) return "";
  return finalizeHubStoryboardMd(pro2Data, storyboard);
}

/** 将大纲嵌入段拆入 hub 各字段，供 syncColumnsFromHub 使用 */
export function hubOutlineSourceForEmbeddedPromote(
  d: StoryScriptHubNodeData,
): string {
  const fromRuntime = d.outlineRuntime?.textOutput?.trim();
  if (fromRuntime && outlineTextHasEmbeddedProductionPack(fromRuntime)) {
    return fromRuntime;
  }
  const fromMd = d.outlineMd?.trim() ?? "";
  if (outlineTextHasEmbeddedProductionPack(fromMd)) return fromMd;
  return fromRuntime || fromMd;
}

/** full-pack 重生成后，子段 runtime 仍绑旧 task 或未从 outline 重拆 */
export function hubEmbeddedPackSectionsStale(
  d: StoryScriptHubNodeData,
): boolean {
  const outlineTaskId = d.outlineRuntime?.taskId;
  if (!outlineTaskId || d.outlineRuntime?.status !== "done") return false;
  const source = hubOutlineSourceForEmbeddedPromote(d);
  if (!outlineTextHasEmbeddedProductionPack(source)) return false;
  const sectionTaskIds = [
    d.characterRuntime?.taskId,
    d.sceneRuntime?.taskId,
    d.storyboardRuntime?.taskId,
  ].filter(Boolean);
  if (sectionTaskIds.some((id) => id !== outlineTaskId)) return true;
  return sectionTaskIds.length === 0 && Boolean(d.characterMd?.trim());
}

function shouldReplaceEmbeddedHubSections(d: StoryScriptHubNodeData): boolean {
  const source = hubOutlineSourceForEmbeddedPromote(d);
  if (!outlineTextHasEmbeddedProductionPack(source)) return false;
  if (hubEmbeddedPackSectionsStale(d)) return true;
  return !(d.characterMd ?? "").trim();
}

export function buildHubEmbeddedPackRepairPatch(
  d: StoryScriptHubNodeData,
): Partial<StoryScriptHubNodeData> {
  if (!hubEmbeddedPackSectionsStale(d)) return {};
  const source = hubOutlineSourceForEmbeddedPromote(d);
  if (!source.trim()) return {};
  const promoted = promoteEmbeddedPackFromOutline(source, "", "", "");
  const { outlineMd, characterMd } = normalizeOutlineSection(
    promoted.outlineMd,
    promoted.characterMd,
  );
  const taskId = d.outlineRuntime?.taskId;
  const derivedRuntime: CanvasNodeRuntime | undefined = taskId
    ? {
        status: "done",
        taskId,
        failCode: undefined,
        failMessage: undefined,
      }
    : undefined;
  const patch: Partial<StoryScriptHubNodeData> = {};
  if (outlineMd !== (d.outlineMd ?? "")) patch.outlineMd = outlineMd;
  if (characterMd !== (d.characterMd ?? "")) {
    patch.characterMd = characterMd;
    if (derivedRuntime) patch.characterRuntime = derivedRuntime;
  }
  if (
    promoted.sceneMd.trim() &&
    promoted.sceneMd !== (d.sceneMd ?? "")
  ) {
    patch.sceneMd = promoted.sceneMd;
    if (derivedRuntime) patch.sceneRuntime = derivedRuntime;
  }
  if (
    storyboardMdHasParseableRows(promoted.storyboardMd) &&
    promoted.storyboardMd.trim() &&
    promoted.storyboardMd !== (d.storyboardMd ?? "")
  ) {
    patch.storyboardMd = promoted.storyboardMd;
    if (derivedRuntime) patch.storyboardRuntime = derivedRuntime;
  }
  return patch;
}

/** 大纲已落库但 storyboardMd / productionScript 缺失时，从 textOutput 或 outline 原文补分镜表 */
export function buildHubStoryboardBackfillPatch(
  d: StoryScriptHubNodeData,
): Partial<StoryScriptHubNodeData> {
  const pro2 = d as StoryProScriptHubNodeData;
  if (storyboardMdHasParseableRows(pro2.storyboardMd ?? "")) return {};
  if ((pro2.productionScript?.shots?.length ?? 0) > 0) return {};
  const source =
    pro2.outlineRuntime?.textOutput?.trim() ||
    hubOutlineSourceForEmbeddedPromote(pro2);
  if (!source.trim()) return {};
  const storyboardMd = resolvePro2StoryboardMdFromPackSource(source);
  if (!storyboardMdHasParseableRows(storyboardMd)) return {};
  if (storyboardMd === (pro2.storyboardMd ?? "")) return {};
  return {
    storyboardMd,
    storyboardHistory: pushStoryRevision(pro2.storyboardHistory, storyboardMd),
  };
}

export function repairHubEmbeddedPackSections(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  return nodes.map((node) => {
    if (
      node.type !== "story-pro2-script-hub" &&
      node.type !== "story-pro-script-hub" &&
      node.type !== "story-script-hub"
    ) {
      return node;
    }
    const d = node.data as unknown as StoryScriptHubNodeData;
    const patch = buildHubEmbeddedPackRepairPatch(d);
    if (!Object.keys(patch).length) return node;
    return { ...node, data: { ...node.data, ...patch } };
  });
}

/** 将误写入 outlineMd 的 raw JSON 解析为 productionScript + 各 Tab Markdown */
export function repairHubStructuredProductionScriptNodes(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  return nodes.map((node) => {
    if (node.type !== "story-pro2-script-hub") return node;
    const d = node.data as unknown as StoryProScriptHubNodeData;
    const patch = tryRepairHubFromStoredProductionJson(d, node.id);
    if (!patch || !Object.keys(patch).length) return node;
    return { ...node, data: { ...node.data, ...patch } };
  });
}

export function hubDataForColumnSync(
  d: StoryScriptHubNodeData,
): StoryScriptHubNodeData {
  const outlineSource = hubOutlineSourceForEmbeddedPromote(d);
  const replaceEmbedded = shouldReplaceEmbeddedHubSections(d);
  const promoted = promoteEmbeddedPackFromOutline(
    outlineSource,
    replaceEmbedded ? "" : (d.characterMd ?? ""),
    replaceEmbedded ? "" : (d.storyboardMd ?? ""),
    replaceEmbedded ? "" : (d.sceneMd ?? ""),
  );
  return {
    ...d,
    outlineMd: promoted.outlineMd || d.outlineMd || "",
    characterMd: promoted.characterMd || d.characterMd || "",
    sceneMd: promoted.sceneMd || d.sceneMd || "",
    storyboardMd: promoted.storyboardMd || d.storyboardMd || "",
  };
}

/** 保存大纲时：将嵌入的制作包段落拆到独立字段，避免其他 Tab 读不到 */
export function outlineTextHasEmbeddedProductionPack(md: string): boolean {
  return (
    /##\s*角色视觉辞典/.test(md) ||
    /##\s*分镜脚本/.test(md) ||
    /##\s*场景视觉辞典/.test(md)
  );
}

/** 从 full_pack 原文（Tab/GFM + JSON）解析人读分镜段 · 供 promote / resolve 共用 */
export function resolvePro2StoryboardMdFromPackSource(raw: string): string {
  if (!raw?.trim()) return "";
  const prefix = extractPro2HumanProductionPackPrefix(raw);
  const gfm = convertPro2HumanTabMarkdownToGfm(prefix);
  const human = extractPro2HumanStoryboardMd(gfm);
  if (storyboardMdHasParseableRows(human)) return human;
  const fromGfm = normalizeStoryboardSectionFromOutline(gfm);
  if (storyboardMdHasParseableRows(fromGfm)) return fromGfm;
  const fromRaw = normalizeStoryboardSectionFromOutline(raw);
  if (storyboardMdHasParseableRows(fromRaw)) return fromRaw;
  return "";
}

/** 保存大纲时：将嵌入的制作包段落拆到独立字段，避免其他 Tab 读不到 */
export function promoteEmbeddedPackFromOutline(
  outlineMd: string,
  characterMd = "",
  storyboardMd = "",
  sceneMd = "",
): {
  outlineMd: string;
  characterMd: string;
  sceneMd: string;
  storyboardMd: string;
} {
  const humanGfm = convertPro2HumanTabMarkdownToGfm(
    extractPro2HumanProductionPackPrefix(outlineMd),
  );
  const humanFields = hasHumanReadableProductionPackSections(humanGfm)
    ? promotePro2HumanGfmToHubFields(humanGfm)
    : null;
  return {
    outlineMd: outlineStripMd(outlineMd),
    characterMd:
      characterMd.trim() ||
      humanFields?.characterMd?.trim() ||
      extractCharacterSectionFromOutline(outlineMd),
    sceneMd:
      sceneMd.trim() ||
      humanFields?.sceneMd?.trim() ||
      resolveSceneDictionaryMarkdown(outlineMd, sceneMd),
    storyboardMd:
      storyboardMd.trim() ||
      humanFields?.storyboardMd?.trim() ||
      resolvePro2StoryboardMdFromPackSource(outlineMd),
  };
}

export function hubSectionMd(
  node: CanvasFlowNode,
  section: StoryLlmSection,
): string {
  const d = node.data as unknown as StoryScriptHubNodeData;
  if (section === "outline") return d.outlineMd ?? "";
  if (section === "character") return d.characterMd ?? "";
  if (section === "scene") return d.sceneMd ?? "";
  return d.storyboardMd ?? "";
}

export function hubSectionNeedsRun(
  node: CanvasFlowNode,
  section: StoryLlmSection,
  forceFresh: boolean,
): boolean {
  if (forceFresh) return true;
  const rt = hubSectionRuntime(node, section);
  const md = hubSectionMd(node, section);
  if (rt?.status === "error") return true;
  if (!md.trim()) return true;
  if (
    section === "storyboard" &&
    md.trim() &&
    rt?.status === "done" &&
    !forceFresh
  ) {
    const d = node.data as unknown as StoryScriptHubNodeData;
    if (
      !storyboardMeetsMinimumShotCount(md, d.outlineMd ?? "") ||
      !storyboardMeetsPackQuality(md, d.outlineMd ?? "")
    ) {
      return true;
    }
  }
  if (rt?.status === "done" && md.trim()) return false;
  return true;
}

export function hubSectionIsComplete(
  node: CanvasFlowNode,
  section: StoryLlmSection,
): boolean {
  return hubSectionIsReady(node, section);
}

/** 段就绪：须有独字段落库且未在跑/失败（大纲嵌入段仅展示，不算 LLM 完成） */
export function hubSectionIsReady(
  node: CanvasFlowNode,
  section: StoryLlmSection,
): boolean {
  const dedicated = hubSectionMd(node, section).trim();
  if (!dedicated) return false;
  const st = hubSectionRuntime(node, section)?.status;
  if (st === "running" || st === "pending" || st === "error") return false;
  if (section === "storyboard") {
    const d = node.data as unknown as StoryScriptHubNodeData;
    if (
      !storyboardMeetsMinimumShotCount(dedicated, d.outlineMd ?? "") ||
      !storyboardMeetsPackQuality(dedicated, d.outlineMd ?? "")
    ) {
      return false;
    }
  }
  return true;
}

export function hubSectionIsRunning(
  node: CanvasFlowNode,
  section: StoryLlmSection,
): boolean {
  const rt = hubSectionRuntime(node, section);
  const st = rt?.status;
  if (st === "running") return true;
  // pending 含无 taskId：顺序链占位 / 提交前乐观态，须立刻展示「生成中」
  if (st === "pending") return true;
  if (st === "queued") return true;
  return false;
}

/**
 * 段已有落库内容且本地 runtime 已 idle 时，勿误用旧轮询写回覆盖；
 * 但用户本轮重生成（run session）或服务端新 taskId 仍须同步「生成中」。
 */
export function shouldSkipHubSectionInflightTaskApply(
  node: CanvasFlowNode,
  section: StoryLlmSection,
  task: Pick<CanvasTaskRecord, "id" | "status">,
): boolean {
  if (!HUB_INFLIGHT_SERVER_STATUSES.has(task.status)) return false;
  if (!hubSectionIsReady(node, section)) return false;
  const rt = hubSectionRuntime(node, section);
  if (isCanvasInflightStatus(rt?.status)) return false;
  if (isCanvasNodeRunSessionActive(node.id)) return false;

  const prevTaskId = rt?.taskId?.trim();
  const taskId = task.id?.trim();
  if (prevTaskId && taskId && prevTaskId !== taskId) return false;
  if (!prevTaskId) return false;

  return true;
}

/** 顺序链启动时写入段级 pending（与 storyRunPendingPatch 一致） */
export function hubSectionPendingPatch(
  section: StoryLlmSection,
): Record<string, unknown> {
  const rt = {
    status: "pending" as const,
    failCode: undefined,
    failMessage: undefined,
  };
  if (section === "outline") return { outlineRuntime: rt };
  if (section === "character") return { characterRuntime: rt };
  if (section === "scene") return { sceneRuntime: rt };
  return { storyboardRuntime: rt };
}

export function hubSectionHasTerminalError(
  node: CanvasFlowNode,
  section: StoryLlmSection,
): boolean {
  return hubSectionRuntime(node, section)?.status === "error";
}

/** 顶栏任务计数 / 轮询：与 hubSectionIsRunning 一致（含顺序链 pending 占位） */
export function hubSectionCountsAsInflight(
  rt?: { status?: string; taskId?: string },
): boolean {
  const st = rt?.status;
  if (st === "running") return true;
  if (st === "queued") return true;
  if (st === "pending") return true;
  return false;
}

/** forceFresh 重跑前清掉未完成的段 runtime，避免顺序链 activeKey 卡死 */
export function clearHubSectionRuntimesForForceFresh(
  sections: readonly StoryLlmSection[],
): Record<string, undefined> {
  const patch: Record<string, undefined> = {};
  for (const section of sections) {
    if (section === "outline") patch.outlineRuntime = undefined;
    else if (section === "character") patch.characterRuntime = undefined;
    else if (section === "scene") patch.sceneRuntime = undefined;
    else patch.storyboardRuntime = undefined;
  }
  return patch;
}

/** forceFresh 重跑前清空待生成段的独字段，避免 finally 误判为已完成 */
export function clearHubSectionMdForForceFresh(
  sections: readonly StoryLlmSection[],
): Record<string, string> {
  const patch: Record<string, string> = {};
  for (const section of sections) {
    if (section === "outline") patch.outlineMd = "";
    else if (section === "character") patch.characterMd = "";
    else if (section === "scene") patch.sceneMd = "";
    else patch.storyboardMd = "";
  }
  return patch;
}

export function hubDialogueIsReady(storyboardMd: string): boolean {
  const rows = parseStoryboardRows(storyboardMd ?? "");
  if (!rows.length) return false;
  return rows.some((r) => {
    const d = (r.dialogue ?? "").trim();
    return d.length > 0 && d !== "—" && d !== "-";
  });
}

export function hubAggregateStatus(
  node: CanvasFlowNode,
): "idle" | "running" | "done" | "error" {
  const d = node.data as unknown as StoryScriptHubNodeData;
  const sections = ["outline", "character", "scene", "storyboard"] as const;
  if (sections.some((s) => hubSectionRuntime(node, s)?.status === "error")) {
    return "error";
  }
  if (sections.some((s) => hubSectionIsRunning(node, s))) return "running";
  const scriptReady =
    sections.every((s) => hubSectionIsReady(node, s)) &&
    hubDialogueIsReady(resolveHubStoryboardMd(d));
  if (scriptReady) return "done";
  return "idle";
}

/** 剧本 Hub 是否展示生成中 UI（扫光）；intent 仅入队首帧占位 */
export function hubShowsGeneratingUi(
  node: CanvasFlowNode,
  hubGenerateIntent?: boolean,
  serverHubInflight?: boolean,
): boolean {
  const sections = ["outline", "character", "scene", "storyboard"] as const;
  if (sections.some((s) => hubSectionIsRunning(node, s))) return true;
  if (serverHubInflight) return true;
  if (isCanvasNodeRunSessionActive(node.id)) return true;
  if (!hubGenerateIntent) return false;

  const statuses = sections.map((s) => hubSectionRuntime(node, s)?.status);
  const anyError = statuses.some((st) => st === "error");
  const allIdleOrTerminal = statuses.every(
    (st) => !st || st === "idle" || st === "done" || st === "error",
  );
  // 换模型重试：上一轮 error 但尚无新的 pending/running
  if (anyError && allIdleOrTerminal) return true;

  const anySectionTouched = statuses.some((st) => st != null && st !== "idle");
  return !anySectionTouched;
}

/** hydrate：清掉不应再扫光却仍落库的 hubGenerateIntent */
export function stripStaleHubGenerateIntent(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  return nodes.map((node) => {
    if (
      node.type !== "story-pro2-script-hub" &&
      node.type !== "story-pro-script-hub" &&
      node.type !== "story-script-hub"
    ) {
      return node;
    }
    const d = node.data as { hubGenerateIntent?: boolean };
    if (!d.hubGenerateIntent) return node;
    if (hubShowsGeneratingUi(node, true)) return node;
    return {
      ...node,
      data: { ...node.data, hubGenerateIntent: undefined },
    };
  });
}

/** 是否允许「定稿生成工作流」：至少有大纲且大纲段未在跑/失败 */
export function hubCanOutputWorkflow(node: CanvasFlowNode): boolean {
  const d = node.data as unknown as StoryScriptHubNodeData;
  if (hubSectionRuntime(node, "outline")?.status === "error") return false;
  if (hubSectionIsRunning(node, "outline")) return false;
  return Boolean(resolveHubSectionMd(d, "outline").trim());
}

/** 故事大纲是否已定稿（生成工作流后锁定，删列后解除） */
export function hubIsScriptFinalized(
  d: StoryScriptHubNodeData,
): boolean {
  return Boolean(d.scriptFinalized);
}

/** 定稿前可编辑；定稿后仅只读审阅（删本套媒体列后 reconcile 解除定稿） */
export function hubScriptEditable(
  d: StoryScriptHubNodeData,
  hasMediaColumns: boolean,
): boolean {
  if (!hubIsScriptFinalized(d)) return true;
  return !hasMediaColumns;
}

export function hubPreviewMarkdown(d: StoryScriptHubNodeData): string {
  const outline = outlineDisplayMd(d.outlineMd ?? "").trim();
  const character = (d.characterMd ?? "").trim();
  const storyboard = (d.storyboardMd ?? "").trim();
  if (outline) return outline;
  if (character) return character;
  if (storyboard) return storyboard;
  return "";
}

export function hubDialoguePreviewMd(storyboardMd: string): string {
  const rows = parseStoryboardRows(storyboardMd ?? "");
  if (!rows.length) return "";
  return rows
    .map(
      (r) =>
        `**镜 ${r.frameIndex}** · ${r.scene || "场景"}\n\n${(r.dialogue ?? "").trim() || "—"}`,
    )
    .join("\n\n---\n\n");
}

export type HubPreviewSection = StoryLlmSection | "dialogue";

export function hubSectionPreviewContent(
  d: StoryScriptHubNodeData,
  section: HubPreviewSection,
): string {
  if (section === "outline") {
    return (d.outlineMd ?? "").trim();
  }
  return resolveHubSectionMd(d, section);
}
