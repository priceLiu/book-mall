/**
 * 由 modelKey 推断云厂商；未知归到「其他/未知」。
 *
 * 纯 utility（无 React / 无 "use client"），Server Component 与 Client Component 均可 import。
 * 历史背景：曾位于 `"use client"` 文件，跨 RSC 边界 import 会被 webpack 替换为 client-reference
 * proxy，运行时报 `TypeError`，因此后续抽出到本模块。该 client 文件已于 2026-05-18
 * 整合时删除（`/admin/finance/cloud-pricing` 不再有 master view）。
 *
 * 规则是 best-effort——未来若 ToolBillablePrice / ModelCatalog 加 vendor 列即可替换。
 */
export function vendorOfModelKey(modelKey: string | null | undefined): string {
  if (!modelKey) return "未知";
  const k = modelKey.toLowerCase();
  if (
    k.startsWith("qwen") ||
    k.startsWith("wan") ||
    k.startsWith("dashscope") ||
    k.startsWith("wanx") ||
    k.startsWith("aitryon")
  )
    return "阿里云";
  if (k.startsWith("hunyuan") || k.startsWith("tencent")) return "腾讯云";
  if (k.startsWith("doubao") || k.startsWith("volc") || k.startsWith("ark")) return "火山引擎";
  if (k.startsWith("baichuan")) return "百川";
  if (k.startsWith("moonshot") || k.startsWith("kimi")) return "Moonshot";
  if (k.startsWith("deepseek")) return "DeepSeek";
  if (k.startsWith("glm") || k.startsWith("chatglm") || k.startsWith("zhipu")) return "智谱 AI";
  if (k.startsWith("ernie") || k.startsWith("wenxin")) return "百度文心";
  if (k.startsWith("step") || k.startsWith("yi-")) return "其他";
  if (k.startsWith("pixverse") || k.startsWith("happyhorse")) return "其他";
  return "其他";
}
