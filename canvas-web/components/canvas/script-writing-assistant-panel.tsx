"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileInput,
  Loader2,
  MessageSquareText,
  Send,
} from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { StoryErrorLine } from "@/components/canvas/story-status-line";
import {
  clearScriptAssistantHistory,
  getScriptAssistantHistory,
  saveScriptAssistantHistory,
  streamScriptAssistantChat,
  type ScriptAssistantMessage,
} from "@/lib/canvas-api";
import { STORY_CHROME_GREEN_CLASS } from "@/lib/canvas/story-column-sync";
import { cn } from "@/lib/utils";

type ChatMessage = ScriptAssistantMessage;

function newMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ScriptWritingAssistantPanel({
  projectId,
  scriptFinalized,
  hasScript,
  onImportScript,
}: {
  projectId: string;
  scriptFinalized: boolean;
  /** 已有上传/解析剧本时默认折叠 */
  hasScript: boolean;
  onImportScript: (markdown: string) => void;
}) {
  const base = useBookMallBaseUrl();
  const [open, setOpen] = useState(() => !hasScript && !scriptFinalized);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const persistRef = useRef(false);

  useEffect(() => {
    setOpen(!hasScript && !scriptFinalized);
  }, [hasScript, scriptFinalized]);

  useEffect(() => {
    if (!base?.trim() || !projectId || scriptFinalized) {
      setMessages([]);
      return;
    }
    setLoadingHistory(true);
    void getScriptAssistantHistory(base, projectId)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoadingHistory(false));
  }, [base, projectId, scriptFinalized]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  const persistIfNeeded = useCallback(
    async (next: ChatMessage[]) => {
      if (scriptFinalized || !base?.trim() || !projectId) return;
      if (persistRef.current) return;
      persistRef.current = true;
      try {
        await saveScriptAssistantHistory(base, projectId, next);
      } catch {
        /* ignore persist errors */
      } finally {
        persistRef.current = false;
      }
    },
    [base, projectId, scriptFinalized],
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !base?.trim()) return;

    const userMsg: ChatMessage = {
      id: newMessageId("u"),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    const assistantId = newMessageId("a");
    const historyForApi = [...messages, userMsg].map(({ role, content }) => ({
      role,
      content,
    }));

    setInput("");
    setChatError(null);
    setSending(true);
    const withAssistant = [
      ...messages,
      userMsg,
      {
        id: assistantId,
        role: "assistant" as const,
        content: "",
        createdAt: new Date().toISOString(),
      },
    ];
    setMessages(withAssistant);
    scrollToBottom();

    try {
      const res = await streamScriptAssistantChat(base, historyForApi);
      if (!res.ok) {
        let msg = `请求失败（HTTP ${res.status}）`;
        try {
          const j = (await res.json()) as { message?: string; error?: string };
          msg = j.message ?? j.error ?? msg;
        } catch {
          /* ignore */
        }
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: msg } : m)),
        );
        setChatError(msg);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setChatError("无法读取响应流");
        return;
      }

      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const chunk = acc;
        flushSync(() => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: chunk } : m,
            ),
          );
        });
        scrollToBottom();
      }
      acc += decoder.decode();
      const finalText = acc.trimEnd() || "（模型未返回正文）";
      const finalMessages = withAssistant.map((m) =>
        m.id === assistantId ? { ...m, content: finalText } : m,
      );
      setMessages(finalMessages);
      await persistIfNeeded(finalMessages);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setChatError(msg);
    } finally {
      setSending(false);
    }
  }, [
    base,
    input,
    messages,
    persistIfNeeded,
    scrollToBottom,
    sending,
  ]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  const copyLast = async () => {
    const text = lastAssistant?.content?.trim();
    if (!text) return;
    await navigator.clipboard.writeText(text);
  };

  const downloadLast = () => {
    const text = lastAssistant?.content?.trim();
    if (!text) return;
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `script-draft-${projectId.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(href);
  };

  const importLast = () => {
    const text = lastAssistant?.content?.trim();
    if (!text) return;
    onImportScript(text);
  };

  if (!open) {
    return (
      <button
        type="button"
        className="nodrag absolute left-3 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-1 rounded-r-lg border border-l-0 border-emerald-400/30 bg-[var(--canvas-surface)]/95 px-1.5 py-3 text-[10px] text-emerald-200 shadow-lg hover:border-emerald-400/50"
        title="展开剧本创作助手"
        onClick={() => setOpen(true)}
      >
        <MessageSquareText className="size-4" />
        <span className="writing-vertical-rl [writing-mode:vertical-rl]">
          剧本创作助手
        </span>
        <ChevronRight className="size-3.5" />
      </button>
    );
  }

  return (
    <aside
      className="nodrag relative z-30 flex w-[320px] shrink-0 flex-col border-r border-white/10 bg-[var(--canvas-surface)]/98"
      aria-label="剧本创作助手"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="min-w-0">
          <p className={`truncate text-[12px] font-medium ${STORY_CHROME_GREEN_CLASS}`}>
            剧本创作助手
          </p>
          <p className="text-[9px] text-white/40">
            deepseek-chat ·{" "}
            {scriptFinalized ? "定稿后对话不保存" : "定稿前自动保存历史"}
          </p>
        </div>
        <button
          type="button"
          className="rounded p-1 text-white/50 hover:bg-white/5 hover:text-white"
          title="折叠"
          onClick={() => setOpen(false)}
        >
          <ChevronLeft className="size-4" />
        </button>
      </header>

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2 text-[11px]"
      >
        {loadingHistory ? (
          <p className="text-white/40">加载历史…</p>
        ) : messages.length === 0 ? (
          <p className="leading-relaxed text-amber-300/80">
            描述你的故事创意、类型、集数或角色，我会帮你起草 Markdown 剧本大纲。生成后可「导入到启动节点」或自行上传 .md。
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "rounded-md px-2 py-1.5 leading-relaxed whitespace-pre-wrap",
                m.role === "user"
                  ? "ml-4 bg-emerald-500/10 text-emerald-50"
                  : "mr-2 bg-black/30 text-white/85",
              )}
            >
              {m.content ||
                (sending && m.role === "assistant" ? (
                  <span className="inline-flex items-center gap-0.5 text-white/45">
                    <span className="inline-block size-1.5 animate-pulse rounded-full bg-emerald-400/80" />
                    正在输入…
                  </span>
                ) : (
                  ""
                ))}
              {sending &&
              m.role === "assistant" &&
              m.content &&
              m.id === messages[messages.length - 1]?.id ? (
                <span
                  className="ml-0.5 inline-block w-0.5 animate-pulse bg-emerald-300/90 align-middle"
                  style={{ height: "0.85em" }}
                  aria-hidden
                />
              ) : null}
            </div>
          ))
        )}
      </div>

      {chatError ? <StoryErrorLine message={chatError} className="mx-3 mb-1" /> : null}

      {lastAssistant?.content?.trim() ? (
        <div className="flex shrink-0 flex-wrap gap-1 border-t border-white/8 px-2 py-1.5">
          <button
            type="button"
            className="inline-flex items-center gap-0.5 rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-white/70 hover:bg-white/5"
            onClick={() => void copyLast()}
          >
            <Copy className="size-3" /> 复制
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-0.5 rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-white/70 hover:bg-white/5"
            onClick={downloadLast}
          >
            <Download className="size-3" /> 下载 .md
          </button>
          {!scriptFinalized ? (
            <button
              type="button"
              className="inline-flex items-center gap-0.5 rounded border border-emerald-400/30 px-1.5 py-0.5 text-[9px] text-emerald-200 hover:bg-emerald-500/10"
              onClick={importLast}
            >
              <FileInput className="size-3" /> 导入启动节点
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="shrink-0 border-t border-white/10 p-2">
        <div className="flex gap-1.5">
          <textarea
            value={input}
            rows={2}
            placeholder="描述剧本需求…"
            className="min-h-[52px] flex-1 resize-none rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] text-white placeholder:text-white/30 focus:border-emerald-400/40 focus:outline-none"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            disabled={sending}
          />
          <button
            type="button"
            disabled={sending || !input.trim()}
            className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-40"
            onClick={() => void send()}
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}

/** 故事定稿时由 hub 节点调用 */
export async function clearScriptAssistantOnFinalize(
  base: string,
  projectId: string,
): Promise<void> {
  try {
    await clearScriptAssistantHistory(base, projectId);
  } catch {
    /* ignore */
  }
}
