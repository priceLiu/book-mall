/**
 * 将全部分镜 1.0（sbv1）画布项目标记为首页「视频作品」已上架。
 * 用法：cd book-mall && dotenv -e .env.local -- tsx scripts/bootstrap-portal-film-case-all.ts
 */
import { canvasProjectEditionFromGraph } from "@/lib/canvas/canvas-story-edition";
import { prisma } from "@/lib/prisma";

async function main() {
  const rows = await prisma.canvasProject.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, canvas: true, portalFilmCase: true },
  });

  const sbv1 = rows.filter(
    (r) => canvasProjectEditionFromGraph(r.canvas) === "sbv1",
  );
  let updated = 0;
  for (const row of sbv1) {
    if (row.portalFilmCase) continue;
    await prisma.canvasProject.update({
      where: { id: row.id },
      data: { portalFilmCase: true },
    });
    updated += 1;
    console.log(`[portal-film] 上架 ${row.id} · ${row.name}`);
  }

  console.log(
    `[portal-film] 完成：sbv1 共 ${sbv1.length} 个，新上架 ${updated} 个，已上架 ${sbv1.length - updated} 个`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
