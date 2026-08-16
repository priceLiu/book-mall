"use client";

/**
 * 挂件 · 单图卡 / 视频播放器 / 音频播放器
 *
 * 注册见 ./renderers.tsx；配置类型见 lib/ai-space/space-blocks/types.ts。
 */

import { MEDIA_FITS } from "@/lib/ai-space/space-blocks/types";

import { AiSpaceAudioControls } from "../ai-space-audio-controls";
import {
  InspectorRow,
  InspectorSection,
  InspectorSelect,
  InspectorToggle,
  readConfig,
  SpaceEmptySlot,
  SpaceImage,
  SpaceMissingAsset,
  SpaceVideo,
  useInView,
  type SpaceBlockInspectorProps,
  type SpaceBlockViewProps,
} from "./block-kit";

const FIT_OPTIONS = [
  { value: "cover" as const, label: "裁切填满" },
  { value: "contain" as const, label: "完整显示" },
];

// ---------------------------------------------------------------------------
// 单图卡
// ---------------------------------------------------------------------------

export function ImageBlockView({
  block,
  readOnly,
  theme,
  onOpenLightbox,
}: SpaceBlockViewProps) {
  const ref = block.refs[0];
  if (!ref) {
    return <SpaceEmptySlot label="放一张图" readOnly={readOnly} theme={theme} />;
  }
  if (!ref.resolved) return <SpaceMissingAsset readOnly={readOnly} theme={theme} />;

  const fit = readConfig<"cover" | "contain">(block, "fit", "cover");
  const showCaption = readConfig(block, "showCaption", true);
  const caption = ref.caption ?? ref.resolved.title;

  return (
    <figure className="flex h-full w-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1">
        <SpaceImage
          ref={ref}
          fit={fit}
          onClick={onOpenLightbox ? () => onOpenLightbox([ref], 0) : undefined}
        />
      </div>
      {showCaption && caption ? (
        <figcaption
          className="shrink-0 truncate px-2 pt-1.5 text-xs"
          style={{ color: theme.mutedText }}
        >
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function ImageBlockInspector({
  block,
  onConfigChange,
}: SpaceBlockInspectorProps) {
  return (
    <InspectorSection title="图片">
      <InspectorRow label="填充方式">
        <InspectorSelect
          value={readConfig<(typeof MEDIA_FITS)[number]>(block, "fit", "cover")}
          options={FIT_OPTIONS}
          onChange={(fit) => onConfigChange({ fit })}
        />
      </InspectorRow>
      <InspectorRow label="显示标题">
        <InspectorToggle
          checked={readConfig(block, "showCaption", true)}
          onChange={(showCaption) => onConfigChange({ showCaption })}
        />
      </InspectorRow>
    </InspectorSection>
  );
}

// ---------------------------------------------------------------------------
// 视频播放器
// ---------------------------------------------------------------------------

export function VideoBlockView({ block, readOnly, theme }: SpaceBlockViewProps) {
  const ref = block.refs[0];
  if (!ref) {
    return <SpaceEmptySlot label="放一条视频" readOnly={readOnly} theme={theme} />;
  }
  if (!ref.resolved) return <SpaceMissingAsset readOnly={readOnly} theme={theme} />;

  return (
    <SpaceVideo
      ref={ref}
      fit={readConfig<"cover" | "contain">(block, "fit", "contain")}
      loop={readConfig(block, "loop", false)}
      muted={readConfig(block, "muted", true)}
      autoplay={readConfig(block, "autoplay", false)}
      className="rounded-md"
    />
  );
}

export function VideoBlockInspector({
  block,
  onConfigChange,
}: SpaceBlockInspectorProps) {
  const muted = readConfig(block, "muted", true);
  return (
    <InspectorSection title="视频">
      <InspectorRow label="填充方式">
        <InspectorSelect
          value={readConfig<(typeof MEDIA_FITS)[number]>(block, "fit", "contain")}
          options={FIT_OPTIONS}
          onChange={(fit) => onConfigChange({ fit })}
        />
      </InspectorRow>
      <InspectorRow label="循环播放">
        <InspectorToggle
          checked={readConfig(block, "loop", false)}
          onChange={(loop) => onConfigChange({ loop })}
        />
      </InspectorRow>
      <InspectorRow label="静音">
        <InspectorToggle
          checked={muted}
          onChange={(next) =>
            // 取消静音时必须同时关自动播放，否则浏览器会拦截
            onConfigChange(next ? { muted: true } : { muted: false, autoplay: false })
          }
        />
      </InspectorRow>
      <InspectorRow label="自动播放">
        <InspectorToggle
          checked={readConfig(block, "autoplay", false)}
          onChange={(autoplay) => onConfigChange({ autoplay })}
        />
      </InspectorRow>
      {muted ? null : (
        <p className="text-[11px] leading-relaxed text-[#8c959f]">
          未静音时浏览器会拦截自动播放，该开关不生效。
        </p>
      )}
    </InspectorSection>
  );
}

// ---------------------------------------------------------------------------
// 音频播放器
// ---------------------------------------------------------------------------

export function AudioBlockView({ block, readOnly, theme }: SpaceBlockViewProps) {
  const [holderRef, inView] = useInView<HTMLDivElement>();
  const ref = block.refs[0];
  if (!ref) {
    return <SpaceEmptySlot label="放一条音频" readOnly={readOnly} theme={theme} />;
  }
  if (!ref.resolved) return <SpaceMissingAsset readOnly={readOnly} theme={theme} />;

  const showScript = readConfig(block, "showScript", false);
  const title = ref.caption ?? ref.resolved.title;

  return (
    <div ref={holderRef} className="flex h-full w-full flex-col gap-2 p-1">
      {title ? (
        <p className="truncate text-xs font-medium" style={{ color: theme.text }}>
          {title}
        </p>
      ) : null}
      {inView ? (
        <AiSpaceAudioControls className="w-full" src={ref.resolved.mediaUrl} />
      ) : (
        <div className="h-8 rounded" style={{ background: theme.border }} />
      )}
      {showScript && ref.resolved.prompt ? (
        <p
          className="min-h-0 flex-1 overflow-y-auto text-[11px] leading-relaxed"
          style={{ color: theme.mutedText }}
        >
          {ref.resolved.prompt}
        </p>
      ) : null}
    </div>
  );
}

export function AudioBlockInspector({
  block,
  onConfigChange,
}: SpaceBlockInspectorProps) {
  return (
    <InspectorSection title="音频">
      <InspectorRow label="显示台词">
        <InspectorToggle
          checked={readConfig(block, "showScript", false)}
          onChange={(showScript) => onConfigChange({ showScript })}
        />
      </InspectorRow>
    </InspectorSection>
  );
}
