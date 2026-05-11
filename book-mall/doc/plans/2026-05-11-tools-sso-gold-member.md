# 计划：黄金会员 + 独立工具站 SSO（v1.1）

> 对应需求：[`../v1.1`](../v1.1) · 产品分册：[`../product/08-independent-tools-sso.md`](../product/08-independent-tools-sso.md)

## 进度

- [x] 文档：黄金会员定义、「黄金会员」与站内高级计量权益区分  
- [x] 文档：域名占位、令牌策略、部署拆分说明  
- [x] 数据库：`SsoAuthorizationCode` 迁移与 changelog  
- [x] 主站：`lib/gold-member.ts`  
- [x] 主站：JWT HS256 `lib/tools-sso-token.ts`、`lib/sso-tools-env.ts`  
- [x] 主站 API：`/api/sso/tools/issue`、`exchange`、`introspect`  
- [x] 个人中心：工具站入口按钮（试衣间 `/fitting-room`）  
- [x] **工具站骨架（与 `book-mall/` 同级目录 `tool-web/`）**：`/auth/sso/callback`、`/fitting-room` 占位、`../../../tool-web/README.md`  
- [ ] **联调**：两端 `.env.local` 一致密钥、`pnpm dev` 双进程 smoke test  
- [ ] （可选）过期 `SsoAuthorizationCode` 定时清理任务  

## 验收（主站）

1. 黄金会员用户配置 `TOOLS_*` 与 `TOOLS_PUBLIC_ORIGIN` 后，个人中心可跳转至工具站 URL（即使工具站尚未实现 callback，浏览器应落在 404 属预期）。  
2. 非黄金会员 `issue` 返回 403。  
3. `exchange` 使用错误 Bearer 返回 401；正确 code 单次消费。
