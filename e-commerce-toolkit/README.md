# 电商工具箱（e-commerce-toolkit）

独立 Next 子应用，端口 **3007**。账号经 Book SSO；AI 经 Gateway BFF。

## 本地

```bash
cd e-commerce-toolkit && pnpm install && pnpm approve-builds --all
# SSO：`pnpm dev` 会自动从 ../book-mall/.env.local 读取 TOOLS_SSO_*（须与主站一致）
# 亦可复制到本目录 .env.local
pnpm dev
```

从主站个人中心「打开电商工具箱」，或：

`http://localhost:3000/api/sso/tools/re-enter?app=e-commerce&redirect=/`

## 文档

- [docs/readme.md](./docs/readme.md)
- [docs/plan.md](./docs/plan.md)
- [book-mall/doc/product/e-commerce-toolkit.md](../book-mall/doc/product/e-commerce-toolkit.md)
