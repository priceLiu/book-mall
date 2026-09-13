import { resolveModuleDisplaySlots } from "@/lib/detail-page-suite-module-slots";
import type {
  DetailPageSuiteModuleState,
  DetailPageSuiteState,
} from "@/lib/detail-page-suite-types";

export const DETAIL_PAGE_SUITE_GLOBAL_MAX = 44;

/** 从提示词首行截取卡片标题 */
export function labelFromSuiteCustomPrompt(prompt: string, maxLen = 36): string {
  const line = prompt.split("\n").map((s) => s.trim()).find(Boolean) ?? prompt.trim();
  if (!line) return "自定义点位";
  if (line.length <= maxLen) return line;
  return `${line.slice(0, maxLen - 1)}…`;
}

function ensureUniqueItemLabel(label: string, existing: string[]): string {
  if (!existing.includes(label)) return label;
  let n = 2;
  while (existing.includes(`${label} (${n})`)) n += 1;
  return `${label} (${n})`;
}

export function suiteEnabledSlotTotal(suite: DetailPageSuiteState): number {
  return suite.modules
    .filter((m) => m.enable)
    .reduce((n, m) => n + Math.max(0, m.generate_count), 0);
}

/** 是否还能在本模块追加 1 个点位格 */
export function canAddCustomSuiteSlot(
  suite: DetailPageSuiteState,
  moduleId: string,
): { ok: true } | { ok: false; reason: string } {
  const mod = suite.modules.find((m) => m.module_id === moduleId);
  if (!mod) return { ok: false, reason: "模块不存在" };
  if (!mod.enable) return { ok: false, reason: "请先开启本模块" };
  const displayCount = mod.enable ? resolveModuleDisplaySlots(mod).length : 0;
  if (mod.generate_count >= mod.max_num) {
    if (mod.max_num <= 1) {
      return {
        ok: false,
        reason: `本模块模板上限 ${mod.max_num} 张（当前 N ${mod.generate_count}/${mod.max_num}），无法继续新增`,
      };
    }
    return {
      ok: false,
      reason: `本模块 N 已满（${mod.generate_count}/${mod.max_num}）。请先在上方把 N 调大后再点 +`,
    };
  }
  if (displayCount >= mod.max_num) {
    return {
      ok: false,
      reason: `本模块已有 ${displayCount} 个点位，已达上限 ${mod.max_num} 张`,
    };
  }
  if (suiteEnabledSlotTotal(suite) >= DETAIL_PAGE_SUITE_GLOBAL_MAX) {
    return { ok: false, reason: `全部开启模块合计不能超过 ${DETAIL_PAGE_SUITE_GLOBAL_MAX} 张` };
  }
  return { ok: true };
}

/** 手填提示词新增 1 个点位格（同步 selected_item_list / generate_count / slots） */
export function addCustomPromptSlotToModule(
  mod: DetailPageSuiteModuleState,
  prompt: string,
): DetailPageSuiteModuleState {
  const trimmed = prompt.trim();
  if (trimmed.length < 8) {
    throw new Error("提示词至少 8 个字符");
  }

  const item_label = ensureUniqueItemLabel(
    labelFromSuiteCustomPrompt(trimmed),
    mod.selected_item_list,
  );
  const item_key = `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const existingSlots = resolveModuleDisplaySlots(mod);
  const newSlot = {
    item_key,
    item_label,
    source: "user" as const,
    positive_prompt: trimmed,
    promptEdited: true,
    selectedForImage: true,
  };

  const candidate_pool = mod.candidate_pool.includes(item_label)
    ? mod.candidate_pool
    : [...mod.candidate_pool, item_label];

  return {
    ...mod,
    generate_count: mod.generate_count + 1,
    selected_item_list: [...mod.selected_item_list, item_label],
    candidate_pool,
    slots: [...existingSlots, newSlot],
  };
}
