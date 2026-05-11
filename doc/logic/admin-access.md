# 管理后台访问控制

> 产品：`doc/product/05-admin.md`  
> 代码：`middleware.ts`、`app/admin/layout.tsx`、`User.role`

## 规则

1. **角色**：`User.role` 为 `ADMIN` 或 `USER`（默认）。  
2. **JWT**：登录时 `authorize` 返回 `user.role`，写入 `token.role`；`session.user.role` 同步。  
3. **middleware**：访问 `/admin` 或子路径须已登录；若 `token.role !== 'ADMIN'`，重定向至 `/account`。  
4. **layout**：再次校验 session，防止漏网。  
5. **提升管理员**：`.env` 中 `ADMIN_EMAILS` + `pnpm db:seed` 对**已存在**用户 `updateMany`；新用户注册后需再跑一次 seed 或手工改库。

## 入口

- 前台顶栏（`(site)` 布局）：**管理后台**链接，`session.user.role === 'ADMIN'` 时显示。  
- 直接打开：`/admin`（非管理员被送走）。
