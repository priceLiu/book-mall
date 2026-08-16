# 电商工具箱（e-commerce-toolkit）

> **设计**：monorepo `e-commerce-toolkit/design/DESIGN.md`  
> **价目 B 层**：`e-commerce-toolkit/doc/price-baseline.md`  
> **联邦约束**：[12-platform-app-federation.md](./12-platform-app-federation.md)

## 1. 产品定位

面向电商卖家的 **全屏 AI 工具箱**：主图、详情、模特图、带货视频、**微剧情分镜故事版**、IP/海报/VI、宣传片与广告短片。独立域名部署，账号经 Book SSO 互通。

### 微剧情分镜（M5）

- 入口：`/ecom/storyboard/micro-drama`
- 左栏创作助手（DeepSeek / Gemini，Gateway 流式）+ 可选多参考图
- 右栏可变镜数 HTML 分镜表；可导出 HTML / PNG（PNG 作为视频模型主参考图）
- 整片视频：`doubao-seedance-2.0`，时长 4–15s 用户自定，全部经 Gateway
- toolKey：`ecom-toolkit__storyboard`（`chat` / `video`）

### 拆图拆视频（图片/视频反推拆解）

> 需求与 JSON 契约：[`doc/拆图拆视频/`](../拆图拆视频/requirements.md)（`ecom-media-decompose-prompts.ts` 运行时读取 `skill.md`）

- 入口：`/ecom/media-decompose`；**电商**侧栏；单页工作区（上传 + Prompt + 模型 + 拆解结果）
- 输入：本地图片/视频文件、**公网 HTTPS 链接**、我的资产（单素材）
- 输出：Markdown + ` ```media-decompose ` JSON（Zod 校验）；视频 15 列分镜表 + 叙事/卡点/拍摄脚本；静态图要素 + 正/负向 Prompt + 实拍方案
- 模型：Vision LLM（拆视频须 video-understanding）；Gateway `image_url` / `video_url`
- toolKey：`ecom-toolkit__media-decompose`（`decompose`）；数据表 `EcomMediaDecomposeProject`

### 手伴创作（线稿 → 潮玩盲盒 IP 全案）

> SOP 与助手话术真源：[`doc/手伴/skill.md`](../手伴/skill.md)（`ecom-hand-craft-prompts.ts` 运行时读取）

- 入口：`/ecom/hand-craft`；**营销**侧栏；四栏布局与交互对齐「产品主图」（进度轨 + 中间工作区 + 右侧助手）
- 输入：**1～5 张手绘线稿**（第 1 张为主线稿）。换主线稿 = 重启流程，会清空 10 步产出
- 一致性锁定（本模块质量命门，服务端强制拼装，不依赖助手话术）：
  1. 第 1 步定稿主形象写入 `meta.workflow.heroLockedUrl`，后续每步生图 **参考图第 1 张恒为它**
  2. 每条 Prompt 固定拼接 `HAND_CRAFT_BASE_STYLE` 基准风格串
  3. `models` 路由只返回 **支持参考图** 的图像模型（`isRefCapableEcomImageModel`）
- 10 步（`lib/ecom/ecom-hand-craft-steps.ts` 为唯一模板表，前端 `lib/hand-craft-workflow.ts` 只镜像展示字段）：

| # | 步骤 | 类型 | 产出 |
|---|------|------|------|
| 1 | 核心主形象 | generate | 1（定稿后锁为全局参考图） |
| 2 | 基础规范三件套 | generate | 12（三视图 3 + 表情 4 + 动作 5） |
| 3 | 主题盲盒角色卡 | generate | 7（6 款 + 1 合集） |
| 4 | 周边衍生品样机 | generate | 8 |
| 5 | 色卡与细节规范 | generate | 2 |
| 6 | 盲盒包装盒 | generate | 4 |
| 7 | 九宫格表情包 | generate | 9 |
| 8 | 小红书竖版长图 | compose | 1 |
| 9 | 12 页作品集 | compose | 12 |
| 10 | IP 招商授权页 | compose | 1 |

- 第 8–10 步 **不调生图模型**：版式由 `HandCraftSheetView` 用代码排版，浏览器 `html2canvas` 抓 PNG → `POST .../compose/[stepId]` → OSS + `EcomAsset`，与微剧故事版 `sheetPngUrl` 同一条链
- 出图：`POST .../step/[stepId]/generate`（`indexes` / `modelKey` / `concurrency`），逐张回写 `plan`，前端 2.5s 轮询上墙；批量步（12 槽 / 9 槽）按 `imageGenConcurrency` 并发，单张失败不影响其余
- 交付：成图自动入库「我的资产 · 手伴创作」；`GET .../export` 出 ZIP（每步一个目录 + 交付清单 + 助手对话）
- toolKey：`ecom-toolkit__hand-craft`（`generate` / `compose`）；数据表 `EcomHandCraftProject`

## 2. 计费双轨（readme §6）

用户在 **个人中心 · 电商工具箱计费** 选择模式（默认 **BYOK 月费**，降低平台垫资）：

| 模式 | 用户感知 | Gateway | 钱包 |
|------|---------|---------|------|
| **6a PLATFORM_METERED** | 充值 → 按张/秒扣点 | 平台 PLATFORM sk-gw（`ECOM_PLATFORM_GATEWAY_API_KEY_ID`） | reserve / settle |
| **6b BYOK_SERVICE_FEE** | 开通月费 → 云账单自担 | 用户 Personal sk-gw | 仅月费；usage 不扣点 |

**与 Phase D 关系**：tool/canvas 等仍「月费 + BYOK」。仅 `ecom-toolkit__*` 在 6a 下走 Scheme A；非全站回退。

### 切换规则

- 无 `WalletHold(HELD)`、无 RUNNING 生成任务时可切换。
- 6a → 6b：须已开通 `e-commerce-toolkit` 月费并关联 Gateway。
- 6b → 6a：须钱包余额满足预估。

## 3. 准入

| 模式 | 条件 |
|------|------|
| 6a | 钱包余额 + 水位线（可选）；**不要求**月费 |
| 6b | 有效 `UserToolServicePeriod`（navKey `e-commerce-toolkit`）+ Gateway 已关联 |

管理员 SSO 直通。

## 4. 技术

- SSO：`app=e-commerce`
- navKey：`e-commerce-toolkit`
- Gateway 日志：`clientSource=E_COMMERCE`，`clientPage=ecom/{userId}/{workspaceId}/{toolKey}`
- 子应用端口：3007；生产 `ecom.ai-code8.com`

## 5. 月费（6b）

`ToolServiceFeePlan.toolNavKey = e-commerce-toolkit`，首期建议 **4000 点/30 天**（可后台调整）。
