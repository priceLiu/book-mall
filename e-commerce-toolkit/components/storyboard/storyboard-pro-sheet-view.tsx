"use client";

import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { StoryboardPanelImageHoverActions } from "@/components/storyboard/storyboard-panel-image-hover-actions";
import { buildPanelTimelineMap } from "@/lib/storyboard-gen-params";
import { cn } from "@/lib/utils";
import type { StoryboardReference, StoryboardSheet } from "@/lib/storyboard-types";

type Props = {
  sheet: StoryboardSheet;
  references: StoryboardReference[];
  productName?: string;
  productHighlight?: string;
  projectKeywords?: string;
  producer?: string;
  exportRootId?: string;
  /** 表头标题，默认「微短剧带货分镜制作」 */
  sheetHeading?: string;
  /** export：固定 1920 宽供 html2canvas；preview：可滚动放大预览 */
  variant?: "export" | "preview";
  /** preview 模式下点击镜头/参考图放大 */
  onPreviewImage?: (src: string, title: string) => void;
  /** 成片工作区：镜头位可点击单镜生图 */
  interactive?: boolean;
  generatingPanelIndexes?: ReadonlySet<number>;
  onGeneratePanel?: (panelIndex: number) => void;
  onRegeneratePanel?: (panelIndex: number) => void;
  onPreviewPanelPrompt?: (panelIndex: number) => void;
  selectedPanelIndexes?: ReadonlySet<number>;
  onTogglePanelSelect?: (panelIndex: number) => void;
};

function SheetImage({
  src,
  alt,
  useCrossOrigin,
  objectFit = "cover",
  previewable,
  onPreview,
}: {
  src: string;
  alt: string;
  useCrossOrigin: boolean;
  objectFit?: "cover" | "contain";
  previewable?: boolean;
  onPreview?: (src: string, title: string) => void;
}) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      {...(useCrossOrigin ? { crossOrigin: "anonymous" as const } : {})}
      style={{ width: "100%", height: "100%", objectFit, display: "block" }}
      onError={(e) => {
        const imgEl = e.currentTarget;
        if (imgEl.dataset.retried) return;
        imgEl.dataset.retried = "1";
        if (useCrossOrigin) {
          imgEl.removeAttribute("crossorigin");
          imgEl.src = src;
        }
      }}
    />
  );

  if (previewable && onPreview) {
    return (
      <button
        type="button"
        title="点击放大预览"
        onClick={() => onPreview(src, alt)}
        style={{
          width: "100%",
          height: "100%",
          padding: 0,
          border: "none",
          background: "transparent",
          cursor: "zoom-in",
        }}
      >
        {img}
      </button>
    );
  }

  return img;
}

