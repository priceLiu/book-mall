# story-web

漫剧创作**个人空间**：每位用户拥有可对外展示的首页，以及创作室、影像室、模型配置等工作区。

- 产品计划：[`docs/plan.md`](./docs/plan.md)
- 实施清单：[`docs/todo.md`](./docs/todo.md)
- 部署说明：[`../deploy/tencent/README.md`](../deploy/tencent/README.md)

## 本地开发

```bash
cd story-web
pnpm install
pnpm dev
```

浏览器：<http://localhost:3003>

## 路由（一期）

| 路径 | 说明 |
|------|------|
| `/` | 个人空间首页（固定模板落地页） |
| `/studio` | 创作室（占位） |
| `/media` | 影像室（占位） |
| `/models` | 模型配置（占位） |

## 腾讯云 CloudBase Run

与 `finance-web` 相同：Git 仓库选 **`priceLiu/book-mall`**，目标目录 **`story-web`**，端口 **3003**，域名 **story.ai-code8.com**。

环境变量模板：[`../deploy/tencent/story-web.env.example`](../deploy/tencent/story-web.env.example)。

## 与 tool-web

工具站「漫剧剧场 → 创作幻想家」通过 `NEXT_PUBLIC_STORY_WEB_ORIGIN` 外链到本应用。
