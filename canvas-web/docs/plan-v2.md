# canvas v2 实施计划 — AI + 生图 双引擎

> **来源需求**：仓库根 [docs/canvas.md](../../docs/canvas.md) + 参考图 [docs/imgs/1.png](../../docs/imgs/1.png) (AI 引擎卡片) / [docs/imgs/2.png](../../docs/imgs/2.png) (前后对比) / [docs/imgs/model.png](../../docs/imgs/model.png) (引擎参数面板风格)。
>
> **关系**：本文档是对 [plan.md](./plan.md) 的迭代升级（v1 已交付节点画布 MVP，v2 重构成商业级双引擎）。旧 plan / do 保留留档。

---

## 一、目标差异（v1 → v2）

| 维度 | v1 已交付 | v2 目标 |
| --- | --- | --- |
| 引擎模型 | 单引擎 (`image-gen` 节点直接调 KIE 出图) | **双引擎**：AI 引擎（出文本，调 LLM）+ 生图引擎（出图，调 KIE/百炼/...） |
| 模型与 Key | `CanvasEngineModel` 全局共享、用 `KIE_API_KEY` 系统 key | **用户级 Provider**：用户在「配置」里加自己的 KIE / 阿里百炼 / OpenAI 兼容；每个 Provider 下挂多个 model，节点上做二级选择 |
| Prompt 编辑 | 纯 textarea | **Mentions 富编辑**：`@图1`、`@方案` 引用上游节点；输入 `@` 弹列表插入 chip；已引用 chip 高亮，未引用灰显 |
| 引擎参数 | 几个固定 select（aspect/resolution/format） | 按所选 model 的 `paramsSchema` 动态渲染（参考 [imgs/model.png](../../docs/imgs/model.png) 风格：模型卡片 + 提示词 + 分辨率 + 时长 + 高级参数） |
| 重复生成 | 每次运行覆盖结果 | 每次运行积累一条 task；节点底部历史 chip 行；可切换激活、可对比、可删除（带 OSS 二次确认） |
| 前后对比 | 无 | `compare-modal.tsx`：左右大图 + 中间拖动滑块；快捷键翻页选择对比对象 |
| 文本节点 | 仅作输入源（仅 source handle） | **双向**：左 target + 右 source；上游 AI 引擎写入时自动呈现，用户可「✎ 覆盖」转手写；提供产品参数 / 品牌信息 / 风格关键词等模板插入 |
| 产品参数节点 | 5 字段表单 | **删除**，并入 text 节点（提供文字模板插入） |
| 工作流复用 | 模板已有但未跑通 v2 节点 | 重做 3 套系统模板（产品风格化海报 / 三视图 / 短视频封面）；「保存当前画布为工作流」清洗运行时字段；「从模板新建」克隆并重分配 nodeId |

---

## 二、架构总览

```mermaid
flowchart LR
  subgraph SRC[输入数据源]
    P1[图片·产品图×N]
    P2[图片·风格参考]
    P3[文本·产品参数<br/>支持模板插入]
  end
  P1 -->|@图1| AE[AI 引擎节点]
  P2 -->|@图7| AE
  P3 -->|@参数| AE
  AE -->|runtime.textOutput<br/>写入 piped 文本| TXT[文本节点·设计方案<br/>用户可编辑/覆盖]
  TXT --> IE[生图引擎节点]
  P1 -.可加新参考图.-> IE
  IE -->|task n / task n-1 / .../| HIST[历史 chip 行<br/>对比/删除/切换 active]
  HIST --> OUT[输出节点·入画作库]
```

**双引擎核心定位：**
- **AI 引擎节点** 取代旧 `ai-text`：调 LLM（默认 KIE 托管的 gemini-3-flash-preview，或用户自配的百炼通义千问、其他 OpenAI 兼容服务），输入是上游图片+文本+参数，输出 markdown 设计方案。
- **生图引擎节点** 取代旧 `image-gen`：调图像模型（KIE 系列、百炼通义万相、其他 OpenAI 兼容图像端点），输入是 prompt（来自上游文本/AI 方案）+ 参考图（来自上游图片），输出 OSS 图片 URL。

---

## 三、数据模型

### 3.1 新增表（均落到迁移 `2026XXXX_canvas_v2_providers/migration.sql`）