/** 专业分镜版式（导出 PNG / 预览） */
export function StoryboardProSheetView({
  sheet,
  references,
  productName,
  productHighlight,
  projectKeywords,
  producer,
  exportRootId = "storyboard-sheet-export",
  sheetHeading = "微短剧带货分镜制作",
  variant = "export",
  onPreviewImage,
  interactive = false,
  generatingPanelIndexes,
  onGeneratePanel,
  onRegeneratePanel,
  onPreviewPanelPrompt,
  selectedPanelIndexes,
  onTogglePanelSelect,
}: Props) {
  const isPreview = variant === "preview";
  /** 导出 PNG 须满足火山图生视频宽高比 ≤2.50（1920/768≈2.5） */
  const panelImgHeight = isPreview ? 420 : 300;
  const baseFontSize = isPreview ? 14 : 13;
  const useCrossOrigin = variant === "export";

  const highlight =
    productHighlight?.trim() ||
    sheet.overview.productHighlight?.trim() ||
    sheet.overview.logline?.trim() ||
    "—";
  const logline = sheet.overview.logline?.trim() || "—";
  const title = productName?.trim() || sheet.overview.title?.trim() || "—";
  const keywords =
    projectKeywords?.trim() ||
    sheet.overview.productHighlight?.trim()?.slice(0, 48) ||
    "—";
  const duration =
    typeof sheet.totalDurationHintSec === "number"
      ? `${sheet.totalDurationHintSec}`
      : "—";
  const producerName = producer?.trim() || "—";

  const timelineMap = buildPanelTimelineMap(sheet.panels, sheet.totalDurationHintSec);
  const chars = references.filter((r) => r.role === "character");
  const products = references.filter((r) => r.role === "product");
  const scenes = references.filter((r) => r.role === "scene" || r.role === "other");

  return (
    <div
      id={exportRootId}
      style={{
        width: isPreview ? "100%" : 1920,
        minWidth: isPreview ? 1200 : undefined,
        minHeight: isPreview ? undefined : 780,
        background: "#ffffff",
        color: "#1d1d1f",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: isPreview ? 24 : 20,
        boxSizing: "border-box",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          border: "2px solid #1d1d1f",
          fontSize: baseFontSize,
          marginBottom: 12,
        }}
      >
        <tbody>
          <tr>
            <td
              colSpan={4}
              style={{
                border: "1px solid #1d1d1f",
                padding: "10px 14px",
                fontWeight: 700,
                fontSize: 18,
                textAlign: "center",
              }}
            >
              {sheetHeading}
            </td>
          </tr>
          <tr>
            <td style={cellStyle}>产品名称</td>
            <td style={cellStyle}>{title}</td>
            <td style={cellStyle}>项目关键词</td>
            <td style={cellStyle}>{keywords}</td>
          </tr>
          <tr>
            <td style={cellStyle}>总时长</td>
            <td style={cellStyle}>{duration === "—" ? "—" : `${duration} 秒`}</td>
            <td style={cellStyle}>制作人</td>
            <td style={cellStyle}>{producerName}</td>
          </tr>
          <tr>
            <td style={cellStyle}>核心卖点</td>
            <td colSpan={3} style={cellStyle}>
              {highlight}
            </td>
          </tr>
          <tr>
            <td style={cellStyle}>剧情梗概</td>
            <td colSpan={3} style={cellStyle}>
              {logline}
            </td>
          </tr>
        </tbody>
      </table>

      <div
        style={{
          display: "flex",
          gap: 16,
          border: "2px solid #1d1d1f",
          padding: 12,
          marginBottom: 12,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <RefGroup
          title="产品图"
          refs={products}
          emptyLabel="产品参考"
          useCrossOrigin={useCrossOrigin}
          previewable={isPreview}
          onPreviewImage={onPreviewImage}
        />
        <RefGroup
          title="角色图"
          refs={chars}
          emptyLabel="角色参考"
          useCrossOrigin={useCrossOrigin}
          previewable={isPreview}
          onPreviewImage={onPreviewImage}
        />
        <RefGroup
          title="场景图"
          refs={scenes}
          emptyLabel="场景参考"
          useCrossOrigin={useCrossOrigin}
          previewable={isPreview}
          onPreviewImage={onPreviewImage}
        />
      </div>

      <div
        style={{
          display: "flex",
          border: "2px solid #1d1d1f",
          overflowX: isPreview ? "auto" : undefined,
        }}
      >
        {sheet.panels.map((panel, i) => {
          const generating = generatingPanelIndexes?.has(panel.index) ?? false;
          const selected = selectedPanelIndexes?.has(panel.index) ?? false;
          const handlePanelAction = () => {
            if (panel.imageUrl && onRegeneratePanel) {
              onRegeneratePanel(panel.index);
            } else if (onGeneratePanel) {
              onGeneratePanel(panel.index);
            }
          };
          return (
          <div
            key={panel.index}
            style={{
              flex: isPreview ? "0 0 auto" : 1,
              minWidth: isPreview ? 220 : 0,
              width: isPreview ? 220 : undefined,
              borderRight: i < sheet.panels.length - 1 ? "1px solid #1d1d1f" : undefined,
              position: "relative",
              isolation: "isolate",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                borderBottom: "1px solid #1d1d1f",
                padding: "8px 6px",
                textAlign: "center",
                fontWeight: 700,
                fontSize: 12,
                background: selected ? "#e8f2ff" : "#f5f5f7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {interactive && onTogglePanelSelect ? (
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onTogglePanelSelect(panel.index)}
                  aria-label={`选择镜头 ${panel.index}`}
                  style={{ width: 14, height: 14, cursor: "pointer" }}
                />
              ) : null}
              <span>Shot {String(panel.index).padStart(2, "0")}</span>
            </div>
            <div
              className={cn(
                interactive && panel.imageUrl && !generating && "group/image",
              )}
              style={{
                height: panelImgHeight,
                borderBottom: "1px solid #1d1d1f",
                background: generating ? "#000" : "#e8e8ed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {panel.imageUrl ? (
                <>
                  <SheetImage
                    src={panel.imageUrl}
                    alt={`镜头 ${panel.index}`}
                    useCrossOrigin={useCrossOrigin}
                    objectFit={isPreview ? "contain" : "cover"}
                  />
                  {interactive && !generating ? (
                    <StoryboardPanelImageHoverActions
                      onPreview={
                        onPreviewImage
                          ? () =>
                              onPreviewImage(
                                panel.imageUrl!,
                                `镜头 ${panel.index}`,
                              )
                          : undefined
                      }
                      onRegenerate={
                        onRegeneratePanel ?? onGeneratePanel
                          ? handlePanelAction
                          : undefined
                      }
                      onPreviewPrompt={
                        onPreviewPanelPrompt
                          ? () => onPreviewPanelPrompt(panel.index)
                          : undefined
                      }
                    />
                  ) : null}
                </>
              ) : interactive && onGeneratePanel && !generating ? (
                <button
                  type="button"
                  onClick={handlePanelAction}
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: 11,
                    color: "#0071e3",
                  }}
                >
                  点击生成分镜图
                </button>
              ) : !generating ? (
                <span style={{ fontSize: 11, color: "#86868b" }}>待生成</span>
              ) : null}
              {generating ? (
                <EcomMediaGeneratingBusy
                  className="z-[1] rounded-none"
                  background="black"
                />
              ) : null}
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 10,
                lineHeight: 1.35,
              }}
            >
              <tbody>
                <FieldRow
                  label="时间轴"
                  value={timelineMap.get(panel.index) ?? panel.timeline}
                />
                <FieldRow label="景别" value={panel.shotType} />
                <FieldRow label="运镜" value={panel.camera} />
                <FieldRow label="画面内容" value={`${panel.scene} ${panel.action}`.trim()} tall />
                <FieldRow label="情绪" value={panel.emotion} />
                <FieldRow label="口播台词" value={panel.dialogue} tall />
              </tbody>
            </table>
          </div>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 0,
          border: "2px solid #1d1d1f",
          borderTop: "none",
          fontSize: 11,
        }}
      >
        <FooterBlock
          title="视觉风格"
          text="易懂、真实生活感、明亮居家光线、UGC 微剧情质感"
        />
        <FooterBlock title="音频建议" text="现场收音、自然对白、环境氛围、轻情绪音效" />
        <FooterBlock title="情绪关键词" text="冲突、焦虑、反转、爽感、种草冲动" />
      </div>
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  border: "1px solid #1d1d1f",
  padding: "8px 12px",
  verticalAlign: "top",
};

