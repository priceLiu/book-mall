# 平台统一改造 — 完整实施计划

> **背景**：整站尚未正式上线，允许一次性统一认证、财务与接入协议，避免上线后双轨维护。  
> **产品约束**：[12-platform-app-federation.md](../product/12-platform-app-federation.md)  
> **Cursor 规则**：`/.cursor/rules/platform-app-federation.mdc`  
> **创建**：2026-05-27

---

## 0. 目标摘要

| 维度 | 目标态 |
|------|--------|
| 部署 | 各应用独立部署；Book = Platform API + 订阅/准入 |
| 门户 | canvas / tool / story / gateway 各有门户，账号经 Book SSO 互通 |
| 认证 | **统一 Book SSO 换票**；消灭「重新连接」体感（静默 re-enter） |
| AI 调用 | **一律 Gateway**；用户 BYOK，Book 不代扣厂商账单 |
| 收费 | **订阅 + 套件准入**；退役工具站「黄金会员充值线 + 按点 reserve/settle」（AI 路径） |
| 第三方 | 冻结 Platform API 契约（exchange / introspect / gateway），预留 client 注册 |

---

## 1. 现状与差距

| 项 | 现状 | 差距 |
|----|------|------|
| tool-web | SSO + 点数扣费 + Gateway 部分已接 | 仍要 gold 充值线；401 UX 差；部分 API 不重查 entitlement |
| canvas-web | SSO + Bearer BFF + Gateway | Cookie 代理已降级为同域 BFF；媒体/OSS 见 `media-storage-oss-vs-db.mdc` |
| story-web | SSO + Bearer BFF + Gateway | 同 canvas |
| gateway-web | Book SSO | 已较标准 |
| git | `gateway-web/.next` 曾误入库 | Phase A 已 `git rm --cached` + 根 `.gitignore` 加强 |
| 文档 | 09 联邦草案 | 缺 12 产品约束 + 本计划 + Cursor 规则 |

---

## 2. 阶段总览

```text
Phase A  仓库卫生 + 文档/规则           [本 PR 范围]
Phase B  SSO 体验（静默换票、统一壳层）  ~1 周
Phase C  Canvas / Story 迁 Book SSO      ~2–3 周
Phase D  财务收敛（订阅+Gateway）        ~2–3 周
Phase E  安全加固 + API 契约冻结         ~1 周
Phase F  第三方接入准备（可选）          ~2 周+
```

**建议顺序**：A → B → C 与 D 可部分并行 → E → F  
**总工期（1 人全职粗估）**：6–10 周；多人可压缩 C/D。

---

## 3. Phase A — 仓库卫生 + 文档/规则 ✅

### A.1 Git 忽略（已完成项）

- [x] 根 `.gitignore`：`**/node_modules/`、`**/.next/`、`**/out/`
- [x] `git rm -r --cached gateway-web/.next`（174 文件移出版本库）
- [ ] 提交后确认：`git ls-files | grep node_modules` 为空；`grep '\.next/'` 为空

### A.2 文档与规则（本 PR）

- [x] `book-mall/doc/product/12-platform-app-federation.md`
- [x] `book-mall/doc/plans/2026-platform-unification-rollout.md`（本文）
- [x] `.cursor/rules/platform-app-federation.mdc`
- [x] `.cursor/rules/media-storage-oss-vs-db.mdc`（图片/视频 OSS，其余 DB）
- [x] `book-mall/doc/README.md` 索引更新
- [x] `book-mall/doc/process/development-constraints.md` §7 平台联邦

### A.3 验收

- 新 clone 后 `pnpm dev` 不会在 git status 里出现 `.next` / `node_modules`
- Agent 对话加载 `platform-app-federation` 规则

---

## 4. Phase B — SSO 体验统一（tool-web 先行）

**目标**：主站已登录 → 工具站无感可用；错误可读。

### B.1 静默 re-enter

