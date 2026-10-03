import type { PosterPlan, PosterReference } from "@/lib/ecom/ecom-poster-types";

function refUrls(refs: PosterReference[], roles: PosterReference["role"][]): string[] {
  return refs
    .filter((r) => roles.includes(r.role))
    .map((r) => r.ossUrl.trim())
    .filter((u) => /^https?:\/\//i.test(u));
}

/** 按傻瓜路径 / 专业模式决定下发给厂商的参考图，避免无关或不可达 URL 触发百炼 url error */
export function resolvePosterGenerationRefUrls(opts: {
  plan: PosterPlan;
  references: PosterReference[];
}): string[] {
  const tier = opts.plan.tier ?? "easy";
  const easyPath = opts.plan.easyPath ?? "C";
  const proMode = opts.plan.proMode ?? "text";
  const useBrand = opts.plan.useBrandRefs === true;

  let roles: PosterReference["role"][] = [];

  if (tier === "pro") {
    if (proMode === "image-ref") {
      roles = ["style", "scene", "brand", "product"];
    } else if (proMode === "template") {
      roles = useBrand ? ["brand"] : [];
    } else {
      roles = useBrand ? ["brand"] : [];
    }
  } else {
    switch (easyPath) {
      case "A":
        roles = ["model", "garment", "scene"];
        if (useBrand) roles.push("brand");
        break;
      case "B":
        roles = ["garment"];
        if (useBrand) roles.push("brand");
        break;
      case "C":
        roles = [];
        break;
      case "D":
        roles = useBrand ? ["brand", "style"] : [];
        break;
      default:
        roles = [];
    }
  }

  return refUrls(opts.references, roles);
}
