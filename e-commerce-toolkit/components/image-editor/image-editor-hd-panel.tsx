"use client";

import { Gamepad2, LayoutGrid, ShoppingBag, Sparkles, Type, UserRound, Users, Wand2 } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const IMAGE_EDITOR_HD_MODES = [
  "hd",
  "ultra",
  "repair",
  "product",
  "portrait",
  "text",
  "blurry",
  "anime",
  "old-photo",
] as const;

export type ImageEditorHdMode = (typeof IMAGE_EDITOR_HD_MODES)[number];

const HD_KEEP_SIZE =
  "输出与输入是同一幅画面、同一裁切、同一画面比例。只提升清晰度，不放大画布，不重新构图，不磨皮，不塑形，不新增或删除任何物体，不改写文字。";

const HD_REBUILD =
  "在同一构图、同一主体位置、同一裁切比例上提升清晰度，达到可印刷的细节。可以重建被模糊掉的合理细节，但不能换成另一张图，不能改变姿势、机位或场景。";

const HD_PROMPTS: Record<ImageEditorHdMode, string> = {
  hd: `按商业修图做轻度清晰化。抑制噪点、色彩噪点和轻微压缩块，恢复被虚化的边缘和中频细节，微对比适中，高光和阴影不裁切。肤色、商品色、白平衡和光线方向保持原样。人物身份、五官、姿势、服装、文字、商标、背景物体全部保持不变。`,
  ultra: `做超分辨率级细节重建。分区域处理：皮肤保留毛孔和细纹，不磨成塑料；织物保留织纹和缝线；金属、玻璃、皮革按原材质恢复高光；头发和毛发逐缕变清楚；建筑和产品边缘干净，不出现光晕。噪点和压缩伪影去掉，微对比提高，整体光比和色彩风格不变。人物身份、表情、体态、商品款式、包装文字、背景结构严格保持。禁止换脸、美颜变形、虚构配件、改场景、改镜头焦段。`,
  repair: `一次完成降噪、去模糊、校色和清晰度恢复。先处理过曝压高光、欠曝提暗部、偏色回到中性肤色和商品色，去掉色带和 JPEG 色块，再锐化真正的边缘。校色只修正明显问题，不把照片改成另一种滤镜。主体、构图、文字、商标、人物身份保持不变。禁止过度饱和、假 HDR、塑料皮肤、重绘背景。`,
  product: `按电商主图标准增强。包装轮廓、瓶盖、缝线、材质纹理、标签和印刷文字边缘要清楚，台面或背景的光影关系保持。商品形状、颜色、容量、图案、摆放角度和数量不变。标签上的字只变清晰，不改写、不纠错、不补成别的词。不新增道具，不换背景，不加倒影或装饰，不改变商品比例。`,
  portrait: `按人像精修增强清晰度。眼睛、睫毛、眉毛、发丝、衣物纹理变清楚。皮肤保留真实质感，只去掉噪点和模糊，不磨皮、不液化、不瘦脸。五官比例、身份、年龄感、表情、妆容、服装、配饰和背景保持原样。禁止换脸、大眼、美白、改变发型、改变姿势。`,
  text: `专门提高文字和标志的可读性。笔画边缘利落，字间距和字重保持原设计，去掉文字周围的模糊和振铃。每个字符的内容、语言、顺序、大小写、标点和排版位置必须与原图一致。看不清的字宁可保持模糊，也不许猜成另一个字。不重排版，不改字体风格，不改底色，不改文字以外的画面。`,
  blurry: `针对严重失焦和低分辨率做谨慎重建。只恢复能从画面结构推断出来的边缘、轮廓和材质，不发明原图里不存在的图案、人脸细节或文字。主体是谁、有几个人或几件商品、他们的位置和大致姿态必须保持。若某处信息已经丢失，保持柔和，不要硬画成另一张清晰照片。不换背景，不改构图。`,
  anime: `按二次元和游戏原画增强。线稿更干净，色块边界清楚，平涂和赛璐璐阴影保持，网点或描边风格不变。角色脸型、发型、服装设定、画风和配色严格保持。禁止改成写实照片，禁止添加新的光影体积、皮肤毛孔或写实景深，禁止重绘五官。`,
  "old-photo": `按老照片修复处理。减轻褪色、灰雾、划痕、灰尘和粗颗粒，暗部层次拉回来，偏色只校正到自然，保留年代感，不要修成现代数码照片。人物身份、服装、场景和损伤以外的内容保持不变。划痕和污点用周围纹理补上。禁止磨皮换脸。原图是黑白则保持黑白，不要把黑白强行变成鲜艳彩色，也不要补上原来没有的人。`,
};

export function imageEditorHdPrompt(mode: ImageEditorHdMode, keepOriginalSize: boolean): string {
  if (mode !== "hd") return HD_PROMPTS[mode];
  return `${HD_PROMPTS.hd}${keepOriginalSize ? HD_KEEP_SIZE : HD_REBUILD}`;
}

