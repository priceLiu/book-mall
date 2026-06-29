import {
  buildCrewBulletinFromHub,
  mergeCrewBulletinPreservingClaims,
} from "./crew-bulletin-build";
import type { CrewBulletinState, CrewBulletinTask } from "./crew-bulletin-types";
import { parseScriptPackageSnapshotsFromPayload } from "./script-package-snapshots";
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

function hubFieldsFromPayload(
  payload: Record<string, unknown>,
  bulletin?: CrewBulletinState,
): StoryProScriptHubNodeData {
  return {
    outlineMd: String(payload.markdown ?? ""),
    characterMd: String(payload.characterMd ?? ""),
    sceneMd: String(payload.sceneMd ?? ""),
    storyboardMd: String(payload.storyboardMd ?? ""),
    providerId: "",
    modelKey: "",
    promptOutline: "",
    promptCharacter: "",
    promptStoryboard: "",
    scriptStudioTotalEpisodes:
      bulletin?.totalEpisodes ?? (Number(payload.totalEpisodes) || 30),
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

function scriptTitleFromAsset(
  displayName: string,
  payload: Record<string, unknown>,
  stored?: CrewBulletinState,
): string {
  const fromStored = stored?.scriptTitle?.trim();
  if (fromStored && !looksLikeThemePrompt(fromStored)) return fromStored;
  const fromPayload = String(payload.scriptTitle ?? "").trim();
  if (fromPayload && !looksLikeThemePrompt(fromPayload)) return fromPayload;
  const fromName = displayName.replace(/^剧本包 · /, "").trim();
  if (fromName && !looksLikeThemePrompt(fromName)) return fromName;
  return fromStored || fromName || "剧本";
}

/** 一句话主题常被误写入 scriptTitle · 优先用资产名 */
function looksLikeThemePrompt(title: string): boolean {
  return (
    title.startsWith("请帮我") ||
    title.startsWith("帮我") ||
    title.includes("的故事") ||
    title.length > 48
  );
}

/** 从 payload 行/Markdown 重建任务，并合并旧清单里可能缺失的种类 */
function rebuildBulletinFromPayload(
  assetId: string,
  displayName: string,
  payload: Record<string, unknown>,
  stored?: CrewBulletinState,
): CrewBulletinState {
  const hubFields = hubFieldsFromPayload(payload, stored);
  const rebuilt = buildCrewBulletinFromHub(`pkg-${assetId}`, hubFields, {
    scriptTitle: scriptTitleFromAsset(displayName, payload, stored),
    publishedBy: stored?.publishedBy,
  });
  if (!stored?.tasks?.length) return rebuilt;
  return mergeBulletinTaskKinds(stored, rebuilt);
}

/** 保留 stored 的 script 元数据，任务行以 rebuilt 为准（补全缺失的角色/场景等） */
function mergeBulletinTaskKinds(
  stored: CrewBulletinState,
  rebuilt: CrewBulletinState,
): CrewBulletinState {
  const storedById = new Map(stored.tasks.map((t) => [t.id, t]));
  const rebuiltIds = new Set(rebuilt.tasks.map((t) => t.id));
  const tasks: CrewBulletinTask[] = rebuilt.tasks.map((t) => {
    const old = storedById.get(t.id);
    if (!old) return t;
    return {
      ...t,
      label: t.label || old.label,
      episodeNo: t.episodeNo ?? old.episodeNo,
      frameIndex: t.frameIndex ?? old.frameIndex,
    };
  });
  for (const old of stored.tasks) {
    if (!rebuiltIds.has(old.id) && old.kind !== "script") {
      tasks.push(old);
    }
  }
  return {
    ...rebuilt,
    publishedAt: stored.publishedAt || rebuilt.publishedAt,
    scriptTitle: rebuilt.scriptTitle || stored.scriptTitle,
    totalEpisodes: rebuilt.totalEpisodes || stored.totalEpisodes,
    tasks,
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
  const rebuilt = rebuildBulletinFromPayload(
    assetId,
    displayName,
    payload,
    stored,
  );
  const bulletin = freshLocalCrewBulletin(rebuilt);
  return {
    bulletin,
    hubFields: {
      ...hubFieldsFromPayload(payload, bulletin),
      crewBulletin: bulletin,
    },
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
    scriptPackageSnapshots: parseScriptPackageSnapshotsFromPayload(
      asset.payload,
    ),
  };
}

/** 打开协作画布时 · 从 meta 行数据补全可能缺失的公告条任务 */
export function refreshGraphAnchorCrewBulletin(
  anchor: import("./crew-bulletin-graph-anchor").CrewBulletinGraphAnchor,
): import("./crew-bulletin-graph-anchor").CrewBulletinGraphAnchor {
  const hubFields = {
    ...hubFieldsFromPayload(
      {
        markdown: anchor.linkedScriptPackageMarkdown ?? "",
        characterMd: anchor.characterMd ?? "",
        sceneMd: anchor.sceneMd ?? "",
        storyboardMd: anchor.storyboardMd ?? "",
        totalEpisodes: anchor.scriptStudioTotalEpisodes,
        scriptStudioCharacterRows: anchor.scriptStudioCharacterRows,
        sceneRows: anchor.sceneRows,
        scriptStudioPropRows: anchor.scriptStudioPropRows,
        scriptStudioFrameRows: anchor.scriptStudioFrameRows,
        scriptStudioMoodRows: anchor.scriptStudioMoodRows,
        scriptStudioAudioRows: anchor.scriptStudioAudioRows,
      },
      anchor.crewBulletin,
    ),
    crewBulletin: anchor.crewBulletin,
  };
  const refreshed = mergeCrewBulletinPreservingClaims(
    anchor.crewBulletin,
    buildCrewBulletinFromHub(
      anchor.linkedScriptPackageAssetId,
      hubFields,
      {
        scriptTitle: scriptTitleFromAsset(
          anchor.linkedScriptPackageTitle ?? "",
          {
            markdown: anchor.linkedScriptPackageMarkdown ?? "",
          },
          anchor.crewBulletin,
        ),
      },
    ),
  );
  return {
    ...anchor,
    crewBulletin: refreshed,
    scriptStudioCharacterRows:
      hubFields.scriptStudioCharacterRows ?? anchor.scriptStudioCharacterRows,
    sceneRows: hubFields.sceneRows ?? anchor.sceneRows,
    scriptStudioPropRows:
      hubFields.scriptStudioPropRows ?? anchor.scriptStudioPropRows,
    scriptStudioFrameRows:
      hubFields.scriptStudioFrameRows ?? anchor.scriptStudioFrameRows,
    scriptStudioMoodRows:
      hubFields.scriptStudioMoodRows ?? anchor.scriptStudioMoodRows,
    scriptStudioAudioRows:
      hubFields.scriptStudioAudioRows ?? anchor.scriptStudioAudioRows,
  };
}
