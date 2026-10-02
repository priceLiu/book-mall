import {
  getDetailPageSuiteAplusProject,
  getDetailPageSuiteProject,
  updateDetailPageSuiteAplusProject,
  updateDetailPageSuiteProject,
} from "./project-service";
import {
  ECOM_AI_DETAIL_PAGE_MODULE,
  ECOM_AI_DETAIL_PAGE_TOOL_KEY,
  ECOM_DETAIL_PAGE_SUITE_MODULE,
  ECOM_DETAIL_PAGE_SUITE_TOOL_KEY,
  type DetailPageSuiteProject,
} from "./types";

type UpdateFn = (
  userId: string,
  id: string,
  patch: Parameters<typeof updateDetailPageSuiteProject>[2],
) => Promise<DetailPageSuiteProject | null>;

export async function loadDetailPageSuiteForOps(
  userId: string,
  projectId: string,
  projectModule?: string,
): Promise<{
  project: DetailPageSuiteProject;
  update: UpdateFn;
  toolKey: string;
  isAplus: boolean;
} | null> {
  const key = projectModule?.trim() || ECOM_DETAIL_PAGE_SUITE_MODULE;
  if (key === ECOM_AI_DETAIL_PAGE_MODULE) {
    const project = await getDetailPageSuiteAplusProject(userId, projectId);
    if (!project) return null;
    return {
      project,
      update: updateDetailPageSuiteAplusProject,
      toolKey: ECOM_AI_DETAIL_PAGE_TOOL_KEY,
      isAplus: true,
    };
  }
  const project = await getDetailPageSuiteProject(userId, projectId);
  if (!project) return null;
  return {
    project,
    update: updateDetailPageSuiteProject,
    toolKey: ECOM_DETAIL_PAGE_SUITE_TOOL_KEY,
    isAplus: false,
  };
}
