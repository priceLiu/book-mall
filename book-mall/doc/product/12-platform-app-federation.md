# 平台联邦架构（〇十二）

> **状态**：正式产品约束（未上线整站，允许一次性统一改造）。  
> **实施计划**：[../plans/2026-platform-unification-rollout.md](../plans/2026-platform-unification-rollout.md)  
> **关联**：[08-independent-tools-sso.md](./08-independent-tools-sso.md)、[09-finance-refactor-and-tool-federation.md](./09-finance-refactor-and-tool-federation.md)、[gateway-user-guide.md](./gateway-user-guide.md)

---

## 1. 文档目的

约定 **Book 作为平台框架**、**多应用独立部署**、**账号互通**、**第三方可接入** 的产品与技术边界。  
所有新应用（含 monorepo 内新目录与未来外部接入方）须遵守；存量应用在未上线前完成迁移。

---

## 2. 三条核心原则

### 2.1 各应用分开部署、低耦合

| 要求 | 说明 |
|------|------|
| 独立部署单元 | 每个应用独立 Next 进程、独立域名/CloudBase 服务 |
| 数据边界 | 业务数据可按域分库或分 schema；**账本与准入策略只在 Book** |
| 禁止 | 子应用直连 Book 数据库写钱包/流水；复制 `resolveBillablePrice` 等规则 |

**工具拥有「动作与会话」；平台拥有「账与准入」。**（见 09 §5）

### 2.2 各应用自有门户、账号互通

| 要求 | 说明 |
|------|------|
| 自有门户 | 每个应用有自己的首页、导航、品牌（如 canvas-web、tool-web、story-web） |
| 统一身份源 | Book `User` + NextAuth；子应用 **不** 维护独立账号体系 |
| 互通协议 | Book SSO：`issue` / `re-enter` → 一次性 code → 子站 `exchange` → **platform access token**（今日实现名为 `tools_token`，可演进为标准 OIDC） |
| 用户体验 | 主站已登录时 **静默换票**；未登录跳转 Book `/login?callbackUrl=…` 或门户自有品牌登录页 |

**禁止** 长期并存两种互不兼容的互通方式（Cookie 透传 vs 换票 SSO）。Canvas 的 Cookie 代理为 **迁移前历史方案**。

### 2.2.1 门户独立登录（画布 / 快速复制 / 电商）

为独立推广与 SEO，画布、快速复制、电商工具箱各自域名可承载 **品牌化登录/注册/个人中心 UI**，但认证仍走 Book 单一真源（不重写认证逻辑）：

- 共用校验：`lib/auth/verify-credentials.ts` 的 `verifyCredentialsLogin()`，NextAuth `authorize()` 与门户端点共用。
- 门户端点：`POST /api/sso/portal/verify`（`Bearer TOOLS_SSO_SERVER_SECRET`）校验凭证后签发一次性 `autoLoginToken`；注册复用 `POST /api/auth/register`；短信复用 `/api/auth/sms/send`。子应用经 **BFF** 服务端调用，不向浏览器暴露 secret。
- 建立会话：门户前端整页跳 Book `/portal-signin`，复用现有 NextAuth `autologin` 建立 Book 会话（共享身份），再走既有 `re-enter → exchange → callback` 落子应用 `tools_token`。
- 无感切换：用户具 Book 会话后，跨门户仅一次不可见 `re-enter` 重定向；用户与积分为 Book 单账本，天然全站一致。

**准入解耦**：登录/注册成功即可进门户（`member` tier 令牌，`tools_nav_keys` 可空）；`introspect` 返回 `active:true` + `entitled`。工具能力（生成）仍由 `assertPlatformGatewayEntitlement` 在调用时按工具月费 + Gateway 关联拦截。详见 `docs/门户独立开发需求.md`。

### 2.3 Book 是框架，第三方可接入

Book 提供 **Platform API**（非业务 UI 单体）：

| 能力 | 典型路径 |
|------|----------|
| 换票 / 会话 | `/api/sso/tools/issue`、`re-enter`、`exchange`、`introspect` |
| 套件准入 | introspect 返回 `tools_nav_keys`；`requireToolSuiteNavAccess(navKey)` |
| Gateway 代理 | `/api/sso/tools/gateway/*`（DashScope、Chat 等） |
| 资源库 | `/api/sso/tools/*/library` 等 |

