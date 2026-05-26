import { parseCharacterRows } from "./parse-md-tables";
import { outlineDisplayMd } from "./story-hub-runtime";
import type { StoryLlmSection } from "./story-workspace-types";
import type { CanvasFlowNode } from "./types";
import type { StoryScriptHubNodeData } from "./story-workspace-types";

/** 文案中枢各段 LLM 须带上节点内已落库的上游段落（不只靠画布入边）。 */
export function resolveStoryHubSectionTextInputs(
  node: CanvasFlowNode,
  section: StoryLlmSection | undefined,
  upstreamTextInputs: string[],
): string[] {
  if (node.type !== "story-script-hub" || !section) {
    return upstreamTextInputs;
  }
  const d = node.data as unknown as StoryScriptHubNodeData;
  const out = [...upstreamTextInputs];

  if (section === "character") {
    const outline = outlineDisplayMd(d.outlineMd ?? "").trim();
    if (outline) {
      out.push(`## 故事大纲\n\n${outline}`);
    }
    return out;
  }

  if (section === "storyboard") {
    const outline = outlineDisplayMd(d.outlineMd ?? "").trim();
    const character = (d.characterMd ?? "").trim();
    const names = parseCharacterRows(character)
      .map((c) => c.name.trim())
      .filter(Boolean);
    if (outline) {
      out.push(`## 故事大纲\n\n${outline}`);
    }
    if (character) {
      out.push(
        `## 角色设定（分镜中的角色名须与下表「角色」列完全一致）\n\n${character}`,
      );
    }
    if (names.length) {
      out.push(
        `## 可用角色名（禁止自创新名或替换）\n${names.map((n) => `- ${n}`).join("\n")}`,
      );
    }
    return out;
  }

  return out;
}
