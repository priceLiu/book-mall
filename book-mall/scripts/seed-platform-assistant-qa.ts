import { prisma } from "../lib/prisma";

const CAPABILITY_ANSWER =
  "我能解答平台的一些介绍, 功能的一些用法, 也可以收集您的问题, 让专业的团队给您回复.";

const ENTRIES = [
  {
    question: "你有几岁了？",
    answer: "平台还未满一年呀, 希望你陪伴我一起成长.",
    sortOrder: 10,
  },
  {
    question: "这个平台国内有吗？",
    answer:
      "肯定有呀, 平台覆盖会比国内的更加广, 影视剧, 电商, 企业用户, 个人用户, 自媒体创作者, 都可以找到合适的工具.",
    sortOrder: 10,
  },
  {
    question: "你能干什么？",
    answer: CAPABILITY_ANSWER,
    sortOrder: 20,
  },
  {
    question: "你能做什么？",
    answer: CAPABILITY_ANSWER,
    sortOrder: 20,
  },
] as const;

async function main() {
  for (const e of ENTRIES) {
    const existing = await prisma.platformAssistantQaEntry.findFirst({
      where: { question: e.question },
      select: { id: true },
    });
    if (existing) {
      await prisma.platformAssistantQaEntry.update({
        where: { id: existing.id },
        data: {
          answer: e.answer,
          enabled: true,
          sortOrder: e.sortOrder,
          matchMode: "CONTAINS",
        },
      });
      console.log("updated:", e.question);
    } else {
      await prisma.platformAssistantQaEntry.create({
        data: {
          question: e.question,
          answer: e.answer,
          enabled: true,
          sortOrder: e.sortOrder,
          matchMode: "CONTAINS",
        },
      });
      console.log("created:", e.question);
    }
  }

  const rows = await prisma.platformAssistantQaEntry.findMany({
    orderBy: { updatedAt: "desc" },
    select: { question: true, answer: true, enabled: true },
  });
  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
