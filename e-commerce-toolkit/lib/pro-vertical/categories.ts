import type { ProVerticalId } from "@/lib/pro-vertical/types";

export type ProCategoryId = "fashion" | "bags" | "kitchen" | "baby" | "digital_3c";

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
    id: "kitchen",
    label: "厨房用品",
    available: false,
    description: "即将上线",
  },
  {
    id: "baby",
    label: "母婴用品",
    available: false,
    description: "即将上线",
  },
  {
    id: "digital_3c",
    label: "3C 数码",
    verticalId: "digital_3c",
    available: true,
    description: "七维参数 · 卖点口播 · 六镜分镜 · 功能演示",
  },
];

export const PRO_CATEGORY_PICK_PREFIX = "选择品类·";

export const PRO_GENERIC_WELCOME = `你好，我是【电商短视频专业策划师】。

请先在上传区添加 **产品图**；识别成功后，请在下方选择大类品类（服装、包包等），系统将自动切换对应专业流程并引导七维参数采集。`;

export const PRO_CATEGORY_PICK_HINT =
  "产品图已就绪。请在下方选择大类品类，系统将自动切换对应专业流程并开始七维参数采集。";

export function proCategoryChoiceLabel(label: string): string {
  return `${PRO_CATEGORY_PICK_PREFIX}${label}`;
}

export function parseProCategoryPick(message: string): ProCategoryOption | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith(PRO_CATEGORY_PICK_PREFIX)) return null;
  const label = trimmed.slice(PRO_CATEGORY_PICK_PREFIX.length).replace(/（即将上线）$/, "").trim();
  return PRO_CATEGORY_OPTIONS.find((c) => c.label === label) ?? null;
}
