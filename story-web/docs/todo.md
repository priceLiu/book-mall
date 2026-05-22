# story-web 实施清单

> 由 [`plan.md`](./plan.md) 拆解。

**勾选说明（Markdown 任务列表）：**

- `[x]` = **已完成**
- `[ ]` = **未完成**（待做）

## 一期（已完成）

- [x] 工程脚手架、落地页、tool-web 漫剧剧场、部署文档
- [x] `ToolNavVisibility` 追加 `story-theater`

## 二期（已完成）

- [x] Prisma：`StoryEngineModel` / `StorySpace` / `StorySpaceModelSelection`
- [x] 种子模型：Gemini 2.5、Nano Banana Pro、万相、Veo 2、可灵等
- [x] book-mall API：`/api/story/*` + CORS（`STORY_WEB_ORIGINS`）
- [x] story-web：登录态、个人空间、模型配置页、发布到主站、 `/space/[slug]`
- [x] book-mall 产品详情：漫剧代表作视频播放
- [x] `pnpm db:deploy` 已执行（含 `20260703120000`、`20260704120000`）

## 三期（待做）

- [ ] 首页多模板
- [ ] 创作室 / 影像室 AI 流水线 + OSS
- [ ] 与 tool-web 计费对齐

## 上线前（运维）

- [ ] 云托管：`story-web` 服务 + `story.ai-code8.com`
- [ ] book-mall 控制台：`STORY_WEB_ORIGINS` / `NEXT_PUBLIC_STORY_WEB_ORIGIN`
- [ ] tool-web：`NEXT_PUBLIC_STORY_WEB_ORIGIN`
