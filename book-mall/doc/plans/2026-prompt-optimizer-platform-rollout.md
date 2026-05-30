# 提示词优化器 · 平台接入实施计划

> **状态**：实施完成（待联调验收）  
> **产品说明**：[../product/prompt-optimizer-platform.md](../product/prompt-optimizer-platform.md)  
> **入口索引**：[../../../docs/prompt-optimizer.md](../../../docs/prompt-optimizer.md)  
> **创建**：2026-05-30

---

## 0. 目标摘要

| 维度 | 目标态 |
|------|--------|
| UI | 上游 prompt-optimizer 原样（Vue + Naive UI） |
| 鉴权 | Book SSO + `tools_token`（对齐 canvas-web） |
| 模型 | 一律 Gateway；Key 仅在 Gateway 模型管理 |
| 计费 | 工具月费 `prompt-optimizer` + Gateway BYOK |
| Gateway UX | Model Manager（Tab / Test / Edit / Enable） |

---

## 1. 进度总表

| 阶段 | 说明 | 状态 |
|------|------|------|
| P0 | 文档与 design 规格 | ✅ |
| P1 | Gateway Model Manager + credentials API | ✅ |
| P2 | prompt-optimizer-platform 壳 + Book 登记 | ✅ |
| P3 | vendor subtree + core Gateway patch | ✅ |
| P4 | 部署与总验收 | ✅（构建脚本 / checklist；E2E 待人工） |

---

## 2. P0 · 文档

| 任务 | 状态 |
|------|------|
| [docs/prompt-optimizer.md](../../../docs/prompt-optimizer.md) | ✅ |
| [product/prompt-optimizer-platform.md](../product/prompt-optimizer-platform.md) | ✅ |
| [doc/README.md](../README.md) 索引 | ✅ |
| [gateway-web/docs/design.md](../../../gateway-web/docs/design.md) § Model Manager | ✅ |
| 本文档 | ✅ |

---

## 3. P1 · Gateway Model Manager

### 3.1 book-mall API

| 任务 | 状态 |
|------|------|
| `PATCH /api/gateway/credentials`（alias / baseUrl / active） | ✅ |
| `POST /api/gateway/credentials/test` | ✅ |
| `POST /api/gateway/credentials/clone` | ✅ |
| createSchema 支持 DASHSCOPE / HUNYUAN | ✅ |
| model catalog Tab 分组 + capability tags | ✅ |

### 3.2 gateway-web UI

| 任务 | 状态 |
|------|------|
| `components/model-manager/*` | ✅ |
| `/dashboard/models` 升级为 Model Manager | ✅ |
| `/dashboard/credentials` → 重定向 models | ✅ |
| 导航「模型管理」 | ✅ |
| 删除 `window.confirm`（删除二次确认 Modal） | ✅ |

**验收**：Gateway 内 Test / Edit / Enable / Disable 凭证；Canvas 仍路由同一 Key。

---

## 4. P2 · Platform 壳 + Book 登记

| 任务 | 状态 |
|------|------|
| `prompt-optimizer-platform/` SSO / session / BFF / middleware | ✅ |
| Dockerfile `:3006` | ✅ |
| `navKey: prompt-optimizer` | ✅ |
| Prisma ToolNavVisibility + ToolServiceFeePlan | ✅ |
| `clientPageToServiceNavKey` 映射 | ✅ |
| 根 `dev:all` + [docs/dev.md](../../../docs/dev.md) | ✅ |

**验收**：主站登录 → `:3006` 可访问；月费 / Gateway 未就绪有提示。

---

## 5. P3 · Vendor + Core Patch

| 任务 | 状态 |
|------|------|
| `git subtree` → `prompt-optimizer/` | ✅ |
| `README.platform.md` | ✅ |
| `packages/core` PlatformGatewayAdapter | ✅ |
| `packages/ui` 隐藏 Key UI + Gateway 链接 | ✅ |
| `prompt-optimizer/docs/design.md` | ✅ |
| platform `build:vendor` 拷贝 web dist | ✅ |

**验收**：优化一条 prompt 成功；Network 无厂商直连域名。

---

## 6. P4 · 部署与总验收

| 任务 | 状态 |
|------|------|
| `build:docker` / `build:all` 脚本 | ✅ |
| [2026-platform-prelaunch-checklist.md](./2026-platform-prelaunch-checklist.md) 增 prompt 行 | ✅ |
| CloudBase 说明（目录 / 端口 3006） | ✅ |

### 总验收

- [ ] Book SSO 无感进入 prompt-optimizer（待人工）
- [ ] 工具月费门禁生效（待人工）
- [ ] Gateway 模型管理 + 关联 Key 后可优化（待人工）
- [ ] 无浏览器直连厂商、无子应用存 Key（待人工 Network 验证）
- [x] §1 进度表 P0–P4 代码与文档完成

---

## 7. 代码路径索引

| 说明 | 路径 |
|------|------|
| Platform 壳 | `prompt-optimizer-platform/` |
| 上游 vendor | `prompt-optimizer/` |
| Gateway 凭证 API | `book-mall/app/api/gateway/credentials/` |
| Model catalog | `book-mall/lib/gateway/model-catalog.ts` |
| Model Manager UI | `gateway-web/components/model-manager/` |
| Canvas SSO 参考 | `canvas-web/app/auth/sso/callback/route.ts` |

## 8. CloudBase 部署

| 项 | 值 |
|----|-----|
| 目标目录 | `prompt-optimizer-platform/` |
| 服务端口 | **3006** |
| 构建 | `pnpm build:all`（先 vendor web + Next standalone） |
| 环境变量 | `MAIN_SITE_ORIGIN`、`TOOLS_SSO_*`、`PROMPT_OPTIMIZER_PUBLIC_ORIGIN` |
