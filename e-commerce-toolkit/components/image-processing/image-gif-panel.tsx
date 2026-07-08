"use client";

import { useEffect, useState } from "react";
import {
  Film,
  Loader2,
  Megaphone,
  MessageCircle,
  RefreshCw,
  Smile,
  Sticker,
  Video,
} from "lucide-react";

import {
  buildGenerativeSubmitParams,
  ImageGenerativeSettings,
} from "@/components/image-processing/image-generative-settings";
import { submitImageProcessingEdit } from "@/lib/ecom-image-processing-api";
import {
  COUNT_OPTIONS,
  GIF_ANIMATION_TYPE_OPTIONS,
  GIF_DURATION_OPTIONS,
  GIF_FRAME_RATE_OPTIONS,
  GIF_SIZE_OPTIONS,
  T2I_MODEL_OPTIONS,
} from "@/lib/image-processing-presets";
import { ipTagSelectedClass, ipTagUnselectedClass } from "@/lib/image-processing-theme";
import { cn } from "@/lib/utils";

const USE_CASES = [
  {
    icon: MessageCircle,
    color: "text-emerald-600",
    title: "用于聊天/Slack 的表情 GIF",
    desc: "为 Slack、Discord 和群聊定制表情 GIF。256 像素保证文件足够小，方便发送至任何平台。",
  },
  {
    icon: RefreshCw,
    color: "text-emerald-600",
    title: "加载指示器/用户界面",
    desc: "为产品定制品牌加载动画。加载类型 + 简洁几何描述，可与图标工具搭配统一风格。",
  },
  {
    icon: Video,
    color: "text-sky-600",
    title: "动态照片英雄图像",
    desc: "以静态图片为主，辅以微妙动态（咖啡热气、飘动头发、潺潺流水）。高端品牌落地页常用。",
  },
  {
    icon: Megaphone,
    color: "text-amber-600",
    title: "横幅/展示广告",
    desc: "GIF 动画在各浏览器和邮件客户端均可加载。480 像素是展示广告文件大小的最佳平衡点。",
  },
  {
    icon: Sticker,
    color: "text-rose-600",
    title: "动态贴纸",
    desc: "Telegram 和 WhatsApp 动态贴纸包。256 像素、循环播放、12fps 为最小文件配置。",
  },
  {
    icon: Smile,
    color: "text-[#6e6e73]",
    title: "表情包/病毒式内容",
    desc: "表情包 GIF 是网络幽默的通用语言。快速迭代是制胜法宝——生成 3–4 个版本，发布最佳。",
  },
];

export function ImageGifPanel({
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
  const [animationType, setAnimationType] = useState("seamless-loop");
  const [animationDescription, setAnimationDescription] = useState("");
  const [durationSec, setDurationSec] = useState("2");
  const [gifSize, setGifSize] = useState("480");
  const [frameRate, setFrameRate] = useState("24");
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
    if (!animationDescription.trim()) {
      onError("请描述动画", "填写动画动作与场景");
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
        mode: "gif",
        generativeModel,
        animationDescription: animationDescription.trim(),
        animationType,
        durationSec,
        gifSize,
        frameRate,
        styleImageDataUrl: styleImage ?? undefined,
        parameters: submitParams,
      });
      onResults(res.imageUrls);
    } catch (e) {
      onError("生成失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-6 space-y-4 sm:mt-8 sm:space-y-6">
      <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-3 text-sm leading-relaxed text-[#1d1d1f] sm:px-4">
        渲染短视频并转换为 GIF 风格动图。经 Gateway 调用 Seedream / KIE 模型；建议 2–3 秒时长以获得最佳 GIF 效果。动作保持简单清晰。
      </div>

      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-sm sm:p-6">
        <div>
          <p className="text-sm font-medium text-[#1d1d1f]">动画类型</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {GIF_ANIMATION_TYPE_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setAnimationType(o.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium",
                  animationType === o.id
                    ? ipTagSelectedClass
                    : ipTagUnselectedClass,
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-4 block text-sm font-medium text-[#1d1d1f]">
          描述动画
          <textarea
            value={animationDescription}
            onChange={(e) => setAnimationDescription(e.target.value)}
            rows={4}
            maxLength={400}
            placeholder="一只可爱的小猫挥动爪子；旋转的 3D 水晶球；篝火中跳动的火焰……"
            className="mt-2 w-full resize-y rounded-xl border border-[#d2d2d7] px-4 py-3 text-sm font-normal"
          />
        </label>
        <p className="mt-1 text-xs text-[#6e6e73]">
          {animationDescription.length} / 400 字符 · 动作保持简单清晰，GIF 压缩会损失细节
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">期间</label>
            <select
              value={durationSec}
              onChange={(e) => setDurationSec(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
            >
              {GIF_DURATION_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">尺寸</label>
            <select
              value={gifSize}
              onChange={(e) => setGifSize(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
            >
              {GIF_SIZE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">帧率</label>
            <select
              value={frameRate}
              onChange={(e) => setFrameRate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
            >
              {GIF_FRAME_RATE_OPTIONS.map((o) => (
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
          modelOptions={T2I_MODEL_OPTIONS}
        />

        <div className="mt-6 flex flex-col gap-3 border-t border-[#e5e5ea] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-[#6e6e73]">每张约 500–5000 积分</span>
          <CtaButton disabled={submitting} onClick={() => void onSubmit()} className="w-full sm:w-auto">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
            生成 GIF
          </CtaButton>
        </div>
      </div>

      <section className="rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-[#1d1d1f]">你可以制作动画</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((c) => (
            <div key={c.title} className="rounded-xl border border-[#e5e5ea] bg-[#fafafa] p-4">
              <c.icon className={cn("mb-2 h-5 w-5", c.color)} />
              <p className="font-medium text-[#1d1d1f]">{c.title}</p>
              <p className="mt-1 text-sm text-[#6e6e73]">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
