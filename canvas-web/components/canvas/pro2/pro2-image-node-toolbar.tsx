"use client";

import {
  BookmarkPlus,
  ChevronDown,
  Copy,
  Download,
  LayoutGrid,
  Loader2,
  Maximize2,
  Pencil,
  RotateCw,
  Scan,
  ScanFace,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import { useStore } from "@xyflow/react";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  downloadMediaUrl,
  guessMediaDownloadFilename,
} from "@/lib/canvas/download-media-url";
import { computeLibtvNodeToolbarTransformScale } from "@/lib/canvas/libtv-node-toolbar-scale";
import {
  LIBTV_IMAGE_DIRECT_EDIT_MENU,
  LIBTV_IMAGE_EDIT_WORKFLOW_MENU,
  type LibtvImageEditMenuId,
} from "@/lib/canvas/libtv-image-toolbar-edit";
import {
  LIBTV_IMAGE_MAGIC_MENU,
  type LibtvImageMagicMenuId,
} from "@/lib/canvas/libtv-image-toolbar-magic";
import {
  LIBTV_GRID_SPLIT_MAX,
  LIBTV_GRID_SPLIT_MIN,
  LIBTV_GRID_SPLIT_PRESETS,
  libtvGridSplitFromDimensions,
} from "@/lib/canvas/libtv-image-grid-split";
import { useLibtvToolbarPortaled } from "@/components/canvas/libtv-node-toolbar-portal";
import {
  Pro2ToolbarDropdownItem,
  Pro2ToolbarDropdownMenu,
  usePro2ToolbarExclusiveDropdowns,
} from "./pro2-toolbar-dropdown-menu";
import { cn } from "@/lib/utils";

/** LibTV 节点顶栏工具条 · 壳层（规范见 libtv-node-interaction-spec.md §5） */
export const PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS =
  "inline-flex w-max max-w-none flex-nowrap items-center gap-0.5 rounded-full border border-white/[0.06] bg-[#262626] px-1.5 py-1 shadow-[0_4px_20px_rgba(0,0,0,0.42)]";

/** 顶栏下拉 / 打组弹层 · 与工具条同色实心底（禁止半透明） */
export const PRO2_IMAGE_NODE_TOOLBAR_POPOVER_CLASS =
  "rounded-xl border border-white/[0.06] bg-[#262626] p-3 shadow-[0_4px_20px_rgba(0,0,0,0.42)]";

/** 带文案的操作钮（字号比画布固定 · 不随 zoom 变化，见 §5.4） */
export const PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS =
  "nodrag flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[15px] text-white/75 transition hover:bg-white/8 hover:text-white/95 disabled:cursor-not-allowed disabled:opacity-40";

/** 仅图标操作钮 */
export const PRO2_IMAGE_NODE_TOOLBAR_ICON_BTN_CLASS =
  "nodrag flex size-10 shrink-0 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/8 hover:text-white/90 disabled:cursor-not-allowed disabled:opacity-40";

/** 工具条内分隔线 */
export const PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS = "mx-0.5 h-5 w-px bg-white/10";

/** 卡片上方居中；节点内联 style={{ top: -60 }} */
export const PRO2_IMAGE_NODE_TOOLBAR_OFFSET_TOP_PX = 60;

const TOOL_BTN = PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS;
const ICON_BTN = PRO2_IMAGE_NODE_TOOLBAR_ICON_BTN_CLASS;

export type Pro2ImageNodeToolbarProps = {
  previewUrl?: string;
  onExpandPreview?: () => void;
  onSaveAsAsset?: () => void;
  /** 私域人像入库（火山 portrait 库 → asset://） */
  onImportPortrait?: () => void;
  portraitImporting?: boolean;
  portraitActive?: boolean;
  /** 复制节点（含生成结果与 Dock 配置） */
  onDuplicateNode?: () => void;
  className?: string;
  style?: React.CSSProperties;
  /** sbv1：工具条空白区仍可拖节点，仅按钮 nodrag */
  passNodeDrag?: boolean;
  /** 精简模式：仅预览 / 下载 / 复制（视频合成节点） */
  minimal?: boolean;
  /** Pro2 图片节点 ·「编辑」菜单 */
  onEditPick?: (menuId: LibtvImageEditMenuId) => void;
  /** Pro2 图片节点 · 宫格切分（列 × 行） */
  onGridSplitPick?: (cols: number, rows: number) => void;
  /** Pro2 图片节点 ·「魔术」菜单 */
  onMagicPick?: (menuId: LibtvImageMagicMenuId) => void;
  /** 是否展示编辑 / 宫格切分（Pro2 有图节点） */
  pro2ImageTools?: boolean;
};

