"use client";

import { useEffect, useState } from "react";
import {
  Camera,
  Check,
  Clapperboard,
  Droplets,
  Globe,
  Loader2,
  Megaphone,
  Package,
  Pencil,
  Sparkles,
  Sun,
} from "lucide-react";

import {
  buildGenerativeSubmitParams,
  ImageGenerativeSettings,
} from "@/components/image-processing/image-generative-settings";
import { submitImageProcessingEdit } from "@/lib/ecom-image-processing-api";
import {
  REALISTIC_CAMERA_OPTIONS,
  REALISTIC_LIGHTING_OPTIONS,
  T2I_MODEL_OPTIONS,
} from "@/lib/image-processing-presets";
import { ipTagSelectedClass, ipTagUnselectedClass } from "@/lib/image-processing-theme";
import { cn } from "@/lib/utils";

const USE_CASES = [
  {
    icon: Megaphone,
    color: "text-sky-600",
    title: "广告创意和主图",
    desc: "为 Meta / Google 广告生成逼真生活方式场景，突出产品与使用情境。",
  },
  {
    icon: Package,
    color: "text-amber-600",
    title: "产品生活方式",
    desc: "珠宝、化妆品、服装等产品棚拍级呈现，虚拟镜头 100mm 微距 / 50mm / 24mm。",
  },
  {
    icon: Clapperboard,
    color: "text-violet-600",
    title: "故事板和概念",
    desc: "电影分镜、音乐视频与情绪板；支持 2.39:1 电影感画幅。",
  },
  {
    icon: Globe,
    color: "text-emerald-600",
    title: "旅行与地点",
    desc: "旅行博客、Airbnb 房源与无人机风格风景大片。",
  },
  {
    icon: Pencil,
    color: "text-rose-600",
    title: "编辑与杂志",
    desc: "杂志专题与博客头图，85mm 胶片感专业相机外观。",
  },
  {
    icon: Camera,
    color: "text-orange-600",
    title: "博客文章",
    desc: "根据文章内容生成独一无二的头图与配图。",
  },
];

export function ImageRealisticPanel({
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
  const [sceneDescription, setSceneDescription] = useState("");
  const [cameraLens, setCameraLens] = useState("35mm-street");
  const [lighting, setLighting] = useState("golden-hour");
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
      onError("请填写场景描述", "描述场景或主题");
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
        mode: "realistic",
        generativeModel,
        sceneDescription: sceneDescription.trim(),
        cameraLens,
        lighting,
        styleImageDataUrl: styleImage ?? undefined,
        parameters: submitParams,
      });
      onResults(res.imageUrls);
    } catch (e) {
      onError("逼真图像生成失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-6 space-y-4 sm:mt-8 sm:space-y-6">
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
          <Check className="h-3.5 w-3.5" />
          商业用途可以
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
          <Sparkles className="h-3.5 w-3.5" />
          380+ 款模型
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
          <Droplets className="h-3.5 w-3.5" />
          无水印
        </span>
      </div>

      <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-3 text-sm leading-relaxed text-[#1d1d1f] sm:px-4">
        <div className="flex gap-2">
          <Camera className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <p>
            选择相机/镜头与灯光氛围，系统将注入焦距、光圈、胶片类型等摄影提示词，适合营销、生活方式产品与编辑类照片。经
            Gateway 调用 Seedream 5.0 Lite、KIE NanoBanana Pro 或 NanoBanana Gemini 2.5 Flash Image。
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[#1d1d1f]">相机和镜头</p>
          <span className="text-xs text-[#0071e3]">设置焦距和景深</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {REALISTIC_CAMERA_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setCameraLens(o.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium",
                cameraLens === o.id ? ipTagSelectedClass : ipTagUnselectedClass,
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-sm font-medium text-[#1d1d1f]">
          <span className="inline-flex items-center gap-1.5">
            <Pencil className="h-4 w-4" />
            描述场景或主题
          </span>
          <textarea
            value={sceneDescription}
            onChange={(e) => setSceneDescription(e.target.value.slice(0, 500))}
            rows={4}
            placeholder="一位三十多岁的女子在巴黎一家路边咖啡馆里啜饮咖啡，温暖的秋日阳光洒在她脸上，神情放松。"
            className="mt-1 w-full resize-y rounded-xl border border-[#d2d2d7] px-4 py-3 text-sm font-normal"
          />
          <span className="mt-1 block text-xs text-[#7a7a7a]">
            {sceneDescription.length} / 500 个字符
          </span>
        </label>

        <div className="mt-4">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1d1d1f]">
            <Sun className="h-4 w-4" />
            灯光氛围
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {REALISTIC_LIGHTING_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setLighting(o.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium",
                  lighting === o.id ? ipTagSelectedClass : ipTagUnselectedClass,
                )}
              >
                {o.label}
              </button>
            ))}
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
                生成照片
              </span>
            )}
          </CtaButton>
        </div>
      </div>

      <section className="rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-[#1d1d1f]">你可以创造什么</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((c) => (
            <div
              key={c.title}
              className="rounded-xl border border-[#e5e5ea] bg-[#fafafa] p-4"
            >
              <c.icon className={cn("mb-2 h-5 w-5", c.color)} />
              <p className="text-sm font-semibold text-[#1d1d1f]">{c.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#7a7a7a]">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
