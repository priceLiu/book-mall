import { cn } from "@/lib/utils";

/** 电商工具箱主按钮尺寸（仅 sm | md | lg 三档；同一页面最多用两档，见 design/BUTTON.md） */
export const ECOM_BUTTON_SIZES = ["sm", "md", "lg"] as const;
export type EcomButtonSize = (typeof ECOM_BUTTON_SIZES)[number];

/** 最小档：内容区至少容纳 5 个汉字（text-sm + 左右 padding） */
export const ECOM_BTN_SM_MIN_CLASS = "min-w-[calc(5.5em+1.5rem)]";

export const ecomButtonSizeClasses: Record<
  EcomButtonSize,
  { pill: string; secondary: string }
> = {
  sm: {
    pill: cn("px-4 py-2 text-sm", ECOM_BTN_SM_MIN_CLASS),
    secondary: cn("px-4 py-2 text-sm", ECOM_BTN_SM_MIN_CLASS),
  },
  md: {
    pill: "px-5 py-2.5 text-sm",
    secondary: "px-5 py-2.5 text-sm",
  },
  lg: {
    pill: "px-6 py-3 text-base",
    secondary: "px-6 py-3 text-base",
  },
};

export function ecomButtonSizeClass(size: EcomButtonSize, kind: "pill" | "secondary" = "pill") {
  return ecomButtonSizeClasses[size][kind];
}
