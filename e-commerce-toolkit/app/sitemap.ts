import type { MetadataRoute } from "next";
import { getAppPublicOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getAppPublicOrigin() ?? "https://ecom.local";
  const now = new Date();
  return [
    { url: `${origin}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${origin}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${origin}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];
}
