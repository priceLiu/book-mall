# 品牌 VI · 表情包 · 产品需求

- **创建日期**：2026-10-02
- **入口**：`/brand/vi`（电商工具箱 · 营销侧栏）
- **toolKey**：`ecom-toolkit__vi`（`generate` / `compose`）
- **对话与 Prompt 真源**：[`docs/品牌VI与表情包.md`](../../../docs/品牌VI与表情包.md)
- **助手 Skill**：[`doc/ecom/brand-vi/skill.md`](./brand-vi/skill.md)
- **实施计划**：[`doc/plans/2026-10-brand-vi-hand-craft.md`](../plans/2026-10-brand-vi-hand-craft.md)

## 1. 一句话说明

用户上传角色参考图或填写品牌/角色文字描述，在 **分步确认** 流程中生成商用 IP 视觉资产：基准形象、三视图、九宫格表情包、Logo、周边样机、场景海报、VI 规范页与作品集长图。交互壳层与 **手办创作** 一致（进度轨 + 中栏槽位/拼版 + 右侧助手卡片）。

## 2. 输入

- **方式 A**：1～3 张参考图（线稿、立绘、头像）
- **方式 B**：文字 brief（品牌名称、角色气质、主色偏好）
- **产出模式**（单选，收缩进度轨）：基础 IP / 表情包专项 / VI 专项 / 文创专项 / 完整全案
- **视觉风格**（单选 + 可选自定义）：Q 版潮玩 / 极简扁平 / 国潮 / 赛博朋克 / 自定义

## 3. 步骤模板

| # | stepId | 类型 | 产出 | 可见模式 |
|---|--------|------|------|----------|
| 1 | hero | generate | 基准 IP 1 张 | 全部 |
| 2 | turnaround | generate | 三视图 3 张 | 基础 IP、完整全案 |
| 3 | emoji | generate | 九宫格 9 张 | 基础 IP、表情包专项、完整全案 |
| 4 | logo | generate | Logo 1～2 张 | VI 专项、完整全案 |
| 5 | merch | generate | 周边样机 8 张 | 文创专项、完整全案 |
| 6 | poster | generate | 场景海报 1～4 张 | 文创专项、完整全案 |
| 7 | vi-spec | compose | VI 规范页 1 张 | VI 专项、完整全案 |
| 8 | portfolio | compose | 竖版作品集 1 张 | 完整全案 |

## 4. 一致性（服务端强制）

1. 第 1 步定稿写入 `meta.workflow.heroLockedUrl`，后续生图参考图第 1 张恒为基准形象
2. 每条槽位 Prompt 拼接 **动态风格串**（非写死示例角色配饰）
3. `models` 仅返回支持参考图的 IMAGE 模型

## 5. 验收标准

1. 无参考图仅凭 brief 可生成并确认基准形象
2. 五种模式下进度轨步骤与上表一致；不可生成隐藏步
3. 助手使用 `SeedVideoAssistantChoiceCards`（选中态 + 历史只读）
4. 槽位与大图预览可编辑 Prompt；与同页其他 Dialog 并存不崩溃（nativeOverlay）
5. 成图入库「我的资产 · 品牌 VI」；ZIP 导出含交付清单
6. 管理后台 `/admin/pending-features` 可见 VI-101～VI-118

## 6. 待处理任务（与 seed 脚本一致）

| ID | 说明 |
|----|------|
| VI-101 | Prisma `EcomBrandViProject` + 迁移落库 |
| VI-102 | `ecom-brand-vi-steps` 八步模板与 Prompt 拼装 |
| VI-103 | 风格预设 + brief 字段 + 模式过滤步骤 |
| VI-104 | `ecom-brand-vi-service` CRUD / hero 锁 / 换风格重置 |
| VI-105 | 生图 `step/generate` + 参考图解析 |
| VI-106 | 助手 chat + plan/sync |
| VI-107 | compose vi-spec / portfolio + proxy-image |
| VI-108 | export ZIP + 资产库 module `vi` |
| VI-109 | SSO API 路由全集 |
| VI-110 | 前端 `BrandViStudio` + `/brand/vi` 页 |
| VI-111 | 中栏 brief 表单 + 参考图上传 |
| VI-112 | 助手卡片 + 模式/风格选择 |
| VI-113 | workflow drafts / share / library 登记 |
| VI-114 | `ProductDesignPromptDialog` nativeOverlay 接入 |
| VI-115 | 价目 baseline `ecom-toolkit__vi` 更新 |
| VI-116 | skill.md + prompts 运行时读取 |
| VI-117 | 单元测试（风格/模式/步骤） |
| VI-118 | 产品文档 §品牌 VI + schema-changelog |

## 7. 非目标（后续迭代）

- 12 页 PDF 作品集、招商授权页、透明底 PNG 自动抠图、动态表情包
