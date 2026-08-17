"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  buildAssistantGreeting,
  parseDisplayName,
} from "./greeting";

export type PlatformAssistantProps = {
  /** 对话端点。子站默认经 BFF 代理到主站。 */
  chatEndpoint?: string;
  /** 读取当前用户昵称/用户名（子站默认 tools-session；主站传 /api/auth/session）。 */
  userSessionEndpoint?: string;
  /** 悬浮球头像图片 URL（不传则用默认渐变头像）。 */
  avatarSrc?: string;
  /** 抽屉标题。 */
  title?: string;
  /** 主题强调色。 */
  accentColor?: string;
  /** 自定义欢迎语；不传则按昵称 + 每日轮换自动生成。 */
  greeting?: string;
};

type Redirect = {
  app: string;
  title: string;
  description: string;
  url: string;
};

type Msg = {
  role: "user" | "assistant";
  content: string;
  redirect?: Redirect | null;
};

const DEFAULT_ENDPOINT = "/api/book-mall/api/platform-assistant/chat";
const DEFAULT_USER_SESSION = "/api/tools-session";

const STYLE_ID = "platform-assistant-styles";
const POSITION_KEY = "platform-assistant-ball-pos";
const BALL_SIZE = 56;
const EDGE_GAP = 12;
/** 判定为「拖拽」而非「点击」的最小位移（px） */
const DRAG_THRESHOLD = 4;

type BallPos = { x: number; y: number };

function clampToViewport(x: number, y: number): BallPos {
  if (typeof window === "undefined") return { x, y };
  const maxX = window.innerWidth - BALL_SIZE - EDGE_GAP;
  const maxY = window.innerHeight - BALL_SIZE - EDGE_GAP;
  return {
    x: Math.min(Math.max(EDGE_GAP, x), Math.max(EDGE_GAP, maxX)),
    y: Math.min(Math.max(EDGE_GAP, y), Math.max(EDGE_GAP, maxY)),
  };
}

function SparklesIcon({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </svg>
  );
}

function SendIcon({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m22 2-7 20-4-9-9-4z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function useInjectStyles(accent: string) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    const css = `
@keyframes pa-pop { from { transform: scale(.6); opacity: 0 } to { transform: scale(1); opacity: 1 } }
@keyframes pa-slide { from { transform: translateX(24px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
@keyframes pa-blink { 0%,80%,100% { opacity: .2 } 40% { opacity: 1 } }
.pa-root { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif; }
.pa-ball {
  position: fixed;
  width: ${BALL_SIZE}px;
  height: ${BALL_SIZE}px;
  border-radius: 50%;
  border: none;
  cursor: grab;
  padding: 0;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  box-shadow: 0 6px 24px rgba(99,102,241,.35);
  z-index: 2147483000;
  animation: pa-pop .25s ease;
}
.pa-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147482999;
  background: rgba(15, 23, 42, 0.35);
}
.pa-drawer {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: min(400px, 92vw);
  display: flex;
  flex-direction: column;
  z-index: 2147483000;
  animation: pa-slide .22s ease;
  background: linear-gradient(to bottom, #18181b, #09090b);
  color: #f4f4f5;
  border-left: 1px solid rgba(255,255,255,.08);
  box-shadow: -8px 0 40px rgba(0,0,0,.45);
}
.pa-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255,255,255,.06);
}
.pa-header-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: linear-gradient(135deg, ${accent}, #8b5cf6);
}
.pa-header-title {
  flex: 1;
  min-width: 0;
}
.pa-header-title h3 {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin: 0;
  line-height: 1.3;
}
.pa-header-title p {
  font-size: 12px;
  color: rgba(255,255,255,.4);
  margin: 2px 0 0;
  line-height: 1.3;
}
.pa-close {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
  color: rgba(255,255,255,.5);
  padding: 4px;
  border-radius: 8px;
  transition: color .15s, background .15s;
}
.pa-close:hover {
  color: #fff;
  background: rgba(255,255,255,.08);
}
.pa-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scrollbar-width: thin;
  scrollbar-color: rgba(161,161,170,.45) transparent;
}
.pa-scroll::-webkit-scrollbar { width: 5px; }
.pa-scroll::-webkit-scrollbar-track { background: transparent; }
.pa-scroll::-webkit-scrollbar-thumb {
  background: rgba(161,161,170,.45);
  border-radius: 999px;
}
.pa-scroll::-webkit-scrollbar-thumb:hover { background: rgba(161,161,170,.65); }
.pa-row { display: flex; width: 100%; }
.pa-row-user { justify-content: flex-end; }
.pa-row-assistant { justify-content: flex-start; }
.pa-msg-wrap { max-width: 82%; }
.pa-msg-row { display: flex; align-items: flex-end; gap: 8px; }
.pa-msg-row-user { flex-direction: row-reverse; }
.pa-msg-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
}
.pa-bubble {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
  font-size: 14px;
  padding: 10px 14px;
  border-radius: 16px;
}
.pa-bubble-user {
  background: linear-gradient(to right, #4f46e5, #7c3aed);
  color: #fff;
  box-shadow: 0 8px 24px -4px rgba(99,102,241,.4);
}
.pa-bubble-assistant {
  background: rgba(39,39,42,.9);
  color: #f4f4f5;
  border: 1px solid rgba(255,255,255,.1);
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 12px -2px rgba(0,0,0,.3);
}
.pa-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255,255,255,.6);
  display: inline-block;
  margin: 0 2px;
  animation: pa-blink 1.4s infinite both;
}
.pa-card {
  display: block;
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(39,39,42,.9);
  border: 1px solid rgba(99,102,241,.3);
  text-decoration: none;
  color: #f4f4f5;
  transition: box-shadow .15s ease, border-color .15s ease;
}
.pa-card:hover {
  box-shadow: 0 4px 14px rgba(99,102,241,.2);
  border-color: rgba(99,102,241,.5);
}
.pa-card-title {
  font-weight: 600;
  font-size: 13px;
  color: #a5b4fc;
}
.pa-card-desc {
  font-size: 12px;
  color: rgba(255,255,255,.5);
  margin-top: 2px;
}
.pa-input-bar {
  border-top: 1px solid rgba(255,255,255,.06);
  padding: 12px;
  background: rgba(24,24,27,.95);
}
.pa-input-shell {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,.1);
  background: rgba(39,39,42,.5);
  padding: 8px 10px;
  backdrop-filter: blur(8px);
  transition: border-color .15s, background .15s;
}
.pa-input-shell:focus-within {
  border-color: rgba(255,255,255,.2);
  background: rgba(39,39,42,.7);
}
.pa-input {
  flex: 1;
  resize: none;
  max-height: 120px;
  min-height: 36px;
  padding: 4px 6px;
  border: none;
  outline: none;
  font-size: 14px;
  line-height: 1.5;
  font-family: inherit;
  background: transparent;
  color: #fff;
}
.pa-input::placeholder { color: rgba(255,255,255,.3); }
.pa-send {
  border: none;
  border-radius: 8px;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background .15s, filter .15s;
}
.pa-send:disabled { cursor: not-allowed; }
.pa-send-active {
  background: #4f46e5;
  color: #fff;
}
.pa-send-active:hover { filter: brightness(1.08); }
.pa-send-idle {
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.3);
}
`;
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = css;
  }, [accent]);
}

