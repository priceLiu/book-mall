import type {
  StoryProAudioRow,
  StoryProCharacterRow,
  StoryProFrameRow,
  StoryProMoodRow,
  StoryProPropRow,
  StoryProSceneRow,
  StoryProScriptHubNodeData,
} from "./story-pro-workspace-types";
import {
  crewTaskId,
  type CrewBulletinState,
  type CrewBulletinTask,
  type CrewTaskKind,
} from "./crew-bulletin-types";
import { resolvePro2HubTableTitle } from "./pro2-hub-display-title";
import { syncStoryProColumnRows } from "./story-pro-column-sync";

function pushRowTasks(
  tasks: CrewBulletinTask[],
  kind: CrewTaskKind,
  rows: Array<{ key: string; name?: string; episodeNo?: number; frameIndex?: number }>,
  labelFn: (r: (typeof rows)[number]) => string,
): void {
  for (const row of rows) {
    const label = labelFn(row);
    if (!label.trim()) continue;
    tasks.push({
      id: crewTaskId(kind, row.key, row.episodeNo, row.frameIndex),
      kind,
      rowKey: row.key,
      label,
      episodeNo: row.episodeNo,
      frameIndex: row.frameIndex,
      status: "unclaimed",
    });
  }
}

function rowDetailScore(row: {
  description?: string;
  prompt?: string;
  appearance?: string;
  role?: string;
}): number {
  let score = 0;
  if (row.description?.trim()) score += 1;
  if (row.prompt?.trim()) score += 2;
  if (row.appearance?.trim()) score += 1;
  if (row.role?.trim()) score += 1;
  return score;
}

/** 内嵌 rows 与 Markdown 解析 rows 合并 · 保留 task rowKey，补全缺失字段 */
function mergeCrewBulletinRowsByName<
  T extends {
    key: string;
    name?: string;
    description?: string;
    prompt?: string;
    appearance?: string;
    role?: string;
  },
>(stored: T[], synced: T[]): T[] {
  if (!stored.length) return synced;
  if (!synced.length) return stored;

  const syncedByName = new Map(
    synced.map((r) => [r.name?.trim() || r.key, r]),
  );
  const seenNames = new Set<string>();
  const merged = stored.map((row) => {
    const name = row.name?.trim() || row.key;
    seenNames.add(name);
    const parsed = syncedByName.get(name);
    if (!parsed) return row;
    const richer =
      rowDetailScore(row) >= rowDetailScore(parsed) ? row : parsed;
    return { ...richer, key: row.key };
  });

  for (const row of synced) {
    const name = row.name?.trim() || row.key;
    if (seenNames.has(name)) continue;
    if (stored.some((s) => s.key === row.key)) continue;
    merged.push(row);
  }
  return merged;
}

/** 分镜行 · 按 key 合并，补全场景/画面等字段 */
function mergeCrewBulletinFrameRows(
  stored: StoryProFrameRow[],
  synced: StoryProFrameRow[],
): StoryProFrameRow[] {
  if (!stored.length) return synced;
  if (!synced.length) return stored;

  const syncedByKey = new Map(synced.map((r) => [r.key, r]));
  const merged = stored.map((row) => {
    const alt = syncedByKey.get(row.key);
    if (!alt) return row;
    return {
      ...alt,
      ...row,
      key: row.key,
      scene: row.scene?.trim() || alt.scene?.trim() || "",
      description: row.description?.trim() || alt.description?.trim() || "",
      shotSize: row.shotSize?.trim() || alt.shotSize?.trim() || "",
      dialogue: row.dialogue?.trim() || alt.dialogue?.trim() || "",
      prompt: row.prompt?.trim() || alt.prompt?.trim() || "",
    };
  });

  for (const row of synced) {
    if (stored.some((s) => s.key === row.key)) continue;
    merged.push(row);
  }
  return merged;
}

/** 从 hub 内嵌 rows 或分镜/角色 Markdown 解析制作任务源数据 */
export function resolveHubRowsForCrewBulletin(
  hubId: string,
  hubData: StoryProScriptHubNodeData,
): {
  characters: StoryProCharacterRow[];
  scenes: StoryProSceneRow[];
  props: StoryProPropRow[];
  moods: StoryProMoodRow[];
  audios: StoryProAudioRow[];
  frames: StoryProFrameRow[];
} {
  const synced = syncStoryProColumnRows(
    hubData,
    {
      characterRows: hubData.scriptStudioCharacterRows,
      sceneRows: hubData.sceneRows,
      frameRows: hubData.scriptStudioFrameRows,
    },
    hubId,
  );

  return {
    characters: mergeCrewBulletinRowsByName(
      hubData.scriptStudioCharacterRows ?? [],
      synced.characterRows,
    ),
    scenes: mergeCrewBulletinRowsByName(
      hubData.sceneRows ?? [],
      synced.sceneRows,
    ),
    props: hubData.scriptStudioPropRows ?? [],
    moods: hubData.scriptStudioMoodRows ?? [],
    audios: hubData.scriptStudioAudioRows ?? [],
    frames: mergeCrewBulletinFrameRows(
      hubData.scriptStudioFrameRows ?? [],
      synced.frameRows,
    ),
  };
}

