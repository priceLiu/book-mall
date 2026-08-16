# 种草视频 · 实施文档（LLM 交互与多 Skill）

> 配套：[requirements.md](./requirements.md) · [table-format.md](./table-format.md) · Skill Manifest 模板 [manifests/skill-manifest.template.yaml](./manifests/skill-manifest.template.yaml)

## 1. 策划 LLM 唯一入口

```
前端 runAssistant()
  → streamSeedVideoChat()
  → POST /api/sso/tools/ecom/seed-video/projects/:id/assistant/chat
  → Gateway LLM 流式
```

**不算策划 LLM**：视频生成、TTS、OSS 上传、`plan/sync` 本地解析 JSON。

---

## 2. 每次调 LLM 时模型收到什么

| 部分 | 来源 | Skill 分化 |
|------|------|------------|
| System Prompt 主体 | `loadSeedVideoSkillMd(skillKey)` | ✅ 各 Skill 不同 |
| JSON 契约 + 示例 | `buildSeedVideoJsonContract(skillKey)` | ✅ Step4 style 示例按 Skill |
| 运行时上下文 | 时长、画幅、素材数、`buildSeedVideoWorkflowContext({ skillKey })` | ✅ 脚本名、style label 提示 |
| 对话历史 | 全部 user/assistant 消息 | — |
| 素材 Vision | 首条策划或带 `@图片` 的消息 | 点选步骤不带图 |

实现索引：

- `book-mall/lib/ecom/ecom-seed-video-prompts.ts` · `buildSeedVideoSystemPrompt`
- `book-mall/app/api/sso/tools/ecom/seed-video/projects/[id]/assistant/chat/route.ts`

### 2.1 System Prompt 拼装顺序（每次 LLM 调用相同骨架）

每次请求的 **System 消息**由 `buildSeedVideoSystemPrompt()` 组装，结构如下：

```
① skill-{skillKey}.md 全文          ← 角色、流程、口播/镜头规则（Skill 真源）
---
② 运行时上下文                      ← Skill id、时长、画幅、素材张数
③ buildSeedVideoWorkflowContext()  ← 当前进度 + 「下一步须输出什么 step」
④ 界面交互规则摘要                  ← 点选卡片、表头固定等
⑤ buildSeedVideoJsonContract()     ← JSON 契约 + 本 Skill 的 style 示例
```

**User 消息侧**：完整 `chatHistory` + 本条 user 内容。  
**Vision**：仅首条 user 或含 `@图片` 时附带素材图（`shouldAttachSeedVideoChatImages`）；点选卡片步骤不带图。

**默认模型**：`qwen3.8-max`（`project.settings.chatModelKey` 可覆盖）。

---

## 3. 调用大模型步骤与提示词（总表）

> **说明**：下表「System 提示词」指每次请求共享的 System 骨架（§2.1）；**差异**在 `workflowContext` 的「下一步」与 **User 最后一条消息**。  
> 「期望输出」须含用户可读 Markdown + 末尾 ` ```seed-video ` JSON 围栏（见 [table-format.md](./table-format.md)）。

| # | 触发动作 | User 最后一条消息（示例） | workflowContext「下一步」要点 | Vision | 期望 LLM 输出 |
|---|----------|---------------------------|------------------------------|--------|---------------|
| **1** | **开始策划** | 中间工作区 Prompt，如 `@图片1 @图片2 … 生成 3 套脚本，时长约 20 秒` | 素材解析 + 三套脚本；`step=scripts` | ✅ 通常带 | **Markdown**：素材表 + `## 脚本一/二/三` + 分镜表；结尾「请选择脚本：」<br>**JSON**：`step:"scripts"`, `action:"await_script_choice"`, `materialAnalysis` + `scripts`×3 |
| **2** | 点选 **方案①** | `方案①：直接连贯生成视频` | 直接成片参数；`step=directPlan` | ❌ | **Markdown**：直接连贯成片参数（表 A/B）<br>**JSON**：`step:"directPlan"`, `action:"await_direct_plan_confirm"`, `directPlan.shotSequence` + `configTable`（7 键）<br>结尾「请确认成片参数：」 |
| **3** | 点选 **A/B 成片风格**（方案②） | 随 Skill，如 `A方案：甜美种草带货风（小红书）` | 风格已选 → 分镜/正式脚本（Skill 文档要求先 storyboard） | ❌ | **Markdown**：分镜执行表 或 正式逐镜表（含 AI 视频生成提示词列）<br>**JSON**：`step:"storyboard"` + `await_storyboard_review` **或** `step:"formalShots"` + `await_formal_shots_confirm` |
| **4a** | 分镜表 · **重新生成** | `重新生成：请按当前脚本与风格，重新输出视频分镜执行表` | 已选脚本+模式+风格，续推分镜 | ❌ | 新版分镜执行表 + 对应 JSON |
| **4b** | 分镜表 · **改时长** | `修改分镜时长：请优化各镜时长分配并更新分镜执行表` | 同上 | ❌ | 更新时长后的分镜表 + JSON |
| **4c** | 分镜表 · **换 BGM** | `替换 BGM 建议：请给出新的 BGM 推荐并更新制作说明` | 同上 | ❌ | 更新 BGM/制作说明 + JSON |
| **5a** | 逐镜表 · **重新生成** | `重新生成：请重新输出逐镜参数表（镜号/时间切片/AI视频生成提示词）` | `formalShots` | ❌ | 正式逐镜参数表 + `shots` + `configTable` |
| **5b** | 方案① · **重新生成成片参数** | `重新生成：请按当前脚本重新输出直接连贯成片参数` | `directPlan` | ❌ | 新版 directPlan + Markdown |
| **6** | 助手框 **自由输入** | 用户任意补充说明 | 按当前进度推断下一步 | 含 `@图片` 则 ✅ | 按当前 step 续写或修正 |

