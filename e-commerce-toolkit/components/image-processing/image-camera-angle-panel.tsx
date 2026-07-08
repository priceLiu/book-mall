"use client";

import { useEffect, useState } from "react";
import { Camera, Loader2 } from "lucide-react";

import {
  buildGenerativeSubmitParams,
  ImageGenerativeSettings,
} from "@/components/image-processing/image-generative-settings";
import { ImageSingleUpload } from "@/components/image-processing/image-single-upload";
import { submitImageProcessingEdit } from "@/lib/ecom-image-processing-api";
import {
  CAMERA_ANGLE_OPTIONS,
  isSeedreamLiteModel,
} from "@/lib/image-processing-presets";

export function ImageCameraAnglePanel({
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
  const [cameraAngle, setCameraAngle] = useState("side-profile");
  const [extraGuidance, setExtraGuidance] = useState("");
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
      onError("请上传图片", "先上传待转换角度的照片");
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
        mode: "camera-angle",
        generativeModel,
        sourceImageDataUrl: image,
        cameraAngle,
        extraGuidance: extraGuidance.trim() || undefined,
        styleImageDataUrl: styleImage ?? undefined,
        parameters: submitParams,
      });
      onResults(res.imageUrls);
    } catch (e) {
      onError("角度转换失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    {
      title: "请输入您的内容",
      desc: "上传照片，选择目标相机角度，可选填写额外指导。",
    },
    {
      title: "点击生成",
      desc: "经 Gateway 调用百炼 / Seedream 模型，数秒内完成角度转换。",
    },
    {
      title: "下载并分享",
      desc: "结果保存到「我的资产」，可免费用于个人与商业用途。",
    },
  ];

  return (
    <div className="mt-6 space-y-4 sm:mt-8 sm:space-y-6">
      <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-3 text-sm leading-relaxed text-[#1d1d1f] sm:px-4">
        在保持拍摄对象、服装与场景一致的情况下，改变照片拍摄角度——四分之三侧面、侧面、俯视、过肩等。经 Gateway 调用 Qwen 图像编辑与 Seedream 模型。
      </div>

      <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-sm sm:p-6">
        <ImageSingleUpload
          image={image}
          onChange={setImage}
          onError={onError}
          icon={Camera}
          emptyLabel="上传照片以调整角度"
          emptyHint="JPG、PNG、WebP，最大 10MB"
        />

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">目标相机角度</label>
            <select
              value={cameraAngle}
              onChange={(e) => setCameraAngle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
            >
              {CAMERA_ANGLE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-[#1d1d1f]">
              额外指导（可选）
            </label>
            <input
              type="text"
              value={extraGuidance}
              onChange={(e) => setExtraGuidance(e.target.value)}
              placeholder="例如：略微倾斜，更紧凑地构图"
              className="mt-1 w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
            />
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
          hideImageCount={
            !isSeedreamLiteModel(generativeModel) &&
            generativeModel !== "qwen-image-edit-max"
          }
        />

        <div className="mt-6 flex flex-col gap-3 border-t border-[#e5e5ea] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-[#6e6e73]">每张图片约 500–1000 积分</span>
          <CtaButton disabled={submitting} onClick={() => void onSubmit()} className="w-full sm:w-auto">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            改变角度
          </CtaButton>
        </div>
      </div>

      <section className="rounded-2xl border border-[#e5e5ea] bg-white p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-[#1d1d1f]">如何使用 AI 相机角度转换器</h3>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
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
