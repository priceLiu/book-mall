import { confirmAndPublishPro2ScriptHub } from "./pro2-publish-script-hub";
import { syncScriptPackageAssetOnPublish } from "./sync-script-package-on-publish";
import type { AssetVisibility } from "./project-asset-types";
import type {
  StoryProScriptHubNodeData,
  StoryProStarterNodeData,
} from "./story-pro-workspace-types";
import type { CrewCollaborationAccess } from "./crew-collaboration-access";
import {
  CREW_COLLABORATION_PERSONAL_HINT,
  CREW_PUBLISH_FORBIDDEN_HINT,
} from "./crew-collaboration-access";
import type { Pro2PublishScriptDialogs } from "./pro2-publish-script-hub";

export type RunPro2ScriptPublishFlowArgs = {
  hubId: string;
  hubData: StoryProScriptHubNodeData;
  projectId?: string;
  base?: string;
  dialogs: Pro2PublishScriptDialogs;
  collaboration: CrewCollaborationAccess;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  findStarter?: () =>
    | { id: string; data: StoryProStarterNodeData }
    | undefined;
};

/** 发布剧本（含剧本包落库 + 团队共享选项）· 合并原「导出剧本包」 */
export async function runPro2ScriptPublishFlow(
  args: RunPro2ScriptPublishFlowArgs,
): Promise<boolean> {
  const { collaboration, dialogs, hubId, hubData } = args;

  if (!collaboration.canPublishScript) {
    await dialogs.alert({
      title: collaboration.isTeamTenant ? "无法发布" : "团队功能",
      message: collaboration.isTeamTenant
        ? CREW_PUBLISH_FORBIDDEN_HINT
        : CREW_COLLABORATION_PERSONAL_HINT,
      variant: "warning",
    });
    return false;
  }

  const pub = await confirmAndPublishPro2ScriptHub(hubId, hubData, dialogs, {
    requireBatch: hubData.scriptStudioMode === true,
    batchIndex: hubData.scriptStudioBatchIndex,
  });
  if (!pub) return false;

  let visibility: AssetVisibility = "PRIVATE";
  if (collaboration.canTeamShareOnPublish) {
    const teamPublic = await dialogs.confirm({
      title: "剧本包可见范围",
      message:
        "发布将同步剧本包至资产库，供团队新建生产画布时选用。是否设为团队共享（团队全员可见）？",
      confirmLabel: "团队共享",
      cancelLabel: "仅自己可见",
    });
    visibility = teamPublic ? "TEAM_PUBLIC" : "PRIVATE";
  }

  args.updateNodeData(hubId, pub);

  if (args.base?.trim() && args.projectId) {
    const starter = args.findStarter?.();
    const assetId = await syncScriptPackageAssetOnPublish({
      base: args.base,
      projectId: args.projectId,
      hubId,
      hubData: { ...hubData, ...pub } as StoryProScriptHubNodeData,
      starterId: starter?.id,
      starterData: starter?.data,
      visibility,
    });
    if (assetId) {
      args.updateNodeData(hubId, { linkedScriptPackageAssetId: assetId });
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("canvas:crew-script-published", {
        detail: { hubId },
      }),
    );
    window.dispatchEvent(new CustomEvent("canvas:flush-autosave"));
  }

  await dialogs.alert({
    title: "发布成功",
    message:
      visibility === "TEAM_PUBLIC"
        ? "剧本已发布，公告栏已更新；剧本包已团队共享，成员可关联新建生产画布。"
        : "剧本已发布，公告栏已更新；剧本包已保存（仅自己可见）。",
    variant: "success",
  });

  return true;
}
