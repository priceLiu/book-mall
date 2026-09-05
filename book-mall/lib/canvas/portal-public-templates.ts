/**
 * 门户首页 · 公开 Pro2 模板列表（与 GET /api/canvas/templates?scope=public 同源）。
 */
import type { Prisma } from "@prisma/client";

import { resolveListThumbnailUrl } from "@/lib/canvas/resolve-list-thumbnail";
import { prisma } from "@/lib/prisma";

function templateSelect() {
  return {
    id: true,
    name: true,
    category: true,
    thumbnail: true,
    description: true,
    visibility: true,
    featured: true,
    edition: true,
    forkCount: true,
    sourceLabel: true,
    builtin: true,
    ownerUserId: true,
    canvas: true,
    sortOrder: true,
    createdAt: true,
    updatedAt: true,
    owner: { select: { id: true, name: true, email: true } },
  } as const;
}

export type PortalPublicCanvasTemplate = {
  id: string;
  name: string;
  category: string;
  thumbnail: string;
  thumbnailUrl: string;
  description: string;
  visibility: string;
  featured: boolean;
  edition: string;
  forkCount: number;
  sourceLabel: string;
  builtin: boolean;
  ownerUserId: string | null;
  canvas: unknown;
  createdAt: string;
  updatedAt: string;
  owner: { id: string; name: string | null; email: string | null } | null;
};

function mapTemplateRow(
  row: Prisma.CanvasTemplateGetPayload<{ select: ReturnType<typeof templateSelect> }>,
): PortalPublicCanvasTemplate {
  return {
    ...row,
    description: row.description ?? "",
    thumbnailUrl: resolveListThumbnailUrl({
      storedUrl: row.thumbnail,
      canvas: row.canvas,
    }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** scope=public · 非 builtin · edition=pro2，与门户客户端过滤一致 */
export async function listPortalPublicPro2CanvasTemplates(): Promise<PortalPublicCanvasTemplate[]> {
  const rows = await prisma.canvasTemplate.findMany({
    where: { visibility: "public", builtin: false, edition: "pro2" },
    orderBy: [
      { featured: "desc" },
      { sortOrder: "asc" },
      { forkCount: "desc" },
      { createdAt: "desc" },
    ],
    take: 200,
    select: templateSelect(),
  });

  return rows.map(mapTemplateRow);
}