| 任务 | 文件/位置 |
|------|-----------|
| 壳层加载无 token 时探测主站 session | `tool-web/components/tool-shell-client.tsx` |
| 自动 `window.location` 到 `re-enter?redirect=` | 同上；提取 `lib/tools-silent-sso.ts` |
| API 401 `tools_session_inactive` 时触发一次 renew | 各 client fetch 封装或 shared hook |
| 实验室/文生图等页 session 横幅（已部分做） | `image-to-video-lab-client.tsx` 等 |

### B.2 统一会话 UX

| 任务 | 说明 |
|------|------|
| 顶部「重新连接」保留为手动兜底 | `tool-shell-client.tsx` |
| 文案统一 | 「未连接工具站」→ 链到 re-enter |
| 延长 JWT TTL（可选） | `TOOLS_SSO_JWT_TTL_SECONDS=7200` 文档与环境示例 |

### B.3 验收

- 主站已登录、直接打开 `/image-to-video/lab` → 自动换票并成功生成（或明确 Gateway/订阅错误）
- 不再出现仅「闪一下」无提示

**估时**：3–5 人日

---

## 5. Phase C — Canvas / Story 迁移 Book SSO

**目标**：消除 Cookie 透传作为唯一鉴权；保留 `/api/book-mall/*` 仅作 **带 Bearer 的 BFF**（或逐步废弃 Cookie 转发）。

### C.1 canvas-web

| 任务 | 文件/方向 |
|------|-----------|
| 增加 `/auth/sso/callback` | 复制 `tool-web/app/auth/sso/callback/route.ts` 模式 |
| 环境变量 | `MAIN_SITE_ORIGIN`、`TOOLS_SSO_*`（与 tool 共用密钥） |
| `RequireAuth` 改造 | 由 `viewer-session` Cookie → `/api/tools-session` + platform token |
| `canvas-api.ts` | 服务端 route 读 `tools_token` cookie；转发 Book API 用 Bearer |
| Book 侧 navKey | 注册 canvas 套件或使用现有 key |
| 移除或降级 Cookie 代理 | `book-mall-client-request.ts`：优先同域 SSO，代理仅 fallback |
| Gateway 关联检查 | 已有 `GATEWAY_KEY_REQUIRED`；与 SSO 错误区分 |

### C.2 story-web

| 任务 | 说明 |
|------|------|
| 同 C.1 模式 | SSO callback + tools_token |
| 项目 API | 继续调 book-mall `/api/story/*`，鉴权改为 Bearer 或 session middleware |
| tool-web 入口 | `NEXT_PUBLIC_STORY_WEB_ORIGIN` 链到已 SSO 的 story |

### C.3 book-mall

| 任务 | 说明 |
|------|------|
| Canvas API | `requireSessionUser` 扩展：接受 **Bearer platform token** 或 NextAuth（迁移期双支持） |
| 统一 helper | `lib/platform-auth.ts`：`resolvePlatformUser(req)` |
| story API | 同上 |

### C.4 验收

- canvas / story **不依赖** NextAuth Cookie 跨域转发即可登录使用
- 生产：`NEXTAUTH_COOKIE_DOMAIN` 仍可用于主站单点，但子应用不 **必须** 依赖它

**估时**：10–15 人日（含联调与回归 canvas 画布、story 项目）

---

## 6. Phase D — 技术服务费 + Gateway（详见子计划）

**子计划（任务勾选）**：[2026-phase-d-service-fee-billing.md](./2026-phase-d-service-fee-billing.md)

**已确认**：

- AI 生成 **不按次扣点**；全部 Gateway BYOK  
- **课程**会员计划 **仅课程**；工具 **按月技术服务费**（钱包）  
- 进度以子计划 D0–D5 checklist 为准  

- **状态**：已完成（见子计划 checklist）

---

## 7. Phase E — 安全加固 + API 契约

| 任务 | 说明 |
|------|------|
| gateway/dashscope、usage reserve | 每次调用前 `getToolsSsoEligibility` 或缓存短 TTL |
| introspect 与 JWT 窗口 | 缩短 TTL 或 critical path 强制 introspect |
| 冻结 Platform API | `doc/tech/platform-api-v1.md`：exchange、introspect、gateway、错误码 |
| 集成测试 | SSO 换票、401、403 forbidden_suite、GATEWAY_KEY_REQUIRED |

