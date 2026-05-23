# canvas v2 任务拆解

> 配套 [plan-v2.md](./plan-v2.md)。每阶段任务可独立验收；按阶段顺序执行；阶段内任务多数可并行。

---

## 阶段 1 · Provider 体系

### S1-1 Prisma schema + 迁移
- 在 `book-mall/prisma/schema.prisma` 加 `enum CanvasProviderKind`、`model CanvasProvider`、`model CanvasProviderModel`；`model CanvasGenerationTask` 加 `providerId String?` + `provider` 关联
- 手写迁移 `book-mall/prisma/migrations/20260707120000_canvas_v2_providers/migration.sql`（按现有迁移风格手撸 SQL，避免 `migrate dev` 影子库报错）
- `pnpm --dir book-mall db:deploy` 应用迁移
- `pnpm --dir book-mall prisma generate`

### S1-2 加密工具
- `book-mall/lib/canvas/secret.ts`：`encryptApiKey / decryptApiKey / maskApiKey`，AES-256-GCM
- `book-mall/.env.example` 加 `CANVAS_SECRET_KEY=<base64-32-bytes>`
- `book-mall/.env.local` 同步加（用 `openssl rand -base64 32` 生成）

### S1-3 Provider Gateway 抽象
- 新建 `book-mall/lib/canvas/providers/types.ts`（接口）
- `kie.ts`：调用现有 `kie-client.ts` + `gemini-llm-client.ts`；`KIE_KNOWN_MODELS` 硬编码 chat 与 image 模型清单
- `ali-bailian.ts`：dashscope OpenAI 兼容；`/models` 拉清单
- `openai-compat.ts`：通用，用户填 baseUrl
- `index.ts`：`getGateway(provider)` 工厂

### S1-4 Provider API
- `app/api/canvas/providers/route.ts`：GET 列表 / POST 创建（自动 fetch models 写入）
- `app/api/canvas/providers/[id]/route.ts`：PATCH 改 / DELETE 删（行级二次确认在前端，server 直接删）
- `app/api/canvas/providers/[id]/test/route.ts`：联通测试
- `app/api/canvas/providers/[id]/models/refresh/route.ts`：重抓 model list
- `app/api/canvas/providers/[id]/models/[modelId]/route.ts`：PATCH（启用/禁用/改 sort）

### S1-5 Settings UI（canvas-web）
- 新页面 `canvas-web/app/settings/providers/page.tsx` + `providers-client.tsx`
- 「我的 Providers」Tab：列表 + 行级操作（测试 / 编辑 / 刷新 / 删除·二次确认）
- 「我的模型」Tab：平铺所有 model，启用/禁用/排序
- 「系统模型」Tab：旧 `CanvasEngineModel` 列表（只读，标记内置）
- 「+ 添加 Provider」modal（kind 选择 → 表单 → fetch models → 测试 → 保存）

### S1-6 客户端 API helper
- `canvas-web/lib/canvas-providers-api.ts`：`listProviders / createProvider / updateProvider / deleteProvider / testProvider / refreshProviderModels / updateProviderModel`

### S1-7 导航入口
- `canvas-web/lib/site-config.ts` 加 `{ href: "/settings/providers", label: "配置" }`
- 旧 `/models` 入口暂保留；阶段 5 再调整

### S1-8 验收
- `tsc --noEmit` 通过；`next lint` 通过
- 手测：登录后到 `/settings/providers`，加一个 KIE Provider（用现有 KIE_API_KEY 试），看到模型清单；测试连通；删除时走两次确认

---

## 阶段 2 · 双引擎节点

### S2-1 类型与 store
- `canvas-web/lib/canvas/types.ts`：加 `ai-engine` / `image-engine`；新增 `AiEngineNodeData / ImageEngineNodeData`；保留旧 `ai-text/image-gen` 类型字面量（迁移期）
- `NODE_DEFAULT_DATA` 加默认值

### S2-2 MentionsTextarea
- `canvas-web/components/canvas/mentions/MentionsTextarea.tsx`
- 基于 `contenteditable`；监听 `input` + `compositionstart/end`
- 输入 `@` 弹 popover；选中后插入 `<span data-ref-id="...">@xxx</span>`（`contenteditable=false`）
- API：`value: string`（含 `@<nodeId>` token）→ `onChange(value, refIds[])`
- 提供 `formatMentions(value, allNodes)` 工具：把 token 渲染成可读显示

### S2-3 Provider+Model 选择器
- `canvas-web/components/canvas/engine-picker.tsx`
- 二级 dropdown：先 Provider（用户的 + 系统默认），再该 Provider 下的 model（按 role 过滤：LLM / IMAGE）
- 显示 vendor tag + 简介

