"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Camera,
  Clapperboard,
  Download,
  Heart,
  Info,
  Keyboard,
  Link2,
  Palette,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";

import {
  QrWorldSparkCanvas,
  type QrWorldSparkHandle,
  type QrWorldSparkStage,
} from "@/components/quick-replica/qr-world-spark-canvas";
import { resolveWorldId, resolveWorldMarbleUrl } from "@/lib/qr-world-marble-url";
import type { QrTemplate } from "@/lib/qr-template-types";
import { fetchQrWorldViewerPayload, type QrWorldViewerPayload } from "@/lib/qr-world-viewer-api";
import { useLockBodyScroll } from "@/lib/use-lock-body-scroll";

type Props = {
  template: QrTemplate;
  onClose: () => void;
  onLoadPrompt?: (template: QrTemplate) => void;
  onToast?: (message: string) => void;
};

function QrWorldControlsPanel({ onClose }: { onClose: () => void }) {
  const rows: Array<{ label: string; keys: string[] }> = [
    { label: "前进", keys: ["W", "↑"] },
    { label: "后退", keys: ["S", "↓"] },
    { label: "左移", keys: ["A", "←"] },
    { label: "右移", keys: ["D", "→"] },
    { label: "上升", keys: ["E", "Space"] },
    { label: "下降", keys: ["Q"] },
    { label: "加速", keys: ["Shift"] },
    { label: "调整视野", keys: ["[", "]"] },
    { label: "回到原点", keys: ["0"] },
  ];

  return (
    <div
      className="absolute bottom-24 right-4 z-[110] w-[min(420px,calc(100vw-2rem))] rounded-xl border p-4 shadow-2xl"
      style={{ borderColor: "var(--qr-border)", background: "var(--qr-bg-surface)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--qr-text-primary)]">Controls</h3>
        <button
          type="button"
          aria-label="关闭"
          onClick={onClose}
          className="rounded-lg p-1 text-[var(--qr-text-muted)] hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-2">
            <span className="text-[var(--qr-text-muted)]">{row.label}</span>
            <span className="flex gap-1">
              {row.keys.map((k) => (
                <kbd
                  key={k}
                  className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-[var(--qr-text-primary)]"
                >
                  {k}
                </kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-[var(--qr-text-muted)]">
        点击场景区域后使用 WASD 漫游；拖拽鼠标可环视。
      </p>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  );
}

function QrWorldLoadBadge({ stage, message }: { stage: QrWorldSparkStage; message?: string }) {
  if (stage === "ready" || stage === "error") return null;
  const label =
    message ??
    (stage === "preview" ? "Loading preview…" : stage === "loading-full" ? "Loading full quality…" : "Loading…");
  return (
    <div
      className="pointer-events-none absolute bottom-3 right-3 z-[105] flex items-center gap-2 rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-xs text-white/70 backdrop-blur-md"
      aria-live="polite"
    >
      <span className="inline-block h-3 w-3 animate-spin rounded-full border border-white/25 border-t-white/80" />
      <span>{label}</span>
    </div>
  );
}

export function QrWorldViewer({ template, onClose, onLoadPrompt, onToast }: Props) {
  const [mounted, setMounted] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [payload, setPayload] = useState<QrWorldViewerPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sparkStage, setSparkStage] = useState<QrWorldSparkStage>("preview");
  const [sparkStageMessage, setSparkStageMessage] = useState<string | undefined>();
  const sparkRef = useRef<QrWorldSparkHandle>(null);

  const worldId = resolveWorldId(template);
  const marbleUrl = resolveWorldMarbleUrl(template);
  const promptPreview = template.reference.prompt.text.trim();
  const previewThumb = template.thumbnailUrl?.trim() || undefined;

  useLockBodyScroll(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!worldId) {
      setLoading(false);
      setLoadError("该条目缺少 world_id");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setPayload(null);
    setSparkStage("preview");
    setSparkStageMessage(undefined);

    void fetchQrWorldViewerPayload(worldId)
      .then((data) => {
        if (cancelled) return;
        setPayload(data);
        if (!data.spzUrl) {
          setLoadError("该场景暂无 3D splat 资产，可在 Marble 官网查看");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "加载场景失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [worldId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copyLink = useCallback(async () => {
    const url = payload?.worldMarbleUrl ?? marbleUrl;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      onToast?.("已复制场景链接");
    } catch {
      onToast?.("复制失败");
    }
  }, [payload?.worldMarbleUrl, marbleUrl, onToast]);

  const openExternal = useCallback(() => {
    const url = payload?.worldMarbleUrl ?? marbleUrl;
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [payload?.worldMarbleUrl, marbleUrl]);

  const resetView = useCallback(() => {
    sparkRef.current?.resetView();
  }, []);

  if (!mounted) return null;

  const hasOpenArtTiers = Boolean(payload?.preview100kSpzUrl && payload?.fullResSpzUrl);
  const lowResUrl = hasOpenArtTiers
    ? payload!.preview100kSpzUrl!
    : payload?.lowResSpzUrl ?? null;
  const highResUrl = hasOpenArtTiers
    ? payload!.fullResSpzUrl!
    : payload?.highResSpzUrl ?? payload?.spzUrl ?? null;
  const spzUrl = highResUrl ?? lowResUrl;
  const showSpark = Boolean(spzUrl && !loadError);

  return createPortal(
    <div className="fixed inset-0 z-[100]" style={{ background: "#060910" }}>
      {showSpark ? (
        <QrWorldSparkCanvas
          ref={sparkRef}
          key={`${lowResUrl ?? ""}|${highResUrl ?? ""}`}
          lowResUrl={lowResUrl}
          highResUrl={highResUrl}
          onStageChange={(stage, message) => {
            setSparkStage(stage);
            setSparkStageMessage(message);
          }}
          onError={(msg) => {
            setLoadError(msg);
            setSparkStage("error");
          }}
        />
      ) : null}

      {loading && !loadError && !showSpark ? (
        <QrWorldLoadBadge stage="preview" message="Loading scene…" />
      ) : showSpark && !loadError ? (
        <QrWorldLoadBadge stage={sparkStage} message={sparkStageMessage} />
      ) : null}

      {loadError ? (
        <div className="absolute inset-0 z-[103] flex items-center justify-center px-4">
          <div className="max-w-md rounded-2xl border border-white/10 bg-black/75 px-6 py-5 text-center backdrop-blur-md">
            <p className="text-sm leading-relaxed text-white/80">{loadError}</p>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        aria-label="关闭全屏"
        onClick={onClose}
        className="absolute right-4 top-4 z-[105] flex h-9 w-9 items-center justify-center rounded-lg bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
      >
        <X className="h-5 w-5" />
      </button>

      {promptPreview ? (
        <div className="pointer-events-none absolute left-1/2 top-4 z-[105] w-[min(640px,calc(100vw-6rem))] -translate-x-1/2">
          <div className="rounded-xl border border-white/10 bg-black/55 px-4 py-2.5 text-center text-xs leading-relaxed text-white/90 backdrop-blur-md">
            <span className="line-clamp-2">{promptPreview}</span>
          </div>
        </div>
      ) : null}

      {worldId && !loadError ? (
        <>
          <div className="absolute bottom-6 left-1/2 z-[105] flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-white/10 bg-black/55 px-2 py-1 backdrop-blur-md">
            <ToolbarButton label="重置视角" onClick={resetView}>
              <RotateCcw className="h-[18px] w-[18px]" />
            </ToolbarButton>
            <ToolbarButton label="风格" onClick={() => onToast?.("风格调整即将推出")}>
              <Palette className="h-[18px] w-[18px]" />
            </ToolbarButton>
            <ToolbarButton label="视频" onClick={() => onToast?.("视频导出即将推出")}>
              <Clapperboard className="h-[18px] w-[18px]" />
            </ToolbarButton>
            <span className="mx-1 h-5 w-px bg-white/15" aria-hidden />
            <ToolbarButton label="在 Marble 打开" onClick={openExternal}>
              <Download className="h-[18px] w-[18px]" />
            </ToolbarButton>
            <ToolbarButton label="截图" onClick={() => onToast?.("请使用系统截图")}>
              <Camera className="h-[18px] w-[18px]" />
            </ToolbarButton>
            <ToolbarButton label="复制链接" onClick={() => void copyLink()}>
              <Link2 className="h-[18px] w-[18px]" />
            </ToolbarButton>
            <ToolbarButton label="收藏" onClick={() => onToast?.("收藏即将推出")}>
              <Heart className="h-[18px] w-[18px]" />
            </ToolbarButton>
            <ToolbarButton label="喜欢" onClick={() => onToast?.("反馈即将推出")}>
              <ThumbsUp className="h-[18px] w-[18px]" />
            </ToolbarButton>
            <ToolbarButton label="不喜欢" onClick={() => onToast?.("反馈即将推出")}>
              <ThumbsDown className="h-[18px] w-[18px]" />
            </ToolbarButton>
          </div>

          <div className="absolute bottom-6 right-4 z-[105] flex flex-col items-center gap-2">
            <button
              type="button"
              title="键盘说明"
              aria-label="键盘说明"
              onClick={() => setControlsOpen((o) => !o)}
              className={`flex h-10 w-10 items-center justify-center rounded-lg border backdrop-blur-md transition ${
                controlsOpen
                  ? "border-white/25 bg-white/15 text-white"
                  : "border-white/10 bg-black/55 text-white/80 hover:text-white"
              }`}
            >
              <Keyboard className="h-[18px] w-[18px]" />
            </button>
            {onLoadPrompt ? (
              <button
                type="button"
                title="载入提示词到创作框"
                aria-label="载入提示词"
                onClick={() => onLoadPrompt(template)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-black/55 text-white/80 backdrop-blur-md transition hover:text-white"
              >
                <Info className="h-[18px] w-[18px]" />
              </button>
            ) : null}
          </div>

          {controlsOpen ? <QrWorldControlsPanel onClose={() => setControlsOpen(false)} /> : null}
        </>
      ) : null}
    </div>,
    document.body,
  );
}
