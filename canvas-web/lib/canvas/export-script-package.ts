import type { ProjectAssetKind } from "./project-asset-types";
import type { ExportProjectAssetDraft } from "./project-asset-export";
import type {
  StoryProScriptHubNodeData,
  StoryProStarterNodeData,
} from "./story-pro-workspace-types";
import {
  resolvePro2HubCharacterMd,
  resolvePro2HubSceneMd,
} from "./pro2-script-hub-helpers";
import { resolveHubStoryboardMd } from "./story-hub-runtime";

export function exportScriptPackageDraft(args: {
  projectId: string;
  edition: "pro2";
  starterId: string;
  starterData: StoryProStarterNodeData;
  hubId?: string;
  hubData?: StoryProScriptHubNodeData;
}): ExportProjectAssetDraft {
  const d = args.starterData;
  const hub = args.hubData;
  const markdown =
    hub?.scriptStudioCompletedBatchesMd?.trim() ||
    d.scriptStudioCompletedBatchesMd?.trim() ||
    hub?.outlineMd?.trim() ||
    d.generatedOutlineMd?.trim() ||
    "";

  const totalEpisodes =
    hub?.scriptStudioTotalEpisodes ?? d.scriptStudioTotalEpisodes ?? 30;

  const hubForMd = hub ?? ({} as StoryProScriptHubNodeData);
  const characterMd =
    hub?.characterMd?.trim() || resolvePro2HubCharacterMd(hubForMd);
  const sceneMd =
    hub?.sceneMd?.trim() ||
    resolvePro2HubSceneMd(hubForMd, hub ? { hubId: args.hubId } : undefined);
  const storyboardMd =
    hub?.storyboardMd?.trim() || resolveHubStoryboardMd(hubForMd);

  const payload: Record<string, unknown> = {
    markdown,
    characterMd,
    sceneMd,
    storyboardMd,
    frozenBiblesMd:
      hub?.scriptStudioFrozenBiblesMd ?? d.scriptStudioFrozenBiblesMd,
    frozenBiblesOssUrl:
      hub?.scriptStudioFrozenBiblesOssUrl ?? d.scriptStudioFrozenBiblesOssUrl,
    completedBatchesOssUrl:
      hub?.scriptStudioCompletedBatchesOssUrl ??
      d.scriptStudioCompletedBatchesOssUrl,
    totalEpisodes,
    batchIndex: hub?.scriptStudioBatchIndex ?? d.scriptStudioBatchIndex ?? 0,
    system: hub?.scriptStudioSystem ?? d.scriptStudioSystem ?? "original",
    scriptFinalized: hub?.scriptFinalized ?? hub?.scriptPublished ?? false,
    crewBulletin: hub?.crewBulletin,
    scriptStudioCharacterRows: hub?.scriptStudioCharacterRows,
    sceneRows: hub?.sceneRows,
    scriptStudioPropRows: hub?.scriptStudioPropRows,
    scriptStudioFrameRows: hub?.scriptStudioFrameRows,
    scriptStudioMoodRows: hub?.scriptStudioMoodRows,
    scriptStudioAudioRows: hub?.scriptStudioAudioRows,
    scriptPackageSnapshots: hub?.scriptPackageSnapshots,
  };

  const title =
    hub?.crewBulletin?.scriptTitle?.trim() ||
    `剧本包 · ${totalEpisodes} 集`;

  return {
    kind: "SCRIPT_PACKAGE" as ProjectAssetKind,
    displayName: title.startsWith("剧本包") ? title : `剧本包 · ${title}`,
    description: "工业化剧本 · 已发布任务清单",
    thumbnailUrl: "",
    sourceProjectId: args.projectId,
    sourceNodeId: args.hubId ?? args.starterId,
    sourceEdition: args.edition,
    payload,
    refs: [],
  };
}