### S2-4 参数动态渲染
- `canvas-web/components/canvas/dynamic-param-form.tsx`
- 入参：`paramsSchema: ParamSchema[]`、`value`、`onChange`
- 字段类型支持：`select / text / number / range / boolean`

### S2-5 AI 引擎节点
- `canvas-web/components/canvas/nodes/ai-engine-node.tsx`
- 上游 chips 行（高亮/灰显）
- 三段式模板（折叠 + 一键插入）
- MentionsTextarea
- 「+ 插入模板」、「+ 引用上游」
- 「本次只读 @图1, ...」
- [▶ 生成] → 调 `/run`，同步等 LLM 返回
- 输出 markdown 区（react-markdown 或简化版）

### S2-6 生图引擎节点
- `canvas-web/components/canvas/nodes/image-engine-node.tsx`
- 模型卡片横向选择（参考 imgs/model.png）
- Prompt textarea（默认显示上游 textOutput / runtime.textOutput；可手编）
- 参数面板（DynamicParamForm 渲染）
- [▶ 生成] → 创建新 task；不覆盖
- active 大图 + [↔ 对比]/[⬇ 下载]
- 历史 chip 行占位（阶段 4 实现切换/删除）

### S2-7 后端 run 路由分流
- `book-mall/app/api/canvas/projects/[id]/nodes/[nodeId]/run/route.ts`：按 `node.type` 分流到 `runLlmTask / runImageTask`
- `book-mall/lib/canvas/canvas-llm-service.ts`：新增；调 gateway.chat → 落 `CanvasGenerationTask`（kind=TEXT，status=SUCCEEDED，textOutput）
- `book-mall/lib/canvas/canvas-task-service.ts`：image-engine 路径用所选 provider 而非 KIE 默认

### S2-8 注册节点
- `canvas-web/components/canvas/flow-canvas.tsx`：`nodeTypes` 加 `ai-engine` / `image-engine`
- `canvas-web/components/canvas/node-palette.tsx`：palette 列表加这两项 logo（移除旧 `ai-text` / `image-gen`，由迁移函数处理已有节点）

### S2-9 验收
- 拖出 AI 引擎节点 + 接 2 个图片 + 1 个文本 → 选 KIE Provider 的 gemini-3-flash → 输入 prompt（含 @图1 @文本1）→ 点生成 → 几秒内显示 markdown 设计方案
- 拖出生图引擎接到 AI 引擎 → 选 nano-banana-pro → 生成图片，OSS URL 落库

---

## 阶段 3 · 文本节点双向 + 产品参数合并

### S3-1 text-node 双向
- 加 `target(text)` left handle
- `TextNodeData` 加 `mode: 'manual' | 'piped'`
- piped 模式 readonly + 显示 `runtime.textOutput`；右上角 ✎ 切到 manual
- run-queue：ai-engine SUCCEEDED 时找直接子 text 节点（mode != manual）→ 写 textOutput

### S3-2 文本模板
- `canvas-web/lib/canvas/text-templates.ts`：导出 5+ 模板（产品参数 / 品牌信息 / 风格关键词 / 受众画像 / 设计要求）
- 在 text-node 加「+ 插入模板」popover，按光标插入

### S3-3 删除产品参数节点
- 从 `node-palette.tsx` 移除 product-params 入口
- `NODE_DEFAULT_DATA` 删除；类型保留（兼容期）
- `CanvasNodeType` 暂保留；阶段 6 删

### S3-4 旧 graph 迁移
- `canvas-web/lib/canvas/migrate.ts`：`migrateGraphV1ToV2(graph: CanvasGraph): CanvasGraph`
- `ai-text → ai-engine`，把 prompt 落到三段式系统任务段
- `image-gen → image-engine`
- `product-params → text`，5 字段拼成 markdown
- 在 server 端 `getCanvasProject` 返回前 in-memory 调用一次（如 schemaVersion < 2）

### S3-5 验收
- 拖一个 text 节点 → 接到 AI 引擎下游 → 跑一次后 text 节点显示设计方案；点 ✎ 进入手编模式
- 加载一个 v1 老画布，nodes 自动迁移成 v2；保存后 schemaVersion=2

---

## 阶段 4 · 重复生成 + 历史 + 对比

### S4-1 ImageEngineNodeData.activeTaskId
- 类型加；store 加 `setNodeActiveTask(id, taskId)` action

### S4-2 历史 chip 行 UI
- 节点底部 chip 行（横滑）
- 来源：`listCanvasProjectTasks(pid, [nodeId])`，按 createdAt desc
- chip 显示缩略图 + 序号 + 状态徽章；点击切 active
- hover 出 ✕ 删除按钮

