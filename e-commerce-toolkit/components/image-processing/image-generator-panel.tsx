"use client";

import { useEffect, useState } from "react";
import {
  Download,
  Frame,
  Loader2,
  MessageCircle,
  Palette,
  PenLine,
  Sparkles,
  X,
} from "lucide-react";

import { ImageSingleUpload } from "@/components/image-processing/image-single-upload";
import { submitImageProcessingEdit } from "@/lib/ecom-image-processing-api";
import {
  DEFAULT_NEGATIVE_PROMPT_PLACEHOLDER,
  GENERATIVE_IMAGE_COUNT_OPTIONS,
  IMAGE_GENERATOR_ASPECT_OPTIONS,
  IMAGE_GENERATOR_STYLE_OPTIONS,
  T2I_MODEL_OPTIONS,
} from "@/lib/image-processing-presets";
import { ipStepNumberClass } from "@/lib/image-processing-theme";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: Palette,
    color: "text-[#0071e3]",
    title: "多种模型",
    desc: "Seedream、NanoBanana Pro、Gemini 2.5 Flash Image 等经 Gateway 统一调用。",
  },
  {
    icon: PenLine,
    color: "text-[#0071e3]",
    title: "9 种艺术风格",
    desc: "摄影、数字艺术、动漫、3D、素描、水彩、油画、像素艺术等。",
  },
  {
    icon: Frame,
    color: "text-amber-600",
    title: "灵活的宽高比",
    desc: "1:1、16:9、9:16、4:3、3:4 常用画幅一键选择。",
  },
  {
    icon: X,
    color: "text-red-600",
    title: "负面提示",
    desc: "排除模糊、低质量、水印等不想要的元素。",
  },
  {
    icon: MessageCircle,
    color: "text-sky-600",
    title: "在聊天中生成",
    desc: "与电商助手联动，快速迭代提示词与参数。",
  },
  {
    icon: Download,
    color: "text-[#7a7a7a]",
    title: "立即下载",
    desc: "生成结果自动保存到「我的资产」，可随时下载。",
  },
];

const STEPS = [
  {
    title: "描述你的图片",
    desc: "用文字说明画面主体、环境、光线与情绪。",
  },
  {
    title: "选择型号和款式",
    desc: "在 Seedream、NanoBanana 或 Gemini Flash Image 间切换，并挑选艺术风格。",
  },
  {
    title: "用负片进行精炼",
    desc: "在高级选项中填写负面提示，排除「模糊」「低质量」等。",
  },
  {
    title: "生成并下载",
    desc: "点击生成，数秒内获得结果并保存到资产库。",
  },
];

export function ImageGeneratorPanel({
  defaultModel,
  submitting,
  setSubmitting,
  onResults,
  onError,
  CtaButton,
}: {
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
}) {
  const [prompt, setPrompt] = useState("");
  const [generativeModel, setGenerativeModel] = useState(defaultModel);
  const [aspect, setAspect] = useState("1:1");
  const [styleId, setStyleId] = useState("none");
  const [imageCount, setImageCount] = useState("1");
  const [seed, setSeed] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [styleImage, setStyleImage] = useState<string | null>(null);
  const [strength, setStrength] = useState(0.5);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    setGenerativeModel(defaultModel);
  }, [defaultModel]);

  const onSubmit = async () => {
    if (!prompt.trim()) {
      onError("请填写描述", "描述你的图片");
      return;
    }
    setSubmitting(true);
    onResults([]);
    try {
      const res = await submitImageProcessingEdit({
        mode: "image-generator",
        prompt: prompt.trim(),
        generativeModel,
        styleId,
        negativePrompt: negativePrompt.trim() || undefined,
        styleImageDataUrl: styleImage ?? undefined,
        parameters: {
          aspect_ratio: aspect,
          n: Number(imageCount) || 1,
          seed: seed.trim() ? Number(seed) : undefined,
          negative_prompt: negativePrompt.trim() || undefined,
          strength,
          styleImageDataUrl: styleImage ?? undefined,
        },
      });
      onResults(res.imageUrls);
    } catch (e) {
      onError("图像生成失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-6 space-y-4 sm:mt-8 sm:space-y-6">
      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-[#1d1d1f]">AI 图像生成器</h2>

        <label className="mt-4 block text-sm font-medium text-[#1d1d1f]">
          描述你的图片
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="夕阳西下，金色的光芒洒在雄伟的山峦上……"
            className="mt-1 w-full resize-y rounded-xl border border-[#d2d2d7] px-4 py-3 text-sm font-normal"
          />
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">模型</label>
            <select
              value={generativeModel}
              onChange={(e) => setGenerativeModel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
            >
              {T2I_MODEL_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">长宽比</label>
            <select
              value={aspect}
              onChange={(e) => setAspect(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
            >
              {IMAGE_GENERATOR_ASPECT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">风格</label>
            <select
              value={styleId}
              onChange={(e) => setStyleId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
            >
              {IMAGE_GENERATOR_STYLE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="mt-4 text-sm text-[#0071e3]"
        >
          {advancedOpen ? "收起高级选项" : "高级选项"}
        </button>

        {advancedOpen ? (
          <div className="mt-3 space-y-4 rounded-xl border border-[#e5e5ea] bg-[#fafafa] p-4">
            <label className="block text-sm font-medium text-[#1d1d1f]">
              否定提示（可选）
              <input
                type="text"
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder={DEFAULT_NEGATIVE_PROMPT_PLACEHOLDER}
                className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm font-normal"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-[#1d1d1f]">图片数量</label>
                <select
                  value={imageCount}
                  onChange={(e) => setImageCount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
                >
                  {GENERATIVE_IMAGE_COUNT_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#1d1d1f]">种子（可选）</label>
                <input
                  type="text"
                  placeholder="随机的"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-[#1d1d1f]">
                  样式参考（可选）
                </label>
                <span className="rounded bg-[#0071e3]/10 px-2 py-0.5 text-xs text-[#0071e3]">
                  风格参考图
                </span>
              </div>
              <div className="mt-2">
                <ImageSingleUpload
                  compact
                  image={styleImage}
                  onChange={setStyleImage}
                  emptyHint="拖放一张参考图片以匹配其风格，或点击浏览。"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-[#1d1d1f]">
                风格强度 {strength.toFixed(1)}
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={strength}
                onChange={(e) => setStrength(Number(e.target.value))}
                className="mt-2 w-full accent-[#0071e3]"
              />
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <CtaButton disabled={submitting} onClick={onSubmit} className="flex-1">
            {submitting ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                生成中…
              </span>
            ) : (
              <span className="inline-flex items-center justify-center gap-2">
                <Sparkles className="h-4 w-4" />
                生成图像
              </span>
            )}
          </CtaButton>
        </div>
      </div>

      <section className="rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-[#1d1d1f]">你可以创造什么</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-[#e5e5ea] bg-[#fafafa] p-4"
            >
              <f.icon className={cn("mb-2 h-5 w-5", f.color)} />
              <p className="text-sm font-semibold text-[#1d1d1f]">{f.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#7a7a7a]">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-[#1d1d1f]">如何使用</h3>
        <ol className="mt-4 space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className={ipStepNumberClass}>{i + 1}</span>
              <div>
                <p className="text-sm font-semibold text-[#1d1d1f]">{s.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[#7a7a7a]">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
