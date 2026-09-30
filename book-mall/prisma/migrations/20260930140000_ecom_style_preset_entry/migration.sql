-- CreateTable
CREATE TABLE "EcomStylePresetEntry" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "verticals" JSONB NOT NULL DEFAULT '[]',
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "layoutPrompt" TEXT,
    "visualPrompt" TEXT,
    "palette" JSONB,
    "thumbUrl" TEXT,
    "referenceUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcomStylePresetEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EcomStylePresetEntry_kind_enabled_deletedAt_idx" ON "EcomStylePresetEntry"("kind", "enabled", "deletedAt");
CREATE INDEX "EcomStylePresetEntry_sortOrder_idx" ON "EcomStylePresetEntry"("sortOrder");

-- 卖点图版式 · 初始 20 条（缩略图由运营后台上传 OSS）
INSERT INTO "EcomStylePresetEntry" ("id", "kind", "verticals", "title", "layoutPrompt", "sortOrder", "enabled", "updatedAt") VALUES
('sp-single-frame', 'sellpoint_layout', '[]', '单幅', '电商卖点图：单幅构图，产品为主体，1～2 行短标题，背景简洁留白，禁止长段落。', 0, true, CURRENT_TIMESTAMP),
('sp-full-bleed', 'sellpoint_layout', '[]', '满幅特写', '电商卖点图：产品占画面 70% 以上，背景简洁留白，主标题 1～2 行居中或偏上，禁止长段落。', 1, true, CURRENT_TIMESTAMP),
('sp-detail-magnifier', 'sellpoint_layout', '[]', '细节放大窗', '产品主视觉+圆形或圆角放大窗展示细节纹理，角标一句材质/工艺卖点。', 2, true, CURRENT_TIMESTAMP),
('sp-bottom-banner', 'sellpoint_layout', '[]', '底部通栏', '上方产品主图，下方通栏色块承载 3～4 个短卖点，通栏与产品不重叠。', 3, true, CURRENT_TIMESTAMP),
('sp-split-vertical', 'sellpoint_layout', '[]', '上下分幅', '上下分幅：上幅产品或场景，下幅纯色底+短标题与要点列表，现代电商详情风。', 4, true, CURRENT_TIMESTAMP),
('sp-sidebar-tags', 'sellpoint_layout', '[]', '侧栏标签栏', '左侧或右侧竖条标签区 3～5 个短标签，产品主体占对侧 60%，标签与产品不重叠。', 5, true, CURRENT_TIMESTAMP),
('sp-scene-icons', 'sellpoint_layout', '[]', '主画面加实景图标', '主画面产品/场景实拍，角落或边缘 2～4 个实景小图标+四字以内说明。', 6, true, CURRENT_TIMESTAMP),
('sp-card-orbit', 'sellpoint_layout', '[]', '卡片环绕', '中心产品，四周 3～5 张环绕小卡片展示功能点，卡片统一圆角与间距。', 7, true, CURRENT_TIMESTAMP),
('sp-grid-array', 'sellpoint_layout', '[]', '网格阵列', '2×2 或 3×3 网格，每格一图一短句，整体对齐，适合多功能并列展示。', 8, true, CURRENT_TIMESTAMP),
('sp-arch-card', 'sellpoint_layout', '[]', '拱形卡片', '拱形或胶囊形卡片承载文案，产品穿插或置于拱形开口内，柔和电商风。', 9, true, CURRENT_TIMESTAMP),
('sp-solid-zones', 'sellpoint_layout', '[]', '实线分区', '实线或细线矩形分区，每区一卖点短句+小图/图标，结构清晰。', 10, true, CURRENT_TIMESTAMP),
('sp-floating-stats', 'sellpoint_layout', '[]', '悬浮数据卡', '场景或产品底图，2～3 张悬浮数据/参数卡片，数字突出、说明极简。', 11, true, CURRENT_TIMESTAMP),
('sp-triple-float', 'sellpoint_layout', '[]', '三行悬浮窗', '三行横向悬浮信息条，每行图标+短句，产品占主区域。', 12, true, CURRENT_TIMESTAMP),
('sp-asymmetric-trio', 'sellpoint_layout', '[]', '不规则三宫格', '不规则三宫格拼图，一大两小，每格对应一个卖点，留白呼吸感。', 13, true, CURRENT_TIMESTAMP),
('sp-cycle-icons', 'sellpoint_layout', '[]', '循环图标', '环形或流程箭头连接 3～4 个步骤/卖点图标，中心或侧边产品主视觉。', 14, true, CURRENT_TIMESTAMP),
('sp-multi-variant-float', 'sellpoint_layout', '[]', '主画面多款式加色块悬浮', '主画面展示多款式/多色产品，色块悬浮条标注色号或系列名。', 15, true, CURRENT_TIMESTAMP),
('sp-left-bottom-icons', 'sellpoint_layout', '[]', '左图标加下图标', '左侧竖排图标卖点，底部横排补充图标，中间产品主图。', 16, true, CURRENT_TIMESTAMP),
('sp-scene-color-bar', 'sellpoint_layout', '[]', '主场景加色块条', '真实使用场景主图，一侧或底部色块条承载标题与 2～3 要点。', 17, true, CURRENT_TIMESTAMP),
('sp-quad-card', 'sellpoint_layout', '[]', '四边形卡片', '斜切或平行四边形卡片排列，动感电商风，每卡一短卖点。', 18, true, CURRENT_TIMESTAMP),
('sp-line-window-scene', 'sellpoint_layout', '[]', '线条窗加实景', '线框窗格划分版面，部分窗格嵌入实景小图，其余为文案与产品。', 19, true, CURRENT_TIMESTAMP);
