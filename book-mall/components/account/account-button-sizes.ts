import {
  BUTTON_SM_MIN_CLASS,
  BUTTON_SIZES,
  type ButtonSizeTier,
} from "@/lib/button-sizes";

/**
 * 个人中心主按钮尺寸（仅 sm | md | lg 三档）。
 * 同一页面最多使用其中两档，见 ACCOUNT-BUTTON.md。
 */
export const ACCOUNT_BUTTON_SIZES = BUTTON_SIZES;
export type AccountButtonSize = ButtonSizeTier;

export const ACCOUNT_BTN_SM_MIN_CLASS = BUTTON_SM_MIN_CLASS;

/** 小：卡片内链、表格行内、表单提交 */
export const ACCOUNT_BTN_SM = "sm" satisfies AccountButtonSize;
/** 中：区块主操作、侧栏退出（默认） */
export const ACCOUNT_BTN_MD = "md" satisfies AccountButtonSize;
/** 大：页底/区块级主 CTA */
export const ACCOUNT_BTN_LG = "lg" satisfies AccountButtonSize;
