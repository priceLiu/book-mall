"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  ShieldAlert,
  User,
  Users,
} from "lucide-react";

import {
  submitImageProcessingEdit,
  type ImageProcessingGatewayModel,
  type ImageProcessingParamField,
} from "@/lib/ecom-image-processing-api";
import {
  FACE_SWAP_ALGORITHM_OPTIONS,
  FACE_SWAP_BLEND_OPTIONS,
  FACE_SWAP_POST_OPTIONS,
} from "@/lib/image-processing-presets";
import { cn } from "@/lib/utils";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

export function ImageFaceSwapPanel({
  models,
  paramProfiles,
  defaultModel,
  submitting,
  setSubmitting,
  onResults,
  onError,
  CtaButton,
  ParamFields,
}: {
  models: ImageProcessingGatewayModel[];
  paramProfiles: Record<string, ImageProcessingParamField[]>;
  defaultModel: string;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  onResults: (urls: string[]) => void;
  onError: (title: string, message: string) => void;
  CtaButton: React.ComponentType<{
    children: React.ReactNode;
    disabled?: boolean;
    onClick?: () => void;
    className?: string;
  }>;
  ParamFields: React.ComponentType<{
    fields: ImageProcessingParamField[];
    values: Record<string, unknown>;
    onChange: (name: string, value: unknown) => void;
  }>;
}) {
  const sourceRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<HTMLInputElement>(null);
  const [sourceFace, setSourceFace] = useState<string | null>(null);
  const [targetImage, setTargetImage] = useState<string | null>(null);
  const [model, setModel] = useState(defaultModel);
  const [blendMode, setBlendMode] = useState("natural");
  const [postProcess, setPostProcess] = useState("auto-beauty");
  const [algorithm, setAlgorithm] = useState("standard");
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    setModel(defaultModel);
  }, [defaultModel]);

  const swapModels = useMemo(
    () =>
      models.filter((m) =>
        ["qwen-image-edit", "qwen-image-edit-max", "doubao-seedream-5-0-lite"].includes(
          m.modelKey,
        ),
      ),
    [models],
  );

  const paramFields = paramProfiles[model] ?? [];

  const onUpload = async (file: File, target: "source" | "target") => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      onError("格式不支持", "请上传 JPG、PNG 或 WebP 图片");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      onError("文件过大", "图片最大 10MB");
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    if (target === "source") setSourceFace(dataUrl);
    else setTargetImage(dataUrl);
  };

  const onSubmit = async () => {
    if (!sourceFace || !targetImage) {
      onError("请上传图片", "需要源脸照片与目标图片");
      return;
    }
    setSubmitting(true);
    onResults([]);
    try {
      const res = await submitImageProcessingEdit({
        mode: "face-swap",
        model,
        sourceFaceDataUrl: sourceFace,
        targetImageDataUrl: targetImage,
        blendMode,
        postProcess,
        algorithm,
        parameters: params,
      });
      onResults(res.imageUrls);
    } catch (e) {
      onError("换脸失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-6 space-y-4 sm:mt-8 sm:space-y-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-3 text-sm text-[#1d1d1f] sm:px-4">
        <span className="mr-2 inline-flex align-middle text-amber-600">
          <AlertTriangle className="h-4 w-4" />
        </span>
        仅上传本人或已获明确授权的照片。未经同意的换脸可能违反服务条款与相关法律。
      </div>

      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-sm sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-[#1d1d1f]">源脸 — 要使用的脸</p>
            <button
              type="button"
              onClick={() => sourceRef.current?.click()}
              className={cn(
                "flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center",
                sourceFace ? "border-[#e5e5ea] py-4" : "border-violet-300 hover:bg-violet-50/30",
              )}
            >
              {sourceFace ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sourceFace} alt="源脸" className="max-h-40 rounded-lg object-contain" />
              ) : (
                <>
                  <User className="h-8 w-8 text-violet-500" />
                  <p className="mt-2 text-sm">你的正面照片</p>
                  <p className="mt-1 text-xs text-[#6e6e73]">JPG、PNG、WebP，最大 10MB</p>
                </>
              )}
            </button>
            <input
              ref={sourceRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUpload(f, "source");
                e.target.value = "";
              }}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-[#1d1d1f]">目标图 — 要替换的脸</p>
            <button
              type="button"
              onClick={() => targetRef.current?.click()}
              className={cn(
                "flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center",
                targetImage ? "border-[#e5e5ea] py-4" : "border-violet-300 hover:bg-violet-50/30",
              )}
            >
              {targetImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={targetImage} alt="目标图" className="max-h-40 rounded-lg object-contain" />
              ) : (
                <>
                  <Users className="h-8 w-8 text-violet-500" />
                  <p className="mt-2 text-sm">用人脸替换的照片</p>
                  <p className="mt-1 text-xs text-[#6e6e73]">JPG、PNG、WebP，最大 10MB</p>
                </>
              )}
            </button>
            <input
              ref={targetRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUpload(f, "target");
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-medium text-[#1d1d1f]">混合模式</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {FACE_SWAP_BLEND_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setBlendMode(o.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium",
                  blendMode === o.id
                    ? "border-[#0071e3] bg-[#f0f6ff] text-[#0071e3]"
                    : "border-[#e5e5ea] text-[#1d1d1f]",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">后期处理</label>
            <select
              value={postProcess}
              onChange={(e) => setPostProcess(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
            >
              {FACE_SWAP_POST_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">模型</label>
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
            >
              {FACE_SWAP_ALGORITHM_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-[#e5e5ea] bg-[#fafafa] p-4">
          <label className="text-sm font-medium text-[#1d1d1f]">模型</label>
          <select
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setParams({});
            }}
            className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
          >
            {swapModels.map((m) => (
              <option key={m.modelKey} value={m.modelKey}>
                {m.displayName || m.modelKey}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[#6e6e73]">支持 Qwen 图像编辑 / Max、Seedream 5.0 Lite</p>
        </div>

        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="mt-4 inline-flex items-center gap-1 text-sm text-[#0071e3]"
        >
          {advancedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          高级选项
        </button>
        {advancedOpen && paramFields.length > 0 ? (
          <div className="mt-3 rounded-xl border border-[#e5e5ea] bg-[#fafafa] p-4">
            <ParamFields fields={paramFields} values={params} onChange={(n, v) => setParams((p) => ({ ...p, [n]: v }))} />
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 border-t border-[#e5e5ea] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-[#6e6e73]">经 Gateway 调用图像编辑模型完成换脸</span>
          <CtaButton disabled={submitting} onClick={() => void onSubmit()} className="w-full sm:w-auto sm:min-w-[120px]">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            交换脸
          </CtaButton>
        </div>
      </div>

      <section className="rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-[#1d1d1f]">负责任地使用 AI 换脸技术</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: "角色扮演自拍", desc: "万圣节造型、历史人物或幻想角色（需本人授权）。" },
            { title: "生日惊喜卡片", desc: "为朋友制作趣味海报（需对方同意）。" },
            { title: "试镜与造型", desc: "测试不同时代妆造与服装风格。" },
            { title: "概念艺术", desc: "D&D 肖像、头像或漫画页。" },
            {
              icon: ShieldAlert,
              title: "请勿用于",
              desc: "成人/骚扰/虚假新闻或身份盗用内容。",
            },
            { title: "了解当地法律", desc: "未经同意的深度伪造在多地属于违法行为。" },
          ].map((c) => (
            <div key={c.title} className="rounded-xl border border-[#e5e5ea] bg-[#fafafa] p-4">
              {c.icon ? <c.icon className="mb-2 h-5 w-5 text-rose-600" /> : null}
              <p className="font-medium text-[#1d1d1f]">{c.title}</p>
              <p className="mt-1 text-sm text-[#6e6e73]">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
