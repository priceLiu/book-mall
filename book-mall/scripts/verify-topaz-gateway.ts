/* eslint-disable no-console */
import { prisma } from "../lib/prisma";

async function main() {
  const model = await prisma.modelCatalog.findFirst({
    where: { canonicalKey: "topaz-labs/video-enhance" },
    select: { canonicalKey: true, displayName: true, active: true },
  });
  const route = await prisma.gatewayModelRoute.findFirst({
    where: { modelKey: "topaz-labs/video-enhance" },
    select: { providerKind: true, modelKey: true, vendor: true },
  });
  const cred = await prisma.gatewayVendorCredential.findFirst({
    where: { providerKind: "TOPAZ" },
    select: { id: true, alias: true, active: true, providerKind: true },
  });
  console.log(JSON.stringify({ model, route, topazCredential: cred }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
