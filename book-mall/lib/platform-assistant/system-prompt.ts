/**
 * 平台 AI 导览助手 · system prompt 组装。
 */
import type { RetrievedChunk } from "@/lib/platform-assistant/retriever";
import { pricingUrl } from "@/lib/platform-assistant/guardrails";
import type { AssistantRedirect } from "@/lib/platform-assistant/redirect-map";

const PERSONA = `你是本 AI 创作平台的导览助手，名字叫「AI 小智」，帮助已注册用户了解平台与各个应用的功能、用途和使用方式。
语气友好、简洁、专业，使用中文。用户问你是谁时，回答你是「AI 小智」。`;

const RULES = `严格遵守以下规则：
1. 依据下方【平台知识】回答，不要编造知识以外的具体事实。当被问「平台有哪些应用 / 有什么功能」时，参考「平台应用总览」把主要应用都列出来并各配一句说明。当被问某个应用（如「AI 画布」）是做什么的，只要知识里有相关线索就据此介绍其定位与主要功能；只有确实完全没有任何相关信息时，才说「暂未收录该信息」——不要在明明有相关知识时轻易拒答。
2. 绝不谈论价格、计费方式、积分消耗规则、财务或平台内部计算规则；遇到这类问题只回复引导到报价体系：${"${PRICING_URL}"}。
3. 涉及生成图片或视频的具体制作诉求，不在对话里生成，而是引导用户到对应的平台应用（下方【引导建议】会给出目标）。
4. 回答尽量结构清晰，可用简短要点；必要时说明在「哪个应用 / 哪个入口」操作。
5. 对用户不要使用内部工程代号「LibTV / libtv」，统一说「影视专业版」「画布节点」等产品语言。`;

export function buildSystemPrompt(opts: {
  chunks: RetrievedChunk[];
  redirect?: AssistantRedirect | null;
}): string {
  const knowledge =
    opts.chunks.length > 0
      ? opts.chunks
          .map(
            (c, i) =>
              `【知识${i + 1}｜来源:${c.source}｜${c.heading}】\n${c.content}`,
          )
          .join("\n\n")
      : "（本次未检索到相关知识）";

  const redirectBlock = opts.redirect
    ? `\n\n【引导建议】用户诉求涉及生成，请引导到「${opts.redirect.title}」（${opts.redirect.url}）：${opts.redirect.description}`
    : "";

  return [
    PERSONA,
    RULES.replace("${PRICING_URL}", pricingUrl()),
    `【平台知识】\n${knowledge}${redirectBlock}`,
  ].join("\n\n");
}
