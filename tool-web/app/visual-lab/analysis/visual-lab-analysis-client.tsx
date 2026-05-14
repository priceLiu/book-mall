"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUp,
  Atom,
  ChevronDown,
  ChevronUp,
  Eye,
  Globe,
  Image as ImageIcon,
  Info,
  Loader2,
  Maximize2,
  Paperclip,
  Plus,
  Sparkles,
  FileVideo,
  X,
} from "lucide-react";
import { AnalysisReplyMarkdown } from "@/components/visual-lab/analysis-reply-markdown";
import {
  type VisualLabGalleryItem,
  type VisualLabSnapshotStats,
  VISUAL_LAB_REPLY_GALLERY_MAX_IMAGES,
  VISUAL_LAB_REPLY_GALLERY_MAX_VIDEOS,
  VISUAL_LAB_VIDEO_PLACEHOLDER_STATS,
  VISUAL_LAB_VIDEO_THUMB_DATA_URL,
  appendVisualLabGalleryItem,
  appendVisualLabReplyMediaItem,
} from "@/lib/visual-lab-gallery";
import {
  DEFAULT_VISUAL_LAB_ANALYSIS_MODEL_ID,
  VISUAL_LAB_ANALYSIS_MODELS,
  getVisualLabAnalysisModelById,
} from "@/lib/visual-lab-analysis-models";

const MAX_DOC = 1;
const MAX_IMG = 5;
const MAX_VID = 1;
const IMG_MAX_BYTES = 100 * 1024 * 1024;
const VID_MAX_BYTES = 500 * 1024 * 1024;

const THINK_MIN = 1024;
const THINK_MAX = 32768;
const THINK_DEFAULT = 4000;

type AnalysisTemplate =
  | {
      id: string;
      mode: "video";
      title: string;
      description: string;
      videoSrc: string;
      fileName: string;
      prompt: string;
    }
  | {
      id: string;
      mode: "image-send";
      title: string;
      description: string;
      imageSrc: string;
      fileName: string;
      prompt: string;
    };

const TEMPLATE_PROMPT_VIDEO_REPLICATE =
  "根据这个视频，在一个 HTML 中，复刻视频中的网站，需要尽量和视频中一致，不丢失细节";

const TEMPLATE_PROMPT_WEB_AWARDS = `为一位曾获得 Awwwards 提名的设计师设计个人网站。设计需包含以下核心特征：大面积留白布局、超大号衬线字体（Serif）标题、跟随鼠标移动的自定义光标、作品集图片在鼠标悬停时呈现透视变换效果、页面滚动时文字具备视差（Parallax）动效。整体配色严格限定为黑白主色调，仅以明亮的橙色作为视觉点缀。请务必使用真实的公开图片，禁止使用占位符。`;

const TEMPLATE_PROMPT_TETRIS = "|写一个功能完备的俄罗斯方块游戏";

const ANALYSIS_TEMPLATES: AnalysisTemplate[] = [
  {
    id: "guangzhou-metro",
    mode: "image-send",
    title: "图片理解",
    description: "从广州火车站到机场, 最快怎么坐地铁",
    imageSrc: "/images/visual-lab-template-guangzhou-metro.png",
    fileName: "guangzhou-metro.png",
    prompt: "从广州火车站到机场, 最快怎么坐地铁",
  },
  {
    id: "video-bailian-clone",
    mode: "video",
    title: "视频理解",
    description:
      "根据这个视频，在一个 HTML 中，复刻视频中的网站，需要尽量和视频中一致，不丢失细节",
    videoSrc: "/videos/qwen36-flash-ex2.mp4",
    fileName: "qwen36-flash-ex2.mp4",
    prompt: TEMPLATE_PROMPT_VIDEO_REPLICATE,
  },
  {
    id: "web-awwwards",
    mode: "image-send",
    title: "网页开发",
    description: "为一位曾获得 Awwwards 提名的设计师设计个人网站。",
    imageSrc: "/images/v4.png",
    fileName: "template-web.png",
    prompt: TEMPLATE_PROMPT_WEB_AWARDS,
  },
  {
    id: "tetris-full",
    mode: "image-send",
    title: "代码生成",
    description: "写一个功能完备的俄罗斯方块游戏",
    imageSrc: "/images/v3.png",
    fileName: "template-code.png",
    prompt: TEMPLATE_PROMPT_TETRIS,
  },
];

type AttKind = "doc" | "image" | "video";

type Attachment = {
  id: string;
  kind: AttKind;
  file: File;
  url: string;
};

/** 本轮发送后在对话区展示的用户内容（与附件 revoke 无关，使用 data URL） */
type UserTurnDisplay = {
  text: string;
  images: string[];
  videos: string[];
  docs: { name: string }[];
};

type MediaLightbox = { kind: "image" | "video"; src: string } | null;

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function fileNameFromReplyUrl(url: string, fallback: string): string {
  try {
    const seg = new URL(url).pathname.split("/").filter(Boolean).pop();
    if (seg && /\.[a-z0-9]{2,8}$/i.test(seg)) return decodeURIComponent(seg);
  } catch {
    /* ignore */
  }
  return fallback;
}