export function PlatformAssistant({
  chatEndpoint = DEFAULT_ENDPOINT,
  userSessionEndpoint = DEFAULT_USER_SESSION,
  avatarSrc,
  title = "AI 小智",
  accentColor = "#4f46e5",
  greeting,
}: PlatformAssistantProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [greetingReady, setGreetingReady] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [ballPos, setBallPos] = useState<BallPos | null>(null);
  const ballRef = useRef<HTMLButtonElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  useInjectStyles(accentColor);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(POSITION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as BallPos;
        if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
          setBallPos(clampToViewport(parsed.x, parsed.y));
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!ballPos) return;
    const onResize = () => setBallPos((p) => (p ? clampToViewport(p.x, p.y) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [ballPos]);

  const onBallPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const rect = ballRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: rect.left,
      originY: rect.top,
      moved: false,
    };
    ballRef.current?.setPointerCapture(e.pointerId);
  };

  const onBallPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    setBallPos(clampToViewport(d.originX + dx, d.originY + dy));
  };

  const onBallPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    try {
      ballRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!d) return;
    if (d.moved) {
      setBallPos((p) => {
        if (p) {
          try {
            localStorage.setItem(POSITION_KEY, JSON.stringify(p));
          } catch {
            /* ignore */
          }
        }
        return p;
      });
    } else {
      setOpen(true);
    }
  };

  useEffect(() => {
    if (!open || messages.length > 0 || greetingReady) return;
    let cancelled = false;
    void (async () => {
      if (greeting) {
        if (!cancelled) {
          setMessages([{ role: "assistant", content: greeting }]);
          setGreetingReady(true);
        }
        return;
      }
      let displayName: string | null = null;
      try {
        const res = await fetch(userSessionEndpoint, {
          credentials: "include",
          cache: "no-store",
        });
        if (res.ok) {
          displayName = parseDisplayName(await res.json());
        }
      } catch {
        /* 未登录或子站无 session 端点时仍给出通用问候 */
      }
      if (cancelled) return;
      setMessages([
        { role: "assistant", content: buildAssistantGreeting(displayName) },
      ]);
      setGreetingReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, messages.length, greeting, greetingReady, userSessionEndpoint]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");

    const history = messages
      .filter((m) => m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content }));
    const outgoing = [...history, { role: "user" as const, content: text }];

    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const appendToLast = (patch: (m: Msg) => Msg) =>
      setMessages((prev) => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].role === "assistant") {
            next[i] = patch(next[i]);
            break;
          }
        }
        return next;
      });

    try {
      const res = await fetch(chatEndpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: outgoing }),
        signal: controller.signal,
      });

      if (res.status === 401) {
        appendToLast((m) => ({
          ...m,
          content: "请先登录后再使用助手。",
        }));
        return;
      }
      if (!res.ok || !res.body) {
        let msg = `请求失败 (${res.status})`;
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {
          /* */
        }
        appendToLast((m) => ({ ...m, content: msg }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n");
        buffer = parts.pop() ?? "";
        for (const line of parts) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload);
            if (json.assistantRedirect) {
              const r = json.assistantRedirect as Redirect;
              appendToLast((m) => ({ ...m, redirect: r }));
              continue;
            }
            const delta = json.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta) {
              appendToLast((m) => ({ ...m, content: m.content + delta }));
            }
          } catch {
            /* partial json */
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        appendToLast((m) => ({
          ...m,
          content: m.content || "连接中断，请重试。",
        }));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, streaming, messages, chatEndpoint]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const canSend = !streaming && input.trim().length > 0;

  return (
    <div className="pa-root">
      {!open && (
        <button
          ref={ballRef}
          type="button"
          className="pa-ball"
          aria-label={`打开${title}`}
          title={`${title}（可拖动）`}
          onPointerDown={onBallPointerDown}
          onPointerMove={onBallPointerMove}
          onPointerUp={onBallPointerUp}
          style={{
            ...(ballPos
              ? { left: ballPos.x, top: ballPos.y }
              : { right: 20, bottom: 20 }),
            background: avatarSrc
              ? "#dbeafe"
              : `linear-gradient(135deg, ${accentColor}, #8b5cf6)`,
          }}
        >
          {avatarSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarSrc}
              alt="助手"
              draggable={false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                pointerEvents: "none",
              }}
            />
          ) : (
            <SparklesIcon
              style={{ width: 26, height: 26, color: "#fff", pointerEvents: "none" }}
            />
          )}
        </button>
      )}

      {open && (
        <>
          <div
            className="pa-backdrop"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-label={title}
            className="pa-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pa-header">
              <div className="pa-header-avatar">
                {avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarSrc}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <SparklesIcon style={{ width: 16, height: 16, color: "#fff" }} />
                )}
              </div>
              <div className="pa-header-title">
                <h3>{title}</h3>
                <p>随时为你解答</p>
              </div>
              <button
                type="button"
                className="pa-close"
                aria-label="关闭"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>

            <div
              ref={listRef}
              className="pa-scroll"
              role="log"
              aria-label="对话消息"
              aria-live="polite"
            >
              {messages.map((m, i) => {
                const isUser = m.role === "user";
                return (
                  <div
                    key={i}
                    className={`pa-row ${isUser ? "pa-row-user" : "pa-row-assistant"}`}
                  >
                    <div className="pa-msg-wrap">
                      <div
                        className={`pa-msg-row ${isUser ? "pa-msg-row-user" : ""}`}
                      >
                        {!isUser && (
                          <div className="pa-msg-avatar">
                            <SparklesIcon style={{ width: 16, height: 16 }} />
                          </div>
                        )}
                        <div
                          className={`pa-bubble ${
                            isUser ? "pa-bubble-user" : "pa-bubble-assistant"
                          }`}
                        >
                          {m.content ||
                            (streaming && m.role === "assistant" ? (
                              <span>
                                <span className="pa-dot" style={{ animationDelay: "0s" }} />
                                <span className="pa-dot" style={{ animationDelay: ".2s" }} />
                                <span className="pa-dot" style={{ animationDelay: ".4s" }} />
                              </span>
                            ) : (
                              ""
                            ))}
                        </div>
                      </div>
                      {m.redirect && (
                        <a
                          className="pa-card"
                          href={m.redirect.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <div className="pa-card-title">
                            前往「{m.redirect.title}」→
                          </div>
                          <div className="pa-card-desc">{m.redirect.description}</div>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pa-input-bar">
              <div className="pa-input-shell">
                <textarea
                  className="pa-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="问问平台能做什么…"
                  rows={1}
                  aria-label="输入消息"
                />
                <button
                  type="button"
                  className={`pa-send ${canSend ? "pa-send-active" : "pa-send-idle"}`}
                  onClick={() => void send()}
                  disabled={!canSend}
                  aria-label="发送消息"
                >
                  <SendIcon style={{ width: 16, height: 16 }} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
