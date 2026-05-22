## 一键启动（推荐）

在仓库**根目录**：

```bash
pnpm install          # 首次
pnpm dev:all          # 3000–3003 四个 Next
pnpm dev:all:story    # 同上 + story:poll-loop（漫剧生成必开）
```

启动后打开 **开发导航页**：http://localhost:3000/dev

详见仓库根目录 [`docs/dev.md`](../../docs/dev.md)。

---

## 单独启动（旧方式）

| 工程 | 端口 | 命令 |
|------|------|------|
| book-mall | 3000 | `cd book-mall && pnpm dev` |
| tool-web | 3001 | `cd tool-web && pnpm dev` |
| finance-web | 3002 | `cd finance-web && pnpm dev` |
| story-web | 3003 | `cd story-web && pnpm dev` |
| story 轮询 | — | `cd book-mall && pnpm story:poll-loop` |
