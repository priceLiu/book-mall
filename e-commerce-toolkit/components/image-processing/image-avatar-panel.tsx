"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  Dices,
  Heart,
  Loader2,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";

import {
  buildGenerativeSubmitParams,
  ImageGenerativeSettings,
} from "@/components/image-processing/image-generative-settings";
import { submitImageProcessingEdit } from "@/lib/ecom-image-processing-api";
import {
  AVATAR_CROP_OPTIONS,
  AVATAR_STYLE_OPTIONS,
  COUNT_OPTIONS,
  T2I_MODEL_OPTIONS,
} from "@/lib/image-processing-presets";
import { cn } from "@/lib/utils";

const QUICK_TAGS = ["巫师", "黑客", "创始人", "猫女", "滑板手"];

const USE_CASES = [
  {
    icon: Sparkles,
    color: "text-emerald-600",
    title: "游戏/直播个人资料",
    desc: "Discord、Steam、Twitch、Xbox Live、PlayStation、Epic Games。像素艺术、动漫和赛博朋克预设最受玩家欢迎。",
  },
  {
    icon: UserPlus,
    color: "text-emerald-600",
    title: "社交媒体个人主页",
    desc: "Twitter/X、Instagram、TikTok、Reddit、Mastodon。皮克斯/迪士尼/Q 版阅读体验最佳；圆形裁剪适用于所有平台。",
  },
  {
    icon: Dices,
    color: "text-sky-600",
    title: "龙与地下城/角色扮演游戏角色",
    desc: "适用于战役设定表、Roll20 代币、Foundry VTT 人物肖像。奇幻 RPG + 细腻提示用于戏剧性角色揭晓。",
  },
  {
    icon: Heart,
    color: "text-amber-600",
    title: "VTuber 起始姿势",
    desc: "动漫预设 + 详细角色描述 = 虚拟主播模型委托的可靠参考，可交给 Live2D 绑定师完成动画。",
  },
  {
    icon: Users,
    color: "text-rose-600",
    title: "团队登录页面",
    desc: "为 SaaS「关于我们」页生成风格统一的团队头像。企业扁平化预设，每个团队使用相同配色。",
  },
  {
    icon: BookOpen,
    color: "text-[#6e6e73]",
    title: "同人小说/原创角色参考",
    desc: "为写作社区 OC、AO3 故事标题、同人封面提供视觉参考。风格统一的角色设定图帮助形象化阵容。",
  },
];

export function ImageAvatarPanel({
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
  const [avatarStyle, setAvatarStyle] = useState("pixar-3d");
  const [characterDescription, setCharacterDescription] = useState("");
  const [cropShape, setCropShape] = useState("circle");
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
    if (!characterDescription.trim()) {
      onError("请描述角色", "填写角色外观与特征");
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
        mode: "avatar",
        generativeModel,
        characterDescription: characterDescription.trim(),
        avatarStyle,
        cropShape,
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
        生成创意、奇幻或专业风格的虚拟形象头像。经 Gateway 调用 Seedream / KIE 模型，支持多种裁剪形状。
      </div>

      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-sm sm:p-6">
        <div>
          <p className="text-sm font-medium text-[#1d1d1f]">头像风格</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {AVATAR_STYLE_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setAvatarStyle(o.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium",
                  avatarStyle === o.id
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
          描述这个角色
          <textarea
            value={characterDescription}
            onChange={(e) => setCharacterDescription(e.target.value)}
            rows={4}
            maxLength={400}
            placeholder="一位戴护目镜的年轻巫师，紫色长袍，手持发光法杖……"
            className="mt-2 w-full resize-y rounded-xl border border-[#d2d2d7] px-4 py-3 text-sm font-normal"
          />
        </label>
        <p className="mt-1 text-xs text-[#6e6e73]">
          {characterDescription.length} / 400 字符
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {QUICK_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() =>
                setCharacterDescription((prev) =>
                  prev.trim() ? `${prev.trim()}，${tag}` : tag,
                )
              }
              className="rounded-full border border-[#e5e5ea] px-2.5 py-1 text-xs text-[#6e6e73] hover:border-[#0071e3] hover:text-[#0071e3]"
            >
              {tag}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">形状（裁剪）</label>
            <select
              value={cropShape}
              onChange={(e) => setCropShape(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
            >
              {AVATAR_CROP_OPTIONS.map((o) => (
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
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            生成头像
          </CtaButton>
        </div>
      </div>

      <section className="rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-[#1d1d1f]">你可以创造什么</h3>
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
