import { importAdminPendingFeaturesFromDocs } from "@/lib/admin/pending-feature-service";

async function main() {
  const result = await importAdminPendingFeaturesFromDocs();
  console.log(
    `[import-pending-features-from-docs] created=${result.created} skipped=${result.skipped} totalInDocs=${result.totalInDocs}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
