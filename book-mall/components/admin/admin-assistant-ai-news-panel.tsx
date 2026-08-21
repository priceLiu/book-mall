"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PlatformAssistantAiNewsStatus } from "@prisma/client";
import { Loader2 } from "lucide-react";

const STATUS_LABEL: Record<PlatformAssistantAiNewsStatus, string> = {
  READY: "已就绪",
  FAILED: "失败",
};

function fmtTime(d: Date | string) {
  return new Date(d).toLocaleString("zh-CN");
}

export function AdminAssistantAiNewsPanel({
  rows,
}: {
  rows: {
    dateKey: string;
    status: PlatformAssistantAiNewsStatus;
    generatedAt: Date | string;
    errorMessage: string | null;
  }[];
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const onGenerate = async () => {
    setGenerating(true);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/platform-assistant/ai-news/generate", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "生成失败");
      }
      router.refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1f2328]">AI 小智 · 热闻预生成</h2>
          <p className="mt-0.5 text-sm text-[#656d76]">
            经 Gateway DeepSeek 生成，写入 DB 后全站只读；保留最近 3 天
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onGenerate()}
          disabled={generating}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0969da] px-4 py-2 text-sm font-medium text-white hover:bg-[#0550ae] disabled:opacity-60"
        >
          {generating ? <Loader2 className="size-4 animate-spin" /> : null}
          {generating ? "正在生成…" : "立即生成今日热闻"}
        </button>
      </div>

      {actionError ? (
        <p className="rounded-lg border border-[#ff818266] bg-[#ffebe9] px-3 py-2 text-sm text-[#cf222e]">
          {actionError}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#d1d9e0] px-4 py-8 text-center text-sm text-[#656d76]">
          尚无热闻记录，点击上方按钮生成（需 Gateway 已登记 DeepSeek 模型）
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.dateKey}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d1d9e0] bg-white px-4 py-3 text-sm"
            >
              <div>
                <span className="font-medium text-[#1f2328]">{row.dateKey}</span>
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                    row.status === "READY"
                      ? "bg-[#dafbe1] text-[#116329]"
                      : "bg-[#ffebe9] text-[#cf222e]"
                  }`}
                >
                  {STATUS_LABEL[row.status]}
                </span>
              </div>
              <span className="text-xs text-[#656d76]">{fmtTime(row.generatedAt)}</span>
              {row.errorMessage ? (
                <p className="w-full truncate text-xs text-[#cf222e]">{row.errorMessage}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
