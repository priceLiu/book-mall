import type { MetadataRoute } from "next";
import { getAppPublicOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const origin = getAppPublicOrigin() ?? "https://canvas.local";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/gallery", "/login", "/register"],
        disallow: ["/account", "/projects", "/canvas", "/api/", "/auth/"],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
