"use client";

import { useState } from "react";
import { Eraser, Loader2 } from "lucide-react";

import {
  buildGenerativeSubmitParams,
  ImageGenerativeSettings,
} from "@/components/image-processing/image-generative-settings";
import { ImageSingleUpload } from "@/components/image-processing/image-single-upload";
import { submitImageProcessingEdit } from "@/lib/ecom-image-processing-api";
import {
  OBJECT_OUTPUT_FORMAT_OPTIONS,
  OBJECT_REMOVE_MODE_OPTIONS,
} from "@/lib/image-processing-presets";
import { ipStepNumberClass } from "@/lib/image-processing-theme";

export function ImageObjectRemoverPanel({
  submitting,
  setSubmitting,
  onResults,
  onError,
  CtaButton,
}: {
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
}) {
  const [image, setImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [removalMode, setRemovalMode] = useState("auto");
  const [outputFormat, setOutputFormat] = useState("png");
  const [generativeModel, setGenerativeModel] = useState("doubao-seedream-5-0-lite");
  const [imageCount, setImageCount] = useState("1");
  const [seed, setSeed] = useState("");
  const [aspect, setAspect] = useState("1:1");
  const [params, setParams] = useState<Record<string, unknown>>({ strength: 0.5 });
  const [styleImage, setStyleImage] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const onSubmit = async () => {
    if (!image) {
      onError("请上传图片", "先上传待处理图片");
      return;
    }
    if (!prompt.trim()) {
      onError("请填写描述", "说明要移除的物体");
      return;
    }
    setSubmitting(true);
    onResults([]);
    try {
      const submitParams = buildGenerativeSubmitParams({
        imageCount,
        seed,
        aspect,
        params,
        styleImage,
      });
      const res = await submitImageProcessingEdit({
        mode: "object-remove",
        generativeModel,
        prompt: prompt.trim(),
        sourceImageDataUrl: image,
        removalMode,
        outputFormat,
        styleImageDataUrl: styleImage ?? undefined,
        parameters: submitParams,
      });
      onResults(res.imageUrls);
    } catch (e) {
      onError("移除失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-6 space-y-4 sm:mt-8 sm:space-y-6">
      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-sm sm:p-6">
        <ImageSingleUpload
          image={image}
          onChange={setImage}
          onError={onError}
        />

        <label className="mt-6 block text-sm font-medium text-[#1d1d1f]">
          应该移除哪些内容？
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="例如，移除背景中的人物，擦掉电线，去除水印……"
            className="mt-2 w-full resize-y rounded-xl border border-[#d2d2d7] px-4 py-3 text-sm"
          />
        </label>
        <p className="mt-1 text-xs text-[#6e6e73]">
          描述不需要的物体。AI 将移除它并自然地填充该区域。
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">移除模式</label>
            <select
              value={removalMode}
              onChange={(e) => setRemovalMode(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
            >
              {OBJECT_REMOVE_MODE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">输出格式</label>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
            >
              {OBJECT_OUTPUT_FORMAT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2 text-xs text-[#6e6e73]">
          经 Gateway 调用 Seedream 5.0 Lite 与百炼图像编辑完成物体移除与填充。
        </div>

        <ImageGenerativeSettings
          generativeModel={generativeModel}
          onGenerativeModelChange={setGenerativeModel}
          imageCount={imageCount}
          onImageCountChange={setImageCount}
          seed={seed}
          onSeedChange={setSeed}
          aspect={aspect}
          onAspectChange={setAspect}
          params={params}
          onParamsChange={setParams}
          advancedOpen={advancedOpen}
          onAdvancedOpenChange={setAdvancedOpen}
          styleImage={styleImage}
          onStyleImageChange={setStyleImage}
        />

        <div className="mt-6 flex flex-col gap-3 border-t border-[#e5e5ea] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-[#6e6e73]">每张图片约 500–1000 积分</span>
          <CtaButton disabled={submitting} onClick={() => void onSubmit()} className="w-full sm:w-auto">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
            移除对象
          </CtaButton>
        </div>
      </div>

      <section className="rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-[#1d1d1f]">如何使用物体移除器</h3>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            { title: "上传并描述", desc: "上传图片，说明要移除的物体或瑕疵。" },
            { title: "选择模式", desc: "自动检测、干净填充或上下文感知修复。" },
            { title: "下载结果", desc: "生成结果自动保存到「我的资产」。" },
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
