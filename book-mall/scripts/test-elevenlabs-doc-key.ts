/**
 * 验证 docs/elevenlabs.md 或 ELEVENLABS_API_KEY 是否可拉取音色列表（不写入 DB）。
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ELEVENLABS_MD = resolve(__dirname, "../../docs/elevenlabs.md");

function resolveElevenLabsApiKey(): string | null {
  const fromEnv = process.env.ELEVENLABS_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  const text = readFileSync(ELEVENLABS_MD, "utf8");
  const line = text.match(/^API\s*:\s*(\S+)/im);
  return line?.[1]?.trim() ?? null;
}

async function main() {
  const apiKey = resolveElevenLabsApiKey();
  if (!apiKey) {
    console.log(JSON.stringify({ error: "no_key", hint: "docs/elevenlabs.md API : 或 ELEVENLABS_API_KEY" }));
    process.exit(1);
  }

  const r = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  });
  const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  const voices = Array.isArray(json.voices) ? json.voices : [];

  console.log(
    JSON.stringify(
      {
        status: r.status,
        voiceCount: voices.length,
        keyPrefix: apiKey.slice(0, 6) + "…",
        keyLooksValid: apiKey.startsWith("sk_") || apiKey.length >= 32,
        detail:
          r.status >= 300
            ? (json.detail as Record<string, unknown> | undefined)?.message ??
              JSON.stringify(json).slice(0, 200)
            : null,
        sample: voices.slice(0, 3).map((v: unknown) => {
          const o = v as Record<string, unknown>;
          return { voice_id: o.voice_id, name: o.name };
        }),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
