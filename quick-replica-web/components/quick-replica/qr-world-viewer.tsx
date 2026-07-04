"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
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
import { QrWorldLoadProgress } from "@/components/quick-replica/qr-world-load-progress";
import { QrWorldLoadingBackdrop } from "@/components/quick-replica/qr-world-loading-backdrop";
import { QrWorldScreenshotMenu } from "@/components/quick-replica/qr-world-screenshot-menu";
import { QrWorldShutterFlash } from "@/components/quick-replica/qr-world-shutter-flash";
import { downloadDataUrl, triggerSameOriginDownload } from "@/lib/qr-world-download";
import { resolveWorldId, resolveWorldMarbleUrl } from "@/lib/qr-world-marble-url";
import {
  resolveTemplatePanoUrl,
  resolveTemplateSplatUrls,
} from "@/lib/qr-world-template-splat";
import type { QrTemplate } from "@/lib/qr-template-types";
import {
  fetchQrWorldViewerPayload,
  proxifyWorldImageUrl,
  type QrWorldViewerPayload,
} from "@/lib/qr-world-viewer-api";
import { useLockBodyScroll } from "@/lib/use-lock-body-scroll";

type Props = {
  template: QrTemplate;
  onClose: () => void;
  /** 点击顶部提示条：带入提示词与参考图到创作框（不关闭 viewer） */
  onEditPrompt?: (template: QrTemplate) => void;
  onToast?: (message: string) => void;
};

