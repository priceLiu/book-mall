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
