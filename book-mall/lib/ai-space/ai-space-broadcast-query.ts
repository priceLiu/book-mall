/** 口播分镜 · 只读查询（Server Component 安全） */

import {
  getAiSpaceBroadcastProject,
  listAiSpaceBroadcastProjects,
} from "./ai-space-broadcast-service";

export type { BroadcastProjectDto } from "./ai-space-broadcast-types";

export { getAiSpaceBroadcastProject, listAiSpaceBroadcastProjects };
