# 全站预置风格库（ecom-style-preset）

Single Writer：`book-mall/lib/ecom/ecom-style-preset/`。

- **kind**：`sellpoint_layout`（卖点图版式）· `trending_visual`（爆款风格卡片）
- **vertical**：`fashion_apparel` | `bags` | `digital_3c` | `generic`（与 Pro/故事版垂直对齐）
- **API**：`GET /api/sso/tools/ecom/style-presets?kind=&vertical=&seed=&suggest=1`
- **卖点版式数据**：表 `EcomStylePresetEntry`（迁移种子 20 条版式名 + layoutPrompt）；缩略图 OSS 路径 `ecom/style-presets/{id}-thumb.webp`
- **缩略图 URL**：DB `thumbUrl` 优先；否则 HEAD 检测 `ecom/style-presets/{id}-thumb.webp` 等 canonical key 是否存在再返回公网 URL（**仅有 OSS 环境变量、未上传对象时不会拼假 URL**）
- **首次灌图**：`cd book-mall && pnpm ecom:seed-style-preset-posters`（Meitu 参考 → OSS + 回写 DB）
- **运营后台**：Book → 模板管理 → 电商 → **卖点版式库**（`/admin/templates?tab=ecom&ecom=style-presets`）；`PATCH /api/admin/ecom/style-presets/[id]` · `POST .../upload`

业务项目内只存 **`stylePresetId` 列表**；生成时 `resolveStylePresets(ids)` 取 prompt 片段。故事版后续接入同一 catalog，禁止各模块硬编码风格名。
