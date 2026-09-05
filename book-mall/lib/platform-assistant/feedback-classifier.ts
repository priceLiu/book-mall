/**
 * AI 小智 · 用户反馈 / 问题 / Bug 分类。
 */
import type { PlatformAssistantFeedbackCategory } from "@prisma/client";

const BUG_RE =
  /bug|报错|出错|异常|崩溃|无法使用|不能用|故障|白屏|卡死|失败|不工作|打不开|加载不出|闪退|500|404/i;

const FEATURE_RE = /建议|希望增加|能不能加|能否支持|缺少功能/i;

const UNANSWERED_REPLY_RE =
  /暂未收录|不清楚|无法回答|没有相关信息|帮不了|不太确定|暂时没有|没有找到相关/i;

/** 从用户消息推断是否应记入反馈库。 */
export function classifyUserFeedbackCategory(
  text: string,
): PlatformAssistantFeedbackCategory | null {
  const t = text.trim();
  if (!t) return null;
  if (BUG_RE.test(t)) return "BUG";
  if (FEATURE_RE.test(t)) return "FEATURE_REQUEST";
  if (/\?|？|怎么|如何|为什么|在哪|哪里/.test(t)) return "QUESTION";
  return null;
}

export function isUnansweredAssistantReply(text: string): boolean {
  return UNANSWERED_REPLY_RE.test(text.trim());
}

/** 无检索知识且非平台总览/寒暄 → 视为未能解答。 */
export function shouldLogUnansweredQuestion(opts: {
  query: string;
  chunkCount: number;
  isOverview: boolean;
  isGreeting: boolean;
  assistantReply: string;
}): boolean {
  if (opts.isOverview || opts.isGreeting) return false;
  if (isUnansweredAssistantReply(opts.assistantReply)) return true;
  if (opts.chunkCount === 0 && opts.assistantReply.trim().length > 0) {
    return classifyUserFeedbackCategory(opts.query) === "QUESTION";
  }
  return false;
}
