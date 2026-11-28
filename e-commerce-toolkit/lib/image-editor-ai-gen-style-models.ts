/**
 * AI 生图 · 风格模型目录（弹层「风格模型」与侧栏六格快捷）。
 * 缩略图默认：`tool-mall` OSS `ecom/image-editor/ai-gen-styles/{id}.jpg`（经同域 proxy 加载）。
 * 本地素材在 `public/image-editor/ai-gen-styles`，用 `scripts/sync-ai-gen-style-thumbs-from-public.mjs` 上传 OSS。
 */
import { ecomMediaFetchUrl } from "@/lib/ecom-media-download";

export type AiGenStyleCategory = "hot" | "oriental" | "photo" | "design" | "3d";

export type AiGenStyleModel = {
  id: string;
  label: string;
  description: string;
  category: AiGenStyleCategory;
  /** Gateway `styleId`；无则用 promptSuffix */
  styleId?: string;
  /** 追加到用户提示词的风格描述（中文） */
  promptSuffix?: string;
};

export const AI_GEN_STYLE_CATEGORY_LABEL: Record<AiGenStyleCategory, string> = {
  hot: "热门",
  oriental: "东方美学",
  photo: "影像艺术",
  design: "设计概念",
  "3d": "三维空间",
};

/** 侧栏默认展示的 6 个快捷风格（可在弹层另选，会替换最后一格） */
export const IMAGE_EDITOR_AI_GEN_FEATURED_IDS = [
  "general",
  "ecom-bg",
  "thick-line",
  "shoujo",
  "plush",
  "blindbox-premium",
] as const;

/** 「三维空间」Tab 展示顺序（与产品参考一致；可与 `category: hot` 等同 id 并存） */
/** 「东方美学」Tab 展示顺序（与产品参考一致） */
export const AI_GEN_STYLE_ORIENTAL_TAB_IDS = [
  "paper-cut-book",
  "hanfu-photo",
  "cloth-doll",
  "jade-glass",
  "east-illus",
  "qq-love",
  "cn-animation",
  "kids-mag",
  "wing-chun",
  "neo-cn",
  "gongbi",
  "pine-moon",
  "ink-poetry",
  "rock-color",
  "guoman-2",
  "prosper-dress",
  "cn-wedding",
  "ming-grace",
  "song-elegance",
  "cn-fantasy",
] as const;

export const AI_GEN_STYLE_3D_TAB_IDS = [
  "blindbox-premium",
  "soft-candy",
  "mosaic",
  "blindbox-simple",
  "lowpoly-cartoon",
  "transparent-2",
  "clay-stop",
  "childhood-idol",
  "ps2-game",
  "chrome",
  "gold-particle",
  "cn-fantasy",
  "sss",
  "cute-3d",
  "cartoon-3d",
] as const;

export const AI_GEN_STYLE_OSS_PREFIX =
  "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/ecom/image-editor/ai-gen-styles";

export function aiGenStyleThumbUrl(id: string): string {
  const envBase = process.env.NEXT_PUBLIC_AI_GEN_STYLE_THUMB_BASE?.trim();
  const base = (envBase || AI_GEN_STYLE_OSS_PREFIX).replace(/\/$/, "");
  if (base.startsWith("/")) {
    return `${base}/${id}.jpg`;
  }
  return ecomMediaFetchUrl(`${base}/${id}.jpg`);
}

const S = (rows: AiGenStyleModel[]) => rows;

