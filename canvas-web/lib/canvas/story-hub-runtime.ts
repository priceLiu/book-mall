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
} from "./parse-md-tables";
import { storyboardMeetsMinimumShotCount } from "./pro2-storyboard-shot-budget";
import { storyboardMeetsPackQuality } from "./pro2-pack-readiness";
import type { CanvasFlowNode, CanvasNodeRuntime } from "./types";
import type { StoryLlmSection, StoryScriptHubNodeData } from "./story-workspace-types";

export function hubSectionRuntime(
  node: CanvasFlowNode,
  section: StoryLlmSection,
): { status?: string; textOutput?: string; taskId?: string } | undefined {
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
  return outlineStripMd(md);
}

/** 解析各 Tab 展示/编辑用 Markdown：优先独立字段，否则从大纲嵌入段回落 */
export function resolveHubSectionMd(
  d: StoryScriptHubNodeData,
  section: HubPreviewSection,
): string {
  if (section === "outline") {
    return outlineDisplayMd(d.outlineMd ?? "");
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

export function resolveHubStoryboardMd(d: StoryScriptHubNodeData): string {
  const synced = hubDataForColumnSync(d);
  const storyboard =
    (synced.storyboardMd ?? "").trim() ||
    resolveHubSectionMd(synced, "storyboard");
  return ensureStoryboardAiVideoPromptsMd(storyboard);
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
    promoted.storyboardMd.trim() &&
    promoted.storyboardMd !== (d.storyboardMd ?? "")
  ) {
    patch.storyboardMd = promoted.storyboardMd;
    if (derivedRuntime) patch.storyboardRuntime = derivedRuntime;
  }
  return patch;
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
  return {
    outlineMd: outlineStripMd(outlineMd),
    characterMd:
      characterMd.trim() || extractCharacterSectionFromOutline(outlineMd),
    sceneMd: resolveSceneDictionaryMarkdown(outlineMd, sceneMd),
    storyboardMd:
      storyboardMd.trim() ||
      normalizeStoryboardSectionFromOutline(outlineMd),
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
  return false;
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

/** 顶栏任务计数 / 轮询：仅已提交段算进行中（pending 无 taskId 为顺序链占位） */
export function hubSectionCountsAsInflight(
  rt?: { status?: string; taskId?: string },
): boolean {
  const st = rt?.status;
  if (st === "running") return true;
  if (st === "queued") return true;
  if (st === "pending" && rt?.taskId?.trim()) return true;
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
): boolean {
  const sections = ["outline", "character", "scene", "storyboard"] as const;
  if (sections.some((s) => hubSectionIsRunning(node, s))) return true;
  if (!hubGenerateIntent) return false;
  const anySectionTouched = sections.some((s) => {
    const st = hubSectionRuntime(node, s)?.status;
    return st != null && st !== "idle";
  });
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
