import type { ComicProject, GenerationStatus } from "./types";

function isInflightStatus(s: GenerationStatus | null | undefined): boolean {
  return s === "PENDING" || s === "SUBMITTED";
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

export function countInflightTasks(project: ComicProject): number {
  const ids = new Set<string>();
  for (const t of project.pendingTasks) {
    if (t.status === "PENDING" || t.status === "SUBMITTED") ids.add(t.id);
  }
  if (isInflightStatus(project.coverTaskStatus) && project.coverTaskStatus) {
    ids.add(`cover:${project.id}`);
  }
  for (const c of project.characters) {
    if (isInflightStatus(c.avatarTaskStatus)) ids.add(`avatar:${c.id}`);
  }
  for (const f of project.storyboardFrames) {
    if (isInflightStatus(f.imageTaskStatus)) ids.add(`fi:${f.id}`);
    if (isInflightStatus(f.videoTaskStatus)) ids.add(`fv:${f.id}`);
  }
  return ids.size;
}
