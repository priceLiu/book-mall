import {
  PRO_SHARED_DIMENSION_TAIL,
  PRO_SHOT_SCALE_BY_INDEX,
} from "@/lib/ecom/pro-vertical/shared-enums";
import type { ProVerticalConfig } from "@/lib/ecom/pro-vertical/types";

const FASHION_GENDER = ["男装", "女装", "裙装"] as const;

const FASHION_STYLE_CATEGORIES = [
  "T恤",
  "衬衫",
  "卫衣",
  "针织衫",
  "毛衣",
  "背心",
  "吊带",
  "打底内搭",
  "夹克",
  "风衣",
  "大衣",
  "防晒衣",
  "冲锋衣",
  "西裤",
  "休闲裤",
  "牛仔裤",
  "阔腿裤",
  "半身裙",
  "吊带裙",
  "西装裙",
  "针织裙",
  "连衣裙",
  "两件套",
  "运动套装",
  "西装套装",
] as const;

export const FASHION_APPAREL_CONFIG: ProVerticalConfig = {
  id: "fashion_apparel",
  label: "服装专业版",
  projectTitle: "服装专业版",
  schemaVersion: "fashion-v4",
  legacySchemaVersion: "fashion-v4",
  panelFocusLabel: "服装展示重点",
  productRefAckMessage: "已上传产品图",
  welcomeMessage:
    "我将分步为你全自动制作专业服装短视频全案，全程右侧交互、左侧实时预览，只需简单选择即可完成成片。请先上传产品图。",
  productRefAdvanceHint:
    "已检测到产品图，无需再点确认。请从下方选择性别品类，开始七维参数采集。",
  dimensionSteps: [
    { key: "genderCategory", label: "性别品类", options: FASHION_GENDER },
    { key: "styleCategory", label: "款式品类", options: FASHION_STYLE_CATEGORIES },
    ...PRO_SHARED_DIMENSION_TAIL.map((s) =>
      s.key === "customScene" ? { ...s, label: "自定义场景" } : s,
    ),
  ],
  mirrorRoles: [
    { index: 1, role: "开篇定调·场景氛围", shotScale: PRO_SHOT_SCALE_BY_INDEX[1]! },
    { index: 2, role: "整体外观·服装轮廓", shotScale: PRO_SHOT_SCALE_BY_INDEX[2]! },
    { index: 3, role: "材质细节·面料质感", shotScale: PRO_SHOT_SCALE_BY_INDEX[3]! },
    { index: 4, role: "工艺/卖点·核心特写", shotScale: PRO_SHOT_SCALE_BY_INDEX[4]! },
    { index: 5, role: "穿搭场景·搭配展示", shotScale: PRO_SHOT_SCALE_BY_INDEX[5]! },
    { index: 6, role: "收尾定格·完整种草", shotScale: PRO_SHOT_SCALE_BY_INDEX[6]! },
  ],
  storyboardVersions: [
    { id: "A", title: "A版·上身动效版", summary: "模特穿着走路/转身，展示动态穿搭" },
    { id: "B", title: "B版·细节均衡全能版", summary: "外观+上身+特写全覆盖" },
    { id: "C", title: "C版·场景氛围极致版", summary: "服装融入场景，AI 动态生成" },
    { id: "D", title: "D版·真实日常实拍版", summary: "生活化穿着场景" },
    { id: "E", title: "E版·质感细节强化版", summary: "面料肌理+工艺极致特写" },
  ],
  imagePromptCategory: "fashion",
  characterRefPolicy: "required",
  keywordDimensionKeys: ["styleCategory", "styleAttribute", "platform", "customScene"],
  llmRoleName: "服装AI短视频专业策划师",
  rulesDocRef: "《服装AI短视频生产规则手册 V4.4》",
  voiceoverTypes: [
    "痛点救场型",
    "质感种草型",
    "场景价值塑造型",
    "氛围审美种草型",
    "实用百搭多穿型",
    "情绪体验穿搭型",
  ],
  sellpointVocabHint:
    "面料/版型/工艺/颜色/搭配/舒适度/显瘦/透气/抗皱/易打理等服装维度",
  internalTriggerPrefix: "fashion-step",
};
