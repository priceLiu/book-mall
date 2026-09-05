import type { CreditCostUnit } from "@prisma/client";

import type { GatewayKieRoute } from "@/lib/pricing/collect-gateway-kie-routes";
import {
  kieCreditsToYuan,
  ktokenFromKieMillionCredits,
} from "@/lib/pricing/kie-pricing-constants";
import type { KiePricingApiRow } from "@/lib/pricing/kie-pricing-api";

export type GatewayKiePriceSpec =
  | {
      kind: "token";
      inputCreditsPerMillion: number;
      outputCreditsPerMillion: number;
      section?: string;
    }
  | {
      kind: "image";
      kieCreditsPerImage: number;
      tierRaw?: string;
      section?: string;
    }
  | {
      kind: "video";
      kieCreditsPerSecond: number;
      tierRaw?: string;
      section?: string;
    }
  | {
      kind: "call";
      kieCreditsPerCall: number;
      section?: string;
    };

export type ResolvedKieRoutePrice = GatewayKiePriceSpec & {
  modelDescription: string;
  creditUnit: string;
  usdCheck?: string;
};

type RouteRule = {
  canonicalModelKey?: string;
  modelKey?: string;
  /** 匹配 modelDescription（不区分大小写，子串） */
  descriptionIncludes: string[];
  /** 排除 */
  descriptionExcludes?: string[];
  pick: "first" | "maxCredits" | "minCredits";
};

