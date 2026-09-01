# 专业拉片 V2 · 制作成片 · 实施跟踪

- **创建日期**：2026-09-01
- **产品文档**：`doc/拉片/requirements.md`
- **技术方案**：`doc/拉片/solution.md`
- **状态**：`todo` | `doing` | `done` | `blocked` | `待处理`

| ID | Phase | 任务 | 状态 | 依赖 | 验收 |
|----|-------|------|------|------|------|
| FP-101 | P0 | 前后端 `FilmPullProductionShot` / `FilmPullRefMatch` 类型 | 待处理 | — | types 编译通过 |
| FP-102 | P0 | service 读写 `productionPlan` / `refMatch` | 待处理 | FP-101 | PATCH 单镜 |
| FP-103 | P0 | 移除 film-pull → seed-video replica 接入 | 待处理 | FP-101 | workspace 无 MediaDecomposeReplicaPanel |
| FP-104 | P1 | `ecom-film-pull-ref-match` 规则自动匹配 | 待处理 | FP-102 | auto API |
| FP-105 | P1 | ref-match API（auto/patch/confirm） | 待处理 | FP-104 | 路由 200 |
| FP-106 | P1 | `FilmPullRefMatchPanel` UI | 待处理 | FP-105 | 可改每镜 ref + 确认 |
| FP-107 | P1 | 素材采集去掉 seed 脚本生成 | 待处理 | FP-103 | 仅上传+识产品 |
| FP-108 | P2 | `ecom-film-pull-production-assemble` 规则拼装 | 待处理 | FP-105 | assemble API |
| FP-109 | P2 | production API（assemble/patch/confirm） | 待处理 | FP-108 | 路由 200 |
| FP-110 | P2 | `FilmPullProductionScriptPanel` 可编辑表 | 待处理 | FP-109 | 确认脚本 |
| FP-111 | P3 | `FilmPullProductionPanel` 制作成片 | 待处理 | FP-110 | 标题「制作成片」 |
| FP-112 | P3 | 单镜/批量生图 API | 待处理 | FP-111 | image/generate |
| FP-113 | P3 | 单镜生视频（每镜 ref + I2V 优先） | 待处理 | FP-111 | 沿用 video API 扩展 |
| FP-114 | P3 | 批量生视频 + BackgroundGen 轮询 | 待处理 | FP-113 | 与 analyze job 一致 |
| FP-115 | P3 | 合成成片 + 预览 | 待处理 | FP-113 | video/render |
| FP-116 | P4 | workspace 阶段门控 ref→script→production | 待处理 | FP-106,110,111 | 顺序正确 |
| FP-117 | P4 | studio 去 seedVideo + 底栏文案 | 待处理 | FP-116 | 底栏阶段提示 |
| FP-118 | P5 | Mock 链路 + 导出含 productionPlan | 待处理 | FP-115 | dev Mock 全流程 |

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-09-01 | V2 制作成片 backlog 初版 |
