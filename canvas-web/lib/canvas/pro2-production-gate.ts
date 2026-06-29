import type { CanvasFlowNode } from "./types";
import type {
  StoryProStarterNodeData,
  StoryProScriptHubNodeData,
} from "./story-pro-workspace-types";

export type Pro2ProductionGateState = {
  scriptStudioMode: boolean;
  requireLinkedScript: boolean;
  /** 空白 2.0 画布 · 可选关联已发布剧本 */
  optionalLinkPrompt: boolean;
  linked: boolean;
  message: string;
};

export function resolvePro2ProductionGate(
  nodes: CanvasFlowNode[],
  meta?: import("./types").CanvasGraph["meta"],
): Pro2ProductionGateState {
  const scriptStudioHub = nodes.find(
    (n) =>
      n.type === "story-pro2-script-hub" &&
      (n.data as StoryProScriptHubNodeData).scriptStudioMode,
  );
  const starter = nodes.find((n) => n.type === "story-pro2-starter");
  const anchor = scriptStudioHub ?? starter;
  const anchorData = (anchor?.data ?? {}) as StoryProStarterNodeData &
    StoryProScriptHubNodeData;

  const scriptStudioMode =
    anchorData.scriptStudioMode === true ||
    scriptStudioHub?.type === "story-pro2-script-hub";

  const requireLinkedScript =
    meta?.productionCanvas === true || meta?.requireScriptLink === true;

  const linkedAssetId =
    anchorData.workspaceIds?.linkedScriptPackageAssetId ??
    meta?.linkedScriptPackageAssetId ??
    meta?.crewBulletinAnchor?.linkedScriptPackageAssetId;
  const starterBulletin = (starter?.data as StoryProStarterNodeData | undefined)
    ?.crewBulletin;
  const metaBulletin = meta?.crewBulletinAnchor?.crewBulletin;
  const linkedHubId =
    scriptStudioHub?.id ?? anchorData.workspaceIds?.scriptHubId;
  const linkedHub = linkedHubId
    ? nodes.find((n) => n.id === linkedHubId)
    : scriptStudioHub;
  const hubFinalized =
    linkedHub?.type === "story-pro2-script-hub" &&
    Boolean(
      (linkedHub.data as StoryProScriptHubNodeData).scriptFinalized ||
        (linkedHub.data as StoryProScriptHubNodeData).scriptPublished,
    );

  const linked =
    Boolean(linkedAssetId) ||
    hubFinalized ||
    Boolean(starterBulletin?.tasks?.length) ||
    Boolean(metaBulletin?.tasks?.length);

  const optionalLinkPrompt =
    !scriptStudioHub && !linked && (Boolean(starter) || !nodes.length);

  let message = "";
  if (requireLinkedScript && !linked) {
    message =
      "建议先关联已发布剧本（在脚本生成器中发布，或在新建画布时选择）。仍可跳过继续工作。";
  } else if (optionalLinkPrompt) {
    message =
      "可选：关联已发布剧本后在公告条参与制作任务；也可跳过，自由添加节点创作。";
  }

  return {
    scriptStudioMode,
    requireLinkedScript,
    optionalLinkPrompt,
    linked,
    message,
  };
}

export function pro2ProductionGateAllowsStageSpawn(
  gate: Pro2ProductionGateState,
): boolean {
  if (!gate.requireLinkedScript) return true;
  return gate.linked;
}
