import {
  PRO_OUTPUT_LANGUAGES,
  PRO_PLATFORMS,
  PRO_SHOT_SCALE_BY_INDEX,
} from "@/lib/ecom/pro-vertical/shared-enums";
import type { ProVerticalConfig } from "@/lib/ecom/pro-vertical/types";

export const DIGITAL_PRODUCT_CATEGORIES = [
  "手机",
  "耳机",
  "智能手表",
  "平板",
  "笔记本电脑",
  "充电器",
  "移动电源",
  "数据线",
  "手机壳",
  "屏幕贴膜",
  "支架",
  "音箱",
  "智能手环",
  "相机",
  "无人机",
  "游戏手柄",
  "键盘",
  "鼠标",
  "散热器",
] as const;

export const DIGITAL_DESIGN_LANGUAGES = [
  "极简科技",
  "硬核电竞",
  "商务沉稳",
  "潮流时尚",
  "户外硬核",
  "复古胶片",
  "未来感",
] as const;

export const DIGITAL_TIERS = ["平价性价比", "中端均衡", "高端旗舰"] as const;

/** 产品大类 → 细项（文档 §1 + 常见子类） */
export const DIGITAL_SUBCATEGORIES_BY_CATEGORY: Record<string, readonly string[]> = {
  手机: ["旗舰机", "中端机", "折叠屏", "游戏手机", "拍照手机", "通用"],
  耳机: ["入耳式", "头戴式", "开放式", "骨传导", "降噪耳机", "运动耳机", "通用"],
  智能手表: ["运动手表", "商务手表", "儿童手表", "通用"],
  平板: ["学习平板", "创作平板", "游戏平板", "通用"],
  笔记本电脑: ["轻薄本", "游戏本", "商务本", "创作本", "通用"],
  充电器: ["快充头", "多口充电器", "无线充电器", "车载充电器", "通用"],
  移动电源: ["大容量", "轻薄便携", "磁吸充电宝", "通用"],
  数据线: ["Type-C", "Lightning", "三合一", "编织线", "通用"],
  手机壳: ["防摔壳", "透明壳", "磁吸壳", "通用"],
  屏幕贴膜: ["钢化膜", "水凝膜", "防窥膜", "通用"],
  支架: ["桌面支架", "车载支架", "磁吸支架", "通用"],
  音箱: ["蓝牙音箱", "智能音箱", "便携音箱", "通用"],
  智能手环: ["运动手环", "健康监测", "通用"],
  相机: ["运动相机", "微单", "卡片机", "通用"],
  无人机: ["航拍无人机", "穿越机", "通用"],
  游戏手柄: ["无线手柄", "有线手柄", "通用"],
  键盘: ["机械键盘", "薄膜键盘", "无线键盘", "通用"],
  鼠标: ["游戏鼠标", "办公鼠标", "无线鼠标", "通用"],
  散热器: ["手机散热器", "笔记本散热器", "通用"],
};

export const DIGITAL_3C_CONFIG: ProVerticalConfig = {
  id: "digital_3c",
  label: "3C数码专业版",
  projectTitle: "3C数码专业版",
  schemaVersion: "pro-v1",
  panelFocusLabel: "产品展示重点",
  productRefAckMessage: "已上传产品图",
  welcomeMessage:
    "我将分步为你全自动制作专业3C数码短视频全案，全程右侧交互、左侧实时预览，只需简单选择即可完成成片。请先上传产品图。",
  productRefAdvanceHint:
    "已检测到产品图，无需再点确认。请从下方选择产品大类，开始七维参数采集。",
  dimensionSteps: [
    {
      key: "productCategory",
      label: "产品大类",
      options: DIGITAL_PRODUCT_CATEGORIES,
      ui: "searchSelect",
    },
    {
      key: "productSubCategory",
      label: "产品细项",
      ui: "searchSelect",
      parentKey: "productCategory",
      subOptionsMap: DIGITAL_SUBCATEGORIES_BY_CATEGORY,
    },
    {
      key: "designLanguage",
      label: "设计语言",
      options: DIGITAL_DESIGN_LANGUAGES,
    },
    {
      key: "tier",
      label: "档次定位",
      options: DIGITAL_TIERS,
    },
    { key: "customScene", label: "使用场景", freeText: true },
    { key: "platform", label: "发布平台", options: PRO_PLATFORMS },
    { key: "outputLanguage", label: "输出语言", options: PRO_OUTPUT_LANGUAGES },
  ],
  mirrorRoles: [
    { index: 1, role: "开篇钩子·产品亮相", shotScale: PRO_SHOT_SCALE_BY_INDEX[1]! },
    { index: 2, role: "整体外观·工业设计", shotScale: PRO_SHOT_SCALE_BY_INDEX[2]! },
    { index: 3, role: "材质工艺·细节特写", shotScale: PRO_SHOT_SCALE_BY_INDEX[3]! },
    { index: 4, role: "核心功能·动态演示", shotScale: PRO_SHOT_SCALE_BY_INDEX[4]! },
    { index: 5, role: "场景植入·真实使用", shotScale: PRO_SHOT_SCALE_BY_INDEX[5]! },
    { index: 6, role: "收尾定格·品牌落版", shotScale: PRO_SHOT_SCALE_BY_INDEX[6]! },
  ],
  storyboardVersions: [
    { id: "A", title: "A版·开箱惊艳版", summary: "开箱第一秒建立期待，强调拿到手的视觉冲击" },
    { id: "B", title: "B版·功能演示版", summary: "逐一演示核心功能，强调它到底能干什么" },
    { id: "C", title: "C版·场景沉浸版", summary: "产品融入真实使用环境，强调在什么情况下用" },
    { id: "D", title: "D版·实测挑战版", summary: "真实环境极限测试，强调真实不虚标" },
    { id: "E", title: "E版·设计美学版", summary: "材质/工艺/工业设计细节极致展示" },
  ],
  imagePromptCategory: "digital_3c",
  characterRefPolicy: "optional",
  keywordDimensionKeys: ["productCategory", "designLanguage", "platform", "customScene"],
  llmRoleName: "3C数码AI短视频专业策划师",
  rulesDocRef: "《3C数码AI短视频生产规则手册 V1.0》",
  voiceoverTypes: [
    "痛点爆破型",
    "硬核参数型",
    "场景种草型",
    "颜值种草型",
    "性价比说服型",
    "使用体验型",
  ],
  sellpointVocabHint:
    "芯片/性能、屏幕/显示、电池/续航、连接/传输、音频/降噪、材质/工艺、重量/便携、智能/交互",
  internalTriggerPrefix: "pro-step",
};
