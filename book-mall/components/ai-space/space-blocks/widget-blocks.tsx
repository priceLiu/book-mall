"use client";

/**
 * 挂件 · 标题 / 文字 / 分隔线留白 / 个人名片 / 继续创作按钮
 *
 * 注册见 ./renderers.tsx。
 * 文字类一律 **纯文本** 渲染（公开页会展示，不接受 HTML）。
 */

import { launchHref } from "@/lib/ai-space/ai-space-launch";
import {
  ALIGNS,
  BUTTON_VARIANTS,
  DIVIDER_VARIANTS,
  TEXT_SIZES,
  type SpaceProfileLink,
} from "@/lib/ai-space/space-blocks/types";
import { cn } from "@/lib/utils";

import {
  InspectorEmpty,
  InspectorRow,
  InspectorSection,
  InspectorSelect,
  InspectorText,
  InspectorTextarea,
  InspectorToggle,
  readConfig,
  SpaceEmptySlot,
  SpaceImage,
  type SpaceBlockInspectorProps,
  type SpaceBlockViewProps,
} from "./block-kit";

const ALIGN_CLASS: Record<(typeof ALIGNS)[number], string> = {
  left: "text-left items-start",
  center: "text-center items-center",
  right: "text-right items-end",
};

const ALIGN_OPTIONS = [
  { value: "left" as const, label: "左对齐" },
  { value: "center" as const, label: "居中" },
  { value: "right" as const, label: "右对齐" },
];

// ---------------------------------------------------------------------------
// 标题
// ---------------------------------------------------------------------------

const HEADING_SIZE: Record<number, string> = {
  1: "text-2xl font-bold",
  2: "text-lg font-semibold",
  3: "text-sm font-semibold tracking-wide",
};

export function HeadingBlockView({ block, theme }: SpaceBlockViewProps) {
  const level = readConfig(block, "level", 2);
  const align = readConfig<(typeof ALIGNS)[number]>(block, "align", "left");
  const text = block.content?.text ?? "";

  return (
    <div className={cn("flex h-full w-full flex-col justify-center", ALIGN_CLASS[align])}>
      <p
        className={cn("w-full truncate", HEADING_SIZE[level] ?? HEADING_SIZE[2])}
        style={{ color: theme.text }}
      >
        {text || "新标题"}
      </p>
    </div>
  );
}

export function HeadingBlockInspector({
  block,
  onConfigChange,
  onContentChange,
}: SpaceBlockInspectorProps) {
  return (
    <InspectorSection title="标题">
      <InspectorTextarea
        value={block.content?.text ?? ""}
        placeholder="标题文字"
        maxLength={120}
        rows={2}
        onChange={onContentChange}
      />
      <InspectorRow label="层级">
        <InspectorSelect
          value={String(readConfig(block, "level", 2))}
          options={[
            { value: "1", label: "一级（最大）" },
            { value: "2", label: "二级" },
            { value: "3", label: "三级（小标）" },
          ]}
          onChange={(v) => onConfigChange({ level: Number(v) })}
        />
      </InspectorRow>
      <InspectorRow label="对齐">
        <InspectorSelect
          value={readConfig<(typeof ALIGNS)[number]>(block, "align", "left")}
          options={ALIGN_OPTIONS}
          onChange={(align) => onConfigChange({ align })}
        />
      </InspectorRow>
    </InspectorSection>
  );
}

// ---------------------------------------------------------------------------
// 文字
// ---------------------------------------------------------------------------

const TEXT_SIZE_CLASS: Record<(typeof TEXT_SIZES)[number], string> = {
  sm: "text-[11px]",
  md: "text-xs",
  lg: "text-sm",
};

export function TextBlockView({ block, readOnly, theme }: SpaceBlockViewProps) {
  const align = readConfig<(typeof ALIGNS)[number]>(block, "align", "left");
  const size = readConfig<(typeof TEXT_SIZES)[number]>(block, "size", "md");
  const text = block.content?.text ?? "";

  if (!text) {
    return (
      <SpaceEmptySlot label="写点什么" readOnly={readOnly} theme={theme} />
    );
  }

  return (
    <div className={cn("flex h-full w-full flex-col", ALIGN_CLASS[align])}>
      {/* whitespace-pre-wrap 保留换行；纯文本渲染，不解析 HTML */}
      <p
        className={cn(
          "w-full overflow-y-auto whitespace-pre-wrap leading-relaxed",
          TEXT_SIZE_CLASS[size],
        )}
        style={{ color: theme.mutedText }}
      >
        {text}
      </p>
    </div>
  );
}

