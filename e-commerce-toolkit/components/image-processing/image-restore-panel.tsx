"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Shield,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react";

import {
  submitImageProcessingEdit,
  type ImageProcessingGatewayModel,
  type ImageProcessingParamField,
} from "@/lib/ecom-image-processing-api";
import {
  RESTORE_REPAIR_OPTIONS,
  RESTORE_UPSCALE_OPTIONS,
} from "@/lib/image-processing-presets";
import { ipStepNumberClass } from "@/lib/image-processing-theme";
import { cn } from "@/lib/utils";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

function filterModels(
  models: ImageProcessingGatewayModel[],
  keys: readonly string[],
) {
  const allowed = new Set(keys);
  return models.filter((m) => allowed.has(m.modelKey));
}

export function ImageRestorePanel({
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [model, setModel] = useState(defaultModel);
  const [repairType, setRepairType] = useState("auto");
  const [upscaleFactor, setUpscaleFactor] = useState("1");
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    setModel(defaultModel);
  }, [defaultModel]);

  const restoreModels = useMemo(
    () =>
      filterModels(models, [
        "qwen-image-edit",
        "qwen-image-edit-max",
        "doubao-seedream-5-0-lite",
      ]),
    [models],
  );

  const paramFields = paramProfiles[model] ?? [];

  const onUpload = async (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      onError("格式不支持", "请上传 JPG、PNG 或 WebP 图片");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      onError("文件过大", "图片最大 10MB");
      return;
    }
    setImage(await readFileAsDataUrl(file));
  };

  const onSubmit = async () => {
    if (!image) {
      onError("请上传图片", "先上传待修复图片");
      return;
    }
    setSubmitting(true);
    onResults([]);
    try {
      const res = await submitImageProcessingEdit({
        mode: "restore",
        model,
        sourceImageDataUrl: image,
        repairType,
        upscaleFactor,
        parameters: params,
      });
      onResults(res.imageUrls);
    } catch (e) {
      onError("修复失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-6 space-y-4 sm:mt-8 sm:space-y-6">
      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-sm sm:p-6">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={cn(
            "flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors sm:py-12",
            image
              ? "border-[#e5e5ea] py-6"
              : "border-violet-300 hover:border-violet-500 hover:bg-violet-50/30",
          )}
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="待修复" className="max-h-64 rounded-lg object-contain" />
          ) : (
            <>
              <Wand2 className="h-10 w-10 text-violet-500" />
              <p className="mt-3 font-medium">上传损坏、质量下降或低质量的图像进行修复</p>
              <p className="mt-1 text-xs text-[#6e6e73]">JPG、PNG、WebP，最大 10MB</p>
            </>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onUpload(f);
            e.target.value = "";
          }}
        />

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">修复类型</label>
            <select
              value={repairType}
              onChange={(e) => setRepairType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
            >
              {RESTORE_REPAIR_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">高档因素</label>
            <select
              value={upscaleFactor}
              onChange={(e) => setUpscaleFactor(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
            >
              {RESTORE_UPSCALE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium text-[#1d1d1f]">模型</label>
          <select
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setParams({});
            }}
            className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
          >
            {restoreModels.map((m) => (
              <option key={m.modelKey} value={m.modelKey}>
                {m.displayName || m.modelKey}
              </option>
            ))}
          </select>
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
          <span className="text-xs text-[#6e6e73]">每张图片约 500–1000 积分</span>
          <CtaButton disabled={submitting} onClick={() => void onSubmit()} className="w-full sm:w-auto sm:min-w-[140px]">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            恢复图像
          </CtaButton>
        </div>
      </div>

      <section className="rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-[#1d1d1f]">关于 AI 图像修复器</h3>
        <p className="mt-2 text-sm text-[#6e6e73]">
          修复损坏或低质量图像，经 Gateway 调用百炼 / 火山方舟模型。结果自动保存到「我的资产」。
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Zap, title: "快速处理", desc: "GPU 加速，通常数十秒完成。" },
            { icon: Shield, title: "隐私安全", desc: "图片经平台处理，不会对外共享。" },
            { icon: Sparkles, title: "多模型", desc: "支持 Qwen 图像编辑与 Seedream。" },
          ].map((c) => (
            <div key={c.title} className="rounded-xl border border-[#e5e5ea] bg-[#fafafa] p-4">
              <c.icon className="mb-2 h-5 w-5 text-emerald-600" />
              <p className="font-medium text-[#1d1d1f]">{c.title}</p>
              <p className="mt-1 text-sm text-[#6e6e73]">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-[#1d1d1f]">如何使用 AI 照片修复</h3>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            { title: "上传图片", desc: "上传待修复的 JPG / PNG / WebP。" },
            { title: "选择类型与模型", desc: "选择修复类型、倍率与 Gateway 模型。" },
            { title: "下载结果", desc: "修复完成后保存到资产库。" },
          ].map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className={ipStepNumberClass}>
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
    </div>
  );
}