### 3.1 不调 LLM 的步骤（本地 UI / 解析）

| 用户动作 | 说明 |
|----------|------|
| 上传素材 | 本地 OSS |
| 点选 **脚本** | 本地展示「制作模式」卡片 |
| 点选 **方案②** | 本地插引导语 + A/B 风格卡片（`styleChoicePresets`，**不调 LLM**） |
| **确认**成片参数 / 逐镜参数表 / 分镜→正式脚本 | 本地解析 JSON → sync |
| **修改脚本** | 中间工作区编辑 |
| 生成视频 / TTS / 合成 | Gateway 视频/TTS 模型（**非**策划 LLM） |

点选文案常量见：`e-commerce-toolkit/lib/seed-video-workflow.ts`（`STORYBOARD_REVIEW_CHOICE_MESSAGES` 等）。

### 3.2 方案① / 方案② · LLM 调用顺序

**方案① 直接连贯**

```
LLM#1 开始策划(scripts) → [本地]点脚本 → LLM#2 点方案①(directPlan)
→ [本地]确认 或 LLM 重新生成(directPlan) → [Gateway]生成视频
```

**方案② 精细成片**

```
LLM#1 开始策划(scripts) → [本地]点脚本 → [本地]点方案②+风格卡片
→ LLM#2 点A/B风格(storyboard/formalShots) → [可选]LLM 分镜调整(4a–4c)
→ [本地]确认分镜→正式脚本 → [可选]LLM 逐镜表重生(5a) → [本地]确认同步
→ [Gateway]逐镜视频/TTS/合成
```

### 3.3 JSON step / action 速查

| step | action | 主要 JSON 字段 |
|------|--------|----------------|
| `scripts` | `await_script_choice` | `materialAnalysis`, `scripts`×3 |
| `mode` | `await_mode_choice` | `modeOptions`×2（UI 常本地出卡片） |
| `style` | `await_style_choice` | `styleOptions`×2（UI 常本地出卡片） |
| `directPlan` | `await_direct_plan_confirm` | `directPlan.shotSequence`, `configTable` |
| `storyboard` | `await_storyboard_review` | `shotSequence` |
| `formalShots` | `await_formal_shots_confirm` | `shots`, `configTable` |

---

## 4. 逐步对照：是否调 LLM

### 方案② 精细成片

