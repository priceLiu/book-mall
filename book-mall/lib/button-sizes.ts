/** 全站 Button `size=sm`：最小宽度容纳 5 个汉字（text-sm + px-3×2） */
export const BUTTON_SM_MIN_CLASS = "min-w-[calc(5.5em+1.5rem)]";

export const BUTTON_SIZES = ["sm", "md", "lg"] as const;
export type ButtonSizeTier = (typeof BUTTON_SIZES)[number];