### S4-3 删除单次结果（含 OSS）
- 新接口 `DELETE /api/canvas/projects/:pid/tasks/:tid/route.ts`：把 `ossUrl` 入 `CanvasOssCleanupQueue`，task row 软删（加 `deletedAt`）；前端从历史里隐藏
- 前端走两次 confirm，第二次明确写 **云端存储 OSS**
- 拓展 `canvas-api.ts`：`deleteCanvasTask(base, projectId, taskId)`

### S4-4 compare-modal
- `canvas-web/components/canvas/compare-modal.tsx`
- props: `tasks: CanvasTaskRecord[]`、`activeIdLeft / activeIdRight`、`onClose`
- 大图对比（两张并排，中间可拖动滑块 — 鼠标拖动改变左/右图的可见宽度）
- 顶部两个 dropdown 选 task；快捷键 `←/→` 改 right
- Esc / 点击遮罩关闭

### S4-5 验收
- 同一 image-engine 节点连续点 3 次"重新生成" → 历史 chip 出现 3 条；点切换 active 大图变；点对比看到滑动对比；删除一条走两次确认；删除后历史里消失

---

## 阶段 5 · 工作流模板重做

### S5-1 saveCanvasTemplate 清洗
- `canvas-web/lib/canvas-api.ts`：`saveCanvasTemplate` 调用前用 `stripRuntime(graph)` 清洗
- `canvas-web/lib/canvas/sanitize.ts`：`stripRuntime` 删掉 `runtime` / `ossUrl` / `blobUrl` / `uploading` / `activeTaskId` 等运行时字段

### S5-2 createCanvasFromTemplate
- `canvas-web/lib/canvas/clone.ts`：`cloneGraphForNewProject(graph)`
- 给每个 node 重分配 `n_${nanoid(8)}`；建 `oldId → newId` map；同步 edges 的 source/target/...

### S5-3 3 套系统模板
- `canvas-web/lib/canvas/templates.ts` 重写
- 「产品风格化海报」、「三视图」、「短视频封面」三个 graph
- 每个模板配一个示意缩略图（`canvas-web/public/templates/*.png` 或 emoji 占位）

### S5-4 模板列表 UI
- 已有列表，更新：每张卡显示缩略图 + 名字 + 简介 + 「使用」按钮
- 系统模板从 `templates.ts` 读；用户模板从 `/api/canvas/templates` 读

### S5-5 验收
- 在画布里点「保存为工作流」→ 输入名字 → 列表里能看到自己的模板
- 从模板创建新画布 → 节点结构复用，nodeId 不同，没有上次的 ossUrl/runtime 残留

---

## 阶段 6 · 旧画布迁移 + 清理 + 验收

### S6-1 server 端 in-memory migrate
- `book-mall/app/api/canvas/projects/[id]/route.ts` 的 GET：返回前调 v2 schema migrate 函数
- `book-mall/lib/canvas/canvas-graph-migrate.ts`：实现与前端 `migrate.ts` 等价的服务端版本
- 检查 schemaVersion < 2 才迁

### S6-2 删除旧节点组件
- 删 `canvas-web/components/canvas/nodes/ai-text-node.tsx`、`image-gen-node.tsx`、`product-params-node.tsx`
- `flow-canvas.tsx` 移除注册
- `canvas-web/lib/canvas/types.ts` 移除 `"ai-text" | "image-gen" | "product-params"` 字面量
- 清理引用

### S6-3 验收清单
- `pnpm dev:all` 一把启动所有服务
- 单画布 5 并发限制
- 加载一个 v1 老画布 → 自动迁移、UI 正常
- 添加用户 KIE Provider，运行 AI 引擎 + 生图引擎双引擎流；图片落 OSS
- 重复生成 → 历史 → 对比 → 删除（二次确认 + OSS 清理）
- 保存为工作流 → 从工作流新建 → 节点结构复用
- `tsc --noEmit` 全绿；`next lint` 全绿
- 更新 `canvas-web/README.md` 与 `canvas-web/app/implementation/page.tsx` 反映 v2 架构

---

## 估时（粗）

| 阶段 | 文件改动量 | 估时 |
| --- | --- | --- |
| 1 | ~10 文件新建 + 3 改 | 大头 |
| 2 | ~8 文件新建 + 3 改 | 大头 |
| 3 | ~3 文件新建 + 4 改 | 中 |
| 4 | ~3 新建 + 3 改 | 中 |
| 5 | ~3 新建 + 2 改 | 小 |
| 6 | ~2 新建 + 4 删 | 小 |
