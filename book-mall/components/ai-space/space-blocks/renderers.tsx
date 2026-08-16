"use client";

/**
 * 作品墙自由画布 · 挂件渲染注册表
 *
 * 编辑器、公开页、属性面板全部遍历本表取组件。
 * **禁止**在任何业务组件里写 `blockType === "xxx"` 分支——新增挂件只加这里一条。
 * 约束见 .cursor/rules/ai-space-space-blocks.mdc。
 */

import {
  getSpaceBlockDef,
  type SpaceBlockType,
} from "@/lib/ai-space/space-blocks/types";
import { cn } from "@/lib/utils";

import {
  InspectorEmpty,
  type SpaceBlockInspectorProps,
  type SpaceBlockViewProps,
} from "./block-kit";
import {
  BeforeAfterBlockInspector,
  BeforeAfterBlockView,
  CharacterCardBlockInspector,
  CharacterCardBlockView,
  GalleryBlockInspector,
  GalleryBlockView,
  VideoPlaylistBlockInspector,
  VideoPlaylistBlockView,
} from "./collection-blocks";
import {
  AudioBlockInspector,
  AudioBlockView,
  ImageBlockInspector,
  ImageBlockView,
  VideoBlockInspector,
  VideoBlockView,
} from "./media-blocks";
import {
  DividerBlockInspector,
  DividerBlockView,
  HeadingBlockInspector,
  HeadingBlockView,
  LaunchButtonBlockInspector,
  LaunchButtonBlockView,
  ProfileCardBlockInspector,
  ProfileCardBlockView,
  TextBlockInspector,
  TextBlockView,
} from "./widget-blocks";

type SpaceBlockRenderer = {
  View: React.FC<SpaceBlockViewProps>;
  Inspector: React.FC<SpaceBlockInspectorProps>;
};

export const SPACE_BLOCK_RENDERERS: Record<SpaceBlockType, SpaceBlockRenderer> = {
  image: { View: ImageBlockView, Inspector: ImageBlockInspector },
  video: { View: VideoBlockView, Inspector: VideoBlockInspector },
  audio: { View: AudioBlockView, Inspector: AudioBlockInspector },
  gallery: { View: GalleryBlockView, Inspector: GalleryBlockInspector },
  before_after: { View: BeforeAfterBlockView, Inspector: BeforeAfterBlockInspector },
  character_card: {
    View: CharacterCardBlockView,
    Inspector: CharacterCardBlockInspector,
  },
  video_playlist: {
    View: VideoPlaylistBlockView,
    Inspector: VideoPlaylistBlockInspector,
  },
  heading: { View: HeadingBlockView, Inspector: HeadingBlockInspector },
  text: { View: TextBlockView, Inspector: TextBlockInspector },
  divider_spacer: { View: DividerBlockView, Inspector: DividerBlockInspector },
  profile_card: { View: ProfileCardBlockView, Inspector: ProfileCardBlockInspector },
  launch_button: { View: LaunchButtonBlockView, Inspector: LaunchButtonBlockInspector },
};

/**
 * 块外壳 + 内容。外框（底色 / 边框 / 块内小标题）在这里统一处理，
 * 各挂件的 View 只负责内容区。
 */
export function SpaceBlockContent(props: SpaceBlockViewProps) {
  const { block, theme } = props;
  const renderer = SPACE_BLOCK_RENDERERS[block.blockType];
  if (!renderer) return null;

  const framed = block.config.framed !== false;
  const title = typeof block.config.title === "string" ? block.config.title : "";

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden",
        framed ? "rounded-lg border p-2" : null,
      )}
      style={
        framed
          ? { background: theme.cardBg, borderColor: theme.border }
          : undefined
      }
    >
      {title ? (
        <p
          className="shrink-0 truncate pb-1.5 text-xs font-semibold"
          style={{ color: theme.text }}
        >
          {title}
        </p>
      ) : null}
      <div className="min-h-0 flex-1">
        <renderer.View {...props} />
      </div>
    </div>
  );
}

/** 属性面板：通用外框设置 + 挂件专属设置 */
export function SpaceBlockInspectorBody(props: SpaceBlockInspectorProps) {
  const def = getSpaceBlockDef(props.block.blockType);
  const renderer = SPACE_BLOCK_RENDERERS[props.block.blockType];
  if (!def || !renderer) {
    return <InspectorEmpty hint="该挂件类型已下线。" />;
  }
  return <renderer.Inspector {...props} />;
}
