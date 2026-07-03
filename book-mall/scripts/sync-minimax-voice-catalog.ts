/* eslint-disable no-console */
/**
 * 同步 MiniMax 系统音色 + 试听 MP3 到 OSS，生成分页 manifest。
 *
 * 环境：book-mall/.env.local → MINIMAX_API_KEY、OSS_*
 *
 * 使用：
 *   cd book-mall && pnpm qr:sync-minimax-voices
 *   pnpm qr:sync-minimax-voices --dry-run --limit 5
 *   pnpm qr:sync-minimax-voices --resume
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { uploadMinimaxVoicePreview } from "../lib/canvas/canvas-oss";
import { MINIMAX_DEFAULT_SPEECH_MODEL_KEY, resolveMinimaxUpstreamSpeechModel } from "../lib/gateway/minimax-speech-models";
import { resolveMinimaxApiRoot } from "../lib/gateway/minimax-speech-proxy";
import {
  parseMinimaxMdVoiceTable,
  type MinimaxVoiceCatalogEntry,
} from "../lib/quick-replica/minimax-voice-catalog";

const ROOT = resolve(__dirname, "..");
const MANIFEST_PATH = resolve(ROOT, "content/quick-replica/minimax-voice-catalog.json");
const DOCS_MINIMAX = resolve(ROOT, "../docs/minimax.md");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const resume = args.includes("--resume");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number.parseInt(limitArg.split("=")[1] ?? "0", 10) : 0;

const PREVIEW_TEXT: Record<string, string> = {
  zh: "你好，这是 MiniMax 语音试听。",
  en: "Hello, this is a MiniMax voice preview.",
  default: "Hello",
};

function previewTextForLanguage(language: string): string {
  const lang = language.toLowerCase();
  if (lang.includes("中文") || lang.includes("mandarin") || lang.includes("cantonese")) {
    return PREVIEW_TEXT.zh;
  }
  if (lang.includes("english") || lang.includes("英语")) return PREVIEW_TEXT.en;
  return PREVIEW_TEXT.default;
}

function loadExistingManifest(): MinimaxVoiceCatalogEntry[] {
  if (!existsSync(MANIFEST_PATH)) return [];
  try {
    const json = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as {
      voices?: MinimaxVoiceCatalogEntry[];
    };
    return json.voices ?? [];
  } catch {
    return [];
  }
}

async function resolveVoiceList(apiKey: string): Promise<MinimaxVoiceCatalogEntry[]> {
  if (existsSync(DOCS_MINIMAX)) {
    const fromMd = parseMinimaxMdVoiceTable(readFileSync(DOCS_MINIMAX, "utf8"));
    if (fromMd.length > 0) return fromMd;
  }

  const root = resolveMinimaxApiRoot(null);
  const r = await fetch(`${root}/v1/get_voice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ voice_type: "system" }),
  });
  if (r.ok) {
    const json = (await r.json()) as { system_voice?: Array<Record<string, unknown>> };
    const apiVoices = (json.system_voice ?? [])
      .map((v) => ({
        voiceId: String(v.voice_id ?? ""),
        label: typeof v.voice_name === "string" ? v.voice_name : String(v.voice_id ?? ""),
        language: Array.isArray(v.description) ? v.description.join(" · ") : "",
        avatarLetter: String(v.voice_name ?? v.voice_id ?? "?").charAt(0).toUpperCase(),
      }))
      .filter((v) => v.voiceId);
    if (apiVoices.length > 0) return apiVoices;
  }

  return [];
}

async function generatePreviewMp3(args: {
  apiKey: string;
  voiceId: string;
  text: string;
}): Promise<Buffer> {
  const root = resolveMinimaxApiRoot(null);
  const model = resolveMinimaxUpstreamSpeechModel(MINIMAX_DEFAULT_SPEECH_MODEL_KEY);
  const started = Date.now();

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const r = await fetch(`${root}/v1/t2a_v2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.apiKey}`,
      },
      body: JSON.stringify({
        model,
        text: args.text,
        voice_setting: { voice_id: args.voiceId, speed: 1, vol: 1, pitch: 0 },
        audio_setting: { format: "mp3", sample_rate: 32000 },
      }),
    });
    const json = (await r.json()) as Record<string, unknown>;
    const base = json.base_resp as { status_code?: number; status_msg?: string } | undefined;
    if (base && base.status_code !== 0 && base.status_code !== undefined) {
      if (attempt < 4 && (base.status_code === 1002 || base.status_code === 429)) {
        await new Promise((res) => setTimeout(res, attempt * 1500));
        continue;
      }
      throw new Error(`${args.voiceId}: ${base.status_msg ?? base.status_code}`);
    }
    const data = json.data as Record<string, unknown> | undefined;
    const audio = data?.audio;
    if (typeof audio === "string" && audio.length > 0) {
      if (audio.startsWith("http")) {
        const dl = await fetch(audio);
        if (dl.ok) return Buffer.from(await dl.arrayBuffer());
      }
      try {
        const buf = Buffer.from(audio, "hex");
        if (buf.length > 0) return buf;
      } catch {
        /* fall through */
      }
      try {
        const buf = Buffer.from(audio, "base64");
        if (buf.length > 0) return buf;
      } catch {
        /* fall through */
      }
    }
    if (attempt < 4) {
      await new Promise((res) => setTimeout(res, attempt * 800));
      continue;
    }
    throw new Error(`TTS preview failed for ${args.voiceId} (${Date.now() - started}ms)`);
  }
  throw new Error(`TTS preview failed for ${args.voiceId}`);
}

