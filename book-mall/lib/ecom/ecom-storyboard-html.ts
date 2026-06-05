import type { StoryboardReference, StoryboardSheet } from "@/lib/ecom/ecom-storyboard-types";

export function buildStoryboardStandaloneHtml(
  sheet: StoryboardSheet,
  references: StoryboardReference[],
): string {
  const refMap = new Map(references.map((r) => [r.id, r]));
  const castRows = sheet.cast
    .map((c) => {
      const ref = c.refId ? refMap.get(c.refId) : undefined;
      const img = ref
        ? `<img src="${escapeHtml(ref.ossUrl)}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:8px"/>`
        : "";
      return `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.role)}</td><td>${img}</td></tr>`;
    })
    .join("");

  const panelRows = sheet.panels
    .map(
      (p) => `<tr>
        <td>${p.index}</td>
        <td>${escapeHtml(p.shotType)}</td>
        <td>${escapeHtml(p.scene)}</td>
        <td>${escapeHtml(p.action)}</td>
        <td>${escapeHtml(p.dialogue ?? "")}</td>
        <td>${escapeHtml(p.camera ?? "")}</td>
        <td>${p.durationHintSec ?? ""}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(sheet.overview.title)} · 分镜故事版</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; background: #f5f5f7; color: #1d1d1f; margin: 0; padding: 24px; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  .meta { color: #6e6e73; font-size: 14px; margin-bottom: 20px; }
  .highlight { background: #fff; border-left: 4px solid #0071e3; padding: 12px 16px; margin-bottom: 24px; border-radius: 8px; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; margin-bottom: 24px; font-size: 13px; }
  th, td { border: 1px solid #e8e8ed; padding: 10px 12px; text-align: left; vertical-align: top; }
  th { background: #1d1d1f; color: #fff; font-weight: 600; }
  .section-title { font-size: 16px; font-weight: 600; margin: 24px 0 12px; }
</style>
</head>
<body>
  <h1>${escapeHtml(sheet.overview.title)}</h1>
  <p class="meta">${escapeHtml(sheet.overview.logline)}</p>
  ${
    sheet.overview.productHighlight
      ? `<div class="highlight"><strong>商品卖点：</strong>${escapeHtml(sheet.overview.productHighlight)}</div>`
      : ""
  }
  <div class="section-title">角色</div>
  <table><thead><tr><th>角色</th><th>定位</th><th>参考</th></tr></thead><tbody>${castRows || "<tr><td colspan='3'>—</td></tr>"}</tbody></table>
  <div class="section-title">分镜表</div>
  <table>
    <thead><tr><th>镜号</th><th>景别</th><th>场景</th><th>画面/动作</th><th>对白</th><th>运镜</th><th>时长(s)</th></tr></thead>
    <tbody>${panelRows}</tbody>
  </table>
  <script type="application/json" id="storyboard-sheet">${escapeHtml(JSON.stringify(sheet))}</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
