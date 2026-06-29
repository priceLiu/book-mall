import type { CrewBulletinState, CrewBulletinTask, CrewTaskKind } from "./crew-bulletin-types";

/** 制作环节 · 公告条横向步骤（剧本发布后） */
export type CrewProductionPhaseId =
  | "script"
  | "character"
  | "scene"
  | "prop"
  | "mood"
  | "frame"
  | "frameVideo"
  | "audio"
  | "dialogue"
  | "composite";

export type CrewProductionPhaseStatus = "not_started" | "in_progress" | "done";

export type CrewProductionPhase = {
  id: CrewProductionPhaseId;
  label: string;
  status: CrewProductionPhaseStatus;
  doneCount: number;
  totalCount: number;
  subtitle: string;
  /** 本环节全部任务 */
  phaseTasks: CrewBulletinTask[];
  /** 可领取 */
  pendingTasks: CrewBulletinTask[];
  /** 已领取 / 生成中 */
  activeTasks: CrewBulletinTask[];
  /** 已完成 · 可点击查看作品 */
  completedTasks: CrewBulletinTask[];
};

const PHASE_KINDS: Record<CrewProductionPhaseId, CrewTaskKind[]> = {
  script: ["script"],
  character: ["character"],
  scene: ["scene"],
  prop: ["prop"],
  mood: ["mood"],
  frame: ["frame"],
  frameVideo: ["frameVideo"],
  audio: ["audio"],
  dialogue: ["dialogue"],
  composite: ["composite"],
};

export const CREW_PRODUCTION_PHASE_ORDER: CrewProductionPhaseId[] = [
  "script",
  "character",
  "scene",
  "prop",
  "mood",
  "frame",
  "frameVideo",
  "audio",
  "dialogue",
  "composite",
];

export const CREW_PRODUCTION_PHASE_LABELS: Record<CrewProductionPhaseId, string> = {
  script: "剧本已定",
  character: "资产制作(角色)",
  scene: "资产制作(场景)",
  prop: "资产制作(道具)",
  mood: "资产制作(氛围)",
  frame: "分镜图",
  frameVideo: "分镜视频",
  audio: "后期(音效)",
  dialogue: "后期(对白)",
  composite: "后期(合成)",
};

function isActiveTaskStatus(status: CrewBulletinTask["status"]): boolean {
  return (
    status === "claimed" ||
    status === "generating" ||
    status === "review" ||
    status === "blocked"
  );
}

function phaseStatusFromTasks(
  tasks: CrewBulletinTask[],
  forceDone?: boolean,
  unlocked = true,
): CrewProductionPhaseStatus {
  if (forceDone) return "done";
  if (!unlocked) return "not_started";
  if (tasks.length === 0) return "not_started";
  const doneCount = tasks.filter((t) => t.status === "done").length;
  if (doneCount === tasks.length) return "done";
  const active = tasks.some((t) => isActiveTaskStatus(t.status));
  if (doneCount > 0 || active) return "in_progress";
  return "in_progress";
}

const PRE_FRAME_ASSET_PHASES: CrewProductionPhaseId[] = [
  "character",
  "scene",
  "prop",
  "mood",
];

function preFrameAssetsComplete(
  byKind: Map<CrewTaskKind, CrewBulletinTask[]>,
): boolean {
  for (const phaseId of PRE_FRAME_ASSET_PHASES) {
    for (const kind of PHASE_KINDS[phaseId]) {
      const tasks = byKind.get(kind) ?? [];
      if (tasks.length === 0) continue;
      if (tasks.some((t) => t.status !== "done")) return false;
    }
  }
  return true;
}

function phaseUnlocked(
  id: CrewProductionPhaseId,
  byKind: Map<CrewTaskKind, CrewBulletinTask[]>,
  phaseTasks: CrewBulletinTask[],
): boolean {
  if (id === "script") return true;
  if (PRE_FRAME_ASSET_PHASES.includes(id)) return true;
  if (
    phaseTasks.some((t) => t.status !== "unclaimed" && t.status !== "blocked")
  ) {
    return true;
  }
  if (
    id === "frame" ||
    id === "frameVideo" ||
    id === "audio" ||
    id === "dialogue" ||
    id === "composite"
  ) {
    return preFrameAssetsComplete(byKind);
  }
  return true;
}

function phaseSubtitle(
  status: CrewProductionPhaseStatus,
  doneCount: number,
  totalCount: number,
  scriptTitle?: string,
): string {
  if (status === "done" && totalCount === 0 && scriptTitle) {
    return scriptTitle;
  }
  if (totalCount === 0) return "未开始";
  if (status === "done") {
    return totalCount === 1
      ? "已完成"
      : `${doneCount}/${totalCount} 已完成`;
  }
  if (status === "in_progress") {
    const remain = totalCount - doneCount;
    return `${doneCount}/${totalCount} 已生成、还差 ${remain} 个`;
  }
  return `0/${totalCount} 未开始`;
}

/** 从公告条任务聚合制作环节状态（全员只读） */
export function computeCrewProductionPhases(
  bulletin: CrewBulletinState | undefined,
): CrewProductionPhase[] {
  const tasks = bulletin?.tasks ?? [];
  const byKind = new Map<CrewTaskKind, CrewBulletinTask[]>();
  for (const t of tasks) {
    const list = byKind.get(t.kind) ?? [];
    list.push(t);
    byKind.set(t.kind, list);
  }

  return CREW_PRODUCTION_PHASE_ORDER.map((id) => {
    const kinds = PHASE_KINDS[id];
    const phaseTasks = kinds.flatMap((k) => byKind.get(k) ?? []);
    const forceDone = id === "script" && phaseTasks.length > 0;
    const unlocked = phaseUnlocked(id, byKind, phaseTasks);
    const status = phaseStatusFromTasks(phaseTasks, forceDone, unlocked);
    const doneCount = phaseTasks.filter((t) => t.status === "done").length;
    const totalCount = phaseTasks.length;
    const completedTasks = phaseTasks.filter((t) => t.status === "done");
    const pendingTasks = phaseTasks.filter((t) => t.status === "unclaimed");
    const activeTasks = phaseTasks.filter((t) => isActiveTaskStatus(t.status));

    return {
      id,
      label: CREW_PRODUCTION_PHASE_LABELS[id],
      status,
      doneCount,
      totalCount,
      subtitle: phaseSubtitle(
        status,
        doneCount,
        totalCount,
        id === "script" ? bulletin?.scriptTitle : undefined,
      ),
      phaseTasks,
      pendingTasks,
      activeTasks,
      completedTasks,
    };
  });
}
