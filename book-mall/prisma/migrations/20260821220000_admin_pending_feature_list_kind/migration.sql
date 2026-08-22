-- 待做功能 / 待处理 分类（新增时可显式选择）
CREATE TYPE "AdminPendingFeatureListKind" AS ENUM ('FEATURE', 'PENDING');

ALTER TABLE "AdminPendingFeature"
  ADD COLUMN "listKind" "AdminPendingFeatureListKind" NOT NULL DEFAULT 'PENDING';

-- 既有路线图标题 → 待做功能
UPDATE "AdminPendingFeature"
SET "listKind" = 'FEATURE'
WHERE "title" IN (
  '运营中心',
  '小红书标签',
  '标题热词',
  '文章热词',
  '爆款视频拆解',
  '拉片',
  '姿势 skill',
  '提示词库',
  '一键发布',
  '数字人',
  '自动剪辑',
  'ep',
  'image out painting',
  'wen',
  'wan 图像局部',
  'wan 2.0 i2i preview',
  'platform-apps-catalog',
  'v2.5',
  'Gateway 统一注册登录',
  '域名静态化管理'
);

CREATE INDEX IF NOT EXISTS "AdminPendingFeature_listKind_completed_sortOrder_idx"
  ON "AdminPendingFeature"("listKind", "completed", "sortOrder");
