/** 产品路线图 · 待做功能 tab 固定清单（与 seed 一致） */
export const ADMIN_PENDING_FEATURE_ROADMAP_TITLES = [
  "运营中心",
  "小红书标签",
  "标题热词",
  "文章热词",
  "爆款视频拆解",
  "拉片",
  "姿势 skill",
  "提示词库",
  "一键发布",
  "数字人",
  "自动剪辑",
  "ep",
  "image out painting",
  "wen",
  "wan 图像局部",
  "wan 2.0 i2i preview",
  "platform-apps-catalog",
  "v2.5",
  "Gateway 统一注册登录",
  "域名静态化管理",
] as const;

export type AdminPendingFeatureRoadmapTitle =
  (typeof ADMIN_PENDING_FEATURE_ROADMAP_TITLES)[number];

export function isAdminPendingFeatureRoadmapTitle(title: string): boolean {
  const t = title.trim();
  return (ADMIN_PENDING_FEATURE_ROADMAP_TITLES as readonly string[]).includes(t);
}