```prisma
enum CanvasProviderKind {
  KIE                 // KIE.ai 多模型聚合；既能调 LLM 也能调 IMAGE
  ALI_BAILIAN         // 阿里百炼 / dashscope OpenAI 兼容
  OPENAI_COMPAT       // 通用 OpenAI 兼容（用户填 baseUrl）
  GEMINI_NATIVE       // Google AI Studio 原生 (预留，阶段 1 不实现)
}

model CanvasProvider {
  id                String              @id @default(cuid())
  userId            String
  user              User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  alias             String              // 用户起的名字，如 "我的 KIE 账号"
  kind              CanvasProviderKind
  apiKeyEncrypted   String              @db.Text   // AES-256-GCM 加密
  baseUrl           String?             // OPENAI_COMPAT 必填；其它走默认
  active            Boolean             @default(true)
  lastTestedAt      DateTime?
  lastTestStatus    String?             // "ok" | "error:..."
  models            CanvasProviderModel[]

  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  @@index([userId, active])
}

model CanvasProviderModel {
  id              String                @id @default(cuid())
  providerId      String
  provider        CanvasProvider        @relation(fields: [providerId], references: [id], onDelete: Cascade)
  modelKey        String                // provider 端的 model id
  displayName     String
  role            CanvasModelRole       // 复用现有枚举 IMAGE | VIDEO | LLM
  description     String?               @db.Text
  paramsSchema    Json?                 // UI 渲染参数：[{key, label, type, options?, default?, ...}]
  defaultParams   Json?
  enabled         Boolean               @default(true)
  sortOrder       Int                   @default(0)

  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt

  @@unique([providerId, modelKey])
  @@index([providerId, enabled, sortOrder])
}
```

### 3.2 既有表的扩展

`CanvasGenerationTask` 加：
- `providerId String?` — 关联调用的 Provider；系统 key 调用为 `null`

> 既有 `kind / textOutput / inputPayload / resultPayload` 已经满足双引擎需要，**无需** 加 `outputType / outputText`。

### 3.3 加密 (`book-mall/lib/canvas/secret.ts`)

- AES-256-GCM；密钥 32 字节，从 `CANVAS_SECRET_KEY` env 读取（base64）
- 落库格式：`v1.<base64 iv>.<base64 ciphertext>.<base64 authTag>`
- API：`encryptApiKey(plain) -> string`、`decryptApiKey(blob) -> string`、`maskApiKey(plain) -> "sk-...****"`
- 启动 sanity check：env 缺失时给出明确错误，避免 silent corruption

---

## 四、Provider Gateway

`book-mall/lib/canvas/providers/`：

| 文件 | 职责 |
| --- | --- |
| `types.ts` | 统一接口：`ChatRequest`、`ChatResponse`、`ImageRequest`、`ImageTask`、`ListModelsResult` |
| `kie.ts` | 包装现有 `kie-client.ts` + `gemini-llm-client.ts`；模型清单走硬编码 `KIE_KNOWN_MODELS` |
| `ali-bailian.ts` | 阿里百炼 OpenAI 兼容（baseUrl: `https://dashscope.aliyuncs.com/compatible-mode/v1`）；模型清单调 `/models` |
| `openai-compat.ts` | 通用 OpenAI 兼容；模型清单调 `${baseUrl}/models` |
| `index.ts` | `getGateway(provider)` 按 `kind` 分发 |

**统一接口签名：**

```ts
export interface CanvasProviderGateway {
  testConnection(): Promise<{ ok: boolean; message?: string }>;
  listModels(): Promise<ListModelsResult>;
  chat(req: ChatRequest): Promise<ChatResponse>;            // LLM
  createImageTask(req: ImageRequest): Promise<ImageTask>;   // 出图
  pollImageTask?(taskId: string): Promise<ImageTask>;       // KIE 异步专用
}
```

**run 路由分流（`projects/[id]/nodes/[nodeId]/run/route.ts`）：**

```ts
if (node.type === "ai-engine") {
  // 同步调 chat → 写 textOutput → 直接 SUCCEEDED
} else if (node.type === "image-engine") {
  // 调 createImageTask → SUBMITTED → poll worker 接管
}
```

LLM 调用因为同步快，直接在 run 接口里完成；图像保留 KIE 异步轮询。

---

## 五、节点系统