export function TextBlockInspector({
  block,
  onConfigChange,
  onContentChange,
}: SpaceBlockInspectorProps) {
  return (
    <InspectorSection title="文字">
      <InspectorTextarea
        value={block.content?.text ?? ""}
        placeholder="段落内容"
        maxLength={2000}
        rows={6}
        onChange={onContentChange}
      />
      <InspectorRow label="字号">
        <InspectorSelect
          value={readConfig<(typeof TEXT_SIZES)[number]>(block, "size", "md")}
          options={[
            { value: "sm", label: "小" },
            { value: "md", label: "标准" },
            { value: "lg", label: "大" },
          ]}
          onChange={(size) => onConfigChange({ size })}
        />
      </InspectorRow>
      <InspectorRow label="对齐">
        <InspectorSelect
          value={readConfig<(typeof ALIGNS)[number]>(block, "align", "left")}
          options={ALIGN_OPTIONS}
          onChange={(align) => onConfigChange({ align })}
        />
      </InspectorRow>
    </InspectorSection>
  );
}

// ---------------------------------------------------------------------------
// 分隔线 / 留白
// ---------------------------------------------------------------------------

export function DividerBlockView({ block, theme }: SpaceBlockViewProps) {
  const variant = readConfig<(typeof DIVIDER_VARIANTS)[number]>(
    block,
    "variant",
    "line",
  );

  if (variant === "space") return <div className="h-full w-full" />;

  if (variant === "dots") {
    return (
      <div className="flex h-full w-full items-center justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: theme.mutedText }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center">
      <hr
        className="w-full"
        style={{
          borderTopWidth: 1,
          borderTopStyle: variant === "dashed" ? "dashed" : "solid",
          borderColor: theme.border,
        }}
      />
    </div>
  );
}

export function DividerBlockInspector({
  block,
  onConfigChange,
}: SpaceBlockInspectorProps) {
  return (
    <InspectorSection title="分隔线 / 留白">
      <InspectorRow label="样式">
        <InspectorSelect
          value={readConfig<(typeof DIVIDER_VARIANTS)[number]>(block, "variant", "line")}
          options={[
            { value: "line", label: "实线" },
            { value: "dashed", label: "虚线" },
            { value: "dots", label: "圆点" },
            { value: "space", label: "纯留白" },
          ]}
          onChange={(variant) => onConfigChange({ variant })}
        />
      </InspectorRow>
    </InspectorSection>
  );
}

// ---------------------------------------------------------------------------
// 个人名片
// ---------------------------------------------------------------------------

export function ProfileCardBlockView({
  block,
  theme,
  accent,
  page,
}: SpaceBlockViewProps) {
  const align = readConfig<(typeof ALIGNS)[number]>(block, "align", "left");
  const showAvatar = readConfig(block, "showAvatar", true);
  const links = readConfig<SpaceProfileLink[]>(block, "links", []);
  const avatarRef = block.refs[0];

  return (
    <div
      className={cn(
        "flex h-full w-full gap-3",
        align === "center" ? "flex-col items-center text-center" : "flex-row items-center",
        align === "right" ? "flex-row-reverse text-right" : null,
      )}
    >
      {showAvatar ? (
        <div
          className="h-16 w-16 shrink-0 overflow-hidden rounded-full"
          style={{ background: theme.border }}
        >
          {avatarRef?.resolved ? <SpaceImage ref={avatarRef} fit="cover" /> : null}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold" style={{ color: theme.text }}>
          {page.pageTitle || "我的 AI 空间"}
        </p>
        {page.pageBio ? (
          <p
            className="line-clamp-2 text-xs leading-relaxed"
            style={{ color: theme.mutedText }}
          >
            {page.pageBio}
          </p>
        ) : null}
        {links.length > 0 ? (
          <div
            className={cn(
              "mt-1.5 flex flex-wrap gap-x-3 gap-y-1",
              align === "center" ? "justify-center" : null,
              align === "right" ? "justify-end" : null,
            )}
          >
            {links.map((l) => (
              <a
                key={`${l.label}-${l.url}`}
                href={l.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[11px] underline"
                style={{ color: accent }}
              >
                {l.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ProfileCardBlockInspector({
  block,
  onConfigChange,
}: SpaceBlockInspectorProps) {
  const links = readConfig<SpaceProfileLink[]>(block, "links", []);

  const setLink = (index: number, patch: Partial<SpaceProfileLink>) => {
    const next = links.map((l, i) => (i === index ? { ...l, ...patch } : l));
    onConfigChange({ links: next });
  };

  return (
    <InspectorSection title="个人名片">
      <InspectorEmpty hint="标题与简介取自空间设置，在上方「空间信息」里修改。" />
      <InspectorRow label="显示头像">
        <InspectorToggle
          checked={readConfig(block, "showAvatar", true)}
          onChange={(showAvatar) => onConfigChange({ showAvatar })}
        />
      </InspectorRow>
      <InspectorRow label="对齐">
        <InspectorSelect
          value={readConfig<(typeof ALIGNS)[number]>(block, "align", "left")}
          options={ALIGN_OPTIONS}
          onChange={(align) => onConfigChange({ align })}
        />
      </InspectorRow>

      <div className="space-y-1.5">
        <p className="text-xs text-[#656d76]">外部链接（最多 6 条，须 http/https）</p>
        {links.map((l, i) => (
          <div key={i} className="flex gap-1.5">
            <InspectorText
              value={l.label}
              placeholder="名称"
              maxLength={40}
              onChange={(label) => setLink(i, { label })}
            />
            <InspectorText
              value={l.url}
              placeholder="https://"
              maxLength={300}
              onChange={(url) => setLink(i, { url })}
            />
            <button
              type="button"
              className="shrink-0 rounded border border-[#d0d7de] px-1.5 text-xs text-[#656d76]"
              onClick={() =>
                onConfigChange({ links: links.filter((_, idx) => idx !== i) })
              }
            >
              删
            </button>
          </div>
        ))}
        {links.length < 6 ? (
          <button
            type="button"
            className="rounded border border-dashed border-[#d0d7de] px-2 py-1 text-xs text-[#656d76]"
            onClick={() =>
              onConfigChange({ links: [...links, { label: "", url: "https://" }] })
            }
          >
            添加链接
          </button>
        ) : null}
      </div>
    </InspectorSection>
  );
}

// ---------------------------------------------------------------------------
// 继续创作按钮（公开页不渲染，由 getPublicSpaceBySlug 过滤）
// ---------------------------------------------------------------------------

export function LaunchButtonBlockView({
  block,
  readOnly,
  theme,
  accent,
}: SpaceBlockViewProps) {
  const ref = block.refs[0];
  if (!ref) {
    return (
      <SpaceEmptySlot label="放一个作品做入口" readOnly={readOnly} theme={theme} />
    );
  }

  const label = readConfig(block, "label", "继续创作");
  const note = readConfig(block, "note", "");
  const variant = readConfig<(typeof BUTTON_VARIANTS)[number]>(
    block,
    "variant",
    "outline",
  );
  const href = ref.resolved?.launch ? launchHref(ref.resolved.launch) : null;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-center">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="rounded-md px-3 py-1.5 text-xs font-medium"
          style={
            variant === "primary"
              ? { background: accent, color: "#ffffff" }
              : { border: `1px solid ${accent}`, color: accent }
          }
        >
          {label}
        </a>
      ) : (
        <span className="text-xs" style={{ color: theme.mutedText }}>
          该素材没有可回跳的应用
        </span>
      )}
      {note ? (
        <span className="text-[11px]" style={{ color: theme.mutedText }}>
          {note}
        </span>
      ) : null}
    </div>
  );
}

export function LaunchButtonBlockInspector({
  block,
  onConfigChange,
}: SpaceBlockInspectorProps) {
  return (
    <InspectorSection title="继续创作按钮">
      <InspectorEmpty hint="按 SSO 深链回到素材所属应用；公开分享页不会显示这个块。" />
      <InspectorRow label="按钮文字">
        <InspectorText
          value={readConfig(block, "label", "继续创作")}
          maxLength={30}
          onChange={(label) => onConfigChange({ label })}
        />
      </InspectorRow>
      <InspectorRow label="副标">
        <InspectorText
          value={readConfig(block, "note", "")}
          placeholder="可留空"
          maxLength={80}
          onChange={(note) => onConfigChange({ note })}
        />
      </InspectorRow>
      <InspectorRow label="样式">
        <InspectorSelect
          value={readConfig<(typeof BUTTON_VARIANTS)[number]>(block, "variant", "outline")}
          options={[
            { value: "outline", label: "描边" },
            { value: "primary", label: "实心" },
          ]}
          onChange={(variant) => onConfigChange({ variant })}
        />
      </InspectorRow>
    </InspectorSection>
  );
}
