import type { StoryboardScheme } from "@/lib/ecom/ecom-storyboard-deliverable";
import { storyboardPanelSchema } from "@/lib/ecom/ecom-storyboard-deliverable";

/** 支持 #### 方案一：… 等 Markdown 标题（原 #{1,3} 无法匹配四级标题导致多套方案合并） */
const SCHEME_HEADER_RE =
  /(?:^|\n)\s*(?:#+\s*)?(方案\s*[一二三123]|方案[一二三123]|Plan\s*[123])[^\n]*/gi;

const PANEL_BLOCK_SPLIT_RE =
  /(?=(?:^|\n)\s*(?:#{1,4}\s*)?(?:\*\*)?(?:镜头|镜号)\s*(\d+))/g;

function fieldFromBlock(block: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const re = new RegExp(`${label}\\s*[：:]\\s*([^\\n]+)`, "i");
    const m = block.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return undefined;
}

function normalizeHeader(cell: string): string {
  return cell.replace(/\s+/g, "").toLowerCase();
}

function colIndex(headers: string[], aliases: string[]): number {
  const norm = headers.map(normalizeHeader);
  for (const a of aliases) {
    const i = norm.findIndex((h) => h.includes(normalizeHeader(a)));
    if (i >= 0) return i;
  }
  return -1;
}

function parseTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return [];
  return trimmed
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.every((c) => /^:?-+:?$/.test(c.replace(/\s/g, "")));
}

function parseMarkdownTable(block: string): StoryboardScheme["panels"] {
  const lines = block.split("\n");
  const panels: StoryboardScheme["panels"] = [];
  let headers: string[] | null = null;

  for (const line of lines) {
    const cells = parseTableRow(line);
    if (cells.length < 3) continue;
    if (!headers) {
      if (isSeparatorRow(cells)) continue;
      const joined = cells.join("");
      if (!joined.includes("镜头") && !joined.includes("景别") && !joined.includes("画面")) {
        continue;
      }
      headers = cells;
      continue;
    }
    if (isSeparatorRow(cells)) continue;

    const idxCol = colIndex(headers, ["镜头编号", "镜头", "镜号"]);
    const timelineCol = colIndex(headers, ["时间轴", "时间"]);
    const shotCol = colIndex(headers, ["景别"]);
    const cameraCol = colIndex(headers, ["运镜", "镜头运动"]);
    const sceneCol = colIndex(headers, ["画面内容", "画面", "场景"]);
    const emotionCol = colIndex(headers, ["情绪"]);
    const dialogueCol = colIndex(headers, ["口播台词", "台词", "旁白"]);

    const indexRaw = idxCol >= 0 ? cells[idxCol] : cells[0];
    const index = parseInt(indexRaw?.replace(/\D/g, "") || "", 10);
    if (!Number.isFinite(index) || index <= 0) continue;

    const scene =
      (sceneCol >= 0 ? cells[sceneCol] : "") ||
      cells.find((c) => c.length > 4) ||
      "场景";
    const action = scene;
    const shotType = (shotCol >= 0 ? cells[shotCol] : "")?.trim() || "中景";

    const panel = storyboardPanelSchema.safeParse({
      index,
      timeline: timelineCol >= 0 ? cells[timelineCol] : undefined,
      shotType,
      camera: cameraCol >= 0 ? cells[cameraCol] : undefined,
      scene,
      action,
      emotion: emotionCol >= 0 ? cells[emotionCol] : undefined,
      dialogue: dialogueCol >= 0 ? cells[dialogueCol] : undefined,
    });
    if (panel.success) panels.push(panel.data);
  }

  return panels.sort((a, b) => a.index - b.index);
}

function parseNarrativePanels(block: string): StoryboardScheme["panels"] {
  const panels: StoryboardScheme["panels"] = [];
  const parts = block.split(PANEL_BLOCK_SPLIT_RE).filter((p) => p.trim());

  for (const part of parts) {
    const head = part.match(
      /(?:#{1,4}\s*)?(?:\*\*)?(?:镜头|镜号)\s*(\d+)[^\n]*(?:[（(]([^）)]+)[）)])?/i,
    );
    if (!head) continue;
    const index = parseInt(head[1]!, 10);
    if (!Number.isFinite(index) || index <= 0) continue;

    const timeline = head[2]?.trim() ?? fieldFromBlock(part, ["时间轴", "时间"]);
    const shotType = fieldFromBlock(part, ["景别"]) ?? "中景";
    const camera = fieldFromBlock(part, ["运镜", "镜头运动"]);
    const sceneFallback =
      part
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !/^镜头|^镜号|^#{1,4}/.test(l))
        .slice(0, 3)
        .join(" ")
        .slice(0, 500) || "画面";
    const scene =
      fieldFromBlock(part, ["画面内容", "画面", "场景", "画面描述"]) ?? sceneFallback;
    const emotion = fieldFromBlock(part, ["情绪"]);
    const dialogue = fieldFromBlock(part, ["口播台词", "台词", "口播", "旁白"]);

    const panel = storyboardPanelSchema.safeParse({
      index,
      timeline,
      shotType,
      camera,
      scene,
      action: scene,
      emotion,
      dialogue,
    });
    if (panel.success) panels.push(panel.data);
  }
  return panels.sort((a, b) => a.index - b.index);
}

function splitSchemeBlocks(markdown: string): Array<{ title: string; body: string }> {
  const matches = [...markdown.matchAll(SCHEME_HEADER_RE)];
  if (matches.length === 0) {
    return [{ title: "微剧情分镜", body: markdown }];
  }

  const blocks: Array<{ title: string; body: string }> = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i]!.index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1]!.index ?? markdown.length) : markdown.length;
    blocks.push({
      title: matches[i]![0].trim().replace(/^#+\s*/, ""),
      body: markdown.slice(start, end),
    });
  }
  return blocks;
}

/** 从助手 Markdown 交付文本解析分镜方案（无 JSON 围栏时的兜底） */
export function parseStoryboardSchemesFromMarkdown(markdown: string): StoryboardScheme[] {
  const text = markdown.trim();
  if (!text) return [];

  const schemes: StoryboardScheme[] = [];
  const blocks = splitSchemeBlocks(text);

  blocks.forEach((block, i) => {
    let panels = parseMarkdownTable(block.body);
    if (panels.length === 0) {
      panels = parseNarrativePanels(block.body);
    }
    if (panels.length === 0) return;

    schemes.push({
      id: `scheme-parsed-${i + 1}`,
      title: block.title || `方案${i + 1}`,
      panels,
      totalDurationHintSec: 10,
    });
  });

  return schemes;
}