/** 有图图片节点 · 顶部浮动工具条（LibTV 图 2） */
export function Pro2ImageNodeToolbar({
  previewUrl,
  onExpandPreview,
  onSaveAsAsset,
  onImportPortrait,
  portraitImporting = false,
  portraitActive = false,
  onDuplicateNode,
  className,
  style,
  passNodeDrag = false,
  minimal = false,
  onEditPick,
  onGridSplitPick,
  onMagicPick,
  pro2ImageTools = false,
}: Pro2ImageNodeToolbarProps) {
  const { alert } = useDialogs();
  const [downloading, setDownloading] = useState(false);
  const dropdowns = usePro2ToolbarExclusiveDropdowns([
    "edit",
    "magic",
    "grid",
  ] as const);
  const [customGridCols, setCustomGridCols] = useState("3");
  const [customGridRows, setCustomGridRows] = useState("3");

  const soon = async (label: string) => {
    await alert({
      title: "即将推出",
      message: `「${label}」将在后续版本接入。`,
      variant: "info",
    });
  };

  const onDownload = async () => {
    if (!previewUrl || downloading) return;
    setDownloading(true);
    try {
      const fallback = minimal ? "video.mp4" : "image.png";
      await downloadMediaUrl(
        previewUrl,
        guessMediaDownloadFilename(previewUrl, fallback),
      );
    } finally {
      setDownloading(false);
    }
  };

  if (minimal) {
    return (
      <ToolbarShell
        passNodeDrag={passNodeDrag}
        className={className}
        style={style}
      >
        {onExpandPreview ? (
          <button
            type="button"
            className={ICON_BTN}
            title="放大预览"
            disabled={!previewUrl}
            onClick={onExpandPreview}
          >
            <Maximize2 className="size-5" />
          </button>
        ) : null}
        {previewUrl ? (
          <button
            type="button"
            className={ICON_BTN}
            title="下载"
            disabled={downloading}
            onClick={() => void onDownload()}
          >
            {downloading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Download className="size-5" />
            )}
          </button>
        ) : null}
        {onDuplicateNode ? (
          <button
            type="button"
            className={ICON_BTN}
            title="复制节点"
            onClick={onDuplicateNode}
          >
            <Copy className="size-5" />
          </button>
        ) : null}
        {onSaveAsAsset ? (
          <button type="button" className={ICON_BTN} title="保存为资产" onClick={onSaveAsAsset}>
            <BookmarkPlus className="size-5" />
          </button>
        ) : null}
      </ToolbarShell>
    );
  }

  return (
    <>
      <ToolbarShell passNodeDrag={passNodeDrag} className={className} style={style}>
        <button
          type="button"
          className={TOOL_BTN}
          onClick={() => void soon("全景")}
        >
          <Scan className="size-3.5" />
          <span>全景</span>
        </button>
        <button
          type="button"
          className={TOOL_BTN}
          onClick={() => void soon("多角度")}
        >
          <RotateCw className="size-3.5" />
          <span>多角度</span>
        </button>

        {pro2ImageTools ? (
          <>
            <div className={PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS} />

            <button
              type="button"
              ref={dropdowns.bindAnchor("edit")}
              className={TOOL_BTN}
              disabled={!onEditPick}
              onClick={() => dropdowns.toggle("edit")}
            >
              <Pencil className="size-3.5" />
              <span>编辑</span>
              <ChevronDown className="size-3 opacity-50" />
            </button>
            <button
              type="button"
              ref={dropdowns.bindAnchor("magic")}
              className={TOOL_BTN}
              disabled={!onMagicPick}
              onClick={() => dropdowns.toggle("magic")}
            >
              <Wand2 className="size-3.5" />
              <span>魔术</span>
              <ChevronDown className="size-3 opacity-50" />
            </button>
            <button
              type="button"
              ref={dropdowns.bindAnchor("grid")}
              className={TOOL_BTN}
              disabled={!onGridSplitPick}
              onClick={() => dropdowns.toggle("grid")}
            >
              <LayoutGrid className="size-3.5" />
              <span>宫格切分</span>
              <ChevronDown className="size-3 opacity-50" />
            </button>
          </>
        ) : null}

        <div className={PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS} />

      {onImportPortrait ? (
        <button
          type="button"
          className={TOOL_BTN}
          disabled={!previewUrl || portraitImporting}
          title={
            portraitActive
              ? "已入库 · 生视频将引用 asset://"
              : "写入火山私域人像库"
          }
          onClick={onImportPortrait}
        >
          {portraitImporting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ScanFace className="size-3.5" />
          )}
          <span>{portraitActive ? "已入库" : "私域人像入库"}</span>
        </button>
      ) : null}

      {onSaveAsAsset ? (
        <button type="button" className={TOOL_BTN} onClick={onSaveAsAsset}>
          <BookmarkPlus className="size-3.5" />
          <span>保存为资产</span>
        </button>
      ) : null}

      <button
        type="button"
        className={ICON_BTN}
        title="智能编辑"
        onClick={() => void soon("智能编辑")}
      >
        <Wand2 className="size-5" />
      </button>
      <button
        type="button"
        className={ICON_BTN}
        title="下载"
        disabled={!previewUrl || downloading}
        onClick={() => void onDownload()}
      >
        {downloading ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <Download className="size-5" />
        )}
      </button>
      <button
        type="button"
        className={ICON_BTN}
        title="放大预览"
        disabled={!previewUrl}
        onClick={onExpandPreview}
      >
        <Maximize2 className="size-5" />
      </button>
      {onDuplicateNode ? (
        <button
          type="button"
          className={ICON_BTN}
          title="复制节点"
          onClick={onDuplicateNode}
        >
          <Copy className="size-5" />
        </button>
      ) : null}
      </ToolbarShell>

      {pro2ImageTools ? (
        <>
          <Pro2ToolbarDropdownMenu
            open={dropdowns.isOpen("edit")}
            setOpen={(v) => (v ? dropdowns.toggle("edit") : dropdowns.close())}
            rect={dropdowns.isOpen("edit") ? dropdowns.rect : null}
            minWidth={240}
          >
            <div className="max-h-[min(420px,60vh)] overflow-y-auto">
              {LIBTV_IMAGE_DIRECT_EDIT_MENU.map((item) => (
                <Pro2ToolbarDropdownItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  onClick={() => {
                    dropdowns.close();
                    onEditPick?.(item.id);
                  }}
                />
              ))}
              <div className={PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS} />
              {LIBTV_IMAGE_EDIT_WORKFLOW_MENU.map((item) => (
                <Pro2ToolbarDropdownItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  onClick={() => {
                    dropdowns.close();
                    onEditPick?.(item.id);
                  }}
                />
              ))}
            </div>
          </Pro2ToolbarDropdownMenu>

          <Pro2ToolbarDropdownMenu
            open={dropdowns.isOpen("magic")}
            setOpen={(v) => (v ? dropdowns.toggle("magic") : dropdowns.close())}
            rect={dropdowns.isOpen("magic") ? dropdowns.rect : null}
            minWidth={180}
          >
            {LIBTV_IMAGE_MAGIC_MENU.map((item) => (
              <Pro2ToolbarDropdownItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                onClick={() => {
                  dropdowns.close();
                  onMagicPick?.(item.id);
                }}
              />
            ))}
          </Pro2ToolbarDropdownMenu>

          <Pro2ToolbarDropdownMenu
            open={dropdowns.isOpen("grid")}
            setOpen={(v) => (v ? dropdowns.toggle("grid") : dropdowns.close())}
            rect={dropdowns.isOpen("grid") ? dropdowns.rect : null}
            minWidth={220}
          >
            {LIBTV_GRID_SPLIT_PRESETS.map((preset) => (
              <Pro2ToolbarDropdownItem
                key={preset.id}
                icon={LayoutGrid}
                label={preset.label}
                onClick={() => {
                  dropdowns.close();
                  onGridSplitPick?.(preset.cols, preset.rows);
                }}
              />
            ))}
            <div className="my-1 border-t border-white/10" />
            <GridSplitCustomPanel
              cols={customGridCols}
              rows={customGridRows}
              onColsChange={setCustomGridCols}
              onRowsChange={setCustomGridRows}
              onApply={() => {
                const split = libtvGridSplitFromDimensions(
                  Number(customGridCols),
                  Number(customGridRows),
                );
                if (!split) {
                  void alert({
                    title: "无效宫格",
                    message: `请输入 ${LIBTV_GRID_SPLIT_MIN}～${LIBTV_GRID_SPLIT_MAX} 之间的列数与行数。`,
                    variant: "error",
                  });
                  return;
                }
                dropdowns.close();
                onGridSplitPick?.(split.cols, split.rows);
              }}
            />
          </Pro2ToolbarDropdownMenu>
        </>
      ) : null}
    </>
  );
}

