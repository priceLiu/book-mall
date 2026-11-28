"use client";

import { Aperture, ChevronDown, Droplets, Package, Palette, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { ImageEditorColorGroupBody } from "@/components/image-editor/image-editor-color-controls";
import type { ColorAdjust } from "@/lib/image-editor-color-adjust";
import { colorAdjustIsNeutral, colorAdjustPreviewCss } from "@/lib/image-editor-color-adjust";
import { cn } from "@/lib/utils";

const COLOR_LOCK =
  "只调整颜色和影调。物体、数量、文字、商标、人脸身份、姿势、背景内容和构图必须保持不变。禁止磨皮换脸、重绘背景、改写文字。调色幅度必须肉眼可见，不要原样返回原图。";

export type ImageEditorColorGroup = "preset" | "basic" | "advanced" | "filter" | "recolor" | "product";

export type ImageEditorColorGrade = {
  id: string;
  label: string;
  group: ImageEditorColorGroup;
  prompt: string;
  preview?: string;
};

export const IMAGE_EDITOR_COLOR_GRADES: ImageEditorColorGrade[] = [
  {
    id: "clear",
    label: "清透",
    group: "preset",
    preview: "brightness(1.14) contrast(1.04) saturate(0.88)",
    prompt: "",
  },
  {
    id: "vivid",
    label: "增色",
    group: "preset",
    preview: "contrast(1.12) saturate(1.65)",
    prompt: `做选择性增色，不是整体拉饱和。已经很艳的颜色少加，偏灰的商品色、食物色、织物色增加彩度。中性灰、白色、黑色和肤色的色相保持，避免脸和背景一起变橙或变青。对比只加一点，用来托住颜色，不把暗部压死。包装上的专色尽量接近原色，只是更干净、更饱和。${COLOR_LOCK}禁止荧光色、色相偏移。`,
  },
  {
    id: "dehaze",
    label: "去雾",
    group: "preset",
    preview: "brightness(1.04) contrast(1.24) saturate(1.12)",
    prompt: `去掉镜头灰雾和发白的中间调。提高局部对比，让远近和材质层次回来。黑位略微压实，但不要死黑；高光不要裁切。白平衡保持拍摄时的冷暖，只去掉雾带来的发灰，不把阴天改成晴天，不改天空、灯光和天气。${COLOR_LOCK}禁止加清晰度光晕、假阳光。`,
  },
  {
    id: "texture",
    label: "质感",
    group: "preset",
    preview: "contrast(1.16) saturate(1.08)",
    prompt: `加强材质的微对比：陶瓷、木纹、织物、金属、玻璃按原材质更清楚，高光形状保持。中间调对比提高，暗部仍有细节。锐化只作用在真实边缘，不出现白边和振铃。色彩风格接近原片，不另加滤镜。不把皮肤或食物修成塑料。${COLOR_LOCK}禁止 HDR、过锐、虚构纹理。`,
  },
  {
    id: "natural",
    label: "自然",
    group: "preset",
    preview: "contrast(1.06) saturate(0.88)",
    prompt: `把偏色和过度风格拉回实拍。以画面中的白、灰、肤色为参照，校正白平衡到中性。饱和度回到物体真实颜色，过艳的压下来，发灰的只补到自然。对比接近现场光比，不死黑、不飘白。若原图已经正常，只做轻微整理，不要为了调过而再改一版。${COLOR_LOCK}禁止滤镜感、胶片颗粒、换光。`,
  },
  {
    id: "fade",
    label: "褪色",
    group: "preset",
    preview: "brightness(1.08) contrast(0.82) saturate(0.62) sepia(0.18)",
    prompt: `做轻度胶片褪色。暗部抬起一档，黑色变成深灰而不是纯黑。整体饱和下降，高光略暖、暗部略冷，色相偏移要小。中间调变柔，高光不要过曝。主体仍要认得清，文字仍可读。这是色彩风格变化，不是换一张旧照片，不添加划痕、灰尘、漏光。${COLOR_LOCK}`,
  },
  {
    id: "lift",
    label: "补光",
    group: "basic",
    prompt: `按补光处理。中间调和暗部提高约半档到一档，高光点保持，白色不裁切。颜色和白平衡不变，只让欠曝的主体看得见。${COLOR_LOCK}`,
  },
  {
    id: "darken",
    label: "压暗",
    group: "basic",
    prompt: `整体压暗约半档。暗部仍保留细节，不要死黑。高光收回一点，但白色物体仍是白的。色相不变。${COLOR_LOCK}`,
  },
  {
    id: "contrast-up",
    label: "提对比",
    group: "basic",
    prompt: `提高影调分离。黑位略压、高光略提，中间调层次更清楚。不要裁切高光，不要让暗部糊成一块。饱和度只随对比轻微变化，色相锁定。${COLOR_LOCK}`,
  },
  {
    id: "contrast-down",
    label: "降对比",
    group: "basic",
    prompt: `降低对比，让画面更柔。暗部略提起，高光略收回，主体仍然清楚。不发灰成雾，不改变色相。${COLOR_LOCK}`,
  },
  {
    id: "warm",
    label: "暖一点",
    group: "basic",
    prompt: `白平衡向暖移动一点。高光可略偏暖白，肤色仍是自然肤色，不要变成橙色。商品专色的色相尽量保持，只去掉过冷的青。${COLOR_LOCK}`,
  },
  {
    id: "cool",
    label: "冷一点",
    group: "basic",
    prompt: `白平衡向冷移动一点。白色更干净、略偏冷白。肤色不要发青，商品不要整个变成蓝色。只修正过暖的黄。${COLOR_LOCK}`,
  },
  {
    id: "highlight-up",
    label: "提亮高光",
    group: "advanced",
    prompt: `只提亮高光和上中间调。白色物体更亮，但保留高光里的纹理，不裁成死白。暗部和主体中间调基本不动。${COLOR_LOCK}`,
  },
  {
    id: "shadow-open",
    label: "找回暗部",
    group: "advanced",
    prompt: `只打开暗部。黑位仍在，暗部里的衣服、阴影、商品细节看得见。高光和整体曝光不要一起变亮。不要把画面提成发灰。${COLOR_LOCK}`,
  },
  {
    id: "highlight-roll",
    label: "压高光",
    group: "advanced",
    prompt: `只压高光。过亮的白墙、天空、反光收回层次，中间调和暗部保持原来的亮度。不要把整个画面压暗。${COLOR_LOCK}`,
  },
  {
    id: "skin-protect",
    label: "肤色保护",
    group: "advanced",
    prompt: `可以轻微整理画面影调，但肤色色相、明度和质感锁定在自然范围。不要磨皮，不要美白，不要改变五官。背景和衣服可以更干净，脸不能变成另一个颜色。${COLOR_LOCK}`,
  },
  {
    id: "brand-color",
    label: "专色加强",
    group: "advanced",
    prompt: `只加强商品、包装、食物或织物上原本的专色，让它更干净、更饱和。灰色背景、白色、黑色和肤色不要跟着变色。不把专色改成另一种颜色。${COLOR_LOCK}`,
  },
  {
    id: "cream",
    label: "奶油",
    group: "filter",
    prompt: `奶油色调。高光柔和滚降，对比略低，整体略暖，暗部轻轻提起。颜色干净，不要发黄成旧纸。肤色和商品仍可辨认。${COLOR_LOCK}禁止漏光和颗粒。`,
  },
  {
    id: "film",
    label: "胶片",
    group: "filter",
    prompt: `轻度负片色彩。肩部高光变柔，暗部略抬，饱和适中，高光偏暖、暗部略冷。不要加划痕、灰尘、颗粒或漏光。文字保持可读。${COLOR_LOCK}`,
  },
  {
    id: "cool-white",
    label: "冷白",
    group: "filter",
    prompt: `冷白商业色。白色和浅灰干净、略冷，对比清楚，饱和克制。肤色不要发青。适合商品和室内，不改成夜景。${COLOR_LOCK}`,
  },
  {
    id: "warm-food",
    label: "暖食",
    group: "filter",
    prompt: `暖食色。食物、木质、暖色织物更有食欲，高光略暖。如果画面里没有食物，只做轻微暖调，不要把人和白墙染成橙色。${COLOR_LOCK}`,
  },
  {
    id: "sharpen",
    label: "锐化",
    group: "filter",
    preview: "contrast(1.18)",
    prompt: "",
  },
  {
    id: "aqua",
    label: "碧波",
    group: "filter",
    preview: "hue-rotate(18deg) saturate(1.25) brightness(1.04)",
    prompt: "",
  },
  {
    id: "hyper",
    label: "全彩",
    group: "filter",
    preview: "saturate(1.85) contrast(1.12)",
    prompt: "",
  },
  {
    id: "soft",
    label: "柔光",
    group: "filter",
    preview: "brightness(1.08) contrast(0.78) saturate(0.9)",
    prompt: "",
  },
  {
    id: "muted",
    label: "低饱和",
    group: "filter",
    prompt: `编辑式低饱和。彩度明显降低，但不要变成黑白。肤色保留一点血色，商品色仍能分出色相。对比保持适中。${COLOR_LOCK}`,
  },
  {
    id: "bg-light",
    label: "背景变浅",
    group: "recolor",
    prompt: `只把背景变浅。主体、商品、人物的颜色、亮度和边缘保持原样。背景变浅后仍要看得出原来的场景，不要直接换成纯白棚。${COLOR_LOCK}`,
  },
  {
    id: "bg-dark",
    label: "背景变深",
    group: "recolor",
    prompt: `只把背景变深。主体曝光和颜色不变，边缘干净，不要把主体一起压暗，不要把背景涂成一块纯黑。${COLOR_LOCK}`,
  },
  {
    id: "product-true",
    label: "商品色更正",
    group: "recolor",
    prompt: `把商品颜色校正到更接近实物的干净颜色。去掉环境色污染造成的偏色。不把商品换成另一种颜色，不改包装图案和文字。背景尽量保持。${COLOR_LOCK}`,
  },
  {
    id: "warm-white",
    label: "整体偏暖白",
    group: "recolor",
    prompt: `整体白平衡改到暖白。白色带一点暖，但不要橙。商品色相尽量保持，只跟随白平衡轻微移动。${COLOR_LOCK}`,
  },
  {
    id: "cool-white-balance",
    label: "整体偏冷白",
    group: "recolor",
    prompt: `整体白平衡改到冷白。白色干净、略冷，不要青、不要蓝。商品色相尽量保持。${COLOR_LOCK}`,
  },
  {
    id: "white-bg",
    label: "白底干净",
    group: "product",
    prompt: `若背景已经接近白色或浅灰，把它整理成均匀的干净白，去掉灰雾和色斑。商品边缘保持，不吃进商品，不给商品加新的投影。商品颜色、文字、形状不变。若背景明显不是浅色场景，不要硬换成白棚。${COLOR_LOCK}`,
  },
  {
    id: "food",
    label: "美食",
    group: "product",
    prompt: `按美食商业片调色。食物的固有色更清楚，高光油润但不死白，暗部保留食材纹理。餐具和桌面不要抢过食物。不增加摆盘，不改食物形状。${COLOR_LOCK}`,
  },
  {
    id: "fabric",
    label: "服饰面料",
    group: "product",
    prompt: `按服饰精修调色。面料织纹、缝线和服装原色更清楚。白色衣服不要发黄，黑色衣服不要发灰。不要改变版型、褶皱位置和印花内容。${COLOR_LOCK}`,
  },
  {
    id: "metal-glass",
    label: "金属玻璃",
    group: "product",
    prompt: `按金属和玻璃精修。高光形状保持，金属反射更干净，玻璃通透，不要把高光涂成白块。透明物体后面的内容仍要看得见。不改造型。${COLOR_LOCK}`,
  },
  {
    id: "gift",
    label: "礼盒包装",
    group: "product",
    prompt: `按礼盒和包装精修。纸张、缎带、烫金和印刷色更干净，文字只变清楚不改写。盒子结构、结和阴影方向不变。不新增装饰。${COLOR_LOCK}`,
  },
];

export function imageEditorColorGrade(id: string): ImageEditorColorGrade | undefined {
  return IMAGE_EDITOR_COLOR_GRADES.find((item) => item.id === id);
}

const GROUPS: Array<{ id: Exclude<ImageEditorColorGroup, "preset">; label: string; icon: ReactNode }> = [
  { id: "basic", label: "基础调色", icon: <SlidersHorizontal className="h-4 w-4" aria-hidden /> },
  { id: "advanced", label: "高级调色", icon: <Aperture className="h-4 w-4" aria-hidden /> },
  { id: "filter", label: "滤镜", icon: <Droplets className="h-4 w-4" aria-hidden /> },
  { id: "recolor", label: "一键换色", icon: <Palette className="h-4 w-4" aria-hidden /> },
  { id: "product", label: "商品精修", icon: <Package className="h-4 w-4" aria-hidden /> },
];

type Props = {
  imageUrl: string | null;
  selectedId: string | null;
  openGroup: ImageEditorColorGroup | null;
  busy: boolean;
  eraseArmed: boolean;
  eraseBrush: number;
  onOpenGroup: (group: ImageEditorColorGroup | null) => void;
  onResetSelection: () => void;
  onPick: (id: string) => void;
  onAdjust: (adjust: ColorAdjust, label: string) => void;
  onPreview: (css: string | null) => void;
  onRestore: () => void;
  onEraseArm: (armed: boolean) => void;
  onEraseBrush: (size: number) => void;
  onEraseClear: () => void;
};

export function ImageEditorColorPanel({
  imageUrl,
  selectedId,
  openGroup,
  busy,
  eraseArmed,
  eraseBrush,
  onOpenGroup,
  onResetSelection,
  onPick,
  onAdjust,
  onPreview,
  onRestore,
  onEraseArm,
  onEraseBrush,
  onEraseClear,
}: Props) {
  const presets = IMAGE_EDITOR_COLOR_GRADES.filter((item) => item.group === "preset");
  const [draft, setDraft] = useState<ColorAdjust>({});
  const sentAdjust = useRef("");

  useEffect(() => {
    if (!selectedId) return;
    setDraft({});
    sentAdjust.current = "";
  }, [selectedId]);

  const onDraft = (next: ColorAdjust, commit: boolean, label: string) => {
    setDraft(next);
    if (!commit) {
      onPreview(colorAdjustIsNeutral(next) ? null : colorAdjustPreviewCss(next));
      return;
    }
    onPreview(null);
    if (colorAdjustIsNeutral(next)) {
      if (sentAdjust.current) {
        sentAdjust.current = "";
        onRestore();
      }
      return;
    }
    const key = JSON.stringify(next);
    if (key === sentAdjust.current) return;
    sentAdjust.current = key;
    onAdjust(next, label);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] shadow-sm">
      <div className="ecom-scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--ie-ink)]">调色预设</h2>
            <button
              type="button"
              aria-label="重置选择"
              disabled={busy}
              className="grid h-7 w-7 place-items-center rounded-full text-[var(--ie-muted)] disabled:opacity-50"
              onClick={onResetSelection}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {presets.map((item) => (
              <GradeButton key={item.id} item={item} imageUrl={imageUrl} selected={selectedId === item.id} busy={busy} onPick={onPick} />
            ))}
          </div>
        </section>

        {GROUPS.map((group) => {
          const open = openGroup === group.id;
          return (
            <section key={group.id} className="overflow-hidden rounded-xl bg-white">
              <button
                type="button"
                disabled={busy}
                aria-expanded={open}
                className="flex w-full items-center gap-2 px-3 py-3 text-left text-[13px] text-[var(--ie-ink)] disabled:opacity-50"
                onClick={() => onOpenGroup(open ? null : group.id)}
              >
                {group.icon}
                <span className="flex-1 font-medium">{group.label}</span>
                <ChevronDown className={cn("h-4 w-4 text-[var(--ie-muted)] transition-transform", open && "rotate-180")} aria-hidden />
              </button>
              {open ? (
                <ImageEditorColorGroupBody
                  group={group.id}
                  imageUrl={imageUrl}
                  disabled={busy}
                  selectedId={selectedId}
                  draft={draft}
                  onDraft={onDraft}
                  onPick={onPick}
                  onAdjust={onAdjust}
                  onRestore={onRestore}
                  onOpenBasic={() => onOpenGroup("basic")}
                  eraseArmed={eraseArmed}
                  eraseBrush={eraseBrush}
                  onEraseArm={onEraseArm}
                  onEraseBrush={onEraseBrush}
                  onEraseClear={onEraseClear}
                />
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function GradeButton({
  item,
  imageUrl,
  selected,
  busy,
  onPick,
}: {
  item: ImageEditorColorGrade;
  imageUrl: string | null;
  selected: boolean;
  busy: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={selected}
      className={cn(
        "overflow-hidden rounded-lg border bg-white text-left disabled:opacity-50",
        selected ? "border-[var(--ie-ink)]" : "border-transparent",
      )}
      onClick={() => onPick(item.id)}
    >
      <span className="block aspect-square overflow-hidden bg-[var(--ie-cream-muted)]">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" style={{ filter: item.preview }} />
        ) : null}
      </span>
      <span className="block truncate px-1 py-1 text-center text-[12px] text-[var(--ie-ink)]">{item.label}</span>
    </button>
  );
}
