"use client";

import { useEffect, useState } from "react";
import {
  Briefcase,
  Clapperboard,
  Flower2,
  Loader2,
  Music,
  Palette,
  Quote,
  Sparkles,
} from "lucide-react";

import {
  buildGenerativeSubmitParams,
  ImageGenerativeSettings,
} from "@/components/image-processing/image-generative-settings";
import { submitImageProcessingEdit } from "@/lib/ecom-image-processing-api";
import {
  COUNT_OPTIONS,
  POSTER_MODEL_OPTIONS,
  POSTER_PRINT_FORMAT_OPTIONS,
  POSTER_STYLE_OPTIONS,
} from "@/lib/image-processing-presets";
import { cn } from "@/lib/utils";

const STYLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  concert: Music,
  movie: Clapperboard,
  inspirational: Quote,
  corporate: Briefcase,
  minimalist: Sparkles,
  premium: Palette,
  festival: Flower2,
};

const USE_CASES = [
  {
    icon: Music,
    color: "text-emerald-600",
    title: "演唱会 + 巡演海报",
    desc: "醒目的图案，乐队海报般的活力。2:3 的比例，适用于标准的 18×24 英寸场地海报打印。",
  },
  {
    icon: Clapperboard,
    color: "text-amber-600",
    title: "独立电影 + 短海报",
    desc: "电影级画面构图，片尾字幕，符合电影节参赛标准。2:3 或 3:4 比例。",
  },
  {
    icon: Quote,
    color: "text-orange-600",
    title: "励志墙饰",
    desc: "办公室、健身房、教室。充满激励意味的图片，并留有空间放置名言警句。4:5 画廊。",
  },
  {
    icon: Briefcase,
    color: "text-sky-600",
    title: "企业 + 会议",
    desc: "卷轴式横幅、展览展位、市政厅公告。A 系列或 2:3 比例。",
  },
  {
    icon: Flower2,
    color: "text-rose-600",
    title: "节日 + 活动",
    desc: "色彩饱和，版面设计充满活力。街头海报采用 2:3 的比例，社交媒体采用 1:1 的比例。",
  },
  {
    icon: Palette,
    color: "text-violet-600",
    title: "画廊 + 艺术版画",
    desc: "极简主义或复古风格。Etsy 16×20 英寸印刷品采用 4:5 比例，国际印刷采用 A 系列比例。",
  },
];

export function ImagePosterPanel({
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
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [sceneDescription, setSceneDescription] = useState("");
  const [posterStyle, setPosterStyle] = useState("concert");
  const [printFormat, setPrintFormat] = useState("2:3");
  const [posterCount, setPosterCount] = useState("1");
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
      onError("请填写场景描述", "描述海报画面内容");
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
        mode: "poster",
        generativeModel,
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        sceneDescription: sceneDescription.trim(),
        posterStyle,
        printFormat,
        posterCount,
        styleImageDataUrl: styleImage ?? undefined,
        parameters: submitParams,
      });
      onResults(res.imageUrls);
    } catch (e) {
      onError("海报生成失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-6 space-y-4 sm:mt-8 sm:space-y-6">
      <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-3 text-sm leading-relaxed text-[#1d1d1f] sm:px-4">
        生成可直接打印的海报，固定长宽比与排版留白。经 Gateway 调用 Seedream 5.0 Lite 或 KIE NanoBanana Pro，无水印。
      </div>

      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-sm sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-[#1d1d1f]">
            标题（主标题）
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="演唱会主标题"
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] px-3 py-2.5 text-sm font-normal"
            />
          </label>
          <label className="block text-sm font-medium text-[#1d1d1f]">
            副标题 / 日期 / 地点
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="2026 · 上海"
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] px-3 py-2.5 text-sm font-normal"
            />
          </label>
        </div>

        <label className="mt-4 block text-sm font-medium text-[#1d1d1f]">
          场景描述
          <textarea
            value={sceneDescription}
            onChange={(e) => setSceneDescription(e.target.value)}
            rows={4}
            placeholder="日落时分，音乐节舞台上人群剪影，彩色纸屑飘落……"
            className="mt-1 w-full resize-y rounded-xl border border-[#d2d2d7] px-4 py-3 text-sm font-normal"
          />
        </label>

        <div className="mt-4">
          <p className="text-sm font-medium text-[#1d1d1f]">风格</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {POSTER_STYLE_OPTIONS.map((o) => {
              const Icon = STYLE_ICONS[o.id] ?? Sparkles;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setPosterStyle(o.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
                    posterStyle === o.id
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-[#e5e5ea] text-[#1d1d1f]",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">打印格式</label>
            <select
              value={printFormat}
              onChange={(e) => setPrintFormat(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
            >
              {POSTER_PRINT_FORMAT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">数数</label>
            <select
              value={posterCount}
              onChange={(e) => {
                setPosterCount(e.target.value);
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
            setPosterCount(v);
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
          modelOptions={POSTER_MODEL_OPTIONS}
        />

        <div className="mt-6 flex flex-col gap-3 border-t border-[#e5e5ea] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-[#6e6e73]">每张海报约 500–5000 积分</span>
          <CtaButton disabled={submitting} onClick={() => void onSubmit()} className="w-full sm:w-auto">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            生成海报
          </CtaButton>
        </div>
      </div>

      <section className="rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-[#1d1d1f]">用例</h3>
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
