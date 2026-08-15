# 需求开发计划：手伴创作（线稿 → 潮玩盲盒 IP 全案）

- **创建日期**：2026-08-15
- **负责人**：电商工具箱
- **关联产品文档**：`doc/product/e-commerce-toolkit.md` §手伴创作
- **SOP / 助手话术真源**：`doc/手伴/skill.md`（运行时由 `lib/ecom/ecom-hand-craft-prompts.ts` 读取）
- **数据库登记**：`doc/database/schema-changelog.md` 2026-08-15 手伴创作

## 背景与目标

电商菜单下新增「手伴创作」studio：用户上传一张手绘线稿，分 10 步产出整套潮玩盲盒 IP 全案（主形象 → 规范三件套 → 盲盒卡 → 周边样机 → 色卡 → 包装 → 表情包 → 小红书长图 → 12 页作品集 → 招商授权页）。页面布局与交互与「产品主图」一致：进度轨 + 中间工作区 + 右侧助手逐步确认。

## 一致性设计（本模块唯一质量命门）

10 步能否成为「同一个 IP」，全靠三条服务端强制约束，**不依赖助手话术**：

1. 第 1 步定稿主形象写入 `meta.workflow.heroLockedUrl`，后续每步生图 **参考图第 1 张恒为它**（`resolveStepRefUrls`）。
2. 每条槽位 Prompt 固定拼接 `HAND_CRAFT_BASE_STYLE`（`buildHandCraftSlotPrompt`）。
3. `hand-craft/models` 只返回支持参考图的图像模型（`isRefCapableEcomImageModel`）；纯文生图模型不进选择器。

未定稿第 1 步时，后续步骤的出图接口直接拒绝，前端按钮同时置灰。

## 任务清单

- [x] Prisma 新增 `EcomHandCraftProject` + 迁移，`db:apply-pending` 落库并 `db:generate`
- [x] `lib/ecom/ecom-hand-craft-steps.ts`：10 步模板表（generate 槽位 / compose 页序）+ `HAND_CRAFT_BASE_STYLE`
- [x] `ecom-hand-craft-types / service / prompts`：Zod、CRUD、线稿上传、按步增量写 `plan`
- [x] `step/[stepId]/generate`：主形象参考图 + 风格串 + Gateway + OSS + `EcomAsset`，逐张回写、并发上限、单张失败不连坐
- [x] `assistant/chat` 流式 + `plan/sync`：解析助手 Markdown 的步骤标记与槽位说明表回写 `plan`
- [x] `compose/[stepId]`：接收 html2canvas 的 `pngBase64`（30MB 上限）→ OSS → `EcomAsset` → `plan.outputs`
- [x] `export`：ZIP 交付包（每步一目录 + 交付清单 + 助手对话）
- [x] 前端四栏：`hand-craft-studio / progress-rail / content-panel / ref-uploader`
- [x] 助手面板：10 步 SOP + Choice Chips（确认生成 / 微调本步 / 回上一步），胶囊样式复用 `STORYBOARD_ASSISTANT_CHOICE_CLASS`
- [x] 槽位区：`hand-craft-slot-grid` + `StoryboardModelPickerDialog`（`mode="image"`），出图期间 2.5s 轮询
- [x] 第 8–10 步：`hand-craft-sheet-view` 代码排版 + `hand-craft-compose-panel` 抓图上传
- [x] 注册：`registry.ts` 模块、侧栏 `Blocks` 图标、资产库 `hand-craft` 分组
- [x] 删除二次确认（项目 / 线稿，第二次文案写明云端存储 OSS）
- [x] 文档：产品分册小节、schema-changelog、price-baseline 说明、本计划

## 验收标准

1. 上传线稿后可从第 1 步逐步走到第 10 步；每步在中间工作区可单张 / 批量出图、改槽位说明、恢复默认说明。
2. 第 2～7 步成图与第 1 步主形象为同一 IP（五官、发饰、配色不漂移）；未定稿第 1 步时后续步骤不可出图。
3. 第 8～10 步能把前序成图排版为长图 / 12 页作品集 / 招商页 PNG 并入库；依赖未齐备时按钮置灰并提示缺哪几步。
4. 导出 ZIP 目录结构完整；删除项目 / 线稿必须两次确认且第二次文案含「云端存储（OSS）」。

## 备注

- **计费**：不新增按次价目。套件月费仍走 navKey `e-commerce-toolkit`（`ecom-toolkit__` 前缀自动覆盖），厂商成本经 Gateway；旧 `ToolBillablePrice` 表已于 `20260709120000_drop_tool_billable_price` 删除。
- **架构文档**：只新增模块，未新增子应用 / 端口 / SSO app / navKey，故未改 `docs/全站架构图与配置表.md`。
- **拼版依赖浏览器**：仓库无服务端 HTML 渲染器（无 puppeteer / playwright / satori），第 8–10 步须在页面停留至抓图完成；跨域图片带 `crossOrigin="anonymous"`。
- **后续可迭代**：作品集页序可做用户自定义；第 9 步 12 页可加整册 PDF 导出。