export function imageEditorHdModeLabel(mode: ImageEditorHdMode): string {
  return HD_ITEMS.find((item) => item.id === mode)?.label ?? "变清晰";
}

type HdItem = {
  id: ImageEditorHdMode;
  label: string;
  group: "general" | "scene";
  hint?: string;
  icon: ReactNode;
};

const iconClass = "h-4 w-4";

const HD_ITEMS: HdItem[] = [
  { id: "hd", label: "高清", group: "general", icon: <span className="text-[11px] font-semibold tracking-tight">HD</span> },
  { id: "ultra", label: "AI超清", group: "general", icon: <Sparkles className={iconClass} aria-hidden /> },
  {
    id: "repair",
    label: "全能修复",
    group: "general",
    hint: "降噪、校色、超分，一步到位。",
    icon: <Wand2 className={iconClass} aria-hidden />,
  },
  { id: "product", label: "商品", group: "scene", icon: <ShoppingBag className={iconClass} aria-hidden /> },
  { id: "portrait", label: "人像", group: "scene", icon: <UserRound className={iconClass} aria-hidden /> },
  { id: "text", label: "文本", group: "scene", icon: <Type className={iconClass} aria-hidden /> },
  { id: "blurry", label: "高糊图", group: "scene", icon: <LayoutGrid className={iconClass} aria-hidden /> },
  { id: "anime", label: "游戏动漫", group: "scene", icon: <Gamepad2 className={iconClass} aria-hidden /> },
  { id: "old-photo", label: "老照片", group: "scene", icon: <Users className={iconClass} aria-hidden /> },
];

type Props = {
  mode: ImageEditorHdMode;
  keepOriginalSize: boolean;
  busy: boolean;
  disabled: boolean;
  onMode: (mode: ImageEditorHdMode) => void;
  onKeepOriginalSize: (keep: boolean) => void;
  onStart: () => void;
};

export function ImageEditorHdPanel({
  mode,
  keepOriginalSize,
  busy,
  disabled,
  onMode,
  onKeepOriginalSize,
  onStart,
}: Props) {
  const general = HD_ITEMS.filter((item) => item.group === "general");
  const scene = HD_ITEMS.filter((item) => item.group === "scene");

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] shadow-sm">
      <div className="ecom-scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-[var(--ie-ink)]">通用</h2>
          {general.map((item) => {
            const selected = mode === item.id;
            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-xl border px-3 py-2.5",
                  selected ? "border-[var(--ie-ink)] bg-white" : "border-transparent bg-[var(--ie-cream-muted)]",
                )}
              >
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={selected}
                  className="flex w-full items-center gap-2 text-left text-[var(--ie-ink)] disabled:opacity-50"
                  onClick={() => onMode(item.id)}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white text-[var(--ie-ink)]">
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium">{item.label}</span>
                    {item.hint ? <span className="mt-0.5 block text-[12px] leading-snug text-[var(--ie-muted)]">{item.hint}</span> : null}
                  </span>
                </button>
                {item.id === "hd" && selected ? (
                  <div className="mt-2 flex items-center justify-between gap-3 border-t border-[var(--ie-border-soft)] pt-2">
                    <span className="text-[12px] text-[var(--ie-muted)]">原图尺寸</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={keepOriginalSize}
                      aria-label="原图尺寸"
                      disabled={busy}
                      className={cn(
                        "relative h-6 w-10 shrink-0 rounded-full disabled:opacity-50",
                        keepOriginalSize ? "bg-[var(--ie-ink)]" : "bg-[#d9d1c6]",
                      )}
                      onClick={() => onKeepOriginalSize(!keepOriginalSize)}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm",
                          keepOriginalSize ? "left-[18px]" : "left-0.5",
                        )}
                      />
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-[var(--ie-ink)]">场景</h2>
          <p className="text-[12px] leading-snug text-[var(--ie-muted)]">针对特定场景优化，尽显专业级清晰度。</p>
          <div className="grid grid-cols-3 gap-2">
            {scene.map((item) => {
              const selected = mode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={busy}
                  aria-pressed={selected}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border px-1 py-3 text-[12px] disabled:opacity-50",
                    selected
                      ? "border-[var(--ie-ink)] bg-white font-medium text-[var(--ie-ink)]"
                      : "border-transparent bg-[var(--ie-cream-muted)] text-[var(--ie-ink)]",
                  )}
                  onClick={() => onMode(item.id)}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </div>
        </section>
      </div>
      <div className="border-t border-[var(--ie-border-soft)] p-3">
        <button
          type="button"
          disabled={disabled || busy}
          className="h-10 w-full rounded-lg bg-[var(--ecom-btn-fill)] text-[13px] font-medium text-[var(--ecom-btn-on-fill)] hover:bg-[var(--ecom-btn-fill-hover)] disabled:opacity-50"
          onClick={onStart}
        >
          变清晰
        </button>
      </div>
    </div>
  );
}
