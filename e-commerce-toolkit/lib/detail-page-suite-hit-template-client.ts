import {
  HIT_REPEAT_COUNT_MAX,
  maxRepeatForHitType,
  type HitComponent,
  type HitComponentType,
  type HitTemplate,
} from "@/lib/detail-page-suite-hit-types";

function clampRepeatCount(n: number): number {
  return Math.min(HIT_REPEAT_COUNT_MAX, Math.max(1, Math.round(n)));
}

/** 与 book-mall hit-schemas 对齐：仅 clamp 1～99，不按类型截断 */
export function sanitizeHitComponent(comp: HitComponent): HitComponent {
  return {
    ...comp,
    repeat_count: clampRepeatCount(comp.repeat_count),
    user_editable_count: comp.user_editable_count ?? true,
  };
}

export function sanitizeHitTemplateDraft(template: HitTemplate): HitTemplate {
  return {
    ...template,
    canvas_width: 750,
    component_list: template.component_list.map(sanitizeHitComponent),
  };
}

export function onHitComponentTypeChange(
  comp: HitComponent,
  nextType: HitComponentType,
): HitComponent {
  return sanitizeHitComponent({
    ...comp,
    type: nextType,
  });
}

export { maxRepeatForHitType, HIT_REPEAT_COUNT_MAX };
