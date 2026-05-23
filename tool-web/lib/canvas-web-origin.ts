/** canvas-web 公网 Origin（工具站外链） */

export function getCanvasWebOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_CANVAS_WEB_ORIGIN?.trim();
  if (raw) return raw.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") return "https://canvas.ai-code8.com";
  return "http://localhost:3004";
}
