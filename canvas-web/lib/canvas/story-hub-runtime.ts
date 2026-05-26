import { stripOutlineCharacterTable, parseStoryboardRows } from "./parse-md-tables";
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

/** 故事大纲展示用（不含人物表简表） */
export function outlineDisplayMd(md: string): string {
  return stripOutlineCharacterTable(md ?? "");
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
  const md = hubSectionMd(node, section);
  if (!md.trim()) return false;
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
    hubDialogueIsReady(d.storyboardMd ?? "");
  if (scriptReady) return "done";
  return "idle";
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
  if (section === "dialogue") return hubDialoguePreviewMd(d.storyboardMd ?? "");
  if (section === "outline") return outlineDisplayMd(d.outlineMd ?? "");
  return hubSectionMd(
    { id: "", data: d, type: "story-script-hub", position: { x: 0, y: 0 } },
    section,
  );
}
