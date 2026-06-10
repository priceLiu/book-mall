/**
 * 剪映导出：分镜包 ZIP（A）与剪映草稿 ZIP（B · Mac）。
 */
import { ZipArchive } from "archiver";
import { Readable } from "node:stream";

export type JianyingFrameInput = {
  frameIndex: number;
  dialogue: string;
  videoUrl?: string | null;
  audioUrl?: string | null;
  /** 秒；缺省 3 */
  durationSec?: number;
};

function padFrame(n: number): string {
  return String(n).padStart(2, "0");
}

function formatSrtTime(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const ms = Math.round((totalSec % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

export function buildMergedSrt(frames: JianyingFrameInput[]): string {
  const sorted = [...frames].sort((a, b) => a.frameIndex - b.frameIndex);
  let cursor = 0;
  const blocks: string[] = [];
  sorted.forEach((f, i) => {
    const dur = f.durationSec && f.durationSec > 0 ? f.durationSec : 3;
    const start = cursor;
    const end = cursor + dur;
    cursor = end;
    const text = (f.dialogue ?? "").trim();
    if (!text || text === "—" || text === "-") return;
    blocks.push(
      String(i + 1),
      `${formatSrtTime(start)} --> ${formatSrtTime(end)}`,
      text,
      "",
    );
  });
  return blocks.join("\n");
}

const MAC_README = `# 漫剧分镜包 · 导入剪映（Mac）

## 方式 A · 分镜包（推荐）
1. 打开 **剪映专业版**（Mac），新建项目
2. 将 \`videos/\` 下各镜 mp4 按顺序拖入时间线
3. 将 \`audio/\` 下对应配音拖入音频轨（可选）
4. 菜单 **文本 → 导入字幕** → 选择 \`全集.srt\`

## 方式 B · 剪映草稿包
1. 解压 \`jianying-draft.zip\` 到剪映草稿目录，例如：
   \`~/Movies/JianyingPro/User Data/Projects/com.lveditor.draft/\`
   （路径因版本而异，可在剪映 **偏好设置 → 草稿位置** 查看）
2. 重启剪映，在草稿列表打开对应项目

## 注意
- 剪映 6+ 可能对 draft JSON 加密；若 B 无法打开，请用方式 A
- 本包由 canvas-web 漫剧工作流生成
`;

async function fetchBuffer(url: string, maxBytes: number): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url}: HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.byteLength > maxBytes) {
    throw new Error(`asset too large: ${buf.byteLength}`);
  }
  return buf;
}

/** 分镜包 ZIP：videos/ + audio/ + 全集.srt + README */
export async function buildStoryBundleZip(
  frames: JianyingFrameInput[],
): Promise<Buffer> {
  const sorted = [...frames].sort((a, b) => a.frameIndex - b.frameIndex);
  const srt = buildMergedSrt(sorted);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on("data", (c: Buffer) => chunks.push(c));
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));

    void (async () => {
      archive.append(srt, { name: "全集.srt" });
      archive.append(MAC_README, { name: "README.txt" });

      for (const f of sorted) {
        const label = padFrame(f.frameIndex);
        if (f.videoUrl) {
          try {
            const buf = await fetchBuffer(f.videoUrl, 200 * 1024 * 1024);
            archive.append(buf, { name: `videos/镜${label}.mp4` });
          } catch (e) {
            archive.append(
              `# 镜${label} 视频下载失败: ${e instanceof Error ? e.message : String(e)}`,
              { name: `videos/镜${label}.error.txt` },
            );
          }
        }
        if (f.audioUrl) {
          try {
            const buf = await fetchBuffer(f.audioUrl, 20 * 1024 * 1024);
            archive.append(buf, { name: `audio/镜${label}.mp3` });
          } catch (e) {
            archive.append(
              `# 镜${label} 音频下载失败`,
              { name: `audio/镜${label}.error.txt` },
            );
          }
        }
      }
      await archive.finalize();
    })().catch(reject);
  });
}

/** 剪映草稿 ZIP（简化 JSON · 兼容未加密版本 / Mac） */
export async function buildJianyingDraftZip(
  frames: JianyingFrameInput[],
  projectName: string,
): Promise<Buffer> {
  const sorted = [...frames].sort((a, b) => a.frameIndex - b.frameIndex);
  const draftId = `canvas_${Date.now()}`;
  const draftFolder = `${draftId}`;

  const materials: Array<Record<string, unknown>> = [];
  const videoSegments: Array<Record<string, unknown>> = [];
  const audioSegments: Array<Record<string, unknown>> = [];
  let timelineUs = 0;

  const bundleBuf = await buildStoryBundleZip(sorted);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on("data", (c: Buffer) => chunks.push(c));
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));

    void (async () => {
      for (const f of sorted) {
        const label = padFrame(f.frameIndex);
        const durUs =
          ((f.durationSec && f.durationSec > 0 ? f.durationSec : 3) as number) *
          1_000_000;
        if (f.videoUrl) {
          const matId = `v_${f.frameIndex}`;
          const rel = `materials/镜${label}.mp4`;
          try {
            const buf = await fetchBuffer(f.videoUrl, 200 * 1024 * 1024);
            archive.append(buf, { name: `${draftFolder}/${rel}` });
            materials.push({
              id: matId,
              type: "video",
              path: rel,
              duration: durUs,
            });
            videoSegments.push({
              material_id: matId,
              target_timerange: { start: timelineUs, duration: durUs },
              source_timerange: { start: 0, duration: durUs },
            });
          } catch {
            /* skip */
          }
        }
        if (f.audioUrl) {
          const matId = `a_${f.frameIndex}`;
          const rel = `materials/镜${label}.mp3`;
          try {
            const buf = await fetchBuffer(f.audioUrl, 20 * 1024 * 1024);
            archive.append(buf, { name: `${draftFolder}/${rel}` });
            materials.push({
              id: matId,
              type: "audio",
              path: rel,
              duration: durUs,
            });
            audioSegments.push({
              material_id: matId,
              target_timerange: { start: timelineUs, duration: durUs },
              source_timerange: { start: 0, duration: durUs },
            });
          } catch {
            /* skip */
          }
        }
        timelineUs += durUs;
      }

      const draftContent = {
        id: draftId,
        name: projectName.slice(0, 40) || "漫剧草稿",
        canvas_config: { width: 1920, height: 1080, ratio: "16:9" },
        materials: { videos: materials.filter((m) => m.type === "video"), audios: materials.filter((m) => m.type === "audio") },
        tracks: [
          { type: "video", segments: videoSegments },
          { type: "audio", segments: audioSegments },
        ],
        version: 360000,
        platform: "mac",
        _canvas_note: "简化草稿；剪映 6+ 若无法打开请使用分镜包 ZIP",
      };

      archive.append(JSON.stringify(draftContent, null, 2), {
        name: `${draftFolder}/draft_content.json`,
      });
      archive.append(
        JSON.stringify(
          {
            draft_id: draftId,
            draft_name: projectName,
            draft_root_path: draftFolder,
            tm_draft_create: Date.now(),
            tm_draft_modified: Date.now(),
          },
          null,
          2,
        ),
        { name: `${draftFolder}/draft_meta_info.json` },
      );
      archive.append(MAC_README, { name: `${draftFolder}/README.txt` });
      // 附带分镜包备用
      archive.append(bundleBuf, { name: `${draftFolder}/../分镜包备用.zip` });

      await archive.finalize();
    })().catch(reject);
  });
}

/** 流式响应 helper */
export function bufferToWebStream(buf: Buffer): ReadableStream<Uint8Array> {
  const nodeStream = Readable.from(buf);
  return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
}
