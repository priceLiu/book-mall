import type { CrewBulletinState, CrewBulletinTask } from "./crew-bulletin-types";
import { buildCrewBulletinFromHub } from "./crew-bulletin-build";
import type { StoryProScriptHubNodeData } from "./story-pro-workspace-types";

/** 协作画布本地副本：任务清单保留，领取/完成状态重置（各画布独立） */
export function freshLocalCrewBulletin(
  bulletin: CrewBulletinState,
): CrewBulletinState {
  return {
    ...bulletin,
    tasks: bulletin.tasks.map((t) =>
      t.kind === "script"
        ? { ...t, status: "done" as const }
        : {
            ...t,
            status: "unclaimed" as const,
            assigneeUserId: undefined,
            assigneeDisplayName: undefined,
            canvasNodeId: undefined,
            claimedAt: undefined,
            completedAt: undefined,
          },
    ),
  };
}

/** 从 SCRIPT_PACKAGE 资产 payload 还原公告条与 hub 行数据 */
export function crewBulletinFromScriptPackagePayload(
  assetId: string,
  displayName: string,
  payload: Record<string, unknown>,
): {
  bulletin: CrewBulletinState;
  hubFields: Partial<StoryProScriptHubNodeData>;
} {
  const stored = payload.crewBulletin as CrewBulletinState | undefined;
  if (stored?.tasks?.length) {
    const bulletin = freshLocalCrewBulletin(stored);
    return {
      bulletin,
      hubFields: hubFieldsFromScriptPackagePayload(payload, bulletin),
    };
  }

  const hubFields: StoryProScriptHubNodeData = {
    outlineMd: String(payload.markdown ?? ""),
    characterMd: String(payload.characterMd ?? ""),
    sceneMd: String(payload.sceneMd ?? ""),
    storyboardMd: String(payload.storyboardMd ?? ""),
    providerId: "",
    modelKey: "",
    promptOutline: "",
    promptCharacter: "",
    promptStoryboard: "",
    scriptStudioTotalEpisodes: Number(payload.totalEpisodes) || 30,
    scriptStudioCharacterRows:
      (payload.scriptStudioCharacterRows as StoryProScriptHubNodeData["scriptStudioCharacterRows"]) ??
      [],
    sceneRows:
      (payload.sceneRows as StoryProScriptHubNodeData["sceneRows"]) ?? [],
    scriptStudioPropRows:
      (payload.scriptStudioPropRows as StoryProScriptHubNodeData["scriptStudioPropRows"]) ??
      [],
    scriptStudioFrameRows:
      (payload.scriptStudioFrameRows as StoryProScriptHubNodeData["scriptStudioFrameRows"]) ??
      [],
    scriptStudioMoodRows:
      (payload.scriptStudioMoodRows as StoryProScriptHubNodeData["scriptStudioMoodRows"]) ??
      [],
    scriptStudioAudioRows:
      (payload.scriptStudioAudioRows as StoryProScriptHubNodeData["scriptStudioAudioRows"]) ??
      [],
  };

  const bulletin = freshLocalCrewBulletin(
    buildCrewBulletinFromHub(`pkg-${assetId}`, hubFields, {
      scriptTitle: displayName.replace(/^剧本包 · /, "") || displayName,
    }),
  );

  return { bulletin, hubFields };
}

function hubFieldsFromScriptPackagePayload(
  payload: Record<string, unknown>,
  bulletin: CrewBulletinState,
): Partial<StoryProScriptHubNodeData> {
  return {
    outlineMd: String(payload.markdown ?? ""),
    characterMd: String(payload.characterMd ?? ""),
    sceneMd: String(payload.sceneMd ?? ""),
    storyboardMd: String(payload.storyboardMd ?? ""),
    scriptStudioTotalEpisodes:
      bulletin.totalEpisodes ??
      (Number(payload.totalEpisodes) || 30),
    scriptStudioCharacterRows:
      (payload.scriptStudioCharacterRows as StoryProScriptHubNodeData["scriptStudioCharacterRows"]) ??
      [],
    sceneRows:
      (payload.sceneRows as StoryProScriptHubNodeData["sceneRows"]) ?? [],
    scriptStudioPropRows:
      (payload.scriptStudioPropRows as StoryProScriptHubNodeData["scriptStudioPropRows"]) ??
      [],
    scriptStudioFrameRows:
      (payload.scriptStudioFrameRows as StoryProScriptHubNodeData["scriptStudioFrameRows"]) ??
      [],
    scriptStudioMoodRows:
      (payload.scriptStudioMoodRows as StoryProScriptHubNodeData["scriptStudioMoodRows"]) ??
      [],
    scriptStudioAudioRows:
      (payload.scriptStudioAudioRows as StoryProScriptHubNodeData["scriptStudioAudioRows"]) ??
      [],
    crewBulletin: bulletin,
    scriptPublished: true,
  };
}

export function mergeCompletedTaskSnapshots(
  bulletin: CrewBulletinState,
  snapshots: CrewBulletinTask[],
): CrewBulletinState {
  if (!snapshots.length) return bulletin;
  const byId = new Map(snapshots.map((t) => [t.id, t]));
  return {
    ...bulletin,
    tasks: bulletin.tasks.map((t) => {
      const snap = byId.get(t.id);
      if (!snap || snap.status !== "done") return t;
      return {
        ...t,
        status: "done",
        assigneeDisplayName:
          snap.assigneeDisplayName ?? t.assigneeDisplayName ?? "已完成",
        completedAt: snap.completedAt ?? t.completedAt,
      };
    }),
  };
}

/** 将 SCRIPT_PACKAGE 写入协作画布 starter（各画布独立任务状态） */
export function patchStarterFromScriptPackage(
  asset: { id: string; displayName: string; payload: Record<string, unknown> },
): Record<string, unknown> {
  const { bulletin, hubFields } = crewBulletinFromScriptPackagePayload(
    asset.id,
    asset.displayName,
    asset.payload,
  );
  const markdown = String(asset.payload.markdown ?? "").slice(0, 32000);
  return {
    workspaceIds: { linkedScriptPackageAssetId: asset.id },
    linkedScriptPackageTitle: asset.displayName,
    /** 仅供公告条任务上下文；不写入 generatedOutlineMd，避免 starter 显示剧本正文 */
    linkedScriptPackageMarkdown: markdown,
    crewBulletin: bulletin,
    scriptStudioTotalEpisodes: hubFields.scriptStudioTotalEpisodes,
    scriptStudioCharacterRows: hubFields.scriptStudioCharacterRows,
    sceneRows: hubFields.sceneRows,
    scriptStudioPropRows: hubFields.scriptStudioPropRows,
    scriptStudioFrameRows: hubFields.scriptStudioFrameRows,
    scriptStudioMoodRows: hubFields.scriptStudioMoodRows,
    scriptStudioAudioRows: hubFields.scriptStudioAudioRows,
  };
}
