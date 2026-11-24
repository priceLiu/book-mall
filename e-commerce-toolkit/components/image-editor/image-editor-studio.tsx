"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, RotateCcw, ChevronUp, ChevronDown } from "lucide-react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomAssetPickerDialog } from "@/components/media/ecom-asset-picker-dialog";
import { ImageEditorAdjustPanel } from "@/components/image-editor/image-editor-adjust-panel";
import { ImageEditorCanvasPanel } from "@/components/image-editor/image-editor-canvas-panel";
import { ImageEditorCanvasStage } from "@/components/image-editor/image-editor-canvas-stage";
import { ImageEditorHeader } from "@/components/image-editor/image-editor-header";
import { ImageEditorToolRail } from "@/components/image-editor/image-editor-tool-rail";
import "@/components/image-editor/image-editor-theme.css";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { IMAGE_UPLOAD_ACCEPT } from "@/lib/image-upload-utils";
import {
  fetchImageProcessingModels,
  submitImageProcessingEdit,
} from "@/lib/ecom-image-processing-api";
import {
  readImageEditorCustomPresets,
  writeImageEditorCustomPresets,
} from "@/lib/image-editor-presets";
import {
  persistableImageUrl,
  readImageEditorSession,
  writeImageEditorSession,
  type ImageEditorSessionSnapshot,
} from "@/lib/image-editor-persist";
import { exportImageEditorFrame, renderImageEditorCropRegion, renderImageEditorFrame } from "@/lib/image-editor-render";
import { cropRectForRatio, fullImageCropRect, type ImageEditorCropRect } from "@/lib/image-editor-crop-rect";
import { takeImageEditorImportUrl } from "@/lib/image-editor-session";
import { stepRotateDeg } from "@/lib/image-editor-transform";
import {
  IMAGE_EDITOR_CORRECTION_DEFAULT,
  imageEditorCorrectionCss,
  isImageEditorCorrectionNeutral,
  renderImageEditorCorrection,
  type ImageEditorCorrection,
} from "@/lib/image-editor-correction";
import { cn } from "@/lib/utils";
import { useImageDropPaste } from "@/hooks/use-image-drop-paste";
import type {
  ImageEditorAdjustTab,
  ImageEditorPresetSize,
  ImageEditorShapeMaskId,
  ImageEditorToolId,
} from "@/lib/image-editor-types";

async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = src;
  });
}

type HistoryEntry = { url: string; canvasW: number; canvasH: number };

const DEFAULT_CANVAS = 2048;

