import { materializeModuleSlots, mergeModuleSlotsPreservingContent } from "./module-slots";
import { ensureDetailPageSuiteSizeChartModuleAtEnd } from "./ensure-size-chart-module-at-end";
import { ensureBriefSizeChartDefaults } from "./size-chart-image";
import { migrateHitSuiteSlotCopyFields } from "@/lib/ecom/detail-page-suite-hit/hit-suite-migrate";
import { migrateDetailPageSuiteProject } from "./suite-migrate";
import {
  ECOM_DETAIL_PAGE_SUITE_HIT_MODULE,
  ECOM_DETAIL_PAGE_SUITE_REPLICA_MODULE,
} from "./types";
import { reconcileDetailPageSuitePendingMeta } from "./pending-state";
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
  const migrated = migrateDetailPageSuiteProject(project);
  project = migrated.project;
  const hitCopyMigrated = migrateHitSuiteSlotCopyFields(project);
  project = hitCopyMigrated.project;
  let suite = project.suite;
  let brief = project.brief;
  if (
    project.module === ECOM_DETAIL_PAGE_SUITE_HIT_MODULE ||
    project.module === ECOM_DETAIL_PAGE_SUITE_REPLICA_MODULE
  ) {
    const ensured = ensureDetailPageSuiteSizeChartModuleAtEnd(suite);
    if (ensured.changed) suite = ensured.suite;
    const briefNext = ensureBriefSizeChartDefaults(brief);
    if (JSON.stringify(briefNext) !== JSON.stringify(brief ?? null)) {
      brief = briefNext;
      project = { ...project, brief: briefNext };
    }
  }
  suite = normalizeDetailPageSuiteState(suite, project.meta);
  let meta = upsertPromptSnapshotsFromSuite(project.meta, suite);
  meta = reconcileDetailPageSuitePendingMeta(suite, meta);
  const slotsJson = JSON.stringify(suite.modules.map((m) => m.slots));
  const prevJson = JSON.stringify(project.suite.modules.map((m) => m.slots));
  const metaJson = JSON.stringify(meta ?? null);
  const prevMetaJson = JSON.stringify(project.meta ?? null);
  const normalizedChanged = slotsJson !== prevJson || metaJson !== prevMetaJson;
  const workbenchChanged =
    (project.module === ECOM_DETAIL_PAGE_SUITE_HIT_MODULE ||
      project.module === ECOM_DETAIL_PAGE_SUITE_REPLICA_MODULE) &&
    (JSON.stringify(suite.modules) !== JSON.stringify(project.suite.modules) ||
      JSON.stringify(brief) !== JSON.stringify(project.brief ?? null));
  const changed =
    migrated.changed || hitCopyMigrated.changed || normalizedChanged || workbenchChanged;
  return {
    project: changed ? { ...project, suite, meta, brief } : project,
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
  const snapshots = readDetailPageSuitePromptSnapshots(mergedMeta);
  const mergedSuite: DetailPageSuiteState = {
    ...patch.suite,
    modules: patch.suite.modules.map((incomingMod) => {
      const existingMod = existing.suite.modules.find((m) => m.module_id === incomingMod.module_id);
      if (!existingMod) return incomingMod;
      const prevSlots = materializeModuleSlots(existingMod, snapshots);
      const nextSlots = materializeModuleSlots(incomingMod, snapshots);
      return {
        ...incomingMod,
        slots: mergeModuleSlotsPreservingContent(prevSlots, nextSlots),
      };
    }),
  };
  const suite = normalizeDetailPageSuiteState(mergedSuite, mergedMeta);
  const meta = upsertPromptSnapshotsFromSuite(mergedMeta, suite);
  return { suite, meta };
}