/** 从 hub 解析行构建公告条任务清单（发布时调用） */
export function buildCrewBulletinFromHub(
  hubId: string,
  hubData: StoryProScriptHubNodeData,
  opts?: { publishedBy?: string; scriptTitle?: string },
): CrewBulletinState {
  const { characters, scenes, props, moods, audios, frames } =
    resolveHubRowsForCrewBulletin(hubId, hubData);

  const tasks: CrewBulletinTask[] = [];

  const scriptTitle =
    opts?.scriptTitle?.trim() ||
    resolvePro2HubTableTitle(null, hubData.outlineMd ?? "") ||
    hubData.crewBulletin?.scriptTitle?.trim() ||
    hubData.scriptStudioThemeInput?.trim() ||
    "剧本";

  tasks.push({
    id: crewTaskId("script", hubId),
    kind: "script",
    rowKey: hubId,
    label: scriptTitle,
    status: "done",
  });

  pushRowTasks(tasks, "character", characters, (r) => r.name ?? r.key);
  pushRowTasks(tasks, "scene", scenes, (r) => r.name ?? r.key);
  pushRowTasks(tasks, "prop", props, (r) => r.name ?? r.key);
  pushRowTasks(tasks, "mood", moods, (r) => r.name ?? r.key);
  pushRowTasks(tasks, "audio", audios, (r) => r.name ?? r.key);
  pushRowTasks(tasks, "frame", frames, (r) => {
    const fr = r as StoryProFrameRow;
    const ep =
      fr.episodeNo != null ? `E${String(fr.episodeNo).padStart(2, "0")}` : "";
    const shot = fr.frameIndex != null ? `镜${fr.frameIndex}` : "";
    const name = fr.description?.slice(0, 24) ?? fr.key;
    return [ep, shot, name].filter(Boolean).join(" · ");
  });

  pushRowTasks(tasks, "frameVideo", frames, (r) => {
    const fr = r as StoryProFrameRow;
    const shot = fr.frameIndex != null ? `镜${fr.frameIndex}` : r.key;
    return `视频 · ${shot}`;
  });

  const dialogueFrames = frames.filter((r) =>
    String((r as StoryProFrameRow).dialogue ?? "").trim(),
  );
  pushRowTasks(tasks, "dialogue", dialogueFrames, (r) => {
    const fr = r as StoryProFrameRow;
    const shot = fr.frameIndex != null ? `镜${fr.frameIndex}` : r.key;
    const line = fr.dialogue?.trim().slice(0, 20) ?? "";
    return line ? `${shot} · ${line}` : shot;
  });

  pushRowTasks(tasks, "composite", frames, (r) => {
    const fr = r as StoryProFrameRow;
    const shot = fr.frameIndex != null ? `镜${fr.frameIndex}` : r.key;
    return `合成 · ${shot}`;
  });

  return {
    publishedAt: new Date().toISOString(),
    publishedBy: opts?.publishedBy,
    hubNodeId: hubId,
    scriptTitle,
    totalEpisodes: hubData.scriptStudioTotalEpisodes ?? 30,
    tasks,
  };
}

/** 合并已有公告条上的领取/完成状态（重新发布时保留进行中的任务） */
export function mergeCrewBulletinPreservingClaims(
  prev: CrewBulletinState | undefined,
  next: CrewBulletinState,
): CrewBulletinState {
  if (!prev?.tasks?.length) return next;
  const prevById = new Map(prev.tasks.map((t) => [t.id, t]));
  return {
    ...next,
    tasks: next.tasks.map((t) => {
      const old = prevById.get(t.id);
      if (!old || old.status === "unclaimed") return t;
      return {
        ...t,
        status: old.status,
        assigneeUserId: old.assigneeUserId,
        assigneeDisplayName: old.assigneeDisplayName,
        canvasNodeId: old.canvasNodeId,
        claimedAt: old.claimedAt,
        completedAt: old.completedAt,
      };
    }),
  };
}

/** 发布剧本 · 构建/刷新公告条 */
export function publishScriptHubCrewBulletin(
  hubId: string,
  hubData: StoryProScriptHubNodeData,
  opts?: { publishedBy?: string; scriptTitle?: string },
): {
  crewBulletin: CrewBulletinState;
  scriptPublished: true;
  scriptFinalized: true;
} {
  const next = buildCrewBulletinFromHub(hubId, hubData, opts);
  const crewBulletin = mergeCrewBulletinPreservingClaims(
    hubData.crewBulletin,
    next,
  );
  return {
    crewBulletin,
    scriptPublished: true,
    scriptFinalized: true,
  };
}

/** 已发布后 · 从最新 hub 数据刷新任务清单（保留领取/完成状态） */
export function refreshCrewBulletinFromHub(
  hubId: string,
  hubData: StoryProScriptHubNodeData,
): CrewBulletinState {
  const next = buildCrewBulletinFromHub(hubId, hubData, {
    scriptTitle: hubData.crewBulletin?.scriptTitle,
    publishedBy: hubData.crewBulletin?.publishedBy,
  });
  return mergeCrewBulletinPreservingClaims(hubData.crewBulletin, next);
}
