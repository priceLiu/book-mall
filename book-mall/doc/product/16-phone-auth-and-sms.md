# 手机号注册登录与短信验证

> 状态：已实施  
> 关联：`14-tenant-team-design.md`、`15-team-usage-manual.md`、腾讯云 [SendSms API](https://cloud.tencent.com/document/product/382/55981)

## 1. 目标

- 主站（book-mall）身份标识改为 **手机号**（大陆 11 位）
- 注册：手机号 + 短信验证码 + 密码
- 登录：**密码** 或 **验证码**（用户 Tab 自选）
- 老用户（已有会话）：**仅绑手机 + 短信验证**，不要求邮箱验证
- 团队邀请：按 **手机号** 发短信（验证码 + 邀请链接）
- 开发测试：`/dev/auth` 一键登录 + Mock 短信号段

Google 登录已下线；邮箱字段保留供历史订单/管理展示，**不可再用于登录**。

## 2. 用户流程

### 2.1 新用户注册

1. `/register` 选择计费人格
2. 输入手机号 → 获取验证码（purpose=`REGISTER`）
3. 输入验证码 + 密码（≥8 位）
4. 创建账号并自动登录

### 2.2 登录

| 模式 | 步骤 |
|------|------|
| 密码 | 手机号 + 密码 |
| 验证码 | 手机号 → 发码（purpose=`LOGIN`）→ 输入验证码 |

### 2.3 老用户绑手机

| 场景 | 流程 |
|------|------|
| 仍有登录态 | 访问 `/account/*` → `/onboarding/bind-phone`（短信验证） |
| 已退出、仅有邮箱 | 登录页 **「邮箱账号绑定手机号」** → `/legacy/bind-phone`：填邮箱 + 手机号 → 绑定成功后重新登录 |
| 管理员代操作 | `/admin/users` →「补录手机」（跳过短信，可选重置密码） |

### 2.4 团队邀请

1. OWNER/ADMIN 填写受邀 **手机号**
2. 系统创建 `TenantInvite(phone, token, urlCode)` 并发送短信；链接形如 `/invite/t/{token}?code={验证码}`
3. 受邀人打开完整链接 → 确认手机号 → **新用户** 设密码并加入，**已有账号** 一键验证并加入（无需再点「获取验证码」）
4. 测试号 `67890xxxxxx`：链接中的 8 位 bypass 码（6 字母 + 2 数字）与原先手动输入规则一致

## 3. API

### POST `/api/auth/sms/send`

```json
{ "phone": "13800138000", "purpose": "REGISTER|LOGIN|BIND_PHONE|TEAM_INVITE", "inviteToken": "可选" }
```

频控：同号 60s 冷却；同号 10 条/日；同 IP 30 条/日。

### POST `/api/auth/register`

```json
{ "phone", "code", "password", "name?", "billingPersona" }
```

### POST `/api/auth/bind-phone`

须登录。`{ "phone", "code", "password?" }`

### NextAuth Credentials

`{ phone, loginMode: "password"|"otp", password?, code? }`

## 4. 环境变量

见 `book-mall/.env.example`：`SMS_PROVIDER`、`TENCENT_SMS_*`、`ALLOW_DEV_AUTH`。

## 5. 测试通道

- 入口：`/dev/auth`（`NODE_ENV=development` 或 `ALLOW_DEV_AUTH=true`）
- Mock 号段：`13800000001`–`13800000009`，验证码固定 `888888`（`SMS_PROVIDER=mock`）
- **临时 bypass**（腾讯云未开通）：8 位 = 6 字母 + 2 数字，仅校验手机号 — 见 [`docs/手机验证码 todo.md`](../../../docs/手机验证码 todo.md)
- 一键 persona 登录（个人/团队 Owner/成员/Admin）

## 6. 迁移说明

- `TenantInvite.email` 已改为 `phone`；迁移前 pending 邀请标记为 EXPIRED，需 Owner 重新邀请
- 已有用户下次带 Cookie 访问时走绑手机流程
- 已登出且无手机的老用户：登录页 **邮箱账号绑定手机号**（`/legacy/bind-phone`）；或管理员 **`/admin/users` →「补录手机」**
