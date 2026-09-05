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
import type { PlatformAppLink } from "./platform-apps";
import {
  getPrefetchedAiNews,
  prefetchAiNews,
  type PrefetchedAiNews,
} from "./ai-news-prefetch";

export type PlatformAssistantProps = {
  /** 对话端点。子站默认经 BFF 代理到主站。 */
  chatEndpoint?: string;
  /** AI 热闻端点；默认由 chatEndpoint 推导（/chat → /ai-news）。 */
  aiNewsEndpoint?: string;
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

/** SSE / 后端卡片 · app 字段映射为 PlatformAppLink.key */
function normalizeAppLinks(
  links: Array<{ app?: string; key?: string; title: string; description: string; url: string }>,
): PlatformAppLink[] {
  return links.map((l) => ({
    key: l.key ?? l.app ?? l.title,
    title: l.title,
    description: l.description,
    url: l.url,
  }));
}

type Msg = {
  role: "user" | "assistant";
  content: string;
  redirect?: Redirect | null;
  appLinks?: PlatformAppLink[];
  /** 热闻 · Markdown（与问候同条消息，显示在导航上方） */
  newsContent?: string;
  newsStale?: boolean;
  newsLoading?: boolean;
  /** @deprecated 保留兼容；新逻辑用 newsContent */
  richMarkdown?: boolean;
};

const DEFAULT_ENDPOINT = "/api/book-mall/api/platform-assistant/chat";
const DEFAULT_USER_SESSION = "/api/tools-session";

function resolveAiNewsEndpoint(chatEndpoint: string, explicit?: string): string {
  if (explicit?.trim()) return explicit.trim();
  if (chatEndpoint.endsWith("/chat")) {
    return `${chatEndpoint.slice(0, -"/chat".length)}/ai-news`;
  }
  return "/api/book-mall/api/platform-assistant/ai-news";
}

function renderInlineBold(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${keyPrefix}-b-${i}`} className="pa-rich-strong">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

/** 行首 emoji（不依赖 \\p{}，兼容 finance-web 等未设 target 的 tsconfig）。 */
function lineStartsWithEmoji(s: string): boolean {
  const cp = s.codePointAt(0);
  if (cp == null) return false;
  return (
    (cp >= 0x1f300 && cp <= 0x1faff) ||
    (cp >= 0x2600 && cp <= 0x27bf) ||
    (cp >= 0x1f1e6 && cp <= 0x1f1ff) ||
    (cp >= 0x2300 && cp <= 0x23ff) ||
    cp === 0x2b50 ||
    cp === 0x2728
  );
}

/** 默认展示的热闻条数；其余由用户点击展开。 */
const AI_NEWS_PREVIEW_COUNT = 3;

function countAiNewsItems(text: string): number {
  return text.split("\n").filter((line) => /^\s*\d+\.\s/.test(line)).length;
}

function truncateAiNewsMarkdown(text: string, maxItems: number): string {
  const lines = text.split("\n");
  const itemStarts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\d+\.\s/.test(lines[i])) itemStarts.push(i);
  }
  if (itemStarts.length <= maxItems) return text;
  const preview = lines.slice(0, itemStarts[maxItems]);
  while (preview.length > 0 && !preview[preview.length - 1]?.trim()) {
    preview.pop();
  }
  return preview.join("\n");
}

function AssistantAiNewsBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const totalItems = countAiNewsItems(text);
  const hasMore = totalItems > AI_NEWS_PREVIEW_COUNT;
  const displayText =
    expanded || !hasMore ? text : truncateAiNewsMarkdown(text, AI_NEWS_PREVIEW_COUNT);

  return (
    <>
      <AssistantRichText text={displayText} />
      {hasMore ? (
        <button
          type="button"
          className="pa-news-expand-btn"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "收起" : `展开全部（共 ${totalItems} 条）`}
        </button>
      ) : null}
    </>
  );
}

function AssistantRichText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="pa-rich">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={`ln-${i}`} className="pa-rich-gap" />;
        const isCategory =
          (/^【.+】$/.test(trimmed) ||
            (lineStartsWithEmoji(trimmed) && !/^\d+\./.test(trimmed)));
        const isNumbered = /^\d+\.\s/.test(trimmed);
        const isSubField =
          /^(核心事实|热度依据|简要点评)[：:]/.test(trimmed) ||
          trimmed.startsWith("🔥今日头条");
        const isDisclaimer = trimmed.startsWith("*") && trimmed.endsWith("*");
        let cls = "pa-rich-line";
        if (isCategory) cls = "pa-rich-category";
        else if (isNumbered) cls = "pa-rich-item";
        else if (isSubField) cls = "pa-rich-sub";
        else if (isDisclaimer) cls = "pa-rich-disclaimer";
        return (
          <p key={`ln-${i}`} className={cls}>
            {isDisclaimer
              ? trimmed.slice(1, -1)
              : renderInlineBold(line, `ln-${i}`)}
          </p>
        );
      })}
    </div>
  );
}

const STYLE_ID = "platform-assistant-styles";
const POSITION_KEY = "platform-assistant-ball-pos";
const BALL_SIZE = 44;
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
@keyframes pa-drawer-in {
  from { transform: translateX(100%); opacity: 0.85; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes pa-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes pa-fade-up {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes pa-ball-hint {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 6px 24px rgba(99,102,241,.45), 0 0 0 0 rgba(99,102,241,.35);
  }
  50% {
    transform: scale(1.08);
    box-shadow: 0 10px 36px rgba(99,102,241,.65), 0 0 0 14px rgba(99,102,241,0);
  }
}
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
.pa-ball-hint {
  animation: pa-ball-hint 1.8s ease-in-out infinite;
}
.pa-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147482999;
  background: rgba(15, 23, 42, 0.35);
  animation: pa-backdrop-in .22s ease;
}
.pa-drawer {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  height: 100dvh;
  width: min(400px, 92vw);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  z-index: 2147483000;
  animation: pa-drawer-in .36s cubic-bezier(0.22, 1, 0.36, 1);
  background: linear-gradient(to bottom, #18181b, #09090b);
  color: #f4f4f5;
  border-left: 1px solid rgba(255,255,255,.08);
  box-shadow: -8px 0 40px rgba(0,0,0,.45);
}
.pa-drawer-enter .pa-header {
  animation: pa-fade-up .42s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: .05s;
}
.pa-drawer-first {
  animation: pa-drawer-in .38s cubic-bezier(0.22, 1, 0.36, 1);
}
.pa-drawer-first .pa-header {
  animation: pa-fade-up .4s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: .06s;
}
.pa-intro-stagger > .pa-msg-row {
  animation: pa-fade-up .42s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: .1s;
}
.pa-intro-stagger > .pa-news-block {
  animation: pa-fade-up .42s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: .18s;
}
.pa-intro-stagger > .pa-app-links {
  animation: pa-fade-up .42s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: .26s;
}
.pa-intro-stagger > .pa-card:not(.pa-app-links .pa-card) {
  animation: pa-fade-up .42s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: .26s;
}
@media (prefers-reduced-motion: reduce) {
  .pa-ball-hint,
  .pa-drawer,
  .pa-drawer-enter .pa-header,
  .pa-drawer-first,
  .pa-drawer-first .pa-header,
  .pa-intro-stagger > .pa-msg-row,
  .pa-intro-stagger > .pa-news-block,
  .pa-intro-stagger > .pa-app-links,
  .pa-intro-stagger > .pa-card {
    animation: none !important;
  }
  .pa-backdrop { animation: none; }
  .pa-drawer { animation: pa-slide .15s ease; }
}
.pa-header {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
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
  flex: 1 1 0;
  min-height: 0;
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
.pa-msg-wrap-wide { max-width: 100%; width: 100%; }
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
.pa-app-links {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 10px;
}
.pa-app-links .pa-card {
  margin-top: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 6px 4px;
  min-height: 32px;
  border-radius: 8px;
}
.pa-app-links .pa-card-title {
  font-size: 11px;
  font-weight: 500;
  line-height: 1.3;
  color: #c7d2fe;
}
.pa-app-links .pa-card-desc {
  display: none;
}
.pa-news-block {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(24,24,27,.75);
  border: 1px solid rgba(255,255,255,.08);
}
.pa-news-block-title {
  font-size: 13px;
  font-weight: 600;
  color: #e4e4e7;
  margin-bottom: 8px;
}
.pa-rich {
  font-size: 13px;
  line-height: 1.55;
  color: rgba(255,255,255,.88);
}
.pa-rich-gap {
  height: 6px;
}
.pa-rich-category {
  margin: 10px 0 4px;
  font-size: 13px;
  font-weight: 700;
  color: #e4e4e7;
}
.pa-rich-item {
  margin: 0 0 6px;
  padding-left: 2px;
  color: rgba(255,255,255,.82);
}
.pa-rich-sub {
  margin: 0 0 4px;
  padding-left: 12px;
  font-size: 12px;
  color: rgba(255,255,255,.62);
  line-height: 1.5;
}
.pa-rich-strong {
  color: #f4f4f5;
  font-weight: 600;
}
.pa-rich-disclaimer {
  margin-top: 10px;
  font-size: 11px;
  color: rgba(255,255,255,.38);
  font-style: italic;
}
.pa-news-loading {
  font-size: 12px;
  color: rgba(255,255,255,.55);
}
.pa-news-expand-btn {
  display: block;
  width: 100%;
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.06);
  color: #c7d2fe;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background .15s, border-color .15s;
}
.pa-news-expand-btn:hover {
  background: rgba(255,255,255,.1);
  border-color: rgba(255,255,255,.2);
}
.pa-input-bar {
  flex-shrink: 0;
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
  aiNewsEndpoint,
  userSessionEndpoint = DEFAULT_USER_SESSION,
  avatarSrc,
  title = "AI 小智",
  accentColor = "#4f46e5",
  greeting,
}: PlatformAssistantProps) {
  const newsEndpoint = resolveAiNewsEndpoint(chatEndpoint, aiNewsEndpoint);
  const [open, setOpen] = useState(false);
  const [openGeneration, setOpenGeneration] = useState(0);
  const [drawerEnterFx, setDrawerEnterFx] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
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

  const openDrawer = useCallback(() => {
    setDrawerEnterFx(true);
    setOpenGeneration((g) => g + 1);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) setDrawerEnterFx(false);
  }, [open]);

  const showIntroStagger =
    open && drawerEnterFx && !messages.some((m) => m.role === "user");

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
      openDrawer();
    }
  };

  useEffect(() => {
    if (!open) return;
    if (messages.some((m) => m.role === "user")) return;

    let cancelled = false;
    void (async () => {
      const loadNews = async (baseMsg: Msg) => {
        const applyNews = (news: PrefetchedAiNews | null, loading: boolean): Msg => ({
          ...baseMsg,
          newsLoading: loading && !news?.content,
          newsContent: news?.content,
          newsStale: news?.stale,
        });

        const cached = getPrefetchedAiNews();
        if (cached?.content) {
          setMessages([applyNews(cached, false)]);
          return;
        }

        setMessages([applyNews(null, true)]);
        try {
          const data = await prefetchAiNews(newsEndpoint);
          if (cancelled) return;
          setMessages([applyNews(data, false)]);
        } catch {
          if (!cancelled) {
            setMessages([{ ...baseMsg, newsLoading: false }]);
          }
        }
      };

      if (greeting) {
        if (!cancelled) {
          await loadNews({ role: "assistant", content: greeting });
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
      const built = buildAssistantGreeting(displayName);
      await loadNews({
        role: "assistant",
        content: built.content,
        appLinks: built.appLinks,
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在新开对话轮次刷新问候
  }, [open, openGeneration, greeting, userSessionEndpoint, newsEndpoint]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const last = messages[messages.length - 1];
    if (last?.role === "user" || streaming) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, streaming]);

  useEffect(() => () => abortRef.current?.abort(), []);

  /** 全站 layout mount：空闲时再预取热闻，避免与首页 portal 列表抢带宽。 */
  useEffect(() => {
    const run = () => void prefetchAiNews(newsEndpoint);
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(run, { timeout: 4000 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(run, 2000);
    return () => window.clearTimeout(t);
  }, [newsEndpoint]);

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
        headers: {
          "Content-Type": "application/json",
          "X-Platform-App":
            typeof window !== "undefined" ? window.location.hostname : "",
        },
        body: JSON.stringify({ messages: outgoing }),
        signal: controller.signal,
      });

      if (res.status === 401) {
        appendToLast((m) => ({
          ...m,
          content: "助手暂不可用，请稍后重试。",
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
            if (Array.isArray(json.assistantAppLinks)) {
              const links = normalizeAppLinks(
                json.assistantAppLinks as Array<{
                  app?: string;
                  key?: string;
                  title: string;
                  description: string;
                  url: string;
                }>,
              );
              appendToLast((m) => ({ ...m, appLinks: links }));
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
          className={`pa-ball${!open ? " pa-ball-hint" : ""}`}
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
            className={`pa-drawer${drawerEnterFx ? " pa-drawer-enter" : ""}`}
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
                const wide = !isUser && (m.appLinks?.length ?? 0) > 0;
                return (
                  <div
                    key={i}
                    className={`pa-row ${isUser ? "pa-row-user" : "pa-row-assistant"}`}
                  >
                    <div className={`pa-msg-wrap ${wide ? "pa-msg-wrap-wide" : ""}${showIntroStagger ? " pa-intro-stagger" : ""}`}>
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
                          {m.content ? (
                            <span style={{ whiteSpace: "pre-wrap" }}>{m.content}</span>
                          ) : streaming && m.role === "assistant" ? (
                            <span>
                              <span className="pa-dot" style={{ animationDelay: "0s" }} />
                              <span className="pa-dot" style={{ animationDelay: ".2s" }} />
                              <span className="pa-dot" style={{ animationDelay: ".4s" }} />
                            </span>
                          ) : (
                            ""
                          )}
                        </div>
                      </div>
                      {!isUser && m.newsLoading ? (
                        <div className="pa-news-block">
                          <div className="pa-news-loading">
                            正在加载 AI 热闻…
                            <span className="pa-dot" style={{ animationDelay: "0s" }} />
                            <span className="pa-dot" style={{ animationDelay: ".2s" }} />
                            <span className="pa-dot" style={{ animationDelay: ".4s" }} />
                          </div>
                        </div>
                      ) : null}
                      {!isUser && m.newsContent ? (
                        <div className="pa-news-block">
                          <div className="pa-news-block-title">
                            📰 {m.newsStale ? "AI 热闻（最近一期）" : "今日 AI 热闻"}
                          </div>
                          <AssistantAiNewsBlock text={m.newsContent} />
                        </div>
                      ) : !isUser && !m.newsLoading && (m.appLinks?.length ?? 0) > 0 ? (
                        <div className="pa-news-block">
                          <div className="pa-news-block-title">📰 今日 AI 热闻</div>
                          <div className="pa-news-loading">
                            热闻正在准备中，稍后再开即可看到。
                          </div>
                        </div>
                      ) : null}
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
                      {m.appLinks && m.appLinks.length > 0 ? (
                        <div className="pa-app-links">
                          {m.appLinks.map((link) => (
                            <a
                              key={link.key}
                              className="pa-card"
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={link.description}
                            >
                              <div className="pa-card-title">{link.title}</div>
                            </a>
                          ))}
                        </div>
                      ) : null}
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