| # | 用户动作 | 调 LLM？ | 期望 JSON step | UI/卡片来源 | Skill |
|---|----------|----------|----------------|-------------|-------|
| 0 | 上传素材 | ❌ | — | 本地 | — |
| 1 | 开始策划 Prompt | ✅ **#1** | `scripts` | 解析 LLM 回复 | ✅ |
| 2 | 点选脚本 | ❌ | — | 本地「制作模式」 | ✅ `scriptChoiceLabels` |
| 3 | 点选方案② | ❌ | — | **本地**风格引导 + A/B 卡片 | ✅ `styleChoicePresets` |
| 4 | 点选 A/B 成片风格 | ✅ **#2** | `storyboard` / 后续 | LLM 输出 | ✅ id + 文案 |
| 5 | 分镜表 · 重新生成/改时长/换 BGM | ✅ | `storyboard` | LLM | ✅ |
| 5b | 修改脚本 | ❌ | — | 中间工作区编辑 | — |
| 5c | 确认正式脚本 | ❌ | — | 本地 `commitFormalScriptFromRows` | — |
| 6 | 确认/重新生成逐镜参数表 | 确认❌ / 重生✅ | `formalShots` | 本地 sync / LLM | ✅ |
| 7 | 生成视频 / TTS | ❌（策划 LLM） | — | Gateway 视频/TTS | TTS 用 `stylePreset` id |

### 方案① 直接连贯

| # | 用户动作 | 调 LLM？ | 期望 step |
|---|----------|----------|-----------|
| 1 | 开始策划 | ✅ | `scripts` |
| 2 | 点选脚本 | ❌ | — |
| 3 | 点选方案① | ✅ | `directPlan` |
| 4 | 确认/重新生成成片参数 | 确认❌ / 重生✅ | `directPlan` |
| 5 | 生成视频 | ❌ | Gateway |

方案① **无** Step4 成片风格。

---

## 5. 调 LLM 触发清单（代码入口）

| 触发 | 场景 |
|------|------|
| `startPlanningToken` → `handleSend(prompt)` | 首次策划 |
| 用户输入自由文本 | 补充说明 |
| 点选方案① | 出 directPlan |
| 点选 A/B 成片风格（方案②） | 出分镜/正式脚本 |
| 「重新生成」分镜 / 逐镜表 / 成片参数 | 对应 step 重出 |
| 「修改分镜时长」「替换 BGM」 | 带说明调 LLM |

**不调 LLM 的点选**：脚本、方案②（仅展示风格卡片）、确认同步类、修改脚本（进工作区）。

代码：`e-commerce-toolkit/components/seed-video/seed-video-assistant-panel.tsx` · `handleChoice`

---

## 6. 多 Skill 注册表

| skillKey | 文档 | 脚本卡片 | 成片风格 A/B |
|----------|------|----------|--------------|
| `seed-grass` | skill.md | 氛围/痛点/场景（生活方式） | 甜美种草风 / 干练安利风 |
| `fashion-hit` | skill-fashion-hit.md | 氛围/痛点/场景爆款 | 甜美种草带货风 / 强转化干练带货风 |
| `digital-product` | skill-digital-product.md | 视觉/痛点/场景 | 数码分享种草风 / 强转化带货风 |
| `home-clothes-lounge-wear` | skill-home-clothes-lounge-wear.md | 质感治愈/痛点舒适/居家场景 | 温柔治愈风 / 居家带货风 |

注册表（须前后端同步）：

- `book-mall/lib/ecom/ecom-seed-video-skills.ts`
- `e-commerce-toolkit/lib/seed-video-skills.ts`

字段：

- `scriptChoiceLabels` — Step2 脚本点选卡片
- `styleChoicePresets` — Step4 成片风格（`presetId` 固定 `sweet-xhs` / `sharp-douyin`，label/description 按 Skill）

---

## 7. Skill Manifest（面板导入）

YAML 真源目录：`book-mall/doc/种草视频/manifests/*.skill.yaml`

模板：`manifests/skill-manifest.template.yaml`

编译目标（未来脚本 / 人工）：

1. `skill-*.md` — LLM System Prompt
2. 注册表一行 — UI 与 workflow
3. 校验：skillKey、scripts×3、stylePresets×2、无「只输出 JSON」

---

## 8. 固定枚举（所有 Skill 不可改）

- `scripts[].id` = script-1/2/3
- `modeOptions[].id` = direct / fine
- `styleOptions[].id` = sweet-xhs / sharp-douyin
- `configTable` 七键见 table-format.md

垂直差异 **只改 label/口播/镜头规则**，不改 id 与 step 名。

---

## 9. 变更记录

| 日期 | 变更 |
|------|------|
| 2026-08-16 | 新增本文档；成片风格 A/B、脚本引导语、workflow 上下文、Prompt style 示例按 Skill 分化 |
| 2026-08-16 | §3 补充「调用大模型步骤与提示词」总表、System Prompt 拼装顺序、方案①/② LLM 顺序 |
