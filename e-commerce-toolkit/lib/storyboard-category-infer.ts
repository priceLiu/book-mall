import type { ProductCategoryKey } from "@/lib/storyboard-param-collect";

/** 根据产品名关键词推断品类（本地规则，无需调 LLM） */
const CATEGORY_KEYWORD_RULES: Array<{
  key: ProductCategoryKey;
  keywords: string[];
}> = [
  {
    key: "home_clean",
    keywords: [
      "清洁",
      "洗衣",
      "去污",
      "消毒",
      "除菌",
      "厨房",
      "油烟",
      "拖把",
      "垃圾袋",
      "喷雾",
      "洗洁精",
      "洗衣液",
      "马桶",
      "洁厕",
      "收纳箱",
      "除湿",
      "杀虫",
      "洗碗",
      "擦拭",
    ],
  },
  {
    key: "beauty",
    keywords: [
      "面膜",
      "精华",
      "护肤",
      "口红",
      "粉底",
      "美妆",
      "眼霜",
      "防晒",
      "化妆",
      "洗发",
      "沐浴",
      "香水",
      "素颜",
      "祛痘",
      "保湿",
      "彩妆",
      "唇膏",
    ],
  },
  {
    key: "digital",
    keywords: [
      "耳机",
      "蓝牙",
      "手机",
      "电脑",
      "键盘",
      "鼠标",
      "充电",
      "相机",
      "音箱",
      "路由器",
      "平板",
      "数码",
      "电竞",
      "显示器",
      "硬盘",
      "投影",
      "智能手表",
      "充电宝",
    ],
  },
  {
    key: "food",
    keywords: [
      "零食",
      "咖啡",
      "茶",
      "饮料",
      "奶粉",
      "蛋白",
      "食品",
      "坚果",
      "巧克",
      "酒",
      "米",
      "面",
      "调味",
      "饼干",
      "麦片",
      "代餐",
      "果酱",
      "牛奶",
    ],
  },
  {
    key: "fashion",
    keywords: [
      "鞋",
      "裙",
      "裤",
      "外套",
      "包",
      "帽",
      "袜",
      "穿搭",
      "羽绒",
      "西装",
      "运动服",
      "羽毛球",
      "挂烫",
      "熨斗",
      "衬衫",
      "T恤",
      "内衣",
      "围巾",
      "手表",
      "箱包",
      "牛仔",
    ],
  },
];

export function inferProductCategoryFromName(productName: string): ProductCategoryKey {
  const text = productName.trim().toLowerCase();
  if (!text) return "general";

  let bestKey: ProductCategoryKey = "general";
  let bestScore = 0;

  for (const rule of CATEGORY_KEYWORD_RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (text.includes(kw.toLowerCase())) score += kw.length;
    }
    if (score > bestScore) {
      bestScore = score;
      bestKey = rule.key;
    }
  }

  return bestKey;
}
