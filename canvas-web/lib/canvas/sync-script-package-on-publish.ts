import { createProjectAsset } from "@/lib/canvas-api";
import { exportScriptPackageDraft } from "./export-script-package";
import type {
  StoryProScriptHubNodeData,
  StoryProStarterNodeData,
} from "./story-pro-workspace-types";

/** 发布剧本后写入 SCRIPT_PACKAGE 资产，供其他 2.0 画布选用 */
export async function syncScriptPackageAssetOnPublish(args: {
  base: string;
  projectId: string;
  hubId: string;
  hubData: StoryProScriptHubNodeData;
  starterId?: string;
  starterData?: StoryProStarterNodeData;
}): Promise<string | undefined> {
  const starterData = args.starterData ?? ({} as StoryProStarterNodeData);
  const draft = exportScriptPackageDraft({
    projectId: args.projectId,
    edition: "pro2",
    starterId: args.starterId ?? args.hubId,
    starterData,
    hubId: args.hubId,
    hubData: args.hubData,
  });

  if (!String(draft.payload.markdown ?? "").trim() && !args.hubData.crewBulletin) {
    return;
  }

  const payload = {
    ...draft.payload,
    sourceHubProjectId: args.projectId,
    sourceHubNodeId: args.hubId,
  };

  try {
    const asset = await createProjectAsset(args.base, {
      kind: "SCRIPT_PACKAGE",
      displayName: draft.displayName,
      description: draft.description,
      thumbnailUrl: draft.thumbnailUrl,
      sourceProjectId: args.projectId,
      sourceNodeId: args.hubId,
      sourceEdition: "pro2",
      payload,
      refs: [],
      visibility: "PRIVATE",
    });
    return asset.id;
  } catch {
    /* 资产同步失败不阻断发布 */
    return undefined;
  }
}
