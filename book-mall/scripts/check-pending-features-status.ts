import { prisma } from "@/lib/prisma";
import { isAdminPendingFeatureRoadmapTitle } from "@/lib/admin/pending-feature-roadmap";

async function main() {
  const rows = await prisma.adminPendingFeature.findMany({
    where: { completed: false },
    select: { title: true },
  });
  const features = rows.filter((r) => isAdminPendingFeatureRoadmapTitle(r.title));
  console.log({
    features: features.length,
    featureTitles: features.map((r) => r.title),
    pending: rows.length - features.length,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
