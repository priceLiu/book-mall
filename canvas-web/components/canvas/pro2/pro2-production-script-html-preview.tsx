"use client";

import type { ReactNode } from "react";
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";
import {
  ensurePro2ProductionScriptSchemaVersion,
  isPro2ProductionScriptV2,
} from "@/lib/canvas/data/pro2-production-script-schema";
import type { Pro2ScriptHubViewTab } from "@/lib/canvas/pro2-script-hub-view-types";
import { resolveShotPropNames } from "@/lib/canvas/pro2-production-script-render-md";
import { formatPro2CharacterAppearanceCell } from "@/lib/canvas/pro2-character-script-fields";
import { cn } from "@/lib/utils";

function DarkTable({
  headers,
  rows,
  compact = false,
}: {
  headers: string[];
  rows: string[][];
  compact?: boolean;
}) {
  if (!rows.length) {
    return (
      <p className="py-6 text-center text-[11px] text-white/40">暂无数据</p>
    );
  }
  return (
    <table className="w-max min-w-full border-collapse border border-violet-400/20 text-left text-[10px]">
      <thead>
        <tr>
          {headers.map((h) => (
            <th
              key={h}
              className="border border-violet-400/15 bg-violet-500/10 px-2 py-1 font-medium whitespace-nowrap text-violet-100/90"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, i) => (
          <tr key={i}>
            {cells.map((cell, j) => (
              <td
                key={j}
                className="max-w-[280px] border border-violet-400/10 bg-black/20 px-2 py-1 align-top text-white/75"
              >
                <p
                  className={cn(
                    "text-[10px] leading-snug whitespace-pre-wrap",
                    compact ? "line-clamp-3" : "",
                  )}
                >
                  {cell || "—"}
                </p>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DocTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  if (!rows.length) {
    return (
      <p className="py-6 text-center text-[13px] text-neutral-500">暂无数据</p>
    );
  }
  return (
    <table className="w-full border-collapse border border-neutral-200 text-left text-[12px]">
      <thead>
        <tr>
          {headers.map((h) => (
            <th
              key={h}
              className="border border-neutral-200 bg-neutral-50 px-3 py-2 font-medium text-neutral-700"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, i) => (
          <tr key={i}>
            {cells.map((cell, j) => (
              <td
                key={j}
                className="border border-neutral-200 px-3 py-2 align-top text-neutral-800 whitespace-pre-wrap"
              >
                {cell || "—"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function paletteLine(
  palette?: { primary?: string; highlight?: string; shadow?: string },
): string {
  if (!palette) return "";
  return [palette.primary, palette.highlight, palette.shadow]
    .filter(Boolean)
    .join(" / ");
}

function Section({
  title,
  children,
  variant,
}: {
  title: string;
  children: ReactNode;
  variant: "dark" | "document";
}) {
  const sectionTitle =
    variant === "document"
      ? "mb-3 text-[15px] font-semibold text-neutral-800"
      : "mb-2 text-[11px] font-semibold text-violet-200/90";
  return (
    <div>
      <h3 className={sectionTitle}>{title}</h3>
      {children}
    </div>
  );
}

/** Pro2 制作包 · JSON 直出 HTML 预览（节点卡片 / 全屏弹层） */
export function Pro2ProductionScriptHtmlPreview({
  script,
  tab,
  variant = "dark",
}: {
  script: Pro2ProductionScript;
  tab: Exclude<Pro2ScriptHubViewTab, "structured">;
  variant?: "dark" | "document";
}) {
  const normalized = ensurePro2ProductionScriptSchemaVersion(script);
  const vs = normalized.visualStyle;
  const Table = variant === "document" ? DocTable : DarkTable;
  const compact = variant === "dark";

  if (tab === "outline") {
    const styleRows: string[][] = [
      ["故事背景", vs?.worldBackground ?? "—"],
      ["年代/环境", vs?.era ?? "—"],
      ["全剧色调", vs?.globalColorTone ?? "—"],
      ["画面风格", vs?.pictureStyle ?? "—"],
      ["摄影风格", vs?.cinematography ?? "—"],
      ["日景调色", paletteLine(vs?.dayPalette) || "—"],
      ["夜景调色", paletteLine(vs?.nightPalette) || "—"],
      ["皮肤/材质", vs?.skinMaterial ?? "—"],
      ["建筑风格/置景", vs?.setDesign ?? "—"],
      ["光影基调", vs?.lighting ?? "—"],
      ["风格锚定", vs?.styleAnchor ?? "—"],
    ];
    const conflictRows =
      normalized.coreConflict?.map((r) => [r.dimension, r.content]) ?? [];
    const characterRows =
      normalized.characters?.map((c) => [
        c.name,
        c.role,
        formatPro2CharacterAppearanceCell(c),
        c.personality || "—",
        c.imagePrompt,
      ]) ?? [];
    const sceneRows =
      normalized.scenes?.map((s) => [
        s.name,
        s.environmentTimeMood,
        s.imagePrompt,
        s.negativePrompt || "—",
      ]) ?? [];
    const shotRows =
      normalized.shots?.map((s) => [
        String(s.index),
        s.shotSize ?? "—",
        s.cameraMove ?? "—",
        s.sceneDescription,
        s.dialogue || "—",
        s.durationSec != null ? `${s.durationSec}s` : "—",
      ]) ?? [];
    const handoffRows =
      normalized.handoff?.map((h) => [
        String(h.index),
        h.item,
        h.owner,
        h.note || "—",
      ]) ?? [];

    const sectionTitle =
      variant === "document"
        ? "mb-3 text-[15px] font-semibold text-neutral-800"
        : "mb-2 text-[11px] font-semibold text-violet-200/90";

    return (
      <div
        className={cn(
          "flex flex-col gap-5 pb-4",
          variant === "document" ? "text-neutral-800" : "text-white/80",
        )}
      >
        {normalized.meta?.title ? (
          <h2 className={sectionTitle}>{normalized.meta.title}</h2>
        ) : null}
        {normalized.meta?.synopsis ? (
          <p
            className={
              variant === "document"
                ? "text-[13px] leading-relaxed text-neutral-600"
                : "text-[11px] leading-relaxed text-white/55"
            }
          >
            {normalized.meta.synopsis}
          </p>
        ) : null}
        <Section title="视觉风格总纲" variant={variant}>
          <Table headers={["维度", "内容"]} rows={styleRows} compact={compact} />
        </Section>
        {conflictRows.length ? (
          <Section title="核心冲突" variant={variant}>
            <Table headers={["维度", "内容"]} rows={conflictRows} compact={compact} />
          </Section>
        ) : null}
        {characterRows.length ? (
          <Section title="角色视觉辞典" variant={variant}>
            <Table
              headers={["姓名", "身份", "外貌/服装", "性格", "AI生图"]}
              rows={characterRows}
              compact={compact}
            />
          </Section>
        ) : null}
        {sceneRows.length ? (
          <Section title="场景视觉辞典" variant={variant}>
            <Table
              headers={["场景", "环境/时间/气氛", "生图关键词", "反向提示词"]}
              rows={sceneRows}
              compact={compact}
            />
          </Section>
        ) : null}
        {shotRows.length ? (
          <Section title="分镜脚本" variant={variant}>
            <Table
              headers={["镜号", "景别", "运镜", "画面描述", "对白", "时长"]}
              rows={shotRows}
              compact={compact}
            />
          </Section>
        ) : null}
        {handoffRows.length ? (
          <Section title="交接清单" variant={variant}>
            <Table
              headers={["序号", "事项", "负责人", "备注"]}
              rows={handoffRows}
              compact={compact}
            />
          </Section>
        ) : null}
      </div>
    );
  }

  if (tab === "scene") {
    const rows =
      normalized.scenes?.map((s) => [
        s.name,
        s.environmentTimeMood,
        s.imagePrompt,
        s.negativePrompt || "—",
      ]) ?? [];
    return (
      <Table
        headers={["场景", "环境/时间/气氛", "生图关键词", "反向提示词"]}
        rows={rows}
        compact={compact}
      />
    );
  }

  if (tab === "character") {
    const rows =
      normalized.characters?.map((c) => [
        c.name,
        c.role,
        formatPro2CharacterAppearanceCell(c),
        c.personality || "—",
        c.imagePrompt,
      ]) ?? [];
    return (
      <Table
        headers={["姓名", "身份", "外貌/服装", "性格", "AI生图"]}
        rows={rows}
        compact={compact}
      />
    );
  }

  const rows =
    normalized.shots?.map((s) => {
      if (isPro2ProductionScriptV2(normalized.schemaVersion)) {
        return [
          String(s.index),
          s.shotSize ?? "—",
          s.lighting ?? "—",
          s.cameraMove ?? "—",
          s.sceneDescription,
          resolveShotPropNames(s, normalized),
          s.dialogue || "—",
          s.durationSec != null ? String(s.durationSec) : "—",
          s.sfxNote ?? "—",
          s.audioNote || "—",
        ];
      }
      return [
        String(s.index),
        s.shotSize ?? "—",
        s.cameraMove ?? "—",
        s.sceneDescription,
        s.dialogue || "—",
        s.durationSec != null ? String(s.durationSec) : "—",
        s.imagePrompt ?? "—",
        s.videoPrompt ?? "—",
        s.audioNote || "—",
      ];
    }) ?? [];
  return (
    <Table
      headers={
        isPro2ProductionScriptV2(normalized.schemaVersion)
          ? [
              "镜号",
              "景别",
              "光影",
              "运镜",
              "画面描述",
              "道具",
              "对白",
              "时长",
              "音效",
              "口型/配音",
            ]
          : [
              "镜号",
              "景别",
              "运镜",
              "画面描述",
              "对白",
              "时长",
              "AI生图",
              "AI视频",
              "口型/配音",
            ]
      }
      rows={rows}
      compact={compact}
    />
  );
}
