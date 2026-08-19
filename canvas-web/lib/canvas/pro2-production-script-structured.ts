/**
 * Pro2 制作包 · JSON 围栏提取与 Zod 校验
 * book-mall/lib/canvas/pro2-production-script-structured.ts 须保持同步（runner 校验）
 */
import {
  pro2ProductionScriptPatchSchema,
  type Pro2ProductionScriptPatch,
  type Pro2ProductionScriptStep,
} from "./data/pro2-production-script-schema";

const FENCE_TAG = "pro2-production-script";

function tryParseJson(raw: string): unknown | null {
  const t = raw.trim();
  if (!t.startsWith("{")) return null;
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return null;
  }
}

/** 去掉 machine-readable 围栏（含流式未闭合） */
export function stripPro2ProductionScriptFence(text: string): string {
  return text
    .replace(new RegExp(`\`\`\`${FENCE_TAG}[\\s\\S]*?\`\`\``, "gi"), "")
    .replace(new RegExp(`\`\`\`${FENCE_TAG}[\\s\\S]*$`, "gi"), "")
    .trim();
}

/** 围栏已闭合（流式未写完时为 false） */
export function isPro2ProductionScriptFenceComplete(text: string): boolean {
  return new RegExp(`\`\`\`${FENCE_TAG}[\\s\\S]*?\`\`\``, "i").test(text);
}

function extractFenceBody(text: string): string | null {
  const closed = text.match(
    new RegExp(`\`\`\`${FENCE_TAG}\\s*([\\s\\S]*?)\`\`\``, "i"),
  );
  if (closed?.[1]?.trim()) return closed[1].trim();
  const open = text.match(new RegExp(`\`\`\`${FENCE_TAG}\\s*([\\s\\S]*)$`, "i"));
  if (open?.[1]?.trim()) return open[1].trim();
  return null;
}

export function extractPro2ProductionScriptPatch(
  text: string,
): Pro2ProductionScriptPatch | null {
  const body = extractFenceBody(text);
  if (body) {
    const parsed = tryParseJson(body);
    if (parsed) {
      const safe = pro2ProductionScriptPatchSchema.safeParse(parsed);
      if (safe.success) return safe.data;
    }
  }

  const markers = ['{"schemaVersion"', '{"step"', '{"patch"'];
  let idx = -1;
  for (const m of markers) {
    idx = Math.max(idx, text.lastIndexOf(m));
  }
  if (idx >= 0) {
    const end = text.lastIndexOf("}");
    if (end > idx) {
      const parsed = tryParseJson(text.slice(idx, end + 1));
      if (parsed) {
        const safe = pro2ProductionScriptPatchSchema.safeParse(parsed);
        if (safe.success) return safe.data;
      }
    }
  }
  return null;
}

export function hasPro2ProductionScriptFence(text: string): boolean {
  return new RegExp(`\`\`\`${FENCE_TAG}`, "i").test(text);
}

/** step 是否匹配 hub LLM section */
export function pro2PatchStepMatchesSection(
  step: Pro2ProductionScriptStep,
  section: "outline" | "character" | "scene" | "storyboard",
): boolean {
  if (section === "outline") {
    return step === "full_pack" || step === "outline";
  }
  if (section === "character") return step === "character" || step === "full_pack";
  if (section === "scene") return step === "scene" || step === "full_pack";
  return step === "storyboard" || step === "full_pack";
}
