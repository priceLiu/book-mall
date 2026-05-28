"use client";

import Image from "next/image";
import type { AnalysisTemplate } from "./visual-lab-analysis-template-types";

export function VisualLabAnalysisTemplates({
  templates,
  analyzing,
  billableServiceFeeMode,
  billablePriceLoading,
  displayPricePoints,
  onTemplateClick,
}: {
  templates: AnalysisTemplate[];
  analyzing: boolean;
  billableServiceFeeMode: boolean;
  billablePriceLoading: boolean;
  displayPricePoints: number;
  onTemplateClick: (t: AnalysisTemplate) => void;
}) {
  return (
    <section className="vl-analysis-templates" aria-label="体验模板">
      <h2 className="vl-analysis-templates-title">选择模板，一键体验</h2>
      <div className="vl-analysis-templates-grid">
        {templates.map((t) => (
          <div
            key={t.id}
            role="button"
            tabIndex={analyzing ? -1 : 0}
            aria-disabled={analyzing}
            className="vl-analysis-template-card"
            onClick={() => {
              if (analyzing) return;
              onTemplateClick(t);
            }}
            onKeyDown={(e) => {
              if (analyzing) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onTemplateClick(t);
              }
            }}
          >
            <span className="vl-analysis-template-card-kicker">{t.title}</span>
            <span className="vl-analysis-template-card-desc">{t.description}</span>
            <span className="vl-analysis-template-card-charge" aria-hidden>
              {billableServiceFeeMode
                ? "含在技术服务费内"
                : `每次 ${
                    billablePriceLoading
                      ? "…"
                      : `${displayPricePoints.toLocaleString("zh-CN")} 点`
                  }`}
            </span>
            <div className="vl-analysis-template-card-media">
              {t.mode === "video" ? (
                <video
                  className="vl-analysis-template-card-video"
                  src={t.videoSrc}
                  muted
                  playsInline
                  preload="metadata"
                  aria-hidden
                />
              ) : (
                <Image
                  src={t.imageSrc}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 34vw, 260px"
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
