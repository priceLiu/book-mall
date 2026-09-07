import { NextResponse } from "next/server";

import { requireQuickReplicaSession } from "@/lib/quick-replica/qr-platform-auth";
import {
  createUserQrTemplate,
  listQrTemplates,
  listUserOwnGalleryTemplates,
} from "@/lib/quick-replica/qr-template-service";
import type { QrCategory, QrTemplateJson } from "@/lib/quick-replica/qr-types";
import {
  mergeUserOwnTemplatesIntoGallery,
  pickHomeFeedFromSnapshot,
  pickTemplatesFromSnapshot,
} from "@/lib/static-snapshots/quick-replica-gallery-query";
import { getQuickReplicaGallerySnapshotForApi } from "@/lib/static-snapshots/quick-replica-gallery-snapshot-service";

export const dynamic = "force-dynamic";

function parseCategory(raw: string | null): QrCategory | null {
  if (!raw) return null;
  const v = raw.trim() as QrCategory;
  if (v === "video" || v === "image" || v === "character" || v === "world" || v === "audio") {
    return v;
  }
  return null;
}

function snapshotMeta(result: Awaited<ReturnType<typeof getQuickReplicaGallerySnapshotForApi>>) {
  return {
    dateKey: result.dateKey,
    stale: result.stale,
    source: result.source,
  };
}

export async function GET(request: Request) {
  const auth = await requireQuickReplicaSession(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const category = parseCategory(url.searchParams.get("category"));
  const kind = url.searchParams.get("kind")?.trim() || null;
  const toolKey = url.searchParams.get("toolKey")?.trim() || null;
  const scopeRaw = url.searchParams.get("scope")?.trim();
  const scope = scopeRaw === "my" ? "my" : "all";

  if (scope === "my") {
    const templates = await listQrTemplates(auth.userId, { category, kind, toolKey, scope: "my" });
    return NextResponse.json({ templates, scope });
  }

  try {
    const snap = await getQuickReplicaGallerySnapshotForApi();

    if (url.searchParams.get("homeFeed") === "1") {
      return NextResponse.json({
        templatesByCategory: pickHomeFeedFromSnapshot(snap.payload),
        scope,
        homeFeed: true,
        snapshot: snapshotMeta(snap),
      });
    }

    const fromSnapshot = pickTemplatesFromSnapshot(snap.payload, {
      category,
      kind,
      toolKey,
      scope: "all",
    });
    const own = await listUserOwnGalleryTemplates(auth.userId, {
      category,
      kind,
      toolKey,
      scope: "all",
    });
    const templates = mergeUserOwnTemplatesIntoGallery(fromSnapshot, own, {
      category,
      kind,
      toolKey,
      scope: "all",
    });

    return NextResponse.json({
      templates,
      scope,
      snapshot: snapshotMeta(snap),
    });
  } catch {
    const templates = await listQrTemplates(auth.userId, { category, kind, toolKey, scope: "all" });
    if (url.searchParams.get("homeFeed") === "1") {
      const { listQrTemplatesHomeFeed } = await import("@/lib/quick-replica/qr-template-service");
      const templatesByCategory = await listQrTemplatesHomeFeed(auth.userId);
      return NextResponse.json({ templatesByCategory, scope, homeFeed: true });
    }
    return NextResponse.json({ templates, scope });
  }
}

export async function POST(request: Request) {
  const auth = await requireQuickReplicaSession(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const category = parseCategory(typeof body.category === "string" ? body.category : null);
  const kind = typeof body.kind === "string" ? body.kind.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const thumbnailUrl = typeof body.thumbnailUrl === "string" ? body.thumbnailUrl.trim() : "";
  const reference = body.reference as QrTemplateJson["reference"] | undefined;

  if (!category || !kind || !title || !thumbnailUrl || !reference) {
    return NextResponse.json({ error: "category/kind/title/thumbnailUrl/reference 必填" }, { status: 400 });
  }

  const template = await createUserQrTemplate({
    userId: auth.userId,
    category,
    kind,
    toolKey: typeof body.toolKey === "string" ? body.toolKey : undefined,
    title,
    thumbnailUrl,
    reference,
    output: body.output as QrTemplateJson["output"] | undefined,
    gatewayRequestLogId:
      typeof body.gatewayRequestLogId === "string" ? body.gatewayRequestLogId : undefined,
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
  });

  return NextResponse.json({ template }, { status: 201 });
}
