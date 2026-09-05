import type { Pro2DockUpstreamLink } from "./pro2-dock-upstream-links";
import { resolveDockRunPrompt } from "./resolve-dock-run-prompt";
import { directPredecessors } from "./topo";
import { tagRichTextToPlainText } from "./tag-rich-text-migrate";
import type {
  AiEngineNodeData,
  CanvasFlowEdge,
  CanvasFlowNode,
  StoryEngineNodeData,
  TextNodeData,
} from "./types";
import { isStoryLlmNodeType } from "./types";

/** 音频节点一阶上游文本（与 run-queue resolveTextInputs 对齐） */
export function resolveLibtvAudioPredecessorTexts(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  nodeId: string,
): string[] {
  const out: string[] = [];
  for (const pid of directPredecessors(edges, nodeId)) {
    const p = nodes.find((n) => n.id === pid);
    if (!p) continue;
    if (p.type === "text") {
      const d = p.data as unknown as TextNodeData;
      if (d.mode === "piped" && d.runtime?.textOutput?.trim()) {
        out.push(d.runtime.textOutput.trim());
      } else if (d.text?.trim()) {
        out.push(d.text.trim());
      }
    } else if (p.type === "ai-engine" || isStoryLlmNodeType(p.type ?? "")) {
      const d = p.data as unknown as AiEngineNodeData | StoryEngineNodeData;
      if (d.runtime?.textOutput?.trim()) out.push(d.runtime.textOutput.trim());
    } else if (p.type === "story-pro2-prompt") {
      const d = p.data as { generatedText?: string; prompt?: string };
      const text = d.generatedText?.trim() || d.prompt?.trim();
      if (text) out.push(text);
    } else if (p.type === "story-pro2-tag") {
      const d = p.data as { body?: string };
      if (d.body?.trim()) out.push(tagRichTextToPlainText(d.body));
    } else if (p.type === "story-pro2-script-hub") {
      const d = p.data as {
        outlineMd?: string;
        characterMd?: string;
        storyboardMd?: string;
      };
      for (const part of [d.outlineMd, d.characterMd, d.storyboardMd]) {
        if (part?.trim()) out.push(part.trim());
      }
    }
  }
  return out;
}

/** 音频节点提交前合并 Dock 台词、@ 展开与上游 textInputs */
export function mergeLibtvAudioRunText(
  dockInput: string,
  upstreamLinks: Pro2DockUpstreamLink[],
  textInputs: string[],
): string {
  const { prompt, extraText } = resolveDockRunPrompt(
    dockInput,
    upstreamLinks,
  );
  return [prompt, ...extraText, ...textInputs]
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n\n");
}
