import { KIE_PRICING_API_URL } from "@/lib/pricing/kie-pricing-constants";

export type KiePricingApiRow = {
  modelDescription: string;
  interfaceType: string;
  provider: string;
  creditPrice: string;
  creditUnit: string;
  usdPrice?: string;
  falPrice?: string;
  discountRate?: number;
  anchor?: string;
};

type KiePricingPageResponse = {
  code: number;
  data?: {
    records: KiePricingApiRow[];
    pages: number;
    total: number;
  };
};

export async function fetchAllKiePricingRows(): Promise<KiePricingApiRow[]> {
  const all: KiePricingApiRow[] = [];
  let page = 1;
  let pages = 1;
  while (page <= pages) {
    const res = await fetch(KIE_PRICING_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageNum: page,
        pageSize: 100,
        modelDescription: "",
        interfaceType: "",
      }),
    });
    if (!res.ok) {
      throw new Error(`KIE pricing API HTTP ${res.status}`);
    }
    const json = (await res.json()) as KiePricingPageResponse;
    if (json.code !== 200 || !json.data?.records?.length) break;
    all.push(...json.data.records);
    pages = json.data.pages ?? 1;
    page += 1;
  }
  return all;
}
