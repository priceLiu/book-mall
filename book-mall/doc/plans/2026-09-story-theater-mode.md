# 需求开发计划：故事剧场模式（Story Theater）

- **创建日期**：2026-09-07
- **负责人**：电商工具箱
- **关联提示词库**：
  - `docs/故事版服装提示词 库.md`
  - `docs/故事版包包提示词 库.md`
  - `docs/故事版3C数码提示词 库.md`

## 背景与目标

故事版 / 专业版助手新增 **故事剧场线**（`productionMode: story_theater`），与标准分镜脚本线并行。用户先选故事主题，再选 T1–T5 故事版类型，LLM 产出五版剧情分镜 JSON，供后续出图/出视频。

## 核心概念

| 概念 | 说明 |
|---|---|
| **productionMode** | `standard_script`（默认）或 `story_theater` |
| **vertical** | `fashion_apparel` / `bags` / `digital_3c` |
| **故事主题** | 平台选题库条目：title、storyCore、storyType、tags |
| **T1–T5** | 五类故事版：痛点治愈 / 场景适配 / 前后反差 / 经验避坑 / 情绪共鸣 |

## Phase 1 · 数据与后台（进行中）

- [x] Prisma `EcomStoryTheaterTopic` + migration
- [x] `ecom-story-theater-topic-service` + Admin/SSO API
- [x] 种子数据（三垂类各 10 条）+ seed 脚本
- [x] 管理后台「故事主题库」Tab（`/admin/templates?tab=ecom&ecom=story-topics`）
- [ ] SSO 选题 sample API 接入助手 choice chips

## Phase 2 · 助手工作流

- [x] `story-theater-types` / `story-theater-workflow` 共享类型
- [x] `ecom-story-theater-prompts` 系统提示词（三垂类）
- [x] Fashion / Pro deliverable 扩展 `productionMode`、`storyTheaterVersions`
- [ ] 助手 UI：产出模式切换 → 主题选择 → T 版选择 → 生成
- [ ] 中栏展示 T1–T5 卡片与 panels

## Phase 3 · 验收

- [ ] 三垂类各至少 1 条主题可走完完整流程
- [ ] Admin CRUD 与 seed 幂等
- [ ] 单元测试：phase 路由、choice 解析、prompt 组装

## 相关代码

| 层 | 路径 |
|---|---|
| 类型 | `book-mall/lib/ecom/story-theater-types.ts` |
| 选题 service | `book-mall/lib/ecom/ecom-story-theater-topic-service.ts` |
| 提示词 | `book-mall/lib/ecom/ecom-story-theater-prompts.ts` |
| Fashion deliverable | `book-mall/lib/ecom/ecom-fashion-deliverable.ts` |
| Pro deliverable | `book-mall/lib/ecom/ecom-pro-deliverable.ts` |
| Toolkit workflow | `e-commerce-toolkit/lib/story-theater-workflow.ts` |
| Admin UI | `book-mall/components/admin/template-admin/admin-ecom-catalog-libraries.tsx` |
