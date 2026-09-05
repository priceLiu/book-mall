"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import type { AdminAssistantModelConfigPayload } from "@/app/api/admin/platform-assistant/model-config/route";
import { AdminAssistantAiNewsPanel } from "@/components/admin/admin-assistant-ai-news-panel";
import { AdminAssistantFeedbackPanel } from "@/components/admin/admin-assistant-feedback-panel";
import { AdminAssistantModelConfigPanel } from "@/components/admin/admin-assistant-model-config-panel";
import type { AssistantFeedbackListItem } from "@/lib/platform-assistant/feedback-service";
import type { PlatformAssistantQaEntryView } from "@/lib/platform-assistant/qa-service";

const inputCls =
  "w-full rounded-md border border-[#d1d9e0] bg-white px-3 py-2 text-sm text-[#1f2328] focus:border-[#0969da] focus:outline-none";

const MATCH_MODE_LABEL = {
  CONTAINS: "包含匹配",
  EXACT: "完全匹配",
  KEYWORDS: "关键词匹配",
} as const;

type TabId = "qa" | "feedback" | "settings";

type QaDraft = {
  question: string;
  answer: string;
  enabled: boolean;
  sortOrder: number;
  matchMode: "CONTAINS" | "EXACT" | "KEYWORDS";
  matchKeywords: string;
  adminNote: string;
  sourceFeedbackId: string | null;
};

const EMPTY_DRAFT: QaDraft = {
  question: "",
  answer: "",
  enabled: true,
  sortOrder: 0,
  matchMode: "CONTAINS",
  matchKeywords: "",
  adminNote: "",
  sourceFeedbackId: null,
};

function fmtTime(d: Date | string) {
  return new Date(d).toLocaleString("zh-CN");
}

function draftFromEntry(entry: PlatformAssistantQaEntryView): QaDraft {
  return {
    question: entry.question,
    answer: entry.answer,
    enabled: entry.enabled,
    sortOrder: entry.sortOrder,
    matchMode: entry.matchMode,
    matchKeywords: entry.matchKeywords.join("，"),
    adminNote: entry.adminNote ?? "",
    sourceFeedbackId: entry.sourceFeedbackId,
  };
}

