# 微剧故事版 · 策划交付规格 v2

> 权威规格文档。代码实现：`book-mall/lib/ecom/ecom-storyboard-deliverable.ts`、`ecom-storyboard-assistant-prompts.ts`、`ecom-storyboard-deliverable-render.ts`。

## 1. 总原则

| 阶段 | 要求 |
|------|------|
| **创作（LLM 思考）** | 在品类「创意方向域」内**扩展、发挥、结合爆款结构**；鼓励三套方案差异明显；禁止机械套模板 |
| **交付（JSON 输出）** | **JSON 唯一真源**；必须描述清楚：场景、交互、主角、产品、卖点 |
| **展示（系统渲染）** | UI / 导出 / `deliverableMarkdown` 缓存均由系统从 JSON 拼表，**LLM 不写 Markdown 表** |

一句话：**上面宽，下面严。**

---

## 2. 创意方向域（扩展用，非封闭清单）

品类 key：`home_clean` | `beauty` | `digital` | `food` | `fashion` | `general`

每个品类提供三层**方向域**，LLM 须在此范围内交叉组合、自主扩展为具体可拍情景：

| 层 | 作用 |
|----|------|
| **情景方向域** | 从哪类生活场景切入 |
| **爆款结构域** | 3 秒钩子 → 痛点/承接 → 产品介入 → 结果证明 → 促单 |
| **视觉表达域** | 画面气质、景别偏好、UGC 风格 |

### 2.1 各品类方向域摘要

**home_clean**：家务/厨房翻车/收纳/租房/宠物/浴室；尴尬救场、前后对比；高对比快节奏。

**beauty**：通勤/约会急救/换季/熬夜；镜前崩溃、闺蜜安利；柔光肤质特写。

**digital**：通勤降噪/会议/游戏/户外续航/开箱；实测对比、极限挑战；冷静画中画。

**food**：早餐/办公/健身/夜宵/聚会；开箱试吃、成分揭秘；暖色食物特写。

**fashion**：换季/通勤/旅行/社交；穿搭翻车、一衣多穿；街拍/全身镜/功能特写。

**general**：推断最接近分支，在 `creativeBrief.scenarioExpansion` 说明；禁止默认厨卫场景。

### 2.2 三套方案差异

方案一：痛点救场型；方案二：对比实测型；方案三：日常种草型。情景、钩子或人群角度至少两维不同。

---

## 3. 卖点策略

| 优先级 | 来源 | 写入 |
|--------|------|------|
| 1 | 用户参数「卖点 / 产品信息」 | `productSellingPoints[].source = "user"` |
| 2 | 用户只给产品名 | LLM 推导 2–4 条可拍卖点，`source = "inferred"` |
| 3 | 表2 痛点映射 | `source = "painpoint"` |

规则：

- 卖点须**可视觉化**，禁止空泛「高品质、性价比高」
- 格式建议：`{功能/场景} + {用户可感知结果}`
- 全片至少 80% 卖点须在某一镜 `sellpointTags` 或 `imagePrompt` 中体现

---

## 4. JSON Schema v2

### 4.1 顶层

```json
{
  "productName": "灰紫冲锋衣",
  "params": { "市场": "中国", "语言": "中文", "品类": "服饰鞋包" },
  "productSellingPoints": [
    { "id": "sp1", "text": "暴雨环境袖口水珠滚落不渗透", "source": "inferred" },
    { "id": "sp2", "text": "轻量可收纳", "source": "user" }
  ],
  "creativeBrief": {
    "audienceHook": "25–35 岁通勤族，雨雪天户外",
    "viralStructure": "痛点→功能特写→全身证明→促单",
    "scenarioExpansion": "相对 fashion 方向域，展开为城市通勤+突发降雨"
  },
  "cast": [
    {
      "name": "小雅",
      "role": "主角",
      "appearance": "26岁中国女生，齐肩黑发，邻家素颜感；内搭白T+浅蓝牛仔裤（不含主推外套描述）"
    }
  ],
  "analysis": {
    "audience": [
      { "segment": "核心人群A", "description": "..." },
      { "segment": "潜在人群B", "description": "..." }
    ],
    "painPoints": [
      { "level": "功能痛点", "description": "..." },
      { "level": "情绪痛点", "description": "..." },
      { "level": "身份痛点", "description": "..." }
    ],
    "strategies": [
      { "name": "策略1", "hook3s": "...", "middle": "...", "closing": "..." }
    ]
  },
  "schemes": [ ... ]
}
```

