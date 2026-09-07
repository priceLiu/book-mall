/**
 * 故事剧场选题库 · 平台种子（幂等 upsert）
 * 用法：cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/seed-story-theater-topics.ts
 */
import { prisma } from "@/lib/prisma";
import { STORY_THEATER_TOPIC_SEED } from "@/lib/ecom/story-theater-topic-seed-data";

async function main() {
  let upserted = 0;
  for (const row of STORY_THEATER_TOPIC_SEED) {
    await prisma.ecomStoryTheaterTopic.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        vertical: row.vertical,
        title: row.title,
        storyCore: row.storyCore,
        storyType: row.storyType,
        tags: row.tags,
        scope: "platform",
        enabled: true,
        sortOrder: row.sortOrder,
      },
      update: {
        vertical: row.vertical,
        title: row.title,
        storyCore: row.storyCore,
        storyType: row.storyType,
        tags: row.tags,
        enabled: true,
        sortOrder: row.sortOrder,
        deletedAt: null,
      },
    });
    upserted += 1;
  }
  console.log(`[story-theater-topics] upserted ${upserted} platform topics`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
