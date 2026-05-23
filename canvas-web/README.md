# canvas-web · AI 海报画布

ComfyUI 风格的可视化无限画布，节点拖拽出图。是 monorepo 里的独立子站，与 `story-web` 同款架构：登录 / 数据库 / KIE / OSS 全部归口主站 `book-mall`。

- 端口：`:3004`
- 后端契约：`book-mall` 的 `/api/canvas/*`
- 主题：暗紫（`--canvas-bg #0b0b14` / `--canvas-accent #a78bfa`）
- 文档：[`docs/plan.md`](docs/plan.md)、[`docs/do.md`](docs/do.md)

## 启动

仓库根目录：

```bash
pnpm dev:all
```

会先做端口预检（3000-3004），通过后并行拉起 `book-mall` / `tool-web` / `finance-web` / `story-web` / `canvas-web` 与两个 poll-loop（`story:poll-loop` 与 `canvas:poll-loop`）。

如果某个端口被旧的残留进程占用（比如之前 dev 进程没正常退出），`dev:all` 会**直接终止**并打印占用 PID。两种处置：

```bash
pnpm dev:all:clean    # 自动 SIGKILL 占用进程后再起 dev:all（推荐）
pnpm dev:preflight    # 仅做预检（不动进程）
```

只跑 canvas-web：

```bash
pnpm --filter canvas-web dev
```

跑 canvas 任务轮询（结果同步 + OSS 持久化 + 清理）：

```bash
pnpm --filter book-mall canvas:poll-once   # 跑一次
pnpm --filter book-mall canvas:poll-loop   # 常驻
```

## 目录

```
canvas-web/
├─ app/
│  ├─ canvas/[id]/page.tsx          # 画布编辑器（动态路由）
│  ├─ projects/                      # 我的画布（含模板挑选）
│  ├─ gallery/                       # 画作库
│  ├─ models/                        # 模型配置（admin 可增删改）
│  ├─ implementation/                # 实现逻辑文档
│  └─ api/book-mall/[...path]/       # 跨域代理到 book-mall
├─ components/
│  ├─ canvas/
│  │  ├─ flow-canvas.tsx             # React Flow + 外部拖图
│  │  ├─ node-shell.tsx              # 节点容器 + 状态角标
│  │  ├─ node-palette.tsx            # 左侧节点面板
│  │  ├─ toolbar.tsx                 # 顶部工具条
│  │  └─ nodes/                      # 6 类节点 UI
│  └─ layout/canvas-shell.tsx
├─ lib/
│  ├─ canvas/
│  │  ├─ types.ts                    # 节点 / 图 / 状态 类型
│  │  ├─ store.ts                    # zustand + zundo store
│  │  ├─ topo.ts                     # 拓扑排序 / 入边查找
│  │  ├─ run-queue.ts                # 单画布 ≤5 并发 + 5s 轮询
│  │  └─ templates.ts                # 3 套内置模板
│  ├─ canvas-api.ts                  # 浏览器 API 客户端
│  ├─ canvas-viewer-session.ts
│  └─ site-config.ts                 # 顶部导航 + 多站 origin 工具
└─ docs/{plan,do}.md
```

## 节点

| 类型 | 输入 | 输出 | 说明 |
| --- | --- | --- | --- |
| `image` | — | image | 上传 / 拖入参考图，blob URL 即时预览，后台传 OSS |
| `text` | — | text | 自由文本输入 |
| `product-params` | — | text | 结构化产品字段（品牌 / 型号 / 规格…），输出 JSON 文本 |
| `ai-text` | text + image | text | LLM 文案（V1 透传 prompt） |
| `image-gen` | text + image (多张) | image | KIE 图像生成；可选模型 / 比例 / 分辨率 |
| `output` | image | — | 收藏到画作库 |

## 运行流

1. 拓扑排序 → 节点级独立提交  
2. `POST /api/canvas/projects/:id/nodes/:nodeId/run`：book-mall 计算 inputHash / 提交 KIE / 写 `CanvasGenerationTask`  
3. 5s 轮询 `GET /api/canvas/projects/:id/tasks` 同步状态  
4. KIE 完成后 `persistKieResultToOss` 把图存为永久 OSS URL  
5. Output 节点向上游解析最终图，画作库 `GET /api/canvas/works` 列出全部 SUCCEEDED

## 限流

| 维度 | 默认 | 环境变量 | 校验位置 |
| --- | --- | --- | --- |
| 单画布并发 | 5 | `CANVAS_PROJECT_INFLIGHT_MAX` | 前端运行队列 + 后端 `assertCanvasInflightCap` |
| 单用户进行中任务 | 50 | `CANVAS_AI_USER_INFLIGHT_MAX` | 后端 `assertCanvasInflightCap` |

## 跨域 / 环境变量

```ini
# canvas-web (.env.local)
NEXT_PUBLIC_BOOK_MALL_URL=http://localhost:3000
NEXT_PUBLIC_CANVAS_WEB_ORIGIN=http://localhost:3004

# book-mall (.env.local)
CANVAS_WEB_ORIGINS=http://localhost:3004
CANVAS_CORS_IN_APP=1
CANVAS_PROJECT_INFLIGHT_MAX=5
CANVAS_AI_USER_INFLIGHT_MAX=50

# tool-web (.env.local)
NEXT_PUBLIC_CANVAS_WEB_ORIGIN=http://localhost:3004
```

## 删除规则（OSS 安全）

- 「我的画布」删除：第一次确认对象，第二次写明「云端存储 OSS」永久删除  
- 软删除入 `CanvasOssCleanupQueue`，5 分钟后由 `canvas:poll-loop` 调用 `runCleanupWorker` 真删

## Dev 工具

- `http://localhost:3000/dev`：服务总览（含 canvas / canvas-poll 卡片）  
- `http://localhost:3000/dev/canvas/tasks`：CanvasGenerationTask 看板  
- `pnpm --filter book-mall canvas:poll-once`：手工触发轮询 + 清理

## 验收清单

- [x] `pnpm dev:all` 同时拉起 mall / tool / finance / story / story-poll / **canvas / canvas-poll**
- [x] tool-web 侧栏「AI 海报画布」组 4 项可见  
- [x] canvas-web 首页（暗紫主题）+ `/canvas/{新建}` 可拖图入画布、连线、运行单节点出图  
- [x] 单画布连点 6 节点，第 6 个排队（前端 ≤5 并发）  
- [x] `/dev/canvas/tasks` 任务流转 PENDING → SUBMITTED → SUCCEEDED → ossUrl

## 后续 TODO（不阻塞 v1）

- AiText 节点接入 LLM（KIE 文本路由）  
- 项目缩略图自动从最近一次 SUCCEEDED 图像生成  
- Output 节点附加 PNG 导出 / 海报排版叠加  
- tool-web 的 `/ai-poster-canvas/gallery` 跨站 SSO 拉取，把画作直接镶嵌
