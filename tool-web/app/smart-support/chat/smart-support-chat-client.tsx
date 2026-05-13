"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { Bot, MessageSquareText } from "lucide-react";
import { getUdifyChatbotEmbedUrl } from "@/lib/dify-embed-url";
import { ToolImplementationCrossLink } from "@/components/tool-implementation-crosslink";
import { useToolsSession } from "@/components/tool-shell-client";
import styles from "./smart-support-chat.module.css";

type ChatMessage = { id: string; role: "user" | "assistant"; text: string };

export function SmartSupportChatClient({
  renewHref,
  mainOrigin,
}: {
  renewHref: string | null;
  mainOrigin: string | null;
}) {
  const { loading, session } = useToolsSession();
  const originConfigured =
    typeof mainOrigin === "string" && mainOrigin.trim().length > 0;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const difyToken = process.env.NEXT_PUBLIC_DIFY_EMBED_TOKEN?.trim() || "";

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !session.active) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text,
    };
    const assistantId = `a-${Date.now() + 1}`;
    const historyForApi = [...messages, userMsg].map(({ role, text: c }) => ({
      role,
      content: c,
    }));

    setInput("");
    setChatError(null);
    setSending(true);
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: "assistant", text: "" },
    ]);
    scrollToBottom();

    try {
      const res = await fetch("/api/smart-support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historyForApi }),
      });

      if (!res.ok) {
        let msg = `请求失败（HTTP ${res.status}）`;
        try {
          const j = (await res.json()) as { error?: string };
          if (typeof j.error === "string") msg = j.error;
        } catch {
          /* ignore */
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, text: msg } : m,
          ),
        );
        setChatError(msg);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        const fallback = "无法读取响应流";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, text: fallback } : m,
          ),
        );
        setChatError(fallback);
        return;
      }

      const decoder = new TextDecoder();
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const chunk = acc;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, text: chunk } : m,
          ),
        );
        scrollToBottom();
      }
      acc += decoder.decode();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, text: acc.trimEnd() || "（模型未返回正文）" }
            : m,
        ),
      );
      scrollToBottom();
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "网络异常，请稍后重试";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, text: `错误：${msg}` } : m,
        ),
      );
      setChatError(msg);
    } finally {
      setSending(false);
    }
  }, [input, sending, session.active, messages, scrollToBottom]);

  return (
    <div className={styles.workspace}>
      <header className={styles.headerRow}>
        <h1 style={{ margin: 0 }}>我的智能客服</h1>
        <ToolImplementationCrossLink href="/smart-support/implementation" />
        <p className="tw-muted" style={{ margin: "0.35rem 0 0" }}>
          <Link href="/smart-support">返回 AI智能客服首页</Link>
        </p>
      </header>

      {loading ? (
        <p className="tw-muted" role="status">
          正在同步会话…
        </p>
      ) : !session.active ? (
        <div className="tw-note">
          <p style={{ margin: "0 0 0.5rem" }}>
            请先登录工具站后再使用 AI智能客服。
          </p>
          {renewHref ? (
            <p style={{ margin: 0 }}>
              <Link href={renewHref}>从主站重新连接</Link>
            </p>
          ) : null}
          {originConfigured ? (
            <p className="tw-muted" style={{ margin: "0.5rem 0 0", fontSize: "0.85rem" }}>
              <Link href={`${mainOrigin}/account`}>个人中心</Link>
            </p>
          ) : null}
        </div>
      ) : (
        <div className={styles.grid}>
          <section className={styles.panel} aria-labelledby="deepseek-panel-title">
            <div className={styles.panelHeader}>
              <div className={styles.botIconWrap} aria-hidden>
                <Bot className="h-6 w-6" strokeWidth={2} />
              </div>
              <div>
                <h2 id="deepseek-panel-title" className={styles.panelTitle}>
                  DeepSeek · AI智能客服
                </h2>
                <p className={styles.panelSubtitle}>
                  流式输出 · 多轮上下文 · 模型 deepseek-chat
                </p>
              </div>
            </div>

            <div className={styles.panelBody}>
              {chatError ? (
                <p className={styles.errorBanner} role="alert">
                  {chatError}
                </p>
              ) : null}

              <div
                ref={listRef}
                className={styles.messageList}
                aria-live="polite"
                aria-relevant="additions text"
              >
                {messages.length === 0 ? (
                  <p className={styles.emptyHint}>
                    您好，我是基于 DeepSeek 的 AI智能客服。可直接询问订阅、余额、试衣间、文生图等问题；支持多轮追问。
                  </p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={
                        m.role === "user"
                          ? styles.bubbleUser
                          : `${styles.bubbleAssistant}${sending && m.text === "" ? ` ${styles.bubbleAssistantStreaming}` : ""}`
                      }
                    >
                      {m.role === "assistant" && m.text === "" && sending
                        ? "…"
                        : m.text}
                    </div>
                  ))
                )}
              </div>

              <div className={styles.composeRow}>
                <textarea
                  className={styles.textarea}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="输入您的问题…（Shift+Enter 换行）"
                  rows={3}
                  disabled={sending}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                />
                <button
                  type="button"
                  className={styles.sendBtn}
                  onClick={() => void send()}
                  disabled={sending || !input.trim()}
                >
                  {sending ? "生成中…" : "发送"}
                </button>
              </div>
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="dify-panel-title">
            <div className={`${styles.panelHeader} ${styles.panelHeaderDify}`}>
              <div className={styles.difyIconWrap} aria-hidden>
                <MessageSquareText className="h-6 w-6" strokeWidth={2} />
              </div>
              <div>
                <h2 id="dify-panel-title" className={styles.panelTitle}>
                  Dify · AI智能客服
                </h2>
                <p className={styles.panelSubtitle}>
                  Udify 嵌入 · 工作流 / 知识库由 Dify 控制台配置
                </p>
              </div>
            </div>
            <div className={styles.difyPanelBody}>
              {!difyToken ? (
                <div className="tw-note" style={{ margin: 0 }}>
                  <p style={{ margin: "0 0 0.35rem", fontSize: "0.85rem" }}>
                    未配置 <code>NEXT_PUBLIC_DIFY_EMBED_TOKEN</code>
                    （与 <code>doc/dify.md</code> 发布嵌入代码中的 token 一致）。修改{" "}
                    <code>.env.local</code> 后请<strong>重启</strong>
                    <code>pnpm dev</code>。
                  </p>
                </div>
              ) : (
                <iframe
                  title="Dify · AI智能客服"
                  className={styles.difyIframe}
                  src={getUdifyChatbotEmbedUrl(difyToken)}
                  allow="clipboard-write; microphone *"
                />
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