function FieldRow({
  label,
  value,
  tall,
}: {
  label: string;
  value?: string | null;
  tall?: boolean;
}) {
  return (
    <tr>
      <td
        style={{
          borderBottom: "1px solid #d2d2d7",
          padding: "4px 6px",
          fontWeight: 600,
          width: "28%",
          verticalAlign: "top",
          background: "#fafafa",
        }}
      >
        {label}
      </td>
      <td
        style={{
          borderBottom: "1px solid #d2d2d7",
          padding: "4px 6px",
          verticalAlign: "top",
          minHeight: tall ? 48 : undefined,
        }}
      >
        {value?.trim() || "—"}
      </td>
    </tr>
  );
}

function RefGroup({
  title,
  refs,
  emptyLabel,
  useCrossOrigin,
  previewable,
  onPreviewImage,
}: {
  title: string;
  refs: StoryboardReference[];
  emptyLabel: string;
  useCrossOrigin: boolean;
  previewable?: boolean;
  onPreviewImage?: (src: string, title: string) => void;
}) {
  return (
    <div style={{ textAlign: "center", minWidth: 100 }}>
      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        {refs.length > 0 ? (
          refs.map((r) => (
            <div key={r.id}>
              <div
                style={{
                  width: 88,
                  height: 88,
                  overflow: "hidden",
                  border: "1px solid #1d1d1f",
                  borderRadius: 4,
                  background: "#e8e8ed",
                }}
              >
                <SheetImage
                  src={r.ossUrl}
                  alt={r.label}
                  useCrossOrigin={useCrossOrigin}
                  objectFit="cover"
                  previewable={previewable}
                  onPreview={onPreviewImage}
                />
              </div>
              <div style={{ fontSize: 10, marginTop: 4, color: "#6e6e73", maxWidth: 88 }}>
                {r.label}
              </div>
            </div>
          ))
        ) : (
          <div>
            <div
              style={{
                width: 88,
                height: 88,
                overflow: "hidden",
                border: "1px solid #1d1d1f",
                borderRadius: 4,
                background: "#e8e8ed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 10, color: "#86868b" }}>待上传</span>
            </div>
            <div style={{ fontSize: 10, marginTop: 4, color: "#6e6e73" }}>{emptyLabel}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function FooterBlock({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ borderRight: "1px solid #1d1d1f", padding: "10px 12px" }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <div style={{ color: "#6e6e73" }}>{text}</div>
    </div>
  );
}
