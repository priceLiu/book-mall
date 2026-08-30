import type { StoryboardProject } from "@/lib/storyboard-types";
import { getProVerticalConfig, isProVerticalId } from "@/lib/pro-vertical/registry";
import type { CharacterRefPolicy, ProVerticalId } from "@/lib/pro-vertical/types";

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
  if (typeof v !== "string") return null;
  return isProVerticalId(v) ? v : null;
}

export function isProVerticalProject(project: StoryboardProject): boolean {
  return isProModeProject(project);
}

export function isBagsProject(project: StoryboardProject): boolean {
  return getProjectVertical(project) === "bags";
}

/** 非服装 Pro vertical（包包、3C 数码等 pro-v1 品类） */
export function isNonFashionProVertical(project: StoryboardProject): boolean {
  const v = getProjectVertical(project);
  return v != null && v !== "fashion_apparel";
}

/** 工作流阶段字段走 proPhase / pro-step 前缀 */
export function usesProPhase(project: StoryboardProject): boolean {
  return isNonFashionProVertical(project) || (isProModeProject(project) && !getProjectVertical(project));
}

export function getProjectCharacterRefPolicy(project: StoryboardProject): CharacterRefPolicy {
  const vertical = getProjectVertical(project);
  if (!vertical) return "required";
  return getProVerticalConfig(vertical)?.characterRefPolicy ?? "required";
}

export function isCharacterRefRequired(project: StoryboardProject): boolean {
  return getProjectCharacterRefPolicy(project) === "required";
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
