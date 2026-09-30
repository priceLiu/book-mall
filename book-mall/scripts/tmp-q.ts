import { prisma } from "../lib/prisma";
(async () => {
  const profiles = await prisma.modelCostProfile.findMany({
    where: { active: true, OR: [{ canonicalModelKey: { contains: "qwen", mode: "insensitive" } }, { canonicalModelKey: { contains: "wan3", mode: "insensitive" } }, { canonicalModelKey: { contains: "3.0", mode: "insensitive" } }, { canonicalModelKey: { contains: "3-0", mode: "insensitive" } }] },
    select: { canonicalModelKey: true, tierRaw: true, unit: true, vendor: true, channel: true, listCostYuan: true, discountRate: true, netCostYuan: true, marginM: true },
    orderBy: [{ unit: "asc" }, { canonicalModelKey: "asc" }],
  });
  for (const p of profiles) if (p.unit !== "PER_KTOKEN") console.log("CP", p.unit, p.canonicalModelKey, p.tierRaw ?? "", p.vendor, p.channel, String(p.listCostYuan), String(p.discountRate), String(p.netCostYuan), String(p.marginM));
  const prices = await prisma.modelCreditPrice.findMany({
    where: { active: true, unit: { not: "PER_KTOKEN" }, OR: [{ canonicalModelKey: { contains: "qwen", mode: "insensitive" } }, { canonicalModelKey: { contains: "3.0", mode: "insensitive" } }, { canonicalModelKey: { contains: "3-0", mode: "insensitive" } }] },
    select: { canonicalModelKey: true, tierRaw: true, unit: true, displayName: true, netCostYuan: true, marginM: true, creditsPerUnit: true },
  });
  for (const p of prices) console.log("PUB", p.unit, p.canonicalModelKey, p.tierRaw, p.displayName, String(p.netCostYuan), String(p.marginM), String(p.creditsPerUnit));
})().finally(() => prisma.$disconnect());