export const AI_GEN_STYLE_MODELS: AiGenStyleModel[] = [
  ...S([
    {
      id: "general",
      label: "通用",
      description: "不限定画风，按提示词自由生成",
      category: "hot",
      styleId: "none",
    },
    {
      id: "thick-line",
      label: "粗线图",
      description: "简约的贴纸风格粗边插图",
      category: "design",
      promptSuffix: "粗线条贴纸插画，黑描边，扁平色块。",
    },
    {
      id: "shoujo",
      label: "少女漫",
      description: "钢笔勾线少女漫画风格",
      category: "design",
      styleId: "anime",
      promptSuffix: "少女漫画，钢笔勾线，浪漫配色。",
    },
    {
      id: "plush",
      label: "长毛绒",
      description: "毛绒材质，万物皆可毛绒",
      category: "design",
      promptSuffix: "长毛绒材质，柔软纤维质感，可爱立体。",
    },
    {
      id: "blindbox-premium",
      label: "至臻盲盒",
      description: "超精致的写实盲盒与手办。",
      category: "3d",
      styleId: "3d-render",
      promptSuffix: "超精致的写实盲盒与手办。",
    },
    {
      id: "soft-candy",
      label: "软糖",
      description: "QQ软软超可爱透明软糖材质。",
      category: "3d",
      promptSuffix: "QQ软软超可爱透明软糖材质。",
    },
  ]),
  ...S([
    {
      id: "cloth-doll",
      label: "布偶",
      description: "中式布娃娃，偶动画风格材质。",
      category: "hot",
      promptSuffix: "中式布娃娃，偶动画风格材质。",
    },
    {
      id: "blindbox-simple",
      label: "简单盲盒2.0",
      description: "简约创意的手办潮流玩具。",
      category: "hot",
      styleId: "3d-render",
      promptSuffix: "简约创意的手办潮流玩具。",
    },
    {
      id: "lowpoly-cartoon",
      label: "低模卡通",
      description: "清新柔和的低面建模，三渲二卡通游戏风格。",
      category: "hot",
      styleId: "3d-render",
      promptSuffix: "清新柔和的低面建模，三渲二卡通游戏风格。",
    },
    { id: "pc98", label: "PC-98", description: "复古像素美少女游戏画风", category: "hot", styleId: "pixel-art" },
    { id: "micro-world", label: "微观世界", description: "微缩景观下的小小世界", category: "hot", promptSuffix: "微距景观，移轴摄影感。" },
    {
      id: "transparent-2",
      label: "透明2.0",
      description: "极佳的透明材质效果表现。提高画面光泽通透度。",
      category: "hot",
      promptSuffix: "极佳的透明材质效果表现。提高画面光泽通透度。",
    },
    { id: "product-photo", label: "产品摄影", description: "高质量商品摄影场景", category: "hot", styleId: "photography" },
    { id: "sci-fi-2", label: "未来科幻2.0", description: "科技未来感，宏大科幻场景", category: "hot", styleId: "digital-art" },
    { id: "fairy-dream", label: "童话梦核", description: "超现实复古梦幻风格", category: "hot", promptSuffix: "梦核美学，复古朦胧。" },
    {
      id: "clay-stop",
      label: "黏土动画",
      description: "类定格的小姐妹。黏土雕塑风格。",
      category: "hot",
      promptSuffix: "类定格的小姐妹。黏土雕塑风格。",
    },
    { id: "class-stop", label: "类定格", description: "人物场景定格动画故事感", category: "hot", promptSuffix: "定格动画布光，场景微缩。" },
    {
      id: "childhood-idol",
      label: "童年偶像",
      description: "谁心里不住个小女孩呢？",
      category: "hot",
      styleId: "anime",
      promptSuffix: "谁心里不住个小女孩呢？",
    },
    {
      id: "ps2-game",
      label: "ps²游戏",
      description: "适合生成 #ps² #SIMS²风格图像, 擅长古早游戏人像与场景",
      category: "hot",
      styleId: "pixel-art",
      promptSuffix: "适合生成 #ps² #SIMS²风格图像, 擅长古早游戏人像与场景",
    },
    { id: "pet-job", label: "猫狗直聘", description: "拟人化的猫猫狗狗", category: "hot", promptSuffix: "拟人化宠物，商务幽默场景。" },
    {
      id: "gold-particle",
      label: "金粉粒子",
      description: "财富buff特效，搭配ACGN有奇效。",
      category: "hot",
      promptSuffix: "财富buff特效，搭配ACGN有奇效。",
    },
    {
      id: "cn-fantasy",
      label: "中式玄幻",
      description: "中国风魔幻3D资产，精怪异兽。",
      category: "hot",
      promptSuffix: "中国风魔幻3D资产，精怪异兽。",
    },
    { id: "pixel", label: "像素风", description: "2D 游戏像素画风", category: "hot", styleId: "pixel-art" },
    {
      id: "cute-3d",
      label: "3D小可爱",
      description: "圆润光滑的3d材质。适合创造萌物。",
      category: "hot",
      styleId: "3d-render",
      promptSuffix: "圆润光滑的3d材质。适合创造萌物。",
    },
    { id: "pop-art", label: "波普", description: "商业美术波普艺术", category: "hot", styleId: "digital-art" },
    { id: "concept", label: "概念设计", description: "概念场景实现与表达", category: "hot", promptSuffix: "概念设计草图，气氛光。" },
    {
      id: "ink-poetry",
      label: "诗意水墨",
      description: "中国水墨画灵动多变的笔法世界。",
      category: "hot",
      styleId: "watercolor",
      promptSuffix: "中国水墨画灵动多变的笔法世界。",
    },
    {
      id: "rock-color",
      label: "岩彩画",
      description: "童趣梦幻多彩的艺术画风。",
      category: "hot",
      styleId: "oil-painting",
      promptSuffix: "童趣梦幻多彩的艺术画风。",
    },
    {
      id: "guoman-2",
      label: "国漫2.0",
      description: "新版武侠风范国风漫画。",
      category: "hot",
      styleId: "anime",
      promptSuffix: "新版武侠风范国风漫画。",
    },
    { id: "nostalgia", label: "怀旧", description: "尘封的年代感", category: "hot", promptSuffix: "复古胶片怀旧色调。" },
  ]),
  ...S([
    {
      id: "paper-cut-book",
      label: "纸雕书",
      description: "纸浮雕效果，具有雕塑美感的手工艺技术",
      category: "oriental",
      promptSuffix: "纸浮雕效果，具有雕塑美感的手工艺技术",
    },
    {
      id: "hanfu-photo",
      label: "国风摄影",
      description: "唯美的国风汉服摄影。",
      category: "oriental",
      styleId: "photography",
      promptSuffix: "唯美的国风汉服摄影。",
    },
    {
      id: "jade-glass",
      label: "玉琉璃",
      description: "玉器翡翠和琉璃材质质感模型。",
      category: "oriental",
      promptSuffix: "玉器翡翠和琉璃材质质感模型。",
    },
    {
      id: "east-illus",
      label: "东方插画",
      description: "东方意境构图，韩风治愈插画。",
      category: "oriental",
      styleId: "watercolor",
      promptSuffix: "东方意境构图，韩风治愈插画。",
    },
    {
      id: "qq-love",
      label: "QQ嬡",
      description: "謿蓅復興，溡尙QQ莠",
      category: "oriental",
      promptSuffix: "謿蓅復興，溡尙QQ莠",
    },
    {
      id: "cn-animation",
      label: "中国动画",
      description: "传统赛璐珞动画电影风格。",
      category: "oriental",
      styleId: "anime",
      promptSuffix: "传统赛璐珞动画电影风格。",
    },
    {
      id: "kids-mag",
      label: "儿童期刊",
      description: "中式治愈插画，童年时期最爱读物。",
      category: "oriental",
      promptSuffix: "中式治愈插画，童年时期最爱读物。",
    },
    {
      id: "wing-chun",
      label: "咏春",
      description: "当美式漫画有了东方神韵。",
      category: "oriental",
      styleId: "anime",
      promptSuffix: "当美式漫画有了东方神韵。",
    },
    {
      id: "neo-cn",
      label: "新中式",
      description: "新中式古典美学，鎏金与水墨的碰撞。",
      category: "oriental",
      promptSuffix: "新中式古典美学，鎏金与水墨的碰撞。",
    },
    {
      id: "gongbi",
      label: "工笔重彩",
      description: "工整细致的中国画技法，柔软与坚韧的绝妙平衡。",
      category: "oriental",
      styleId: "watercolor",
      promptSuffix: "工整细致的中国画技法，柔软与坚韧的绝妙平衡。",
    },
    {
      id: "pine-moon",
      label: "青松明月",
      description: "娟秀柔美，平静安逸的隐市之风。",
      category: "oriental",
      styleId: "watercolor",
      promptSuffix: "娟秀柔美，平静安逸的隐市之风。",
    },
    {
      id: "song-elegance",
      label: "宋韵风雅",
      description: "华服系列。推荐强度 <75%",
      category: "oriental",
      promptSuffix: "华服系列。推荐强度 <75%",
    },
    {
      id: "ming-grace",
      label: "明人风骨",
      description: "华服系列。推荐强度 <75%",
      category: "oriental",
      promptSuffix: "华服系列。推荐强度 <75%",
    },
    {
      id: "cn-wedding",
      label: "中式婚服",
      description: "华服系列。推荐强度 <75%",
      category: "oriental",
      promptSuffix: "华服系列。推荐强度 <75%",
    },
    {
      id: "prosper-dress",
      label: "盛世霓裳",
      description: "华服系列。推荐强度 <75%",
      category: "oriental",
      promptSuffix: "华服系列。推荐强度 <75%",
    },
  ]),
  ...S([
    { id: "macro-photo", label: "微距摄影", description: "近距离超写实", category: "photo", styleId: "photography" },
    { id: "landscape-pro", label: "赛级风光", description: "风光摄影大片", category: "photo", styleId: "photography" },
    { id: "art-film", label: "文艺电影", description: "小众胶片电影感", category: "photo", promptSuffix: "文艺片胶片颗粒。" },
    { id: "hollywood", label: "好莱坞", description: "商业大片氛围", category: "photo", styleId: "photography" },
    { id: "film-stock", label: "胶片", description: "摄影艺术胶片系列", category: "photo", promptSuffix: "柯达胶片色。" },
    { id: "defocus", label: "失焦", description: "摄影艺术失焦系列", category: "photo", promptSuffix: "柔焦朦胧。" },
    { id: "polaroid", label: "宝丽来", description: "拍立得即时成像", category: "photo", promptSuffix: "宝丽来白边。" },
    { id: "soft-light", label: "柔光", description: "柔和人像光", category: "photo", styleId: "photography" },
    { id: "haze-art", label: "朦胧艺术", description: "失焦白日梦", category: "photo", promptSuffix: "梦幻朦胧曝光。" },
    { id: "minimal-wall", label: "极简主义", description: "适合壁纸与留白构图", category: "photo", promptSuffix: "极简构图，大面积留白。" },
    { id: "light-cg", label: "光影画片2.0", description: "炫彩光影 CG，适合人像", category: "photo", styleId: "digital-art" },
    { id: "plein-air", label: "外光主义", description: "印象派厚涂外景", category: "photo", styleId: "oil-painting" },
    { id: "art-master", label: "艺术大师", description: "油画与水彩融合", category: "photo", styleId: "oil-painting" },
    { id: "pocket-world", label: "袖珍世界", description: "超可爱 Q 版卡通", category: "photo", styleId: "anime" },
  ]),
  ...S([
    { id: "crayon", label: "蜡笔画", description: "蜡笔绘本插画风", category: "design", styleId: "pencil-sketch" },
    { id: "retro-manga", label: "复古日漫", description: "粗线水彩漫画封面", category: "design", styleId: "anime" },
    { id: "gouache-fun", label: "尽兴水粉", description: "低保和水粉插画", category: "design", styleId: "watercolor" },
    { id: "pastel-mood", label: "氛围粉彩", description: "印象派彩色铅笔画", category: "design", styleId: "watercolor" },
    { id: "picture-book", label: "绘本故事", description: "治愈蜡笔绘本", category: "design", styleId: "pencil-sketch" },
    { id: "ecom-bg", label: "电商背景", description: "精致电商产品背景", category: "design", styleId: "photography" },
    { id: "riso", label: "孔版印刷", description: "Risograph 亮丽色彩", category: "design", promptSuffix: "孔版印刷肌理，撞色。" },
    { id: "anime-2", label: "动漫2.0", description: "经典二次元青春", category: "design", styleId: "anime" },
    { id: "round-pen", label: "圆头笔", description: "简单童趣数字插画", category: "design", styleId: "digital-art" },
    { id: "biz-illus", label: "商业插画", description: "矢量线描商业插图", category: "design", styleId: "digital-art" },
    { id: "screen-print", label: "平面丝网", description: "丝网印刷插画", category: "design", promptSuffix: "丝网印刷套色。" },
    { id: "abstract-other", label: "抽象异次元", description: "创意电商材质", category: "design", styleId: "digital-art" },
    { id: "collage", label: "超时空拼贴", description: "剪纸拼贴脑洞", category: "design", promptSuffix: "手撕拼贴剪纸。" },
    { id: "heaven-doll", label: "天堂玩偶", description: "万物皆毛绒玩偶", category: "design", promptSuffix: "玩偶设计师风格。" },
    { id: "lowpoly", label: "Lowpoly", description: "专属低多边形象", category: "design", styleId: "3d-render" },
    { id: "line-graphic", label: "线条图形", description: "平面线条感", category: "design", styleId: "digital-art" },
  ]),
  ...S([
    {
      id: "mosaic",
      label: "马赛克",
      description: "马赛克艺术，瓷砖拼贴效果",
      category: "3d",
      promptSuffix: "马赛克艺术，瓷砖拼贴效果",
    },
    {
      id: "chrome",
      label: "镀铬",
      description: "银白色金属材质。权重低于40%能提升画面光泽感。",
      category: "3d",
      promptSuffix: "银白色金属材质。权重低于40%能提升画面光泽感。",
    },
    {
      id: "sss",
      label: "次表面散射",
      description: "SSS材质，半透明色散效果。",
      category: "3d",
      promptSuffix: "SSS材质，半透明色散效果。",
    },
    {
      id: "cartoon-3d",
      label: "3D卡通",
      description: "三维渲染卡通风格人物及场景。",
      category: "3d",
      styleId: "3d-render",
      promptSuffix: "三维渲染卡通风格人物及场景。",
    },
  ]),
];