| node type | 名字 | 状态 | handles | 引擎 |
| --- | --- | --- | --- | --- |
| `image` | 图片 | 保留 | source(image) | 否 |
| `text` | 文本 | **改造（双向）** | target(text) + source(text) | 否 |
| `ai-engine` | AI 引擎 | **新（替换 `ai-text`）** | target(text+image, 多入) + source(text) | 是·LLM |
| `image-engine` | 生图引擎 | **新（替换 `image-gen`）** | target(text+image, 多入) + source(image) | 是·IMAGE |
| `output` | 输出 | 保留 | target(image) | 否 |
| `group` | 分组容器 | 保留 | 无 | 否 |
| ~~`product-params`~~ | 产品参数 | **删除**（功能并入 text） | —— | —— |

**旧画布迁移函数**（`canvas-web/lib/canvas/migrate.ts`）：
- `ai-text` → `ai-engine`：`prompt` 落到三段式的「系统任务」段；`modelKey` 默认 `gemini-3-flash-preview` (KIE)
- `image-gen` → `image-engine`：保留 `modelKey/prompt/aspectRatio/...`
- `product-params` → `text`：5 字段拼成多行 `品牌：xxx\n名称：yyy\n...` 写入 `text`

迁移点：server 端 `getCanvasProject` 返回前 in-memory 跑一次（不强制写回 DB，保护历史数据）。

---

## 六、AI 引擎节点 UI

参考 [docs/imgs/1.png](../../docs/imgs/1.png)。

```
┌── AI 引擎 ── [Provider: 我的KIE ▾] ─ [Model: gemini-3-flash ▾] ─ [状态] ──┐
│                                                                            │
│ 引用 chips:  [@图1 ⬛] [@图7 ⬛] [@参数 ⬛] [@图3 灰未引用]                  │
│                                                                            │
│ ┌────────────────────────────────────────────────────────┐                 │
│ │ 【输入变量】(可折叠)                                     │                 │
│ │ 1. 海报风格参考: @图1                                    │                 │
│ │ 2. 核心产品客体: @图7                                    │                 │
│ │ 【系统任务】                                              │                 │
│ │ 你是顶尖视觉艺术指导...                                    │                 │
│ │ 【强制运算逻辑】                                          │                 │
│ │ ...                                                     │                 │
│ └────────────────────────────────────────────────────────┘                 │
│ [+ 插入模板]   max_tokens [...]   temperature [...]                         │
│ 本次只读 @图1, @图7              [▶ 生成]                                   │
│                                                                            │
│ ─── 输出 (markdown) ───                                                     │
│ 设计方案文本（可编辑/复制/重新生成）                                         │
└────────────────────────────────────────────────────────────────────────────┘
```

**实现要点：**
- **Provider/Model 二级 dropdown**：先选 Provider chip → 在该 Provider 的 `LLM` 模型里二级选 model；显示 `vendor` tag + 简介
- **Mentions 富编辑器** `canvas-web/components/canvas/mentions/MentionsTextarea.tsx`：基于 `contenteditable` + `compositionstart/end`（IME 友好）；输入 `@` 弹 popover 列出可引用 chip；插入后变成不可分割的 chip 元素，`data-ref-id={nodeId}`；序列化 → `@nodeId` token
- **上游 chips 行**：`directPredecessors(edges, id)` → 渲染缩略图 chip；点击 chip 自动插入到 prompt 当前光标处；prompt 里被引用的 chip 高亮（彩色边框），未引用的 50% 灰透明
- **三段式模板**默认折叠；"+ 插入模板"按钮一键展开预置结构（输入变量 / 系统任务 / 强制运算逻辑）
- **参数面板**：根据 `CanvasProviderModel.paramsSchema` 动态渲染（用 `<DynamicParamForm schema=... value=... onChange=... />`）
- **生成按钮**：调 `/api/canvas/projects/:pid/nodes/:nid/run`；同步等待 LLM 返回（loading 转圈）；完成后渲染 markdown 到下方"输出"区
- **输出区**支持 markdown rendering（用 `react-markdown` 或简化版）；右上角小按钮：复制 / 编辑 / 重新生成

---

## 七、生图引擎节点 UI

参考 [docs/imgs/model.png](../../docs/imgs/model.png) 的参数风格 + [docs/imgs/2.png](../../docs/imgs/2.png) 的输出对比。

