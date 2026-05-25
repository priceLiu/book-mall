import type { ComicProject, GenerationStatus, PendingTask } from "./types";

function isInflightStatus(s: GenerationStatus | null | undefined): boolean {
  return s === "PENDING" || s === "SUBMITTED";
}

/** pendingTasks 里是否已有匹配的进行中任务（与 *TaskStatus 兜底互斥，避免重复计数） */
function pendingHasInflight(
  pending: PendingTask[],
  match: (t: PendingTask) => boolean,
): boolean {
  return pending.some((t) => isInflightStatus(t.status) && match(t));
}

/** 项目是否存在进行中的 AI 任务（pendingTasks + *TaskStatus 双通道，避免状态闪烁） */
export function projectHasInflightTasks(project: ComicProject): boolean {
  if (
    project.pendingTasks.some(
      (t) => t.status === "PENDING" || t.status === "SUBMITTED",
    )
  ) {
    return true;
  }
  if (isInflightStatus(project.coverTaskStatus)) return true;
  if (project.characters.some((c) => isInflightStatus(c.avatarTaskStatus))) {
    return true;
  }
  return project.storyboardFrames.some(
    (f) =>
      isInflightStatus(f.imageTaskStatus) ||
      isInflightStatus(f.videoTaskStatus),
  );
}

/**
 * 进行中的任务数：以 `pendingTasks`（StoryGenerationTask 真值）为主；
 * 仅当列表未收录、但实体 *TaskStatus 仍为 PENDING/SUBMITTED 时用兜底键补 1（防轮询空窗，不重复计）。
 */
export function countInflightTasks(project: ComicProject): number {
  const ids = new Set<string>();
  for (const t of project.pendingTasks) {
    if (isInflightStatus(t.status)) ids.add(t.id);
  }
  if (
    isInflightStatus(project.coverTaskStatus) &&
    !pendingHasInflight(project.pendingTasks, (t) => t.kind === "COVER_IMAGE")
  ) {
    ids.add(`cover:${project.id}`);
  }
  for (const c of project.characters) {
    if (
      isInflightStatus(c.avatarTaskStatus) &&
      !pendingHasInflight(
        project.pendingTasks,
        (t) => t.kind === "CHARACTER_AVATAR" && t.characterId === c.id,
      )
    ) {
      ids.add(`avatar:${c.id}`);
    }
  }
  for (const f of project.storyboardFrames) {
    if (
      isInflightStatus(f.imageTaskStatus) &&
      !pendingHasInflight(
        project.pendingTasks,
        (t) => t.kind === "FRAME_IMAGE" && t.frameId === f.id,
      )
    ) {
      ids.add(`fi:${f.id}`);
    }
    if (
      isInflightStatus(f.videoTaskStatus) &&
      !pendingHasInflight(
        project.pendingTasks,
        (t) => t.kind === "FRAME_VIDEO" && t.frameId === f.id,
      )
    ) {
      ids.add(`fv:${f.id}`);
    }
  }
  return ids.size;
}