async function main(): Promise<void> {
  const apiKey = process.env.MINIMAX_API_KEY?.trim();
  if (!apiKey) {
    console.error("MINIMAX_API_KEY required in .env.local");
    process.exit(1);
  }

  const existing = resume ? loadExistingManifest() : [];
  const existingIds = new Set(existing.filter((v) => v.previewUrl).map((v) => v.voiceId));

  let voices = await resolveVoiceList(apiKey);
  if (limit > 0) voices = voices.slice(0, limit);

  console.log(`Voices to process: ${voices.length} (dryRun=${dryRun}, resume=${resume})`);

  const merged: MinimaxVoiceCatalogEntry[] = resume ? [...existing] : [];
  const mergedIds = new Set(merged.map((v) => v.voiceId));

  for (const voice of voices) {
    if (mergedIds.has(voice.voiceId) && existingIds.has(voice.voiceId)) {
      console.log(`skip ${voice.voiceId} (has preview)`);
      continue;
    }

    let previewUrl = voice.previewUrl;
    if (!previewUrl && !dryRun) {
      try {
        const buf = await generatePreviewMp3({
          apiKey,
          voiceId: voice.voiceId,
          text: previewTextForLanguage(voice.language),
        });
        previewUrl = await uploadMinimaxVoicePreview({ voiceId: voice.voiceId, buf });
        console.log(`uploaded preview ${voice.voiceId}`);
        await new Promise((r) => setTimeout(r, 600));
      } catch (e) {
        console.warn(`preview failed ${voice.voiceId}:`, (e as Error).message);
      }
    }

    const entry: MinimaxVoiceCatalogEntry = { ...voice, previewUrl };
    if (mergedIds.has(voice.voiceId)) {
      const idx = merged.findIndex((v) => v.voiceId === voice.voiceId);
      if (idx >= 0) merged[idx] = entry;
    } else {
      merged.push(entry);
      mergedIds.add(voice.voiceId);
    }

    // 每 10 条落盘，便于断点续跑
    if (!dryRun && merged.length % 10 === 0) {
      writeFileSync(
        MANIFEST_PATH,
        JSON.stringify(
          {
            schemaVersion: 1 as const,
            total: merged.length,
            pageSize: 40,
            updatedAt: new Date().toISOString(),
            voices: merged,
          },
          null,
          2,
        ),
      );
    }
  }

  const manifest = {
    schemaVersion: 1 as const,
    total: merged.length,
    pageSize: 40,
    updatedAt: new Date().toISOString(),
    voices: merged,
  };

  if (!dryRun) {
    writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    console.log(`Wrote ${MANIFEST_PATH} (${merged.length} voices)`);
  } else {
    console.log(`[dry-run] would write ${merged.length} voices`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
