"use client";

export type EcomBillingMode = "BYOK_SERVICE_FEE" | "PLATFORM_METERED";

export type EcomAsset = {
  id: string;
  module: string;
  kind: string;
  title: string | null;
  prompt: string | null;
  ossUrl: string;
  thumbnailUrl: string | null;
  createdAt: string;
};

async function bookFetch(path: string, init?: RequestInit) {
  const res = await fetch(`/api/book-mall/${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* */
  }
  if (!res.ok) {
    const err =
      typeof data.error === "string"
        ? data.error
        : `请求失败 (${res.status})`;
    throw new Error(err);
  }
  return data;
}

export async function fetchBillingMode(): Promise<EcomBillingMode> {
  const data = await bookFetch("api/sso/tools/ecom/billing-mode");
  const mode = data.ecomBillingMode;
  return mode === "PLATFORM_METERED" ? "PLATFORM_METERED" : "BYOK_SERVICE_FEE";
}

export async function setBillingMode(mode: EcomBillingMode): Promise<void> {
  await bookFetch("api/sso/tools/ecom/billing-mode", {
    method: "PATCH",
    body: JSON.stringify({ ecomBillingMode: mode }),
  });
}

export async function listAssets(module?: string): Promise<EcomAsset[]> {
  const q = module ? `?module=${encodeURIComponent(module)}` : "";
  const data = await bookFetch(`api/sso/tools/ecom/assets${q}`);
  return (data.items as EcomAsset[]) ?? [];
}

export async function deleteAsset(id: string): Promise<void> {
  await bookFetch(`api/sso/tools/ecom/assets?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function reserveUsage(opts: {
  toolKey: string;
  action: string;
  estimatedMaxPoints: number;
  taskKey: string;
}): Promise<{ holdId: string | null; reservedPoints: number; serviceFeeMode?: boolean }> {
  const data = await bookFetch("api/sso/tools/usage?phase=reserve", {
    method: "POST",
    body: JSON.stringify({
      phase: "reserve",
      toolKey: opts.toolKey,
      action: opts.action,
      estimatedMaxPoints: opts.estimatedMaxPoints,
      taskKey: opts.taskKey,
    }),
  });
  return {
    holdId: (data.holdId as string | null) ?? null,
    reservedPoints: Number(data.reservedPoints ?? 0),
    serviceFeeMode: Boolean(data.serviceFeeMode),
  };
}

export async function settleUsage(opts: {
  toolKey: string;
  action: string;
  holdId?: string | null;
  taskKey: string;
  meta: Record<string, unknown>;
}): Promise<{ recorded: boolean; chargePoints?: number }> {
  const data = await bookFetch("api/sso/tools/usage?phase=settle", {
    method: "POST",
    body: JSON.stringify({
      phase: "settle",
      toolKey: opts.toolKey,
      action: opts.action,
      holdId: opts.holdId ?? undefined,
      taskKey: opts.taskKey,
      meta: opts.meta,
    }),
  });
  return {
    recorded: Boolean(data.recorded),
    chargePoints:
      typeof data.chargePoints === "number" ? data.chargePoints : undefined,
  };
}

export async function generateImage(opts: {
  toolKey: string;
  action: string;
  prompt: string;
  module: string;
  estimatedPoints?: number;
}): Promise<{ asset: EcomAsset; chargePoints?: number }> {
  const data = await bookFetch("api/sso/tools/ecom/generate/image", {
    method: "POST",
    body: JSON.stringify(opts),
  });
  return {
    asset: data.asset as EcomAsset,
    chargePoints:
      typeof data.chargePoints === "number" ? data.chargePoints : undefined,
  };
}

export async function generateVideo(opts: {
  toolKey: string;
  action: string;
  prompt: string;
  module: string;
  durationSec?: number;
  referenceImageUrl?: string;
}): Promise<{ asset: EcomAsset; taskId?: string }> {
  const data = await bookFetch("api/sso/tools/ecom/generate/video", {
    method: "POST",
    body: JSON.stringify(opts),
  });
  return {
    asset: data.asset as EcomAsset,
    taskId: typeof data.taskId === "string" ? data.taskId : undefined,
  };
}

export async function fetchBillableEstimate(
  toolKey: string,
  action: string,
  modelKey?: string,
): Promise<number | null> {
  const params = new URLSearchParams({ toolKey, action });
  if (modelKey) params.set("schemeARefModelKey", modelKey);
  const data = await bookFetch(`api/sso/tools/billable-price?${params}`);
  const pts = data.pricePoints;
  return typeof pts === "number" && pts > 0 ? pts : null;
}
