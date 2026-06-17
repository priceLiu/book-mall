import { notFound } from "next/navigation";

import { MarketPlaygroundClient } from "@/components/market/market-playground-client";
import { gatewayJson } from "@/lib/gateway-api";
import { marketModelGatewayPath } from "@/lib/market-types";
import type { MarketDetailResponse } from "@/lib/market-types";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ canonicalKey: string[] }>;
};

function decodeCanonicalKey(segments: string[]): string {
  return segments.map((s) => decodeURIComponent(s)).join("/");
}

export default async function MarketPlaygroundPage({ params }: Props) {
  const { canonicalKey: segments } = await params;
  const canonicalKey = decodeCanonicalKey(segments);
  if (!canonicalKey) notFound();

  const apiPath = marketModelGatewayPath(canonicalKey);
  const { ok, data } = await gatewayJson<MarketDetailResponse>(apiPath);

  if (!ok || !data?.model) notFound();

  return (
    <MarketPlaygroundClient canonicalKey={canonicalKey} initial={data} />
  );
}