第三方接入须：注册 `toolKey` / `navKey`、配置 SSO 密钥、走 Gateway，**不** 获得数据库写权限。

---

## 3. 认证：目标态 vs 现状

| 应用 | 现状（迁移前） | 目标态 |
|------|----------------|--------|
| tool-web | Book SSO + `tools_token` | **保留并作为标准**；补静默 re-enter |
| canvas-web | NextAuth Cookie 经 `/api/book-mall/*` 代理 | **迁到 Book SSO**；会话 API 仍可调 Book，但不依赖 Cookie 透传 |
| story-web | 同 canvas，viewer-session 代理 | **迁到 Book SSO** |
| gateway-web | Book SSO（`/api/sso/gateway/issue`） | 已符合；与工具 SSO 文档对齐命名 |
| finance-web | 待统一 | Book SSO 或 Cookie 只读 BFF（按页面定） |

---

## 4. 财务：Gateway + 工具技术服务费

### 4.1 两层分离

| 层 | 职责 |
|----|------|
| **Gateway** | 用户绑定厂商 Key；**厂商成本用户自担**；用量/日志在 Gateway 控制台 |
| **Book** | **课程会员订阅**（仅课程）；**工具按月技术服务费**（钱包扣点）；SSO 准入 |

详见 [13-tool-service-fee-and-wallet.md](./13-tool-service-fee-and-wallet.md)。

### 4.2 退役方向（Phase D，未上线可激进）

- 工具 **黄金会员 = RECHARGE + 余额线** → **有效工具技术服务费周期**
- 工具 **reserve/settle 按次扣点** → 仅 **月费 + Gateway BYOK**
- 课程 `Subscription` **不再** 附带工具 navKey

实施：[../plans/2026-phase-d-service-fee-billing.md](../plans/2026-phase-d-service-fee-billing.md)

### 4.3 仍保留的单点写入

即使不做按点扣费，以下仍只在 Book（或未来 Billing 服务）：

- 订阅状态、`tools_nav_keys`
- SSO 准入裁决
- 非 AI 商品的订单/钱包（若保留）

---

## 5. 新应用接入 checklist

1. 在 `book-mall` 注册 `toolKey` / 订阅套件 / `navKey`（见 `TOOL_SUITE_NAV_KEYS`）。
2. 子应用：`MAIN_SITE_ORIGIN`、`TOOLS_SSO_*`、可选 `TOOLS_PUBLIC_ORIGIN`。
3. 实现 `/auth/sso/callback`（可复制 `tool-web`）。
4. 壳层：`/api/tools-session` + 静默 re-enter。
5. 生成类 API：`verifyToolsBearer` 或等价 + **Gateway 关联检查**。
6. 文档：在 `doc/product/` 或应用 `README` 登记入口与 env。
7. Cursor 规则：开发时遵守 `.cursor/rules/platform-app-federation.mdc`。

---

## 6. 安全要点

- Platform token **短 TTL**；敏感操作前 **introspect** 复核订阅。
- Gateway / usage **每次** 校验 token 有效；**须在 gateway 路径复核 entitlement**（消除 JWT 窗口内订阅已失效仍可调用的问题）。
- 子应用 **不存厂商 Secret**；Book **不存** Gateway `sk-gw` 明文。
- 破坏性操作 UI **二次确认**（含 OSS）。

---

## 7. 文档与规则索引

| 资源 | 路径 |
|------|------|
| 实施计划（分阶段任务） | [../plans/2026-platform-unification-rollout.md](../plans/2026-platform-unification-rollout.md) |
| Phase D 技术服务费 | [../plans/2026-phase-d-service-fee-billing.md](../plans/2026-phase-d-service-fee-billing.md) |
| 工具月费产品说明 | [13-tool-service-fee-and-wallet.md](./13-tool-service-fee-and-wallet.md) |
| Cursor 持续规则 | `/.cursor/rules/platform-app-federation.mdc` |
| SSO 环境变量 | [../tech/tools-sso-environment.md](../tech/tools-sso-environment.md) |
| Gateway 用户流程 | [gateway-user-guide.md](./gateway-user-guide.md) |
| 工具联邦草案 | [09-finance-refactor-and-tool-federation.md](./09-finance-refactor-and-tool-federation.md) |