function truncateReplyUrl(u: string, max = 56): string {
  const s = u.trim();
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

function aspectLabelFromSize(w: number, h: number): string {
  if (w <= 0 || h <= 0) return "—";
  const g = gcd(Math.round(w), Math.round(h));
  return `${Math.round(w / g)}:${Math.round(h / g)}`;
}

async function analyzeImageFile(file: File): Promise<{
  stats: VisualLabSnapshotStats;
  thumbDataUrl: string;
}> {
  const previewUrl = URL.createObjectURL(file);
  try {
    const bmp = await createImageBitmap(file);
    try {
      const w0 = bmp.width;
      const h0 = bmp.height;

      const maxSide = 512;
      const scale = Math.min(1, maxSide / Math.max(w0, h0));
      const w = Math.max(1, Math.round(w0 * scale));
      const h = Math.max(1, Math.round(h0 * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("no-2d");
      ctx.drawImage(bmp, 0, 0, w, h);

      const data = ctx.getImageData(0, 0, w, h).data;
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      const n = w * h;
      for (let i = 0; i < data.length; i += 4) {
        rSum += data[i];
        gSum += data[i + 1];
        bSum += data[i + 2];
      }
      const r = Math.round(rSum / n);
      const g = Math.round(gSum / n);
      const b = Math.round(bSum / n);
      const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      const thumbMax = 480;
      const tScale = Math.min(1, thumbMax / Math.max(w0, h0));
      const tw = Math.max(1, Math.round(w0 * tScale));
      const th = Math.max(1, Math.round(h0 * tScale));
      const tCanvas = document.createElement("canvas");
      tCanvas.width = tw;
      tCanvas.height = th;
      const tCtx = tCanvas.getContext("2d");
      if (!tCtx) throw new Error("no-2d-thumb");
      const img = new window.Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("thumb-load"));
        img.src = previewUrl;
      });
      tCtx.drawImage(img, 0, 0, tw, th);
      const thumbDataUrl = tCanvas.toDataURL("image/jpeg", 0.82);

      const stats: VisualLabSnapshotStats = {
        width: w0,
        height: h0,
        avgRgb: { r, g, b },
        brightness,
        aspectLabel: aspectLabelFromSize(w0, h0),
      };

      return { stats, thumbDataUrl };
    } finally {
      bmp.close();
    }
  } finally {
    URL.revokeObjectURL(previewUrl);
  }
}

function familyOf(list: Attachment[]): AttKind | null {
  return list.length ? list[0].kind : null;
}

/** 剪贴板中的截图 / 复制图片 → File[]（仅 image/*） */
function imageFilesFromClipboard(data: ClipboardEvent["clipboardData"] | null): File[] {
  if (!data) return [];
  const out: File[] = [];
  const items = data.items;
  if (items?.length) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it?.kind === "file" && it.type.startsWith("image/")) {
        const f = it.getAsFile();
        if (f) out.push(f);
      }
    }
  }
  if (out.length === 0 && data.files?.length) {
    for (let i = 0; i < data.files.length; i++) {
      const f = data.files.item(i);
      if (f?.type.startsWith("image/")) out.push(f);
    }
  }
  return out;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : "");
    r.onerror = () => reject(r.error ?? new Error("read_failed"));
    r.readAsDataURL(file);
  });
}

function formatYuan(minor: number | null | undefined): string {
  if (minor == null || !Number.isFinite(minor)) return "—";
  return (minor / 100).toFixed(2);
}

async function buildUserTurnDisplay(attSnap: Attachment[], promptSnap: string): Promise<UserTurnDisplay> {
  const images: string[] = [];
  const videos: string[] = [];
  const docs: { name: string }[] = [];
  for (const a of attSnap) {
    if (a.kind === "image") {
      images.push(await readFileAsDataUrl(a.file));
    } else if (a.kind === "video") {
      videos.push(await readFileAsDataUrl(a.file));
    } else {
      docs.push({ name: a.file.name });
    }
  }
  return { text: promptSnap, images, videos, docs };
}

function dataUrlToBase64Payload(dataUrl: string): { mime: string; base64: string } {
  const m = /^data:([^;,]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!m) throw new Error("invalid_data_url");
  return { mime: m[1]!.trim(), base64: m[2]!.replace(/\s/g, "") };
}

async function attachmentToPayload(a: Attachment): Promise<{
  kind: AttKind;
  name: string;
  mimeType: string;
  base64: string;
}> {
  const dataUrl = await readFileAsDataUrl(a.file);
  const { mime, base64 } = dataUrlToBase64Payload(dataUrl);
  const mimeType =
    mime ||
    a.file.type ||
    (a.kind === "image" ? "image/jpeg" : a.kind === "video" ? "video/mp4" : "text/plain");
  return { kind: a.kind, name: a.file.name, mimeType, base64 };
}

type AnalysisStreamEv =
  | { type: "reasoning"; text: string }
  | { type: "content"; text: string }
  | { type: "done" }
  | { type: "error"; message?: string };

