"use client";

import { useEffect, useState } from "react";
import { EyeOff, Loader2, MessageCircle, Shield, Wand2, Zap } from "lucide-react";

import {
  buildGenerativeSubmitParams,
  ImageGenerativeSettings,
} from "@/components/image-processing/image-generative-settings";
import { ImageSingleUpload } from "@/components/image-processing/image-single-upload";
import { submitImageProcessingEdit } from "@/lib/ecom-image-processing-api";
import {
  DEBLUR_BLUR_TYPE_OPTIONS,
  DEBLUR_STRENGTH_OPTIONS,
  isSeedreamLiteModel,
} from "@/lib/image-processing-presets";
import { ipStepNumberClass } from "@/lib/image-processing-theme";

export function ImageDeblurPanel({
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
  const [image, setImage] = useState<string | null>(null);
  const [blurType, setBlurType] = useState("auto");
  const [sharpenStrength, setSharpenStrength] = useState("medium");
  const [generativeModel, setGenerativeModel] = useState(defaultModel);
  const [imageCount, setImageCount] = useState("1");
  const [seed, setSeed] = useState("");
  const [aspect, setAspect] = useState("1:1");
  const [params, setParams] = useState<Record<string, unknown>>({ strength: 0.5 });
  const [styleImage, setStyleImage] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    setGenerativeModel(defaultModel);
  }, [defaultModel]);

  const onSubmit = async () => {
    if (!image) {
      onError("请上传图片", "先上传一张模糊的图片");
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
        mode: "deblur",
        generativeModel,
        sourceImageDataUrl: image,
        blurType,
        sharpenStrength,
        styleImageDataUrl: styleImage ?? undefined,
        parameters: submitParams,
      });
      onResults(res.imageUrls);
    } catch (e) {
      onError("去模糊失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  const features = [
    {
      icon: Zap,
      title: "快速处理",
      desc: "经 Gateway GPU 加速，数秒内完成锐化与清晰化。",
    },
    {
      icon: Shield,
      title: "私密安全",
      desc: "图片在服务端处理，不会对外分享。",
    },
    {
      icon: MessageCircle,
      title: "聊天室也已上线",
      desc: "也可在 AI 聊天中直接调用图像去模糊能力。",
    },
  ];

  const steps = [
    {
      title: "请输入您的内容",
      desc: "上传模糊图片，或选择模糊类型与锐化强度。",
    },
    {
      title: "点击生成",
      desc: "AI 在数秒内完成去模糊与清晰化处理。",
    },
    {
      title: "下载并分享",
      desc: "结果保存到「我的资产」，可免费用于个人与商业用途。",
    },
  ];

  return (
    <div className="mt-6 space-y-4 sm:mt-8 sm:space-y-6">
      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-sm sm:p-6">
        <ImageSingleUpload
          image={image}
          onChange={setImage}
          onError={onError}
          icon={EyeOff}
          emptyLabel="上传一张模糊的图片进行锐化和清晰化处理"
          emptyHint="JPG、PNG、WebP，最大 10MB"
        />

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">模糊类型</label>
            <select
              value={blurType}
              onChange={(e) => setBlurType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
            >
              {DEBLUR_BLUR_TYPE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">磨利强度</label>
            <select
              value={sharpenStrength}
              onChange={(e) => setSharpenStrength(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
            >
              {DEBLUR_STRENGTH_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
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
          hideImageCount={!isSeedreamLiteModel(generativeModel) && generativeModel !== "qwen-image-edit-max"}
        />

        <div className="mt-6 flex flex-col gap-3 border-t border-[#e5e5ea] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-[#6e6e73]">每张图片约 500–1000 积分</span>
          <CtaButton disabled={submitting} onClick={() => void onSubmit()} className="w-full sm:w-auto">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            消除图像模糊
          </CtaButton>
        </div>
      </div>

      <section className="rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-[#1d1d1f]">关于 AI Unblur</h3>
        <p className="mt-2 text-sm leading-relaxed text-[#6e6e73]">
          经 Gateway 调用百炼 Qwen 图像编辑与 Seedream 模型，对运动模糊、失焦、低分辨率与噪点等问题进行智能锐化，无需额外注册。
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-[#e5e5ea] bg-[#fafafa] p-4">
              <f.icon className="mb-2 h-5 w-5 text-emerald-600" />
              <p className="font-medium text-[#1d1d1f]">{f.title}</p>
              <p className="mt-1 text-sm text-[#6e6e73]">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-[#1d1d1f]">如何使用 AI 图像去模糊功能</h3>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
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
