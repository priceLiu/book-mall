"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Megaphone,
  MessageCircle,
  Monitor,
  Smile,
  Users,
  Wand2,
} from "lucide-react";

import {
  buildGenerativeSubmitParams,
  ImageGenerativeSettings,
} from "@/components/image-processing/image-generative-settings";
import { submitImageProcessingEdit } from "@/lib/ecom-image-processing-api";
import {
  COUNT_OPTIONS,
  MEME_FORMAT_OPTIONS,
  MEME_TEXT_STYLE_OPTIONS,
  T2I_MODEL_OPTIONS,
} from "@/lib/image-processing-presets";
import { cn } from "@/lib/utils";

const USE_CASES = [
  {
    icon: MessageCircle,
    color: "text-emerald-600",
    title: "社交媒体帖子",
    desc: "Twitter/X、Instagram、TikTok、Reddit 表情包。1:1 或 16:9 在各平台表现良好，可一次生成多个做 A/B 测试。",
  },
  {
    icon: Megaphone,
    color: "text-emerald-600",
    title: "品牌/创业公司营销",
    desc: "SaaS 创始人在推特上的能量——行业内部梗图比精心制作的营销更受欢迎。Drake / 心不在焉男友风格在 SaaS 圈是推特金矿。",
  },
  {
    icon: Monitor,
    color: "text-sky-600",
    title: "Slack/Discord 的反应",
    desc: "为团队定制表情包，用于复盘、发布日鼓舞、公开吐槽。比 TikTok 热梗更持久，因为是内部笑话。",
  },
  {
    icon: Wand2,
    color: "text-amber-600",
    title: "简讯幽默",
    desc: "每期邮件巧妙插入一张表情包，提升打开率与点击率。嵌入 Substack / Beehiiv 时请用 PNG。",
  },
  {
    icon: Users,
    color: "text-rose-600",
    title: "教师/学生幽默",
    desc: "学习苦恼梗图、期末周感同身受、答疑时间留言。非常适合学生组织 Instagram 页面。",
  },
  {
    icon: Smile,
    color: "text-[#6e6e73]",
    title: "朋友群聊",
    desc: "为群聊、生日吐槽、单身派对、家庭聚会定制梗图。经典上下排版 + Impact 字体依然无可匹敌。",
  },
];

export function ImageMemePanel({
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
  const [memeFormat, setMemeFormat] = useState("classic");
  const [sceneDescription, setSceneDescription] = useState("");
  const [topText, setTopText] = useState("");
  const [bottomText, setBottomText] = useState("");
  const [textStyle, setTextStyle] = useState("impact-classic");
  const [variantCount, setVariantCount] = useState("1");
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
    if (!sceneDescription.trim()) {
      onError("请描述场景", "填写表情包画面内容");
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
        mode: "meme",
        generativeModel,
        sceneDescription: sceneDescription.trim(),
        memeFormat,
        topText: topText.trim() || undefined,
        bottomText: bottomText.trim() || undefined,
        textStyle,
        variantCount,
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
        为生成图添加 Impact 风格文字，让梗图更清晰易读。经 Gateway 调用 Seedream / KIE 模型生成，无水印。
      </div>

      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-sm sm:p-6">
        <div>
          <p className="text-sm font-medium text-[#1d1d1f]">表情包格式</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {MEME_FORMAT_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setMemeFormat(o.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium",
                  memeFormat === o.id
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-[#e5e5ea] text-[#1d1d1f]",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-4 block text-sm font-medium text-[#1d1d1f]">
          描述一下场景
          <textarea
            value={sceneDescription}
            onChange={(e) => setSceneDescription(e.target.value)}
            rows={3}
            placeholder="一只一脸茫然的金毛犬坐在笔记本电脑前，屏幕上显示着 Python 代码。"
            className="mt-2 w-full resize-y rounded-xl border border-[#d2d2d7] px-4 py-3 text-sm font-normal"
          />
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-[#1d1d1f]">
            顶部文字（可选）
            <input
              type="text"
              value={topText}
              onChange={(e) => setTopText(e.target.value)}
              placeholder="当你最终"
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] px-3 py-2.5 text-sm font-normal"
            />
          </label>
          <label className="block text-sm font-medium text-[#1d1d1f]">
            底部文字（可选）
            <input
              type="text"
              value={bottomText}
              onChange={(e) => setBottomText(e.target.value)}
              placeholder="凌晨 3 点修复漏洞"
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] px-3 py-2.5 text-sm font-normal"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">文本样式</label>
            <select
              value={textStyle}
              onChange={(e) => setTextStyle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
            >
              {MEME_TEXT_STYLE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">变体</label>
            <select
              value={variantCount}
              onChange={(e) => {
                setVariantCount(e.target.value);
                setImageCount(e.target.value);
              }}
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
            >
              {COUNT_OPTIONS.map((o) => (
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
          onImageCountChange={(v) => {
            setImageCount(v);
            setVariantCount(v);
          }}
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
          <span className="text-xs text-[#6e6e73]">每张约 500–1000 积分</span>
          <CtaButton disabled={submitting} onClick={() => void onSubmit()} className="w-full sm:w-auto">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smile className="h-4 w-4" />}
            生成表情包
          </CtaButton>
        </div>
      </div>

      <section className="rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-[#1d1d1f]">你可以做什么</h3>
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
