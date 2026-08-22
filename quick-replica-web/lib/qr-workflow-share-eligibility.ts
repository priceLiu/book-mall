import type { QrTemplate } from "@/lib/qr-template-types";

/** 普通用户仅「我的作品」；管理员可分享任意可见模板（含内置/运营库） */
export function canShareQrTemplate(
  template: QrTemplate,
  canManageFeatured: boolean,
): boolean {
  if (canManageFeatured) return true;
  return template.source === "user";
}
