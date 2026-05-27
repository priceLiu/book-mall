import { parseCharacterRows, prepareMarkdownForPreview } from "./parse-md-tables";
import type { StoryLlmSection } from "./story-workspace-types";
import type { CanvasFlowNode } from "./types";
import type { StoryScriptHubNodeData } from "./story-workspace-types";
import { isAnyStoryScriptHubType } from "./story-workspace-resolver";

/** 下游 LLM 用完整大纲（不做展示层剥离，避免场景/对白被截断） */
function outlineTextInputMd(md: string): string {
  return prepareMarkdownForPreview(md.trim());
}

/** 文案中枢各段 LLM 须带上节点内已落库的上游段落（不只靠画布入边）。 */
export function resolveStoryHubSectionTextInputs(
  node: CanvasFlowNode,
  section: StoryLlmSection | undefined,
  upstreamTextInputs: string[],
): string[] {
  if (!isAnyStoryScriptHubType(node.type ?? "") || !section) {
    return upstreamTextInputs;
  }
  const d = node.data as unknown as StoryScriptHubNodeData;
  const out = [...upstreamTextInputs];

  if (section === "character") {
    const outline = outlineTextInputMd(d.outlineMd ?? "");
    if (outline) {
      out.push(`## 故事大纲\n\n${outline}`);
    }
    return out;
  }

  if (section === "storyboard") {
    const outline = outlineTextInputMd(d.outlineMd ?? "");
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
