/** 剧本创作助手 · 客户端模式与文案（system prompt 真源在 book-mall） */

import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { isStoryProPipelineNode } from "./types";
import { nodeMeasuredSize } from "./normalize-graph-nodes";
import type { StoryProScriptHubNodeData } from "./story-pro-workspace-types";
import {
  findStoryProScriptHubForStarter,
  storyProHubHasMediaColumns,
  storyProHubHasStyleLayer,
} from "./spawn-story-pro-workspace";
import {
  findStoryPro2ScriptHubForStarter,
  storyPro2HubHasMediaColumns,
  storyPro2HubHasStyleLayer,
} from "./spawn-story-pro2-workspace";
import { isStoryPro2PipelineNode } from "./story-pro2-pipeline";

export type ScriptAssistantOutputMode = "chat" | "pack";

/** 同画布多套工作流时，新工作流相对已有工作区的纵向间距 */
export const STORY_PRO_WORKFLOW_STACK_GAP = 240;

export type StoryAssistantEdition = "pro" | "pro2";

export type StoryProAssistantImportPlan =
  | {
      allowed: true;
      spawnNew: false;
      starterId: string;
      scriptHubId?: string;
      hint: string;
      edition: StoryAssistantEdition;
    }
  | {
      allowed: true;
      spawnNew: true;
      position: { x: number; y: number };
      hint: string;
      edition: StoryAssistantEdition;
    }
  | { allowed: false; reason: string };

function hubBlocksAssistantImport(
  nodes: CanvasFlowNode[],
  hubId: string,
  hubType: "story-pro-script-hub" | "story-pro2-script-hub",
  hasStyle: (nodes: CanvasFlowNode[], hubId: string) => boolean,
  hasMedia: (nodes: CanvasFlowNode[], hubId: string) => boolean,
): string | null {
  const hub = nodes.find((n) => n.id === hubId);
  if (!hub || hub.type !== hubType) {
    return "未找到故事剧本节点。";
  }
  const hd = hub.data as unknown as StoryProScriptHubNodeData;
  if (hd.scriptFinalized) {
    return "该套故事已定稿。";
  }
  if (
    (hd.outlineMd ?? "").trim() ||
    (hd.characterMd ?? "").trim() ||
    (hd.storyboardMd ?? "").trim()
  ) {
    return "该套故事剧本已有大纲/角色/分镜。";
  }
  if (hasStyle(nodes, hubId)) {
    return "该套已连接风格节点。";
  }
  if (hasMedia(nodes, hubId)) {
    return "该套已生成人物/场景/分镜/视频等下游列。";
  }
  return null;
}

/** 新一套工作流 · 启动节点建议坐标（与 reflow 互不覆盖） */
export function suggestNextStoryProStarterPosition(
  nodes: CanvasFlowNode[],
  edition: StoryAssistantEdition = "pro",
): { x: number; y: number } {
  const starterType =
    edition === "pro2" ? "story-pro2-starter" : "story-pro-starter";
  const isEditionNode = (t: string) =>
    edition === "pro2"
      ? isStoryPro2PipelineNode(t)
      : isStoryProPipelineNode(t);
  const proNodes = nodes.filter((n) => isEditionNode(n.type ?? ""));
  if (!proNodes.length) return { x: edition === "pro2" ? 120 : 80, y: 120 };

  let maxBottom = 120;
  for (const n of proNodes) {
    const y = n.position?.y ?? 120;
    const { h } = nodeMeasuredSize(n);
    maxBottom = Math.max(maxBottom, y + h);
  }
  const starterX =
    nodes.find((n) => n.type === starterType)?.position?.x ??
    (edition === "pro2" ? 120 : 80);
  return { x: starterX, y: maxBottom + STORY_PRO_WORKFLOW_STACK_GAP };
}

