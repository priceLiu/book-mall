# story-web 产品与技术计划

> 漫剧创作个人空间 · 独立 Next 应用 · 与 book-mall / tool-web 互通  
> 生产域名：**https://story.ai-code8.com**

---

## 1. 背景与定位

`story-web` 是面向**漫剧（漫画剧 / 短剧）创作**的独立 Web 应用。每位用户拥有**个人空间**，空间内包含可对外展示的首页与若干创作工具页。

与现有工程关系：

| 工程 | 角色 |
|------|------|
| **book-mall** | 主站；未来承接「空间首页」的对外发布与作品播放 |
| **tool-web** | 工具站；提供「漫剧剧场」入口，链到 story-web |
| **story-web** | 漫剧个人空间与创作工作台（本工程） |

**说明：** 此前提到的「book-mall 迁移」仅指在 book-mall 数据库中**追加一条**工具站侧栏可见性记录（`ToolNavVisibility`），与现有表结构兼容、**不改动**主站已有业务逻辑。生产环境执行 `prisma migrate deploy` 即可，风险与新增「视觉实验室」菜单相同。

---

## 2. 用户空间模型（概念）

```
用户空间 (StorySpace)
├── 首页 (Home)           ← 当前阶段：固定模板落地页；未来支持多模板
│   └── 作品区             ← 可嵌入可播放的代表作（视频/漫剧片段）
├── 创作室 (Studio)       ← 剧本 / 分镜 / 生成流程（后续迭代）
├── 影像室 (Media)        ← 素材与成片管理（后续迭代）
└── 模型配置 (Models)     ← AI 引擎模型与参数（后续迭代）
```

**一期（本迭代）：**

- 实现**演示空间**（`/`，固定模板首页）。
- 「创作室 / 影像室 / 模型配置」为**占位页**，说明后续能力。
- 首页 UI 参考 [Twenty 官网](https://twenty.com)：大 Hero、产品演示区、特性网格、FAQ、底部 CTA。
- 首页作品区预留**视频播放位**（占位或示例 mp4），为将来「发布到主站后直接播放」做准备。

**二期（本迭代，已落地）：**

- 用户登录（book-mall 同账号 Cookie + `/api/story/viewer-session`）。
- 每用户自动创建空间；对外 slug：`/space/{slug}`。
- 首页仍为 **CLASSIC_V1** 固定模板（多模板后台待三期）。
- **发布到 book-mall**：空间首页 → `Product`（代表作视频在产品页播放）。
- **模型配置**：平台种子模型 + 用户启用/主模型选择（Gemini、Nano Banana、万相、Veo、可灵等）。

**三期及以后：**

- 首页多模板切换。
- 创作室 / 影像室接 AI 生成与 OSS。

---

## 3. tool-web「漫剧剧场」菜单

与「视觉实验室」对齐的分组结构：

| 子菜单 | 路由 | 说明 |
|--------|------|------|
| 首页 | `/story-theater` | 漫剧故事剧场叙事与导航 |
| 创作幻想家 | `/story-theater/creator` | 大视频 + 外链进入 story-web |
| 我的剧场 | `/story-theater/library` | 已保存漫剧（一期 localStorage） |
| 实现逻辑 | `/story-theater/implementation` | 架构与迭代说明 |

外链环境变量：`NEXT_PUBLIC_STORY_WEB_ORIGIN`（本地 `http://localhost:3003`，生产 `https://story.ai-code8.com`）。

---

## 4. 部署

与 `finance-web` 相同模式：

| 控制台项 | 值 |
|----------|-----|
| Git 仓库 | `priceLiu/book-mall`（Monorepo 根仓库） |
| 目标目录 | `story-web` |
| 端口 | **3003** |
| 域名 | **story.ai-code8.com** |

环境变量模板：`deploy/tencent/story-web.env.example`。

---

## 5. 技术栈

- Next.js 14（App Router）、TypeScript、Tailwind CSS
- `output: "standalone"` + Dockerfile（Node 22）
- 端口 **3003**

---

## 6. 验收标准（一期）

- [x] `cd story-web && pnpm dev` 可访问落地页与三个占位页
- [x] tool-web 侧栏出现「漫剧剧场」四项子菜单（代码已注册；生产需 migrate）
- [x] 「创作幻想家」可打开 story-web（新标签）
- [x] `docs/plan.md`、`docs/todo.md` 与实现一致
- [x] 部署文档含第四服务说明

---

## 7. 不在一期范围（已移入二期或三期）

- ~~book-mall 作品发布 API / 播放页~~ → **二期已完成**
- ~~用户 SSO 与多租户空间路由~~ → **二期已完成**
- ~~模型配置固定主流模型~~ → **二期已完成**
- AI 生成、计费、OSS 持久化 → 三期
- 首页多模板后台 → 三期
