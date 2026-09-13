import { materializeModuleSlots } from "./module-slots";
import {
  readDetailPageSuitePromptSnapshots,
  upsertPromptSnapshotsFromSuite,
} from "./prompt-snapshot";
import type {
  DetailPageSuiteMeta,
  DetailPageSuiteProject,
  DetailPageSuiteState,
} from "./types";

/** 规范化 suite：合并孤儿 prompt、从 meta 快照恢复，供读写库前统一调用 */
export function normalizeDetailPageSuiteState(
  suite: DetailPageSuiteState,
  meta: DetailPageSuiteMeta | null | undefined,
): DetailPageSuiteState {
  const snapshots = readDetailPageSuitePromptSnapshots(meta);
  return {
    ...suite,
    modules: suite.modules.map((mod) => ({
      ...mod,
      slots: materializeModuleSlots(mod, snapshots),
    })),
  };
}

export function normalizeDetailPageSuiteProject(
  project: DetailPageSuiteProject,
): { project: DetailPageSuiteProject; changed: boolean } {
  const suite = normalizeDetailPageSuiteState(project.suite, project.meta);
  const meta = upsertPromptSnapshotsFromSuite(project.meta, suite);
  const slotsJson = JSON.stringify(suite.modules.map((m) => m.slots));
  const prevJson = JSON.stringify(project.suite.modules.map((m) => m.slots));
  const metaJson = JSON.stringify(meta ?? null);
  const prevMetaJson = JSON.stringify(project.meta ?? null);
  const changed = slotsJson !== prevJson || metaJson !== prevMetaJson;
  return {
    project: changed ? { ...project, suite, meta } : project,
    changed,
  };
}

export function prepareDetailPageSuitePatch(
  existing: DetailPageSuiteProject,
  patch: {
    suite?: DetailPageSuiteState;
    meta?: DetailPageSuiteMeta | null;
  },
): { suite?: DetailPageSuiteState; meta?: DetailPageSuiteMeta | null } {
  if (patch.suite === undefined) return patch;
  const mergedMeta = patch.meta !== undefined ? patch.meta : existing.meta;
  const suite = normalizeDetailPageSuiteState(patch.suite, mergedMeta);
  const meta = upsertPromptSnapshotsFromSuite(mergedMeta, suite);
  return { suite, meta };
}
