import {
  HIT_REPEATABLE_TYPES,
  maxRepeatForHitType,
  type HitComponent,
  type HitComponentType,
  type HitTemplate,
} from "@/lib/detail-page-suite-hit-types";

/** 与 book-mall hit-schemas 规范化对齐，供 UI 编辑即时约束 */
export function sanitizeHitComponent(comp: HitComponent): HitComponent {
  const type = comp.type;
  const editable = HIT_REPEATABLE_TYPES.has(type);
  const repeat_count = editable
    ? Math.min(maxRepeatForHitType(type), Math.max(1, comp.repeat_count))
    : 1;
  return {
    ...comp,
    repeat_count,
    user_editable_count: editable,
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
    repeat_count: HIT_REPEATABLE_TYPES.has(nextType) ? comp.repeat_count : 1,
  });
}
