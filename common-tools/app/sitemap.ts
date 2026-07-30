import type { MetadataRoute } from "next";

import { LIVE_TOOLS } from "@/lib/tools-registry";
import { getAppPublicOrigin } from "@/lib/site-origin";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getAppPublicOrigin() ?? "http://localhost:3010";
  const base = origin.replace(/\/$/, "");
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    ...LIVE_TOOLS.map((t) => ({
      url: `${base}/t/${t.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
