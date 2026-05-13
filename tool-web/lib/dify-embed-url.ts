/** Udify 发布页嵌入用的 Chatbot URL（与脚本嵌入共用同一 token）。 */

export function getUdifyChatbotEmbedUrl(embedToken: string): string {
  const t = embedToken.trim();
  const encoded = encodeURIComponent(t);
  return `https://udify.app/chatbot/${encoded}`;
}