function QrSwitch({
  checked,
  onChange,
  label,
  subtitle,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  subtitle?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--qr-text-primary)]">{label}</span>
        {subtitle ? (
          <span className="block text-xs leading-snug text-[var(--qr-text-muted)]">{subtitle}</span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 rounded-full border transition ${
          checked
            ? "border-[rgba(59,130,246,0.6)] bg-[rgba(59,130,246,0.35)]"
            : "border-white/15 bg-white/10"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
            checked ? "left-[1.05rem]" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function QrWorldControlsPanel({
  naturalMouse,
  invertTrackpadDrag,
  onNaturalMouseChange,
  onInvertTrackpadDragChange,
  onClose,
}: {
  naturalMouse: boolean;
  invertTrackpadDrag: boolean;
  onNaturalMouseChange: (next: boolean) => void;
  onInvertTrackpadDragChange: (next: boolean) => void;
  onClose: () => void;
}) {
  const col1: Array<{ label: string; keys: string[] }> = [
    { label: "Move forward", keys: ["W"] },
    { label: "Move left", keys: ["A"] },
    { label: "Move backward", keys: ["S"] },
    { label: "Move right", keys: ["D"] },
  ];
  const col2: Array<{ label: string; keys: string[] }> = [
    { label: "Move up", keys: ["E", "Space"] },
    { label: "Move down", keys: ["Q"] },
    { label: "Move faster", keys: ["Shift"] },
  ];
  const col3: Array<{ label: string; keys: string[] }> = [
    { label: "Change FOV", keys: ["[", "]"] },
    { label: "Return to origin", keys: ["0"] },
  ];
  const col4: Array<{ label: string; keys: string[] }> = [
    { label: "Drag", keys: ["Mouse"] },
    { label: "360° Look", keys: ["Orbit"] },
    { label: "Pan", keys: ["Shift", "+", "Drag"] },
  ];

  return (
    <div
      className="absolute inset-x-4 bottom-6 z-[110] mx-auto w-[min(920px,calc(100vw-2rem))] rounded-2xl border p-5 shadow-2xl backdrop-blur-xl"
      style={{
        borderColor: "var(--qr-border)",
        background:
          "linear-gradient(120deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02) 45%, rgba(234,94,193,0.07) 100%)",
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--qr-text-primary)]">Controls</h3>
        <button
          type="button"
          aria-label="关闭"
          onClick={onClose}
          className="rounded-lg p-1 text-[var(--qr-text-muted)] hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        {[col1, col2, col3, col4].map((col, idx) => (
          <div key={`col-${idx}`} className={idx < 3 ? "border-r border-white/10 pr-4 md:pr-6" : ""}>
            <div className="space-y-3">
              {col.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-[var(--qr-text-primary)]">{row.label}</span>
                  <span className="flex items-center gap-1.5">
                    {row.keys.map((k) => (
                      <kbd
                        key={k}
                        className="min-w-8 rounded-md border border-white/15 bg-black/25 px-2 py-1 text-center font-mono text-xs text-white/90"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <QrSwitch
          checked={naturalMouse}
          onChange={onNaturalMouseChange}
          label="Natural Mouse"
          subtitle="Content tracks mouse movement"
        />
        <QrSwitch
          checked={invertTrackpadDrag}
          onChange={onInvertTrackpadDragChange}
          label="Invert Trackpad Drag"
        />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-[var(--qr-text-muted)]">
        Click the scene, then drag with mouse for 360° look; use keyboard for movement.
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

export function QrWorldViewer({ template, onClose, onEditPrompt, onToast }: Props) {
  const [mounted, setMounted] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [payload, setPayload] = useState<QrWorldViewerPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sparkStage, setSparkStage] = useState<QrWorldSparkStage>("preview");
  const [sparkStageMessage, setSparkStageMessage] = useState<string | undefined>();
  const [hasFirstVisual, setHasFirstVisual] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [naturalMouse, setNaturalMouse] = useState(false);
  const [invertTrackpadDrag, setInvertTrackpadDrag] = useState(false);
  const [shutterFlash, setShutterFlash] = useState(0);
  const sparkRef = useRef<QrWorldSparkHandle>(null);

  const worldId = resolveWorldId(template);
  const marbleUrl = resolveWorldMarbleUrl(template);
  const templateSplats = useMemo(
    () => (worldId ? resolveTemplateSplatUrls(template, worldId) : null),
    [template, worldId],
  );
  const promptPreview = template.reference.prompt.text.trim();
  const previewThumb =
    template.reference.slots.sceneImages?.[0]?.url?.trim() ||
    template.thumbnailUrl?.trim() ||
    undefined;

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
    setHasFirstVisual(false);
    setLoadProgress(0);

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

  const resetView = useCallback(() => {
    sparkRef.current?.resetView();
  }, []);

  const captureFrame = useCallback((): string | null => {
    const fromRef = sparkRef.current?.captureScreenshot();
    if (fromRef) return fromRef;
    const canvas = document.querySelector<HTMLCanvasElement>(
      "[data-qr-world-spark-host] canvas",
    );
    if (!canvas) return null;
    try {
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  }, []);

  const downloadSpz = useCallback(() => {
    const url =
      payload?.fullResSpzUrl ??
      payload?.highResSpzUrl ??
      payload?.spzUrl ??
      templateSplats?.highResUrl ??
      null;
    if (!worldId || !url) {
      onToast?.("暂无可下载的 3D 资产");
      return;
    }
    const ext = url.split("?")[0]?.split(".").pop()?.toLowerCase() || "spz";
    const slug =
      template.title.trim().replace(/[/\\?%*:|"<>]/g, "_").slice(0, 48) || "marble-world";
    const filename = `${slug}-${worldId.slice(0, 8)}.${ext}`;
    onToast?.("正在下载 3D 资产…");
    triggerSameOriginDownload(url, filename);
  }, [payload, template.title, templateSplats?.highResUrl, worldId, onToast]);

  const takeScreenshot = useCallback(() => {
    const dataUrl = captureFrame();
    if (!dataUrl) {
      onToast?.("场景尚未就绪，请稍后再试");
      return;
    }
    setShutterFlash((n) => n + 1);
    const slug = template.title.trim().replace(/[/\\?%*:|"<>]/g, "_").slice(0, 48) || "marble-world";
    downloadDataUrl(dataUrl, `${slug}-screenshot.png`);
    onToast?.("截图已保存");
  }, [captureFrame, template.title, onToast]);

  const takePanoramaScreenshot = useCallback(() => {
    if (!worldId) {
      onToast?.("缺少场景 ID");
      return;
    }
    const rawPano =
      payload?.panoUrl?.trim() ||
      resolveTemplatePanoUrl(template) ||
      previewThumb ||
      null;
    if (!rawPano) {
      onToast?.("该场景暂无全景图，已保存当前视角截图");
      takeScreenshot();
      return;
    }
    const proxied = proxifyWorldImageUrl(worldId, rawPano);
    if (!proxied) {
      onToast?.("全景图地址无效");
      return;
    }
    setShutterFlash((n) => n + 1);
    const slug =
      template.title.trim().replace(/[/\\?%*:|"<>]/g, "_").slice(0, 48) || "marble-world";
    const ext = rawPano.split("?")[0]?.split(".").pop()?.toLowerCase() || "jpg";
    const filename = `${slug}-panorama.${ext}`;
    onToast?.("正在下载全景图…");
    triggerSameOriginDownload(proxied, filename);
    onToast?.("全景图已保存");
  }, [payload?.panoUrl, previewThumb, takeScreenshot, template, worldId, onToast]);

  if (!mounted) return null;

  const payloadProgressive = Boolean(
    payload?.preview100kSpzUrl && payload?.fullResSpzUrl,
  );
  const templateProgressive = Boolean(
    templateSplats?.lowResUrl &&
      templateSplats?.highResUrl &&
      templateSplats.lowResUrl !== templateSplats.highResUrl,
  );

  const lowResUrl = payloadProgressive
    ? payload!.preview100kSpzUrl!
    : templateProgressive
      ? templateSplats!.lowResUrl
      : null;
  const highResUrl =
    payload?.fullResSpzUrl ??
    payload?.highResSpzUrl ??
    payload?.spzUrl ??
    templateSplats?.highResUrl ??
    null;
  const spzUrl = highResUrl ?? lowResUrl;
  const showSpark = Boolean(spzUrl && !loadError);
  const sceneReady = hasFirstVisual || sparkStage === "ready";

  const showLoadingBackdrop = !loadError && !hasFirstVisual;

  const loadProgressLabel =
    loading && !showSpark
      ? "加载场景…"
      : sparkStageMessage ??
        (sparkStage === "loading-full" ? "加载高清画质…" : undefined);

  return createPortal(
    <div className="fixed inset-0 z-[100]" style={{ background: "#060910" }}>
      <QrWorldLoadingBackdrop active={showLoadingBackdrop} thumbUrl={previewThumb} />
      <QrWorldLoadProgress
        active={showLoadingBackdrop}
        ratio={loadProgress}
        label={loadProgressLabel}
      />
      <QrWorldShutterFlash trigger={shutterFlash} />

      {showSpark ? (
        <QrWorldSparkCanvas
          ref={sparkRef}
          key={worldId ?? template.id}
          lowResUrl={lowResUrl}
          highResUrl={highResUrl}
          naturalMouse={naturalMouse}
          invertTrackpadDrag={invertTrackpadDrag}
          onProgress={setLoadProgress}
          onFirstVisual={() => setHasFirstVisual(true)}
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
        <button
          type="button"
          onClick={() => onEditPrompt?.(template)}
          className="absolute left-1/2 top-4 z-[105] w-[min(640px,calc(100vw-6rem))] -translate-x-1/2 rounded-xl border border-white/10 bg-black/55 px-4 py-2.5 text-left backdrop-blur-md transition hover:border-white/25 hover:bg-black/65"
        >
          <span className="flex items-start gap-3">
            {previewThumb ? (
              <span className="mt-0.5 block h-10 w-10 shrink-0 overflow-hidden rounded-md border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewThumb} alt="" className="h-full w-full object-cover" />
              </span>
            ) : null}
            <span className="line-clamp-2 min-w-0 flex-1 text-xs leading-relaxed text-white/90">
              {promptPreview}
            </span>
          </span>
        </button>
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
            <ToolbarButton label="下载 3D 资产" onClick={downloadSpz}>
              <Download className="h-[18px] w-[18px]" />
            </ToolbarButton>
            <QrWorldScreenshotMenu
              disabled={!sceneReady}
              onScreenshot={takeScreenshot}
              onPanoramaScreenshot={takePanoramaScreenshot}
            />
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
            {onEditPrompt ? (
              <button
                type="button"
                title="编辑提示词与参考图"
                aria-label="编辑提示词"
                onClick={() => onEditPrompt(template)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-black/55 text-white/80 backdrop-blur-md transition hover:text-white"
              >
                <Info className="h-[18px] w-[18px]" />
              </button>
            ) : null}
          </div>

          {controlsOpen ? (
            <QrWorldControlsPanel
              naturalMouse={naturalMouse}
              invertTrackpadDrag={invertTrackpadDrag}
              onNaturalMouseChange={setNaturalMouse}
              onInvertTrackpadDragChange={setInvertTrackpadDrag}
              onClose={() => setControlsOpen(false)}
            />
          ) : null}
        </>
      ) : null}
    </div>,
    document.body,
  );
}
