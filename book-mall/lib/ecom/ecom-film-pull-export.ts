import { createZipArchive, formatExportTimestamp } from "@/lib/zip/create-zip-archive";

import { getEcomFilmPullProject } from "@/lib/ecom/ecom-film-pull-service";
import { formatFilmPullAnalyzeMarkdown } from "@/lib/ecom/ecom-film-pull-structured";

function sanitizeZipSegment(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fff.-]+/g, "_").slice(0, 80) || "专业拉片";
}

export async function buildFilmPullExportZip(
  userId: string,
  projectId: string,
): Promise<{ buf: Buffer; fileName: string }> {
  const project = await getEcomFilmPullProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const analyze = project.analyzeResult?.structured;
  if (!analyze) throw new Error("暂无拉片结果可导出");

  const ts = formatExportTimestamp();
  const base = sanitizeZipSegment(project.title ?? "专业拉片");
  const fileName = `${base}-${ts}.zip`;

  const markdown = formatFilmPullAnalyzeMarkdown(analyze);
  const json = JSON.stringify(
    {
      analyze,
      renderScript: project.renderScript?.structured ?? null,
      renderPlan: project.renderPlan,
      refMatch: project.refMatch,
      productionPlan: project.productionPlan,
    },
    null,
    2,
  );

  const buf = await createZipArchive([
    { path: "拉片结果.md", content: Buffer.from(markdown, "utf8") },
    { path: "film-pull.json", content: Buffer.from(json, "utf8") },
  ]);

  return { buf, fileName };
}

export function buildFilmPullExportJson(userId: string, projectId: string) {
  return getEcomFilmPullProject(userId, projectId).then((project) => {
    if (!project) throw new Error("项目不存在");
    return {
      analyze: project.analyzeResult?.structured ?? null,
      renderScript: project.renderScript?.structured ?? null,
      renderPlan: project.renderPlan,
      refMatch: project.refMatch,
      productionPlan: project.productionPlan,
      meta: project.meta,
    };
  });
}