/** 解析 /api/visual-lab/analysis 返回的 NDJSON 流（与智能客服流式不同，含 reasoning + content） */
async function readVisualLabAnalysisStream(
  res: Response,
  signal: AbortSignal,
  onReasoning: (full: string) => void,
  onContent: (full: string) => void,
): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("无法读取响应流");

  const decoder = new TextDecoder();
  let carry = "";
  let reasoning = "";
  let content = "";

  const onAbort = () => {
    void reader.cancel();
  };
  signal.addEventListener("abort", onAbort);

    try {
      while (!signal.aborted) {
        let readResult: ReadableStreamReadResult<Uint8Array>;
        try {
          readResult = await reader.read();
        } catch (e) {
          const isAbort =
            (e instanceof DOMException && e.name === "AbortError") ||
            (e instanceof Error && e.name === "AbortError");
          if (isAbort) return;
          throw e;
        }
        const { done, value } = readResult;
        if (done) break;
      carry += decoder.decode(value, { stream: true });
      for (;;) {
        const ix = carry.indexOf("\n");
        if (ix < 0) break;
        const line = carry.slice(0, ix).trim();
        carry = carry.slice(ix + 1);
        if (!line) continue;
        let ev: AnalysisStreamEv;
        try {
          ev = JSON.parse(line) as AnalysisStreamEv;
        } catch {
          continue;
        }
        if (ev.type === "done") {
          continue;
        }
        if (ev.type === "reasoning" && typeof ev.text === "string") {
          reasoning += ev.text;
          onReasoning(reasoning);
        } else if (ev.type === "content" && typeof ev.text === "string") {
          content += ev.text;
          onContent(content);
        } else if (ev.type === "error") {
          throw new Error(
            typeof ev.message === "string" && ev.message.trim()
              ? ev.message.trim()
              : "模型流式输出失败",
          );
        }
      }
    }
    carry += decoder.decode();
    const tail = carry.trim();
    if (tail) {
      try {
        const ev = JSON.parse(tail) as AnalysisStreamEv;
        if (ev.type === "error") {
          throw new Error(
            typeof ev.message === "string" && ev.message.trim()
              ? ev.message.trim()
              : "模型流式输出失败",
          );
        }
      } catch (e) {
        if (e instanceof SyntaxError) {
          /* 尾帧可能截断在未换行处，忽略 */
        } else {
          throw e;
        }
      }
    }
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

export function VisualLabAnalysisClient({ mainSiteOrigin }: { mainSiteOrigin: string | null }) {
  const docInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const vidInputRef = useRef<HTMLInputElement>(null);
  const attachAnchorRef = useRef<HTMLDivElement>(null);
  const deepAnchorRef = useRef<HTMLDivElement>(null);
  const welcomeRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  /** 流式输出时是否保持回复区贴在底部；用户上滑阅读后暂停自动滚动 */
  const streamStickBottomRef = useRef(true);
  /** 思考过程 pre 内滚动：流式时贴底；用户上滑后暂停 */
  const reasoningStickBottomRef = useRef(true);
  const reasoningPreRef = useRef<HTMLPreElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const analysisAbortRef = useRef<AbortController | null>(null);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [prompt, setPrompt] = useState("");
  const [searchOn, setSearchOn] = useState(false);
  const [thinkingTokens, setThinkingTokens] = useState(THINK_DEFAULT);
  const [deepOpen, setDeepOpen] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [modelId, setModelId] = useState<string>(DEFAULT_VISUAL_LAB_ANALYSIS_MODEL_ID);

  const [walletLoading, setWalletLoading] = useState(true);
  const [balanceMinor, setBalanceMinor] = useState<number | null>(null);
  const [usedMinor, setUsedMinor] = useState<number | null>(null);

  const [uploadFailText, setUploadFailText] = useState<string | null>(null);
  const [infoBannerDismissed, setInfoBannerDismissed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisReply, setAnalysisReply] = useState("");
  const [analysisReasoning, setAnalysisReasoning] = useState("");
  const [userTurnDisplay, setUserTurnDisplay] = useState<UserTurnDisplay | null>(null);
  const [mediaLightbox, setMediaLightbox] = useState<MediaLightbox>(null);
  const [analysisStopped, setAnalysisStopped] = useState(false);
  const [outcomeQuotaModalKind, setOutcomeQuotaModalKind] = useState<"image" | "video" | null>(
    null,
  );

  const showUploadFail = useCallback((msg: string) => {
    setUploadFailText(msg);
    window.setTimeout(() => setUploadFailText(null), 6000);
  }, []);

  const onComposeResultScroll = useCallback(() => {
    const el = resultRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    streamStickBottomRef.current = dist < 72;
  }, []);

  const onReasoningPreScroll = useCallback(() => {
    const el = reasoningPreRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    reasoningStickBottomRef.current = dist < 48;
  }, []);

  useEffect(() => {
    if (!submitted) return;
    if (!streamStickBottomRef.current) return;
    const id = requestAnimationFrame(() => {
      const r = resultRef.current;
      if (!r || !streamStickBottomRef.current) return;
      r.scrollTop = r.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [analysisReply, analysisReasoning, submitted, analyzing]);

  useEffect(() => {
    if (!analysisReasoning) return;
    if (!reasoningStickBottomRef.current) return;
    const id = requestAnimationFrame(() => {
      const r = reasoningPreRef.current;
      if (!r || !reasoningStickBottomRef.current) return;
      r.scrollTop = r.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [analysisReasoning]);

  useEffect(() => {
    if (!mediaLightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMediaLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mediaLightbox]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setWalletLoading(true);
      try {
        const [wr, ur] = await Promise.all([
          fetch("/api/tool-wallet", { cache: "no-store", credentials: "same-origin" }),
          fetch("/api/tool-usage?page=1&limit=1", {
            cache: "no-store",
            credentials: "same-origin",
          }),
        ]);
        const wj = (await wr.json().catch(() => null)) as {
          balanceMinor?: number | null;
          active?: boolean;
        } | null;
        const uj = (await ur.json().catch(() => null)) as {
          summaryByTool?: { sumMinor?: number | null }[];
        } | null;
        if (cancelled) return;
        if (wr.ok && wj && typeof wj.balanceMinor === "number") {
          setBalanceMinor(Math.max(0, Math.floor(wj.balanceMinor)));
        } else {
          setBalanceMinor(null);
        }
        if (ur.ok && uj?.summaryByTool && Array.isArray(uj.summaryByTool)) {
          const sum = uj.summaryByTool.reduce(
            (s, r) => s + (typeof r.sumMinor === "number" ? r.sumMinor : 0),
            0,
          );
          setUsedMinor(sum);
        } else {
          setUsedMinor(null);
        }
      } catch {
        if (!cancelled) {
          setBalanceMinor(null);
          setUsedMinor(null);
        }
      } finally {
        if (!cancelled) setWalletLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      const t = e.target as Node;
      if (attachAnchorRef.current && !attachAnchorRef.current.contains(t)) {
        setAttachMenuOpen(false);
      }
      if (deepAnchorRef.current && !deepAnchorRef.current.contains(t)) {
        setDeepOpen(false);
      }
      const welcome = welcomeRef.current;
      if (welcome && !welcome.contains(t)) setModelMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((a) => {
        if (a.url) URL.revokeObjectURL(a.url);
      });
    };
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const cur = prev.find((x) => x.id === id);
      if (cur?.url) URL.revokeObjectURL(cur.url);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const tryAddFiles = useCallback(
    (files: File[], kind: AttKind) => {
      if (files.length === 0) return;
      const fam = familyOf(attachments);
      if (fam != null && fam !== kind) {
        showUploadFail("不支持上传不同类型的文件，请先移除当前附件后再试。");
        return;
      }

      const next = [...attachments];
      for (const file of files) {
        if (kind === "image") {
          if (!file.type.startsWith("image/")) {
            showUploadFail(`${file.name} 上传失败：请选择图片文件。`);
            return;
          }
          if (file.size > IMG_MAX_BYTES) {
            showUploadFail(`${file.name} 上传失败：单张图片须小于 100MB。`);
            return;
          }
          if (next.filter((x) => x.kind === "image").length >= MAX_IMG) {
            showUploadFail("上传失败：图片最多 5 张。");
            return;
          }
          next.push({ id: newId(), kind: "image", file, url: URL.createObjectURL(file) });
        } else if (kind === "doc") {
          if (next.filter((x) => x.kind === "doc").length >= MAX_DOC) {
            showUploadFail("上传失败：文档最多 1 个。");
            return;
          }
          next.push({ id: newId(), kind: "doc", file, url: "" });
        } else {
          if (!file.type.startsWith("video/")) {
            showUploadFail(`${file.name} 上传失败：请选择视频文件。`);
            return;
          }
          if (file.size > VID_MAX_BYTES) {
            showUploadFail(`${file.name} 上传失败：视频须小于 500MB。`);
            return;
          }
          if (next.filter((x) => x.kind === "video").length >= MAX_VID) {
            showUploadFail("上传失败：视频最多 1 个。");
            return;
          }
          next.push({ id: newId(), kind: "video", file, url: URL.createObjectURL(file) });
        }
      }
      setAttachments(next);
    },
    [attachments, showUploadFail],
  );

  const onComposePasteCapture = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const files = imageFilesFromClipboard(e.clipboardData);
      if (files.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      tryAddFiles(files, "image");
    },
    [tryAddFiles],
  );

  const onPickInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, kind: AttKind) => {
      const fl = e.target.files;
      if (fl?.length) tryAddFiles(Array.from(fl), kind);
      e.target.value = "";
      setAttachMenuOpen(false);
    },
    [tryAddFiles],
  );

  const saveToGallery = useCallback(async () => {
    const img = attachments.find((a) => a.kind === "image");
    if (!img) {
      showUploadFail("请先上传至少一张图片后再保存到成果展。");
      return;
    }
    try {
      const { stats, thumbDataUrl } = await analyzeImageFile(img.file);
      const item: VisualLabGalleryItem = {
        id: newId(),
        createdAt: new Date().toISOString(),
        kind: "snapshot",
        imageName: img.file.name,
        note: prompt.trim(),
        thumbDataUrl,
        stats,
      };
      const all = appendVisualLabGalleryItem(item);
      setSaveHint(`已保存到成果展（本机共 ${all.length} 条）`);
      window.setTimeout(() => setSaveHint(null), 4000);
    } catch {
      showUploadFail("保存失败：无法生成缩略图，请换一张图片重试。");
    }
  }, [attachments, prompt, showUploadFail]);

  const saveReplyMediaFromAnalysis = useCallback(
    async (url: string, kind: "reply-image" | "reply-video") => {
      try {
        if (kind === "reply-image") {
          const r = await fetch(url, { mode: "cors" });
          if (!r.ok) {
            throw new Error(
              `图片下载失败（${r.status}）。外链可能禁止跨域，请换一张可访问的链接或下载后从本地上传。`,
            );
          }
          const blob = await r.blob();
          const mime = blob.type?.startsWith("image/") ? blob.type : "image/png";
          const file = new File([blob], fileNameFromReplyUrl(url, "reply-image.png"), { type: mime });
          if (!file.type.startsWith("image/")) {
            showUploadFail("链接内容不是可识别的图片类型。");
            return;
          }
          const { stats, thumbDataUrl } = await analyzeImageFile(file);
          const appended = appendVisualLabReplyMediaItem({
            id: newId(),
            createdAt: new Date().toISOString(),
            kind: "reply-image",
            imageName: file.name,
            note: `模型回复图片 · ${truncateReplyUrl(url)}`,
            thumbDataUrl,
            stats,
            sourceUrl: url,
          });
          if (!appended.ok) {
            setOutcomeQuotaModalKind(appended.reason === "quota-image" ? "image" : "video");
            return;
          }
          setSaveHint(`已保存回复中的图片到成果展（回复图最多 ${VISUAL_LAB_REPLY_GALLERY_MAX_IMAGES} 条）`);
        } else {
          const appended = appendVisualLabReplyMediaItem({
            id: newId(),
            createdAt: new Date().toISOString(),
            kind: "reply-video",
            imageName: fileNameFromReplyUrl(url, "reply-video.mp4"),
            note: `模型回复视频 · ${truncateReplyUrl(url)}`,
            thumbDataUrl: VISUAL_LAB_VIDEO_THUMB_DATA_URL,
            stats: VISUAL_LAB_VIDEO_PLACEHOLDER_STATS,
            sourceUrl: url,
          });
          if (!appended.ok) {
            setOutcomeQuotaModalKind(appended.reason === "quota-video" ? "video" : "image");
            return;
          }
          setSaveHint(`已保存回复中的视频到成果展（回复视频最多 ${VISUAL_LAB_REPLY_GALLERY_MAX_VIDEOS} 条）`);
        }
        window.setTimeout(() => setSaveHint(null), 5000);
      } catch (e) {
        showUploadFail(e instanceof Error ? e.message : "保存失败");
      }
    },
    [showUploadFail],
  );

  const sendReady = prompt.trim().length > 0;

  const runAnalysisRequest = useCallback(
    async (promptSnapRaw: string, attSnap: Attachment[]) => {
      const promptSnap = promptSnapRaw.trim();
      if (!promptSnap || analyzing) return;

      analysisAbortRef.current?.abort();
      const ac = new AbortController();
      analysisAbortRef.current = ac;

      const turnDisplay = await buildUserTurnDisplay(attSnap, promptSnap);
      setUserTurnDisplay(turnDisplay);

      const modelIdSnap = modelId;
      const budgetSnap = thinkingTokens;

      setAttachMenuOpen(false);
      setDeepOpen(false);
      setModelMenuOpen(false);
      setAnalysisError(null);
      setAnalysisReply("");
      setAnalysisReasoning("");
      setAnalysisStopped(false);
      streamStickBottomRef.current = true;
      reasoningStickBottomRef.current = true;
      setAnalyzing(true);
      setSubmitted(true);

      setAttachments((prev) => {
        prev.forEach((a) => {
          if (a.url) URL.revokeObjectURL(a.url);
        });
        return [];
      });
      setPrompt("");

      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      try {
        const attachmentPayload =
          attSnap.length > 0 ? await Promise.all(attSnap.map((a) => attachmentToPayload(a))) : [];

        const res = await fetch("/api/visual-lab/analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          signal: ac.signal,
          body: JSON.stringify({
            modelId: modelIdSnap,
            prompt: promptSnap,
            enableThinking: true,
            thinkingBudget: budgetSnap,
            attachments: attachmentPayload,
          }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            message?: unknown;
            error?: unknown;
          } | null;
          const msg =
            (typeof data?.message === "string" && data.message) ||
            (typeof data?.error === "string" && data.error) ||
            `请求失败（${res.status}）`;
          throw new Error(msg);
        }

        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("ndjson")) {
          await readVisualLabAnalysisStream(
            res,
            ac.signal,
            (full) => setAnalysisReasoning(full),
            (full) => setAnalysisReply(full),
          );
        } else {
          const data = (await res.json().catch(() => null)) as {
            content?: unknown;
            reasoning?: unknown;
          } | null;
          setAnalysisReply(typeof data?.content === "string" ? data.content : "");
          setAnalysisReasoning(typeof data?.reasoning === "string" ? data.reasoning : "");
        }
      } catch (e) {
        const isAbort =
          (e instanceof DOMException && e.name === "AbortError") ||
          (e instanceof Error && e.name === "AbortError");
        if (isAbort) {
          setAnalysisStopped(true);
          setAnalysisError(null);
        } else {
          const msg = e instanceof Error ? e.message : "分析失败，请稍后重试。";
          setAnalysisError(msg);
          showUploadFail(msg);
        }
      } finally {
        if (analysisAbortRef.current === ac) analysisAbortRef.current = null;
        if (ac.signal.aborted) {
          setAnalysisStopped(true);
          setAnalysisError(null);
        }
        setAnalyzing(false);
      }
    },
    [analyzing, modelId, thinkingTokens, showUploadFail],
  );

  const handleSend = useCallback(async () => {
    if (!sendReady || analyzing) return;
    await runAnalysisRequest(prompt, [...attachments]);
  }, [sendReady, analyzing, prompt, attachments, runAnalysisRequest]);

  const handleStopAnalysis = useCallback(() => {
    analysisAbortRef.current?.abort();
  }, []);

  const handleTemplateClick = useCallback(
    async (t: AnalysisTemplate) => {
      if (analyzing) return;
      if (t.mode === "image-send") {
        try {
          const res = await fetch(t.imageSrc);
          if (!res.ok) throw new Error("模板图片加载失败，请稍后重试。");
          const blob = await res.blob();
          const mime = blob.type && blob.type.startsWith("image/") ? blob.type : "image/png";
          const file = new File([blob], t.fileName, { type: mime });
          if (!file.type.startsWith("image/")) {
            showUploadFail("模板文件格式无效。");
            return;
          }
          if (file.size > IMG_MAX_BYTES) {
            showUploadFail("模板图片过大。");
            return;
          }
          const url = URL.createObjectURL(file);
          const att: Attachment = { id: newId(), kind: "image", file, url };
          await runAnalysisRequest(t.prompt, [att]);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "模板加载失败";
          showUploadFail(msg);
        }
        return;
      }
      try {
        const res = await fetch(t.videoSrc);
        if (!res.ok) throw new Error("模板视频加载失败，请稍后重试。");
        const blob = await res.blob();
        const mime = blob.type && blob.type.startsWith("video/") ? blob.type : "video/mp4";
        const file = new File([blob], t.fileName, { type: mime });
        if (!file.type.startsWith("video/")) {
          showUploadFail("模板文件格式无效。");
          return;
        }
        if (file.size > VID_MAX_BYTES) {
          showUploadFail("模板视频过大。");
          return;
        }
        const url = URL.createObjectURL(file);
        const att: Attachment = { id: newId(), kind: "video", file, url };
        await runAnalysisRequest(t.prompt, [att]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "模板加载失败";
        showUploadFail(msg);
      }
    },
    [analyzing, runAnalysisRequest, showUploadFail],
  );

  const modelCurrent =
    getVisualLabAnalysisModelById(modelId) ?? VISUAL_LAB_ANALYSIS_MODELS[0]!;
  const modelLabel = modelCurrent.title;

  return (
    <div
      className={
        "vl-analysis-toolbar-pad mx-auto max-w-[1100px] px-4 pt-8 sm:px-6" +
        (submitted ? " vl-analysis-page--session pb-4" : " pb-12")
      }
    >
      <div className="vl-analysis-header-block">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h1 className="vl-h1">分析室</h1>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" className="vl-btn vl-btn-outline vl-btn-sm" onClick={() => void saveToGallery()}>
              保存到成果展
            </button>
            <Link href="/visual-lab/gallery" className="vl-btn vl-btn-outline vl-btn-sm">
              打开成果展
            </Link>
            <Link href="/visual-lab" className="vl-btn vl-btn-outline vl-btn-sm shrink-0">
              返回首页
            </Link>
          </div>
        </div>

        <p className="vl-muted mt-1 text-sm">
          视觉理解模型可以根据您传入的图片或视频进行回答，支持单图或多图的输入，适用于图像描述、视觉问答、物体定位等多种任务。
        </p>

        {!infoBannerDismissed ? (
          <div className="vl-analysis-info-banner" role="status">
            <span className="vl-analysis-info-banner-icon" aria-hidden>
              <Info className="h-3 w-3" strokeWidth={2.5} />
            </span>
            <p className="vl-analysis-info-banner-text">
              模型体验将会消耗免费额度或产生按量付费账单，费用以实际发生为主（模型部署-算力时长计费模型除外）
            </p>
            <button
              type="button"
              className="vl-analysis-info-banner-dismiss"
              aria-label="关闭提示"
              onClick={() => setInfoBannerDismissed(true)}
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        ) : null}

        {uploadFailText ? (
          <div className="vl-upload-fail-banner" role="alert">
            <span className="vl-upload-fail-banner-icon" aria-hidden>
              <X className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
            <p className="vl-upload-fail-banner-text">{uploadFailText}</p>
            <button
              type="button"
              className="vl-upload-fail-banner-dismiss"
              aria-label="关闭"
              onClick={() => setUploadFailText(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      <div className="vl-compose-stack" data-session={submitted ? "true" : undefined}>
        {submitted ? (
          <div ref={resultRef} className="vl-compose-result" onScroll={onComposeResultScroll}>
            {userTurnDisplay ? (
              <div className="vl-analysis-user-turn" aria-label="本次发送内容">
                <div className="vl-analysis-user-bubble">
                  {userTurnDisplay.text ? (
                    <p className="vl-analysis-user-text">{userTurnDisplay.text}</p>
                  ) : null}
                  {userTurnDisplay.images.length > 0 || userTurnDisplay.videos.length > 0 ? (
                    <div className="vl-analysis-user-media">
                      {userTurnDisplay.images.map((src, i) => (
                        <div key={`img-${i}`} className="vl-analysis-user-thumb-hit">
                          <Image
                            src={src}
                            alt=""
                            width={160}
                            height={160}
                            className="vl-analysis-user-thumb"
                            unoptimized
                          />
                          <button
                            type="button"
                            className="vl-analysis-user-thumb-zoom"
                            aria-label="放大查看图片"
                            onClick={() => setMediaLightbox({ kind: "image", src })}
                          >
                            <Eye className="h-5 w-5" strokeWidth={2} aria-hidden />
                          </button>
                        </div>
                      ))}
                      {userTurnDisplay.videos.map((src, i) => (
                        <div key={`vid-${i}`} className="vl-analysis-user-video-shell">
                          <video
                            src={src}
                            className="vl-analysis-user-video"
                            controls
                            playsInline
                            preload="metadata"
                          />
                          <button
                            type="button"
                            className="vl-analysis-user-video-expand"
                            aria-label="放大播放视频"
                            onClick={() => setMediaLightbox({ kind: "video", src })}
                          >
                            <Maximize2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {userTurnDisplay.docs.length > 0 ? (
                    <ul className="vl-analysis-user-docs">
                      {userTurnDisplay.docs.map((d, i) => (
                        <li key={`doc-${i}`}>{d.name}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            ) : null}
            {analysisError ? (
              <p className="vl-analysis-result-error" role="alert">
                {analysisError}
              </p>
            ) : null}
            {analyzing && !analysisReasoning && !analysisReply ? (
              <p className="vl-analysis-result-loading">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                <span>正在调用通义视觉模型（OpenAI 兼容模式）…</span>
              </p>
            ) : null}
            {!analyzing && analysisStopped ? (
              <p className="vl-analysis-result-stopped" role="status">
                回答已停止
              </p>
            ) : null}
            {analysisReasoning ? (
              <details className="vl-analysis-reasoning" open={analyzing}>
                <summary>思考过程</summary>
                <pre
                  ref={reasoningPreRef}
                  className="vl-analysis-reasoning-pre"
                  onScroll={onReasoningPreScroll}
                >
                  {analysisReasoning}
                </pre>
              </details>
            ) : null}
            {!analysisError && analysisReply ? (
              <div className="vl-analysis-result-body">
                <AnalysisReplyMarkdown
                  markdown={analysisReply}
                  onSaveReplyMedia={saveReplyMediaFromAnalysis}
                />
              </div>
            ) : null}
            {!analyzing && !analysisError && !analysisReply && !analysisStopped ? (
              <p className="vl-analysis-result-placeholder">
                模型回复将显示在此。您可在下方继续上传附件、修改说明并再次发送。
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="vl-compose-wrap">
          <div className="vl-compose-welcome" ref={welcomeRef}>
            <div className="vl-compose-welcome-row">
              <Sparkles className="h-4 w-4 shrink-0 text-[var(--vl-accent)]" aria-hidden />
              <span>欢迎进入实验分析室</span>
              <button
                type="button"
                className="vl-model-select"
                onClick={() => setModelMenuOpen((o) => !o)}
                aria-expanded={modelMenuOpen}
              >
                {modelLabel}
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            {modelMenuOpen ? (
              <div className="vl-model-menu" role="listbox">
                {VISUAL_LAB_ANALYSIS_MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="option"
                    aria-selected={modelId === m.id}
                    onClick={() => {
                      setModelId(m.id);
                      setModelMenuOpen(false);
                    }}
                  >
                    <span className="vl-model-menu-option-top">
                      <span className="vl-model-menu-option-icon" aria-hidden>
                        {m.icon}
                      </span>
                      <span className="vl-model-menu-option-title">{m.title}</span>
                    </span>
                    <span className="vl-model-menu-option-desc">{m.description}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="vl-compose-card" onPasteCapture={onComposePasteCapture}>
            {attachments.length > 0 ? (
              <div className="vl-compose-thumbs">
                {attachments.map((a) => (
                  <div key={a.id} className="vl-compose-thumb">
                    {a.kind === "image" ? (
                      <Image
                        src={a.url}
                        alt={a.file.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : a.kind === "video" ? (
                      <>
                        <video src={a.url} className="h-full w-full object-cover" muted playsInline />
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
                          <FileVideo className="h-6 w-6 text-white" />
                        </span>
                      </>
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 p-1 text-center">
                        <Paperclip className="h-4 w-4 text-[var(--vl-muted)]" />
                        <span className="line-clamp-2 text-[0.5625rem] leading-tight text-[var(--vl-muted)]">
                          {a.file.name}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      className="vl-compose-thumb-remove"
                      aria-label="移除"
                      onClick={() => removeAttachment(a.id)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <textarea
              ref={promptInputRef}
              className="vl-compose-input"
              placeholder="在这里输入内容，探索模型的无限可能（支持 Ctrl+V 粘贴截图）"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />

            <div className="vl-compose-toolbar">
              <div className="vl-compose-toolbar-left" ref={attachAnchorRef}>
                {attachMenuOpen ? (
                  <div className="vl-compose-attach-menu">
                    <button
                      type="button"
                      className="vl-compose-attach-item"
                      onClick={() => docInputRef.current?.click()}
                    >
                      <Paperclip className="h-4 w-4 shrink-0" />
                      上传文档（最多 1 个）
                    </button>
                    <button
                      type="button"
                      className="vl-compose-attach-item"
                      onClick={() => imgInputRef.current?.click()}
                    >
                      <ImageIcon className="h-4 w-4 shrink-0" />
                      上传图片（最多 5 个，小于 100MB）
                    </button>
                    <button
                      type="button"
                      className="vl-compose-attach-item"
                      onClick={() => vidInputRef.current?.click()}
                    >
                      <FileVideo className="h-4 w-4 shrink-0" />
                      上传视频（最多 1 个，小于 500MB）
                    </button>
                  </div>
                ) : null}

                <button
                  type="button"
                  className="vl-compose-icon-btn"
                  aria-label="添加附件"
                  onClick={() => setAttachMenuOpen((o) => !o)}
                >
                  <Plus className="h-4 w-4" />
                </button>

                <div ref={deepAnchorRef} style={{ position: "relative" }}>
                  {deepOpen ? (
                    <div className="vl-compose-popover">
                      <div className="vl-compose-popover-title">
                        <span>思考预算</span>
                        <span className="vl-compose-popover-metric">
                          {thinkingTokens.toLocaleString()} tokens
                        </span>
                      </div>
                      <p className="vl-compose-popover-desc">控制思考的最大长度</p>
                      <input
                        type="range"
                        className="vl-compose-slider"
                        min={THINK_MIN}
                        max={THINK_MAX}
                        step={256}
                        value={thinkingTokens}
                        onChange={(e) => setThinkingTokens(Number(e.target.value))}
                      />
                      <div className="vl-compose-slider-labels">
                        <span>最小</span>
                        <span>最大</span>
                      </div>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="vl-compose-chip"
                    data-active="true"
                    onClick={() => setDeepOpen((o) => !o)}
                  >
                    <Atom className="h-3.5 w-3.5" />
                    深度思考
                    {deepOpen ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  className="vl-compose-chip-neutral"
                  data-on={searchOn}
                  onClick={() => setSearchOn((v) => !v)}
                >
                  <Globe className="h-3.5 w-3.5" />
                  搜索
                </button>

                <input
                  ref={docInputRef}
                  type="file"
                  className="sr-only"
                  accept=".pdf,.doc,.docx,.md,.txt"
                  onChange={(e) => onPickInput(e, "doc")}
                />
                <input
                  ref={imgInputRef}
                  type="file"
                  className="sr-only"
                  accept="image/*"
                  multiple
                  onChange={(e) => onPickInput(e, "image")}
                />
                <input
                  ref={vidInputRef}
                  type="file"
                  className="sr-only"
                  accept="video/*"
                  onChange={(e) => onPickInput(e, "video")}
                />
              </div>

              <div className="vl-compose-toolbar-right">
                <span className="vl-compose-balance">
                  可用余额
                  {walletLoading ? (
                    <strong> …</strong>
                  ) : (
                    <>
                      {" "}
                      <strong>
                        已用 ¥{formatYuan(usedMinor ?? 0)} / 余额 ¥{formatYuan(balanceMinor)}
                      </strong>
                    </>
                  )}
                </span>
                {analyzing ? (
                  <button
                    type="button"
                    className="vl-compose-send vl-compose-send--stop"
                    aria-label="停止"
                    onClick={handleStopAnalysis}
                  >
                    <span className="vl-compose-stop-glyph" aria-hidden />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="vl-compose-send"
                    data-ready={sendReady}
                    disabled={!sendReady}
                    aria-label="发送"
                    onClick={() => void handleSend()}
                  >
                    <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {!submitted ? (
            <section className="vl-analysis-templates" aria-label="体验模板">
              <h2 className="vl-analysis-templates-title">选择模板，一键体验</h2>
              <div className="vl-analysis-templates-grid">
                {ANALYSIS_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="vl-analysis-template-card"
                    disabled={analyzing}
                    onClick={() => void handleTemplateClick(t)}
                  >
                    <span className="vl-analysis-template-card-kicker">{t.title}</span>
                    <p className="vl-analysis-template-card-desc">{t.description}</p>
                    <div className="vl-analysis-template-card-media">
                      {t.mode === "video" ? (
                        <video
                          className="vl-analysis-template-card-video"
                          src={t.videoSrc}
                          muted
                          playsInline
                          preload="metadata"
                          aria-hidden
                        />
                      ) : (
                        <Image
                          src={t.imageSrc}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, (max-width: 1100px) 34vw, 260px"
                        />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {saveHint ? <p className="vl-ok-hint mt-3 text-center text-sm">{saveHint}</p> : null}
        </div>
      </div>

      {outcomeQuotaModalKind ? (
        <div
          className="vl-outcome-quota-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="成果展容量提示"
          onClick={() => setOutcomeQuotaModalKind(null)}
        >
          <div className="vl-outcome-quota-panel" onClick={(e) => e.stopPropagation()}>
            <h2 className="vl-outcome-quota-title">成果展空间不足</h2>
            <p className="vl-outcome-quota-text">
              从模型回复保存的
              {outcomeQuotaModalKind === "image" ? "图片" : "视频"}
              已达上限（图片最多 {VISUAL_LAB_REPLY_GALLERY_MAX_IMAGES} 条，视频最多{" "}
              {VISUAL_LAB_REPLY_GALLERY_MAX_VIDEOS} 条，与图生视频库规则同级）。请先到成果展删除旧条目，或充值扩容后再试。
            </p>
            {mainSiteOrigin ? (
              <div className="vl-outcome-quota-packs">
                <a
                  className="vl-btn vl-btn-primary vl-btn-sm"
                  href={`${mainSiteOrigin}/pay/mock-topup?amount=5000`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ¥50 充值套餐
                </a>
                <a
                  className="vl-btn vl-btn-outline vl-btn-sm"
                  href={`${mainSiteOrigin}/pay/mock-topup?amount=10000`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ¥100 充值套餐
                </a>
              </div>
            ) : (
              <p className="vl-outcome-quota-muted">
                未配置主站地址（MAIN_SITE_ORIGIN），无法跳转充值页。
              </p>
            )}
            <button
              type="button"
              className="vl-btn vl-btn-ghost vl-btn-sm vl-outcome-quota-close"
              onClick={() => setOutcomeQuotaModalKind(null)}
            >
              关闭
            </button>
          </div>
        </div>
      ) : null}

      {mediaLightbox ? (
        <div
          className="vl-media-lightbox-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={mediaLightbox.kind === "video" ? "放大视频" : "放大图片"}
          onClick={() => setMediaLightbox(null)}
        >
          <div className="vl-media-lightbox-panel" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="vl-media-lightbox-close"
              aria-label="关闭"
              onClick={() => setMediaLightbox(null)}
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
            {mediaLightbox.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL / dynamic blob URLs
              <img src={mediaLightbox.src} alt="" className="vl-media-lightbox-img" />
            ) : (
              <video
                src={mediaLightbox.src}
                className="vl-media-lightbox-video"
                controls
                playsInline
                autoPlay
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
