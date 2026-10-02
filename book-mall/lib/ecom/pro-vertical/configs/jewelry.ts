import {
  PRO_SHARED_DIMENSION_TAIL,
  PRO_SHOT_SCALE_BY_INDEX,
} from "@/lib/ecom/pro-vertical/shared-enums";
import type { ProVerticalConfig } from "@/lib/ecom/pro-vertical/types";

const JEWELRY_TYPES = [
  "戒指",
  "项链",
  "耳饰",
  "手链",
  "吊坠",
  "胸针",
  "手表（饰品）",
] as const;

export const JEWELRY_CONFIG: ProVerticalConfig = {
  id: "jewelry",
  label: "珠宝专业版",
  projectTitle: "珠宝专业版",
  schemaVersion: "pro-v1",
  panelFocusLabel: "珠宝展示重点",
  productRefAckMessage: "已上传产品图",
  welcomeMessage: "我将分步为你制作珠宝饰品带货短视频，强调佩戴与微距细节。请先上传产品图。",
  productRefAdvanceHint: "已检测到产品图。请从下方选择珠宝品类，开始参数采集。",
  dimensionSteps: [
    { key: "styleCategory", label: "珠宝品类", options: JEWELRY_TYPES },
    ...PRO_SHARED_DIMENSION_TAIL,
  ],
  mirrorRoles: [
    { index: 1, role: "送礼穿搭·痛点引入", shotScale: PRO_SHOT_SCALE_BY_INDEX[1]! },
    { index: 2, role: "整体全貌·礼盒展示", shotScale: PRO_SHOT_SCALE_BY_INDEX[2]! },
    { index: 3, role: "微距材质·镶嵌工艺", shotScale: PRO_SHOT_SCALE_BY_INDEX[3]! },
    { index: 4, role: "佩戴展示·手颈耳", shotScale: PRO_SHOT_SCALE_BY_INDEX[4]! },
    { index: 5, role: "场景氛围·仪式感", shotScale: PRO_SHOT_SCALE_BY_INDEX[5]! },
    { index: 6, role: "收尾定格·完整种草", shotScale: PRO_SHOT_SCALE_BY_INDEX[6]! },
  ],
  storyboardVersions: [
    { id: "A", title: "A版·佩戴特写版", summary: "佩戴部位特写" },
    { id: "B", title: "B版·细节均衡版", summary: "全貌+佩戴+微距" },
    { id: "C", title: "C版·氛围光影版", summary: "光影与仪式感" },
    { id: "D", title: "D版·日常实拍版", summary: "日常佩戴随手拍" },
    { id: "E", title: "E版·工艺微距版", summary: "镶嵌刻字微距" },
  ],
  imagePromptCategory: "jewelry",
  characterRefPolicy: "optional",
  keywordDimensionKeys: ["styleCategory", "styleAttribute", "platform", "customScene"],
  llmRoleName: "珠宝AI短视频专业策划师",
  rulesDocRef: "《珠宝品类·AI短视频生产规则手册 V1.0》",
  voiceoverTypes: [
    "痛点救场型",
    "设计美学型",
    "场景仪式型",
    "工艺细节型",
    "百搭叠戴型",
    "情绪表达型",
  ],
  sellpointVocabHint: "材质、镶嵌、切工、佩戴感、礼盒包装、设计款、叠戴搭配",
  internalTriggerPrefix: "pro-step",
};
