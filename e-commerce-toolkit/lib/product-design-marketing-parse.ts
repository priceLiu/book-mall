import type { ProductDesign } from "@/lib/product-design-types";

function planNoFromLabel(label: string, fallback: number): number {
  const m = label.match(/方案\s*([ABCabc123])/);
  if (!m?.[1]) return fallback;
  const ch = m[1].toUpperCase();
  if (ch === "A" || ch === "1") return 1;
  if (ch === "B" || ch === "2") return 2;
  if (ch === "C" || ch === "3") return 3;
  const n = Number.parseInt(ch, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function stripMdBold(text: string): string {
  return text.replace(/\*\*/g, "").trim();
}

/** 从助手 Markdown 表格解析 Step2 三套方案（JSON 围栏缺失时的兜底） */
export function parseMarketingPlansFromMarkdown(
  text: string,
): ProductDesign["marketingPlans"] {
  const tableRows: string[][] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("|") || !t.endsWith("|")) continue;
    const cells = t
      .slice(1, -1)
      .split("|")
      .map((c) => stripMdBold(c.trim()));
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
    tableRows.push(cells);
  }

  const headerIdx = tableRows.findIndex(
    (r) =>
      r.some((c) => /方案|切入|痛点|收获|情绪/.test(c)) &&
      !/^方案\s*[ABC123]/i.test(r[0] ?? ""),
  );
  const start = headerIdx >= 0 ? headerIdx + 1 : 0;
  const plans: ProductDesign["marketingPlans"] = [];

  for (let i = 0; i < tableRows.slice(start).length; i++) {
    const row = tableRows[start + i]!;
    if (row.length < 4) continue;
    const label = row[0] ?? "";
    if (!/方案\s*[ABC123]|痛点|场景|品质/i.test(label) && i === 0 && headerIdx < 0) {
      continue;
    }
    const no = planNoFromLabel(label, i + 1);
    const name = label.replace(/^方案\s*[ABC123]\s*[·.]?\s*/i, "").trim() || label;
    plans.push({
      no,
      name: name.slice(0, 40) || `方案${no}`,
      angle: row[1] ?? "",
      painPoint: row[2] ?? "",
      outcome: row[3] ?? "",
      mood: row[4] ?? row[3] ?? "",
    });
  }

  return plans.slice(0, 3);
}

export function isAwaitingMarketingPlanSelection(
  project: {
    design: ProductDesign | null;
    chatHistory: Array<{ role: string; content: string }>;
  },
): boolean {
  if (project.design?.selectedPlanNo != null) return false;
  if ((project.design?.marketingPlans.length ?? 0) > 0) return true;
  const last = [...project.chatHistory].reverse().find((m) => m.role === "assistant");
  if (!last?.content) return false;
  return /Step2|三套营销方案|三个方案|方案\s*[ABC123]|点选方案|营销方案已生成|切入角度|切入逻辑|主策略|选择一个.*方案/.test(
    last.content,
  );
}
