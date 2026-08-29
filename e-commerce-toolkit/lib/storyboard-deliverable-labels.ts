import type {
  StoryboardAnalysisLegacyMarkdown,
  StoryboardAnalysisStructured,
  StoryboardDeliverable,
  StoryboardPanel,
  StoryboardScheme,
  StoryboardSellingPoint,
} from "@/lib/storyboard-types";

export function isStructuredAnalysis(
  analysis: StoryboardDeliverable["analysis"],
): analysis is StoryboardAnalysisStructured {
  if (!analysis || typeof analysis !== "object") return false;
  return "audience" in analysis && Array.isArray(analysis.audience);
}

export function isLegacyAnalysisMarkdown(
  analysis: StoryboardDeliverable["analysis"],
): analysis is StoryboardAnalysisLegacyMarkdown {
  if (!analysis || typeof analysis !== "object") return false;
  return "audienceMarkdown" in analysis;
}

const PRODUCT_INTERACTION_LABELS: Record<string, string> = {
  none: "无",
  hold: "手持",
  wear: "穿戴",
  use: "使用",
  apply: "涂抹",
  display: "展示",
  unbox: "开箱",
};

export function formatProductInteractionLabel(key?: string): string {
  if (!key) return "—";
  return PRODUCT_INTERACTION_LABELS[key] ?? key;
}

export function resolveSellpointTexts(
  tags: string[] | undefined,
  sellpoints?: StoryboardSellingPoint[],
): string {
  if (!tags?.length) return "—";
  if (!sellpoints?.length) return tags.join("、");
  const map = new Map(sellpoints.map((sp) => [sp.id, sp.text]));
  return tags.map((id) => map.get(id) ?? id).join("、");
}

/** LLM 可能输出 number / 区间对象，统一为表格展示文案 */
export function formatPanelCellText(value: unknown, fallback = "—"): string {
  if (value == null) return fallback;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => formatPanelCellText(item, ""))
      .filter((item) => item && item !== "—");
    if (parts.length >= 2) return `${parts[0]}-${parts[1]}s`;
    if (parts.length === 1) return parts[0]!;
    return fallback;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const start = record.start ?? record.from ?? record.begin;
    const end = record.end ?? record.to;
    if (start != null && end != null) {
      return `${formatPanelCellText(start, "")}-${formatPanelCellText(end, "")}s`;
    }
  }
  const text = String(value).trim();
  return text || fallback;
}

export type PanelRow = StoryboardPanel;

export type SchemePanelsTableProps = {
  panels: PanelRow[];
  sellpoints?: StoryboardSellingPoint[];
  editable?: boolean;
  onEditPanel?: (index: number) => void;
};

export type AnalysisTablesProps = {
  analysis: StoryboardAnalysisStructured;
};

export type DeliverableSellingPointsProps = {
  sellpoints: StoryboardSellingPoint[];
};

export type CreativeBriefProps = {
  brief: NonNullable<StoryboardDeliverable["creativeBrief"]>;
};

export type SchemeSummaryProps = {
  scheme: StoryboardScheme;
};
