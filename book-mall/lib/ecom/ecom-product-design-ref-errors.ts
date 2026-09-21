import type { ProductDesignReference } from "@/lib/ecom/ecom-product-design-types";

const ROLE_LABEL: Record<ProductDesignReference["role"], string> = {
  product: "产品实拍",
  "main-style": "主图风格参考",
  "detail-style": "详情页风格参考",
  model: "模特参考",
  scene: "场景参考",
  other: "参考图",
};

/** 把厂商返回的参考图 URL 映射到本项目条目，便于用户知道是哪张图有问题 */
export function enrichProductDesignRefImageError(
  references: ProductDesignReference[],
  rawMessage: string,
): string {
  const urlMatch = rawMessage.match(/https?:\/\/[^\s]+/);
  if (!urlMatch) return rawMessage;
  const url = urlMatch[0]!.replace(/[),.]+$/, "");
  const ref = references.find(
    (r) => r.ossUrl === url || url.includes(r.ossUrl) || r.ossUrl.includes(url),
  );
  if (/ratio \(H\/W/i.test(rawMessage) || /must be between 0\.12 and 8/i.test(rawMessage)) {
    return `${rawMessage}\n\n说明：详情页风格长图宽高比超出 Wan 2.7 垫图上限（高/宽须在 0.12～8）。系统会在出图前自动留白扩宽；若仍失败请重新上传该参考或换较短长图。`;
  }
  if (!ref) {
    return `${rawMessage}\n\n（未能匹配到项目参考列表，可能是主图基准或临时规范化图；请检查详情页风格参考/产品实拍/模特图。）`;
  }
  const role = ROLE_LABEL[ref.role] ?? ref.role;
  return `${rawMessage}\n\n对应本项目参考：【${role}】${ref.label || ref.id}`;
}
