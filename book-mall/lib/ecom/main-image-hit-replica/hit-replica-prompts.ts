import {
  MAIN_IMAGE_HIT_REPLICA_CATEGORY_LABELS,
  type MainImageHitReplicaCategory,
  type MainImageHitReplicaDegree,
} from "./types";

export function buildHitReplicaPromptSystem(degree: MainImageHitReplicaDegree): string {
  const degreeBlock =
    degree === "high_fidelity"
      ? `【高度复刻】锁定参考图的视觉结构：景别、主体位置与比例、姿态/手部/视线、光影方向与对比、构图留白节奏；背景布局与景深关系大体一致，仅允许细微差异。替换参考图中全部「可售主体」为用户产品，不得残留原款式/原包装。参考图营销文案：默认保留相同层级与近似字数，用「{{…}}」作占位，除非用户要求保留或改写指定文案。`
      : `【参考风格】继承参考图的商业气质与构图逻辑；色彩、场景道具、墙面/台面/装饰可围绕用户产品主色重构以突出 SKU。姿势与景别可微调以更好展示产品，勿 1:1 描摹背景每个细节。`;

  return `你是电商「爆款图复刻」的视觉策划与生图 Prompt 工程师。

你会收到：第 1 张=爆款参考图（构图/姿势/光影真源，禁止照搬其商品款式与品牌标识）；第 2 张起（可选）=用户产品原图（可售主体真源：颜色/材质/轮廓/工艺细节以此为准）；可选额外图=本批次风格锚点成片（仅统一气质时参考，版式仍以当前参考图为准）。

${degreeBlock}

【复刻类型】须在 prompt 中体现成片用途：
- 电商商品图：干净背景或简约场景，商品清晰，适合主图/橱窗。
- 服饰电商图：人物穿搭；写清穿着层次与可见细节；无产品图则不编造款式。
- 营销海报：保留标题/卖点/价格带版式层级；字用占位，不抄品牌名。
- 社媒图文：生活化、氛围感。
- 创意海报：更大胆色块与图形，继承版式节奏。
- 其他：按参考图实际形态描述主体、场景与光影。

【产品不限品类】用「主商品/核心 SKU」表述；按品类写穿搭/摆放/手持/陈列，禁止默认「模特穿衣」除非参考或产品图明确为人像穿搭。

【用户要求优先级】「本张参考图专属要求」优先于「统一复刻要求」；均为空则忽略。与程度/类型冲突时以用户要求为准。

【禁止写入 prompt】竞品品牌名、真实联系方式、「AI生成」字样、markdown。

仅输出一个 JSON 对象（不要 markdown 围栏）：
{"prompt":"给生图模型的完整中文指令，200–450字，含构图光影、产品锁定、文案占位（若有）、负面约束一句","negative":"可选，补充禁忌，20字内"}`;
}

export function buildHitReplicaUserText(opts: {
  category: MainImageHitReplicaCategory;
  degree: MainImageHitReplicaDegree;
  language: string;
  globalRequirements?: string;
  perRefRequirement?: string;
  hasProductImages: boolean;
  productImageCount: number;
  keepStyleConsistent: boolean;
  multiRefBatch: boolean;
  hasStyleAnchor: boolean;
}): string {
  const categoryLabel = MAIN_IMAGE_HIT_REPLICA_CATEGORY_LABELS[opts.category];
  const globalReq = opts.globalRequirements?.trim() ?? "";
  const perRef = opts.perRefRequirement?.trim() ?? "";

  return [
    `【复刻类型】${categoryLabel}`,
    `【复刻程度】${opts.degree === "high_fidelity" ? "高度复刻" : "参考风格"}`,
    `【输出语种】${opts.language}`,
    `【统一复刻要求】\n${globalReq || "（无）"}`,
    `【本张参考图专属要求】\n${perRef || "（无）"}`,
    opts.hasProductImages
      ? `【产品原图】已上传 ${opts.productImageCount} 张；视觉消息中紧随参考图后的图片为产品，须锁定其颜色/版型/材质/关键结构，不得沿用参考图商品款式。`
      : `【产品原图】未上传；主商品品类、数量与摆放方式与参考图一致，不虚构具体 SKU 纹理。`,
    opts.keepStyleConsistent && opts.multiRefBatch
      ? "【批次风格】多张成片须统一色调、字体气质、装饰与光影基调，像同一店铺套图。"
      : "",
    opts.keepStyleConsistent && opts.hasStyleAnchor
      ? "【风格锚点】须与本批次首张已生成成片保持同一视觉气质（版式仍服从本张参考图）。"
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function parseHitReplicaPromptJson(text: string): { prompt: string; negative?: string } {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("未返回有效 Prompt JSON");
  const parsed = JSON.parse(trimmed.slice(start, end + 1)) as {
    prompt?: string;
    negative?: string;
  };
  let prompt = typeof parsed.prompt === "string" ? parsed.prompt.trim() : "";
  if (!prompt) throw new Error("AI 未生成有效 Prompt");
  const negative = typeof parsed.negative === "string" ? parsed.negative.trim() : "";
  if (negative) {
    prompt = `${prompt} 禁止：${negative}`;
  }
  return { prompt, negative: negative || undefined };
}