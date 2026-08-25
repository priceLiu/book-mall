# 全站访问统计（Phase 1）

> **状态**：Phase 1 已实施  
> **关联**：[12-platform-app-federation.md](./12-platform-app-federation.md)、[05-admin.md](./05-admin.md)  
> **实施计划**：[../plans/2026-platform-traffic-analytics-impl.md](../plans/2026-platform-traffic-analytics-impl.md)

---

## 1. 目标与非目标

### 目标

- 管理员在 Book 管理后台 **按应用（appKey）** 查看每日访问量。
- 记录客户端 **IP**，支持 **PV**（页面访问次数）与 **UV**（按 IP 日去重）。
- 可查看 **同一 IP 在某应用内的访问频次**（首访/末访时间、hitCount）。
- 各子应用独立域名可直接对外；采集在 **各应用 middleware 异步上报**，Book 汇聚入库。

### 非目标（本阶段不做）

- Gateway `GatewayUser` LOCAL 注册/登录并入 Book 统一入口（见 §10 Phase 2）。
- 注册/登录来源归因事件表（`SiteAuthEvent`）。
- 第三方分析（Google Analytics 等）。
- 全路径 raw 日志、GeoIP、设备画像。

---

## 2. 术语

| 术语 | 含义 |
|------|------|
| **PV** | Page View；符合条件的 GET/HEAD 页面请求计数（含刷新）。 |
| **UV** | Unique Visitor；同一 **CST 业务日** 内，同一 appKey 下 **distinct IP** 数。 |
| **appKey** | 应用标识，与 SSO / 门户划分一致（见 §3）。 |
| **CST 业务日** | 北京时间自然日，`YYYY-MM-DD`；与平台驾驶舱 `cstDateKey` 一致。 |

---

## 3. appKey 枚举（SSOT）

与 `lib/platform-app-sso.ts` · `PlatformSsoApp` 对齐，并扩展：

| appKey | 应用 |
|--------|------|
| `book` | 主站 book-mall |
| `canvas` | AI 画布 canvas-web |
| `story` | 漫剧空间 story-web |
| `tool` | 工具站 tool-web |
| `e-commerce` | 电商工具箱 e-commerce-toolkit |
| `quick-replica` | 快速复制 quick-replica-web |
| `prompt-optimizer` | 提示词优化器 |
| `director` | 3D 导演台 director-web |
| `common-tools` | 常用工具 common-tools |
| `publisher` | 一键发布 publisher-web |
| `gateway` | Gateway 控制台 gateway-web |
| `finance` | 财务控制台 finance-web |

查询层支持 `appKey=all` 表示全站汇总（各 app 之和）。

---

## 4. 采集规则

### 计入

- HTTP 方法：`GET`、`HEAD`。
- 各应用 **页面路由**（非 API、非 Next 静态资源），**含**扫描器探测路径（`/wp-admin`、`/.env` 等）。

### 排除

- `/api/*`
- `/_next/static`、`/_next/image`
- 静态扩展名：`.ico`、`.png`、`.jpg`、`.jpeg`、`.gif`、`.svg`、`.webp`、`.woff`、`.woff2`
- 带 `?_rsc=` 的 RSC 请求（避免 SPA 导航重复计数）
- book 侧 `/admin/*`（管理后台不计入 C 端 PV）

### 写入方式

- 子应用 middleware **fire-and-forget** POST Book `POST /api/internal/platform-traffic/hit`（**含 book 主站**，避免 Edge middleware 直连 Prisma）。
- **不阻塞**用户响应；上报失败静默忽略。
- **IP 在 Book 服务端**从 `x-forwarded-for` / `x-real-ip` 解析（子应用转发原始头）。
- Body `path` 用于判定是否为扫描路径；**扫描仍计入 `pageViews` / `hitCount`**，并另计 `probeViews` / `probeHitCount` 以便后台标明。

---

## 5. 数据模型

### SiteTrafficDaily（日汇总）

| 字段 | 说明 |
|------|------|
| dateCst | CST 日期字符串 |
| appKey | 应用标识 |
| pageViews | 当日 PV（含扫描） |
| probeViews | 其中扫描/探测路径次数 |

唯一索引：`(dateCst, appKey)`。

### SiteTrafficIpDaily（IP 日明细）

| 字段 | 说明 |
|------|------|
| dateCst, appKey, ip | 复合唯一 |
| hitCount | 该 IP 当日在该应用的访问次数（含扫描） |
| probeHitCount | 其中扫描路径次数；后台据此标「扫描 / 混合 / 正常」 |
| firstSeenAt, lastSeenAt | 首访 / 末访 |
| userId | 可选；已登录且 middleware 可解析 session 时写入 |

唯一索引：`(dateCst, appKey, ip)`。

### 保留策略

- **IP 明细**：90 天（脚本 `scripts/platform-traffic-purge-old.ts` 可定期清理）。
- **日汇总**：永久保留。

---

## 6. 汇聚 API

- **路径**：`POST /api/internal/platform-traffic/hit`
- **Body**：`{ "appKey": "canvas", "path": "/projects", "userId": "<Book User.id 可选>" }`（path 可选；userId 在已登录且 middleware 可解析 session / tools_token 时写入）
- **鉴权**：`Authorization: Bearer <TOOLS_SSO_SERVER_SECRET>` 或 `GATEWAY_SSO_SERVER_SECRET`（与各应用 SSO 部署一致，**零新增 env**）。
- **响应**：204 No Content
- **实现**：`lib/site-traffic/record-hit.ts` 事务 upsert 两表。

---

## 7. 管理后台

- **路径**：`/admin/traffic`
- **权限**：与现有管理后台一致（`ADMIN` / `canViewFinanceCost`）。
- **能力**：
  - KPI：选定日全站 / 单 app 的 PV、**其中扫描**、UV；昨日对比。
  - 14 天 PV/UV 趋势。
  - 按 appKey 拆分表格（PV / 扫描 / UV）。
  - 选定日与 app 的 IP Top 50（hitCount 降序，类型：正常 / 扫描 / 混合）。
- 驾驶舱可选挂链：全站今日 PV/UV → `/admin/traffic`。

---

## 8. 隐私与合规

- IP 用于 **运维与访问量统计**，非第三方营销追踪。
- Cookie 同意横幅中的「分析类」与本服务端统计独立；须在隐私说明中披露服务器访问日志含 IP。
- 90 天后删除 IP 明细行；日汇总不含 IP 原文。

---

## 9. 验收标准

1. 本地访问 book / canvas / story 各 1 次，`/admin/traffic` 可见对应 appKey PV≥1、UV≥1。
2. 同一 IP 刷新 3 次，IP 行 `hitCount=3`，UV 仍为 1。
3. 全站汇总 = 各 appKey 之和。
4. 无 SSO server secret 的 POST 返回 403；middleware 无 secret 时静默跳过、不影响页面。
5. 文档与 schema-changelog 已登记。

---

## 10. 后续迭代（Phase 2）

### Gateway 统一注册登录入口

- 收口 `POST /api/gateway/auth/register` 的 `GatewayUser` LOCAL 路径。
- 统一走 Book 手机号注册 + SSO（`/api/sso/gateway/issue`）。
- 与 [gateway-user-guide.md](./gateway-user-guide.md)「Book 注册优先」对齐。

### 可选：SiteAuthEvent

- 在 `/api/auth/register`、`/api/sso/portal/verify`、`/portal-signin` 记录 `sourceApp`。
- 区分「从哪个应用完成注册/登录」，与 PV 日志互补。