```
┌── 生图引擎 ── [Provider ▾] ─ [模型卡片选择] ─ [状态] ──────────┐
│                                                               │
│ 模型卡片: [Nano Banana Pro 选中] [Wan 2.7] [Happy Horse]        │
│           小卡片，含厂商 tag + 一句简介                          │
│                                                               │
│ 上游引用 chips: [@方案] [@图3] [@图5]                           │
│                                                               │
│ Prompt 提示词（可来自上游 / 用户编辑）:                          │
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ ...textarea...                                           │   │
│ └─────────────────────────────────────────────────────────┘   │
│                                                               │
│ 比例 [1:1▾]  分辨率 [2K▾]  格式 [png▾]  N [1▾]                  │
│ Seed [...] CFG [...] (按模型 paramsSchema 暴露)                 │
│                                                               │
│ ─── 输出 ───                                                   │
│ ┌──────────────┐                                              │
│ │ active 大图   │  [↔ 对比]  [⬇ 下载]                          │
│ └──────────────┘                                              │
│                                                               │
│ 历史 (3): [t1✓] [t2✓] [t3 active] [+ 重新生成]                 │
└───────────────────────────────────────────────────────────────┘
```

**实现要点：**
- `ImageEngineNodeData` 加 `runtime.activeTaskId: string`；不存 history（前端从 `listCanvasProjectTasks(pid, [nid])` 拉，按 createdAt desc）
- 「重新生成」=  调 `/run` 创建新 task；不覆盖；前端轮询新任务直至完成；自动切 `activeTaskId` 到最新
- 历史 chip 行：横滑；悬浮出 `×` 删除按钮（按 `.cursor/rules/destructive-delete-confirmation.mdc` 走两次确认；第二次确认文案明确写 **云端存储 OSS**）
- 删除调用：`DELETE /api/canvas/projects/:pid/tasks/:tid`（新增）；后端把 `ossUrl` 入 `CanvasOssCleanupQueue`，cleanup worker 异步清理
- 对比 modal `canvas-web/components/canvas/compare-modal.tsx`：
  - 大图 left+right 两张并列；中间一根可拖动的滑块（before-after slider）
  - 上方有左右 dropdown 选择"对比 task A vs B"；快捷键 `←/→` 切换
  - 关闭：`Esc` 或点击遮罩

---

## 八、文本节点（双向）

`canvas-web/components/canvas/nodes/text-node.tsx` 升级：

- 加 `target(text)` left handle
- `TextNodeData` 加 `mode: 'manual' | 'piped'`：
  - `piped`：textarea readonly，显示 `runtime.textOutput`（来自上游 ai-engine 写入）；右上角「✎ 覆盖」切到 `manual`，把当前 textOutput 复制到 `data.text`
  - `manual`：textarea 可编辑（即用户手写）
- 「+ 插入模板」popover：从 `canvas-web/lib/canvas/text-templates.ts` 读模板，插入到光标位置：
  - 产品参数模板（品牌/型号/尺寸/价格/卖点 → 多行）
  - 品牌信息模板
  - 风格关键词（极简 / 复古 / 赛博 / 国潮）
- run-queue 增强：当 ai-engine SUCCEEDED 且 textOutput 非空 → 找下游 text 节点（直接子，且非 manual mode）→ 写 `runtime.textOutput`

---

## 九、Provider 配置 UI

新页面 `canvas-web/app/settings/providers/`：
- `page.tsx`：服务端壳 + 读 session
- `providers-client.tsx`：CSR 主体

**主面板：**
- Tab 1「我的 Providers」：列表卡片，每行 一个 Provider（别名 / kind 徽章 / 模型数 / active toggle / 上次测试时间 + 状态）
  - 行级操作：测试连通 / 编辑（改名/换 key/换 baseUrl）/ 刷新模型清单 / 删除（两次确认）
- Tab 2「我的模型」：所有 Provider 下所有 model 平铺；可启用/禁用/排序
- 顶部右侧「+ 添加 Provider」按钮 → modal：
  1. 选 kind（卡片）
  2. 填别名 / API Key / baseUrl（OPENAI_COMPAT 必填）
  3. 自动 fetch model list（成功列出可勾选；失败提示并允许手填）
  4. 一键测试连通
  5. 保存

