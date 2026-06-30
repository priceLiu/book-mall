/** Gateway `CanvasProviderModelDto.role` · 与 book-mall Gateway 登记一致 */
export type GatewayModelRole = "LLM" | "IMAGE" | "VIDEO";

export const GATEWAY_MODEL_ROLE_ORDER: GatewayModelRole[] = [
  "LLM",
  "IMAGE",
  "VIDEO",
];

export type GatewayModelRoleMeta = {
  /** Gateway 字段值 */
  gatewayRole: GatewayModelRole;
  /** Dock / 弹层分组标题（英文，与 Gateway 对齐） */
  sectionLabelEn: string;
  /** 用户可见中文副标题 */
  sectionLabelZh: string;
  /** 未选中时的占位文案 */
  pickerPlaceholder: string;
  /** 弹层标题 */
  modalTitle: string;
};

export const GATEWAY_MODEL_ROLE_META: Record<
  GatewayModelRole,
  GatewayModelRoleMeta
> = {
  LLM: {
    gatewayRole: "LLM",
    sectionLabelEn: "Text model",
    sectionLabelZh: "文本模型",
    pickerPlaceholder: "Select text model",
    modalTitle: "Select text model",
  },
  IMAGE: {
    gatewayRole: "IMAGE",
    sectionLabelEn: "Image model",
    sectionLabelZh: "图片模型",
    pickerPlaceholder: "Select image model",
    modalTitle: "Select image model",
  },
  VIDEO: {
    gatewayRole: "VIDEO",
    sectionLabelEn: "Video model",
    sectionLabelZh: "视频模型",
    pickerPlaceholder: "Select video model",
    modalTitle: "Select video model",
  },
};

export function gatewayModelRoleMeta(
  role: GatewayModelRole,
): GatewayModelRoleMeta {
  return GATEWAY_MODEL_ROLE_META[role];
}

/** Dock 分组标题：英文主行 + 中文副行 */
export function gatewayModelRoleSectionTitle(role: GatewayModelRole): string {
  const m = GATEWAY_MODEL_ROLE_META[role];
  return `${m.sectionLabelEn} · ${m.sectionLabelZh}`;
}

/**
 * 节点模型选择器中隐藏 "KIE" 厂商名（产品要求：不向用户暴露 KIE 这个上游厂商）。
 * 覆盖 "(KIE)" / "(KIE · 图生视频)" / "Gateway · KIE" / "KIE · xxx" / 残留独立 KIE。
 */
export function hideKieVendorLabel(
  text: string | null | undefined,
): string {
  if (!text) return "";
  let s = text;
  s = s.replace(/\(\s*KIE\s*·\s*/gi, "(");
  s = s.replace(/\s*\(\s*KIE\s*\)\s*/gi, " ");
  s = s.replace(/\s*·\s*KIE\b/gi, "");
  s = s.replace(/\bKIE\s*·\s*/gi, "");
  s = s.replace(/\bKIE\b/gi, "");
  return s
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+·\s*$/g, "")
    .trim();
}

/** 全节点模型选择弹层背景（统一 #2E2E2E） */
export const ENGINE_PICKER_MODAL_BG = "#2E2E2E";

/** 模型卡片选中边框 · 浅灰，非高对比白 */
export const ENGINE_PICKER_SELECTED_BORDER = "rgba(255,255,255,0.28)";
export const ENGINE_PICKER_UNSELECTED_BORDER = "rgba(255,255,255,0.10)";
