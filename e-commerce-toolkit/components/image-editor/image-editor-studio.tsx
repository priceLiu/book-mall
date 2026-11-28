"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RotateCcw, ChevronUp, ChevronDown } from "lucide-react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomAssetPickerDialog } from "@/components/media/ecom-asset-picker-dialog";
import { ImageEditorAdjustPanel } from "@/components/image-editor/image-editor-adjust-panel";
import { ImageEditorCanvasPanel } from "@/components/image-editor/image-editor-canvas-panel";
import { ImageEditorCanvasStage } from "@/components/image-editor/image-editor-canvas-stage";
import { ImageEditorAiFlowerPanel } from "@/components/image-editor/image-editor-ai-flower-panel";
import { ImageEditorTextInspector } from "@/components/image-editor/image-editor-text-inspector";
import { ImageEditorTextPanel } from "@/components/image-editor/image-editor-text-panel";
import { ImageEditorHeader } from "@/components/image-editor/image-editor-header";
import { ImageEditorEraseLayer, type ImageEditorEraseLayerHandle } from "@/components/image-editor/image-editor-erase-layer";
import { ERASE_TARGETS, ImageEditorErasePanel, type EraseSelectTool, type EraseTargetId } from "@/components/image-editor/image-editor-erase-panel";
import {
  ImageEditorHdPanel,
  imageEditorHdModeLabel,
  imageEditorHdPrompt,
  type ImageEditorHdMode,
} from "@/components/image-editor/image-editor-hd-panel";
import {
  ImageEditorColorPanel,
  imageEditorColorGrade,
  type ImageEditorColorGroup,
} from "@/components/image-editor/image-editor-color-panel";
import { RecolorProtectLayer } from "@/components/image-editor/image-editor-color-controls";
import type { ColorAdjust, ColorAdjustStroke } from "@/lib/image-editor-color-adjust";
import { colorAdjustPreviewCss } from "@/lib/image-editor-color-adjust";
import { ImageEditorCutoutWorkspace } from "@/components/image-editor/image-editor-cutout-workspace";
import { ImageEditorAiGenWorkspace } from "@/components/image-editor/image-editor-ai-gen-workspace";
import { ImageEditorInpaintWorkspace } from "@/components/image-editor/image-editor-inpaint-workspace";
import { ImageEditorOutpaintWorkspace } from "@/components/image-editor/image-editor-outpaint-workspace";
import { ImageEditorBasicToolsPanel } from "@/components/image-editor/image-editor-basic-tools-panel";
import { ImageEditorToolRail } from "@/components/image-editor/image-editor-tool-rail";
import "@/components/image-editor/image-editor-theme.css";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { IMAGE_UPLOAD_ACCEPT } from "@/lib/image-upload-utils";
import { submitImageProcessingEdit } from "@/lib/ecom-image-processing-api";
import { submitImageEditorLocalGrade } from "@/lib/image-editor-clear-grade-client";
import { ecomMediaFetchUrl } from "@/lib/ecom-media-download";
import { eraseImageLayerRegion } from "@/lib/ecom-image-layer-api";
import {
  readImageEditorCustomPresets,
  writeImageEditorCustomPresets,
} from "@/lib/image-editor-presets";
import {
  persistableImageUrl,
  readImageEditorSession,
  sessionCutoutResultUrl,
  writeImageEditorSession,
  type ImageEditorSessionSnapshot,
} from "@/lib/image-editor-persist";
import { placeImageInCanvas } from "@/lib/image-editor-frame-resize";
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
import {
  applyTextLayerStyle,
  createQuickTextLayer,
  duplicateImageEditorTextSelection,
  emptyImageEditorTextDocument,
  extractTextLayerStyle,
  isTextGrouped,
  layersSharingGroup,
  patchImageEditorTextExtras,
  patchImageEditorTextLayer,
  removeImageEditorTextSelection,
  syncTextDocumentExportSize,
  updateImageEditorTextContent,
  type ImageEditorTextDocument,
  type ImageEditorTextQuickKind,
  type ImageEditorTextStyleClipboard,
} from "@/lib/image-editor-text";
import { applyImageEditorFlower } from "@/lib/image-editor-text-flower";
import { flattenImageEditorTextLayers } from "@/lib/image-editor-flatten-text";
import {
  createImageEditorTextFromTemplate,
  expandLegacyDecorGroups,
  expandLegacySellingGroups,
  imageEditorTextTemplateById,
  placeOriginalSellingPoster,
  replaceSellingGroupWithDecompose,
} from "@/lib/image-editor-text-templates";
import { ensureSellingPosterDecompose } from "@/lib/image-editor-selling-decompose-api";

async function urlToDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    res = await fetch(ecomMediaFetchUrl(url), { credentials: "include" });
  }
  if (!res.ok) throw new Error("读取图片失败");
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(blob);
  });
}

/** 云端地址直接交给模型。浏览器拉跨域图会 Failed to fetch，不能先转成 data URL。 */
function imageEditSource(url: string): Promise<string> {
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return Promise.resolve(url);
  }
  return urlToDataUrl(url);
}

async function sampleImage(url: string): Promise<Uint8ClampedArray | null> {
  try {
    const res = await fetch(ecomMediaFetchUrl(url));
    if (!res.ok) return null;
    const bitmap = await createImageBitmap(await res.blob());
    const canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 48;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, 48, 48);
    bitmap.close();
    return ctx.getImageData(0, 0, 48, 48).data;
  } catch {
    return null;
  }
}

/** 结果和原图几乎一样，视为没有识别到要消除的内容。 */
async function imagesNearlyUnchanged(before: string, after: string): Promise<boolean> {
  const [a, b] = await Promise.all([sampleImage(before), sampleImage(after)]);
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  let n = 0;
  for (let i = 0; i < a.length; i += 4) {
    diff += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
    diff += Math.abs((a[i + 1] ?? 0) - (b[i + 1] ?? 0));
    diff += Math.abs((a[i + 2] ?? 0) - (b[i + 2] ?? 0));
    n += 3;
  }
  return n > 0 && diff / n < 6;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const once = (cors: boolean) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      if (cors) img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("图片加载失败"));
      img.src = src;
    });
  // 部分结果图没有跨域头。匿名加载失败时再按普通图片读尺寸，避免未处理的拒绝把页面打断。
  return once(true).catch(() => once(false));
}

/** 从当前画面往回，最多保留 5 步。 */
const IMAGE_EDITOR_UNDO_STEPS = 5;

type HistoryEntry = {
  url: string;
  canvasW: number;
  canvasH: number;
  rotateDeg: number;
  flipH: boolean;
  flipV: boolean;
  offsetX: number;
  offsetY: number;
  shapeMask: ImageEditorShapeMaskId;
  crop: ImageEditorCropRect | null;
  correction: ImageEditorCorrection;
};

function historyEntriesEqual(a: HistoryEntry, b: HistoryEntry): boolean {
  const sameCrop = (p: ImageEditorCropRect | null, q: ImageEditorCropRect | null) => {
    if (!p && !q) return true;
    if (!p || !q) return false;
    return (
      Math.abs(p.x - q.x) < 1 &&
      Math.abs(p.y - q.y) < 1 &&
      Math.abs(p.w - q.w) < 1 &&
      Math.abs(p.h - q.h) < 1
    );
  };
  return (
    a.url === b.url &&
    a.canvasW === b.canvasW &&
    a.canvasH === b.canvasH &&
    a.rotateDeg === b.rotateDeg &&
    a.flipH === b.flipH &&
    a.flipV === b.flipV &&
    a.offsetX === b.offsetX &&
    a.offsetY === b.offsetY &&
    a.shapeMask === b.shapeMask &&
    sameCrop(a.crop, b.crop) &&
    a.correction.vertical === b.correction.vertical &&
    a.correction.horizontal === b.correction.horizontal &&
    a.correction.center === b.correction.center &&
    a.correction.rotate === b.correction.rotate
  );
}

const DEFAULT_CANVAS = 2048;
const CUTOUT_SUBJECT_IDS = new Set(["off", "portrait", "product", "icon", "apparel"]);

