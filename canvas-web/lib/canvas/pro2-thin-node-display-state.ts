import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

/** LibTV 薄卡（文本 / 脚本生成器）三种展示态 · 见 docs/libtv-node-state-spec.md */
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
}): boolean {
  return Boolean(
    data.generatedOutlineMd?.trim() || data.uploadedScriptMd?.trim(),
  );
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
  return "已链接上游 · 在下方 Dock 输入后发送";
}

/** 脚本生成器连线态说明（有边即 connected，不要求 outlineMd 已同步） */
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
  const fromStarter = incoming.some((e) => {
    const src = input.nodes.find((n) => n.id === e.source);
    return src?.type === "story-pro2-starter";
  });
  if (fromStarter) {
    return {
      title: "已链接文本节点",
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