**导航**：把现有 `/models` 入口改名为「配置」，路由保留 `/models` 但内容替换为 Providers Hub（旧 EngineModel 管理移到 Tab "系统模型"）；或直接新增 `/settings/providers` 入口，`/models` 保留作旧功能。
**采用方案 A**：新增 `/settings/providers` 路径；旧 `/models` 重定向过去并 keep 系统模型 tab。

---

## 十、工作流模板重做

`canvas-web/lib/canvas/templates.ts` 重写：

- 「产品风格化海报」：3 个 image 节点（产品×2 + 风格×1）+ 1 个 text(产品参数) → AI 引擎 → text(方案) → image-engine → output
- 「三视图」：1 个 image + 1 个 text(描述) → AI 引擎 → image-engine(三视图模型) → 3 个 output
- 「短视频封面」：image + text → image-engine(高分辨率) → output

「保存当前画布为工作流」(`saveCanvasTemplate`)：
- 抽取 graph
- 清空 `runtime`、`ImageNodeData.ossUrl/blobUrl/uploading`、`ImageEngineNodeData.runtime`、`AiEngineNodeData.runtime` 等运行时字段
- 保留结构 + prompt / params / handles
- 写入 `CanvasTemplate.canvas`

「从工作流模板创建画布」(`createCanvasFromTemplate`)：
- 克隆 `template.canvas`
- 重分配每个 node id（`n_${nanoid(8)}`），同步更新 edges 的 source/target id
- 创建新 `CanvasProject`

---

## 十一、阶段拆分（每阶段一组提交）

| 阶段 | 主题 | 关键产出 | 依赖 |
| --- | --- | --- | --- |
| **1** | Provider 体系 | Prisma 迁移 / secret 加密 / gateway 抽象 / 6 个 API / `/settings/providers` 页面 / 导航入口 | 无 |
| **2** | 双引擎节点 | `ai-engine-node.tsx` / `image-engine-node.tsx` / `MentionsTextarea` / Provider+Model 二级选择 / 参数动态渲染 / 三段式模板 / 上游 chip 行 + @ 解析 | 阶段 1 |
| **3** | 文本节点双向 + 产品参数合并 | text-node 双向 + manual/piped / 模板插入 / 删除 product-params 节点 / 旧 graph 迁移 / 顶部 logo 面板移除"产品参数" | 阶段 2 |
| **4** | 重复生成 + 历史 + 对比 | `activeTaskId` / 历史 chip 行 / 删除单次结果（OSS 二次确认 + cleanup queue） / `compare-modal.tsx` 滑块对比 + 快捷键 | 阶段 2 |
| **5** | 工作流模板重做 | 「保存为工作流」清洗 / 「从模板新建」克隆+重分配 nodeId / 3 套系统模板 / 模板列表 UI | 阶段 2 + 4 |
| **6** | 旧画布迁移 + 清理 + 验收 | `getCanvasProject` 加 in-memory migrate / 删除旧节点组件 / 走完验收清单 | 全部 |

---

## 十二、风险与回退

- **Mentions IME 兼容**：中文输入法的 composition 事件需小心；如卡顿或丢字，回退方案：先用 `<textarea>` + 正则 `@(\w+)` 高亮 + chip 序号联动，**保证功能不退化**；后续再渐进升级到富编辑（阶段 2 内的 sub-tasks）
- **阿里百炼 paramsSchema 差异大**：阶段 1 只先支持 KIE 和 OPENAI_COMPAT；阶段 2 在真实接入时再加 ALI_BAILIAN 专属字段
- **加密 key 缺失**：`CANVAS_SECRET_KEY` env 缺失时直接拒绝创建/读取 Provider；`/settings/providers` 页给出明确提示
- **旧画布兼容**：所有迁移在 server 端 `getCanvasProject` 内 in-memory 完成；保存时按 v2 schema 写回 → 自然完成持久化迁移；不主动批量改写 DB

---

## 十三、不做的事

- **不引入** tiptap / Slate / lexical（包体优化，自实现轻量 mentions 满足需求）
- **不做** 团队协作 / 实时光标
- **不做** 视频生成节点（接口预留 `role: VIDEO`，UI 阶段 7+）
- **不引入** 全文搜索 / vector store
