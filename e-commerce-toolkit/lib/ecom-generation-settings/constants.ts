/** 电商工具箱 · 生成设置（平台 / 国家 / 语种）— AI 商品套图、AI 详情页等共用 */

export type EcomGenerationSelectOption = {
  value: string;
  label: string;
};

/** 图 6 + 7 + 8 */
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

/** 图 4 + 5 */
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

/** 图 2 + 3 */
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

/** @deprecated 使用 ECOM_COUNTRY_OPTIONS */
export const ECOM_MARKET_OPTIONS = ECOM_COUNTRY_OPTIONS;

export function ecomOptionLabel(
  options: EcomGenerationSelectOption[],
  value: string | undefined,
  fallback = "",
): string {
  if (!value) return fallback;
  return options.find((o) => o.value === value)?.label ?? value;
}

const LEGACY_PLATFORM: Record<string, string> = {
  taobao: "taobao-tmall-1688",
  "taobao-tmall": "taobao-tmall-1688",
  "1688": "taobao-tmall-1688",
  kuaishou: "douyin",
  xiaohongshu: "douyin",
  "shopee-lazada": "shopee",
  lazada: "shopee",
};

const LEGACY_COUNTRY: Record<string, string> = {
  uk: "europe",
};

export function normalizeEcomPlatformValue(value: string | undefined): string {
  if (!value) return "amazon";
  if (ECOM_PLATFORM_OPTIONS.some((o) => o.value === value)) return value;
  return LEGACY_PLATFORM[value] ?? value;
}

export function normalizeEcomCountryValue(value: string | undefined): string {
  if (!value) return "us";
  if (ECOM_COUNTRY_OPTIONS.some((o) => o.value === value)) return value;
  return LEGACY_COUNTRY[value] ?? value;
}

export function normalizeEcomLanguageValue(value: string | undefined): string {
  if (!value) return "英文";
  if (value === "西班牙语") return "西语";
  if (ECOM_LANGUAGE_OPTIONS.some((o) => o.value === value)) return value;
  return value;
}
