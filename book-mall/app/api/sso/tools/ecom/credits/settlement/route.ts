import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { prisma } from "@/lib/prisma";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Phase = "frozen" | "settled" | "consumed" | "released" | "none" | "pending";

/**
 * 电商生成对应的 Gateway 日志结算态。
 * 视频：发起冻结 → 成功实扣 / 失败释放。图片与文本：成功实扣。
 */
export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return auth.res;

  const logId = new URL(req.url).searchParams.get("logId")?.trim() ?? "";
  if (!logId) {
    return ecomJson({ error: "logId 必填" }, { status: 400 });
  }

  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: logId },
    select: {
      id: true,
      status: true,
      requestKind: true,
      creditsCharged: true,
      actorBookUserId: true,
      apiKeyId: true,
    },
  });
  if (!log) return ecomJson({ error: "日志不存在" }, { status: 404 });

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { gatewayApiKeyId: true },
  });
  const owns =
    log.actorBookUserId === auth.userId ||
    (user?.gatewayApiKeyId != null && user.gatewayApiKeyId === log.apiKeyId);
  if (!owns) return ecomJson({ error: "日志不存在" }, { status: 404 });

  const ledgers = await prisma.creditLedger.findMany({
    where: {
      idempotencyKey: {
        in: [`reserve:${logId}`, `settle:${logId}`, `release:${logId}`],
      },
    },
    select: { idempotencyKey: true, credits: true },
  });
  const reserve = ledgers.find((row) => row.idempotencyKey === `reserve:${logId}`);
  const released = ledgers.some((row) => row.idempotencyKey === `release:${logId}`);
  const reservedCredits = reserve ? Math.abs(Number(reserve.credits)) : 0;
  const charged =
    log.creditsCharged != null ? Math.max(0, Number(log.creditsCharged)) : 0;

  const terminal =
    log.status === "SUCCEEDED" || log.status === "FAILED" || log.status === "CANCELLED";
  const isVideo = log.requestKind === "VIDEO";

  let phase: Phase = "pending";
  let credits = 0;
  if (released) {
    phase = "released";
    credits = reservedCredits;
  } else if (log.status === "SUCCEEDED" && charged > 0) {
    phase = isVideo ? "settled" : "consumed";
    credits = charged;
  } else if (reservedCredits > 0 && !terminal) {
    phase = "frozen";
    credits = reservedCredits;
  } else if (terminal) {
    phase = "none";
    credits = 0;
  }

  return ecomJson({
    phase,
    credits,
    reservedCredits,
    status: log.status,
    requestKind: log.requestKind,
  });
}
