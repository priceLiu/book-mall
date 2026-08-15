"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
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

function useInjectStyles(accent: string) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    const css = `
@keyframes pa-pop { from { transform: scale(.6); opacity: 0 } to { transform: scale(1); opacity: 1 } }
@keyframes pa-slide { from { transform: translateX(24px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
@keyframes pa-blink { 0%,80%,100% { opacity: .2 } 40% { opacity: 1 } }
.pa-scroll::-webkit-scrollbar { width: 6px }
.pa-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,.15); border-radius: 3px }
.pa-dot { width:6px;height:6px;border-radius:50%;background:${accent};display:inline-block;margin:0 2px;animation:pa-blink 1.4s infinite both }
.pa-send:hover { filter: brightness(1.08) }
.pa-card:hover { box-shadow: 0 4px 14px rgba(0,0,0,.12) }
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

  // 悬浮球位置（可拖拽 + 记忆）；null = 默认右下角
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

  // 窗口尺寸变化时把球夹回可视区
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

  return (
    <>
      {/* 悬浮头像球（可拖拽 + 记忆位置） */}
      {!open && (
        <button
          ref={ballRef}
          type="button"
          aria-label={`打开${title}`}
          title={`${title}（可拖动）`}
          onPointerDown={onBallPointerDown}
          onPointerMove={onBallPointerMove}
          onPointerUp={onBallPointerUp}
          style={{
            position: "fixed",
            ...(ballPos
              ? { left: ballPos.x, top: ballPos.y }
              : { right: 20, bottom: 20 }),
            width: BALL_SIZE,
            height: BALL_SIZE,
            borderRadius: "50%",
            border: "none",
            cursor: "grab",
            padding: 0,
            overflow: "hidden",
            touchAction: "none",
            userSelect: "none",
            boxShadow: "0 6px 20px rgba(0,0,0,.22)",
            background: avatarSrc
              ? "#dbeafe"
              : `linear-gradient(135deg, ${accentColor}, #8b5cf6)`,
            zIndex: 2147483000,
            animation: "pa-pop .25s ease",
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
            <span style={{ fontSize: 26, pointerEvents: "none" }}>🤖</span>
          )}
        </button>
      )}

      {/* 右侧抽屉 + 点击外部收起 */}
      {open && (
        <>
          <div
            aria-hidden
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 2147482999,
              background: "rgba(15, 23, 42, 0.08)",
            }}
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            style={{
            position: "fixed",
            top: 0,
            right: 0,
            height: "100vh",
            width: "min(400px, 92vw)",
            background: "#ffffff",
            color: "#111827",
            boxShadow: "-8px 0 30px rgba(0,0,0,.18)",
            display: "flex",
            flexDirection: "column",
            zIndex: 2147483000,
            animation: "pa-slide .22s ease",
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif",
          }}
        >
          {/* 头部 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 16px",
              borderBottom: "1px solid #eef0f3",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                overflow: "hidden",
                background: avatarSrc
                  ? "#dbeafe"
                  : `linear-gradient(135deg, ${accentColor}, #8b5cf6)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarSrc}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span style={{ fontSize: 16 }}>🤖</span>
              )}
            </div>
            <div style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>{title}</div>
            <button
              type="button"
              aria-label="关闭"
              onClick={() => setOpen(false)}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 20,
                lineHeight: 1,
                color: "#6b7280",
                padding: 4,
              }}
            >
              ×
            </button>
          </div>

          {/* 消息区 */}
          <div
            ref={listRef}
            className="pa-scroll"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px",
              background: "#f7f8fa",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div style={{ maxWidth: "82%" }}>
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      lineHeight: 1.6,
                      fontSize: 14,
                      padding: "10px 12px",
                      borderRadius: 12,
                      background: m.role === "user" ? accentColor : "#ffffff",
                      color: m.role === "user" ? "#ffffff" : "#111827",
                      border:
                        m.role === "user" ? "none" : "1px solid #eef0f3",
                      boxShadow:
                        m.role === "user"
                          ? "none"
                          : "0 1px 2px rgba(0,0,0,.04)",
                    }}
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
                  {m.redirect && (
                    <a
                      className="pa-card"
                      href={m.redirect.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "block",
                        marginTop: 8,
                        padding: "10px 12px",
                        borderRadius: 12,
                        background: "#ffffff",
                        border: `1px solid ${accentColor}33`,
                        textDecoration: "none",
                        color: "#111827",
                        transition: "box-shadow .15s ease",
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, color: accentColor }}>
                        前往「{m.redirect.title}」→
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                        {m.redirect.description}
                      </div>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 输入区 */}
          <div
            style={{
              borderTop: "1px solid #eef0f3",
              padding: 12,
              background: "#ffffff",
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="问问平台能做什么…"
              rows={1}
              style={{
                flex: 1,
                resize: "none",
                maxHeight: 120,
                minHeight: 40,
                padding: "9px 12px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                outline: "none",
                fontSize: 14,
                lineHeight: 1.5,
                fontFamily: "inherit",
              }}
            />
            <button
              type="button"
              className="pa-send"
              onClick={() => void send()}
              disabled={streaming || !input.trim()}
              style={{
                border: "none",
                borderRadius: 10,
                padding: "0 16px",
                height: 40,
                cursor: streaming || !input.trim() ? "not-allowed" : "pointer",
                background: streaming || !input.trim() ? "#c7cbd1" : accentColor,
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              发送
            </button>
          </div>
        </div>
        </>
      )}
    </>
  );
}
