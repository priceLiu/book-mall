"use client";

import { useState } from "react";

import type { AssistantFeedbackListItem } from "@/lib/platform-assistant/feedback-service";

const CATEGORY_LABEL: Record<string, string> = {
  BUG: "Bug / 故障",
  QUESTION: "未能解答",
  FEATURE_REQUEST: "功能建议",
  OTHER: "其他",
};

function fmtTime(d: Date | string) {
  return new Date(d).toLocaleString("zh-CN");
}

export function AdminAssistantFeedbackPanel({
  initialItems,
  summary,
  onAddAsQa,
}: {
  initialItems: AssistantFeedbackListItem[];
  summary: {
    openTotal: number;
    openBug: number;
    openQuestion: number;
    last24h: number;
  };
  onAddAsQa?: (item: AssistantFeedbackListItem) => void;
}) {
  const [items, setItems] = useState(initialItems);

  async function markReviewed(id: string) {
    const res = await fetch(`/api/admin/platform-assistant/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "REVIEWED" }),
    });
    if (!res.ok) return;
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[#1f2328]">AI 小智 · 用户反馈</h2>
        <p className="mt-0.5 text-sm text-[#656d76]">
          用户报告的 Bug、未能解答的问题与功能建议（来自全站 AI 小智对话）
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-[#d1d9e0] bg-white px-4 py-3">
          <p className="text-xs text-[#656d76]">待处理</p>
          <p className="text-2xl font-semibold tabular-nums">{summary.openTotal}</p>
        </div>
        <div className="rounded-lg border border-[#d1d9e0] bg-white px-4 py-3">
          <p className="text-xs text-[#656d76]">Bug</p>
          <p className="text-2xl font-semibold tabular-nums text-[#cf1322]">
            {summary.openBug}
          </p>
        </div>
        <div className="rounded-lg border border-[#d1d9e0] bg-white px-4 py-3">
          <p className="text-xs text-[#656d76]">未能解答</p>
          <p className="text-2xl font-semibold tabular-nums">{summary.openQuestion}</p>
        </div>
        <div className="rounded-lg border border-[#d1d9e0] bg-white px-4 py-3">
          <p className="text-xs text-[#656d76]">24h 新增</p>
          <p className="text-2xl font-semibold tabular-nums">{summary.last24h}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#d1d9e0] px-4 py-8 text-center text-sm text-[#656d76]">
          暂无待处理反馈
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-[#d1d9e0] bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-[#f6f8fa] px-2 py-0.5 font-medium text-[#1f2328]">
                    {CATEGORY_LABEL[item.category] ?? item.category}
                  </span>
                  <span className="text-[#656d76]">{fmtTime(item.createdAt)}</span>
                  {item.sourceApp ? (
                    <span className="text-[#656d76]">· {item.sourceApp}</span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.category === "QUESTION" && onAddAsQa ? (
                    <button
                      type="button"
                      onClick={() => onAddAsQa(item)}
                      className="rounded-md border border-[#0969da] px-2.5 py-1 text-xs font-medium text-[#0969da] hover:bg-[#f0f6ff]"
                    >
                      添加为问答
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void markReviewed(item.id)}
                    className="rounded-md border border-[#d1d9e0] px-2.5 py-1 text-xs font-medium text-[#1f2328] hover:border-[#0969da] hover:text-[#0969da]"
                  >
                    标为已阅
                  </button>
                </div>
              </div>
              <p className="mt-2 text-sm font-medium text-[#1f2328]">
                {item.user.name || item.user.email || item.user.id}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[#1f2328]">
                {item.userMessage}
              </p>
              {item.assistantReply ? (
                <p className="mt-2 whitespace-pre-wrap text-xs text-[#656d76]">
                  小智：{item.assistantReply.slice(0, 400)}
                  {item.assistantReply.length > 400 ? "…" : ""}
                </p>
              ) : null}
              {item.pageUrl ? (
                <p className="mt-1 truncate text-xs text-[#656d76]">来源：{item.pageUrl}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
