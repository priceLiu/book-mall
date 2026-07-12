import type { MetadataRoute } from "next";
import { getAppPublicOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getAppPublicOrigin() ?? "https://canvas.local";
  const now = new Date();
  return [
    { url: `${origin}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${origin}/gallery`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${origin}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${origin}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];
}