/** Gateway route → KIE 价目行选择规则（优先于泛匹配） */
const KIE_ROUTE_PRICE_RULES: RouteRule[] = [
  // —— Chat ——
  {
    modelKey: "gpt-5-5",
    descriptionIncludes: ["gpt-5.5", "input"],
    descriptionExcludes: ["cached"],
    pick: "first",
  },
  {
    modelKey: "claude-opus-4-8",
    descriptionIncludes: ["claude-opus-4-8", "input"],
    pick: "first",
  },
  {
    modelKey: "claude-opus-4-5",
    descriptionIncludes: ["claude-opus-4-5", "input"],
    pick: "first",
  },
  {
    modelKey: "gemini-3-5-flash",
    descriptionIncludes: ["gemini 3.5 flash", "input"],
    pick: "first",
  },
  {
    modelKey: "gemini-3-pro",
    descriptionIncludes: ["gemini 3 pro", "input"],
    pick: "first",
  },
  {
    modelKey: "google/gemini-3-flash-preview",
    descriptionIncludes: ["gemini 3 flash", "input"],
    pick: "first",
  },
  {
    modelKey: "gemini-3-flash",
    descriptionIncludes: ["gemini 3 flash", "input"],
    pick: "first",
  },
  {
    modelKey: "gemini-2.5-flash",
    descriptionIncludes: ["gemini 2.5 flash", "input"],
    pick: "first",
  },
  // —— Image ——
  {
    canonicalModelKey: "lib-nano-pro",
    modelKey: "nano-banana-pro",
    descriptionIncludes: ["nano banana pro", "1/2k"],
    pick: "first",
  },
  {
    modelKey: "flux-2-pro",
    descriptionIncludes: ["flux-2 pro", "text-to-image", "1.0s-1k"],
    pick: "first",
  },
  {
    modelKey: "seedream-4.5",
    descriptionIncludes: ["seedream 4.5", "text-to-image"],
    pick: "first",
  },
  {
    modelKey: "seedream-5-lite",
    descriptionIncludes: ["seedream 5 pro", "text-to-image", "1k"],
    pick: "first",
  },
  {
    modelKey: "google/nano-banana",
    descriptionIncludes: ["google nano banana,", "text-to-image"],
    descriptionExcludes: ["edit", "pro", "2"],
    pick: "first",
  },
  {
    modelKey: "google/nano-banana-edit",
    descriptionIncludes: ["google nano banana edit"],
    pick: "first",
  },
  {
    modelKey: "nano-banana-2",
    descriptionIncludes: ["nano-banana-2-lite", "1k"],
    pick: "first",
  },
  {
    modelKey: "4o-image",
    descriptionIncludes: ["4o image", "text-to-image"],
    pick: "first",
  },
  {
    modelKey: "gpt-image-1",
    descriptionIncludes: ["gpt image 1.5", "text-to-image", "medium"],
    pick: "first",
  },
  {
    modelKey: "gpt-image-2",
    descriptionIncludes: ["gpt image 2", "text-to-image", "2k"],
    pick: "first",
  },
  {
    modelKey: "gpt-image-2-text-to-image",
    descriptionIncludes: ["gpt image 2", "text-to-image", "2k"],
    pick: "first",
  },
  {
    modelKey: "gpt-image-2-image-to-image",
    descriptionIncludes: ["gpt image 2", "image-to-image", "2k"],
    pick: "first",
  },
  {
    modelKey: "grok-imagine/text-to-image",
    descriptionIncludes: ["grok-imagine", "text-to-image"],
    pick: "first",
  },
  {
    modelKey: "qwen-text-to-image",
    descriptionIncludes: ["qwen image 3.0 pro", "text to image", "1k"],
    pick: "first",
  },
  // —— Video · Seedance ——
  {
    modelKey: "bytedance/seedance-2",
    descriptionIncludes: ["bytedance/seedance-2,", "720p no video input"],
    pick: "first",
  },
  {
    modelKey: "bytedance/seedance-2-mini",
    descriptionIncludes: ["seedance-2-mini", "720p no video"],
    pick: "first",
  },
  // —— Video · Kling ——
  {
    modelKey: "kling-3.0/video",
    descriptionIncludes: ["kling 3.0, video", "without audio-720p"],
    pick: "first",
  },
  {
    modelKey: "kling/v3-turbo-image-to-video",
    descriptionIncludes: ["kling 3.0 turbo", "image-to-video", "720p"],
    pick: "first",
  },
  {
    modelKey: "kling/v3-turbo-text-to-video",
    descriptionIncludes: ["kling 3.0 turbo", "text-to-video", "720p"],
    pick: "first",
  },
  {
    modelKey: "kling-3.0/motion-control",
    descriptionIncludes: ["kling 3.0 motion control", "720p"],
    pick: "first",
  },
  {
    modelKey: "kling-2.6/motion-control",
    descriptionIncludes: ["kling 2.6 motion control", "720p"],
    pick: "first",
  },
  {
    modelKey: "kling/ai-avatar-standard",
    descriptionIncludes: ["kling ai avtar", "standard", "720p"],
    pick: "first",
  },
  {
    modelKey: "kling/ai-avatar-pro",
    descriptionIncludes: ["kling ai avtar", "pro", "1080p"],
    pick: "first",
  },
  {
    modelKey: "kling/v2-5-turbo-image-to-video-pro",
    descriptionIncludes: ["kling 2.5 turbo", "image-to-video", "5.0s"],
    pick: "maxCredits",
  },
  {
    modelKey: "kling/v2-5-turbo-text-to-video-pro",
    descriptionIncludes: ["kling 2.5 turbo", "text-to-video", "5.0s"],
    pick: "maxCredits",
  },
  // —— Video · 其它 ——
  {
    modelKey: "veo3",
    descriptionIncludes: ["veo 3.1", "image-to-video", "fast-720p"],
    pick: "first",
  },
  {
    modelKey: "veo3.1",
    descriptionIncludes: ["veo 3.1", "image-to-video", "fast-720p"],
    pick: "first",
  },
  {
    modelKey: "veo-2",
    descriptionIncludes: ["veo 3.1", "lite-720p"],
    pick: "first",
  },
  {
    modelKey: "hailuo/2-3-image-to-video-standard",
    descriptionIncludes: ["hailuo 2.3", "standard", "6.0s-768p"],
    pick: "first",
  },
  {
    modelKey: "hailuo/2-3-image-to-video-pro",
    descriptionIncludes: ["hailuo 2.3", "pro", "6.0s-768p"],
    pick: "first",
  },
  {
    modelKey: "grok-imagine/image-to-video",
    descriptionIncludes: ["grok-imagine-video-1-5-preview", "720p"],
    pick: "first",
  },
  {
    modelKey: "grok-imagine-video-1-5-preview",
    descriptionIncludes: ["grok-imagine-video-1-5-preview", "720p"],
    pick: "first",
  },
  {
    modelKey: "wan/2-6-video-to-video",
    descriptionIncludes: ["wan 2.6", "video-to-video", "5.0s-720p"],
    pick: "first",
  },
  {
    modelKey: "topaz/video-upscale",
    descriptionIncludes: ["topaz video upscaler", "1x/2x"],
    pick: "first",
  },
  // —— Audio ——
  {
    modelKey: "suno/generate",
    descriptionIncludes: ["suno, generate music"],
    pick: "first",
  },
  {
    modelKey: "elevenlabs/text-to-speech-multilingual-v2",
    descriptionIncludes: ["elevenlabs text to speech, multilingual v2"],
    pick: "first",
  },
  {
    modelKey: "elevenlabs/text-to-dialogue-v3",
    descriptionIncludes: ["elevenlabs v3", "text to dialogue"],
    pick: "first",
  },
];