function resolveEditionAssistantImport(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  edition: StoryAssistantEdition,
): StoryProAssistantImportPlan | null {
  const starterType =
    edition === "pro2" ? "story-pro2-starter" : "story-pro-starter";
  const hubType =
    edition === "pro2" ? "story-pro2-script-hub" : "story-pro-script-hub";
  const findHub =
    edition === "pro2"
      ? findStoryPro2ScriptHubForStarter
      : findStoryProScriptHubForStarter;
  const hasStyle =
    edition === "pro2" ? storyPro2HubHasStyleLayer : storyProHubHasStyleLayer;
  const hasMedia =
    edition === "pro2" ? storyPro2HubHasMediaColumns : storyProHubHasMediaColumns;
  const label = edition === "pro2" ? "影视专业版 2.0" : "影视专业版";

  const starters = nodes.filter((n) => n.type === starterType);
  if (!starters.length) return null;

  for (const starter of starters) {
    const stored = (
      starter.data as { workspaceIds?: { scriptHubId?: string } }
    ).workspaceIds;
    const hubLink = findHub(nodes, edges, starter.id, stored);
    if (!hubLink) {
      return {
        allowed: true,
        spawnNew: false,
        starterId: starter.id,
        hint: "",
        edition,
      };
    }
    const block = hubBlocksAssistantImport(
      nodes,
      hubLink.scriptHubId,
      hubType,
      hasStyle,
      hasMedia,
    );
    if (!block) {
      return {
        allowed: true,
        spawnNew: false,
        starterId: starter.id,
        scriptHubId: hubLink.scriptHubId,
        hint: "",
        edition,
      };
    }
  }

  return {
    allowed: true,
    spawnNew: true,
    position: suggestNextStoryProStarterPosition(nodes, edition),
    hint: `当前画布已有进行中的工作流；将新建一套独立工作流（故事启动 + 故事剧本）并导入，与既有流程互不影响。`,
    edition,
  };
}

/**
 * 解析「确定导入」目标：优先写入未占用的启动节点/空 Hub；
 * 若画布上工作流均已进行中，则允许在同画布新建一套独立工作流。
 */
export function resolveStoryProAssistantImport(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): StoryProAssistantImportPlan {
  const pro2Plan = resolveEditionAssistantImport(nodes, edges, "pro2");
  if (pro2Plan) return pro2Plan;

  const proPlan = resolveEditionAssistantImport(nodes, edges, "pro");
  if (proPlan) return proPlan;

  return {
    allowed: false,
    reason:
      "未找到影视专业版启动节点，无法导入。请使用影视专业版或 2.0 模板打开画布。",
  };
}

/** @deprecated 请用 resolveStoryProAssistantImport；保留兼容旧调用方 */
export function storyProAssistantImportGate(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[] = [],
): {
  allowed: boolean;
  reason: string;
  spawnNew?: boolean;
} {
  const plan = resolveStoryProAssistantImport(nodes, edges);
  if (!plan.allowed) {
    return { allowed: false, reason: plan.reason };
  }
  return {
    allowed: true,
    reason: plan.hint,
    spawnNew: plan.spawnNew,
  };
}

export const SCRIPT_ASSISTANT_OUTPUT_MODES: {
  id: ScriptAssistantOutputMode;
  label: string;
  hint: string;
}[] = [
  { id: "chat", label: "闲聊 / 润色", hint: "自由 Markdown" },
  {
    id: "pack",
    label: "创作并导入故事剧本",
    hint: "完整制作包 · 可导入空工作流或新建一套",
  },
];

/** 打开助手且无历史对话时展示的欢迎语（仅 UI，不写入 API / 持久化） */
export const SCRIPT_ASSISTANT_WELCOME_MESSAGE = `你好！我是你的剧本创作助手，随时准备为你服务。

可以帮你完成以下任务：
- 撰写短剧剧本
- 润色对话与对白
- 扩写剧情或人物设定
- 生成完整故事大纲与分镜表
- 输出可直接导入 AI 短剧画布的剧本格式（含角色表、场景表、分镜）

请告诉我：
- 你需要的项目类型（悬疑、爱情、喜剧、科幻等）
- 基本剧情或灵感（一句话或一段描述）
- 希望完成的输出格式（简纲 / 全本剧本 / 角色设定）

我会用最专业、简洁的方式呈现。现在，请说出你的创作需求。`;
