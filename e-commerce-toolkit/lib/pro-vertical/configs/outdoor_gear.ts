import {
  PRO_SHARED_DIMENSION_TAIL,
  PRO_SHOT_SCALE_BY_INDEX,
} from "@/lib/pro-vertical/shared-enums";
import type { ProVerticalConfig } from "@/lib/pro-vertical/types";

const OUTDOOR_TYPES = [
  "帐篷",
  "睡袋",
  "登山杖",
  "户外炉具",
  "露营灯",
  "户外背包",
  "户外穿戴",
  "水具",
] as const;

export const OUTDOOR_GEAR_CONFIG: ProVerticalConfig = {
  id: "outdoor_gear",
  label: "户外用品专业版",
  projectTitle: "户外用品专业版",
  schemaVersion: "pro-v1",
  panelFocusLabel: "户外产品展示重点",
  productRefAckMessage: "已上传产品图",
  welcomeMessage: "我将分步为你制作户外用品带货短视频，强调功能实操与真实场景。请先上传产品图。",
  productRefAdvanceHint: "已检测到产品图。请从下方选择户外品类，开始参数采集。",
  dimensionSteps: [
    { key: "styleCategory", label: "户外品类", options: OUTDOOR_TYPES },
    ...PRO_SHARED_DIMENSION_TAIL,
  ],
  mirrorRoles: [
    { index: 1, role: "户外痛点·场景引入", shotScale: PRO_SHOT_SCALE_BY_INDEX[1]! },
    { index: 2, role: "整体全貌·装备展示", shotScale: PRO_SHOT_SCALE_BY_INDEX[2]! },
    { index: 3, role: "材质结构·细节特写", shotScale: PRO_SHOT_SCALE_BY_INDEX[3]! },
    { index: 4, role: "功能实操·搭建收纳", shotScale: PRO_SHOT_SCALE_BY_INDEX[4]! },
    { index: 5, role: "真实户外·使用场景", shotScale: PRO_SHOT_SCALE_BY_INDEX[5]! },
    { index: 6, role: "收尾定格·种草闭环", shotScale: PRO_SHOT_SCALE_BY_INDEX[6]! },
  ],
  storyboardVersions: [
    { id: "A", title: "A版·实操演示版", summary: "搭建/收纳/使用演示" },
    { id: "B", title: "B版·细节均衡版", summary: "全貌+结构+实操" },
    { id: "C", title: "C版·山野氛围版", summary: "露营山野沉浸" },
    { id: "D", title: "D版·真实露营实拍版", summary: "现场随手拍" },
    { id: "E", title: "E版·结构工艺版", summary: "结构与做工特写" },
  ],
  imagePromptCategory: "outdoor_gear",
  characterRefPolicy: "optional",
  keywordDimensionKeys: ["styleCategory", "styleAttribute", "customScene", "platform"],
  llmRoleName: "户外用品AI短视频专业策划师",
  rulesDocRef: "《户外用品品类·AI短视频生产规则手册 V1.0》",
  voiceoverTypes: [
    "痛点救场型",
    "硬核功能型",
    "轻量便携型",
    "场景沉浸型",
    "耐用实测型",
    "情绪自由型",
  ],
  sellpointVocabHint: "防风防水、轻量、承重、速开、收纳体积、耐用、温控、便携",
  internalTriggerPrefix: "pro-step",
};