### 4.2 每镜 `panels[]`（v2 必填）

| 字段 | 类型 | 说明 |
|------|------|------|
| `index`, `timeline`, `shotType`, `camera`, `scene`, `action` | 同 v1 | 必填 |
| `emotion`, `dialogue`, `durationHintSec` | 同 v1 | 推荐 |
| `productInteraction` | 枚举 | `none` \| `hold` \| `wear` \| `use` \| `apply` \| `display` \| `unbox` |
| `productVisibility` | 枚举 | `off` \| `hint` \| `partial` \| `hero` |
| `sellpointTags` | `string[]` | 引用 `productSellingPoints[].id`，无则 `[]` |
| `imagePrompt` | `string` | 完整中文生图指令 |
| `protagonistBeat`, `productBeat` | `string?` | 检核用，可选 |

### 4.3 `cast.appearance` 品类规则

- **fashion**：只写人物基线（脸/发型/体型/非主推内搭）；**禁止**写主推款（外套/鞋包）颜色款式；产品外观由参考图 + 每镜 `productInteraction` 控制
- **其他品类**：可写日常穿搭，但不与产品 ref 包装冲突

---

## 5. `imagePrompt` 模板（LLM 填空）

```
竖版9:16，写实UGC摄影。
场景：{具体地点、时间、天气、光线}。
主角：{与 cast 一致的外貌基线，本镜表情/姿态}。
产品交互：{productInteraction 中文说明}；{若出现：以参考图1为准}。
本镜卖点：{sellpoint 文本或「无，纯痛点铺垫」}。
禁止：画面文字、水印、与参考图冲突的配色。
```

口播仅写入 `dialogue`，**不得**要求渲染为画面文字。

---

## 6. LLM 交付格式

参数确认后，助手回复结构：

1. **brief**（可选）：每套方案 2–3 句摘要，供聊天气泡阅读
2. **围栏 JSON**：` ```storyboard-deliverable ` … ` ``` `

**禁止** LLM 输出表1/2/3 或分镜 Markdown 表格。

场景微调（「场景参考已确认 |」）：仅更新 JSON 中各镜 `scene` / `imagePrompt`，保持镜数与时长不变。

---

## 7. 系统渲染规范

### 7.1 表1 · 人群画像

| 人群类型 | 画像描述 |

### 7.2 表2 · 三层痛点

| 痛点层级 | 具体描述 |

### 7.3 表3 · 爆款策略

| 策略 | 3秒钩子 | 中段承接 | 结尾话术 |

### 7.4 分镜表

| 镜号 | 时间轴 | 景别 | 运镜 | 场景 | 动作 | 产品交互 | 卖点 | 情绪 | 口播 |

实现：`ecom-storyboard-deliverable-render.ts`（Markdown）、`StoryboardDeliverableTables`（React）。

---

## 8. Legacy 兼容

- 旧 deliverable 含 `analysis.audienceMarkdown` 等：renderer / UI **只读**展示，不写入新交付
- 旧项目仅 `deliverableMarkdown`：`parseStoryboardSchemesFromMarkdown` 兜底（`@deprecated`）
- 旧 sheet 无 `imagePrompt`：生图 fallback `buildStoryboardPanelImagePrompt` 模板拼装

---

## 9. 变更记录

| 版本 | 变更 |
|------|------|
| v0.1 | LLM 输出 Markdown 表 + JSON 双轨；analysis 存 Markdown 字符串 |
| **v2** | JSON 唯一真源；结构化 analysis；每镜 productInteraction / imagePrompt / sellpointTags；系统拼表 |

---

## 10. 验收标准

1. 新交付 assistant 回复不含 Markdown 表，仅 brief + JSON
2. 右侧策划区与 `meta.deliverable` 一致，刷新不漂移
3. 生图 Gateway 使用 `panel.imagePrompt`（新交付）
4. 旧项目仍可打开、parse、生图
5. ZIP 导出 Markdown 由 renderer 生成
