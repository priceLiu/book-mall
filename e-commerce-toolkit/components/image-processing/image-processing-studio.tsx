"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CloudUpload,
  Expand,
  Loader2,
  Pencil,
  Sparkles,
  Wand2,
} from "lucide-react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  ImageEnhancerGuideSections,
  ImageOutpaintGuideSections,
} from "@/components/image-processing/image-processing-guides";
import { ImageBgRemoverPanel } from "@/components/image-processing/image-bg-remover-panel";
import { ImageAvatarPanel } from "@/components/image-processing/image-avatar-panel";
import { ImageCameraAnglePanel } from "@/components/image-processing/image-camera-angle-panel";
import { ImageDeblurPanel } from "@/components/image-processing/image-deblur-panel";
import { ImageGifPanel } from "@/components/image-processing/image-gif-panel";
import { ImageGeneratorPanel } from "@/components/image-processing/image-generator-panel";
import { ImageMemePanel } from "@/components/image-processing/image-meme-panel";
import { ImageFaceSwapPanel } from "@/components/image-processing/image-face-swap-panel";
import { ImageMultiUpload } from "@/components/image-processing/image-multi-upload";
import { ImageObjectRemoverPanel } from "@/components/image-processing/image-object-remover-panel";
import { ImagePosterPanel } from "@/components/image-processing/image-poster-panel";
import { ImageRealisticPanel } from "@/components/image-processing/image-realistic-panel";
import { ImageRestorePanel } from "@/components/image-processing/image-restore-panel";
import {
  ImageMaskCanvas,
  MaskToolbar,
  type ImageMaskCanvasHandle,
} from "@/components/image-processing/image-mask-canvas";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import {
  fetchImageProcessingModels,
  submitImageProcessingEdit,
  type ImageProcessingGatewayModel,
  type ImageProcessingParamField,
} from "@/lib/ecom-image-processing-api";
import {
  IMAGE_PROCESSING_TAG_COLLAPSED_COUNT,
  IMAGE_PROCESSING_TAGS,
  imageProcessingPageTitle,
  type ImageProcessingTagId,
} from "@/lib/image-processing-tags";
import {
  DEFAULT_NEGATIVE_PROMPT_PLACEHOLDER,
  ENHANCER_STYLE_OPTIONS,
  maxEditorUploadImages,
} from "@/lib/image-processing-presets";
import { cn } from "@/lib/utils";

const ASPECT_OPTIONS = ["1:1", "16:9", "9:16", "4:5", "3:4", "4:3"] as const;

const SEEDREAM_ASPECT_TO_SIZE: Record<string, string> = {
  "1:1": "2048x2048",
  "16:9": "2048x1152",
  "9:16": "1152x2048",
  "4:5": "1638x2048",
  "3:4": "1536x2048",
  "4:3": "2048x1536",
};

const EDITOR_QUICK_PROMPTS = [
  "把天空换成橙色",
  "更亮更清晰",
  "添加一只金毛",
  "改变背景",
  "全身更换",
];

const QWEN_EDIT_MODEL_KEYS = new Set(["qwen-image-edit", "qwen-image-edit-max"]);
const WAN_I2I_MODEL_KEY = "wan2.5-i2i-preview";
const WANX_PAINTING_MODEL_KEY = "wanx-x-painting";
const OUTPAINT_MODEL_KEY = "image-out-painting";

const EDITOR_MODEL_FALLBACKS: Array<{ modelKey: string; displayName: string }> = [
  { modelKey: "qwen-image-edit", displayName: "Qwen 图像编辑" },
  { modelKey: "qwen-image-edit-max", displayName: "Qwen 图像编辑 Max" },
  { modelKey: WAN_I2I_MODEL_KEY, displayName: "万相 2.5 · 图像编辑" },
  { modelKey: "doubao-seedream-5-0-260128", displayName: "Doubao Seedream 5.0 Lite" },
];

function isQwenEditModel(modelKey: string) {
  return QWEN_EDIT_MODEL_KEYS.has(modelKey);
}

function isSeedreamEditModel(modelKey: string) {
  return (
    modelKey === "doubao-seedream-5-0-260128" ||
    modelKey === "doubao-seedream-5-0-lite" ||
    modelKey.includes("doubao-seedream-5")
  );
}

function isWanI2iModel(modelKey: string) {
  return modelKey === WAN_I2I_MODEL_KEY;
}

function isWanxPaintingModel(modelKey: string) {
  return modelKey === WANX_PAINTING_MODEL_KEY;
}

function isOutpaintBailianModel(modelKey: string) {
  return modelKey === OUTPAINT_MODEL_KEY;
}

function isQwenEditMaxModel(modelKey: string) {
  return modelKey === "qwen-image-edit-max";
}

function supportsMultiImageEditor(modelKey: string) {
  return isQwenEditModel(modelKey) || isWanI2iModel(modelKey);
}

function supportsQwenMultiImage(modelKey: string) {
  return isQwenEditModel(modelKey);
}

function ImageProcessingCtaButton({
  children,
  disabled,
  onClick,
  className,
  variant = "blue",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  variant?: "green" | "blue";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "green"
          ? "bg-emerald-600 hover:bg-emerald-700"
          : "bg-[#0071e3] hover:bg-[#0066cc]",
        className,
      )}
    >
      {children}
    </button>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

