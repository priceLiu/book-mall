import { ECOM_DETAIL_PAGE_SUITE_HIT_MODULE } from "@/lib/ecom/detail-page-suite/types";
import type { DetailPageSuiteProject, DetailPageSuiteSlot } from "@/lib/ecom/detail-page-suite/types";

import { isHitSuiteModuleExcludedFromCopyRewrite } from "./hit-slot-copy-rules";

/** 旧版全项目「出图烧字」→ 按格 burn_copy_in_image；补全 slot_copy_ai */
export function migrateHitSuiteSlotCopyFields(
  project: DetailPageSuiteProject,
): { project: DetailPageSuiteProject; changed: boolean } {
  if (project.module !== ECOM_DETAIL_PAGE_SUITE_HIT_MODULE) {
    return { project, changed: false };
  }

  const globalBurn = project.settings.hitIncludeSlotCopyOnImage === true;
  let changed = false;

  const modules = project.suite.modules.map((mod) => {
    if (isHitSuiteModuleExcludedFromCopyRewrite(mod.module_id)) return mod;
    const slots = mod.slots.map((slot): DetailPageSuiteSlot => {
      let next = slot;
      const copy = slot.slot_copy?.trim();
      if (copy && !slot.slot_copy_ai?.trim()) {
        next = { ...next, slot_copy_ai: copy };
        changed = true;
      }
      if (globalBurn && copy && slot.burn_copy_in_image !== true) {
        next = { ...next, burn_copy_in_image: true };
        changed = true;
      }
      return next;
    });
    if (slots === mod.slots) return mod;
    return { ...mod, slots };
  });

  let settings = project.settings;
  if (globalBurn && changed) {
    const { hitIncludeSlotCopyOnImage: _removed, ...rest } = settings;
    settings = rest;
    changed = true;
  }

  if (!changed) return { project, changed: false };
  return {
    project: {
      ...project,
      settings,
      suite: { ...project.suite, modules },
    },
    changed: true,
  };
}