function AdminAssistantQaPanel({
  initialItems,
  initialSummary,
  promoteDraft,
  onPromoteConsumed,
}: {
  initialItems: PlatformAssistantQaEntryView[];
  initialSummary: { total: number; enabled: number };
  promoteDraft?: Pick<QaDraft, "question" | "sourceFeedbackId"> | null;
  onPromoteConsumed?: () => void;
}) {
  const [items, setItems] = useState(initialItems);
  const [summary, setSummary] = useState(initialSummary);
  const [draft, setDraft] = useState<QaDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!promoteDraft?.question) return;
    setDraft((prev) => ({
      ...prev,
      question: promoteDraft.question,
      sourceFeedbackId: promoteDraft.sourceFeedbackId ?? null,
    }));
    setEditingId(null);
    setMessage("已从用户反馈填入问题，请补充固定回答后保存。");
    onPromoteConsumed?.();
  }, [promoteDraft, onPromoteConsumed]);

  const formTitle = editingId ? "编辑问答" : "新增问答";

  function resetForm() {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setError(null);
  }

  function startEdit(entry: PlatformAssistantQaEntryView) {
    setEditingId(entry.id);
    setDraft(draftFromEntry(entry));
    setError(null);
    setMessage(null);
  }

  async function refreshList() {
    const res = await fetch("/api/admin/platform-assistant/qa", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as {
      items: PlatformAssistantQaEntryView[];
      summary: { total: number; enabled: number };
    };
    setItems(data.items);
    setSummary(data.summary);
  }

  async function saveEntry() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        ...draft,
        matchKeywords: draft.matchKeywords
          .split(/[,，\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
      };
      const res = await fetch(
        editingId
          ? `/api/admin/platform-assistant/qa/${editingId}`
          : "/api/admin/platform-assistant/qa",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "保存失败");
        return;
      }
      setMessage(editingId ? "已更新问答" : "已新增问答");
      resetForm();
      await refreshList();
      onPromoteConsumed?.();
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(id: string) {
    const res = await fetch(`/api/admin/platform-assistant/qa/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) return;
    setConfirmDeleteId(null);
    if (editingId === id) resetForm();
    await refreshList();
  }

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return b.sortOrder - a.sortOrder;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }),
    [items],
  );

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[#1f2328]">问答库</h2>
        <p className="mt-0.5 text-sm text-[#656d76]">
          维护小智的固定回答。用户提问命中后<strong>直接返回</strong>此处内容，不再走模型。
          价格 / 计费 / 财务类问题仍按原有规则引导至报价页，不可在此维护。
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[#d1d9e0] bg-white px-4 py-3">
          <p className="text-xs text-[#656d76]">问答总数</p>
          <p className="text-2xl font-semibold tabular-nums">{summary.total}</p>
        </div>
        <div className="rounded-lg border border-[#d1d9e0] bg-white px-4 py-3">
          <p className="text-xs text-[#656d76]">已启用</p>
          <p className="text-2xl font-semibold tabular-nums text-[#0969da]">
            {summary.enabled}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-[#d1d9e0] bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium text-[#1f2328]">{formTitle}</h3>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-[#656d76] hover:text-[#0969da]"
            >
              取消编辑
            </button>
          ) : null}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="text-[#656d76]">问题 / 匹配文案</span>
            <textarea
              className={`${inputCls} min-h-[88px] resize-y`}
              value={draft.question}
              onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))}
              placeholder="例如：这个平台国内有吗？"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-[#656d76]">固定回答</span>
            <textarea
              className={`${inputCls} min-h-[88px] resize-y`}
              value={draft.answer}
              onChange={(e) => setDraft((d) => ({ ...d, answer: e.target.value }))}
              placeholder="用户命中后将看到此内容"
            />
          </label>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block space-y-1 text-sm">
            <span className="text-[#656d76]">匹配方式</span>
            <select
              className={inputCls}
              value={draft.matchMode}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  matchMode: e.target.value as QaDraft["matchMode"],
                }))
              }
            >
              <option value="CONTAINS">包含匹配（推荐）</option>
              <option value="EXACT">完全匹配</option>
              <option value="KEYWORDS">关键词匹配</option>
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-[#656d76]">优先级</span>
            <input
              type="number"
              className={inputCls}
              value={draft.sortOrder}
              onChange={(e) =>
                setDraft((d) => ({ ...d, sortOrder: Number(e.target.value) || 0 }))
              }
            />
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
              className="h-4 w-4 rounded border-[#d1d9e0]"
            />
            启用
          </label>
        </div>

        {draft.matchMode === "KEYWORDS" ? (
          <label className="mt-3 block space-y-1 text-sm">
            <span className="text-[#656d76]">关键词（逗号分隔，须全部命中）</span>
            <input
              className={inputCls}
              value={draft.matchKeywords}
              onChange={(e) => setDraft((d) => ({ ...d, matchKeywords: e.target.value }))}
              placeholder="平台，国内"
            />
          </label>
        ) : null}

        <label className="mt-3 block space-y-1 text-sm">
          <span className="text-[#656d76]">管理员备注（可选）</span>
          <input
            className={inputCls}
            value={draft.adminNote}
            onChange={(e) => setDraft((d) => ({ ...d, adminNote: e.target.value }))}
          />
        </label>

        {error ? <p className="mt-3 text-sm text-[#cf1322]">{error}</p> : null}
        {message ? <p className="mt-3 text-sm text-[#1a7f37]">{message}</p> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveEntry()}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0969da] px-3 py-2 text-sm font-medium text-white hover:bg-[#0860ca] disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {editingId ? "保存修改" : "添加问答"}
          </button>
        </div>
      </div>

      {sortedItems.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#d1d9e0] px-4 py-8 text-center text-sm text-[#656d76]">
          暂无问答条目。可从下方「用户反馈」中将未能解答的问题添加为问答。
        </p>
      ) : (
        <ul className="space-y-3">
          {sortedItems.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-[#d1d9e0] bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${
                      item.enabled
                        ? "bg-[#ddf4ff] text-[#0969da]"
                        : "bg-[#f6f8fa] text-[#656d76]"
                    }`}
                  >
                    {item.enabled ? "启用" : "停用"}
                  </span>
                  <span className="text-[#656d76]">
                    {MATCH_MODE_LABEL[item.matchMode]}
                  </span>
                  <span className="text-[#656d76]">优先级 {item.sortOrder}</span>
                  <span className="text-[#656d76]">· 更新 {fmtTime(item.updatedAt)}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="inline-flex items-center gap-1 rounded-md border border-[#d1d9e0] px-2.5 py-1 text-xs font-medium hover:border-[#0969da] hover:text-[#0969da]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(item.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-[#d1d9e0] px-2.5 py-1 text-xs font-medium text-[#cf1322] hover:border-[#cf1322]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </button>
                </div>
              </div>
              {confirmDeleteId === item.id ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-[#fff8f8] px-3 py-2 text-xs">
                  <span className="text-[#cf1322]">确定删除？删除后小智不再使用该固定回答。</span>
                  <button
                    type="button"
                    onClick={() => void removeEntry(item.id)}
                    className="rounded border border-[#cf1322] px-2 py-0.5 font-medium text-[#cf1322]"
                  >
                    确认删除
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="rounded border border-[#d1d9e0] px-2 py-0.5 text-[#656d76]"
                  >
                    取消
                  </button>
                </div>
              ) : null}
              <p className="mt-2 text-sm font-medium text-[#1f2328]">问：{item.question}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[#656d76]">
                答：{item.answer}
              </p>
              {item.matchMode === "KEYWORDS" && item.matchKeywords.length > 0 ? (
                <p className="mt-1 text-xs text-[#656d76]">
                  关键词：{item.matchKeywords.join("、")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AdminPlatformAssistantClient({
  qaItems,
  qaSummary,
  feedbackItems,
  feedbackSummary,
  modelConfig,
  aiNewsRows,
}: {
  qaItems: PlatformAssistantQaEntryView[];
  qaSummary: { total: number; enabled: number };
  feedbackItems: AssistantFeedbackListItem[];
  feedbackSummary: {
    openTotal: number;
    openBug: number;
    openQuestion: number;
    last24h: number;
  };
  modelConfig: AdminAssistantModelConfigPayload;
  aiNewsRows: Awaited<ReturnType<typeof import("@/lib/platform-assistant/ai-news-service").listRecentAiNewsDaily>>;
}) {
  const [tab, setTab] = useState<TabId>("qa");
  const [promoteDraft, setPromoteDraft] = useState<Pick<
    QaDraft,
    "question" | "sourceFeedbackId"
  > | null>(null);

  const tabs: { id: TabId; label: string }[] = [
    { id: "qa", label: "问答库" },
    { id: "feedback", label: "用户反馈" },
    { id: "settings", label: "模型与热闻" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-[#d1d9e0] pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === t.id
                ? "bg-[#0969da] text-white"
                : "text-[#656d76] hover:bg-[#f6f8fa] hover:text-[#1f2328]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "qa" ? (
        <AdminAssistantQaPanel
          initialItems={qaItems}
          initialSummary={qaSummary}
          promoteDraft={promoteDraft}
          onPromoteConsumed={() => setPromoteDraft(null)}
        />
      ) : null}

      {tab === "feedback" ? (
        <AdminAssistantFeedbackPanel
          initialItems={feedbackItems}
          summary={feedbackSummary}
          onAddAsQa={(item) => {
            setPromoteDraft({
              question: item.userMessage,
              sourceFeedbackId: item.id,
            });
            setTab("qa");
          }}
        />
      ) : null}

      {tab === "settings" ? (
        <div className="space-y-8">
          <AdminAssistantModelConfigPanel initial={modelConfig} />
          <AdminAssistantAiNewsPanel rows={aiNewsRows} />
        </div>
      ) : null}
    </div>
  );
}