function ParamFields({
  fields,
  values,
  onChange,
}: {
  fields: ImageProcessingParamField[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => (
        <label key={f.name} className="block text-sm">
          <span className="mb-1 block text-[#1d1d1f]">{f.label}</span>
          {f.type === "boolean" ? (
            <input
              type="checkbox"
              checked={Boolean(values[f.name] ?? f.defaultValue)}
              onChange={(e) => onChange(f.name, e.target.checked)}
              className="h-4 w-4 rounded border-[#d2d2d7]"
            />
          ) : f.type === "select" ? (
            <select
              value={String(values[f.name] ?? f.defaultValue ?? "")}
              onChange={(e) => onChange(f.name, e.target.value)}
              className="w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm"
            >
              {(f.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.type === "integer" || f.type === "number" ? (
            <input
              type="number"
              step={f.type === "number" ? "0.1" : "1"}
              min={f.min}
              max={f.max}
              placeholder={f.hint ?? "随机"}
              value={
                values[f.name] === undefined || values[f.name] === ""
                  ? ""
                  : String(values[f.name])
              }
              onChange={(e) => {
                const v = e.target.value.trim();
                onChange(f.name, v === "" ? undefined : Number(v));
              }}
              className="w-full rounded-lg border border-[#d2d2d7] px-3 py-2 text-sm"
            />
          ) : (
            <input
              type="text"
              placeholder={f.hint ?? undefined}
              value={String(values[f.name] ?? f.defaultValue ?? "")}
              onChange={(e) => onChange(f.name, e.target.value)}
              className="w-full rounded-lg border border-[#d2d2d7] px-3 py-2 text-sm"
            />
          )}
          {f.hint ? (
            <span className="mt-0.5 block text-xs text-[#6e6e73]">{f.hint}</span>
          ) : null}
        </label>
      ))}
    </div>
  );
}

function HowToUse({ variant }: { variant: "retouch" | "editor" }) {
  const steps =
    variant === "retouch"
      ? [
          {
            title: "请输入您的内容",
            desc: "上传图片，涂抹需修改区域，并描述替换内容。",
          },
          { title: "点击修图", desc: "经 Gateway 调用百炼 Qwen 图像编辑模型处理。" },
          { title: "下载并分享", desc: "结果自动保存到「我的资产」。" },
        ]
      : [
          { title: "上传图片", desc: "拖放或点击上传 JPG / PNG / WebP。" },
          { title: "描述修改", desc: "用自然语言说明想要的编辑效果。" },
          { title: "选择参数", desc: "可调尺寸、格式、种子等高级选项。" },
          { title: "下载结果", desc: "编辑完成后保存到资产库。" },
        ];
  return (
    <section className="mt-8 rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-6">
      <h3 className="text-lg font-semibold text-[#1d1d1f]">
        {variant === "retouch" ? "如何使用 AI 修图" : "如何编辑图片"}
      </h3>
      <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-sm font-semibold text-white">
              {i + 1}
            </span>
            <div>
              <p className="font-medium text-[#1d1d1f]">{s.title}</p>
              <p className="mt-1 text-sm text-[#6e6e73]">{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ImageProcessingStudio() {
  const { alert: showAlert } = useDialogs();
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [activeTag, setActiveTag] = useState<ImageProcessingTagId>("ai-retouch");
  const [models, setModels] = useState<ImageProcessingGatewayModel[]>([]);
  const [paramProfiles, setParamProfiles] = useState<
    Record<string, ImageProcessingParamField[]>
  >({});

  const [retouchModel, setRetouchModel] = useState("qwen-image-edit-max");
  const [retouchParams, setRetouchParams] = useState<Record<string, unknown>>({});
  const [retouchAdvancedOpen, setRetouchAdvancedOpen] = useState(false);
  const [retouchPrompt, setRetouchPrompt] = useState("");
  const [retouchImage, setRetouchImage] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState(32);
  const [transparentMask, setTransparentMask] = useState(true);
  const maskRef = useRef<ImageMaskCanvasHandle>(null);
  const retouchFileRef = useRef<HTMLInputElement>(null);

  const [editorModel, setEditorModel] = useState("doubao-seedream-5-0-260128");
  const [editorPrompt, setEditorPrompt] = useState("");
  const [editorImages, setEditorImages] = useState<string[]>([]);
  const [editorParams, setEditorParams] = useState<Record<string, unknown>>({
    size: "2K",
    watermark: false,
    stream: false,
  });
  const [editorAdvancedOpen, setEditorAdvancedOpen] = useState(false);
  const [editorAspect, setEditorAspect] = useState<string>("1:1");
  const editorFileRef = useRef<HTMLInputElement>(null);

  const [enhancerModel, setEnhancerModel] = useState("qwen-image-edit-max");
  const [enhancerStyle, setEnhancerStyle] = useState("standard");
  const [enhancerParams, setEnhancerParams] = useState<Record<string, unknown>>({});
  const [enhancerAdvancedOpen, setEnhancerAdvancedOpen] = useState(false);
  const [enhancerImage, setEnhancerImage] = useState<string | null>(null);
  const enhancerFileRef = useRef<HTMLInputElement>(null);

  const [restoreDefaultModel, setRestoreDefaultModel] = useState("qwen-image-edit-max");
  const [faceSwapDefaultModel, setFaceSwapDefaultModel] = useState("qwen-image-edit-max");
  const [deblurDefaultModel, setDeblurDefaultModel] = useState("qwen-image-edit");
  const [cameraAngleDefaultModel, setCameraAngleDefaultModel] = useState("qwen-image-edit");
  const [posterDefaultModel, setPosterDefaultModel] = useState("doubao-seedream-5-0-lite");
  const [memeDefaultModel, setMemeDefaultModel] = useState("doubao-seedream-5-0-lite");
  const [avatarDefaultModel, setAvatarDefaultModel] = useState("doubao-seedream-5-0-lite");
  const [gifDefaultModel, setGifDefaultModel] = useState("doubao-seedream-5-0-lite");
  const [realisticDefaultModel, setRealisticDefaultModel] = useState(
    "doubao-seedream-5-0-lite",
  );
  const [imageGeneratorDefaultModel, setImageGeneratorDefaultModel] = useState(
    "doubao-seedream-5-0-lite",
  );

  const [outpaintModel, setOutpaintModel] = useState(OUTPAINT_MODEL_KEY);
  const [outpaintParams, setOutpaintParams] = useState<Record<string, unknown>>({
    expand_mode: "scale",
    x_scale: 1.5,
    y_scale: 1.5,
    output_ratio: "4:3",
    angle: "0",
    limit_image_size: true,
  });
  const [outpaintPrompt, setOutpaintPrompt] = useState("");
  const [outpaintAdvancedOpen, setOutpaintAdvancedOpen] = useState(false);
  const [outpaintImage, setOutpaintImage] = useState<string | null>(null);
  const outpaintFileRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const panel =
    activeTag === "ai-image-editor"
      ? "editor"
      : activeTag === "ai-retouch"
        ? "retouch"
        : activeTag === "ai-image-enhancer"
          ? "enhancer"
          : activeTag === "ai-image-upscaler"
            ? "outpaint"
            : activeTag === "ai-image-restore"
              ? "restore"
              : activeTag === "face-swap"
                ? "face-swap"
                : activeTag === "bg-remover"
                  ? "bg-remover"
                : activeTag === "object-remover"
                  ? "object-remover"
                  : activeTag === "ai-deblur"
                    ? "deblur"
                    : activeTag === "ai-camera-angle"
                      ? "camera-angle"
                      : activeTag === "ai-poster-generator"
                        ? "poster"
                        : activeTag === "ai-meme-generator"
                          ? "meme"
                          : activeTag === "ai-avatar-generator"
                            ? "avatar"
                            : activeTag === "ai-gif-generator"
                              ? "gif"
                              : activeTag === "ai-realistic-generator"
                                ? "realistic"
                                : activeTag === "ai-image-generator"
                                  ? "image-generator"
            : "placeholder";

  useEffect(() => {
    fetchImageProcessingModels()
      .then((data) => {
        setModels(data.imageModels);
        setParamProfiles(data.paramProfiles);
        setRetouchModel(data.defaults.retouch);
        setEditorModel(data.defaults.editor || "doubao-seedream-5-0-260128");
        setEnhancerModel(data.defaults.enhancer || "qwen-image-edit-max");
        setOutpaintModel(data.defaults.outpaint || OUTPAINT_MODEL_KEY);
        setRestoreDefaultModel(data.defaults.restore || "qwen-image-edit-max");
        setFaceSwapDefaultModel(data.defaults.faceSwap || "qwen-image-edit-max");
        setDeblurDefaultModel(data.defaults.deblur || "qwen-image-edit");
        setCameraAngleDefaultModel(data.defaults.cameraAngle || "qwen-image-edit");
        setPosterDefaultModel(data.defaults.poster || "doubao-seedream-5-0-lite");
        setMemeDefaultModel(data.defaults.meme || "doubao-seedream-5-0-lite");
        setAvatarDefaultModel(data.defaults.avatar || "doubao-seedream-5-0-lite");
        setGifDefaultModel(data.defaults.gif || "doubao-seedream-5-0-lite");
        setRealisticDefaultModel(
          data.defaults.realistic || "doubao-seedream-5-0-lite",
        );
        setImageGeneratorDefaultModel(
          data.defaults.imageGenerator || "doubao-seedream-5-0-lite",
        );
      })
      .catch((e) => {
        void showAlert({
          title: "模型加载失败",
          message: e instanceof Error ? e.message : "请检查 Gateway 配置",
          variant: "error",
        });
      });
  }, [showAlert]);

  const retouchParamFields = paramProfiles[retouchModel] ?? [];
  const editorParamFields = paramProfiles[editorModel] ?? [];
  const enhancerParamFields = paramProfiles[enhancerModel] ?? [];
  const outpaintParamFields = paramProfiles[outpaintModel] ?? [];

  const retouchModels = useMemo(
    () =>
      models.filter((m) =>
        ["qwen-image-edit", "qwen-image-edit-max", WANX_PAINTING_MODEL_KEY].includes(
          m.modelKey,
        ),
      ),
    [models],
  );

  const enhancerModels = useMemo(
    () => models.filter((m) => isQwenEditModel(m.modelKey)),
    [models],
  );

  const outpaintModels = useMemo(
    () =>
      models.filter((m) =>
        [OUTPAINT_MODEL_KEY, "qwen-image-edit", "qwen-image-edit-max"].includes(
          m.modelKey,
        ),
      ),
    [models],
  );

  const editorModels = useMemo(() => {
    const fromApi = models.filter(
      (m) =>
        isQwenEditModel(m.modelKey) ||
        isSeedreamEditModel(m.modelKey) ||
        isWanI2iModel(m.modelKey),
    );
    if (fromApi.length > 0) return fromApi;
    return EDITOR_MODEL_FALLBACKS.map((m) => ({
      modelKey: m.modelKey,
      displayName: m.displayName,
      credentialBound: true,
    }));
  }, [models]);

  const handleUpload = useCallback(
    async (
      file: File,
      target: "retouch" | "editor" | "enhancer" | "outpaint",
    ) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        await showAlert({
          title: "格式不支持",
          message: "请上传 JPG、PNG 或 WebP 图片",
          variant: "error",
        });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        await showAlert({
          title: "文件过大",
          message: "图片最大 10MB",
          variant: "error",
        });
        return;
      }
      const dataUrl = await readFileAsDataUrl(file);
      if (target === "retouch") setRetouchImage(dataUrl);
      else if (target === "enhancer") setEnhancerImage(dataUrl);
      else if (target === "outpaint") setOutpaintImage(dataUrl);
      else if (supportsMultiImageEditor(editorModel)) {
        const max = maxEditorUploadImages(editorModel);
        setEditorImages((prev) => [...prev, dataUrl].slice(0, max));
      } else {
        setEditorImages([dataUrl]);
      }
    },
    [showAlert, editorModel],
  );

  const buildRetouchParameters = () => {
    const out: Record<string, unknown> = { ...retouchParams };
    if (out.seed === undefined || out.seed === "") delete out.seed;
    if (out.size === "") delete out.size;
    if (out.n) out.n = Number(out.n);
    return out;
  };

  const buildEditorParameters = () => {
    const out: Record<string, unknown> = { ...editorParams };
    if (isQwenEditModel(editorModel)) {
      if (out.seed === undefined || out.seed === "") delete out.seed;
      if (out.size === "") delete out.size;
      if (out.n) out.n = Number(out.n);
      return out;
    }
    if (isWanI2iModel(editorModel)) {
      if (out.seed === undefined || out.seed === "") delete out.seed;
      if (out.size === "") delete out.size;
      if (out.n) out.n = Number(out.n);
      return out;
    }
    if (editorAspect !== "1:1") {
      const aspectSize = SEEDREAM_ASPECT_TO_SIZE[editorAspect];
      if (aspectSize) out.size = aspectSize;
    } else if (!out.size) {
      out.size = "2K";
    }
    if (out.seed === undefined || out.seed === "") delete out.seed;
    return out;
  };

  const buildOutpaintParameters = () => {
    const out: Record<string, unknown> = { ...outpaintParams };
    if (out.left_offset === "" || out.left_offset === undefined) delete out.left_offset;
    if (out.right_offset === "" || out.right_offset === undefined) delete out.right_offset;
    if (out.top_offset === "" || out.top_offset === undefined) delete out.top_offset;
    if (out.bottom_offset === "" || out.bottom_offset === undefined) delete out.bottom_offset;
    return out;
  };

  const onEditorModelChange = (modelKey: string) => {
    setEditorModel(modelKey);
    setEditorImages([]);
    if (isQwenEditModel(modelKey) || isWanI2iModel(modelKey)) {
      setEditorParams({});
      setEditorAspect("1:1");
      return;
    }
    setEditorParams({
      size: "2K",
      watermark: false,
      stream: false,
    });
    setEditorAspect("1:1");
  };

  const onRetouchModelChange = (modelKey: string) => {
    setRetouchModel(modelKey);
    setRetouchParams({});
  };

  const onRetouchSubmit = async () => {
    if (!retouchImage) {
      await showAlert({ title: "请上传图片", message: "先上传待修图图片", variant: "error" });
      return;
    }
    if (!retouchPrompt.trim()) {
      await showAlert({ title: "请填写描述", message: "说明涂抹区域应替换成什么", variant: "error" });
      return;
    }
    const mask = maskRef.current?.getMaskDataUrl() ?? undefined;
    if (isWanxPaintingModel(retouchModel) && !mask) {
      await showAlert({
        title: "请涂抹区域",
        message: "万相局部重绘需要涂抹蒙版区域",
        variant: "error",
      });
      return;
    }
    setSubmitting(true);
    setResults([]);
    try {
      const res = await submitImageProcessingEdit({
        mode: "retouch",
        model: retouchModel,
        prompt: retouchPrompt.trim(),
        sourceImageDataUrl: retouchImage,
        maskImageDataUrl: mask,
        parameters: buildRetouchParameters(),
      });
      setResults(res.imageUrls);
    } catch (e) {
      await showAlert({
        title: "修图失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onEditorSubmit = async () => {
    if (!editorPrompt.trim()) {
      await showAlert({ title: "请填写描述", message: "说明想要的编辑效果", variant: "error" });
      return;
    }
    if (editorImages.length === 0) {
      await showAlert({ title: "请上传图片", message: "先上传待编辑图片", variant: "error" });
      return;
    }
    setSubmitting(true);
    setResults([]);
    try {
      const body =
        supportsMultiImageEditor(editorModel) && editorImages.length > 0
          ? {
              mode: "editor" as const,
              model: editorModel,
              prompt: editorPrompt.trim(),
              sourceImageDataUrls: editorImages,
              parameters: buildEditorParameters(),
            }
          : {
              mode: "editor" as const,
              model: editorModel,
              prompt: editorPrompt.trim(),
              sourceImageDataUrl: editorImages[0],
              parameters: buildEditorParameters(),
            };
      const res = await submitImageProcessingEdit(body);
      setResults(res.imageUrls);
    } catch (e) {
      await showAlert({
        title: "编辑失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onEnhancerSubmit = async () => {
    if (!enhancerImage) {
      await showAlert({ title: "请上传图片", message: "先上传待增强图片", variant: "error" });
      return;
    }
    setSubmitting(true);
    setResults([]);
    try {
      const res = await submitImageProcessingEdit({
        mode: "enhancer",
        model: enhancerModel,
        enhancerStyle,
        sourceImageDataUrl: enhancerImage,
        parameters: enhancerParams,
      });
      setResults(res.imageUrls);
    } catch (e) {
      await showAlert({
        title: "增强失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onOutpaintSubmit = async () => {
    if (!outpaintImage) {
      await showAlert({ title: "请上传图片", message: "先上传待扩图图片", variant: "error" });
      return;
    }
    if (!isOutpaintBailianModel(outpaintModel) && !outpaintPrompt.trim()) {
      await showAlert({
        title: "请填写描述",
        message: "使用 Qwen 扩图时需描述期望扩展的内容",
        variant: "error",
      });
      return;
    }
    setSubmitting(true);
    setResults([]);
    try {
      const res = await submitImageProcessingEdit({
        mode: "outpaint",
        model: outpaintModel,
        prompt: outpaintPrompt.trim() || undefined,
        sourceImageDataUrl: outpaintImage,
        parameters: buildOutpaintParameters(),
      });
      setResults(res.imageUrls);
    } catch (e) {
      await showAlert({
        title: "扩图失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const visibleTags = IMAGE_PROCESSING_TAGS.slice(0, IMAGE_PROCESSING_TAG_COLLAPSED_COUNT);
  const expandedOnlyTags = IMAGE_PROCESSING_TAGS.slice(IMAGE_PROCESSING_TAG_COLLAPSED_COUNT);

  return (
    <EcomWorkspaceLayout fullWidth>
      <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          {/* 标签栏 */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {visibleTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => {
                  setActiveTag(tag.id);
                  setResults([]);
                }}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors sm:px-3 sm:py-1.5 sm:text-sm",
                  activeTag === tag.id
                    ? "border-[#1d1d1f] bg-[#1d1d1f] text-white"
                    : "border-[#d2d2d7] bg-white text-[#1d1d1f] hover:border-[#86868b]",
                )}
              >
                {tag.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTagsExpanded((v) => !v)}
              className="inline-flex items-center gap-0.5 rounded-full border border-[#d2d2d7] bg-white px-2.5 py-1 text-xs text-[#0071e3] hover:bg-[#f5f5f7] sm:px-3 sm:py-1.5 sm:text-sm"
            >
              {tagsExpanded ? "收起" : "更多"}
              <ChevronRight
                className={cn("h-4 w-4 transition-transform", tagsExpanded && "rotate-90")}
              />
            </button>
          </div>

          {tagsExpanded && expandedOnlyTags.length > 0 ? (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {expandedOnlyTags.map((tag) => (
                <button
                  key={`grid-${tag.id}`}
                  type="button"
                  onClick={() => {
                    setActiveTag(tag.id);
                    setResults([]);
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-center text-sm",
                    activeTag === tag.id
                      ? "border-[#0071e3] bg-[#f0f6ff] text-[#0071e3]"
                      : "border-[#e5e5ea] bg-white text-[#1d1d1f] hover:border-[#d2d2d7]",
                  )}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          ) : null}

          <h1 className="mt-6 text-2xl font-bold tracking-tight text-[#1d1d1f] sm:mt-8 sm:text-3xl">
            {imageProcessingPageTitle(activeTag)}
          </h1>

          {panel === "placeholder" ? (
            <div className="mt-6 rounded-2xl border border-dashed border-[#d2d2d7] bg-white p-8 text-center sm:mt-8 sm:p-12">
              <Wand2 className="mx-auto h-10 w-10 text-[#86868b]" />
              <p className="mt-4 text-lg font-medium text-[#1d1d1f]">即将上线</p>
              <p className="mt-2 text-sm text-[#6e6e73]">
                「{IMAGE_PROCESSING_TAGS.find((t) => t.id === activeTag)?.label}」功能开发中
              </p>
              <button
                type="button"
                className="mt-6 text-sm text-[#0071e3] hover:underline"
                onClick={() => setActiveTag("ai-retouch")}
              >
                返回 AI 修图
              </button>
            </div>
          ) : panel === "retouch" ? (
            <div className="mt-6 space-y-4 sm:mt-8 sm:space-y-6">
              <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-3 text-sm text-[#1d1d1f] sm:px-4">
                <span className="mr-2 inline-flex align-middle text-sky-600">
                  <Pencil className="h-4 w-4" />
                </span>
                用画笔涂抹你想修改的区域——比如瑕疵、背景物体、污渍、标志等等——然后描述该区域应该显示什么内容。图像的其余部分保持不变。
              </div>

              <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-sm sm:p-6">
                {!retouchImage ? (
                  <button
                    type="button"
                    onClick={() => retouchFileRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d2d2d7] px-4 py-12 text-center transition-colors hover:border-[#0071e3] hover:bg-[#fafafa] sm:px-6 sm:py-16"
                  >
                    <Pencil className="h-8 w-8 text-[#86868b]" />
                    <p className="mt-3 font-medium text-[#1d1d1f]">上传图片进行修图</p>
                    <p className="mt-1 text-xs text-[#6e6e73]">JPG、PNG、WebP 格式，最大 10MB</p>
                  </button>
                ) : (
                  <>
                    <MaskToolbar
                      brushSize={brushSize}
                      onBrushSizeChange={setBrushSize}
                      showTransparentMask={transparentMask}
                      onToggleTransparentMask={() => setTransparentMask((v) => !v)}
                      onClearImage={() => setRetouchImage(null)}
                    />
                    <ImageMaskCanvas
                      ref={maskRef}
                      imageDataUrl={retouchImage}
                      brushSize={brushSize}
                      showTransparentMask={transparentMask}
                    />
                  </>
                )}
                <input
                  ref={retouchFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUpload(f, "retouch");
                    e.target.value = "";
                  }}
                />

                <label className="mt-6 block text-sm font-medium text-[#1d1d1f]">
                  请描述一下应该用什么来替换涂漆区域。
                  <textarea
                    value={retouchPrompt}
                    onChange={(e) => setRetouchPrompt(e.target.value)}
                    rows={3}
                    placeholder="例如，去除皮肤纹理、移除标志、用草地代替汽车。"
                    className="mt-2 w-full resize-y rounded-xl border border-[#d2d2d7] px-4 py-3 text-sm"
                  />
                </label>

                <div className="mt-4">
                  <label className="text-sm font-medium text-[#1d1d1f]">模型</label>
                  <select
                    value={retouchModel}
                    onChange={(e) => onRetouchModelChange(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
                  >
                    {retouchModels.map((m) => (
                      <option key={m.modelKey} value={m.modelKey}>
                        {m.displayName || m.modelKey}
                        {!m.credentialBound ? "（未绑定凭证）" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setRetouchAdvancedOpen((v) => !v)}
                  className="mt-3 inline-flex items-center gap-1 text-sm text-[#0071e3]"
                >
                  {retouchAdvancedOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  高级选项
                </button>
                {retouchAdvancedOpen && retouchParamFields.length > 0 ? (
                  <div className="mt-3 rounded-xl border border-[#e5e5ea] bg-[#fafafa] p-4">
                    <ParamFields
                      fields={retouchParamFields}
                      values={retouchParams}
                      onChange={(name, value) =>
                        setRetouchParams((prev) => ({ ...prev, [name]: value }))
                      }
                    />
                  </div>
                ) : null}

                <div className="mt-6 flex flex-col gap-3 border-t border-[#e5e5ea] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs text-[#6e6e73]">经 Gateway 调用百炼图像编辑</span>
                  <ImageProcessingCtaButton
                    disabled={submitting}
                    onClick={() => void onRetouchSubmit()}
                    className="w-full sm:w-auto sm:min-w-[120px]"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Pencil className="h-4 w-4" />
                    )}
                    修图
                  </ImageProcessingCtaButton>
                </div>
              </div>
              <HowToUse variant="retouch" />
            </div>
          ) : panel === "enhancer" ? (
            <div className="mt-6 space-y-4 sm:mt-8 sm:space-y-6">
              <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-3 text-sm leading-relaxed text-[#1d1d1f] sm:px-4">
                <span className="mr-2 inline-flex align-middle text-sky-600">
                  <Sparkles className="h-4 w-4" />
                </span>
                无需改变分辨率即可提升图像质量——降噪、锐化、恢复色彩。非常适合处理光线昏暗的照片、扫描照片、JPEG 压缩导出图像以及略显模糊的 AI 生成图。
              </div>

              <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-sm sm:p-6">
                <button
                  type="button"
                  onClick={() => enhancerFileRef.current?.click()}
                  className={cn(
                    "flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors sm:px-6 sm:py-12",
                    enhancerImage
                      ? "border-[#e5e5ea] py-6"
                      : "border-violet-300 hover:border-violet-500 hover:bg-violet-50/30",
                  )}
                >
                  {enhancerImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={enhancerImage}
                      alt="待增强"
                      className="max-h-64 rounded-lg object-contain"
                    />
                  ) : (
                    <>
                      <Sparkles className="h-10 w-10 text-violet-500" />
                      <p className="mt-3 font-medium">将图片拖放到此处 或点击浏览</p>
                      <p className="mt-1 text-xs text-[#6e6e73]">JPG、PNG、WebP，最大 10MB</p>
                    </>
                  )}
                </button>
                <input
                  ref={enhancerFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUpload(f, "enhancer");
                    e.target.value = "";
                  }}
                />

                <div className="mt-6">
                  <label className="text-sm font-medium text-[#1d1d1f]">增强型模型</label>
                  <select
                    value={enhancerStyle}
                    onChange={(e) => setEnhancerStyle(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
                  >
                    {ENHANCER_STYLE_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-[#6e6e73]">
                    标准模式经 Gateway 调用百炼 Qwen，保持原始分辨率进行质量提升。
                  </p>
                </div>

                <div className="mt-4">
                  <label className="text-sm font-medium text-[#1d1d1f]">增强模型</label>
                  <select
                    value={enhancerModel}
                    onChange={(e) => {
                      setEnhancerModel(e.target.value);
                      setEnhancerParams({});
                    }}
                    className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
                  >
                    {(enhancerModels.length > 0
                      ? enhancerModels
                      : [
                          { modelKey: "qwen-image-edit", displayName: "Qwen 图像编辑", credentialBound: true },
                          { modelKey: "qwen-image-edit-max", displayName: "Qwen 图像编辑 Max", credentialBound: true },
                        ]
                    ).map((m) => (
                      <option key={m.modelKey} value={m.modelKey}>
                        {m.displayName || m.modelKey}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-[#6e6e73]">
                    经 Gateway 调用百炼 Qwen 图像编辑，保持原始分辨率进行质量提升。
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setEnhancerAdvancedOpen((v) => !v)}
                  className="mt-4 inline-flex items-center gap-1 text-sm text-[#0071e3]"
                >
                  {enhancerAdvancedOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  高级选项
                </button>
                {enhancerAdvancedOpen ? (
                  <div className="mt-3 rounded-xl border border-[#e5e5ea] bg-[#fafafa] p-4">
                    <label className="block text-sm">
                      <span className="mb-1 block text-[#1d1d1f]">
                        负面提示（应避免的情况）
                      </span>
                      <input
                        type="text"
                        placeholder={DEFAULT_NEGATIVE_PROMPT_PLACEHOLDER}
                        value={String(enhancerParams.negative_prompt ?? "")}
                        onChange={(e) =>
                          setEnhancerParams((prev) => ({
                            ...prev,
                            negative_prompt: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-[#d2d2d7] px-3 py-2 text-sm"
                      />
                    </label>
                    {enhancerParamFields.filter((f) => f.name !== "negative_prompt").length >
                    0 ? (
                      <div className="mt-4">
                        <ParamFields
                          fields={enhancerParamFields.filter(
                            (f) => f.name !== "negative_prompt",
                          )}
                          values={enhancerParams}
                          onChange={(name, value) =>
                            setEnhancerParams((prev) => ({ ...prev, [name]: value }))
                          }
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-6 flex flex-col gap-3 border-t border-[#e5e5ea] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs text-[#6e6e73]">上传图片即可查看处理结果</span>
                  <ImageProcessingCtaButton
                    disabled={submitting}
                    onClick={() => void onEnhancerSubmit()}
                    className="w-full sm:w-auto sm:min-w-[140px]"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    增强图像
                  </ImageProcessingCtaButton>
                </div>
              </div>
              <ImageEnhancerGuideSections />
            </div>
          ) : panel === "outpaint" ? (
            <div className="mt-6 space-y-4 sm:mt-8 sm:space-y-6">
              <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-3 text-sm leading-relaxed text-[#1d1d1f] sm:px-4">
                <span className="mr-2 inline-flex align-middle text-sky-600">
                  <Expand className="h-4 w-4" />
                </span>
                智能扩展画面边界，为图片补充背景与上下文。经 Gateway 调用百炼 image-out-painting，支持等比例、定向与旋转扩图。
              </div>

              <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-sm sm:p-6">
                <button
                  type="button"
                  onClick={() => outpaintFileRef.current?.click()}
                  className={cn(
                    "flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors sm:px-6 sm:py-12",
                    outpaintImage
                      ? "border-[#e5e5ea] py-6"
                      : "border-violet-300 hover:border-violet-500 hover:bg-violet-50/30",
                  )}
                >
                  {outpaintImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={outpaintImage}
                      alt="待扩图"
                      className="max-h-64 rounded-lg object-contain"
                    />
                  ) : (
                    <>
                      <Expand className="h-10 w-10 text-violet-500" />
                      <p className="mt-3 font-medium">将图片拖放到此处 或点击浏览</p>
                      <p className="mt-1 text-xs text-[#6e6e73]">JPG、PNG、WebP，最大 10MB</p>
                    </>
                  )}
                </button>
                <input
                  ref={outpaintFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUpload(f, "outpaint");
                    e.target.value = "";
                  }}
                />

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-[#1d1d1f]">扩图模型</label>
                    <select
                      value={outpaintModel}
                      onChange={(e) => {
                        setOutpaintModel(e.target.value);
                        setOutpaintParams((prev) => ({
                          ...prev,
                          expand_mode: isOutpaintBailianModel(e.target.value)
                            ? prev.expand_mode ?? "scale"
                            : undefined,
                        }));
                      }}
                      className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
                    >
                      {(outpaintModels.length > 0
                        ? outpaintModels
                        : [
                            { modelKey: OUTPAINT_MODEL_KEY, displayName: "百炼 · 图像画面扩展", credentialBound: true },
                            { modelKey: "qwen-image-edit", displayName: "Qwen 图像编辑", credentialBound: true },
                            { modelKey: "qwen-image-edit-max", displayName: "Qwen 图像编辑 Max", credentialBound: true },
                          ]
                      ).map((m) => (
                        <option key={m.modelKey} value={m.modelKey}>
                          {m.displayName || m.modelKey}
                        </option>
                      ))}
                    </select>
                  </div>
                  {isOutpaintBailianModel(outpaintModel) ? (
                    <div>
                      <label className="text-sm font-medium text-[#1d1d1f]">扩图方式</label>
                      <select
                        value={String(outpaintParams.expand_mode ?? "scale")}
                        onChange={(e) =>
                          setOutpaintParams((prev) => ({
                            ...prev,
                            expand_mode: e.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
                      >
                        <option value="scale">等比例扩展</option>
                        <option value="ratio">指定宽高比</option>
                        <option value="offset">四向添加像素</option>
                        <option value="rotate">旋转后扩展</option>
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="text-sm font-medium text-[#1d1d1f]">扩图描述（可选）</label>
                      <input
                        type="text"
                        value={outpaintPrompt}
                        onChange={(e) => setOutpaintPrompt(e.target.value)}
                        placeholder="描述希望扩展出的背景内容"
                        className="mt-1 w-full rounded-lg border border-[#d2d2d7] px-3 py-2.5 text-sm"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setOutpaintAdvancedOpen((v) => !v)}
                  className="mt-4 inline-flex items-center gap-1 text-sm text-[#0071e3]"
                >
                  {outpaintAdvancedOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  高级选项
                </button>
                {outpaintAdvancedOpen && outpaintParamFields.length > 0 ? (
                  <div className="mt-3 rounded-xl border border-[#e5e5ea] bg-[#fafafa] p-4">
                    <ParamFields
                      fields={outpaintParamFields}
                      values={outpaintParams}
                      onChange={(name, value) =>
                        setOutpaintParams((prev) => ({ ...prev, [name]: value }))
                      }
                    />
                  </div>
                ) : null}

                <div className="mt-6 flex flex-col gap-3 border-t border-[#e5e5ea] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs text-[#6e6e73]">上传图片即可查看扩图结果</span>
                  <ImageProcessingCtaButton
                    disabled={submitting}
                    onClick={() => void onOutpaintSubmit()}
                    className="w-full sm:w-auto sm:min-w-[120px]"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Expand className="h-4 w-4" />
                    )}
                    扩图
                  </ImageProcessingCtaButton>
                </div>
              </div>
              <ImageOutpaintGuideSections />
            </div>
          ) : panel === "restore" ? (
            <ImageRestorePanel
              models={models}
              paramProfiles={paramProfiles}
              defaultModel={restoreDefaultModel}
              submitting={submitting}
              setSubmitting={setSubmitting}
              onResults={setResults}
              onError={(title, message) => void showAlert({ title, message, variant: "error" })}
              CtaButton={ImageProcessingCtaButton}
              ParamFields={ParamFields}
            />
          ) : panel === "face-swap" ? (
            <ImageFaceSwapPanel
              models={models}
              paramProfiles={paramProfiles}
              defaultModel={faceSwapDefaultModel}
              submitting={submitting}
              setSubmitting={setSubmitting}
              onResults={setResults}
              onError={(title, message) => void showAlert({ title, message, variant: "error" })}
              CtaButton={ImageProcessingCtaButton}
              ParamFields={ParamFields}
            />
          ) : panel === "bg-remover" ? (
            <ImageBgRemoverPanel
              submitting={submitting}
              setSubmitting={setSubmitting}
              onResults={setResults}
              onError={(title, message) => void showAlert({ title, message, variant: "error" })}
              CtaButton={ImageProcessingCtaButton}
            />
          ) : panel === "object-remover" ? (
            <ImageObjectRemoverPanel
              submitting={submitting}
              setSubmitting={setSubmitting}
              onResults={setResults}
              onError={(title, message) => void showAlert({ title, message, variant: "error" })}
              CtaButton={ImageProcessingCtaButton}
            />
          ) : panel === "deblur" ? (
            <ImageDeblurPanel
              defaultModel={deblurDefaultModel}
              submitting={submitting}
              setSubmitting={setSubmitting}
              onResults={setResults}
              onError={(title, message) => void showAlert({ title, message, variant: "error" })}
              CtaButton={ImageProcessingCtaButton}
            />
          ) : panel === "camera-angle" ? (
            <ImageCameraAnglePanel
              defaultModel={cameraAngleDefaultModel}
              submitting={submitting}
              setSubmitting={setSubmitting}
              onResults={setResults}
              onError={(title, message) => void showAlert({ title, message, variant: "error" })}
              CtaButton={ImageProcessingCtaButton}
            />
          ) : panel === "poster" ? (
            <ImagePosterPanel
              defaultModel={posterDefaultModel}
              submitting={submitting}
              setSubmitting={setSubmitting}
              onResults={setResults}
              onError={(title, message) => void showAlert({ title, message, variant: "error" })}
              CtaButton={ImageProcessingCtaButton}
            />
          ) : panel === "meme" ? (
            <ImageMemePanel
              defaultModel={memeDefaultModel}
              submitting={submitting}
              setSubmitting={setSubmitting}
              onResults={setResults}
              onError={(title, message) => void showAlert({ title, message, variant: "error" })}
              CtaButton={ImageProcessingCtaButton}
            />
          ) : panel === "avatar" ? (
            <ImageAvatarPanel
              defaultModel={avatarDefaultModel}
              submitting={submitting}
              setSubmitting={setSubmitting}
              onResults={setResults}
              onError={(title, message) => void showAlert({ title, message, variant: "error" })}
              CtaButton={ImageProcessingCtaButton}
            />
          ) : panel === "gif" ? (
            <ImageGifPanel
              defaultModel={gifDefaultModel}
              submitting={submitting}
              setSubmitting={setSubmitting}
              onResults={setResults}
              onError={(title, message) => void showAlert({ title, message, variant: "error" })}
              CtaButton={ImageProcessingCtaButton}
            />
          ) : panel === "realistic" ? (
            <ImageRealisticPanel
              defaultModel={realisticDefaultModel}
              submitting={submitting}
              setSubmitting={setSubmitting}
              onResults={setResults}
              onError={(title, message) => void showAlert({ title, message, variant: "error" })}
              CtaButton={ImageProcessingCtaButton}
            />
          ) : panel === "image-generator" ? (
            <ImageGeneratorPanel
              defaultModel={imageGeneratorDefaultModel}
              submitting={submitting}
              setSubmitting={setSubmitting}
              onResults={setResults}
              onError={(title, message) => void showAlert({ title, message, variant: "error" })}
              CtaButton={ImageProcessingCtaButton}
            />
          ) : (
            <div className="mt-6 space-y-4 sm:mt-8 sm:space-y-6">
              <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-3 text-sm leading-relaxed text-[#1d1d1f] sm:px-4">
                上传任意图片，并用简单的英语描述编辑需求——例如「把日落的天空变成橙色」、「把她的衬衫换成藏青色」、「在人物旁边加一只金毛犬」。
              </div>

              <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-sm sm:p-6">
                {supportsMultiImageEditor(editorModel) ? (
                  <ImageMultiUpload
                    images={editorImages}
                    onChange={setEditorImages}
                    max={maxEditorUploadImages(editorModel)}
                    emptyLabel="将图片拖拽到此处 或点击浏览"
                  />
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => editorFileRef.current?.click()}
                      className={cn(
                        "flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors sm:px-6 sm:py-12",
                        editorImages[0]
                          ? "border-[#e5e5ea] py-6"
                          : "border-violet-300 hover:border-violet-500 hover:bg-violet-50/30",
                      )}
                    >
                      {editorImages[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={editorImages[0]}
                          alt="待编辑"
                          className="max-h-64 rounded-lg object-contain"
                        />
                      ) : (
                        <>
                          <CloudUpload className="h-10 w-10 text-violet-500" />
                          <p className="mt-3 font-medium">将图片拖放到此处 或点击浏览</p>
                          <p className="mt-1 text-xs text-[#6e6e73]">JPG、PNG、WebP，最大 10MB</p>
                        </>
                      )}
                    </button>
                    <input
                      ref={editorFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleUpload(f, "editor");
                        e.target.value = "";
                      }}
                    />
                  </>
                )}
                {supportsMultiImageEditor(editorModel) ? (
                  <input
                    ref={editorFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUpload(f, "editor");
                      e.target.value = "";
                    }}
                  />
                ) : null}

                <label className="mt-6 block text-sm font-medium text-[#1d1d1f]">
                  请输入您想要进行的修改。
                  <textarea
                    value={editorPrompt}
                    onChange={(e) => setEditorPrompt(e.target.value)}
                    rows={4}
                    placeholder="比如，把她的衬衫换成藏青色。加上白色项链。背景要像，让它看起来像一幅油画……"
                    className="mt-2 w-full resize-y rounded-xl border border-[#d2d2d7] px-4 py-3 text-sm placeholder:text-[#86868b]"
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {EDITOR_QUICK_PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEditorPrompt(p)}
                      className="rounded-full border border-[#e5e5ea] bg-[#f5f5f7] px-3 py-1 text-xs text-[#1d1d1f] hover:border-[#d2d2d7]"
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <div className="mt-4">
                  <label className="text-sm font-medium text-[#1d1d1f]">模型</label>
                  <select
                    value={editorModel}
                    onChange={(e) => onEditorModelChange(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
                  >
                    {editorModels.map((m) => (
                      <option key={m.modelKey} value={m.modelKey}>
                        {m.displayName || m.modelKey}
                        {"credentialBound" in m && !m.credentialBound ? "（未绑定凭证）" : ""}
                      </option>
                    ))}
                  </select>
                  {isQwenEditMaxModel(editorModel) ? (
                    <p className="mt-1 text-xs text-[#0071e3]">
                      Qwen 图像编辑 Max 支持最多上传 6 张参考图，可一次添加多张图片进行融合编辑。
                    </p>
                  ) : supportsQwenMultiImage(editorModel) ? (
                    <p className="mt-1 text-xs text-[#0071e3]">
                      Qwen 图像编辑支持最多上传 3 张参考图，可一次添加多张图片进行融合编辑。
                    </p>
                  ) : supportsMultiImageEditor(editorModel) ? (
                    <p className="mt-1 text-xs text-[#6e6e73]">
                      当前模型支持最多 3 张参考图上传。
                    </p>
                  ) : null}
                </div>

                {isSeedreamEditModel(editorModel) ? (
                <div className="mt-5">
                  <p className="text-sm font-medium text-[#1d1d1f]">长宽比</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ASPECT_OPTIONS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setEditorAspect(a)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-xs font-medium",
                          editorAspect === a
                            ? "border-[#0071e3] bg-[#f0f6ff] text-[#0071e3]"
                            : "border-[#e5e5ea] text-[#1d1d1f]",
                        )}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => setEditorAdvancedOpen((v) => !v)}
                  className="mt-4 inline-flex items-center gap-1 text-sm text-[#0071e3]"
                >
                  {editorAdvancedOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  高级选项
                </button>
                {editorAdvancedOpen && editorParamFields.length > 0 ? (
                  <div className="mt-3 rounded-xl border border-[#e5e5ea] bg-[#fafafa] p-4">
                    <ParamFields
                      fields={editorParamFields}
                      values={editorParams}
                      onChange={(name, value) =>
                        setEditorParams((prev) => ({ ...prev, [name]: value }))
                      }
                    />
                  </div>
                ) : null}

                <div className="mt-6 flex justify-stretch border-t border-[#e5e5ea] bg-white pt-4 sm:justify-end">
                  <ImageProcessingCtaButton
                    variant="blue"
                    disabled={submitting}
                    onClick={() => void onEditorSubmit()}
                    className="w-full sm:w-auto sm:min-w-[140px]"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4" />
                    )}
                    编辑图像
                  </ImageProcessingCtaButton>
                </div>
              </div>
              <HowToUse variant="editor" />
            </div>
          )}

          {results.length > 0 ? (
            <section className="mt-6 rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:mt-8 sm:p-6">
              <h3 className="text-lg font-semibold text-[#1d1d1f]">生成结果</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {results.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-xl border border-[#e5e5ea]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="结果" className="h-auto w-full" />
                  </a>
                ))}
              </div>
            </section>
          ) : null}
      </div>
    </EcomWorkspaceLayout>
  );
}
