# 种草视频 · 产品需求（多 Skill）

> **JSON 契约（全 Skill 共用）**：同目录 [`table-format.md`](./table-format.md)  
> **调用大模型步骤与提示词**：[`implementation.md`](./implementation.md) §3  
> **System Prompt 真源**：各 Skill 的 `skill*.md`（`ecom-seed-video-skills.ts` 注册表 + `ecom-seed-video-prompts.ts` 运行时读取）

## 1. 定位

电商工具箱 **图片生种草视频** 工作台：用户上传商品/穿搭素材，经 LLM Skill 策划脚本与镜头，支持 **方案① 直接连贯成片** 或 **方案② 逐镜 I2V + TTS + 合成**。

**多 Skill 架构**：流程引擎与 JSON 契约统一；不同 Skill 仅改变策划 Prompt（角色、解析维度、三套脚本角度、口播语气）。

## 2. 入口

| 项 | 值 |
|----|-----|
| 技术 id | `seed-video` |
| 路由 | `/ecom/seed-video` |
| 侧栏 | 电商 · 种草视频 |

## 3. Skill 列表

| skillKey | 名称 | Skill 文档 | 说明 |
|----------|------|------------|------|
| `seed-grass` | 种草短视频 | [`skill.md`](./skill.md) | 默认；生活方式种草、度假氛围等 |
| `fashion-hit` | 服装爆款带货 | [`skill-fashion-hit.md`](./skill-fashion-hit.md) | 服装带货钩子、痛点/场景爆款视角 |
| `digital-product` | 3C 数码带货 | [`skill-digital-product.md`](./skill-digital-product.md) | 外观种草、痛点转化、场景实用 |
| `home-clothes-lounge-wear` | 家居服带货 | [`skill-home-clothes-lounge-wear.md`](./skill-home-clothes-lounge-wear.md) | 软糯质感、居家痛点、场景实穿 |

## 4. 新建项目

1. 空态「开始创作」或工具栏「新建」→ **Skill 选择弹层**（卡片单选）
2. 选定 Skill 后创建项目，写入 `settings.skillKey`（**创建后不可切换**）
3. 默认标题取自注册表 `defaultTitle`

**兼容**：历史项目无 `skillKey` → 运行时视为 `seed-grass`。

## 5. 交互流程（全 Skill 共用）

```
上传素材 + 填写策划 Prompt
    → 助手 Step2：仅 ```seed-video JSON（materialAnalysis + scripts×3；系统渲染）
    → 点选脚本
    → 点选制作模式（direct / fine）
    → [fine] 点选成片风格（sweet-xhs / sharp-douyin）
    → directPlan 或 storyboard → formalShots
    → 同步中间工作区 → 生成成片
```

## 6. 结构化交付

- 每条助手回复末尾 **必须** 有 ` ```seed-video ` 围栏 JSON
- Zod 校验：`book-mall/lib/ecom/ecom-seed-video-structured.ts`
- **不因 Skill 改变 JSON 字段名或 step 枚举**

## 7. 服装 Skill 与种草的差异（仅 Prompt）

| 维度 | seed-grass | fashion-hit | digital-product | home-clothes-lounge-wear |
|------|------------|-------------|-----------------|--------------------------|
| 角色 | 种草短视频策划助理 | 爆款服装带货策划助理 | 3C 数码爆款带货策划助理 | 家居服爆款带货策划助理 |
| 素材解析 | 商品概述、卖点、场景氛围 | 品类/版型/面料/颜色、带货钩子 | 品类/型号/规格、数码痛点与场景 | 款式/面料/花色、居家舒适卖点 |
| 三套角度 | 氛围感/痛点/场景（生活方式） | 氛围感爆款/痛点爆款/场景爆款 | 视觉体验/痛点解决/场景实用 | 质感治愈/痛点舒适/居家场景 |
| 口播 | 相对文艺种草 | 短句、强钩子、带货语气 | 短句、参数/痛点钩子 | 软糯治愈、强共鸣钩子 |
| 成片风格 A/B | 甜美种草风 / 干练安利风 | 甜美种草带货风 / 强转化干练带货风 | 数码分享种草风 / 强转化带货风 | 温柔治愈风 / 居家带货风 |
| 精细模式 | 可变镜数 | 建议 4 镜 | 建议 4 镜 | 建议 4 镜 |

## 8. 非目标

- 不为每个 Skill 单独建 Prisma 表或 JSON schema
- 项目创建后不支持切换 Skill（需新建项目）
- 不在本需求内实现更多垂直 Skill（新增 Skill 仅增 md + 注册表一行）

## 9. 实现索引

| 层 | 路径 |
|----|------|
| **实施 / LLM 交互** | [`implementation.md`](./implementation.md) |
| Skill 注册表 | `book-mall/lib/ecom/ecom-seed-video-skills.ts` |
| Prompt 构建 | `book-mall/lib/ecom/ecom-seed-video-prompts.ts` |
| 创建 API | `POST .../seed-video/projects` body: `{ title?, skillKey? }` |
| 前端选择器 | `e-commerce-toolkit/components/seed-video/seed-video-skill-picker-dialog.tsx` |
