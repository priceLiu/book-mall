/** prompt-optimizer-platform 公网 Origin（工具站外链） */
export function getPromptOptimizerOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_PROMPT_OPTIMIZER_ORIGIN?.trim();
  if (raw) return raw.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") return "https://prompt.ai-code8.com";
  return "http://localhost:3006";
}
