import type { CrewBulletinGraphAnchor } from "./crew-bulletin-graph-anchor";
import type { CrewBulletinState, CrewBulletinTask } from "./crew-bulletin-types";

/** 公告条任务状态 · 多人协作订阅指纹（不含节点坐标） */
export function crewBulletinStateFingerprint(
  bulletin: CrewBulletinState | undefined,
): string {
  const tasks = bulletin?.tasks;
  if (!tasks?.length) return "";
  return tasks
    .map(
      (t) =>
        `${t.id}:${t.status}:${t.assigneeUserId ?? ""}:${t.canvasNodeId ?? ""}:${t.completedAt ?? ""}:${t.forkSubmissions?.length ?? 0}`,
    )
    .join(";");
}

export function crewBulletinAnchorFingerprint(
  anchor: CrewBulletinGraphAnchor | undefined,
): string {
  if (!anchor?.crewBulletin?.tasks?.length) return "";
  const rows =
    (anchor.scriptStudioCharacterRows?.length ?? 0) +
    (anchor.scriptStudioFrameRows?.length ?? 0);
  return `${crewBulletinStateFingerprint(anchor.crewBulletin)}|rows:${rows}`;
}

export function fingerprintBulletinFromGraphMeta(
  meta: { crewBulletinAnchor?: CrewBulletinGraphAnchor } | null | undefined,
): string {
  return crewBulletinAnchorFingerprint(meta?.crewBulletinAnchor);
}

const STATUS_RANK: Record<string, number> = {
  unclaimed: 0,
  claimed: 1,
  generating: 2,
  review: 2,
  blocked: 2,
  done: 3,
};

function taskStatusRank(status: string): number {
  return STATUS_RANK[status] ?? 0;
}

function taskTimestamp(task: CrewBulletinTask): number {
  const raw = task.completedAt ?? task.claimedAt ?? "";
  const ms = raw ? Date.parse(raw) : 0;
  return Number.isFinite(ms) ? ms : 0;
}

/** 按任务 id 合并公告条 · 保留较新 / 较高进度状态（多人协作） */
export function mergeCrewBulletinTasks(
  localTasks: CrewBulletinTask[],
  remoteTasks: CrewBulletinTask[],
): CrewBulletinTask[] {
  const remoteById = new Map(remoteTasks.map((t) => [t.id, t]));
  const localById = new Map(localTasks.map((t) => [t.id, t]));
  const ids = new Set([...localById.keys(), ...remoteById.keys()]);

  const merged: CrewBulletinTask[] = [];
  for (const id of ids) {
    const local = localById.get(id);
    const remote = remoteById.get(id);
    if (!local) {
      if (remote) merged.push(remote);
      continue;
    }
    if (!remote) {
      merged.push(local);
      continue;
    }

    const localRank = taskStatusRank(local.status);
    const remoteRank = taskStatusRank(remote.status);
    if (remoteRank > localRank) {
      merged.push(remote);
      continue;
    }
    if (localRank > remoteRank) {
      merged.push(local);
      continue;
    }
    merged.push(
      taskTimestamp(remote) >= taskTimestamp(local) ? remote : local,
    );
  }

  const script = merged.find((t) => t.kind === "script");
  const rest = merged.filter((t) => t.kind !== "script");
  rest.sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
  return script ? [script, ...rest] : rest;
}

export function mergeCrewBulletinStates(
  local: CrewBulletinState | undefined,
  remote: CrewBulletinState | undefined,
): CrewBulletinState | undefined {
  if (!remote?.tasks?.length) return local;
  if (!local?.tasks?.length) return remote;
  return {
    ...remote,
    ...local,
    scriptTitle: remote.scriptTitle || local.scriptTitle,
    totalEpisodes: remote.totalEpisodes || local.totalEpisodes,
    tasks: mergeCrewBulletinTasks(local.tasks, remote.tasks),
  };
}

/** 合并远端公告条：任务状态按 id 合并，行数据取更完整一侧 */
export function mergeCrewBulletinGraphAnchors(
  local: CrewBulletinGraphAnchor,
  remote: CrewBulletinGraphAnchor,
): CrewBulletinGraphAnchor {
  const pickRows = <T extends { key: string }>(
    a: T[] | undefined,
    b: T[] | undefined,
  ): T[] | undefined => {
    const left = a ?? [];
    const right = b ?? [];
    if (right.length > left.length) return right;
    if (left.length > right.length) return left;
    const score = (rows: T[]) =>
      rows.reduce((n, r) => n + JSON.stringify(r).length, 0);
    return score(right) >= score(left) ? right : left;
  };

  return {
    ...local,
    ...remote,
    linkedScriptPackageMarkdown:
      remote.linkedScriptPackageMarkdown?.trim() ||
      local.linkedScriptPackageMarkdown,
    characterMd: remote.characterMd?.trim() || local.characterMd,
    sceneMd: remote.sceneMd?.trim() || local.sceneMd,
    storyboardMd: remote.storyboardMd?.trim() || local.storyboardMd,
    crewBulletin:
      mergeCrewBulletinStates(local.crewBulletin, remote.crewBulletin) ??
      remote.crewBulletin ??
      local.crewBulletin,
    scriptStudioCharacterRows: pickRows(
      local.scriptStudioCharacterRows,
      remote.scriptStudioCharacterRows,
    ),
    sceneRows: pickRows(local.sceneRows, remote.sceneRows),
    scriptStudioPropRows: pickRows(
      local.scriptStudioPropRows,
      remote.scriptStudioPropRows,
    ),
    scriptStudioFrameRows: pickRows(
      local.scriptStudioFrameRows,
      remote.scriptStudioFrameRows,
    ),
    scriptStudioMoodRows: pickRows(
      local.scriptStudioMoodRows,
      remote.scriptStudioMoodRows,
    ),
    scriptStudioAudioRows: pickRows(
      local.scriptStudioAudioRows,
      remote.scriptStudioAudioRows,
    ),
  };
}
