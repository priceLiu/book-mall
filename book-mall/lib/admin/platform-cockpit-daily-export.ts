import type { CockpitDailyDashboardSnapshot } from "@/lib/admin/platform-cockpit-daily-dashboard";

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvLine(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(",");
}

/** UTF-8 BOM + 多段 CSV（概览 / 应用 / 项目 / 明细） */
export function buildCockpitDailyDashboardCsv(daily: CockpitDailyDashboardSnapshot): string {
  const lines: string[] = [];
  const o = daily.overview;

  lines.push(`# 当日数据看板 ${daily.businessDateCst} 生成 ${daily.generatedAt}`);
  lines.push(csvLine(["metric", "value"]));
  lines.push(csvLine(["credits_gateway", o.creditsFromGateway]));
  lines.push(csvLine(["credits_ledger", o.creditsFromLedger]));
  lines.push(csvLine(["credits_delta", o.creditsDelta]));
  lines.push(csvLine(["image_succeeded", o.imageSucceeded]));
  lines.push(csvLine(["video_succeeded", o.videoSucceeded]));
  lines.push(csvLine(["gateway_succeeded", o.gatewaySucceeded]));
  lines.push(csvLine(["gateway_failed", o.gatewayFailed]));
  lines.push(csvLine(["cost_yuan", o.costYuan]));
  lines.push("");

  lines.push("# by_app");
  lines.push(
    csvLine([
      "app_key",
      "app_label",
      "credits",
      "image_count",
      "video_count",
      "other_count",
      "gateway_succeeded",
      "gateway_failed",
      "cost_yuan",
    ]),
  );
  for (const r of daily.byApp) {
    lines.push(
      csvLine([
        r.appKey,
        r.appLabel,
        r.credits,
        r.imageCount,
        r.videoCount,
        r.otherCount,
        r.gatewaySucceeded,
        r.gatewayFailed,
        r.costYuan,
      ]),
    );
  }
  lines.push("");

  lines.push("# by_project");
  lines.push(
    csvLine([
      "app_key",
      "app_label",
      "project_key",
      "project_label",
      "credits",
      "image_count",
      "video_count",
      "gateway_succeeded",
      "cost_yuan",
    ]),
  );
  for (const r of daily.byProject) {
    lines.push(
      csvLine([
        r.appKey,
        r.appLabel,
        r.projectKey,
        r.projectLabel,
        r.credits,
        r.imageCount,
        r.videoCount,
        r.gatewaySucceeded,
        r.costYuan,
      ]),
    );
  }
  lines.push("");

  lines.push("# details");
  lines.push(
    csvLine([
      "id",
      "submitted_at",
      "app_label",
      "project_label",
      "model",
      "request_kind",
      "media_kind",
      "credits",
      "cost_yuan",
      "actor_book_user_id",
    ]),
  );
  for (const r of daily.details) {
    lines.push(
      csvLine([
        r.id,
        r.submittedAt,
        r.appLabel,
        r.projectLabel,
        r.model,
        r.requestKind,
        r.mediaKind,
        r.credits,
        r.costYuan,
        r.actorBookUserId,
      ]),
    );
  }

  return `\uFEFF${lines.join("\n")}\n`;
}
