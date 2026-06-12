import { expireDueMediaRenderJobs } from "../lib/media/media-render-service";
import { prisma } from "../lib/prisma";

async function main() {
  let total = 0;
  for (let i = 0; i < 20; i++) {
    const n = await expireDueMediaRenderJobs(50);
    total += n;
    if (n < 50) break;
  }
  console.log("expired_media_render_jobs", total);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
