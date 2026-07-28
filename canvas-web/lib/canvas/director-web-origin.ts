/**
 * 3D导演台（director-web，:3009）公网 origin。
 * canvas 画布节点以 iframe 内嵌导演台并经 postMessage 桥接截图。
 */
export function getDirectorWebOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_DIRECTOR_WEB_ORIGIN?.trim();
  if (raw) return raw.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    return "https://director.ai-code8.com";
  }
  return "http://localhost:3009";
}
