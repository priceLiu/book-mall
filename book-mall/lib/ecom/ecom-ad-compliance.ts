/**
 * 广告法极限词过滤：助手输出落库前改写，避免生成的主图/详情页文案带违规表述。
 * 对应 doc/ecom/pdt/skill_config.json 的「广告极限词自动过滤」规则。
 */

type ForbiddenRule = {
  pattern: RegExp;
  replacement: string;
  /** 命中时展示给用户的原词 */
  label: string;
};

const FORBIDDEN_RULES: ForbiddenRule[] = [
  { pattern: /100\s*%/g, replacement: "全面", label: "100%" },
  { pattern: /百分之百/g, replacement: "全面", label: "百分之百" },
  { pattern: /根治/g, replacement: "改善", label: "根治" },
  { pattern: /永不([\u4e00-\u9fa5]{1,4})/g, replacement: "长效$1", label: "永不" },
  { pattern: /永久(?!性会员)/g, replacement: "长效", label: "永久" },
  { pattern: /最强/g, replacement: "出色", label: "最强" },
  { pattern: /最佳/g, replacement: "优选", label: "最佳" },
  { pattern: /最好/g, replacement: "优选", label: "最好" },
  { pattern: /最低价?/g, replacement: "优惠价", label: "最低" },
  { pattern: /第一(?![\u4e00-\u9fa5]?(次|步|时间|阶段|季度|批))/g, replacement: "领先", label: "第一" },
  { pattern: /全网最低/g, replacement: "价格实惠", label: "全网最低" },
  { pattern: /全球领先/g, replacement: "行业领先", label: "全球领先" },
  { pattern: /稳赚/g, replacement: "有机会获益", label: "稳赚" },
  { pattern: /躺赚/g, replacement: "省心经营", label: "躺赚" },
  { pattern: /暴富/g, replacement: "增加收入", label: "暴富" },
  { pattern: /国家级/g, replacement: "高标准", label: "国家级" },
  { pattern: /绝无仅有/g, replacement: "少见", label: "绝无仅有" },
  { pattern: /包治/g, replacement: "有助于改善", label: "包治" },
  { pattern: /无效退款/g, replacement: "售后保障", label: "无效退款" },
];

export type AdComplianceResult = {
  text: string;
  hits: string[];
};

/** 改写文本中的极限词，返回改写后文本与命中词清单 */
export function sanitizeAdCopy(input: string): AdComplianceResult {
  if (!input) return { text: input, hits: [] };
  let text = input;
  const hits: string[] = [];
  for (const rule of FORBIDDEN_RULES) {
    rule.pattern.lastIndex = 0;
    if (!rule.pattern.test(text)) continue;
    rule.pattern.lastIndex = 0;
    text = text.replace(rule.pattern, rule.replacement);
    hits.push(rule.label);
  }
  return { text, hits: [...new Set(hits)] };
}

/** 深度遍历对象内所有字符串做合规改写，用于结构化 design 落库前处理 */
export function sanitizeAdCopyDeep<T>(value: T): { value: T; hits: string[] } {
  const hits = new Set<string>();

  const walk = (node: unknown): unknown => {
    if (typeof node === "string") {
      const result = sanitizeAdCopy(node);
      result.hits.forEach((h) => hits.add(h));
      return result.text;
    }
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        // 图片地址不参与文案改写
        out[k] = k === "ossUrl" || k === "imageUrl" ? v : walk(v);
      }
      return out;
    }
    return node;
  };

  return { value: walk(value) as T, hits: [...hits] };
}

export function listForbiddenWords(): string[] {
  return FORBIDDEN_RULES.map((r) => r.label);
}
