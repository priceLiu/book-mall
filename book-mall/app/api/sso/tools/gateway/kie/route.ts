import { NextResponse } from "next/server";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";
import {
  GatewayRequiredError,
  assertGatewayApiKeyLinkedForUser,
} from "@/lib/gateway/book-gateway-link";
import {
  assertPlatformGatewayEntitlement,
  PlatformEntitlementError,
} from "@/lib/platform-gateway-entitlement";
import { clientPageToServiceNavKey } from "@/lib/tool-service-fee/tool-key-nav";
import {
  toolGwCreateKieI2vJob,
  toolGwPollKieJob,
  toolGwCreateKieJob,
  toolGwCreateKieVideoToolJob,
} from "@/lib/gateway/kie-tool-gateway";
import { buildKieImageCreateArgs } from "@/lib/canvas/providers/kie";

export const dynamic = "force-dynamic";

async function resolveToolUser(request: Request) {
  const auth = verifyToolsBearer(request);
  if (!auth.ok) return null;
  return auth.userId;
}

export async function POST(request: Request) {
  const userId = await resolveToolUser(request);
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await assertGatewayApiKeyLinkedForUser(userId);
    const clientPageRaw =
      typeof body.clientPage === "string" ? body.clientPage.trim() : "";
    const navFromPage = clientPageRaw ? clientPageToServiceNavKey(clientPageRaw) : null;
    await assertPlatformGatewayEntitlement(userId, navFromPage ? { navKey: navFromPage } : {});
  } catch (e) {
    if (e instanceof PlatformEntitlementError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.httpStatus });
    }
    if (e instanceof GatewayRequiredError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 403 });
    }
    throw e;
  }

  const kind = String(body.kind ?? "i2v");
  const model = String(body.model ?? "").trim();
  const clientPage =
    typeof body.clientPage === "string" ? body.clientPage.trim() : undefined;

  if (!model) {
    return NextResponse.json({ error: "model required" }, { status: 400 });
  }

  try {
    if (kind === "i2v") {
      const prompt = String(body.prompt ?? "").trim();
      if (!prompt) {
        return NextResponse.json({ error: "prompt required" }, { status: 400 });
      }
      const urlsRaw = body.imageUrls;
      const imageUrls = Array.isArray(urlsRaw)
        ? urlsRaw.filter((u): u is string => typeof u === "string" && u.trim().length > 0)
        : [];
      if (!imageUrls.length) {
        return NextResponse.json({ error: "imageUrls required" }, { status: 400 });
      }
      const resolution =
        typeof body.resolution === "string" ? body.resolution : undefined;
      const duration =
        typeof body.duration === "number" && Number.isFinite(body.duration)
          ? Math.floor(body.duration)
          : undefined;
      const aspectRatio =
        typeof body.aspectRatio === "string" ? body.aspectRatio : undefined;
      const mode = typeof body.mode === "string" ? body.mode : undefined;

      const result = await toolGwCreateKieI2vJob(userId, {
        model,
        prompt,
        imageUrls,
        resolution,
        duration,
        aspectRatio,
        mode,
        clientPage,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (kind === "v2v" || kind === "motion-control" || kind === "video-upscale") {
      const videoUrlsRaw = body.videoUrls;
      const videoUrls = Array.isArray(videoUrlsRaw)
        ? videoUrlsRaw.filter((u): u is string => typeof u === "string" && u.trim().length > 0)
        : undefined;
      const imageUrlsRaw = body.imageUrls;
      const imageUrls = Array.isArray(imageUrlsRaw)
        ? imageUrlsRaw.filter((u): u is string => typeof u === "string" && u.trim().length > 0)
        : undefined;
      const videoUrl =
        typeof body.videoUrl === "string" ? body.videoUrl.trim() : undefined;
      const prompt =
        typeof body.prompt === "string" ? body.prompt.trim() : undefined;
      const resolution =
        typeof body.resolution === "string" ? body.resolution : undefined;
      const duration =
        typeof body.duration === "number" && Number.isFinite(body.duration)
          ? Math.floor(body.duration)
          : undefined;
      const mode = typeof body.mode === "string" ? body.mode : undefined;
      const characterOrientation =
        typeof body.characterOrientation === "string"
          ? body.characterOrientation
          : undefined;
      const backgroundSource =
        typeof body.backgroundSource === "string" ? body.backgroundSource : undefined;
      const upscaleFactor = body.upscaleFactor;

      const result = await toolGwCreateKieVideoToolJob(userId, {
        model,
        prompt,
        imageUrls,
        videoUrls,
        videoUrl,
        resolution,
        duration,
        mode,
        characterOrientation,
        backgroundSource,
        upscaleFactor:
          typeof upscaleFactor === "string" || typeof upscaleFactor === "number"
            ? upscaleFactor
            : undefined,
        nsfwChecker: body.nsfwChecker === true,
        clientPage,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (kind === "image") {
      const prompt = String(body.prompt ?? "").trim();
      if (!prompt) {
        return NextResponse.json({ error: "prompt required" }, { status: 400 });
      }
      const modelKey = model;
      const urlsRaw = body.imageUrls;
      const imageUrls = Array.isArray(urlsRaw)
        ? urlsRaw.filter((u): u is string => typeof u === "string" && u.trim().length > 0)
        : undefined;
      const params =
        body.params && typeof body.params === "object" && !Array.isArray(body.params)
          ? (body.params as Record<string, unknown>)
          : {};
      const { model: upstreamModel, input } = buildKieImageCreateArgs({
        modelKey,
        prompt,
        imageUrls,
        params,
      });
      const result = await toolGwCreateKieJob(userId, {
        model: upstreamModel,
        input,
        clientPage,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "unknown kind" }, { status: 400 });
  } catch (e) {
    if (e instanceof GatewayRequiredError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 403 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

export async function GET(request: Request) {
  const userId = await resolveToolUser(request);
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const url = new URL(request.url);
  const taskId = url.searchParams.get("taskId")?.trim();
  if (!taskId) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  try {
    await assertGatewayApiKeyLinkedForUser(userId);
    const output = await toolGwPollKieJob(userId, { taskId });
    return NextResponse.json({ ok: true, output });
  } catch (e) {
    if (e instanceof GatewayRequiredError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 403 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
