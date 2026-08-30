# Pro Vertical · 策划交付规格 v1

> 专业版带货（服装/包包/…）统一 JSON 真源。业务规则见各品类 doc（如 `docs/包包.md`）。代码：`book-mall/lib/ecom/ecom-pro-deliverable.ts`。

## 1. 总原则

| 阶段 | 要求 |
|------|------|
| **创作（LLM）** | 按 vertical config 注入规则；分步确认 |
| **交付（JSON）** | `meta.deliverable`，`schemaVersion: "pro-v1"` |
| **Legacy** | `fashion-v4` 读入时归一化为 `pro-v1` |
| **展示** | UI / 导出 / 生图均读 JSON；Markdown 由系统渲染 |

围栏名：` ```pro-deliverable `（兼容 ` ```fashion-deliverable `）

## 2. vertical 注册

| vertical | label | legacy schema |
|----------|-------|---------------|
| `fashion_apparel` | 服装专业版 | `fashion-v4` |
| `bags` | 包包专业版 | — |
| `digital_3c` | 3C数码专业版 | — |

配置：`book-mall/lib/ecom/pro-vertical/registry.ts`

## 3. 顶层 Schema

```typescript
type ProDeliverableV1 = {
  schemaVersion: "pro-v1";
  vertical: "fashion_apparel" | "bags" | "digital_3c"; // 扩展见 registry
  productName: string;
  dimensions: Record<string, string>;
  sellpoints: ProSellpoint[];
  sellpointsLocked: boolean;
  voiceovers: ProVoiceover[];
  selectedVoiceoverId: string | null;
  storyboardVersions?: Partial<Record<"A"|"B"|"C"|"D"|"E", ProStoryboardVersion>>;
  selectedVersion: "A"|"B"|"C"|"D"|"E" | null;
  storyboardLocked?: boolean;
  coverageChecklist: ProCoverageRow[];
  opsPack?: ProOpsPack;
  outputMode: "script_compose" | "direct_video" | null;
};
```

## 4. Panel 行

```typescript
type ProPanelRow = {
  index: 1|2|3|4|5|6;
  shotScale: string;
  durationSec: number;
  cameraMove: string;
  sceneDesc: string;
  scenePrompt: string;
  modelAction: string;
  productFocus: string;  // legacy: garmentFocus 读入时映射
  dialogue?: string;
  toneTexture?: string;
  sellpointIds: string[];
  imagePrompt: string;
  videoPrompt: string;
};
```

UI 列 label 由 `VerticalConfig.panelFocusLabel` 决定（如「包包展示重点」）。

## 5. 七维（按 vertical）

### fashion_apparel

| key | 说明 |
|-----|------|
| genderCategory | 男装 / 女装 / 裙装 |
| styleCategory | 款式品类 |
| styleAttribute | 风格属性 |
| tier | 档次 |
| customScene | 自定义场景 |
| platform | 发布平台 |
| outputLanguage | 输出语言 |

### bags

| key | 说明 |
|-----|------|
| genderCategory | 男包 / 女包 / 中性 |
| styleCategory | 包型品类（托特包、斜挎包…） |
| styleAttribute | 同共享 enum |
| tier | 同共享 |
| customScene | 使用场景（自由输入） |
| platform | 同共享 |
| outputLanguage | 同共享 |

### digital_3c

| key | 说明 |
|-----|------|
| productCategory | 产品大类（可搜索） |
| productSubCategory | 产品细项（随大类级联） |
| designLanguage | 设计语言 |
| tier | 档次 |
| customScene | 使用场景（自由输入） |
| platform | 同共享 |
| outputLanguage | 同共享 |

## 6. 围栏示例（bags）

```pro-deliverable
{
  "schemaVersion": "pro-v1",
  "vertical": "bags",
  "productName": "通勤托特包",
  "dimensions": {
    "genderCategory": "女包",
    "styleCategory": "托特包",
    "styleAttribute": "职场办公",
    "tier": "中端质感",
    "customScene": "通勤",
    "platform": "抖音",
    "outputLanguage": "中文"
  },
  "sellpoints": [{ "id": "S01", "text": "可装13寸电脑", "layer": "core", "source": "ai" }],
  "sellpointsLocked": false,
  "voiceovers": [],
  "selectedVoiceoverId": null,
  "coverageChecklist": [],
  "outputMode": null
}
```

## 7. Internal LLM triggers

- 统一前缀：`pro-step:sellpoints-generate` 等
- 兼容：`fashion-step:*` 对 `fashion_apparel` 仍有效
