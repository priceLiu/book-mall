import type { StoryPro2StarterNodeData } from "./story-pro2-workspace-types";
import type { CanvasFlowNode } from "./types";

/** 2.0 脚本节点表头：用用户主题或大纲首段，禁止回落漫剧示例占位主题 */
export function resolvePro2HubTableTitle(
  starter: CanvasFlowNode | null | undefined,
  outlineMd: string,
): string {
  const d = starter?.data as StoryPro2StarterNodeData | undefined;
  const theme = d?.themeInput?.trim();
  if (theme) return theme.length > 48 ? `${theme.slice(0, 48)}…` : theme;

  const body = outlineMd.trim();
  if (body) {
    const core = body.match(
      /##\s*核心冲突与结构摘要\s*\n+([\s\S]*?)(?=\n##\s|\n*$)/,
    )?.[1];
    const line =
      core
        ?.split("\n")
        .map((l) => l.trim())
        .find((l) => l && !l.startsWith("#") && !l.startsWith("|")) ??
      body
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l && !l.startsWith("#") && !l.startsWith("|") && !l.startsWith("-"));
    if (line) {
      const t = line.replace(/^[-*]\s*/, "");
      return t.length > 48 ? `${t.slice(0, 48)}…` : t;
    }
  }
  return "分镜脚本";
}