function GridSplitCustomPanel({
  cols,
  rows,
  onColsChange,
  onRowsChange,
  onApply,
}: {
  cols: string;
  rows: string;
  onColsChange: (v: string) => void;
  onRowsChange: (v: string) => void;
  onApply: () => void;
}) {
  return (
    <div
      className="nodrag px-3 py-2"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="mb-2 text-[12px] font-medium text-white/55">自定义</p>
      <div className="flex items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] text-white/75">
          <span className="shrink-0 text-white/45">列</span>
          <input
            type="number"
            min={LIBTV_GRID_SPLIT_MIN}
            max={LIBTV_GRID_SPLIT_MAX}
            inputMode="numeric"
            value={cols}
            onChange={(e) => onColsChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onApply();
              }
            }}
            className="nodrag w-full min-w-0 rounded-md border border-white/15 bg-black/35 px-2 py-1 text-[13px] text-white outline-none focus:border-white/25"
          />
        </label>
        <span className="text-white/30">×</span>
        <label className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] text-white/75">
          <span className="shrink-0 text-white/45">行</span>
          <input
            type="number"
            min={LIBTV_GRID_SPLIT_MIN}
            max={LIBTV_GRID_SPLIT_MAX}
            inputMode="numeric"
            value={rows}
            onChange={(e) => onRowsChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onApply();
              }
            }}
            className="nodrag w-full min-w-0 rounded-md border border-white/15 bg-black/35 px-2 py-1 text-[13px] text-white outline-none focus:border-white/25"
          />
        </label>
      </div>
      <button
        type="button"
        className={cn(TOOL_BTN, "mt-2 w-full justify-center")}
        onClick={onApply}
      >
        应用
      </button>
    </div>
  );
}

function ToolbarShell({
  passNodeDrag,
  className,
  style,
  children,
}: {
  passNodeDrag: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const zoom = useStore((s) => s.transform[2]);
  const portaled = useLibtvToolbarPortaled();
  const toolbarScale = portaled
    ? 1
    : computeLibtvNodeToolbarTransformScale(zoom);
  const effectivePassNodeDrag = portaled ? false : passNodeDrag;

  return (
    <div
      className={cn(
        PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS,
        effectivePassNodeDrag
          ? "pointer-events-none [&_button]:pointer-events-auto"
          : "nodrag pointer-events-auto",
        !portaled && !style && "absolute left-1/2 z-30",
        className,
      )}
      style={
        portaled
          ? style
          : {
              ...style,
              transform: `translateX(-50%) scale(${toolbarScale})`,
              transformOrigin: "center bottom",
              transition: "transform 120ms ease",
            }
      }
      {...(effectivePassNodeDrag
        ? {}
        : {
            onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
            onClick: (e: React.MouseEvent) => e.stopPropagation(),
          })}
    >
      {children}
    </div>
  );
}
