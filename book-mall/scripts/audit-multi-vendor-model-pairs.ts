/**
 * 列出「逻辑上同一模型、不同厂商 canonical」的成对关系（供运维/定价参考）。
 *
 *   pnpm exec tsx scripts/audit-multi-vendor-model-pairs.ts
 */
import { GATEWAY_CANONICAL_REGISTRY } from "../lib/platform-model/canonical-registry";

/** 归一化产品族 slug（非严格，仅用于成对提示） */
const FAMILY_PATTERNS: Array<{ family: string; test: (canonical: string, displayName: string) => boolean }> = [
  { family: "seedance-2", test: (c, d) => /seedance-2/i.test(c) || /seedance 2/i.test(d) },
  { family: "seedance-mini", test: (c) => /seedance.*mini/i.test(c) },
  { family: "kling-3.0-video", test: (c) => /kling-3\.0/i.test(c) && !/turbo|motion|avatar/i.test(c) },
  { family: "kling-3.0-turbo", test: (c) => /kling-3\.0-turbo/i.test(c) },
  { family: "kling-motion", test: (c) => /kling.*motion/i.test(c) },
  { family: "kling-avatar", test: (c) => /kling.*avatar/i.test(c) },
  { family: "kling-2.5-turbo", test: (c) => /kling-2\.5/i.test(c) },
  { family: "veo-3", test: (c) => /^veo-3/i.test(c) },
  { family: "wan-video", test: (c, d) => /^wan/i.test(c) || /万相|wan/i.test(d) },
  { family: "nano-banana", test: (c) => /nano-banana|lib-nano-pro|google-nano-banana/i.test(c) },
  { family: "gemini-flash", test: (c) => /gemini.*flash/i.test(c) },
  { family: "qwen-vl", test: (c) => /qwen-vl|qwen3-vl/i.test(c) },
  { family: "happyhorse", test: (c) => /happyhorse/i.test(c) },
];

function primaryVendor(def: (typeof GATEWAY_CANONICAL_REGISTRY)[number]): string {
  const vendors = [...new Set(def.routes.map((r) => r.vendor))];
  return vendors.join("+");
}

async function main() {
  const byFamily = new Map<string, Array<{ canonical: string; displayName: string; vendors: string; modelKeys: string[] }>>();

  for (const def of GATEWAY_CANONICAL_REGISTRY) {
    for (const { family, test } of FAMILY_PATTERNS) {
      if (!test(def.canonicalModelKey, def.displayName)) continue;
      const list = byFamily.get(family) ?? [];
      list.push({
        canonical: def.canonicalModelKey,
        displayName: def.displayName,
        vendors: primaryVendor(def),
        modelKeys: def.routes.map((r) => `${r.vendor}:${r.modelKey}`),
      });
      byFamily.set(family, list);
    }
  }

  console.log("# 同族多厂商模型（不同 canonical，需在 Gateway 模型上架分别选路由）\n");
  let pairCount = 0;
  for (const [family, items] of [...byFamily.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const vendorSet = new Set(items.flatMap((i) => i.vendors.split("+")));
    if (vendorSet.size < 2) continue;
    pairCount += 1;
    console.log(`## ${family} (${vendorSet.size} 厂商)`);
    for (const item of items) {
      console.log(`- **${item.canonical}** · ${item.displayName} · vendors=${item.vendors}`);
      for (const mk of item.modelKeys) console.log(`  - ${mk}`);
    }
    console.log("");
  }

  const multiRouteSameCanonical = GATEWAY_CANONICAL_REGISTRY.filter((def) => {
    const vendors = new Set(def.routes.map((r) => r.vendor));
    return vendors.size > 1;
  });
  console.log(`# 同一 canonical 下多厂商路由: ${multiRouteSameCanonical.length} 个`);
  for (const def of multiRouteSameCanonical) {
    console.log(`- ${def.canonicalModelKey}: ${def.routes.map((r) => r.vendor).join(", ")}`);
  }
  if (multiRouteSameCanonical.length === 0) {
    console.log("（当前注册表无「单 canonical 多 vendor」条目；多厂商以不同 canonical 登记）");
  }
  console.log(`\n多厂商产品族: ${pairCount} 组`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
