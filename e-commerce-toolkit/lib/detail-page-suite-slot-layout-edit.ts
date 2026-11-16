import type { EcomCopyOverlay } from "@private/ecom-copy-overlay";

import type { DetailPageSuiteSlotPromptSaveExtras } from "@/lib/detail-page-suite-slot-prompt-edit-types";
import {
  ensureExportTargets,
  resolveActiveExportTargetIds,
} from "@/lib/detail-page-suite-export-targets";
import { resolveDetailPageExportWidthPx } from "@/lib/detail-page-suite-platform-ratio";
import type { EcomDetailPageRatio } from "@/lib/detail-page-suite-platform-ratio";
import {
  resolveDetailPageSuiteActiveImageIndex,
  resolveDetailPageSuiteSlotHistory,
} from "@/lib/detail-page-suite-slot-images";
import type {
  DetailPageSuiteModuleState,
  DetailPageSuiteProject,
} from "@/lib/detail-page-suite-types";

export type DetailPageSuiteSlotPromptEditState = {
  moduleId: string;
  slotKey: string;
  prompt: string;
  label: string;
  slotCopy?: string;
  slotCopyAi?: string;
  burnCopyInImage?: boolean;
  baseImageUrl?: string | null;
  copyOverlay?: EcomCopyOverlay | null;
  promptRefUrls?: string[];
};

export function resolveSuiteSlotExportWidthPx(project: DetailPageSuiteProject): number {
  return (
    ensureExportTargets(project.settings, project.brief?.platformCode).find((t) =>
      resolveActiveExportTargetIds(project.settings, project.brief?.platformCode).includes(t.id),
    )?.widthPx ?? resolveDetailPageExportWidthPx(project.brief?.platformCode)
  );
}

export function buildDetailPageSuiteSlotPromptEditState(
  project: DetailPageSuiteProject,
  moduleId: string,
  slotKey: string,
  prompt: string,
  label: string,
  slotCopy?: string,
  slotCopyAi?: string,
  burnCopyInImage?: boolean,
): DetailPageSuiteSlotPromptEditState {
  const mod = project.suite.modules.find((m) => m.module_id === moduleId);
  const slot = mod?.slots.find((s) => s.item_key === slotKey);
  const history = slot ? resolveDetailPageSuiteSlotHistory(slot) : [];
  const activeIdx = slot ? resolveDetailPageSuiteActiveImageIndex(slot) : 0;
  const baseImageUrl = history[activeIdx]?.url?.trim() || null;
  return {
    moduleId,
    slotKey,
    prompt,
    label,
    slotCopy: slotCopy ?? slot?.slot_copy ?? "",
    slotCopyAi: slotCopyAi ?? slot?.slot_copy_ai ?? "",
    burnCopyInImage: burnCopyInImage ?? slot?.burn_copy_in_image,
    baseImageUrl,
    copyOverlay: slot?.copy_overlay ?? null,
    promptRefUrls: slot?.promptRefUrls ?? [],
  };
}

export function patchSuiteModulesSlotPrompt(
  modules: DetailPageSuiteModuleState[],
  edit: Pick<DetailPageSuiteSlotPromptEditState, "moduleId" | "slotKey">,
  prompt: string,
  extras?: DetailPageSuiteSlotPromptSaveExtras,
): DetailPageSuiteModuleState[] {
  return modules.map((m) => {
    if (m.module_id !== edit.moduleId) return m;
    const slotIndex = m.slots.findIndex((s) => s.item_key === edit.slotKey);
    if (slotIndex < 0) return m;
    const slots = [...m.slots];
    const s = slots[slotIndex]!;
    const next = {
      ...s,
      positive_prompt: prompt,
      promptEdited: true,
    };
    if (extras) {
      const copy = extras.slotCopy?.trim();
      slots[slotIndex] = {
        ...next,
        slot_copy: copy || undefined,
        slot_copy_ai: copy ? s.slot_copy_ai ?? copy : s.slot_copy_ai,
        copy_overlay: extras.copyOverlay ?? s.copy_overlay,
        burn_copy_in_image: false,
      };
    } else {
      slots[slotIndex] = next;
    }
    return { ...m, slots };
  });
}

export function resolveSuiteSlotBaseImageUrl(
  project: DetailPageSuiteProject,
  moduleId: string,
  slotKey: string,
): string | null {
  const mod = project.suite.modules.find((m) => m.module_id === moduleId);
  const slot = mod?.slots.find((s) => s.item_key === slotKey);
  if (!slot) return null;
  const history = resolveDetailPageSuiteSlotHistory(slot);
  const activeIdx = resolveDetailPageSuiteActiveImageIndex(slot);
  return history[activeIdx]?.url?.trim() || null;
}

export type { EcomDetailPageRatio };