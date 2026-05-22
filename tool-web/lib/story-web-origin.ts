/** story-web 公网 Origin（工具站外链） */

export function getStoryWebOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_STORY_WEB_ORIGIN?.trim();
  if (raw) return raw.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") return "https://story.ai-code8.com";
  return "http://localhost:3003";
}
