import { getMainSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

export async function GET() {
  const origin = getMainSiteOrigin();
  if (!origin) {
    return Response.json({ error: "main_site_origin_unconfigured" }, { status: 503 });
  }

  try {
    const res = await fetch(
      `${origin.replace(/\/$/, "")}/api/public/static-snapshots/quick-replica-gallery`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      return Response.json(
        { error: body?.message ?? `snapshot_http_${res.status}` },
        { status: res.status === 404 ? 404 : 502 },
      );
    }
    const data = await res.json();
    return Response.json(data, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      },
    });
  } catch {
    return Response.json({ error: "gallery_snapshot_fetch_failed" }, { status: 503 });
  }
}
