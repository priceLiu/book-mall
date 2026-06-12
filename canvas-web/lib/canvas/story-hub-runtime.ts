import {
  ensureStoryboardAiVideoPromptsMd,
  stripOutlineCharacterTable,
  stripOutlineEmbeddedPackSections,
  extractCharacterSectionFromOutline,
  normalizeStoryboardSectionFromOutline,
  parseStoryboardRows,
} from "./parse-md-tables";
import type { CanvasFlowNode } from "./types";
import type { StoryLlmSection, StoryScriptHubNodeData } from "./story-workspace-types";

export function hubSectionRuntime(
  node: CanvasFlowNode,
  section: StoryLlmSection,
): { status?: string; textOutput?: string } | undefined {
  const d = node.data as unknown as StoryScriptHubNodeData;
  if (section === "outline") return d.outlineRuntime;
  if (section === "character") return d.characterRuntime;
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
  if (section === "storyboard") {
    const dedicated = (d.storyboardMd ?? "").trim();
    if (dedicated) return dedicated;
    return normalizeStoryboardSectionFromOutline(d.outlineMd ?? "");
  }
  const storyboard = resolveHubSectionMd(d, "storyboard");
  return hubDialoguePreviewMd(storyboard);
}

export function resolveHubStoryboardMd(d: StoryScriptHubNodeData): string {
  return ensureStoryboardAiVideoPromptsMd(
    resolveHubSectionMd(d, "storyboard"),
  );
}

/** 将大纲嵌入段拆入 hub 各字段，供 syncColumnsFromHub 使用 */
export function hubDataForColumnSync(
  d: StoryScriptHubNodeData,
): StoryScriptHubNodeData {
  const promoted = promoteEmbeddedPackFromOutline(
    d.outlineMd ?? "",
    d.characterMd ?? "",
    d.storyboardMd ?? "",
  );
  return {
    ...d,
    outlineMd: promoted.outlineMd || d.outlineMd || "",
    characterMd: promoted.characterMd || d.characterMd || "",
    storyboardMd: promoted.storyboardMd || d.storyboardMd || "",
  };
}

/** 保存大纲时：将嵌入的制作包段落拆到独立字段，避免其他 Tab 读不到 */
export function promoteEmbeddedPackFromOutline(
  outlineMd: string,
  characterMd = "",
  storyboardMd = "",
): { outlineMd: string; characterMd: string; storyboardMd: string } {
  return {
    outlineMd: outlineStripMd(outlineMd),
    characterMd:
      characterMd.trim() || extractCharacterSectionFromOutline(outlineMd),
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
  if (rt?.status === "done" && md.trim()) return false;
  return true;
}

export function hubSectionIsComplete(
  node: CanvasFlowNode,
  section: StoryLlmSection,
): boolean {
  return hubSectionIsReady(node, section);
}

/** 有内容且未在跑/失败即视为就绪（兼容仅有 Md、无 runtime 的持久化图） */
export function hubSectionIsReady(
  node: CanvasFlowNode,
  section: StoryLlmSection,
): boolean {
  const d = node.data as unknown as StoryScriptHubNodeData;
  const dedicated = hubSectionMd(node, section).trim();
  const md = dedicated || resolveHubSectionMd(d, section).trim();
  if (!md) return false;
  if (!dedicated) return true;
  const st = hubSectionRuntime(node, section)?.status;
  if (st === "running" || st === "pending" || st === "error") return false;
  return true;
}

export function hubSectionIsRunning(
  node: CanvasFlowNode,
  section: StoryLlmSection,
): boolean {
  const st = hubSectionRuntime(node, section)?.status;
  return st === "running" || st === "pending";
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
  const sections = ["outline", "character", "storyboard"] as const;
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