const MODEL_BY_ID = new Map(AI_GEN_STYLE_MODELS.map((m) => [m.id, m]));

export function getAiGenStyleModel(id: string): AiGenStyleModel | undefined {
  return MODEL_BY_ID.get(id);
}

/** 弹层卡片第二行：生成用风格提示词（优先 promptSuffix，否则介绍文案） */
export function aiGenStylePromptTip(model: AiGenStyleModel): string {
  const suffix = model.promptSuffix?.trim();
  if (suffix) return suffix;
  return model.description.trim();
}

export function resolveAiGenStylePrompt(basePrompt: string, styleKey: string): { prompt: string; styleId: string } {
  const m = getAiGenStyleModel(styleKey);
  if (!m) {
    return { prompt: basePrompt, styleId: "none" };
  }
  const styleId = m.styleId ?? "none";
  const extra = m.promptSuffix?.trim();
  const prompt = extra ? `${basePrompt.trim()} ${extra}` : basePrompt.trim();
  return { prompt, styleId };
}

function matchesStyleQuery(m: AiGenStyleModel, q: string): boolean {
  const tip = aiGenStylePromptTip(m).toLowerCase();
  return (
    m.label.toLowerCase().includes(q) ||
    m.description.toLowerCase().includes(q) ||
    tip.includes(q) ||
    m.id.toLowerCase().includes(q)
  );
}

const AI_GEN_STYLE_TAB_ORDER: Partial<
  Record<AiGenStyleCategory, readonly string[]>
> = {
  oriental: AI_GEN_STYLE_ORIENTAL_TAB_IDS,
  "3d": AI_GEN_STYLE_3D_TAB_IDS,
};

export function filterAiGenStyleModels(opts: {
  category: AiGenStyleCategory;
  query: string;
}): AiGenStyleModel[] {
  const q = opts.query.trim().toLowerCase();
  const order = AI_GEN_STYLE_TAB_ORDER[opts.category];
  const base = order
    ? order
        .map((id) => getAiGenStyleModel(id))
        .filter((m): m is AiGenStyleModel => Boolean(m))
    : AI_GEN_STYLE_MODELS.filter((m) => m.category === opts.category);
  if (!q) return base;
  return base.filter((m) => matchesStyleQuery(m, q));
}