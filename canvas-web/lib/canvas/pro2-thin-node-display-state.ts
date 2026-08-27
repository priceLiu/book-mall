import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { resolvePro2StarterDockLinkLabel } from "./pro2-dock-upstream-links";
import type { StoryProStarterNodeData } from "./story-pro-workspace-types";

/** LibTV 薄卡（文本 / 故事脚本生成）三种展示态 · 见 docs/libtv-node-state-spec.md */
export type LibtvThinNodeDisplayState = "initial" | "connected" | "generated";

export function pro2ThinNodeIsLinked(
  nodeId: string,
  edges: CanvasFlowEdge[],
): boolean {
  return edges.some(
    (e) =>
      (e.target === nodeId &&
        (e.targetHandle === "in_text" || e.targetHandle == null)) ||
      (e.source === nodeId &&
        (e.sourceHandle === "text" || e.sourceHandle == null)),
  );
}

/** 视频合成节点 · 有入边或出边即视为已连线（含快捷预设生成的上游节点） */
export function libtvVideoEngineNodeIsLinked(
  nodeId: string,
  edges: CanvasFlowEdge[],
): boolean {
  return edges.some((e) => {
    if (e.target === nodeId) {
      return (
        e.targetHandle === "in_text" ||
        e.targetHandle === "in_ref" ||
        e.targetHandle === "in_motion_video" ||
        e.targetHandle == null
      );
    }
    if (e.source === nodeId) {
      return e.sourceHandle === "out_video" || e.sourceHandle == null;
    }
    return false;
  });
}

export function resolveLibtvThinNodeDisplayState(input: {
  hasGeneratedContent: boolean;
  isGenerating: boolean;
  isLinked: boolean;
}): LibtvThinNodeDisplayState {
  if (input.isGenerating || input.hasGeneratedContent) return "generated";
  if (input.isLinked) return "connected";
  return "initial";
}

export function pro2StarterHasContent(data: {
  generatedOutlineMd?: string;
  uploadedScriptMd?: string;
  themeInput?: string;
}): boolean {
  return Boolean(
    data.generatedOutlineMd?.trim() ||
      data.uploadedScriptMd?.trim() ||
      data.themeInput?.trim(),
  );
}

/** 文本节点 LLM 生成中（故事大纲 / general 提示词共用 themeOutlineRuntime） */
export function isPro2StarterTextGenerating(data: {
  themeOutlineRuntime?: { status?: string };
}): boolean {
  const st = data.themeOutlineRuntime?.status;
  return st === "pending" || st === "running";
}

export function pro2StarterLinkedMessage(
  edges: CanvasFlowEdge[],
  nodes: CanvasFlowNode[],
  nodeId: string,
): string {
  const incoming = edges.filter((e) => e.target === nodeId);
  const fromImage = incoming.some((e) => {
    const src = nodes.find((n) => n.id === e.source);
    return (
      src?.type === "story-pro2-image" ||
      src?.type === "sbv1-image" ||
      src?.type === "story-pro2-three-view"
    );
  });
  const fromVideo = incoming.some((e) => {
    const src = nodes.find((n) => n.id === e.source);
    return src?.type === "sbv1-video-engine";
  });
  if (fromImage) return "已链接图片 · 在图片节点上传后生成提示词";
  if (fromVideo) return "已链接视频 · 在视频节点上传后生成提示词";
  const fromScript = incoming.some((e) => {
    const src = nodes.find((n) => n.id === e.source);
    return src?.type === "story-pro2-script-hub";
  });
  if (fromScript) return "已链接脚本 · 仅作参考，请在下方 Dock 编写提示词";
  return "已链接上游 · 在下方 Dock 输入后发送";
}

/** 故事脚本生成连线态说明（有边即 connected；标题随上游节点 label） */
export function pro2ScriptHubLinkedMessage(input: {
  edges: CanvasFlowEdge[];
  nodes: CanvasFlowNode[];
  hubId: string;
  hasOutlineLink: boolean;
}): { title: string; hint: string } {
  if (input.hasOutlineLink) {
    return {
      title: "已链接故事大纲",
      hint: "在下方 Dock 补充剧情或参考图后发送",
    };
  }
  const incoming = input.edges.filter((e) => e.target === input.hubId);
  const starter = incoming
    .map((e) => input.nodes.find((n) => n.id === e.source))
    .find((n) => n?.type === "story-pro2-starter");
  if (starter) {
    const sd = starter.data as unknown as StoryProStarterNodeData;
    const label = resolvePro2StarterDockLinkLabel(sd);
    return {
      title: `已链接${label}`,
      hint: "在下方 Dock 输入后发送",
    };
  }
  const fromImage = incoming.some((e) => {
    const src = input.nodes.find((n) => n.id === e.source);
    return (
      src?.type === "story-pro2-image" ||
      src?.type === "sbv1-image" ||
      src?.type === "story-pro2-three-view"
    );
  });
  if (fromImage) {
    return {
      title: "已链接图片节点",
      hint: "在下方 Dock 补充说明后发送",
    };
  }
  return {
    title: "已链接上游",
    hint: "在下方 Dock 输入后发送",
  };
}
