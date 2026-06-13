/**
 * 将 Story-Pro 旧资产表回填到 ProjectAsset（一次性）。
 *
 * cd book-mall && npx tsx scripts/migrate-story-pro-to-project-assets.ts
 */
import { prisma } from "../lib/prisma";
import { createProjectAsset } from "../lib/project-asset/project-asset-service";
import { listStoryProCharacterAssets } from "../lib/canvas/story-pro-character-asset-service";

async function main() {
  const users = await prisma.user.findMany({ select: { id: true }, take: 500 });
  let created = 0;
  for (const user of users) {
    const chars = await listStoryProCharacterAssets(user.id, {});
    for (const c of chars) {
      const exists = await prisma.projectAsset.findFirst({
        where: {
          ownerUserId: user.id,
          payload: { path: ["legacyId"], equals: c.id },
        },
      });
      if (exists) continue;
      const thumb = c.refs.find((r) => r.kind === "three_view")?.ossUrl ?? c.refs[0]?.ossUrl ?? "";
      await createProjectAsset(user.id, {
        kind: "CHARACTER",
        displayName: c.displayName,
        thumbnailUrl: thumb,
        sourceProjectId: c.projectId,
        payload: {
          legacyId: c.id,
          legacySource: "storyProCharacter",
          characterKey: c.characterKey,
          slots: Object.fromEntries(c.refs.map((r) => [r.kind, r.ossUrl])),
        },
        refs: c.refs.map((r, i) => ({
          slotKey: r.kind,
          label: r.label ?? "",
          mediaUrl: r.ossUrl,
          sortOrder: i,
        })),
      });
      created++;
    }
  }
  console.log(`Migrated ${created} character assets to ProjectAsset`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
