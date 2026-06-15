/**
 * 从 Canvas 任务 inputPayload.gatewayLogId 关联 Gateway 扣费快照。
 */
import { prisma } from "@/lib/prisma";

export type CanvasTaskBillingSnap = {
  creditsCharged: number | null;
  billingMode: "PLATFORM_CREDIT" | "BYOK" | null;
};

function gatewayLogIdFromPayload(inputPayload: unknown): string | null {
  if (!inputPayload || typeof inputPayload !== "object") return null;
  const raw = (inputPayload as { gatewayLogId?: unknown }).gatewayLogId;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export async function loadGatewayBillingByLogIds(
  logIds: string[],
): Promise<Map<string, CanvasTaskBillingSnap>> {
  const ids = [...new Set(logIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  const rows = await prisma.gatewayRequestLog.findMany({
    where: { id: { in: ids } },
    select: { id: true, creditsCharged: true, billingMode: true },
  });
  return new Map(
    rows.map((r) => [
      r.id,
      {
        creditsCharged: r.creditsCharged,
        billingMode: r.billingMode,
      },
    ]),
  );
}

export async function enrichCanvasTaskRows<
  T extends { inputPayload?: unknown },
>(
  rows: T[],
): Promise<
  Array<
    Omit<T, "inputPayload"> & {
      creditsCharged: number | null;
      billingMode: "PLATFORM_CREDIT" | "BYOK" | null;
    }
  >
> {
  const logIds = rows
    .map((r) => gatewayLogIdFromPayload(r.inputPayload))
    .filter((id): id is string => Boolean(id));
  const billingByLogId = await loadGatewayBillingByLogIds(logIds);
  return enrichCanvasTasksWithBilling(rows, billingByLogId);
}

export function enrichCanvasTasksWithBilling<
  T extends { inputPayload?: unknown },
>(
  rows: T[],
  billingByLogId: Map<string, CanvasTaskBillingSnap>,
): Array<
  Omit<T, "inputPayload"> & {
    creditsCharged: number | null;
    billingMode: "PLATFORM_CREDIT" | "BYOK" | null;
  }
> {
  return rows.map(({ inputPayload, ...row }) => {
    const logId = gatewayLogIdFromPayload(inputPayload);
    const snap = logId ? billingByLogId.get(logId) : undefined;
    return {
      ...row,
      creditsCharged: snap?.creditsCharged ?? null,
      billingMode: snap?.billingMode ?? null,
    };
  });
}

export async function enrichSingleCanvasTask<
  T extends { inputPayload?: unknown },
>(
  row: T,
): Promise<
  Omit<T, "inputPayload"> & {
    creditsCharged: number | null;
    billingMode: "PLATFORM_CREDIT" | "BYOK" | null;
  }
> {
  const [one] = await enrichCanvasTaskRows([row]);
  return one;
}