export function ImageEditorStudio() {
  const { alert, confirm, toast } = useDialogs();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tool, setTool] = useState<ImageEditorToolId>("adjust");
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
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
  const historyIdxRef = useRef(-1);
  const historyRef = useRef<HistoryEntry[]>([]);
  const liveRef = useRef<HistoryEntry | null>(null);
  const stepTimerRef = useRef(0);
  const [adjustSectionOpen, setAdjustSectionOpen] = useState(true);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const baselineRef = useRef<{
    canvasW: number;
    canvasH: number;
    rotateDeg: number;
    flipH: boolean;
    flipV: boolean;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [erasePrompt, setErasePrompt] = useState("移除画面中的干扰物体");
  const [eraseTab, setEraseTab] = useState<"manual" | "ai">("ai");
  const [eraseBrush, setEraseBrush] = useState(25);
  const [eraseSelectTool, setEraseSelectTool] = useState<EraseSelectTool>("brush");
  const [eraseTargets, setEraseTargets] = useState<Record<string, boolean>>({});
  const [eraseRunning, setEraseRunning] = useState(false);
  const [eraseProgress, setEraseProgress] = useState(0);
  const [colorRunning, setColorRunning] = useState(false);
  const [colorProgress, setColorProgress] = useState(0);
  const [eraseNotice, setEraseNotice] = useState<string | null>(null);
  const eraseLayerRef = useRef<ImageEditorEraseLayerHandle>(null);
  const [cutoutOpen, setCutoutOpen] = useState(false);
  const [inpaintOpen, setInpaintOpen] = useState(false);
  const [outpaintOpen, setOutpaintOpen] = useState(false);
  const [aiGenOpen, setAiGenOpen] = useState(false);
  const toolBeforeCutoutRef = useRef<ImageEditorToolId>("adjust");
  const [cutoutSubject, setCutoutSubject] = useState("portrait");
  const [cutoutResultUrl, setCutoutResultUrl] = useState<string | null>(null);
  const [cutoutSaveRequest, setCutoutSaveRequest] = useState(0);
  const imageEditorModel = "doubao-seedream-5-5";
  const [hdMode, setHdMode] = useState<ImageEditorHdMode>("hd");
  const [hdKeepSize, setHdKeepSize] = useState(false);
  const [colorGradeId, setColorGradeId] = useState<string | null>(null);
  /** 本轮调色的原图。后续预设都从这张重做，不在上一次结果上叠加。 */
  const [colorSourceUrl, setColorSourceUrl] = useState<string | null>(null);
  const colorSourceRef = useRef<string | null>(null);
  const colorSourceHistoryIdxRef = useRef<number | null>(null);
  const [colorGroup, setColorGroup] = useState<ImageEditorColorGroup | null>(null);
  const [colorPreviewCss, setColorPreviewCss] = useState<string | null>(null);
  const colorAdjustSeq = useRef(0);
  const colorAdjustBusy = useRef(false);
  const pendingColorAdjust = useRef<{ adjust: ColorAdjust; label: string } | null>(null);
  const lastColorAdjust = useRef<{ adjust: ColorAdjust; label: string } | null>(null);
  const [recolorArmed, setRecolorArmed] = useState(false);
  const [recolorBrush, setRecolorBrush] = useState(25);
  const recolorStrokesRef = useRef<ColorAdjustStroke[]>([]);
  const [recolorStrokeVersion, setRecolorStrokeVersion] = useState(0);

  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturate, setSaturate] = useState(100);
  const [losslessResize, setLosslessResize] = useState(true);
  const [frameOffset, setFrameOffset] = useState({ x: 0, y: 0 });
  const frameOffsetRef = useRef(frameOffset);
  frameOffsetRef.current = frameOffset;
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
  /** 当前 naturalW/H 属于哪张图。换图后，旧尺寸不能再参与裁切框和底图绘制。 */
  const naturalSrcRef = useRef<string | null>(null);
  cropRectRef.current = cropRect;
  const cropAlignedUrlRef = useRef<string | null>(null);
  liveRef.current = imageUrl
    ? {
        url: imageUrl,
        canvasW,
        canvasH,
        rotateDeg,
        flipH,
        flipV,
        offsetX: frameOffset.x,
        offsetY: frameOffset.y,
        shapeMask,
        crop: cropRect,
        correction,
      }
    : null;
  const hydratedRef = useRef(false);
  const keepCutoutRef = useRef(false);
  const persistImageUrlRef = useRef<string | null>(null);
  const [sessionPersistUrl, setSessionPersistUrl] = useState<string | null>(null);
  const adjustDraftRef = useRef<{
    w: number;
    h: number;
    rotateDeg: number;
    flipH: boolean;
    flipV: boolean;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const textStyleClipboardRef = useRef<ImageEditorTextStyleClipboard | null>(null);
  const shapeDraftRef = useRef<{
    w: number;
    h: number;
    shape: ImageEditorShapeMaskId;
    rotateDeg: number;
    flipH: boolean;
    flipV: boolean;
  } | null>(null);
  const [textDoc, setTextDoc] = useState<ImageEditorTextDocument>(() =>
    emptyImageEditorTextDocument(DEFAULT_CANVAS),
  );
  const [selectedTextLayerId, setSelectedTextLayerId] = useState<string | null>(null);
  const [selectionIds, setSelectionIds] = useState<string[]>([]);
  const [aiFlowerOpen, setAiFlowerOpen] = useState(false);
  const [editingTextLayerId, setEditingTextLayerId] = useState<string | null>(null);

  const filterStyle = useMemo(
    () =>
      `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`,
    [brightness, contrast, saturate],
  );

  const rememberStep = useCallback((patch?: Partial<HistoryEntry>) => {
    window.clearTimeout(stepTimerRef.current);
    const live = liveRef.current;
    const url = patch?.url ?? live?.url;
    if (!url) return;
    const entry: HistoryEntry = {
      url,
      canvasW: patch?.canvasW ?? live?.canvasW ?? 0,
      canvasH: patch?.canvasH ?? live?.canvasH ?? 0,
      rotateDeg: patch?.rotateDeg ?? live?.rotateDeg ?? 0,
      flipH: patch?.flipH ?? live?.flipH ?? false,
      flipV: patch?.flipV ?? live?.flipV ?? false,
      offsetX: patch?.offsetX ?? live?.offsetX ?? 0,
      offsetY: patch?.offsetY ?? live?.offsetY ?? 0,
      shapeMask: patch?.shapeMask ?? live?.shapeMask ?? "none",
      crop: patch && Object.prototype.hasOwnProperty.call(patch, "crop") ? (patch.crop ?? null) : (live?.crop ?? null),
      correction: patch?.correction ?? live?.correction ?? IMAGE_EDITOR_CORRECTION_DEFAULT,
    };
    const head = historyRef.current[historyIdxRef.current];
    if (head && historyEntriesEqual(head, entry)) return;
    let nextIdx = historyIdxRef.current + 1;
    let next = [...historyRef.current.slice(0, nextIdx), entry];
    const maxEntries = IMAGE_EDITOR_UNDO_STEPS + 1;
    if (next.length > maxEntries) {
      const drop = next.length - maxEntries;
      next = next.slice(drop);
      nextIdx -= drop;
      if (colorSourceHistoryIdxRef.current != null) {
        colorSourceHistoryIdxRef.current -= drop;
      }
    }
    historyRef.current = next;
    historyIdxRef.current = nextIdx;
    setHistory(next);
    setHistoryIdx(nextIdx);
  }, []);

  const scheduleStep = useCallback(() => {
    window.clearTimeout(stepTimerRef.current);
    stepTimerRef.current = window.setTimeout(() => rememberStep(), 400);
  }, [rememberStep]);

  const applyUrl = useCallback(
    (url: string, w?: number, h?: number, opts?: { keepColorSource?: boolean }) => {
      if (!opts?.keepColorSource) {
        colorSourceRef.current = null;
        colorSourceHistoryIdxRef.current = null;
        setColorSourceUrl(null);
        setColorGradeId(null);
      }
      if (!keepCutoutRef.current) {
        setCutoutOpen(false);
        setCutoutResultUrl(null);
        setCutoutSubject("portrait");
      }
      setImageUrl(url);
      setDisplayUrl(url);
      setFrameOffset({ x: 0, y: 0 });
      setBaseDisplayUrl(null);
      setCropPreviewUrl(null);
      naturalSrcRef.current = null;
      setNaturalW(0);
      setNaturalH(0);
      void loadImage(url).then((img) => {
        const nw = img.naturalWidth;
        const nh = img.naturalHeight;
        naturalSrcRef.current = url;
        setNaturalW(nw);
        setNaturalH(nh);
        const cw = w ?? nw;
        const ch = h ?? nh;
        setCanvasW(cw);
        setCanvasH(ch);
        baselineRef.current = {
          canvasW: cw,
          canvasH: ch,
          rotateDeg: 0,
          flipH: false,
          flipV: false,
          offsetX: 0,
          offsetY: 0,
        };
        cropAlignedUrlRef.current = url;
        const full = { x: 0, y: 0, w: nw, h: nh };
        cropRectRef.current = full;
        setCropRect(full);
        setRotateDeg(0);
        setFlipH(false);
        setFlipV(false);
        setShapeMask("none");
        setCorrection(IMAGE_EDITOR_CORRECTION_DEFAULT);
        rememberStep({
          url,
          canvasW: cw,
          canvasH: ch,
          rotateDeg: 0,
          flipH: false,
          flipV: false,
          offsetX: 0,
          offsetY: 0,
          shapeMask: "none",
          crop: { x: 0, y: 0, w: nw, h: nh },
          correction: IMAGE_EDITOR_CORRECTION_DEFAULT,
        });
      }).catch(() => {
        naturalSrcRef.current = url;
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
    [rememberStep],
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
      const cutoutSubjectOk = CUTOUT_SUBJECT_IDS.has(snap.cutoutSubject ?? "");
      setCutoutSubject(cutoutSubjectOk ? snap.cutoutSubject! : "portrait");
      setCutoutResultUrl(cutoutSubjectOk ? sessionCutoutResultUrl(snap.cutoutResultUrl) : null);
      if (snap.cutoutOpen && snap.imageUrl) setCutoutOpen(true);
      if (snap.textOverlayJson) {
        try {
          const overlay = JSON.parse(snap.textOverlayJson) as ImageEditorTextDocument["overlay"];
          const extras = snap.textExtrasJson
            ? (JSON.parse(snap.textExtrasJson) as ImageEditorTextDocument["extras"])
            : {};
          setTextDoc({ overlay, extras });
          setSelectedTextLayerId(snap.selectedTextLayerId ?? null);
          setEditingTextLayerId(null);
        } catch {
          setTextDoc(emptyImageEditorTextDocument(snapCanvasOk ? snap.canvasW : DEFAULT_CANVAS));
        }
      }
      if (snap.imageOmitted) {
        toast({
          title: "会话图片未保存",
          message: "图片过大未写入会话，请重新上传或粘贴。",
        });
      } else if (snap.imageUrl) {
        persistImageUrlRef.current = snap.imageUrl;
        setSessionPersistUrl(snap.imageUrl);
        keepCutoutRef.current = true;
        applyUrl(
          snap.imageUrl,
          snapCanvasOk ? snap.canvasW : undefined,
          snapCanvasOk ? snap.canvasH : undefined,
        );
        setFrameOffset({
          x: Number.isFinite(snap.frameOffsetX) ? snap.frameOffsetX! : 0,
          y: Number.isFinite(snap.frameOffsetY) ? snap.frameOffsetY! : 0,
        });
        keepCutoutRef.current = false;
      }
      return;
    }
    const imported = takeImageEditorImportUrl();
    if (imported) applyUrl(imported);
  }, [applyUrl, toast]);

  useEffect(() => {
    if (tool !== "adjust") {
      adjustDraftRef.current = null;
      return;
    }
    if (!imageUrl || naturalW < 1 || naturalH < 1 || adjustDraftRef.current) return;
    adjustDraftRef.current = {
      w: naturalW,
      h: naturalH,
      rotateDeg,
      flipH,
      flipV,
      offsetX: frameOffsetRef.current.x,
      offsetY: frameOffsetRef.current.y,
    };
  }, [tool, imageUrl, naturalW, naturalH, rotateDeg, flipH, flipV]);

  const shapeOverlay =
    tool === "adjust" && Boolean(imageUrl) && shapeMask !== "none";

  /** 比例裁剪与尺寸调整只在「裁剪/旋转/尺寸」展开时生效 */
  const cropSectionActive =
    tool === "adjust" && Boolean(imageUrl) && adjustSectionOpen && !correctionOpen;

  const canvasCropInteract = cropSectionActive && adjustTab === "ratio";

  const resizeInteract =
    cropSectionActive && (adjustTab === "resize" || adjustTab === "shape");

  const correctionInteract = tool === "adjust" && Boolean(imageUrl) && correctionOpen;

  const canvasFrameInteract = canvasCropInteract;

  const previewShapeMask = cropSectionActive && shapeOverlay ? shapeMask : "none";

  /** 编辑中只叠蒙版压暗，确定时再写入裁切 */
  const previewClipInRender = "none" as const;

  const activeFilterStyle =
    brightness !== 100 || contrast !== 100 || saturate !== 100 ? filterStyle : undefined;
  const stageFilterStyle = [activeFilterStyle, colorPreviewCss].filter(Boolean).join(" ") || undefined;
  const colorFrameUrl = colorPreviewCss && colorSourceUrl ? colorSourceUrl : imageUrl;

  useEffect(() => {
    if (!colorFrameUrl) {
      setDisplayUrl(null);
      setBaseDisplayUrl(null);
      setCropPreviewUrl(null);
      return;
    }
    if (canvasFrameInteract) return;

    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      void renderImageEditorFrame(colorFrameUrl, {
        canvasW,
        canvasH,
        rotateDeg,
        flipH,
        flipV,
        shapeMask: previewClipInRender,
        fitInside: losslessResize,
        stretch: false,
        filterStyle: activeFilterStyle,
        previewMaxEdge: 1600,
      })
        .then((url) => {
          if (!cancelled) setDisplayUrl(url);
        })
        .catch(() => {
          if (!cancelled) setDisplayUrl(colorFrameUrl);
        });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [
    colorFrameUrl,
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

  const textInteract = tool === "text" && Boolean(imageUrl);
  const textExportW = naturalW > 0 ? naturalW : canvasW;
  const textExportH = naturalH > 0 ? naturalH : canvasH;
  const selectedTextLayer = textDoc.overlay.layers.find((l) => l.id === selectedTextLayerId);

  useEffect(() => {
    setTextDoc((d) => syncTextDocumentExportSize(d, textExportW));
  }, [textExportW]);

  const legacySellingIds = textDoc.overlay.layers
    .filter((layer) => layer.text.includes("\n") && textDoc.extras[layer.id]?.templateId?.startsWith("selling-") && !textDoc.extras[layer.id]?.groupId)
    .map((layer) => layer.id)
    .join(",");
  useEffect(() => {
    if (!legacySellingIds) return;
    const result = expandLegacySellingGroups(textDoc, textExportH);
    if (result.doc === textDoc) return;
    setTextDoc(result.doc);
    setSelectedTextLayerId((id) => (id && result.replaced[id]) || id);
  }, [legacySellingIds, textDoc, textExportH]);

  const legacyDecorIds = textDoc.overlay.layers
    .filter((layer) => {
      const extras = textDoc.extras[layer.id];
      return Boolean(extras?.templateId) && !extras?.groupId && !extras?.role && !extras?.mark;
    })
    .map((layer) => layer.id)
    .join(",");
  useEffect(() => {
    if (!legacyDecorIds) return;
    const result = expandLegacyDecorGroups(textDoc);
    if (result.doc === textDoc) return;
    setTextDoc(result.doc);
    setSelectedTextLayerId((id) => (id && result.replaced[id]) || id);
  }, [legacyDecorIds, textDoc]);

  useEffect(() => {
    if (tool !== "text") setEditingTextLayerId(null);
  }, [tool]);

  const membersOf = useCallback(
    (id: string) => {
      const extras = textDoc.extras[id];
      if (isTextGrouped(extras) && extras?.groupId) {
        return layersSharingGroup(textDoc.overlay.layers, textDoc.extras, extras.groupId).map((layer) => layer.id);
      }
      return [id];
    },
    [textDoc],
  );

  const handleSelectTextLayer = useCallback(
    (id: string | null, extra?: { additive?: boolean }) => {
      const prev = selectedTextLayerId;
      if (id && id !== prev && textStyleClipboardRef.current && !extra?.additive) {
        const clip = textStyleClipboardRef.current;
        setTextDoc((d) => applyTextLayerStyle(d, id, clip));
        textStyleClipboardRef.current = null;
        toast({ title: "已套用样式", variant: "success" });
      }
      if (!id) {
        setSelectedTextLayerId(null);
        setSelectionIds([]);
        setEditingTextLayerId(null);
        return;
      }
      const members = membersOf(id);
      if (extra?.additive) {
        setSelectionIds((current) => {
          const base = current.length ? current : prev ? membersOf(prev) : [];
          const hasAll = members.every((member) => base.includes(member));
          const next = hasAll ? base.filter((member) => !members.includes(member)) : [...base, ...members.filter((member) => !base.includes(member))];
          return next.length ? next : members;
        });
      } else {
        setSelectionIds(members);
      }
      setSelectedTextLayerId(id);
      if (!extra?.additive) setEditingTextLayerId(null);
    },
    [membersOf, selectedTextLayerId, toast],
  );

  const handleEditTextLayer = useCallback((id: string | null) => {
    setEditingTextLayerId(id);
    if (id) setSelectedTextLayerId(id);
  }, []);

  const onCopyTextStyle = useCallback(
    (id: string) => {
      const layer = textDoc.overlay.layers.find((l) => l.id === id);
      if (!layer) return;
      textStyleClipboardRef.current = extractTextLayerStyle(layer, textDoc.extras[id]);
      toast({ title: "已复制样式", message: "选中其他文字块即可套用" });
    },
    [textDoc, toast],
  );

  const deleteTextSelection = useCallback((id: string) => {
    setTextDoc((d) => removeImageEditorTextSelection(d, id));
    setSelectedTextLayerId((cur) => (cur === id ? null : cur));
    setEditingTextLayerId((cur) => (cur === id ? null : cur));
  }, []);

  const mergeTextSelection = useCallback(async () => {
    const id = selectedTextLayerId;
    const src = displayUrl ?? imageUrl;
    if (!id || !src || naturalW < 1 || naturalH < 1) throw new Error("当前没有可合并的图片");
    const extras = textDoc.extras[id];
    const ids = selectionIds.length
      ? selectionIds
      : isTextGrouped(extras) && extras?.groupId
        ? layersSharingGroup(textDoc.overlay.layers, textDoc.extras, extras.groupId).map((layer) => layer.id)
        : [id];
    const url = await flattenImageEditorTextLayers(src, naturalW, naturalH, ids);
    applyUrl(url, naturalW, naturalH);
    setTextDoc((d) => ids.reduce((doc, layerId) => removeImageEditorTextSelection(doc, layerId), d));
    setSelectedTextLayerId(null);
    setSelectionIds([]);
    setEditingTextLayerId(null);
  }, [applyUrl, displayUrl, imageUrl, naturalH, naturalW, selectedTextLayerId, selectionIds, textDoc]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (!textInteract || !selectedTextLayerId || editingTextLayerId) return;
      if (document.querySelector("[role='dialog']")) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      deleteTextSelection(selectedTextLayerId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteTextSelection, editingTextLayerId, selectedTextLayerId, textInteract]);

  const onTextAiFlower = useCallback((id: string) => {
    setSelectedTextLayerId(id);
    setTool("text");
    setAiFlowerOpen(true);
  }, []);

  const onPickTextTemplate = useCallback(
    (templateId: string) => {
      if (!imageUrl) return;
      setAiFlowerOpen(false);
      const template = imageEditorTextTemplateById(templateId);
      if (template?.poster) {
        const posterSrc = template.poster;
        const posterId = posterSrc.match(/(\d{10})\.png$/)?.[1];
        const img = new Image();
        img.onload = () => {
          let primary = "";
          let ids: string[] = [];
          setTextDoc((prev) => {
            const synced = syncTextDocumentExportSize(prev, textExportW);
            const placed = placeOriginalSellingPoster(synced, {
              src: posterSrc,
              imgW: img.naturalWidth,
              imgH: img.naturalHeight,
              exportW: textExportW,
              exportH: textExportH,
              posterId,
            });
            primary = placed.layerId;
            ids = placed.layerIds;
            return placed.doc;
          });
          setSelectedTextLayerId(primary || null);
          setSelectionIds(ids);
          setEditingTextLayerId(null);
        };
        img.onerror = () => {
          void alert({ title: "无法添加卖点", message: "这张卖点图没有加载成功。", variant: "error" });
        };
        img.src = posterSrc;
        return;
      }
      setTextDoc((prev) => {
        const synced = syncTextDocumentExportSize(prev, textExportW);
        const { doc, layerId } = createImageEditorTextFromTemplate(synced, templateId, textExportW, textExportH);
        setSelectedTextLayerId(layerId);
        setSelectionIds([layerId]);
        setEditingTextLayerId(null);
        return doc;
      });
    },
    [alert, imageUrl, textExportH, textExportW],
  );

  const onUngroupSelling = useCallback(
    async (posterId: string, groupId: string) => {
      try {
        const pack = await ensureSellingPosterDecompose(posterId);
        let primary = "";
        let ids: string[] = [];
        setTextDoc((prev) => {
          const placed = replaceSellingGroupWithDecompose(prev, {
            groupId,
            sample: "商品卖点",
            imgW: pack.imgW,
            imgH: pack.imgH,
            layers: pack.layers,
            exportW: textExportW,
            exportH: textExportH,
          });
          primary = placed.layerId;
          ids = placed.layerIds;
          return placed.layerIds.length ? placed.doc : prev;
        });
        if (primary) {
          setSelectedTextLayerId(primary);
          setSelectionIds(ids);
          setEditingTextLayerId(null);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "这张卖点没有拆开";
        await alert({ title: "无法取消组合", message, variant: "error" });
      }
    },
    [alert, textExportH, textExportW],
  );

  const onAddQuickText = useCallback(
    (kind: ImageEditorTextQuickKind) => {
      if (!imageUrl) return;
      setTextDoc((prev) => {
        const synced = syncTextDocumentExportSize(prev, textExportW);
        const { doc, layerId } = createQuickTextLayer(synced, kind, textExportW, textExportH);
        setSelectedTextLayerId(layerId);
        setEditingTextLayerId(layerId);
        return doc;
      });
    },
    [imageUrl, textExportH, textExportW],
  );

  /** 裁切交互：底图固定在原图档（仅旋转/滤镜），不随裁切框缩放 */
  useEffect(() => {
    if (!imageUrl || !canvasFrameInteract || naturalW < 1 || naturalSrcRef.current !== imageUrl) {
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

  useEffect(() => {
    if (naturalW < 1 || naturalH < 1) return;
    setFrameOffset((prev) => {
      const next = placeImageInCanvas({
        canvasW,
        canvasH,
        imageW: naturalW,
        imageH: naturalH,
        fitInside: losslessResize,
        offsetX: prev.x,
        offsetY: prev.y,
      });
      if (next.offsetX === prev.x && next.offsetY === prev.y) return prev;
      return { x: next.offsetX, y: next.offsetY };
    });
  }, [canvasH, canvasW, losslessResize, naturalH, naturalW]);

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
    if (!imageUrl || naturalSrcRef.current !== imageUrl || naturalW < 1 || naturalH < 1) return;
    if (cropAlignedUrlRef.current === imageUrl) return;
    cropAlignedUrlRef.current = imageUrl;
    const next = fullImageCropRect(naturalW, naturalH);
    setCropRect(next);
    cropRectRef.current = next;
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
    colorSourceRef.current = null;
    colorSourceHistoryIdxRef.current = null;
    setColorSourceUrl(null);
    setColorGradeId(null);
    setImageUrl(null);
    setDisplayUrl(null);
    setBaseDisplayUrl(null);
    setCropPreviewUrl(null);
    naturalSrcRef.current = null;
    setNaturalW(0);
    setNaturalH(0);
    setCanvasW(DEFAULT_CANVAS);
    setCanvasH(DEFAULT_CANVAS);
    setRotateDeg(0);
    setFlipH(false);
    setFlipV(false);
    setShapeMask("none");
    setFrameOffset({ x: 0, y: 0 });
    setHistory([]);
    historyRef.current = [];
    historyIdxRef.current = -1;
    setHistoryIdx(-1);
    window.clearTimeout(stepTimerRef.current);
    baselineRef.current = null;
    adjustDraftRef.current = null;
    shapeDraftRef.current = null;
    setTextDoc(emptyImageEditorTextDocument(DEFAULT_CANVAS));
    setSelectedTextLayerId(null);
    setEditingTextLayerId(null);
    persistImageUrlRef.current = null;
    setSessionPersistUrl(null);
    setCutoutOpen(false);
    setCutoutSubject("portrait");
    setCutoutResultUrl(null);
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
      frameOffsetX: 0,
      frameOffsetY: 0,
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
      cutoutOpen: false,
      cutoutSubject: "portrait",
      cutoutResultUrl: null,
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
      frameOffsetX: frameOffset.x,
      frameOffsetY: frameOffset.y,
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
      textOverlayJson: textDoc.overlay.layers.length ? JSON.stringify(textDoc.overlay) : null,
      textExtrasJson: Object.keys(textDoc.extras).length ? JSON.stringify(textDoc.extras) : null,
      selectedTextLayerId,
      imageUrl: sessionPersistUrl ?? (imageUrl?.startsWith("http") || imageUrl?.startsWith("data:") ? imageUrl : null),
      imageOmitted: Boolean(imageUrl) && !sessionPersistUrl && !imageUrl?.startsWith("http") && !imageUrl?.startsWith("data:") ? true : undefined,
      cutoutOpen,
      cutoutSubject,
      cutoutResultUrl: sessionCutoutResultUrl(cutoutResultUrl),
    };
    const t = window.setTimeout(() => {
      writeImageEditorSession(snapshot);
      setSavedAt(new Date());
    }, 500);
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
    frameOffset,
    lockAspect,
    correctionOpen,
    brightness,
    contrast,
    saturate,
    erasePrompt,
    imageUrl,
    sessionPersistUrl,
    correction,
    textDoc,
    selectedTextLayerId,
    cutoutOpen,
    cutoutSubject,
    cutoutResultUrl,
  ]);

  const onCutoutSession = useCallback((subject: string, resultUrl: string | null) => {
    setCutoutSubject(subject);
    setCutoutResultUrl(resultUrl);
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
      rememberStep({
        crop: next,
        canvasW: Math.max(1, Math.round(next.w)),
        canvasH: Math.max(1, Math.round(next.h)),
      });
    },
    [bakeCropPreview, naturalH, naturalW, rememberStep],
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
      const nextW = id !== "none" && naturalW > 0 && naturalH > 0 && (canvasW < 200 || canvasH < 200) ? naturalW : canvasW;
      const nextH = id !== "none" && naturalW > 0 && naturalH > 0 && (canvasW < 200 || canvasH < 200) ? naturalH : canvasH;
      if (nextW !== canvasW) setCanvasW(nextW);
      if (nextH !== canvasH) setCanvasH(nextH);
      rememberStep({ shapeMask: id, canvasW: nextW, canvasH: nextH });
    },
    [canvasH, canvasW, captureShapeDraft, naturalH, naturalW, rememberStep],
  );

  const setTargetWidth = (w: number) => {
    const next = Math.min(8192, Math.max(1, Math.round(w)));
    if (lockAspect && canvasW > 0 && canvasH > 0) {
      const aspect = canvasH / canvasW;
      setCanvasW(next);
      setCanvasH(Math.round(next * aspect));
    } else {
      setCanvasW(next);
    }
    scheduleStep();
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
    scheduleStep();
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
        colorSourceRef.current = null;
        colorSourceHistoryIdxRef.current = null;
        setColorSourceUrl(null);
        setColorGradeId(null);
        setImageUrl(out);
        setDisplayUrl(out);
        naturalSrcRef.current = out;
        persistImageUrlRef.current = out;
        setSessionPersistUrl(out);
        baselineRef.current = {
          canvasW,
          canvasH,
          rotateDeg,
          flipH,
          flipV,
          offsetX: frameOffset.x,
          offsetY: frameOffset.y,
        };
        cropAlignedUrlRef.current = out;
        rememberStep({
          url: out,
          canvasW,
          canvasH,
          rotateDeg,
          flipH,
          flipV,
          offsetX: frameOffset.x,
          offsetY: frameOffset.y,
          correction: IMAGE_EDITOR_CORRECTION_DEFAULT,
          crop: naturalW > 0 && naturalH > 0 ? { x: 0, y: 0, w: naturalW, h: naturalH } : null,
        });
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
          fitInside: losslessResize,
          stretch: false,
          offsetX: frameOffset.x,
          offsetY: frameOffset.y,
          filterStyle: activeFilterStyle,
        });
        colorSourceRef.current = null;
        colorSourceHistoryIdxRef.current = null;
        setColorSourceUrl(null);
        setColorGradeId(null);
        setImageUrl(out);
        setDisplayUrl(out);
        naturalSrcRef.current = out;
        setNaturalW(outW);
        setNaturalH(outH);
        setCanvasW(outW);
        setCanvasH(outH);
        setFrameOffset({ x: 0, y: 0 });
        persistImageUrlRef.current = out;
        setSessionPersistUrl(out);
        setRotateDeg(0);
        setFlipH(false);
        setFlipV(false);
        baselineRef.current = {
          canvasW: outW,
          canvasH: outH,
          rotateDeg: 0,
          flipH: false,
          flipV: false,
          offsetX: 0,
          offsetY: 0,
        };
        cropAlignedUrlRef.current = out;
        rememberStep({
          url: out,
          canvasW: outW,
          canvasH: outH,
          rotateDeg: 0,
          flipH: false,
          flipV: false,
          offsetX: 0,
          offsetY: 0,
          shapeMask: "none",
          crop: { x: 0, y: 0, w: outW, h: outH },
          correction: IMAGE_EDITOR_CORRECTION_DEFAULT,
        });
        adjustDraftRef.current = {
          w: outW,
          h: outH,
          rotateDeg: 0,
          flipH: false,
          flipV: false,
          offsetX: 0,
          offsetY: 0,
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
      colorSourceRef.current = null;
      colorSourceHistoryIdxRef.current = null;
      setColorSourceUrl(null);
      setColorGradeId(null);
      setImageUrl(out);
      setDisplayUrl(out);
      setCropPreviewUrl(null);
      naturalSrcRef.current = out;
      setNaturalW(outW);
      setNaturalH(outH);
      setCanvasW(outW);
      setCanvasH(outH);
      persistImageUrlRef.current = out;
      setSessionPersistUrl(out);
      setRotateDeg(0);
      setFlipH(false);
      setFlipV(false);
      baselineRef.current = {
        canvasW: outW,
        canvasH: outH,
        rotateDeg: 0,
        flipH: false,
        flipV: false,
        offsetX: 0,
        offsetY: 0,
      };
      cropAlignedUrlRef.current = out;
      rememberStep({
        url: out,
        canvasW: outW,
        canvasH: outH,
        rotateDeg: 0,
        flipH: false,
        flipV: false,
        offsetX: 0,
        offsetY: 0,
        shapeMask: "none",
        crop: { x: 0, y: 0, w: outW, h: outH },
        correction: IMAGE_EDITOR_CORRECTION_DEFAULT,
      });
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
      const dataUrl = await imageEditSource(imageUrl);
      const res = await submitImageProcessingEdit({
        mode: "bg-remove",
        model: imageEditorModel,
        generativeModel: imageEditorModel,
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
    if (!imageUrl) {
      await alert({ title: "无法变清晰", message: "请先打开一张图片。" });
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await imageEditSource(imageUrl);
      const res = await submitImageProcessingEdit({
        mode: "enhancer",
        prompt: imageEditorHdPrompt(hdMode, hdKeepSize),
        model: imageEditorModel,
        generativeModel: imageEditorModel,
        sourceImageDataUrl: dataUrl,
      });
      const next = res.imageUrls[0];
      if (!next) throw new Error("未返回结果");
      applyUrl(next, canvasW, canvasH);
      toast({ title: `${imageEditorHdModeLabel(hdMode)}完成`, variant: "success" });
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

  const lockColorSource = () => {
    if (!imageUrl || colorSourceRef.current) return;
    colorSourceRef.current = imageUrl;
    colorSourceHistoryIdxRef.current = historyIdxRef.current;
    setColorSourceUrl(imageUrl);
  };

  const restoreColorSource = () => {
    setColorPreviewCss(null);
    setColorGradeId(null);
    const source = colorSourceRef.current;
    if (source && source !== imageUrl) applyUrl(source, canvasW, canvasH, { keepColorSource: true });
  };

  const clearRecolorStrokes = () => {
    recolorStrokesRef.current = [];
    setRecolorStrokeVersion((value) => value + 1);
    const last = lastColorAdjust.current;
    if (last?.adjust.recolorSource && last.adjust.recolorTarget) {
      void runColorAdjust({ ...last.adjust, protect: undefined }, last.label);
    }
  };

  const runColorAdjust = async (adjust: ColorAdjust, label: string) => {
    if (!imageUrl) {
      await alert({ title: "无法调色", message: "请先打开一张图片。" });
      return;
    }
    const payload: ColorAdjust = adjust.recolorSource
      ? { ...adjust, protect: recolorStrokesRef.current.length > 0 ? recolorStrokesRef.current.slice(-80) : undefined }
      : adjust;
    lastColorAdjust.current = { adjust: payload, label };
    if (colorAdjustBusy.current) {
      pendingColorAdjust.current = { adjust: payload, label };
      setColorPreviewCss(colorAdjustPreviewCss(payload));
      return;
    }
    lockColorSource();
    const source = colorSourceRef.current ?? imageUrl;
    const seq = ++colorAdjustSeq.current;
    colorAdjustBusy.current = true;
    setColorPreviewCss(colorAdjustPreviewCss(payload));
    setColorGradeId(null);
    setColorRunning(true);
    setColorProgress(8);
    try {
      const next = await submitImageEditorLocalGrade(source, "adjust", payload);
      if (seq !== colorAdjustSeq.current) return;
      setColorPreviewCss(null);
      setBrightness(100);
      setContrast(100);
      setSaturate(100);
      applyUrl(next, canvasW, canvasH, { keepColorSource: true });
      setColorProgress(100);
      toast({ title: `${label}完成`, variant: "success" });
    } catch (e) {
      if (seq !== colorAdjustSeq.current) return;
      setColorPreviewCss(null);
      await alert({
        title: "调色失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      if (seq === colorAdjustSeq.current) {
        colorAdjustBusy.current = false;
        setColorRunning(false);
        const pending = pendingColorAdjust.current;
        pendingColorAdjust.current = null;
        if (pending) void runColorAdjust(pending.adjust, pending.label);
      }
    }
  };

  const runColorGrade = async (id: string) => {
    const grade = imageEditorColorGrade(id);
    if (!grade) return;
    if (!imageUrl) {
      await alert({ title: "无法调色", message: "请先打开一张图片。" });
      return;
    }
    if (busy || colorRunning) return;
    const source = colorSourceRef.current ?? imageUrl;
    if (!colorSourceRef.current) {
      colorSourceRef.current = source;
      colorSourceHistoryIdxRef.current = historyIdxRef.current;
      setColorSourceUrl(source);
    }
    setColorPreviewCss(null);
    setColorGradeId(id);
    setColorRunning(true);
    setColorProgress(8);
    try {
      const next = await submitImageEditorLocalGrade(source, grade.id);
      setBrightness(100);
      setContrast(100);
      setSaturate(100);
      applyUrl(next, canvasW, canvasH, { keepColorSource: true });
      setColorProgress(100);
      toast({ title: `${grade.label}完成`, variant: "success" });
    } catch (e) {
      await alert({
        title: "调色失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setColorRunning(false);
    }
  };

  useEffect(() => {
    if (!eraseRunning) return;
    setEraseProgress(8);
    const timer = window.setInterval(() => {
      setEraseProgress((value) => (value >= 92 ? value : value + Math.max(1, Math.round((92 - value) * 0.12))));
    }, 450);
    return () => window.clearInterval(timer);
  }, [eraseRunning]);

  useEffect(() => {
    if (!colorRunning) return;
    const timer = window.setInterval(() => {
      setColorProgress((value) => (value >= 92 ? value : value + Math.max(1, Math.round((92 - value) * 0.12))));
    }, 450);
    return () => window.clearInterval(timer);
  }, [colorRunning]);

  useEffect(() => {
    if (!eraseNotice) return;
    const timer = window.setTimeout(() => setEraseNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [eraseNotice]);

  const runManualErase = async () => {
    if (eraseRunning) return;
    if (!imageUrl) {
      await alert({ title: "无法消除", message: "请先打开一张图片。" });
      return;
    }
    const hasMarks = Boolean(eraseLayerRef.current?.hasMarks());
    const mask = hasMarks
      ? eraseLayerRef.current?.toMaskDataUrl(naturalW || canvasW, naturalH || canvasH) ?? null
      : null;
    eraseLayerRef.current?.clear();
    if (!mask) {
      await alert({
        title: hasMarks ? "选区无效" : "请先选择区域",
        message: hasMarks
          ? "这次选区几乎盖住了整张图，已取消，图片没有改动。"
          : "用涂抹、框选或圈选标出要消除的地方，再开始消除。",
      });
      return;
    }
    setEraseNotice(null);
    setEraseRunning(true);
    try {
      const sourceImageUrl = await imageEditSource(imageUrl);
      const erased = await eraseImageLayerRegion({ sourceImageUrl, maskDataUrl: mask });
      setEraseProgress(100);
      applyUrl(erased.imageUrl, canvasW, canvasH);
    } catch (e) {
      await alert({
        title: "消除失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setEraseRunning(false);
    }
  };

  const runAutoErase = async (id: EraseTargetId) => {
    const item = ERASE_TARGETS.find((row) => row.id === id);
    if (!item) return;
    if (!imageUrl) {
      setEraseTargets((prev) => ({ ...prev, [id]: false }));
      await alert({ title: "无法消除", message: "请先打开一张图片。" });
      return;
    }
    if (eraseRunning) return;
    setEraseNotice(null);
    setEraseTargets((prev) => ({ ...prev, [id]: true }));
    setEraseRunning(true);
    try {
      const dataUrl = await imageEditSource(imageUrl);
      const res = await submitImageProcessingEdit({
        mode: "editor",
        prompt: `如果画面中有${item.prompt}，只去掉${item.prompt}，用周围画面自然补上，其余物体、构图和颜色都保持不变。如果画面中没有${item.prompt}，请原样返回，不要做任何修改。`,
        model: imageEditorModel,
        generativeModel: imageEditorModel,
        sourceImageDataUrl: dataUrl,
      });
      const next = res.imageUrls[0];
      if (!next) throw new Error("未返回结果");
      if (await imagesNearlyUnchanged(imageUrl, next)) {
        setEraseNotice(`未识别到${item.notice}，请尝试手动选择需要消除的区域。`);
        return;
      }
      setEraseProgress(100);
      applyUrl(next, canvasW, canvasH);
    } catch (e) {
      await alert({
        title: "消除失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setEraseTargets((prev) => ({ ...prev, [id]: false }));
      setEraseRunning(false);
    }
  };

  const historyLoadRef = useRef(0);
  const restoreHistoryEntry = (entry: HistoryEntry, historyIdx: number) => {
    const token = ++historyLoadRef.current;
    naturalSrcRef.current = null;
    cropDraftRef.current = null;
    const sourceIdx = colorSourceHistoryIdxRef.current;
    if (sourceIdx != null && historyIdx < sourceIdx) {
      colorSourceRef.current = null;
      colorSourceHistoryIdxRef.current = null;
      setColorSourceUrl(null);
      setColorGradeId(null);
    }
    setImageUrl(entry.url);
    setDisplayUrl(entry.url);
    setBaseDisplayUrl(null);
    setCropPreviewUrl(null);
    setNaturalW(0);
    setNaturalH(0);
    setCanvasW(entry.canvasW);
    setCanvasH(entry.canvasH);
    setRotateDeg(entry.rotateDeg);
    setFlipH(entry.flipH);
    setFlipV(entry.flipV);
    setShapeMask(entry.shapeMask);
    setCorrection(entry.correction);
    setFrameOffset({ x: entry.offsetX, y: entry.offsetY });
    cropAlignedUrlRef.current = entry.url;
    if (entry.crop) {
      cropRectRef.current = entry.crop;
      setCropRect(entry.crop);
    }
    baselineRef.current = {
      canvasW: entry.canvasW,
      canvasH: entry.canvasH,
      rotateDeg: entry.rotateDeg,
      flipH: entry.flipH,
      flipV: entry.flipV,
      offsetX: entry.offsetX,
      offsetY: entry.offsetY,
    };
    void loadImage(entry.url).then((img) => {
      if (historyLoadRef.current !== token) return;
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      naturalSrcRef.current = entry.url;
      setNaturalW(nw);
      setNaturalH(nh);
      if (!entry.crop) {
        const next = fullImageCropRect(nw, nh);
        cropRectRef.current = next;
        setCropRect(next);
      }
    }).catch(() => {
      if (historyLoadRef.current !== token) return;
      naturalSrcRef.current = entry.url;
    });
  };

  const historyHead = historyIdx >= 0 ? history[historyIdx] : undefined;
  const viewDirty = Boolean(
    imageUrl &&
      historyHead &&
      !historyEntriesEqual(historyHead, {
        url: imageUrl,
        canvasW,
        canvasH,
        rotateDeg,
        flipH,
        flipV,
        offsetX: frameOffset.x,
        offsetY: frameOffset.y,
        shapeMask,
        crop: cropRect,
        correction,
      }),
  );

  const revertUncommitted = () => {
    window.clearTimeout(stepTimerRef.current);
    setRotateDeg(0);
    setFlipH(false);
    setFlipV(false);
    setFrameOffset({ x: 0, y: 0 });
    setShapeMask("none");
    setCorrection(IMAGE_EDITOR_CORRECTION_DEFAULT);
    setCropPreviewUrl(null);
    setBaseDisplayUrl(null);
    if (imageUrl) setDisplayUrl(imageUrl);
    if (naturalW > 0 && naturalH > 0) {
      setCanvasW(naturalW);
      setCanvasH(naturalH);
      const next = fullImageCropRect(naturalW, naturalH);
      cropRectRef.current = next;
      setCropRect(next);
      baselineRef.current = {
        canvasW: naturalW,
        canvasH: naturalH,
        rotateDeg: 0,
        flipH: false,
        flipV: false,
        offsetX: 0,
        offsetY: 0,
      };
    }
    adjustDraftRef.current = null;
    cropDraftRef.current = null;
  };

  const cancelAdjustInteraction = () => {
    revertUncommitted();
    setAdjustSectionOpen(false);
    setCorrectionOpen(false);
  };

  const undo = () => {
    window.clearTimeout(stepTimerRef.current);
    const stack = historyRef.current;
    const idx = historyIdxRef.current;
    if (viewDirty && stack[idx]) {
      restoreHistoryEntry(stack[idx], idx);
      return;
    }
    if (idx <= 0) return;
    const entry = stack[idx - 1];
    if (!entry) return;
    historyIdxRef.current = idx - 1;
    setHistoryIdx(idx - 1);
    restoreHistoryEntry(entry, idx - 1);
  };

  const redo = () => {
    window.clearTimeout(stepTimerRef.current);
    if (viewDirty) return;
    const stack = historyRef.current;
    const idx = historyIdxRef.current;
    if (idx >= stack.length - 1) return;
    const entry = stack[idx + 1];
    if (!entry) return;
    historyIdxRef.current = idx + 1;
    setHistoryIdx(idx + 1);
    restoreHistoryEntry(entry, idx + 1);
  };

  const download = () => {
    if (cutoutOpen) {
      setCutoutSaveRequest((n) => n + 1);
      return;
    }
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

  const closeCutoutWorkspace = useCallback(() => {
    setCutoutOpen(false);
    setCutoutResultUrl(null);
    setCutoutSubject("portrait");
  }, []);

  const closeInpaintWorkspace = useCallback(() => {
    setInpaintOpen(false);
  }, []);

  const closeAiGenWorkspace = useCallback(() => {
    setAiGenOpen(false);
  }, []);

  const closeOutpaintWorkspace = useCallback(() => {
    setOutpaintOpen(false);
  }, []);

  const openAiGen = useCallback(() => {
    if (cutoutOpen) closeCutoutWorkspace();
    if (inpaintOpen) closeInpaintWorkspace();
    if (outpaintOpen) closeOutpaintWorkspace();
    setAiGenOpen(true);
  }, [closeCutoutWorkspace, closeInpaintWorkspace, closeOutpaintWorkspace, cutoutOpen, inpaintOpen, outpaintOpen]);

  const openOutpaint = useCallback(async () => {
    if (!imageUrl) {
      await alert({ title: "无法扩图", message: "请先打开一张图片。" });
      return;
    }
    if (textDoc.overlay.layers.length > 0) {
      await alert({ title: "先合并图层", message: "先合并图层，才能使用 AI 扩图。" });
      return;
    }
    if (cutoutOpen) closeCutoutWorkspace();
    if (inpaintOpen) closeInpaintWorkspace();
    if (aiGenOpen) closeAiGenWorkspace();
    setOutpaintOpen(true);
  }, [
    aiGenOpen,
    alert,
    closeAiGenWorkspace,
    closeCutoutWorkspace,
    closeInpaintWorkspace,
    cutoutOpen,
    imageUrl,
    inpaintOpen,
    textDoc.overlay.layers.length,
  ]);

  const openInpaint = useCallback(async () => {
    if (!imageUrl) {
      await alert({ title: "无法重绘", message: "请先打开一张图片。" });
      return;
    }
    if (textDoc.overlay.layers.length > 0) {
      await alert({ title: "先合并图层", message: "先合并图层，才能局部重绘。" });
      return;
    }
    if (cutoutOpen) closeCutoutWorkspace();
    if (aiGenOpen) closeAiGenWorkspace();
    if (outpaintOpen) closeOutpaintWorkspace();
    setInpaintOpen(true);
  }, [
    aiGenOpen,
    alert,
    closeAiGenWorkspace,
    closeCutoutWorkspace,
    closeOutpaintWorkspace,
    cutoutOpen,
    imageUrl,
    outpaintOpen,
    textDoc.overlay.layers.length,
  ]);

  const openCutout = useCallback(async () => {
    if (!imageUrl) {
      await alert({ title: "无法抠图", message: "请先打开一张图片。" });
      return;
    }
    if (textDoc.overlay.layers.length > 0) {
      await alert({ title: "先合并图层", message: "先合并图层，才能抠图。" });
      return;
    }
    if (inpaintOpen) closeInpaintWorkspace();
    if (aiGenOpen) closeAiGenWorkspace();
    if (outpaintOpen) closeOutpaintWorkspace();
    if (tool !== "cutout") {
      toolBeforeCutoutRef.current = tool;
    }
    setCutoutOpen(true);
    if (tool === "cutout") {
      setTool(toolBeforeCutoutRef.current);
    }
  }, [
    aiGenOpen,
    alert,
    closeAiGenWorkspace,
    closeInpaintWorkspace,
    closeOutpaintWorkspace,
    imageUrl,
    inpaintOpen,
    outpaintOpen,
    textDoc.overlay.layers.length,
    tool,
  ]);

  useEffect(() => {
    if (tool !== "cutout" || cutoutOpen || !imageUrl || busy) return;
    void openCutout();
  }, [tool, cutoutOpen, imageUrl, busy, openCutout]);

  const goToInEditorTool = useCallback((id: ImageEditorToolId) => {
    setLeftPanelOpen(true);
    setTool(id);
  }, []);

  const toolPanel = (() => {
    switch (tool) {
      case "add":
        return (
          <ToolPanelCard title="添加素材">
          <div className="space-y-3 text-[11px] text-[var(--ecom-muted)]">
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
              setFrameOffset({ x: 0, y: 0 });
              rememberStep({ canvasW: w, canvasH: h, offsetX: 0, offsetY: 0 });
            }}
            onFreeCrop={() => {
              if (naturalW < 1 || naturalH < 1) return;
              if (adjustTab === "resize") {
                setCanvasW(naturalW);
                setCanvasH(naturalH);
                setFrameOffset({ x: 0, y: 0 });
                rememberStep({ canvasW: naturalW, canvasH: naturalH, offsetX: 0, offsetY: 0 });
                return;
              }
              const next = fullImageCropRect(naturalW, naturalH);
              cropRectRef.current = next;
              setCropRect(next);
              setCanvasW(naturalW);
              setCanvasH(naturalH);
              rememberStep({ canvasW: naturalW, canvasH: naturalH, crop: next });
            }}
            onRotateCw={() => {
              const next = stepRotateDeg(rotateDeg, 45);
              setRotateDeg(next);
              rememberStep({ rotateDeg: next });
            }}
            onRotateCcw={() => {
              const next = stepRotateDeg(rotateDeg, -45);
              setRotateDeg(next);
              rememberStep({ rotateDeg: next });
            }}
            onFlipH={() => {
              setFlipH((v) => !v);
              rememberStep({ flipH: !flipH });
            }}
            onFlipV={() => {
              setFlipV((v) => !v);
              rememberStep({ flipV: !flipV });
            }}
            onCancel={cancelAdjustInteraction}
            sectionOpen={adjustSectionOpen}
            onSectionOpenChange={(open) => {
              setAdjustSectionOpen(open);
              if (open) setCorrectionOpen(false);
            }}
            onApply={() => void commitExport()}
            busy={busy}
            hasImage={Boolean(imageUrl)}
            correctionOpen={correctionOpen}
            onToggleCorrection={() => {
              if (correctionOpen) {
                setCorrectionOpen(false);
                return;
              }
              setAdjustSectionOpen(false);
              setCorrectionOpen(true);
            }}
            onCloseCorrection={() => setCorrectionOpen(false)}
            correctionPanel={
              <ImageCorrectionPanel
                value={correction}
                disabled={!imageUrl || busy}
                onChange={(next) => {
                  setCorrection(next);
                  scheduleStep();
                }}
                onReset={() => setCorrection(IMAGE_EDITOR_CORRECTION_DEFAULT)}
              />
            }
            shapeMask={shapeMask}
            onShapeMask={onShapeMaskChange}
            onRatioPreset={pickRatioPreset}
          />
        );
      case "text":
        if (aiFlowerOpen && selectedTextLayer) {
          const flowerExtras = textDoc.extras[selectedTextLayer.id] ?? {};
          return (
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] px-3 py-3 shadow-sm">
              <ImageEditorAiFlowerPanel
                layer={selectedTextLayer}
                extras={flowerExtras}
                disabled={!imageUrl || busy}
                onBack={() => setAiFlowerOpen(false)}
                onContent={(text) => setTextDoc((d) => updateImageEditorTextContent(d, selectedTextLayer.id, text))}
                onFont={(fontFamily) => setTextDoc((d) => patchImageEditorTextLayer(d, selectedTextLayer.id, { fontFamily }))}
                onBold={() =>
                  setTextDoc((d) =>
                    patchImageEditorTextLayer(d, selectedTextLayer.id, {
                      fontWeight: selectedTextLayer.fontWeight === "normal" ? "bold" : "normal",
                    }),
                  )
                }
                onItalic={() =>
                  setTextDoc((d) =>
                    patchImageEditorTextExtras(d, selectedTextLayer.id, { italic: !flowerExtras.italic }),
                  )
                }
                onGenerate={(flowerId) => {
                  setTextDoc((d) => applyImageEditorFlower(d, selectedTextLayer.id, flowerId));
                  toast({ title: "已套用花字", message: "样式已写到当前文字" });
                }}
              />
            </div>
          );
        }
        return (
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] px-3 py-3 shadow-sm">
            <ImageEditorTextPanel disabled={!imageUrl || busy} onAdd={onAddQuickText} onPickTemplate={onPickTextTemplate} />
          </div>
        );
      case "erase":
        return (
          <ImageEditorErasePanel
            tab={eraseTab}
            onTab={setEraseTab}
            targets={eraseTargets}
            onToggleTarget={(id) => {
              if (eraseRunning) return;
              if (eraseTargets[id]) {
                setEraseTargets((prev) => ({ ...prev, [id]: false }));
                return;
              }
              void runAutoErase(id);
            }}
            selectTool={eraseSelectTool}
            onSelectTool={setEraseSelectTool}
            brushSize={eraseBrush}
            onBrushSize={setEraseBrush}
            busy={eraseRunning}
            onClear={() => eraseLayerRef.current?.clear()}
            onReset={() => {
              setEraseTargets({});
              setEraseBrush(25);
              setEraseSelectTool("brush");
              setEraseNotice(null);
              eraseLayerRef.current?.clear();
            }}
            onStart={() => void runManualErase()}
          />
        );
      case "cutout":
        return (
          <ToolPanelCard title="抠图">
          <div className="space-y-3">
            <p className="text-[11px] text-[var(--ie-subtle)]">智能抠图，移除背景保留主体（走 Gateway 图像处理）。</p>
            {!modelsLoaded ? <p className="text-[10px] text-[var(--ie-subtle)]">加载模型…</p> : null}
            <EcomButtonPrimary type="button" className="w-full" disabled={!imageUrl || busy} onClick={() => void openCutout()}>
              一键抠图
            </EcomButtonPrimary>
          </div>
          </ToolPanelCard>
        );
      case "hd":
        return (
          <ImageEditorHdPanel
            mode={hdMode}
            keepOriginalSize={hdKeepSize}
            busy={busy}
            disabled={!imageUrl || busy}
            onMode={setHdMode}
            onKeepOriginalSize={setHdKeepSize}
            onStart={() => void runEnhance()}
          />
        );
      case "color":
        return (
          <ImageEditorColorPanel
            imageUrl={colorSourceUrl ?? imageUrl}
            selectedId={colorGradeId}
            openGroup={colorGroup}
            busy={colorRunning}
            eraseArmed={recolorArmed}
            eraseBrush={recolorBrush}
            onOpenGroup={(group) => {
              setColorGroup(group);
              if (group !== "recolor") setRecolorArmed(false);
            }}
            onResetSelection={() => {
              setColorGradeId(null);
              setColorGroup(null);
              setRecolorArmed(false);
            }}
            onPick={(id) => void runColorGrade(id)}
            onAdjust={(adjust, label) => void runColorAdjust(adjust, label)}
            onPreview={(css) => {
              if (css) lockColorSource();
              setColorPreviewCss(css);
            }}
            onRestore={restoreColorSource}
            onEraseArm={setRecolorArmed}
            onEraseBrush={setRecolorBrush}
            onEraseClear={clearRecolorStrokes}
          />
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
          <ImageEditorBasicToolsPanel
            disabled={busy}
            onCutout={() => {
              void openCutout();
            }}
            onEnhance={() => goToInEditorTool("hd")}
            onInpaint={() => {
              void openInpaint();
            }}
            onAiGenerate={openAiGen}
            onOutpaint={() => {
              void openOutpaint();
            }}
            onAiFlower={() => {
              if (!imageUrl) return;
              setTool("text");
              if (selectedTextLayerId) {
                setAiFlowerOpen(true);
                return;
              }
              void alert({
                title: "请先添加文字",
                message: "在「文字」工具中添加文本图层后，可使用 AI 花字。",
              });
            }}
          />
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
          canUndo={viewDirty || historyIdx > 0}
          canRedo={!viewDirty && historyIdx < history.length - 1 && history.length > 0}
          savedLabel={
            savedAt
              ? `${String(savedAt.getHours()).padStart(2, "0")}:${String(savedAt.getMinutes()).padStart(2, "0")} 已保存`
              : null
          }
          canDownload={Boolean(imageUrl)}
          onUndo={undo}
          onRedo={redo}
          onOpenFile={() => fileInputRef.current?.click()}
          onDownload={download}
          onOpenNewTab={openInNewTab}
          leftCollapsed={!leftPanelOpen}
          rightCollapsed={!rightPanelOpen}
          onToggleLeft={() => setLeftPanelOpen((open) => !open)}
          panelsDisabled={cutoutOpen || inpaintOpen || outpaintOpen || aiGenOpen}
          onToggleRight={() => setRightPanelOpen((open) => !open)}
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row lg:gap-2 lg:p-2">
          <div className="flex max-h-[50vh] min-h-0 w-full shrink-0 flex-row overflow-hidden lg:max-h-none lg:w-auto">
            <ImageEditorToolRail
              active={
                cutoutOpen ? "cutout" : inpaintOpen || outpaintOpen || aiGenOpen ? "more" : tool
              }
              disabled={busy && !cutoutOpen && !inpaintOpen && !outpaintOpen && !aiGenOpen}
              onSelect={(id) => {
                if (id === "cutout") {
                  if (cutoutOpen) return;
                  void openCutout();
                  return;
                }
                if (cutoutOpen) closeCutoutWorkspace();
                if (inpaintOpen) closeInpaintWorkspace();
                if (outpaintOpen) closeOutpaintWorkspace();
                if (aiGenOpen) closeAiGenWorkspace();
                setTool(id);
              }}
            />
            {leftPanelOpen && !cutoutOpen && !inpaintOpen && !outpaintOpen && !aiGenOpen ? (
              <aside className="ecom-scrollbar-thin flex min-h-0 w-[min(100%,320px)] flex-1 flex-col overflow-y-auto bg-transparent p-2 pt-0 lg:w-[332px] lg:shrink-0">
                {toolPanel}
              </aside>
            ) : null}
          </div>

          {cutoutOpen && imageUrl ? (
            <ImageEditorCutoutWorkspace
              imageUrl={imageUrl}
              saveRequest={cutoutSaveRequest}
              initialSubject={cutoutSubject}
              initialResultUrl={cutoutResultUrl}
              onSessionChange={onCutoutSession}
              onCancel={closeCutoutWorkspace}
              onApply={(url) => {
                applyUrl(url);
                closeCutoutWorkspace();
              }}
            />
          ) : null}
          {inpaintOpen && imageUrl ? (
            <ImageEditorInpaintWorkspace
              imageUrl={imageUrl}
              onCancel={closeInpaintWorkspace}
              onApply={(url) => {
                applyUrl(url);
                closeInpaintWorkspace();
              }}
            />
          ) : null}
          {outpaintOpen && imageUrl ? (
            <ImageEditorOutpaintWorkspace
              imageUrl={imageUrl}
              onCancel={closeOutpaintWorkspace}
              onApply={(url) => {
                applyUrl(url);
                closeOutpaintWorkspace();
              }}
            />
          ) : null}
          {aiGenOpen ? (
            <ImageEditorAiGenWorkspace
              canvasImageUrl={imageUrl}
              onCancel={closeAiGenWorkspace}
              onApply={(url) => {
                applyUrl(url);
                closeAiGenWorkspace();
              }}
            />
          ) : null}
          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-1 lg:rounded-xl lg:border lg:border-[var(--ie-border-soft)] lg:bg-[var(--ie-canvas-well)]",
              canvasFrameInteract || resizeInteract ? "overflow-visible" : "overflow-hidden",
              (cutoutOpen || inpaintOpen || outpaintOpen || aiGenOpen) && "hidden",
              "relative",
            )}
          >
            {eraseRunning || colorRunning ? (
              <div className="absolute left-4 right-4 top-3 z-[80]">
                <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--ie-muted)]">
                  <span>{eraseRunning ? "正在消除" : "正在调色"}</span>
                  <span>{eraseRunning ? eraseProgress : colorProgress}%</span>
                </div>
                <div
                  className="ecom-upload-progress"
                  role="progressbar"
                  aria-valuenow={eraseRunning ? eraseProgress : colorProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${eraseRunning ? eraseProgress : colorProgress}%` }} />
                </div>
              </div>
            ) : eraseNotice ? (
              <button
                type="button"
                className="absolute left-1/2 top-3 z-[80] flex max-w-[min(92%,440px)] -translate-x-1/2 items-center gap-2 rounded-lg bg-white px-3 py-2 text-left text-[13px] text-[#1d1d1f] shadow-md"
                onClick={() => setEraseNotice(null)}
              >
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#ff9f0a] text-[11px] font-semibold leading-none text-white">
                  !
                </span>
                {eraseNotice}
              </button>
            ) : null}
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
              frameOffsetX={frameOffset.x}
              frameOffsetY={frameOffset.y}
              onFrameOffset={(x, y) => {
                const next = placeImageInCanvas({
                  canvasW,
                  canvasH,
                  imageW: Math.max(1, naturalW),
                  imageH: Math.max(1, naturalH),
                  fitInside: losslessResize,
                  offsetX: x,
                  offsetY: y,
                });
                setFrameOffset({ x: next.offsetX, y: next.offsetY });
                scheduleStep();
              }}
              rotateDeg={rotateDeg}
              flipH={flipH}
              flipV={flipV}
              filterStyle={stageFilterStyle}
              correctionCss={correctionOpen ? imageEditorCorrectionCss(correction) : ""}
              compareUrl={colorSourceUrl && colorSourceUrl !== imageUrl ? colorSourceUrl : null}
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
              onShapeMaskCancel={cancelAdjustInteraction}
              onShapeMaskConfirm={() => void commitExport()}
              onShapeMaskRotateDeg={setRotateDeg}
              onCanvasResize={onCanvasFrameResize}
              onShapeMaskResize={onCanvasFrameResize}
              baseDisplayUrl={baseDisplayUrl}
              cropPreviewUrl={cropPreviewUrl}
              cropDragging={canvasFrameDragging}
              onCanvasDragActiveChange={onCanvasDragActiveChange}
              onClearImage={() => void clearImage()}
              textInteract={textInteract}
              textOverlay={textDoc.overlay}
              textExtras={textDoc.extras}
              selectedTextLayerId={selectedTextLayerId}
              selectedTextLayerIds={selectionIds}
              editingTextLayerId={editingTextLayerId}
              onSelectTextLayer={handleSelectTextLayer}
              onEditTextLayer={handleEditTextLayer}
              onTextLayerPatch={(id, patch) => setTextDoc((d) => patchImageEditorTextLayer(d, id, patch))}
              onTextExtrasPatch={(id, patch) => setTextDoc((d) => patchImageEditorTextExtras(d, id, patch))}
              onTextContent={(id, text) => setTextDoc((d) => updateImageEditorTextContent(d, id, text))}
              onTextDuplicate={(id) => {
                setTextDoc((d) => {
                  const { doc, layerId } = duplicateImageEditorTextSelection(d, id);
                  setSelectedTextLayerId(layerId);
                  return doc;
                });
              }}
              onTextDelete={deleteTextSelection}
              onTextCopyStyle={onCopyTextStyle}
              onTextAiFlower={onTextAiFlower}
              eraseOverlay={
                tool === "erase" && imageUrl ? (
                  <ImageEditorEraseLayer
                    ref={eraseLayerRef}
                    tool={eraseTab === "manual" ? "brush" : eraseSelectTool}
                    brushSize={eraseBrush}
                    disabled={eraseRunning}
                    imageWidth={naturalW || canvasW}
                    imageHeight={naturalH || canvasH}
                    onStrokeEnd={eraseTab === "manual" ? () => void runManualErase() : undefined}
                  />
                ) : tool === "color" && colorGroup === "recolor" && recolorArmed && imageUrl ? (
                  <RecolorProtectLayer
                    key={recolorStrokeVersion}
                    brushSize={recolorBrush}
                    onStroke={(stroke) => {
                      recolorStrokesRef.current = [...recolorStrokesRef.current, stroke].slice(-80);
                    }}
                    onStrokeEnd={() => {
                      const last = lastColorAdjust.current;
                      if (last?.adjust.recolorSource && last.adjust.recolorTarget) {
                        void runColorAdjust(last.adjust, last.label);
                      }
                    }}
                  />
                ) : null
              }
            />
          </div>

          <div
            className={cn(
              "flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-t border-[var(--ie-border-soft)] lg:h-full lg:w-[300px] lg:self-stretch lg:border-l lg:border-t-0",
              (!rightPanelOpen || cutoutOpen || inpaintOpen || outpaintOpen || aiGenOpen) && "hidden",
            )}
          >
            {tool === "text" ? (
              <ImageEditorTextInspector
                doc={textDoc}
                selectedLayer={selectedTextLayer}
                exportW={textExportW}
                exportH={textExportH}
                disabled={!imageUrl || busy}
                onChange={setTextDoc}
                onDuplicate={
                  selectedTextLayer
                    ? () => {
                        const id = selectedTextLayer.id;
                        setTextDoc((d) => {
                          const { doc, layerId } = duplicateImageEditorTextSelection(d, id);
                          setSelectedTextLayerId(layerId);
                          return doc;
                        });
                      }
                    : undefined
                }
                onAiFlower={selectedTextLayer ? () => onTextAiFlower(selectedTextLayer.id) : undefined}
                onMergeLayers={mergeTextSelection}
                onUngroupSelling={onUngroupSelling}
                selectionIds={selectionIds}
                onDeleteLayer={deleteTextSelection}
              />
            ) : (
              <ImageEditorCanvasPanel
                width={canvasW}
                height={canvasH}
                lockAspect={lockAspect}
                disabled={!imageUrl || busy}
                onWidth={setTargetWidth}
                onHeight={setTargetHeight}
                onToggleLock={() => setLockAspect((v) => !v)}
              />
            )}
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