**估时**：5–7 人日

---

## 8. Phase F — 第三方接入（可选）

| 任务 | 说明 |
|------|------|
| `SsoClient` 表 | client_id、redirect_uris、所属 navKeys |
| 开发者文档 | 基于 12 + platform-api-v1 |
| 示例第三方 app | monorepo `examples/platform-client/` 最小 Next |

**估时**：10+ 人日（可上线后再做）

---

## 9. 风险与回滚

| 风险 | 缓解 |
|------|------|
| Canvas 迁移破坏画布 | Phase C 前补关键路径手工测试清单；feature flag `CANVAS_SSO_V2` |
| 财务改错 | 未上线无生产用户；staging 全链路走查 |
| SSO 密钥泄露 | 仅服务端；`.env.example` 占位；不进 git |
| 工期膨胀 | 严格 Phase 门禁；D 依赖产品确认 gate |

**回滚**：各 Phase 独立分支；C/D 可用 env flag 切回 Cookie/点数路径（迁移期保留 2 周代码分支）。

---

## 10. 推荐执行顺序（本周起）

| 周 | 内容 |
|----|------|
| W1 | **A 提交** + **B 静默 SSO** + 产品确认 D.1 |
| W2–W3 | **C canvas SSO** + story SSO 起步 |
| W3–W4 | **D 准入/扣费退役** + tool 实验室验收 |
| W5 | **E 安全** + 全站回归 |
| W6+ | **F 第三方**（可选） |

---

## 11. 任务勾选（总览）

**上线前验收**（按应用逐项勾选）：[2026-platform-prelaunch-checklist.md](./2026-platform-prelaunch-checklist.md)

### Phase A
- [x] gitignore + untrack `.next`
- [x] 12 产品文档 + 本计划 + Cursor 规则
- [x] `.cursor/rules/media-storage-oss-vs-db.mdc`
- [ ] git 提交（含平台统一、分析室/Canvas/Gateway 日志等存量改动）
- [ ] 预发全链路验收（见 prelaunch checklist §0–§8）

### Phase B
- [x] 静默 re-enter
- [x] 401 统一处理（tool-shell 静默换票 + serviceFee 文案）

### Phase C
- [x] canvas SSO（callback + tools-session + re-enter + Bearer BFF）
- [x] story SSO（同上）
- [x] book Platform auth helper（`lib/platform-auth.ts`）

### Phase D
- [x] 产品确认
- [x] 退役 gold 充值线（工具 SSO）
- [x] 退役 tool reserve/settle（AI）
- [x] UI 扣费文案调整

### Phase E
- [x] entitlement 每次 gateway 校验（`assertPlatformGatewayEntitlement`）
- [x] platform-api-v1 文档

### Phase F
- [x] 第三方 client 注册（`SsoClient` + `/admin/sso-clients` + `allowedNavKeys` 裁剪 + 示例 app）

---

## 12. 相关仓库路径速查

```text
book-mall/
  lib/tools-sso-access.ts      # 准入（待改订阅-only）
  lib/issue-tools-sso-redirect.ts
  app/api/sso/tools/           # Platform API
  doc/product/12-platform-app-federation.md

tool-web/
  app/auth/sso/callback/       # SSO 样板
  components/tool-shell-client.tsx
  lib/tools-introspect.ts

canvas-web/
  lib/book-mall-client-request.ts   # 跨源 BFF 代理（SSO 已迁）
  app/api/canvas/oss-text/          # 剧本 OSS 服务端读取
  components/auth/require-auth.tsx

.cursor/rules/
  platform-app-federation.mdc
  media-storage-oss-vs-db.mdc
  gateway-log-design.mdc
```

---

**当前状态（2026-05-27）**：Phase B–F 代码与文档已完成；**待 git 提交 + [上线前验收清单](./2026-platform-prelaunch-checklist.md)** 全绿后再正式上线。
