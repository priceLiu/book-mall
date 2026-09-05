import { clientPageToServiceNavKey } from "@/lib/tool-service-fee/tool-key-nav";
import { toolKeyToLabel } from "@/lib/tool-key-label";

/** clientPage 路径 → 工具 navKey（如 fitting-room/ai-fit → fitting-room）。 */
export function clientPageToToolKey(clientPage: string | null | undefined): string {
  if (!clientPage?.trim()) return "(unknown)";
  const p = clientPage.trim();
  const slashAsUnderscore = p.replace(/\//g, "__");
  return (
    clientPageToServiceNavKey(p) ??
    clientPageToServiceNavKey(slashAsUnderscore) ??
    slashAsUnderscore.split("__")[0] ??
    p
  );
}

/** clientPage → 人类可读工具名（如 fitting-room/ai-fit → AI智能试衣）。 */
export function clientPageToToolLabel(clientPage: string | null | undefined): string {
  const p = clientPage?.trim();
  if (!p) return "—";
  if (p.startsWith("platform-assistant/")) {
    const tail = p.slice("platform-assistant/".length);
    const tailLabels: Record<string, string> = {
      chat: "对话",
      "ai-news-generate": "每日资讯生成",
      embed: "向量入库",
      retrieve: "检索向量",
      completion: "非流式对话",
    };
    return `AI 小智 · ${tailLabels[tail] ?? tail}`;
  }
  return toolKeyToLabel(p.replace(/\//g, "__"));
}
