import type { MetadataRoute } from "next";
import { getAppPublicOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const origin = getAppPublicOrigin() ?? "https://story.local";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register"],
        disallow: ["/account", "/api/", "/auth/"],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
