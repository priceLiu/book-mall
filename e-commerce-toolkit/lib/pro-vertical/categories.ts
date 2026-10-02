import type { ProVerticalId } from "@/lib/pro-vertical/types";

export type ProCategoryId =
  | "fashion"
  | "bags"
  | "digital_3c"
  | "footwear"
  | "jewelry"
  | "outdoor_gear"
  | "loungewear"
  | "kitchen"
  | "baby";

export type ProCategoryOption = {
  id: ProCategoryId;
  label: string;
  verticalId?: ProVerticalId;
  available: boolean;
  description: string;
};

/** 会话区大类选择（上传产品图后出现） */
export const PRO_CATEGORY_OPTIONS: ProCategoryOption[] = [
  {
    id: "fashion",
    label: "服装",
    verticalId: "fashion_apparel",
    available: true,
    description: "七维参数 · 卖点口播 · 六镜分镜 · 服装展示",
  },
  {
    id: "bags",
    label: "包包",
    verticalId: "bags",
    available: true,
    description: "七维参数 · 卖点口播 · 六镜分镜 · 包袋背携",
  },
  {
    id: "digital_3c",
    label: "3C 数码",
    verticalId: "digital_3c",
    available: true,
    description: "七维参数 · 卖点口播 · 六镜分镜 · 功能演示",
  },
  {
    id: "footwear",
    label: "鞋子",
    verticalId: "footwear",
    available: true,
    description: "上脚走步 · 鞋底工艺 · 六镜分镜",
  },
  {
    id: "jewelry",
    label: "珠宝",
    verticalId: "jewelry",
    available: true,
    description: "佩戴微距 · 工艺细节 · 六镜分镜",
  },
  {
    id: "outdoor_gear",
    label: "户外用品",
    verticalId: "outdoor_gear",
    available: true,
    description: "功能实操 · 户外场景 · 六镜分镜",
  },
  {
    id: "loungewear",
    label: "家居服",
    verticalId: "loungewear",
    available: true,
    description: "居家亲肤 · 上身治愈 · 六镜分镜",
  },
  {
    id: "kitchen",
    label: "厨房用品",
    verticalId: "kitchenware",
    available: true,
    description: "厨具实操 · 居家厨房 · 六镜分镜",
  },
  {
    id: "baby",
    label: "母婴用品",
    verticalId: "baby_maternal",
    available: true,
    description: "安全材质 · 实操演示 · 六镜分镜",
  },
];

export const PRO_CATEGORY_PICK_PREFIX = "选择品类·";

export const PRO_GENERIC_WELCOME = `你好，我是【电商短视频专业策划师】。

请先在上传区添加 **产品图**；识别成功后，请在下方选择大类品类，系统将自动切换对应专业流程并引导参数采集。`;

export const PRO_CATEGORY_PICK_HINT =
  "产品图已就绪。请在下方选择大类品类，系统将自动切换对应专业流程并开始参数采集。";

export function proCategoryChoiceLabel(label: string): string {
  return `${PRO_CATEGORY_PICK_PREFIX}${label}`;
}

export function parseProCategoryPick(message: string): ProCategoryOption | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith(PRO_CATEGORY_PICK_PREFIX)) return null;
  const label = trimmed.slice(PRO_CATEGORY_PICK_PREFIX.length).replace(/（即将上线）$/, "").trim();
  return PRO_CATEGORY_OPTIONS.find((c) => c.label === label) ?? null;
}
