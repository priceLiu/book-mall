import type { HitComponentType, HitLayout } from "./hit-schemas";

/** 尺码等系统模块不参与爆款 LLM 文案重写 */
export function isHitSuiteModuleExcludedFromCopyRewrite(moduleId: string): boolean {
  return moduleId === "mod7_size_table";
}

/** 该范式卡位是否必须返回 slot_copy（批量/单条校验） */
export function hitSlotCopyRequired(comp: {
  type: HitComponentType;
  layout: HitLayout;
}): boolean {
  switch (comp.type) {
    case "full_banner":
    case "feature_card":
    case "spec_table":
    case "contrast":
    case "after_sale":
      return true;
    case "other":
      return comp.layout !== "full_image";
    case "main_product":
    case "detail_closeup":
    case "scene_image":
      return (
        comp.layout === "text_only" ||
        comp.layout === "image_text_top_bottom" ||
        comp.layout === "image_text_left_right"
      );
    default:
      return false;
  }
}
