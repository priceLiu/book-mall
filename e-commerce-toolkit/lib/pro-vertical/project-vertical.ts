import type { StoryboardProject } from "@/lib/storyboard-types";
import { isProVerticalId, type ProVerticalId } from "@/lib/pro-vertical/registry";

function workflowOf(project: StoryboardProject): Record<string, unknown> {
  return (project.meta?.workflow ?? {}) as Record<string, unknown>;
}

/** 电商专业版模式（含尚未选定大类的草稿项目） */
export function isProModeProject(project: StoryboardProject): boolean {
  const wf = workflowOf(project);
  if (wf.proMode === true) return true;
  if (isProVerticalId(typeof wf.vertical === "string" ? wf.vertical : null)) return true;
  if (typeof wf.fashionPhase === "string" || typeof wf.proPhase === "string") {
    return !isLegacyGenericStoryboard(project);
  }
  return false;
}

function isLegacyGenericStoryboard(project: StoryboardProject): boolean {
  const wf = workflowOf(project);
  if (wf.phase != null || wf.paramStep != null || wf.paramCollecting != null) return true;
  const d = project.meta?.deliverable as Record<string, unknown> | undefined;
  if (d?.schemes != null || d?.analysis != null) return true;
  return false;
}

export function getProjectVertical(project: StoryboardProject): ProVerticalId | null {
  const v = project.meta?.workflow?.vertical;
  return isProVerticalId(typeof v === "string" ? v : null) ? v : null;
}

export function isProVerticalProject(project: StoryboardProject): boolean {
  return isProModeProject(project);
}

export function isBagsProject(project: StoryboardProject): boolean {
  return getProjectVertical(project) === "bags";
}

export function isFashionVerticalProject(project: StoryboardProject): boolean {
  return getProjectVertical(project) === "fashion_apparel";
}

export function hasProProductRef(project: StoryboardProject): boolean {
  return project.references.some((r) => r.role === "product");
}

/** 已上传产品图、尚未选定大类 */
export function isAwaitingProCategoryPick(project: StoryboardProject): boolean {
  if (!isProModeProject(project)) return false;
  if (getProjectVertical(project)) return false;
  return hasProProductRef(project);
}
