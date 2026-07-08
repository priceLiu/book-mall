"use client";

import { useState } from "react";
import { Loader2, Palette, Scissors } from "lucide-react";

import {
  buildGenerativeSubmitParams,
  ImageGenerativeSettings,
} from "@/components/image-processing/image-generative-settings";
import { ImageSingleUpload } from "@/components/image-processing/image-single-upload";
import { submitImageProcessingEdit } from "@/lib/ecom-image-processing-api";
import {
  BG_EDGE_QUALITY_OPTIONS,
  BG_MODE_OPTIONS,
  BG_OUTPUT_FORMAT_OPTIONS,
  BG_REMOVAL_MODEL_OPTIONS,
} from "@/lib/image-processing-presets";
import { ipTagSelectedClass, ipTagUnselectedClass } from "@/lib/image-processing-theme";
import { cn } from "@/lib/utils";

export function ImageBgRemoverPanel({
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
  const [bgMode, setBgMode] = useState("transparent");
  const [customColor, setCustomColor] = useState("#3b82f6");
  const [removalModel, setRemovalModel] = useState("qwen-image-edit-max");
  const [edgeQuality, setEdgeQuality] = useState("auto");
  const [outputFormat, setOutputFormat] = useState("png");
  const [imageCount, setImageCount] = useState("1");
  const [seed, setSeed] = useState("");
  const [aspect, setAspect] = useState("1:1");
  const [params, setParams] = useState<Record<string, unknown>>({ strength: 0.5 });
  const [styleImage, setStyleImage] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const onSubmit = async () => {
    if (!image) {
      onError("请上传图片", "先上传待抠图图片");
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
        mode: "bg-remove",
        model: removalModel,
        generativeModel: removalModel,
        sourceImageDataUrl: image,
        bgMode,
        edgeQuality,
        outputFormat,
        customColor: bgMode === "custom" ? customColor : undefined,
        styleImageDataUrl: styleImage ?? undefined,
        parameters: submitParams,
      });
      onResults(res.imageUrls);
    } catch (e) {
      onError("抠图失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  const useCases = [
    {
      title: "电子商务产品照片",
      desc: "亚马逊、Shopify 和 Etsy 要求纯白色背景。选择「白色模式」+「高边缘质量」，即可获得符合平台要求的抠图。",
    },
    {
      title: "个人资料照片/头像",
      desc: "从自拍中抠出自己，放到自定义颜色或纯白色背景上，适合 LinkedIn / Slack / Discord 头像。",
    },
    {
      title: "YouTube/播客缩略图",
      desc: "将主体抠出，加上醒目色块与大号文字。自定义颜色模式可匹配频道专属调色板。",
    },
    {
      title: "广告创意/横幅广告",
      desc: "将产品合成到季节性场景素材中。透明 PNG 可轻松导入 Photoshop、Figma、Canva。",
    },
    {
      title: "人像模式救援",
      desc: "选择模糊模式，为拍摄对象添加深度感与散景效果，模拟手机人像模式。",
    },
    {
      title: "贴纸/Telegram 包",
      desc: "抠出主体后调整尺寸，制作 512×512 透明 PNG 贴纸。",
    },
  ];

  return (
    <div className="mt-6 space-y-4 sm:mt-8 sm:space-y-6">
      <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-3 text-sm leading-relaxed text-[#1d1d1f] sm:px-4">
        上传照片即可获得透明 PNG。经 Gateway 调用百炼 / Seedream 模型抠图，无水印。透明模式适合编辑，白色适合电商平台，模糊适合人像，自定义颜色适合缩略图。
      </div>

      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-sm sm:p-6">
        <ImageSingleUpload
          image={image}
          onChange={setImage}
          onError={onError}
          emptyLabel="将图片拖放到此处 或点击浏览"
        />

        <div className="mt-6">
          <p className="flex items-center gap-1 text-sm font-medium text-[#1d1d1f]">
            <Palette className="h-4 w-4" />
            后台模式
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {BG_MODE_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setBgMode(o.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium",
                  bgMode === o.id
                    ? ipTagSelectedClass
                    : ipTagUnselectedClass,
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          {bgMode === "custom" ? (
            <div className="mt-3 flex items-center gap-3">
              <input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded border border-[#d2d2d7]"
              />
              <span className="text-sm text-[#6e6e73]">自定义背景色 {customColor}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">模型</label>
            <select
              value={removalModel}
              onChange={(e) => setRemovalModel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
            >
              {BG_REMOVAL_MODEL_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">边缘质量</label>
            <select
              value={edgeQuality}
              onChange={(e) => setEdgeQuality(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
            >
              {BG_EDGE_QUALITY_OPTIONS.map((o) => (
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
              {BG_OUTPUT_FORMAT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <ImageGenerativeSettings
          generativeModel={removalModel}
          onGenerativeModelChange={setRemovalModel}
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
          hideModelSelect
        />

        <div className="mt-6 flex flex-col gap-3 border-t border-[#e5e5ea] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-[#6e6e73]">经 Gateway 调用，结果保存到「我的资产」</span>
          <CtaButton disabled={submitting} onClick={() => void onSubmit()} className="w-full sm:w-auto">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
            移除背景
          </CtaButton>
        </div>
      </div>

      <section className="rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-[#1d1d1f]">你可以删减的内容</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {useCases.map((c) => (
            <div key={c.title} className="rounded-xl border border-[#e5e5ea] bg-[#fafafa] p-4">
              <p className="font-medium text-[#1d1d1f]">{c.title}</p>
              <p className="mt-1 text-sm text-[#6e6e73]">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
