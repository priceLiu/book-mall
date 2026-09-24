import type { EcomPromptImageRef } from "@/lib/ecom-prompt-mention";

export const BACKGROUND_REPLACE_SUBJECT_MENTION = "@图1框选";
export const BACKGROUND_REPLACE_REF_MENTION = "@图2框选";

/** 官方跨图编辑示例：框选主体写入编辑指令，提交时展开成 `<bbox>`。 */
export const BACKGROUND_REPLACE_DUAL_BBOX_EXAMPLE =
  "将 @图1框选 的主体放到 @图2框选 位置";

export const BACKGROUND_REPLACE_SUBJECT_BBOX_EXAMPLE =
  "将 @图1框选 区域换成咖啡馆暖光";

export function buildBackgroundReplaceMentionRefs(opts: {
  subjectImageUrl?: string;
  subjectBbox?: [number, number, number, number] | null;
  refImageUrl?: string;
  refBbox?: [number, number, number, number] | null;
}): EcomPromptImageRef[] {
  const refs: EcomPromptImageRef[] = [];
  const subjectUrl = opts.subjectImageUrl?.trim() ?? "";
  const refUrl = opts.refImageUrl?.trim() ?? "";
  if (opts.subjectBbox && subjectUrl) {
    refs.push({
      url: subjectUrl,
      index: 1,
      token: BACKGROUND_REPLACE_SUBJECT_MENTION,
      label: "图1框选",
      role: "subject-bbox",
      cropBbox: opts.subjectBbox,
    });
  }
  if (opts.refBbox && refUrl) {
    refs.push({
      url: refUrl,
      index: 2,
      token: BACKGROUND_REPLACE_REF_MENTION,
      label: "图2框选",
      role: "ref-bbox",
      cropBbox: opts.refBbox,
    });
  }
  return refs;
}