export function ImageEditorStudio() {
  const { alert, confirm, toast } = useDialogs();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tool, setTool] = useState<ImageEditorToolId>("adjust");
  const [adjustTab, setAdjustTab] = useState<ImageEditorAdjustTab>("resize");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);
  const [canvasW, setCanvasW] = useState(2048);
  const [canvasH, setCanvasH] = useState(2048);
  const [lockAspect, setLockAspect] = useState(true);
  const [rotateDeg, setRotateDeg] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [busy, setBusy] = useState(false);
  const [assetOpen, setAssetOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [bgModel, setBgModel] = useState("");
  const [enhancerModel, setEnhancerModel] = useState("");
  const [erasePrompt, setErasePrompt] = useState("移除画面中的干扰物体");

  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturate, setSaturate] = useState(100);
  const [losslessResize, setLosslessResize] = useState(true);
  const [customPresets, setCustomPresets] = useState<ImageEditorPresetSize[]>([]);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correction, setCorrection] = useState<ImageEditorCorrection>(IMAGE_EDITOR_CORRECTION_DEFAULT);
  const [shapeMask, setShapeMask] = useState<ImageEditorShapeMaskId>("none");
  const [canvasFrameDragging, setCanvasFrameDragging] = useState(false);
  const [baseDisplayUrl, setBaseDisplayUrl] = useState<string | null>(null);
  const [cropPreviewUrl, setCropPreviewUrl] = useState<string | null>(null);
  const [cropRect, setCropRect] = useState<ImageEditorCropRect | null>(null);
  const cropRectRef = useRef<ImageEditorCropRect | null>(null);
  const cropDraftRef = useRef<ImageEditorCropRect | null>(null);
  cropRectRef.current = cropRect;
  const hydratedRef = useRef(false);
  const persistImageUrlRef = useRef<string | null>(null);
  const [sessionPersistUrl, setSessionPersistUrl] = useState<string | null>(null);
  const adjustDraftRef = useRef<{ w: number; h: number; rotateDeg: number; flipH: boolean; flipV: boolean } | null>(
    null,
  );
  const shapeDraftRef = useRef<{
    w: number;
    h: number;
    shape: ImageEditorShapeMaskId;
    rotateDeg: number;
    flipH: boolean;
    flipV: boolean;
  } | null>(null);

  const filterStyle = useMemo(
    () =>
      `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`,
    [brightness, contrast, saturate],
  );

  const pushHistory = useCallback(
    (url: string, w: number, h: number) => {
      setHistory((prev) => {
        const trimmed = prev.slice(0, historyIdx + 1);
        return [...trimmed, { url, canvasW: w, canvasH: h }];
      });
      setHistoryIdx((i) => i + 1);
    },
    [historyIdx],
  );

  const applyUrl = useCallback(
    (url: string, w?: number, h?: number) => {
      setImageUrl(url);
      setDisplayUrl(url);
      void loadImage(url).then((img) => {
        const nw = img.naturalWidth;
        const nh = img.naturalHeight;
        setNaturalW(nw);
        setNaturalH(nh);
        const cw = w ?? nw;
        const ch = h ?? nh;
        setCanvasW(cw);
        setCanvasH(ch);
        pushHistory(url, cw, ch);
      });
      void persistableImageUrl(url).then(({ url: persisted, omitted }) => {
        if (omitted) {
          persistImageUrlRef.current = null;
          setSessionPersistUrl(null);
          return;
        }
        const next = persisted ?? url;
        persistImageUrlRef.current = next;
        setSessionPersistUrl(next);
      });
    },
    [pushHistory],
  );

  useEffect(() => {
    setCustomPresets(readImageEditorCustomPresets());
  }, []);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const snap = readImageEditorSession();
    if (snap) {
      setTool(snap.tool);
      setAdjustTab(snap.adjustTab);
      const snapCanvasOk = snap.canvasW >= 200 && snap.canvasH >= 200;
      if (snapCanvasOk) {
        setCanvasW(snap.canvasW);
        setCanvasH(snap.canvasH);
      }
      setRotateDeg(snap.rotateDeg);
      setFlipH(snap.flipH);
      setFlipV(snap.flipV);
      setShapeMask(snap.shapeMask);
      setLosslessResize(snap.losslessResize);
      setLockAspect(snap.lockAspect);
      setCorrectionOpen(snap.correctionOpen);
      setCorrection({
        vertical: snap.correctVertical ?? 50,
        horizontal: snap.correctHorizontal ?? 50,
        center: snap.correctCenter ?? 50,
        rotate: snap.correctRotate ?? 0,
      });
      setBrightness(snap.brightness);
      setContrast(snap.contrast);
      setSaturate(snap.saturate);
      setErasePrompt(snap.erasePrompt);
      if (snap.imageOmitted) {
        toast({
          title: "会话图片未保存",
          message: "图片过大未写入会话，请重新上传或粘贴。",
        });
      } else if (snap.imageUrl) {
        persistImageUrlRef.current = snap.imageUrl;
        setSessionPersistUrl(snap.imageUrl);
        applyUrl(
          snap.imageUrl,
          snapCanvasOk ? snap.canvasW : undefined,
          snapCanvasOk ? snap.canvasH : undefined,
        );
      }
      return;
    }
    const imported = takeImageEditorImportUrl();
    if (imported) applyUrl(imported);
  }, [applyUrl, toast]);

  useEffect(() => {
    if (tool === "adjust" && imageUrl && !adjustDraftRef.current) {
      adjustDraftRef.current = {
        w: canvasW,
        h: canvasH,
        rotateDeg,
        flipH,
        flipV,
      };
    }
    if (tool !== "adjust") adjustDraftRef.current = null;
  }, [tool, imageUrl, canvasW, canvasH, rotateDeg, flipH, flipV]);

  const shapeOverlay =
    tool === "adjust" && Boolean(imageUrl) && shapeMask !== "none";

  /** 比例裁剪与尺寸调整只在「裁剪/旋转/尺寸」展开时生效 */
  const cropSectionActive = tool === "adjust" && Boolean(imageUrl) && !correctionOpen;

  const canvasCropInteract = cropSectionActive && adjustTab === "ratio";

  const resizeInteract =
    cropSectionActive && (adjustTab === "resize" || adjustTab === "shape");

  const correctionInteract = tool === "adjust" && Boolean(imageUrl) && correctionOpen;

  const canvasFrameInteract = canvasCropInteract;

  const previewShapeMask = cropSectionActive && shapeOverlay ? shapeMask : "none";

  /** 编辑中只叠蒙版压暗，确定时再写入裁切 */
  const previewClipInRender = "none" as const;

  const activeFilterStyle =
    tool === "color" || brightness !== 100 || contrast !== 100 || saturate !== 100 ? filterStyle : undefined;

  useEffect(() => {
    if (!imageUrl) {
      setDisplayUrl(null);
      setBaseDisplayUrl(null);
      setCropPreviewUrl(null);
      return;
    }
    if (canvasFrameInteract) return;

    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      void renderImageEditorFrame(imageUrl, {
        canvasW,
        canvasH,
        rotateDeg,
        flipH,
        flipV,
        shapeMask: previewClipInRender,
        fitInside: adjustTab === "resize" ? false : losslessResize,
        stretch: adjustTab === "resize",
        filterStyle: activeFilterStyle,
        previewMaxEdge: 1600,
      })
        .then((url) => {
          if (!cancelled) setDisplayUrl(url);
        })
        .catch(() => {
          if (!cancelled) setDisplayUrl(imageUrl);
        });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [
    imageUrl,
    canvasW,
    canvasH,
    rotateDeg,
    flipH,
    flipV,
    previewClipInRender,
    losslessResize,
    activeFilterStyle,
    canvasFrameInteract,
    adjustTab,
  ]);

  /** 裁切交互：底图固定在原图档（仅旋转/滤镜），不随裁切框缩放 */
  useEffect(() => {
    if (!imageUrl || !canvasFrameInteract || naturalW < 1) {
      setBaseDisplayUrl(null);
      return;
    }
    let cancelled = false;
    void renderImageEditorFrame(imageUrl, {
      canvasW: naturalW,
      canvasH: naturalH,
      rotateDeg,
      flipH,
      flipV,
      shapeMask: "none",
      fitInside: true,
      filterStyle: activeFilterStyle,
      previewMaxEdge: 1600,
    })
      .then((url) => {
        if (!cancelled) setBaseDisplayUrl(url);
      })
      .catch(() => {
        if (!cancelled) setBaseDisplayUrl(imageUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [
    imageUrl,
    canvasFrameInteract,
    naturalW,
    naturalH,
    rotateDeg,
    flipH,
    flipV,
    activeFilterStyle,
  ]);

  /** 松手后的裁切预览由 onCanvasDragActiveChange 写入 cropPreviewUrl */
  useEffect(() => {
    if (!canvasFrameInteract) setCropPreviewUrl(null);
  }, [canvasFrameInteract]);

  useEffect(() => {
    if (!canvasCropInteract) {
      cropDraftRef.current = null;
      return;
    }
    if (!cropDraftRef.current && cropRect) {
      cropDraftRef.current = { ...cropRect };
    }
  }, [canvasCropInteract, cropRect]);

  const cancelResizeEdit = useCallback(() => {
    const d = adjustDraftRef.current;
    if (!d) return;
    setCanvasW(d.w);
    setCanvasH(d.h);
    setRotateDeg(d.rotateDeg);
    setFlipH(d.flipH);
    setFlipV(d.flipV);
  }, []);

  const cancelCropEdit = useCallback(() => {
    const d = cropDraftRef.current;
    if (!d) return;
    const next = { ...d };
    cropRectRef.current = next;
    setCropRect(next);
    setCanvasW(Math.max(1, Math.round(next.w)));
    setCanvasH(Math.max(1, Math.round(next.h)));
    setCropPreviewUrl(null);
    const adjust = adjustDraftRef.current;
    if (adjust) {
      setRotateDeg(adjust.rotateDeg);
      setFlipH(adjust.flipH);
      setFlipV(adjust.flipV);
    }
  }, []);

  const onCanvasFrameResize = useCallback((w: number, h: number) => {
    setCanvasW(w);
    setCanvasH(h);
  }, []);

  const onCanvasDragActiveChange = useCallback((active: boolean) => {
    setCanvasFrameDragging(active);
    if (active) {
      setCropPreviewUrl(null);
      return;
    }
    if (adjustTab === "resize" || adjustTab === "shape") return;
    const rect = cropRectRef.current;
    if (!imageUrl || !rect) return;
    setCanvasW(Math.max(1, Math.round(rect.w)));
    setCanvasH(Math.max(1, Math.round(rect.h)));
    void renderImageEditorCropRegion(
      imageUrl,
      rect,
      1600,
      shapeMask,
    )
      .then((url) => setCropPreviewUrl(url))
      .catch(() => setCropPreviewUrl(null));
  }, [adjustTab, imageUrl, shapeMask]);

  useEffect(() => {
    if (naturalW > 0 && naturalH > 0) {
      const next = fullImageCropRect(naturalW, naturalH);
      setCropRect(next);
      cropRectRef.current = next;
    }
  }, [imageUrl, naturalH, naturalW]);

  const clearImage = useCallback(async () => {
    if (!imageUrl) return;
    const confirmed = await confirm({
      title: "移除当前图片",
      message: "将清空中栏图片并回到初始上传状态，可重新打开或粘贴。",
      confirmLabel: "移除",
      cancelLabel: "取消",
    });
    if (!confirmed) return;
    setImageUrl(null);
    setDisplayUrl(null);
    setBaseDisplayUrl(null);
    setCropPreviewUrl(null);
    setNaturalW(0);
    setNaturalH(0);
    setCanvasW(DEFAULT_CANVAS);
    setCanvasH(DEFAULT_CANVAS);
    setRotateDeg(0);
    setFlipH(false);
    setFlipV(false);
    setShapeMask("none");
    setHistory([]);
    setHistoryIdx(-1);
    adjustDraftRef.current = null;
    shapeDraftRef.current = null;
    persistImageUrlRef.current = null;
    setSessionPersistUrl(null);
    writeImageEditorSession({
      v: 1,
      tool,
      adjustTab,
      canvasW: DEFAULT_CANVAS,
      canvasH: DEFAULT_CANVAS,
      rotateDeg: 0,
      flipH: false,
      flipV: false,
      shapeMask: "none",
      losslessResize,
      lockAspect,
      correctionOpen,
      brightness,
      contrast,
      saturate,
      erasePrompt,
      correctVertical: correction.vertical,
      correctHorizontal: correction.horizontal,
      correctCenter: correction.center,
      correctRotate: correction.rotate,
      imageUrl: null,
    });
    toast({ title: "已移除图片", variant: "success" });
  }, [
    adjustTab,
    brightness,
    confirm,
    contrast,
    correctionOpen,
    erasePrompt,
    imageUrl,
    lockAspect,
    losslessResize,
    saturate,
    toast,
    tool,
    correction,
  ]);

  useEffect(() => {
    const snapshot: ImageEditorSessionSnapshot = {
      v: 1,
      tool,
      adjustTab,
      canvasW,
      canvasH,
      rotateDeg,
      flipH,
      flipV,
      shapeMask,
      losslessResize,
      lockAspect,
      correctionOpen,
      brightness,
      contrast,
      saturate,
      erasePrompt,
      correctVertical: correction.vertical,
      correctHorizontal: correction.horizontal,
      correctCenter: correction.center,
      correctRotate: correction.rotate,
      imageUrl: sessionPersistUrl ?? (imageUrl?.startsWith("http") || imageUrl?.startsWith("data:") ? imageUrl : null),
      imageOmitted: Boolean(imageUrl) && !sessionPersistUrl && !imageUrl?.startsWith("http") && !imageUrl?.startsWith("data:") ? true : undefined,
    };
    const t = window.setTimeout(() => writeImageEditorSession(snapshot), 500);
    return () => window.clearTimeout(t);
  }, [
    tool,
    adjustTab,
    canvasW,
    canvasH,
    rotateDeg,
    flipH,
    flipV,
    shapeMask,
    losslessResize,
    lockAspect,
    correctionOpen,
    brightness,
    contrast,
    saturate,
    erasePrompt,
    imageUrl,
    sessionPersistUrl,
    correction,
  ]);

  useEffect(() => {
    void (async () => {
      try {
        const m = await fetchImageProcessingModels();
        setBgModel(m.defaults.bgRemove ?? m.defaults.editor ?? "");
        setEnhancerModel(m.defaults.enhancer ?? "");
        setModelsLoaded(true);
      } catch {
        setModelsLoaded(true);
      }
    })();
  }, []);

  const onFile = async (file: File) => {
    const url = URL.createObjectURL(file);
    applyUrl(url);
  };

  const ingestCanvasFile = useCallback(
    async (file: File, via?: "paste" | "drop") => {
      const url = URL.createObjectURL(file);
      applyUrl(url);
      if (via === "paste") {
        toast({ title: "已粘贴图片", variant: "success" });
      }
    },
    [applyUrl, toast],
  );

  const canvasPaste = useImageDropPaste({
    enabled: !busy,
    onFiles: (files, via) => {
      const file = files[0];
      if (file) void ingestCanvasFile(file, via);
    },
    onError: async (title, message) => {
      await alert({ title, message, variant: "error" });
    },
  });

  const bakeCropPreview = useCallback(
    (rect: ImageEditorCropRect) => {
      if (!imageUrl) return;
      setCanvasW(Math.max(1, Math.round(rect.w)));
      setCanvasH(Math.max(1, Math.round(rect.h)));
      void renderImageEditorCropRegion(imageUrl, rect, 1600, "none")
        .then((url) => setCropPreviewUrl(url))
        .catch(() => setCropPreviewUrl(null));
    },
    [imageUrl],
  );

  const pickRatioPreset = useCallback(
    (rw: number, rh: number) => {
      if (naturalW < 1 || naturalH < 1) return;
      const next = cropRectForRatio(naturalW, naturalH, rw, rh);
      cropRectRef.current = next;
      setCropRect(next);
      setLockAspect(true);
      bakeCropPreview(next);
    },
    [bakeCropPreview, naturalH, naturalW],
  );

  const captureShapeDraft = useCallback(() => {
    shapeDraftRef.current = {
      w: canvasW,
      h: canvasH,
      shape: shapeMask,
      rotateDeg,
      flipH,
      flipV,
    };
  }, [canvasH, canvasW, flipH, flipV, rotateDeg, shapeMask]);

  useEffect(() => {
    if (tool === "adjust" && adjustTab === "shape" && imageUrl) {
      captureShapeDraft();
    }
  }, [adjustTab, captureShapeDraft, imageUrl, tool]);

  const onShapeMaskChange = useCallback(
    (id: ImageEditorShapeMaskId) => {
      captureShapeDraft();
      setShapeMask(id);
      if (id !== "none" && naturalW > 0 && naturalH > 0 && (canvasW < 200 || canvasH < 200)) {
        setCanvasW(naturalW);
        setCanvasH(naturalH);
      }
    },
    [canvasH, canvasW, captureShapeDraft, naturalH, naturalW],
  );

  const cancelShapeMaskEdit = useCallback(() => {
    const d = shapeDraftRef.current;
    if (d) {
      setCanvasW(d.w);
      setCanvasH(d.h);
      setShapeMask(d.shape);
      setRotateDeg(d.rotateDeg);
      setFlipH(d.flipH);
      setFlipV(d.flipV);
    }
  }, []);

  const setTargetWidth = (w: number) => {
    const next = Math.min(8192, Math.max(1, Math.round(w)));
    if (lockAspect && canvasW > 0 && canvasH > 0) {
      const aspect = canvasH / canvasW;
      setCanvasW(next);
      setCanvasH(Math.round(next * aspect));
    } else {
      setCanvasW(next);
    }
  };

  const setTargetHeight = (h: number) => {
    const next = Math.min(8192, Math.max(1, Math.round(h)));
    if (lockAspect && canvasW > 0 && canvasH > 0) {
      const aspect = canvasW / canvasH;
      setCanvasH(next);
      setCanvasW(Math.round(next * aspect));
    } else {
      setCanvasH(next);
    }
  };

  const commitExport = async () => {
    if (!imageUrl) return;
    setBusy(true);
    try {
      if (correctionOpen) {
        if (isImageEditorCorrectionNeutral(correction)) {
          toast({ title: "校正未改动", message: "垂直、水平、中心和旋转都还是初始值" });
          return;
        }
        const out = await renderImageEditorCorrection(imageUrl, correction);
        const outW = Math.max(1, naturalW);
        const outH = Math.max(1, naturalH);
        setCorrection(IMAGE_EDITOR_CORRECTION_DEFAULT);
        setImageUrl(out);
        setDisplayUrl(out);
        persistImageUrlRef.current = out;
        setSessionPersistUrl(out);
        pushHistory(out, outW, outH);
        toast({ title: "已应用", message: "图片校正已写入", variant: "success" });
        return;
      }
      if (adjustTab === "resize" || adjustTab === "shape") {
        const outW = Math.max(1, Math.round(canvasW));
        const outH = Math.max(1, Math.round(canvasH));
        const out = await renderImageEditorFrame(imageUrl, {
          canvasW: outW,
          canvasH: outH,
          rotateDeg,
          flipH,
          flipV,
          shapeMask: shapeMask,
          fitInside: false,
          stretch: true,
          filterStyle: activeFilterStyle,
        });
        setImageUrl(out);
        setDisplayUrl(out);
        setNaturalW(outW);
        setNaturalH(outH);
        setCanvasW(outW);
        setCanvasH(outH);
        persistImageUrlRef.current = out;
        setSessionPersistUrl(out);
        setRotateDeg(0);
        setFlipH(false);
        setFlipV(false);
        pushHistory(out, outW, outH);
        adjustDraftRef.current = {
          w: outW,
          h: outH,
          rotateDeg: 0,
          flipH: false,
          flipV: false,
        };
        if (shapeMask !== "none") setShapeMask("none");
        toast({ title: "已应用", message: "图片尺寸已更新", variant: "success" });
        return;
      }
      const rect = cropRectRef.current ?? {
        x: 0,
        y: 0,
        w: naturalW || canvasW,
        h: naturalH || canvasH,
      };
      const shape = shapeMask;
      const outW = Math.max(1, Math.round(rect.w));
      const outH = Math.max(1, Math.round(rect.h));
      const out = await renderImageEditorCropRegion(imageUrl, rect, 8192, shape);
      if (shape !== "none") {
        setShapeMask("none");
      }
      setImageUrl(out);
      setDisplayUrl(out);
      setNaturalW(outW);
      setNaturalH(outH);
      setCanvasW(outW);
      setCanvasH(outH);
      persistImageUrlRef.current = out;
      setSessionPersistUrl(out);
      setRotateDeg(0);
      setFlipH(false);
      setFlipV(false);
      pushHistory(out, outW, outH);
      cropDraftRef.current = null;
      toast({ title: "已应用", message: "画布修改已写入当前图", variant: "success" });
    } catch (e) {
      await alert({
        title: "应用失败",
        message: e instanceof Error ? e.message : "请换一张图重试",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const runBgRemove = async () => {
    if (!imageUrl) return;
    setBusy(true);
    try {
      const dataUrl = await urlToDataUrl(imageUrl);
      const res = await submitImageProcessingEdit({
        mode: "bg-remove",
        model: bgModel || undefined,
        sourceImageDataUrl: dataUrl,
      });
      const next = res.imageUrls[0];
      if (!next) throw new Error("未返回结果");
      applyUrl(next, canvasW, canvasH);
      toast({ title: "抠图完成", variant: "success" });
    } catch (e) {
      await alert({
        title: "抠图失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const runEnhance = async () => {
    if (!imageUrl) return;
    setBusy(true);
    try {
      const dataUrl = await urlToDataUrl(imageUrl);
      const res = await submitImageProcessingEdit({
        mode: "enhancer",
        model: enhancerModel || undefined,
        sourceImageDataUrl: dataUrl,
      });
      const next = res.imageUrls[0];
      if (!next) throw new Error("未返回结果");
      applyUrl(next, canvasW, canvasH);
      toast({ title: "变清晰完成", variant: "success" });
    } catch (e) {
      await alert({
        title: "处理失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const runErase = async () => {
    if (!imageUrl) return;
    setBusy(true);
    try {
      const dataUrl = await urlToDataUrl(imageUrl);
      const res = await submitImageProcessingEdit({
        mode: "editor",
        prompt: erasePrompt.trim(),
        sourceImageDataUrl: dataUrl,
      });
      const next = res.imageUrls[0];
      if (!next) throw new Error("未返回结果");
      applyUrl(next, canvasW, canvasH);
      toast({ title: "消除完成", variant: "success" });
    } catch (e) {
      await alert({
        title: "消除失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const undo = () => {
    if (historyIdx <= 0) return;
    const next = historyIdx - 1;
    const entry = history[next];
    if (!entry) return;
    setHistoryIdx(next);
    setImageUrl(entry.url);
    setDisplayUrl(entry.url);
    setCanvasW(entry.canvasW);
    setCanvasH(entry.canvasH);
  };

  const redo = () => {
    if (historyIdx >= history.length - 1) return;
    const next = historyIdx + 1;
    const entry = history[next];
    if (!entry) return;
    setHistoryIdx(next);
    setImageUrl(entry.url);
    setDisplayUrl(entry.url);
    setCanvasW(entry.canvasW);
    setCanvasH(entry.canvasH);
  };

  const download = () => {
    const src = displayUrl ?? imageUrl;
    if (!src) return;
    const a = document.createElement("a");
    a.href = src;
    a.download = `ecom-edit-${canvasW}x${canvasH}.png`;
    a.rel = "noopener";
    a.click();
  };

  const openInNewTab = () => {
    if (typeof window === "undefined") return;
    window.open("/ecom/image-editor", "_blank", "noopener,noreferrer");
  };

  const toolPanel = (() => {
    switch (tool) {
      case "add":
        return (
          <ToolPanelCard title="添加素材">
          <div className="space-y-3 text-[11px] text-[#6e6e73]">
            <p>上传本地图片，或从「我的资产」选取已有成片。</p>
            <EcomButtonPrimary type="button" className="w-full" onClick={() => fileInputRef.current?.click()}>
              本地上传
            </EcomButtonPrimary>
            <EcomButtonSecondary type="button" className="w-full" onClick={() => setAssetOpen(true)}>
              我的资产
            </EcomButtonSecondary>
          </div>
          </ToolPanelCard>
        );
      case "adjust":
        return (
          <ImageEditorAdjustPanel
            tab={adjustTab}
            onTab={(tab) => {
              setAdjustTab(tab);
              if (tab === "ratio") setLosslessResize(false);
            }}
            targetWidth={canvasW}
            targetHeight={canvasH}
            naturalWidth={naturalW}
            naturalHeight={naturalH}
            lockAspect={lockAspect}
            losslessResize={losslessResize}
            onLosslessResize={setLosslessResize}
            customPresets={customPresets}
            onAddCustomPreset={() => {
              const id = `custom-${canvasW}x${canvasH}-${Date.now()}`;
              const next = [
                ...customPresets.filter((p) => p.width !== canvasW || p.height !== canvasH),
                { id, label: `自定义 ${canvasW}×${canvasH}`, width: canvasW, height: canvasH },
              ];
              setCustomPresets(next);
              writeImageEditorCustomPresets(next);
              toast({ title: "已添加自定义尺寸", variant: "success" });
            }}
            onWidth={setTargetWidth}
            onHeight={setTargetHeight}
            onToggleLock={() => setLockAspect((v) => !v)}
            onPreset={(w, h) => {
              setCanvasW(w);
              setCanvasH(h);
            }}
            onFreeCrop={() => {
              if (naturalW < 1 || naturalH < 1) return;
              if (adjustTab === "resize") {
                setCanvasW(naturalW);
                setCanvasH(naturalH);
                return;
              }
              const next = fullImageCropRect(naturalW, naturalH);
              cropRectRef.current = next;
              setCropRect(next);
              setCanvasW(naturalW);
              setCanvasH(naturalH);
            }}
            onRotateCw={() => setRotateDeg((d) => stepRotateDeg(d, 45))}
            onRotateCcw={() => setRotateDeg((d) => stepRotateDeg(d, -45))}
            onFlipH={() => setFlipH((v) => !v)}
            onFlipV={() => setFlipV((v) => !v)}
            onCancel={() => {
              if (adjustTab === "shape") {
                cancelShapeMaskEdit();
                return;
              }
              if (adjustTab === "resize") {
                cancelResizeEdit();
                return;
              }
              cancelCropEdit();
            }}
            onApply={() => void commitExport()}
            busy={busy}
            hasImage={Boolean(imageUrl)}
            correctionOpen={correctionOpen}
            onToggleCorrection={() => setCorrectionOpen((open) => !open)}
            onCloseCorrection={() => setCorrectionOpen(false)}
            correctionPanel={
              <ImageCorrectionPanel
                value={correction}
                disabled={!imageUrl || busy}
                onChange={setCorrection}
                onReset={() => setCorrection(IMAGE_EDITOR_CORRECTION_DEFAULT)}
              />
            }
            shapeMask={shapeMask}
            onShapeMask={onShapeMaskChange}
            onRatioPreset={pickRatioPreset}
          />
        );
      case "text":
        return (
          <ToolPanelCard title="文字">
            <p className="text-[11px] leading-relaxed text-[var(--ie-subtle)]">
              画布文字与营销文案叠层，请使用主图/详情模块的「文案排版编辑器」。此处将后续接入同款叠层能力。
            </p>
          </ToolPanelCard>
        );
      case "erase":
        return (
          <ToolPanelCard title="消除笔">
            <div className="space-y-3">
              <p className="text-[11px] text-[var(--ie-subtle)]">用自然语言描述要消除的区域（无需手动画笔）。</p>
              <textarea
                className="min-h-[5rem] w-full rounded-lg border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] px-2.5 py-2 text-[11px] text-[var(--ie-ink)]"
                value={erasePrompt}
                onChange={(e) => setErasePrompt(e.target.value)}
              />
              <EcomButtonPrimary type="button" className="w-full" disabled={!imageUrl || busy} onClick={() => void runErase()}>
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                运行消除
              </EcomButtonPrimary>
            </div>
          </ToolPanelCard>
        );
      case "cutout":
        return (
          <ToolPanelCard title="抠图">
          <div className="space-y-3">
            <p className="text-[11px] text-[var(--ie-subtle)]">智能抠图，移除背景保留主体（走 Gateway 图像处理）。</p>
            {!modelsLoaded ? <p className="text-[10px] text-[var(--ie-subtle)]">加载模型…</p> : null}
            <EcomButtonPrimary type="button" className="w-full" disabled={!imageUrl || busy} onClick={() => void runBgRemove()}>
              一键抠图
            </EcomButtonPrimary>
          </div>
          </ToolPanelCard>
        );
      case "hd":
        return (
          <ToolPanelCard title="变清晰">
          <div className="space-y-3">
            <p className="text-[11px] text-[var(--ie-subtle)]">图像增强 / 变清晰，适合模糊主图急救。</p>
            <EcomButtonPrimary type="button" className="w-full" disabled={!imageUrl || busy} onClick={() => void runEnhance()}>
              变清晰
            </EcomButtonPrimary>
          </div>
          </ToolPanelCard>
        );
      case "color":
        return (
          <ToolPanelCard title="调色">
          <div className="space-y-4">
            <SliderField label="亮度" value={brightness} onChange={setBrightness} />
            <SliderField label="对比度" value={contrast} onChange={setContrast} />
            <SliderField label="饱和度" value={saturate} onChange={setSaturate} />
            <EcomButtonPrimary type="button" className="w-full" disabled={!imageUrl || busy} onClick={() => void commitExport()}>
              烘焙调色到图片
            </EcomButtonPrimary>
          </div>
          </ToolPanelCard>
        );
      case "assets":
        return (
          <ToolPanelCard title="我的">
          <EcomButtonSecondary type="button" className="w-full" onClick={() => setAssetOpen(true)}>
            打开资产库
          </EcomButtonSecondary>
          </ToolPanelCard>
        );
      case "more":
        return (
          <ToolPanelCard title="更多能力">
          <ul className="space-y-2 text-[11px]">
            <li>
              <Link className="text-[var(--ie-ink)] underline-offset-2 hover:underline" href="/ecom/image-processing">
                图像处理全套小工具
              </Link>
            </li>
            <li>
              <Link className="text-[var(--ie-ink)] underline-offset-2 hover:underline" href="/ecom/image-layer">
                图片处理 · 图层与擦除
              </Link>
            </li>
            <li>
              <button
                type="button"
                className="text-[var(--ie-ink)] underline-offset-2 hover:underline"
                onClick={openInNewTab}
              >
                新标签页打开本编辑器
              </button>
            </li>
          </ul>
          </ToolPanelCard>
        );
      default:
        return null;
    }
  })();

  return (
  <>
    <EcomWorkspaceLayout fullWidth contentClassName="min-h-0 !bg-[#f5efe6]">
      <div data-image-editor-theme className="flex h-full min-h-0 flex-col bg-[var(--ie-cream-deep)]">
        <ImageEditorHeader
          canUndo={historyIdx > 0}
          canRedo={historyIdx < history.length - 1 && history.length > 0}
          canDownload={Boolean(imageUrl)}
          onUndo={undo}
          onRedo={redo}
          onOpenFile={() => fileInputRef.current?.click()}
          onDownload={download}
          onOpenNewTab={openInNewTab}
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row lg:gap-2 lg:p-2">
          <div className="flex max-h-[50vh] min-h-0 w-full shrink-0 flex-row overflow-hidden lg:max-h-none lg:w-auto">
            <ImageEditorToolRail active={tool} disabled={busy} onSelect={setTool} />
            <aside className="ecom-scrollbar-thin flex min-h-0 w-[min(100%,320px)] flex-1 flex-col overflow-y-auto bg-transparent p-2 pt-0 lg:w-[332px] lg:shrink-0">
              {toolPanel}
            </aside>
          </div>

          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-1 lg:rounded-xl lg:border lg:border-[var(--ie-border-soft)] lg:bg-[var(--ie-canvas-well)]",
              canvasFrameInteract || resizeInteract ? "overflow-visible" : "overflow-hidden",
            )}
          >
            <ImageEditorCanvasStage
              imageUrl={imageUrl}
              displayUrl={displayUrl}
              busy={busy}
              cropMode={canvasCropInteract}
              canvasCropInteract={canvasCropInteract}
              resizeInteract={resizeInteract}
              correctionInteract={correctionInteract}
              lockAspect={lockAspect}
              shapeMask={previewShapeMask}
              fitInside={losslessResize}
              rotateDeg={rotateDeg}
              flipH={flipH}
              flipV={flipV}
              filterStyle={activeFilterStyle}
              correctionCss={correctionOpen ? imageEditorCorrectionCss(correction) : ""}
              naturalWidth={naturalW}
              naturalHeight={naturalH}
              canvasWidth={canvasW}
              canvasHeight={canvasH}
              cropRect={cropRect}
              onCropRect={setCropRect}
              pasteReady={canvasPaste.pasteReady}
              dragOver={canvasPaste.dragOver}
              dropZoneProps={canvasPaste.dropZoneProps}
              onOpenFile={() => fileInputRef.current?.click()}
              onActivatePaste={canvasPaste.focusZone}
              shapeMaskInteract={false}
              onShapeMaskCancel={
                correctionInteract
                  ? () => setCorrection(IMAGE_EDITOR_CORRECTION_DEFAULT)
                  : resizeInteract
                    ? cancelResizeEdit
                    : canvasCropInteract
                      ? cancelCropEdit
                      : cancelShapeMaskEdit
              }
              onShapeMaskConfirm={() => void commitExport()}
              onShapeMaskRotateDeg={setRotateDeg}
              onCanvasResize={onCanvasFrameResize}
              onShapeMaskResize={onCanvasFrameResize}
              baseDisplayUrl={baseDisplayUrl}
              cropPreviewUrl={cropPreviewUrl}
              cropDragging={canvasFrameDragging}
              onCanvasDragActiveChange={onCanvasDragActiveChange}
              onClearImage={() => void clearImage()}
            />
          </div>

          <div className="shrink-0 border-t border-[var(--ie-border-soft)] lg:border-t-0">
            <ImageEditorCanvasPanel
              width={canvasW}
              height={canvasH}
              lockAspect={lockAspect}
              disabled={!imageUrl || busy}
              onWidth={setTargetWidth}
              onHeight={setTargetHeight}
              onToggleLock={() => setLockAspect((v) => !v)}
            />
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_UPLOAD_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = "";
        }}
      />
    </EcomWorkspaceLayout>

    <EcomAssetPickerDialog
      open={assetOpen}
      onOpenChange={setAssetOpen}
      maxSelect={1}
      onConfirm={(assets) => {
        const url = assets[0]?.ossUrl;
        if (url) applyUrl(url);
      }}
    />
  </>
  );
}

function ToolPanelCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] shadow-sm">
      <div className="border-b border-[var(--ie-divider)] px-3 py-2">
        <p className="text-[12px] font-semibold text-[var(--ie-ink)]">{title}</p>
      </div>
      <div className="px-3 py-3">{children}</div>
    </div>
  );
}

function ImageCorrectionPanel({
  value,
  disabled,
  onChange,
  onReset,
}: {
  value: ImageEditorCorrection;
  disabled?: boolean;
  onChange: (next: ImageEditorCorrection) => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-2.5">
      <CorrectionRow
        label="垂直"
        value={value.vertical}
        min={0}
        max={100}
        disabled={disabled}
        onChange={(vertical) => onChange({ ...value, vertical })}
      />
      <CorrectionRow
        label="水平"
        value={value.horizontal}
        min={0}
        max={100}
        disabled={disabled}
        onChange={(horizontal) => onChange({ ...value, horizontal })}
      />
      <CorrectionRow
        label="中心"
        value={value.center}
        min={0}
        max={100}
        disabled={disabled}
        onChange={(center) => onChange({ ...value, center })}
      />
      <CorrectionRow
        label="旋转"
        value={value.rotate}
        min={-45}
        max={45}
        disabled={disabled}
        onChange={(rotate) => onChange({ ...value, rotate })}
      />
      <EcomButtonSecondary type="button" className="mt-1 w-full text-[12px]" disabled={disabled} onClick={onReset}>
        <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        重置
      </EcomButtonSecondary>
    </div>
  );
}

function CorrectionRow({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  const set = (next: number) => onChange(Math.min(max, Math.max(min, Math.round(next))));
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 shrink-0 text-[11px] text-[var(--ie-ink)]">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        aria-label={label}
        className="h-1 min-w-0 flex-1 accent-[var(--ie-border)]"
        onChange={(e) => set(Number(e.target.value))}
      />
      <span className="inline-flex h-7 shrink-0 items-center rounded-md bg-[var(--ie-cream-muted)] pl-1">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          aria-label={`${label}数值`}
          className="w-8 bg-transparent text-center text-[11px] text-[var(--ie-ink)] outline-none"
          onChange={(e) => set(Number(e.target.value))}
        />
        <span className="flex flex-col pr-0.5">
          <button
            type="button"
            disabled={disabled || value >= max}
            className="text-[var(--ie-subtle)] hover:text-[var(--ie-ink)] disabled:opacity-30"
            aria-label={`${label}增加`}
            onClick={() => set(value + 1)}
          >
            <ChevronUp className="h-3 w-3" aria-hidden />
          </button>
          <button
            type="button"
            disabled={disabled || value <= min}
            className="text-[var(--ie-subtle)] hover:text-[var(--ie-ink)] disabled:opacity-30"
            aria-label={`${label}减少`}
            onClick={() => set(value - 1)}
          >
            <ChevronDown className="h-3 w-3" aria-hidden />
          </button>
        </span>
      </span>
    </div>
  );
}

function SliderField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-[var(--ie-muted)]">{label}</span>
        <span className="text-[var(--ie-subtle)]">{value}%</span>
      </div>
      <input
        type="range"
        min={50}
        max={150}
        value={value}
        className="w-full"
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}