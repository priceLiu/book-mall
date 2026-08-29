# 服装专业版 · 策划交付规格 v4

> 权威技术规格。业务规则见 `docs/服装电商.md` V4.4。代码：`book-mall/lib/ecom/ecom-fashion-deliverable.ts`。

## 1. 总原则

| 阶段 | 要求 |
|------|------|
| **创作（LLM）** | 严格遵从 V4.4：七维参数、卖点分层、6 镜、A–E 五版、运镜枚举 |
| **交付（JSON）** | **唯一真源** `meta.deliverable`，`schemaVersion: "fashion-v4"` |
| **展示** | UI / 导出 / 生图 / 成片均读 JSON；`deliverableMarkdown` 由系统渲染 |

围栏名：` ```fashion-deliverable `

## 2. 顶层 Schema

```typescript
type FashionDeliverableV4 = {
  schemaVersion: "fashion-v4";
  vertical: "fashion_apparel";
  productName: string;
  dimensions: FashionSevenDimensions;
  sellpoints: FashionSellpoint[];
  sellpointsLocked: boolean;
  voiceovers: FashionVoiceover[];
  selectedVoiceoverId: string | null;
  storyboardVersions: Partial<Record<"A"|"B"|"C"|"D"|"E", FashionStoryboardVersion>>;
  selectedVersion: "A"|"B"|"C"|"D"|"E" | null;
  coverageChecklist: FashionCoverageRow[];
  opsPack?: FashionOpsPack;
  outputMode: "script_compose" | "direct_video" | null;
};
```

## 3. 七维参数

| 字段 | 类型 | 枚举/说明 |
|------|------|-----------|
| genderCategory | enum | 男装 / 女装 / 裙装 |
| styleCategory | string | V4.4 款式列表 |
| styleAttribute | enum | 职场办公 / 日常休闲 / … |
| tier | enum | 平价刚需 / 中端质感 / 高端轻奢 |
| customScene | string | 用户或 AI 推荐 |
| platform | enum | 淘宝 / 抖音 / … |
| outputLanguage | enum | 中文 / 英文 / … |

## 4. 卖点

```typescript
type FashionSellpoint = {
  id: string;       // S01…
  text: string;
  layer: "core" | "visual" | "aux";
  source: "user" | "ai" | "supplemented";
};
```

## 5. 口播（6 套）

```typescript
type FashionVoiceover = {
  id: string;       // V01…V06
  type: string;     // 痛点救场型 / 质感种草型 / …
  narrative: string;
  script: string;
};
```

## 6. 分镜（A–E，每版 6 镜）

```typescript
type FashionPanelRow = {
  index: 1|2|3|4|5|6;
  shotScale: string;
  durationSec: number;   // 3–7，0.5 精度
  cameraMove: string;    // 第七章枚举
  sceneDesc: string;     // 12–25 字
  modelAction: string;   // 10–22 字
  garmentFocus: string;
  dialogue: string;      // 单镜 12–25 字，全片 ≤100
  toneTexture: string;
  sellpointIds: string[];
  imagePrompt: string;
};
```

景别曲线（镜 1–6）：全景/中全景 → 中全景/中景 → 中近景/近景 → 近景/特写 → 中景 → 中全景

## 7. LLM 分阶段 Trigger（内部，不展示气泡）

| Trigger 前缀 | 阶段 | 写入字段 |
|--------------|------|----------|
| `fashion-step:sellpoints-generate` | 卖点 AI 生成 | sellpoints |
| `fashion-step:voiceovers-generate` | 6 套口播 | voiceovers |
| `fashion-step:storyboards-generate` | A–E 五套 | storyboardVersions, coverageChecklist |
| `fashion-step:ops-generate` | 运营包 | opsPack |

## 8. workflow 状态（仅存于 meta.workflow）

```typescript
fashionPhase:
  | "product_ref"
  | "dimensions"      // dimensionStep 0..6
  | "sellpoints"
  | "voiceover_pick"
  | "storyboard_pick"
  | "storyboard_confirm"
  | "ops_pack"
  | "output_mode"
  | "produce"
  | "done";
vertical: "fashion_apparel";
```

## 9. 与 StoryboardSheet 映射

`fashionVersionToSheet()` 将选定版本的 6 镜映射为 `StoryboardSheet.panels[]`（scene/action/dialogue/imagePrompt/durationHintSec）。
