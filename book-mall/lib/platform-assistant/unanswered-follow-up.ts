/**
 * AI 小智 · 未能解答时的统一追述引导。
 * 价格 / 计费 / 财务类仍走 guardrails，不追加此文案。
 */
export const ASSISTANT_UNANSWERED_FOLLOW_UP =
  "您也可以留下您的联系方式, 小智会后续联系您, 或者您可以先注册试用平台的功能, 现在有免费积分, 还有分享获积分哦.";

export function assistantUnansweredFollowUp(): string {
  return ASSISTANT_UNANSWERED_FOLLOW_UP;
}

/** 在现有回复末尾追加未能解答引导（已含则跳过）。 */
export function appendAssistantUnansweredFollowUp(reply: string): string {
  const suffix = assistantUnansweredFollowUp();
  const trimmed = reply.trim();
  if (!trimmed || trimmed.includes(suffix)) return trimmed;
  return `${trimmed}\n\n${suffix}`;
}

/** 是否尚未包含未能解答引导。 */
export function needsAssistantUnansweredFollowUp(reply: string): boolean {
  const suffix = assistantUnansweredFollowUp();
  return Boolean(reply.trim()) && !reply.includes(suffix);
}