/** lib-nano-pro 分档（canonical 级，非 route） */
export const LIB_NANO_PRO_KIE_TIER_RULES = [
  { tierRaw: "1K", canonicalModelKey: "lib-nano-pro-1k", descriptionIncludes: ["google nano banana 2, 1k"] },
  { tierRaw: "2K", canonicalModelKey: "lib-nano-pro-2k", descriptionIncludes: ["nano banana pro, 1/2k"] },
  { tierRaw: "4K", canonicalModelKey: "lib-nano-pro-4k", descriptionIncludes: ["nano banana pro, 4k"] },
] as const;

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function creditNum(row: KiePricingApiRow): number {
  const n = Number.parseFloat(String(row.creditPrice).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parseDurationSec(desc: string): number | null {
  const m = desc.match(/(\d+(?:\.\d+)?)\s*s(?:ec)?/i);
  if (m) return Number.parseFloat(m[1]!);
  return null;
}

function rowMatches(row: KiePricingApiRow, rule: RouteRule): boolean {
  const desc = norm(row.modelDescription);
  for (const inc of rule.descriptionIncludes) {
    if (!desc.includes(norm(inc))) return false;
  }
  for (const exc of rule.descriptionExcludes ?? []) {
    if (desc.includes(norm(exc))) return false;
  }
  return true;
}

function findRule(route: GatewayKieRoute): RouteRule | null {
  return (
    KIE_ROUTE_PRICE_RULES.find(
      (r) =>
        (r.modelKey == null || r.modelKey === route.modelKey) &&
        (r.canonicalModelKey == null || r.canonicalModelKey === route.canonicalModelKey),
    ) ?? null
  );
}

function genericMatches(route: GatewayKieRoute, row: KiePricingApiRow): boolean {
  const desc = norm(row.modelDescription);
  const mk = norm(route.modelKey);
  const slug = mk.split("/").pop() ?? mk;
  if (desc.includes(mk)) return true;
  if (desc.includes(slug) && row.interfaceType.toLowerCase() === route.requestKind.toLowerCase()) {
    return true;
  }
  const anchor = norm(row.anchor ?? "");
  if (anchor.includes(mk.replace(/\//g, "-"))) return true;
  return false;
}

export function matchKiePriceRowsForRoute(
  route: GatewayKieRoute,
  rows: KiePricingApiRow[],
): KiePricingApiRow[] {
  const rule = findRule(route);
  if (rule) {
    const hits = rows.filter((r) => rowMatches(r, rule));
    if (hits.length === 0) return [];
    if (rule.pick === "maxCredits") {
      return [hits.sort((a, b) => creditNum(b) - creditNum(a))[0]!];
    }
    if (rule.pick === "minCredits") {
      return [hits.sort((a, b) => creditNum(a) - creditNum(b))[0]!];
    }
    return [hits[0]!];
  }
  const generic = rows.filter((r) => genericMatches(route, r));
  return generic.length ? [generic[0]!] : [];
}

function chatOutputRow(rows: KiePricingApiRow[], inputRow: KiePricingApiRow): KiePricingApiRow | null {
  const base = norm(inputRow.modelDescription).replace("input", "output");
  return (
    rows.find(
      (r) =>
        norm(r.modelDescription) === base ||
        (norm(r.modelDescription).includes("output") &&
          norm(r.modelDescription).split(",")[0] === norm(inputRow.modelDescription).split(",")[0]),
    ) ?? null
  );
}

export function kieRowToPriceSpec(
  route: GatewayKieRoute,
  row: KiePricingApiRow,
  allRows: KiePricingApiRow[],
): ResolvedKieRoutePrice | null {
  const credits = creditNum(row);
  if (credits <= 0 && !row.creditUnit.toLowerCase().includes("token")) return null;
  const unit = row.creditUnit.toLowerCase();
  const desc = row.modelDescription;
  const section = desc;

  if (unit.includes("million") || unit.includes("milion") || unit.includes("token")) {
    const outRow =
      chatOutputRow(allRows, row) ??
      allRows.find(
        (r) =>
          norm(r.modelDescription).includes(norm(desc.split(",")[0] ?? "")) &&
          norm(r.modelDescription).includes("output"),
      );
    const inC = credits;
    const outC = outRow ? creditNum(outRow) : inC * 6;
    return {
      kind: "token",
      inputCreditsPerMillion: inC,
      outputCreditsPerMillion: outC,
      section,
      modelDescription: desc,
      creditUnit: row.creditUnit,
      usdCheck: row.usdPrice,
    };
  }

  if (unit.includes("second")) {
    return {
      kind: "video",
      kieCreditsPerSecond: credits,
      tierRaw: "720p",
      section,
      modelDescription: desc,
      creditUnit: row.creditUnit,
      usdCheck: row.usdPrice,
    };
  }

  if (unit.includes("image")) {
    return {
      kind: "image",
      kieCreditsPerImage: credits,
      section,
      modelDescription: desc,
      creditUnit: row.creditUnit,
      usdCheck: row.usdPrice,
    };
  }

  if (unit.includes("video") || unit.includes("vedio")) {
    const dur = parseDurationSec(desc) ?? 8;
    const perSec = credits / dur;
    return {
      kind: "video",
      kieCreditsPerSecond: perSec,
      tierRaw: "720p",
      section,
      modelDescription: `${desc} (→ ${perSec.toFixed(2)} credits/s @ ${dur}s)`,
      creditUnit: "per second (converted from per video)",
      usdCheck: row.usdPrice,
    };
  }

  if (unit.includes("1000 characters")) {
    // 按次：约 500 字符一次
    const perCall = credits / 2;
    return {
      kind: "call",
      kieCreditsPerCall: perCall,
      section,
      modelDescription: desc,
      creditUnit: row.creditUnit,
      usdCheck: row.usdPrice,
    };
  }

  return {
    kind: "call",
    kieCreditsPerCall: credits,
    section,
    modelDescription: desc,
    creditUnit: row.creditUnit,
    usdCheck: row.usdPrice,
  };
}

export function resolveKieRoutePrice(
  route: GatewayKieRoute,
  rows: KiePricingApiRow[],
): ResolvedKieRoutePrice | null {
  const matched = matchKiePriceRowsForRoute(route, rows);
  if (!matched.length) return null;
  return kieRowToPriceSpec(route, matched[0]!, rows);
}

export function resolveLibNanoProTierPrice(
  tierRule: (typeof LIB_NANO_PRO_KIE_TIER_RULES)[number],
  rows: KiePricingApiRow[],
): ResolvedKieRoutePrice | null {
  const hit = rows.find((r) => {
    const desc = norm(r.modelDescription);
    return tierRule.descriptionIncludes.every((inc) => desc.includes(norm(inc)));
  });
  if (!hit) return null;
  return kieRowToPriceSpec(
    {
      canonicalModelKey: tierRule.canonicalModelKey,
      displayName: tierRule.canonicalModelKey,
      modelKey: "nano-banana-pro",
      providerKind: "KIE",
      vendor: "kie",
      requestKind: "IMAGE",
    },
    hit,
    rows,
  );
}

export function specToListCostYuan(spec: GatewayKiePriceSpec): {
  unit: CreditCostUnit;
  listCostYuan: number;
  inputListCostYuan?: number;
  outputListCostYuan?: number;
  tierRaw?: string;
} {
  switch (spec.kind) {
    case "token": {
      const inK = ktokenFromKieMillionCredits(spec.inputCreditsPerMillion);
      const outK = ktokenFromKieMillionCredits(spec.outputCreditsPerMillion);
      return {
        unit: "PER_KTOKEN",
        listCostYuan: inK,
        inputListCostYuan: inK,
        outputListCostYuan: outK,
      };
    }
    case "image":
      return {
        unit: "PER_IMAGE",
        listCostYuan: kieCreditsToYuan(spec.kieCreditsPerImage),
        tierRaw: spec.tierRaw,
      };
    case "video":
      return {
        unit: "PER_SEC",
        listCostYuan: kieCreditsToYuan(spec.kieCreditsPerSecond),
        tierRaw: spec.tierRaw,
      };
    case "call":
      return {
        unit: "PER_IMAGE",
        listCostYuan: kieCreditsToYuan(spec.kieCreditsPerCall),
      };
  }
}
