# 手机验证码 — 开通待办与临时方案

> 腾讯云短信正式开通前，系统使用 **临时 bypass 码**（见 §2）。开通完成后须关闭 bypass 并切到真实短信。

关联实现：`book-mall/doc/product/16-phone-auth-and-sms.md` · API [SendSms](https://cloud.tencent.com/document/product/382/55981)

---

## 1. 腾讯云短信开通流程（待办清单）

### 1.1 账号与资质

- [ ] 登录 [腾讯云短信控制台](https://console.cloud.tencent.com/smsv2)
- [ ] 完成企业/个人实名认证（国内短信需实名）
- [ ] 创建或使用已有 **API 密钥**（SecretId / SecretKey）  
  路径：访问管理 → [API 密钥管理](https://console.cloud.tencent.com/cam/capi)

### 1.2 短信应用 SdkAppId

- [ ] 控制台 → [应用管理](https://console.cloud.tencent.com/smsv2/app-manage) → 创建应用
- [ ] 记录 **SmsSdkAppId**（如 `1400xxxxxx`）

### 1.3 签名（国内短信必填）

- [ ] [签名管理](https://console.cloud.tencent.com/smsv2/csms-sign) → 新建签名
- [ ] 填写签名内容（如产品名「智选AI」），提交 **审核**
- [ ] 审核通过后记录 **SignName**（签名文字，非 ID）

### 1.4 正文模板（至少 4 套，或 2 套合并）

| 用途 | 建议变量 | env 键 |
|------|----------|--------|
| 注册 | `{1}` = 6 位验证码 | `TENCENT_SMS_TEMPLATE_REGISTER` |
| 登录 | `{1}` = 验证码 | `TENCENT_SMS_TEMPLATE_LOGIN` |
| 绑定手机 | `{1}` = 验证码 | `TENCENT_SMS_TEMPLATE_BIND` |
| 团队邀请 | `{1}` = 验证码；`{2}` = 团队名；`{3}` = 邀请链接 | `TENCENT_SMS_TEMPLATE_TEAM_INVITE` |

- [ ] [正文模板管理](https://console.cloud.tencent.com/smsv2/csms-template) 创建并 **提交审核**
- [ ] 记录各模板 **TemplateId**

示例（注册/登录类）：

> 您的验证码为{1}，5分钟内有效。如非本人操作请忽略。

示例（团队邀请）：

> 您被邀请加入{2}，验证码{1}。链接：{3}，7天内有效。

### 1.5 服务端环境变量（book-mall）

在 `book-mall/.env.local` / 生产 `deploy/tencent/book-mall.env` 配置：

```bash
SMS_PROVIDER=tencent
TENCENT_SMS_SECRET_ID=
TENCENT_SMS_SECRET_KEY=
TENCENT_SMS_REGION=ap-guangzhou
TENCENT_SMS_SDK_APP_ID=
TENCENT_SMS_SIGN_NAME=
TENCENT_SMS_TEMPLATE_REGISTER=
TENCENT_SMS_TEMPLATE_LOGIN=
TENCENT_SMS_TEMPLATE_BIND=
TENCENT_SMS_TEMPLATE_TEAM_INVITE=
```

- [ ] 填写上述变量并重启 book-mall
- [ ] 更新 `docs/全站架构图与配置表.md` §5（若模板 ID 有变更）

### 1.6 上线前验收

- [ ] 真实手机号收到注册/登录/绑定/邀请四类短信
- [ ] 频控正常（同号 60s 冷却、10 条/日）
- [ ] **关闭临时 bypass**（§2.3）：`SMS_ALLOW_BYPASS_CODE=0`
- [ ] 生产 `ALLOW_DEV_AUTH` 未开启；`/dev/auth` 不可访问
- [ ] 日志不输出明文验证码（mock 日志仅 dev）

---

## 2. 正式开通前的临时方案（当前已启用）

腾讯云未就绪时，**不必依赖真实短信**即可走完注册、登录、绑手机、团队邀请。

### 2.1 交互说明

1. 用户照常点击 **「获取验证码」** → 接口返回成功，前端提示 **「验证码已发送」**（与真实短信一致）。
2. 验证码输入框可填：
   - **6 位数字** — 走正常 DB 校验（mock 号段 `13800000001`–`09` 固定 `888888`）；或
   - **临时 bypass 码** — **8 位：6 个英文字母 + 2 个数字**（顺序不限，如 `abcdef12`、`ab12cdef`），**只校验手机号格式**，不校验是否发过短信。

### 2.2 适用范围

| 场景 | bypass |
|------|--------|
| 注册 | ✅ |
| 验证码登录 | ✅ |
| 老用户绑手机 | ✅ |
| 团队邀请落地页 | ✅ |

团队 Owner 邀请成员时：**发送短信仍显示成功**；受邀人可用 bypass 码完成注册/登录并接受邀请。

### 2.3 关闭 bypass（短信正式开通后必做）

```bash
SMS_ALLOW_BYPASS_CODE=0
SMS_PROVIDER=tencent
# … 填齐 TENCENT_SMS_* …
```

默认：`SMS_ALLOW_BYPASS_CODE` 未设为 `0` 时 bypass **开启**（便于当前联调）。**生产切真实短信后务必设为 `0`。**

实现位置：`book-mall/lib/auth/sms-bypass.ts` · `verifySmsCode()`。

### 2.4 其他测试入口

- `/dev/auth` — 一键登录测试账号（development 或 `ALLOW_DEV_AUTH=true`）
- Mock 号段 `13800000001`–`13800000009` + 数字码 `888888`
- **测试号段 `67890` + 6 位数字**（共 11 位，如 `67890123456`、`67890987654`）：
  - 仅校验 11 位格式，**不发真实短信、不写验证码 DB**
  - 点「获取验证码」仍显示成功
  - 验证码填 **8 位 bypass**（6 字母 + 2 数字，如 `abcdef12`）即可通过
  - 注册 / 登录 / 绑手机 / **团队邀请** 均适用
  - 生产切真实短信后（`SMS_ALLOW_BYPASS_CODE=0`），此号段 bypass **仍可用**（专用于联调；勿用于真实用户）

---

## 3. 生产环境部署 — 环境变量怎么配

> **配置位置**：腾讯云 CloudBase Run → **book-mall** 服务 → 环境变量；或本机 `deploy/tencent/book-mall.env`（勿提交 Git）。  
> 改完须 **重启 book-mall**；`prisma migrate deploy` 在容器启动时自动执行（含 `User.phone`、`SmsVerification` 等迁移）。

子站 **finance-web / tool-web** 无需新增短信变量；用户仍跳转主站 `https://book.ai-code8.com/login`，会话靠 `NEXTAUTH_COOKIE_DOMAIN` 共享 Cookie。

---

### 3.1 两种上线模式（二选一）

| | **阶段 A：短信未开通**（可先上生产） | **阶段 B：短信已开通**（正式运营） |
|---|--------------------------------------|-------------------------------------|
| 适用 | 腾讯云签名/模板还在审核 | 四类模板均已审核通过 |
| 用户如何验证 | 6 位数字码（若发过短信）或 **8 位 bypass**（6 字母+2 数字） | 仅 **6 位短信验证码** |
| `SMS_PROVIDER` | `mock`（默认，不真实调腾讯云） | `tencent` |
| `SMS_ALLOW_BYPASS_CODE` | **不设置**或 `1`（默认开启 bypass） | **必须** `0` |
| `ALLOW_DEV_AUTH` | **勿设置** | **勿设置** |
| 风险 | bypass 码可被猜到格式，仅适合内测/小范围 | 关闭 bypass 后仅真实短信可通过 |

**建议**：若你现在就要部署生产、短信流程还没走完，用 **阶段 A**；模板审核通过后再切 **阶段 B** 并重启。

---

### 3.2 阶段 A — 短信未开通（当前可先部署）

在 **book-mall** 生产环境变量中，在原有主站配置基础上 **增加/确认**：

```bash
# —— 手机号登录（阶段 A：无真实短信）——
SMS_PROVIDER=mock
# 不设置 SMS_ALLOW_BYPASS_CODE，或显式：
# SMS_ALLOW_BYPASS_CODE=1

# 生产切勿开启：
# ALLOW_DEV_AUTH=1
# NEXT_PUBLIC_ALLOW_DEV_AUTH=1
```

**主站登录相关（原有，必填）** — 与手机号改造无关，但生产缺一不可：

```bash
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/tool_mall?sslmode=require
NEXTAUTH_URL=https://book.ai-code8.com
NEXTAUTH_SECRET=<长随机串，与本地不同>
NEXTAUTH_COOKIE_DOMAIN=.ai-code8.com

TOOLS_PUBLIC_ORIGIN=https://tool.ai-code8.com
TOOLS_SSO_SERVER_SECRET=<与 tool-web 完全一致>
TOOLS_SSO_JWT_SECRET=<与 tool-web 完全一致>

NEXT_PUBLIC_FINANCE_WEB_ORIGIN=https://f.ai-code8.com
FINANCE_WEB_ORIGINS=https://f.ai-code8.com
# … 其他子站 ORIGIN 见 deploy/tencent/book-mall.env.example …
```

**管理员手机号（可选）**：seed 或手工把运营手机号升为 ADMIN：

```bash
ADMIN_PHONES=13800138000,13900139000
```

**阶段 A 用户怎么用**

1. 打开 `https://book.ai-code8.com/register` 或 `/login`
2. 可点「获取验证码」（界面显示「验证码已发送」）
3. 验证码框输入 **8 位 bypass**（如 `abcdef12`：6 个字母 + 2 个数字）→ 仅校验手机号即可注册/登录/绑手机/接受团队邀请
4. 老用户（仍有 Cookie）：进 `/account` → 跳转绑手机，同样可用 bypass

**内测入口**：生产默认 **不能** 访问 `/dev/auth`（未设 `ALLOW_DEV_AUTH` 时返回 404）。

---

### 3.3 阶段 B — 短信已开通（正式运营）

腾讯云控制台完成后，在 **book-mall** 改为：

```bash
# —— 手机号登录（阶段 B：真实短信）——
SMS_PROVIDER=tencent
SMS_ALLOW_BYPASS_CODE=0

TENCENT_SMS_SECRET_ID=<API 密钥 SecretId>
TENCENT_SMS_SECRET_KEY=<API 密钥 SecretKey>
TENCENT_SMS_REGION=ap-guangzhou
TENCENT_SMS_SDK_APP_ID=<短信应用 SdkAppId，如 1400xxxxxx>
TENCENT_SMS_SIGN_NAME=<已审核签名文字，如「智选AI」>

TENCENT_SMS_TEMPLATE_REGISTER=<模板 ID>
TENCENT_SMS_TEMPLATE_LOGIN=<模板 ID>
TENCENT_SMS_TEMPLATE_BIND=<模板 ID>
TENCENT_SMS_TEMPLATE_TEAM_INVITE=<模板 ID>
```

**模板参数约定**（与 `lib/sms/send-sms.ts` 一致）：

| 模板 | TemplateParamSet |
|------|------------------|
| 注册 / 登录 / 绑定 | `[验证码]` 共 1 个参数 |
| 团队邀请 | `[验证码, 团队名, 邀请链接]` 共 3 个参数；链接形如 `https://book.ai-code8.com/invite/t/{token}` |

**`NEXTAUTH_URL` 必须等于浏览器访问主站的 Origin**（含 `https://`），否则邀请短信里的链接域名会错。

阶段 B **仍禁止**：

```bash
# ALLOW_DEV_AUTH=1          # 勿开
# NEXT_PUBLIC_ALLOW_DEV_AUTH=1
# SMS_PROVIDER=mock         # 勿与 tencent 混用
```

---

### 3.4 从阶段 A 切到阶段 B 的操作步骤

1. 腾讯云：签名 + 4 个模板 **全部审核通过**
2. CloudBase → book-mall → 环境变量：填齐 §3.3 中 `TENCENT_SMS_*`，设 `SMS_PROVIDER=tencent`、`SMS_ALLOW_BYPASS_CODE=0`
3. **重启** book-mall 服务
4. 用 **真实手机号** 各测一遍：注册、验证码登录、绑手机、团队邀请短信 + `/invite/t/...` 落地页
5. 确认 bypass 码 `abcdef12` 等 **已不能** 通过验证
6. 勾选 §1.6 上线前验收

---

### 3.5 生产部署检查清单

- [ ] `NEXTAUTH_URL` = `https://book.ai-code8.com`（与公网域名一致）
- [ ] `NEXTAUTH_COOKIE_DOMAIN=.ai-code8.com`（finance / tool 等同域 Cookie）
- [ ] `NODE_ENV=production`
- [ ] 未设置 `ALLOW_DEV_AUTH` / `NEXT_PUBLIC_ALLOW_DEV_AUTH`
- [ ] 阶段 A：`SMS_PROVIDER=mock`，知悉 bypass 风险
- [ ] 阶段 B：`SMS_ALLOW_BYPASS_CODE=0` + 全部 `TENCENT_SMS_*` 已填
- [ ] 容器日志无 `[sms] 未配置模板` 警告（阶段 B）
- [ ] 迁移已应用：启动日志含 `20260715120000_phone_auth_and_sms` 或 `migrate deploy` 成功

---

### 3.6 参考文件

| 文件 | 说明 |
|------|------|
| `deploy/tencent/book-mall.env.example` | Docker / Compose 主站 env 模板（已含短信块） |
| `book-mall/.env.example` | 本地开发完整说明 |
| `deploy/tencent/cloudbase-build-guide.md` §4.1 | CloudBase 主站通用变量 |
| `docs/全站架构图与配置表.md` §5 | 全站 env 索引 |

---

## 4. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-14 | 初版：腾讯云开通 checklist + 8 位 bypass 临时方案 |
| 2026-06-14 | 增补 §3 生产环境两阶段 env 配置与切换步骤 |
