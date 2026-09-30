import type { ProductImageSetSlot, ProductImageSetSlotKind } from "@/lib/product-image-set-types";

export const PRODUCT_IMAGE_SET_SLOT_SECTIONS: {
  kind: ProductImageSetSlotKind;
  label: string;
  hint?: string;
}[] = [
  { kind: "white_bg", label: "白底图" },
  { kind: "sellpoint", label: "卖点图" },
  { kind: "scene", label: "场景 / 模特场景" },
  { kind: "other", label: "细节 / 辅助图" },
];

export function groupProductImageSetSlotsByStructure(slots: ProductImageSetSlot[]) {
  return PRODUCT_IMAGE_SET_SLOT_SECTIONS.map(({ kind, label }) => ({
    kind,
    label,
    slots: slots.filter((s) => s.kind === kind),
  })).filter((g) => g.slots.length > 0);
}
