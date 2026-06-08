import { findStoryProScriptHubForStarter } from "./spawn-story-pro-workspace";
import { formatFinalizedScriptTitle } from "./story-pro-finalized-script";
import { storyProStarterHasScriptSource } from "./story-pro-starter-sync";
import { extractThemeFromStorySystemPrompt } from "./story-prompts";
import type {
  StoryProScriptHubNodeData,
  StoryProStarterNodeData,
} from "./story-pro-workspace-types";
import { resolveStarterForHub } from "./story-workspace-resolver";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

function resolveWorkflowThemeFromOutline(outlineMd: string): string | null {
  const text = outlineMd.trim();
  if (!text) return null;
  const conflict = text.match(
    /##\s*核心冲突[^\n]*\n+([^\n#][^\n]{4,80})/,
  );
  if (conflict?.[1]?.trim()) return conflict[1].trim();
  const style = text.match(/##\s*视觉风格总纲\n+([^\n#][^\n]{4,60})/);
  if (style?.[1]?.trim()) return style[1].trim();
  return null;
}

export function resolveStoryProWorkflowDisplayTheme(
  starter: CanvasFlowNode,
  hub?: CanvasFlowNode,
): string {
  const sd = starter.data as unknown as StoryProStarterNodeData;
  const hd = hub?.data as unknown as StoryProScriptHubNodeData | undefined;

  const finalizedTheme = hd?.finalizedScriptHistory?.[0]?.theme?.trim();
  if (finalizedTheme) return formatFinalizedScriptTitle(finalizedTheme);

  const fileName = sd.uploadedScriptMeta?.fileName?.trim();
  if (fileName) {
    const base = fileName.replace(/\.(md|markdown|txt)$/i, "").trim();
    if (base) return base;
  }

  const fromOutline = resolveWorkflowThemeFromOutline(hd?.outlineMd ?? "");
  if (fromOutline) return fromOutline;

  return formatFinalizedScriptTitle(
    extractThemeFromStorySystemPrompt(sd.systemPrompt ?? ""),
  );
}

/** 无 hub 时暂用 starter 前缀，hub 创建后改用 scriptHubId */
export function storyProAssistantStarterWorkflowKey(starterId: string): string {
  return `starter:${starterId}`;
}

export type StoryProAssistantWorkflowThread = {
  workflowKey: string;
  scriptHubId?: string;
  starterId: string;
  theme: string;
  workflowLabel: string;
  scriptFinalized: boolean;
  hasScript: boolean;
};

export function resolveStoryProAssistantWorkflowKey(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  starter: CanvasFlowNode,
): string {
  const sd = starter.data as unknown as StoryProStarterNodeData;
  const hubLink = findStoryProScriptHubForStarter(
    nodes,
    edges,
    starter.id,
    sd.workspaceIds,
  );
  return hubLink?.scriptHubId ?? storyProAssistantStarterWorkflowKey(starter.id);
}

export function resolveStoryProAssistantWorkflowKeyForNode(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  nodeId: string,
): string | null {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  if (node.type === "story-pro-script-hub") return node.id;
  if (node.type === "story-pro-starter") {
    return resolveStoryProAssistantWorkflowKey(nodes, edges, node);
  }
  const hubNodeId = (node.data as { hubNodeId?: string }).hubNodeId;
  if (hubNodeId) return hubNodeId;
  return null;
}

export function listStoryProAssistantWorkflowThreads(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): StoryProAssistantWorkflowThread[] {
  const starters = nodes.filter((n) => n.type === "story-pro-starter");
  return starters.map((starter, idx) => {
    const sd = starter.data as unknown as StoryProStarterNodeData;
    const workflowKey = resolveStoryProAssistantWorkflowKey(
      nodes,
      edges,
      starter,
    );
    const hub =
      workflowKey.startsWith("starter:")
        ? undefined
        : nodes.find((n) => n.id === workflowKey);
    const hd = hub?.data as unknown as StoryProScriptHubNodeData | undefined;
    const theme = resolveStoryProWorkflowDisplayTheme(starter, hub);
    return {
      workflowKey,
      scriptHubId: hub?.id,
      starterId: starter.id,
      theme,
      workflowLabel:
        starters.length > 1 ? `工作流 ${idx + 1}` : "工作流",
      scriptFinalized: Boolean(hd?.scriptFinalized),
      hasScript:
        storyProStarterHasScriptSource(sd) ||
        Boolean(hd?.outlineMd?.trim()) ||
        Boolean(hd?.characterMd?.trim()),
    };
  });
}

/** 选中节点 → 工作流 key；否则取第一个未定稿工作流，再回落第一条 */
export function pickActiveStoryProAssistantWorkflowKey(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  preferredNodeId?: string | null,
): string | null {
  const threads = listStoryProAssistantWorkflowThreads(nodes, edges);
  if (!threads.length) return null;

  if (preferredNodeId) {
    const fromNode = resolveStoryProAssistantWorkflowKeyForNode(
      nodes,
      edges,
      preferredNodeId,
    );
    if (fromNode && threads.some((t) => t.workflowKey === fromNode)) {
      return fromNode;
    }
  }

  const open = threads.find((t) => !t.scriptFinalized && !t.hasScript);
  if (open) return open.workflowKey;

  const drafting = threads.find((t) => !t.scriptFinalized);
  if (drafting) return drafting.workflowKey;

  return threads[0]?.workflowKey ?? null;
}

export function storyProAssistantThemeForWorkflowKey(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  workflowKey: string,
): string {
  if (!workflowKey) return "项目会话（旧）";
  if (workflowKey.startsWith("starter:")) {
    const starterId = workflowKey.slice("starter:".length);
    const starter = nodes.find((n) => n.id === starterId);
    if (!starter) return "未命名主题";
    return resolveStoryProWorkflowDisplayTheme(starter);
  }
  const hub = nodes.find((n) => n.id === workflowKey);
  const starter = hub
    ? resolveStarterForHub(nodes, edges, hub.id)
    : undefined;
  if (starter) return resolveStoryProWorkflowDisplayTheme(starter, hub);
  return "未命名主题";
}
