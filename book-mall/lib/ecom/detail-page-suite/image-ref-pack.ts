import {
  getImageGenMaxRefs,
  orderRefsForModel,
} from "@/lib/ecom/ecom-product-design-ref-rules";

import { detailPageSuiteModuleInvolvesModel } from "./brief-context";
import type { DetailPageSuiteReference } from "./types";

export type DetailPageSuiteImageRefPack = {
  orderedRefs: DetailPageSuiteReference[];
  urls: string[];
  productCount: number;
  modelCount: number;
  styleFirst: boolean;
};

export function detailPageSuiteReferencesForImageGen(
  references: DetailPageSuiteReference[],
): DetailPageSuiteReference[] {
  return references.filter(
    (r) => (r.role === "product" || r.role === "model") && r.ossUrl?.trim(),
  );
}

/** 出图参考图顺序与「模特服装图」一致：有模特时模特在前、商品在后，并截断至模型上限 */
export function resolveDetailPageSuiteImageRefPack(
  references: DetailPageSuiteReference[],
  modelKey: string,
): DetailPageSuiteImageRefPack {
  const product = references.filter((r) => r.role === "product" && r.ossUrl?.trim());
  const models = references.filter((r) => r.role === "model" && r.ossUrl?.trim());
  const packed = orderRefsForModel(
    product,
    models,
    getImageGenMaxRefs(modelKey),
  );
  const orderedRefs = packed.ordered;
  return {
    orderedRefs,
    urls: orderedRefs.map((r) => r.ossUrl.trim()),
    productCount: packed.productCount,
    modelCount: packed.styleCount,
    styleFirst: packed.styleFirst,
  };
}

/**
 * 参考图图例：说明第几张是商品 / 模特，避免模型把 Prompt 里的泛化「女性模特」当成文生图。
 */
export function appendDetailPageSuiteImageRefLegend(
  prompt: string,
  pack: DetailPageSuiteImageRefPack,
  involvesModel: boolean,
): string {
  if (pack.orderedRefs.length === 0) return prompt.trim();

  const lines: string[] = [];
  let fig = 0;
  let productIdx = 0;
  let modelIdx = 0;

  for (const r of pack.orderedRefs) {
    fig += 1;
    const label = r.label?.trim() || (r.role === "product" ? "商品实拍" : "模特参考");
    if (r.role === "product") {
      productIdx += 1;
      lines.push(
        `- 参考图${fig}（@产品实拍${productIdx}）：${label}，须作为画面中的商品本体`,
      );
    } else {
      modelIdx += 1;
      lines.push(
        `- 参考图${fig}（@模特${modelIdx}）：${label}，须严格沿用该图人物的五官、发型、身材比例与气质`,
      );
    }
  }

  const rules: string[] = [];
  if (productIdx > 0) {
    rules.push(
      "- 服装款式、颜色、材质与结构细节须与 @产品实拍 完全一致，不得替换成其它款式",
    );
  }
  if (involvesModel && modelIdx > 0) {
    rules.push(
      "- 本图若出现人物，必须是 @模特1（与参考图同一人），禁止换成其他人脸或随机 AI 模特",
      "- 忽略上文与本说明冲突的泛化模特描述，以参考图人物为准",
    );
  }

  return [
    prompt.trim(),
    "",
    "参考图说明（硬性要求，优先级高于上文；可用 @产品实拍N / @模特N 或 @参考图N）：",
    ...lines,
    ...rules,
  ]
    .filter(Boolean)
    .join("\n");
}

export function detailPageSuiteSlotInvolvesModel(opts: {
  moduleId: string;
  moduleName: string;
  itemLabel: string;
}): boolean {
  return detailPageSuiteModuleInvolvesModel({
    moduleId: opts.moduleId,
    moduleName: opts.moduleName,
    selectedLabels: [opts.itemLabel],
  });
}
