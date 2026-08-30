import {
  PRO_SHARED_DIMENSION_TAIL,
  PRO_SHOT_SCALE_BY_INDEX,
} from "@/lib/pro-vertical/shared-enums";
import type { ProVerticalConfig } from "@/lib/pro-vertical/types";

const BAG_GENDER = ["男包", "女包", "中性"] as const;

const BAG_TYPES = [
  "托特包",
  "斜挎包",
  "单肩包",
  "双肩包",
  "手提包",
  "手拿包",
  "腰包",
  "水桶包",
  "马鞍包",
  "波士顿包",
  "信封包",
  "箱型包",
  "饺子包",
  "托特购物袋",
  "旅行袋",
  "电脑包",
] as const;

export const BAGS_CONFIG: ProVerticalConfig = {
  id: "bags",
  label: "包包专业版",
  projectTitle: "包包专业版",
  schemaVersion: "pro-v1",
  panelFocusLabel: "包包展示重点",
  productRefAckMessage: "已上传产品图",
  welcomeMessage:
    "我将分步为你全自动制作专业箱包短视频全案，全程右侧交互、左侧实时预览，只需简单选择即可完成成片。请先上传产品图。",
  productRefAdvanceHint:
    "已检测到产品图，无需再点确认。请从下方选择性别定位，开始七维参数采集。",
  dimensionSteps: [
    { key: "genderCategory", label: "性别定位", options: BAG_GENDER },
    { key: "styleCategory", label: "包型品类", options: BAG_TYPES },
    ...PRO_SHARED_DIMENSION_TAIL,
  ],
  mirrorRoles: [
    { index: 1, role: "开篇定调·使用场景氛围", shotScale: PRO_SHOT_SCALE_BY_INDEX[1]! },
    { index: 2, role: "整体外观·包型轮廓", shotScale: PRO_SHOT_SCALE_BY_INDEX[2]! },
    { index: 3, role: "材质细节·皮质/织物质感", shotScale: PRO_SHOT_SCALE_BY_INDEX[3]! },
    { index: 4, role: "五金/工艺·核心卖点特写", shotScale: PRO_SHOT_SCALE_BY_INDEX[4]! },
    { index: 5, role: "使用场景·穿搭搭配", shotScale: PRO_SHOT_SCALE_BY_INDEX[5]! },
    { index: 6, role: "收尾定格·完整种草", shotScale: PRO_SHOT_SCALE_BY_INDEX[6]! },
  ],
  storyboardVersions: [
    { id: "A", title: "A版·上身携带动感版", summary: "模特背着包走路/转身，展示动态背携" },
    { id: "B", title: "B版·细节均衡全能版", summary: "外观+上身+特写全覆盖" },
    { id: "C", title: "C版·场景氛围极致版", summary: "包包融入咖啡馆/办公室/街头/旅行场景" },
    { id: "D", title: "D版·真实日常实拍版", summary: "取物/放物/开合/收纳展示" },
    { id: "E", title: "E版·质感细节强化版", summary: "皮质肌理+五金刻字+缝线边油特写" },
  ],
  imagePromptCategory: "bags",
  characterRefPolicy: "required",
  keywordDimensionKeys: ["styleCategory", "styleAttribute", "platform", "customScene"],
  llmRoleName: "箱包AI短视频专业策划师",
  rulesDocRef: "《包包AI短视频生产规则手册 V1.0》",
  voiceoverTypes: [
    "痛点救场型",
    "质感种草型",
    "场景价值塑造型",
    "氛围审美种草型",
    "实用百搭多背型",
    "情绪体验穿搭型",
  ],
  sellpointVocabHint:
    "皮质/面料、五金件、容量/结构、背携方式、尺寸/重量、耐用性（防水/耐磨/轻量化等）",
  internalTriggerPrefix: "pro-step",
};
