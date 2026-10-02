/** 与 e-commerce-toolkit/lib/ecom-generation-settings/constants.ts 保持同步 */

export type EcomGenerationSelectOption = {
  value: string;
  label: string;
};

export const ECOM_PLATFORM_OPTIONS: EcomGenerationSelectOption[] = [
  { value: "amazon", label: "亚马逊" },
  { value: "taobao-tmall-1688", label: "淘宝天猫1688" },
  { value: "temu", label: "Temu" },
  { value: "tiktok-shop", label: "TikTok Shop" },
  { value: "pdd", label: "拼多多" },
  { value: "douyin", label: "抖音电商" },
  { value: "ozon", label: "OZON" },
  { value: "independent", label: "独立站" },
  { value: "shopee", label: "Shopee" },
  { value: "alibaba-intl", label: "阿里国际站" },
  { value: "aliexpress", label: "速卖通" },
  { value: "shein", label: "SHEIN" },
  { value: "jd", label: "京东" },
  { value: "mercado-libre", label: "美客多" },
  { value: "coupang", label: "Coupang" },
  { value: "wayfair", label: "Wayfair" },
];

export const ECOM_COUNTRY_OPTIONS: EcomGenerationSelectOption[] = [
  { value: "us", label: "美国" },
  { value: "europe", label: "欧洲" },
  { value: "cn", label: "中国" },
  { value: "ru", label: "俄罗斯" },
  { value: "sea", label: "东南亚" },
  { value: "es", label: "西班牙" },
  { value: "de", label: "德国" },
  { value: "jp", label: "日本" },
  { value: "kr", label: "韩国" },
  { value: "br", label: "巴西" },
  { value: "mx", label: "墨西哥" },
];

export const ECOM_LANGUAGE_OPTIONS: EcomGenerationSelectOption[] = [
  { value: "英文", label: "英文" },
  { value: "中文", label: "中文" },
  { value: "俄语", label: "俄语" },
  { value: "西语", label: "西语" },
  { value: "德语", label: "德语" },
  { value: "日语", label: "日语" },
  { value: "韩语", label: "韩语" },
  { value: "葡萄牙语", label: "葡萄牙语" },
  { value: "印尼语", label: "印尼语" },
  { value: "泰语", label: "泰语" },
  { value: "无文字", label: "无文字" },
];

export function ecomGenerationOptionLabel(
  options: EcomGenerationSelectOption[],
  value: string | undefined,
  fallback = "",
): string {
  if (!value) return fallback;
  return options.find((o) => o.value === value)?.label ?? value;
}

export function productImageSetPlatformLabel(code: string | undefined): string {
  return ecomGenerationOptionLabel(ECOM_PLATFORM_OPTIONS, code, code ?? "电商平台");
}
