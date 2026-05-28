# 平台统一 — 上线前验收清单

> **关联**：[2026-platform-unification-rollout.md](./2026-platform-unification-rollout.md)  
> **规则**：`.cursor/rules/platform-app-federation.mdc`、`.cursor/rules/media-storage-oss-vs-db.mdc`、`.cursor/rules/gateway-log-design.mdc`  
> **用法**：预发或本地 `pnpm dev:all` 后逐项勾选；阻塞项须全绿再上线。

---

## 0. 环境与进程

| # | 检查项 | 通过 |
|---|--------|------|
| 0.1 | `book-mall` `:3000`、`tool-web` `:3001`、`story-web` `:3003`、`canvas-web` `:3004`、`gateway-web` `:3005` 均可访问 | [ ] |
| 0.2 | `book-mall/.env.local`：数据库、`TOOLS_SSO_*`、`OSS_*`、Gateway 相关已配置 | [ ] |
| 0.3 | 各子站 `MAIN_SITE_ORIGIN` / `NEXT_PUBLIC_BOOK_MALL_URL` 指向主站 | [ ] |
| 0.4 | `prisma migrate status` 无 pending（book-mall） | [ ] |
| 0.5 | 测试账号已在 Gateway 绑定百炼/DashScope 凭证，Book 个人中心已关联 `sk-gw-...` | [ ] |

---

## 1. book-mall（主站 · Platform）

| # | 检查项 | 通过 |
|---|--------|------|
| 1.1 | 登录 / 登出正常 | [ ] |
| 1.2 | 个人中心 → Gateway API Key 关联状态正确 | [ ] |
| 1.3 | `GET /api/sso/tools/introspect`（带 Bearer）返回套件与 Gateway 信息 | [ ] |
| 1.4 | 工具技术服务费入口可见；未开通时返回可读 403 | [ ] |
| 1.5 | `/admin/sso-clients` 可管理第三方 client（若启用 F） | [ ] |

---

## 2. tool-web（工具站）

| # | 检查项 | 通过 |
|---|--------|------|
| 2.1 | 主站已登录 → 打开工具站 **无需手点「重新连接」**（静默 re-enter） | [ ] |
| 2.2 | 401 / session 失效时自动换票或明确提示 | [ ] |
| 2.3 | **分析室** `visual-lab/analysis`：选模型 + 图/文可流式输出；错误文案 **非** 误报「未关联 Key」 | [ ] |
| 2.4 | Gateway 日志中 failed 可悬停查看 `code` / `message` | [ ] |
| 2.5 | **AI 试衣**：生成完成 UI 状态正确（不长期卡在「生成中」） | [ ] |
| 2.6 | 文生图 / 图生视频等：走 Gateway；无按次扣点弹窗（技术服务费模式） | [ ] |

---

## 3. canvas-web（Canvas · 含影视专业版）

| # | 检查项 | 通过 |
|---|--------|------|
| 3.1 | SSO callback + `tools_token`；未登录跳转主站 | [ ] |
| 3.2 | 打开已有项目：画布加载、自动保存正常 | [ ] |
| 3.3 | **影视专业版**：上传剧本 → 刷新/再进 → **无** `Failed to fetch`（经 `/api/canvas/oss-text`） | [ ] |
| 3.4 | 大纲/角色/分镜生成：Gateway 调用成功或显示真实上游错误 | [ ] |
| 3.5 | 图片/视频节点产物为 **OSS URL**，非 DB 内嵌 base64 | [ ] |
| 3.6 | 未关联 Gateway Key 时顶栏提示 + 阻断生成 | [ ] |

---

## 4. story-web（Story）

| # | 检查项 | 通过 |
|---|--------|------|
| 4.1 | SSO 与 tools_token 同 canvas 模式 | [ ] |
| 4.2 | 项目列表 / 创建 / 进入项目正常 | [ ] |
| 4.3 | 角色/分镜/视频任务走 Gateway；失败有可读错误 | [ ] |
| 4.4 | 媒体结果 URL 为 OSS；删除媒体二次确认（若触达 OSS） | [ ] |

---

## 5. gateway-web（Gateway 控制台）

| # | 检查项 | 通过 |
|---|--------|------|
| 5.1 | Book SSO 登录 Gateway | [ ] |
| 5.2 | 百炼凭证 Base URL：留空或 `…/compatible-mode/v1`（勿仅填根域名） | [ ] |
| 5.3 | Logs：Params / Result / **failed** 悬停均有内容 | [ ] |
| 5.4 | 新失败记录含 `failCode` + `failMessage`（非空） | [ ] |

---

## 6. 跨站与安全（Phase E）

| # | 检查项 | 通过 |
|---|--------|------|
| 6.1 | 未关联 `sk-gw` → `GATEWAY_KEY_REQUIRED`，与「未登录」文案区分 | [ ] |
| 6.2 | 未开通套件 → `TOOLS_ACCESS_DENIED` / `FORBIDDEN_SUITE` | [ ] |
| 6.3 | 上游 404/502 → `UPSTREAM_ERROR` + 真实 message（工具站/分析室） | [ ] |
| 6.4 | 子应用 **不** 直连 book-mall PostgreSQL | [ ] |
| 6.5 | `.env` / 密钥未提交 git（`git status` 无 `.env.local`） | [ ] |

---

## 7. 存储规范（OSS vs DB）

| # | 检查项 | 通过 |
|---|--------|------|
| 7.1 | 新上传图/视频/音频仅 OSS URL 入库 | [ ] |
| 7.2 | 影视专业版剧本文本：节点存 `uploadedScriptOssUrl`，autosave 不持久化大段 `uploadedScriptMd` | [ ] |
| 7.3 | 浏览器不直连 OSS 拉剧本正文 | [ ] |

---

## 8. 发布前最后一步

| # | 检查项 | 通过 |
|---|--------|------|
| 8.1 | Phase A–F 代码已合并/提交；`git ls-files` 无 `node_modules` / `.next` | [ ] |
| 8.2 | 生产环境变量清单与 `doc/tech/` 对照完成 | [ ] |
| 8.3 | 回滚方案：SSO / 计费 feature flag 或分支名已记录 | [ ] |

---

## 备注（验收时填写）

| 日期 | 环境 | 验收人 | 阻塞项 |
|------|------|--------|--------|
| | local / staging | | |
