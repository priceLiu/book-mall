"use client";

import type { HandCraftProject, HandCraftStepId } from "@/lib/hand-craft-types";
import {
  handCraftStep,
  stepState,
  type HandCraftSheetPage,
  type HandCraftSheetSection,
} from "@/lib/hand-craft-workflow";

/** 导出宽度固定，html2canvas 才能拿到稳定版式；预览时按容器缩放 */
export const HAND_CRAFT_SHEET_WIDTH = 1080;

export function handCraftSheetDomId(stepId: string, pageIndex: number): string {
  return `hand-craft-sheet-${stepId}-${pageIndex}`;
}

type SectionImage = { url: string; caption: string };

function sectionImages(
  project: HandCraftProject,
  section: HandCraftSheetSection,
): SectionImage[] {
  if (!section.sourceStepId) return [];
  const meta = handCraftStep(section.sourceStepId);
  const state = stepState(project, section.sourceStepId);

  if (meta.kind === "compose") {
    return state.outputs
      .filter((o) => o.imageUrl)
      .filter((o) => !section.sourceSlots || section.sourceSlots.includes(o.index))
      .map((o) => ({ url: o.imageUrl, caption: o.title }));
  }

  return state.slots
    .filter((s) => s.imageUrl)
    .filter((s) => !section.sourceSlots || section.sourceSlots.includes(s.index))
    .map((s) => ({ url: s.imageUrl!, caption: s.title }));
}

type Props = {
  project: HandCraftProject;
  stepId: HandCraftStepId;
  page: HandCraftSheetPage;
  /** export：固定宽度供 html2canvas 抓取；preview：随容器缩放 */
  variant?: "export" | "preview";
};

/**
 * 第 8–10 步的拼版视图：版式由代码控制，浏览器 html2canvas 抓成 PNG 后上传 OSS。
 *
 * 引用图默认带 crossOrigin，抓图失败时由调用方回退到不带 crossorigin 的重试。
 */
export function HandCraftSheetView({ project, stepId, page, variant = "export" }: Props) {
  const isExport = variant === "export";
  const scale = isExport ? 1 : 0.62;

  return (
    <div
      id={isExport ? handCraftSheetDomId(stepId, page.index) : undefined}
      style={{
        width: HAND_CRAFT_SHEET_WIDTH,
        background: "#ffffff",
        color: "#1d1d1f",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: 48,
        boxSizing: "border-box",
        transform: isExport ? undefined : `scale(${scale})`,
        transformOrigin: "top left",
      }}
    >
      <header
        style={{
          borderBottom: "3px solid #d92b2b",
          paddingBottom: 16,
          marginBottom: 28,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: 12, letterSpacing: 4, color: "#d92b2b", fontWeight: 700 }}>
            ORIGINAL IP TOY DESIGN
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: "6px 0 0" }}>
            {project.title?.trim() || "手伴创作"}
          </h1>
        </div>
        <div style={{ textAlign: "right", fontSize: 13, color: "#6e6e73" }}>
          <div style={{ fontWeight: 700, color: "#1d1d1f" }}>{page.title}</div>
          <div>
            {handCraftStep(stepId).label} · P{String(page.index).padStart(2, "0")}
          </div>
        </div>
      </header>

      {page.sections.map((section, i) => (
        <SheetSection
          key={`${section.title}-${i}`}
          project={project}
          section={section}
          useCrossOrigin={isExport}
        />
      ))}

      <footer
        style={{
          marginTop: 32,
          paddingTop: 14,
          borderTop: "1px solid #e8e8ed",
          fontSize: 11,
          color: "#86868b",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>本页由手伴创作工作台自动排版</span>
        <span>© 原创 IP · 未经授权不得商用</span>
      </footer>
    </div>
  );
}

function SheetSection({
  project,
  section,
  useCrossOrigin,
}: {
  project: HandCraftProject;
  section: HandCraftSheetSection;
  useCrossOrigin: boolean;
}) {
  const images = sectionImages(project, section);

  if (section.layout === "text") {
    return (
      <section style={{ marginBottom: 28 }}>
        {section.title ? <SectionTitle text={section.title} /> : null}
        <div
          style={{
            background: "#fdf6f6",
            border: "1px solid #f2dcdc",
            borderRadius: 12,
            padding: "18px 22px",
          }}
        >
          {(section.body ?? []).map((line, i) => (
            <p
              key={i}
              style={{
                margin: i === 0 ? 0 : "8px 0 0",
                fontSize: 15,
                lineHeight: 1.7,
                color: "#3a3a3c",
              }}
            >
              {line}
            </p>
          ))}
        </div>
      </section>
    );
  }

  if (images.length === 0) {
    return (
      <section style={{ marginBottom: 28 }}>
        <SectionTitle text={section.title} />
        <div
          style={{
            border: "1px dashed #d2d2d7",
            borderRadius: 12,
            padding: 28,
            textAlign: "center",
            fontSize: 13,
            color: "#86868b",
          }}
        >
          该区块引用的成图尚未生成
        </div>
      </section>
    );
  }

  if (section.layout === "hero") {
    const first = images[0]!;
    return (
      <section style={{ marginBottom: 28 }}>
        {section.title ? <SectionTitle text={section.title} /> : null}
        <div
          style={{
            border: "1px solid #e8e8ed",
            borderRadius: 12,
            overflow: "hidden",
            background: "#f5f5f7",
            textAlign: "center",
          }}
        >
          <SheetImage src={first.url} alt={first.caption} useCrossOrigin={useCrossOrigin} maxHeight={620} />
        </div>
      </section>
    );
  }

  const cols = images.length <= 2 ? 2 : images.length <= 4 ? 2 : 3;
  const cellWidth = `${(100 / cols).toFixed(4)}%`;

  return (
    <section style={{ marginBottom: 28 }}>
      <SectionTitle text={section.title} />
      <div style={{ display: "flex", flexWrap: "wrap", margin: "0 -6px" }}>
        {images.map((img, i) => (
          <div key={`${img.url}-${i}`} style={{ width: cellWidth, padding: 6, boxSizing: "border-box" }}>
            <div
              style={{
                border: "1px solid #e8e8ed",
                borderRadius: 10,
                overflow: "hidden",
                background: "#f5f5f7",
                textAlign: "center",
              }}
            >
              <SheetImage
                src={img.url}
                alt={img.caption}
                useCrossOrigin={useCrossOrigin}
                maxHeight={cols === 3 ? 260 : 340}
              />
            </div>
            <p
              style={{
                margin: "6px 2px 0",
                fontSize: 11,
                color: "#6e6e73",
                textAlign: "center",
              }}
            >
              {img.caption}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionTitle({ text }: { text: string }) {
  if (!text) return null;
  return (
    <h2
      style={{
        fontSize: 16,
        fontWeight: 700,
        margin: "0 0 12px",
        paddingLeft: 10,
        borderLeft: "4px solid #d92b2b",
        lineHeight: 1.2,
      }}
    >
      {text}
    </h2>
  );
}

function SheetImage({
  src,
  alt,
  useCrossOrigin,
  maxHeight,
}: {
  src: string;
  alt: string;
  useCrossOrigin: boolean;
  maxHeight: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      crossOrigin={useCrossOrigin ? "anonymous" : undefined}
      style={{
        display: "block",
        width: "100%",
        maxHeight,
        objectFit: "contain",
        margin: "0 auto",
      }}
    />
  );
}
