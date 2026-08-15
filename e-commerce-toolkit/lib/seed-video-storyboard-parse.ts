import { buildSeedVideoDirectPlanFromShots } from "@/lib/seed-video-direct-plan";
import type { SeedVideoDirectPlan, SeedVideoProject, SeedVideoReference, SeedVideoShot } from "@/lib/seed-video-types";
import {
  extractSeedVideoStructuredPatch,
  hasStructuredDirectPlan,
  resolveDirectPlanFromAssistantText,
  resolveFormalShotsFromAssistantText,
} from "@/lib/seed-video-structured";
import {
  hasSeedVideoDirectPlanReady,
  hasSeedVideoShotsTableMarkdown,
  isSeedVideoProductionWorkspaceReady,
  isSeedVideoScriptProposalMarkdown,
} from "@/lib/seed-video-workflow";

export type SeedVideoStoryboardDraftRow = {
  index: number;
  duration: string;
  refLabel: string;
  cameraMove: string;
  sceneDescription: string;
  voiceover: string;
  aiPrompt: string;
  /** @deprecated 旧草稿兼容 */
  visualFx?: string;
};

/** 正式脚本表头（编辑区 / 会话区 / 同步 API 共用 · 统一表 A + AI 列） */
export const SEED_VIDEO_FORMAL_SCRIPT_TABLE_HEADERS = [
  "镜号",
  "时间",
  "参考素材",
  "画面设计",
  "AI视频生成提示词",
  "口播文案",
] as const;

/** 方案① / 脚本方案 表 A（无 AI 列） */
export const SEED_VIDEO_SHOT_SEQUENCE_TABLE_HEADERS = [
  "镜号",
  "时间",
  "参考素材",
  "画面设计",
  "口播文案",
] as const;

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

const CIRCLED_INDEX_MAP: Record<string, number> = {
  "①": 1,
  "②": 2,
  "③": 3,
  "④": 4,
  "⑤": 5,
  "⑥": 6,
  "⑦": 7,
  "⑧": 8,
  "⑨": 9,
};

function parseStoryboardRowIndex(raw: string | undefined): number {
  const t = (raw ?? "").trim();
  if (!t) return NaN;
  if (CIRCLED_INDEX_MAP[t] != null) return CIRCLED_INDEX_MAP[t]!;
  for (const [marker, value] of Object.entries(CIRCLED_INDEX_MAP)) {
    if (t.startsWith(marker)) return value;
  }
  const digit = t.match(/(\d+)/);
  if (digit) return parseInt(digit[1]!, 10);
  return NaN;
}

export function normalizeSeedVideoRefLabel(raw: string): string {
  const t = raw.trim();
  const m = t.match(/图片?\s*(\d+)/i);
  if (m) return `图${m[1]}`;
  return t;
}

function inferCameraMoveFromScene(text: string): string {
  const m = text.match(
    /(?:推镜|拉镜|摇镜|跟镜|慢动作|慢镜头|特写|全景|渐隐|扫视|扫轨|ken burns|推近|拉远|上下扫视|缓慢推镜)[^，,。；;]*/i,
  );
  return m?.[0]?.trim() ?? "";
}

function isStoryboardTableHeader(headers: string[]): boolean {
  const joined = headers.join("");
  if (/正式脚本/.test(joined)) return false;
  // Step2 脚本方案表：|分镜|时长|画面素材|口播| — 不是分镜执行表
  if (/分镜/.test(joined) && /画面素材/.test(joined) && !/镜号|序号/.test(joined)) {
    return false;
  }
  const hasIdx = /镜号|序号|分镜执行|镜头序号/.test(joined) || (/分镜/.test(joined) && /序号|镜号/.test(joined));
  const hasTime = /时长|时间切片|时间/.test(joined);
  const hasVo = /口播/.test(joined);
  const hasScene = /画面设计|画面描述|画面细节|镜头描述|运镜/.test(joined);
  const hasMaterial = /对应素材|素材映射|参考素材|画面素材/.test(joined);
  if (!hasIdx || !hasTime) return false;
  if (/AI视频生成提示词/.test(joined) && /素材映射|参考素材/.test(joined) && !hasScene) {
    return false;
  }
  return hasVo || hasScene || hasMaterial;
}

function isFormalScriptTableHeader(headers: string[]): boolean {
  const joined = headers.join("");
  if (/正式脚本/.test(joined)) return true;
  if (/镜号|序号/.test(joined) && /AI视频生成提示词|AI提示词|AI生成参考/.test(joined)) {
    return true;
  }
  if (
    /镜号|序号/.test(joined) &&
    /口播/.test(joined) &&
    /画面设计|画面描述|镜头描述|运镜|画面描述与运镜/.test(joined)
  ) {
    return true;
  }
  if (/镜号/.test(joined) && /参考素材/.test(joined) && /画面设计/.test(joined)) {
    return true;
  }
  return false;
}

function isScriptTableMarkdown(text: string): boolean {
  return (
    /\|/.test(text) &&
    /正式脚本|运镜参数|逐镜参数|分镜执行表|视频分镜执行表/.test(text)
  );
}

function normalizeDraftRow(row: Partial<SeedVideoStoryboardDraftRow> & { index: number }): SeedVideoStoryboardDraftRow {
  const scene =
    String(row.sceneDescription ?? "").trim() ||
    String(row.visualFx ?? "").trim() ||
    String(row.cameraMove ?? "").trim();
  let camera = String(row.cameraMove ?? "").trim();
  if (!camera && scene) camera = inferCameraMoveFromScene(scene);
  const ai =
    String(row.aiPrompt ?? "").trim() ||
    buildFallbackVideoPrompt({
      index: row.index,
      duration: String(row.duration ?? ""),
      refLabel: normalizeSeedVideoRefLabel(String(row.refLabel ?? "")),
      cameraMove: camera,
      sceneDescription: scene,
      voiceover: String(row.voiceover ?? ""),
      aiPrompt: "",
    });

  return {
    index: row.index,
    duration: String(row.duration ?? ""),
    refLabel: normalizeSeedVideoRefLabel(String(row.refLabel ?? "")),
    cameraMove: camera,
    sceneDescription: scene,
    voiceover: String(row.voiceover ?? ""),
    aiPrompt: ai,
  };
}

function tableCellText(cells: string[], col: number, fallbackCol?: number): string {
  const pick = (i: number) => (i >= 0 && i < cells.length ? cells[i] : undefined);
  const raw = col >= 0 ? pick(col) : fallbackCol !== undefined ? pick(fallbackCol) : undefined;
  return (raw ?? "").trim();
}

function parseDraftRowsFromLines(lines: string[], opts?: { formalOnly?: boolean }): SeedVideoStoryboardDraftRow[] {
  let headers: string[] | null = null;
  const rows: SeedVideoStoryboardDraftRow[] = [];

  for (const line of lines) {
    const cells = parseTableRow(line);
    if (cells.length < 3) {
      if (rows.length >= 2) break;
      headers = null;
      continue;
    }
    if (!headers) {
      if (isSeparatorRow(cells)) continue;
      const ok = opts?.formalOnly
        ? isFormalScriptTableHeader(cells)
        : isStoryboardTableHeader(cells) || isFormalScriptTableHeader(cells);
      if (!ok) continue;
      headers = cells;
      continue;
    }
    if (isSeparatorRow(cells)) continue;
    if (
      isStoryboardTableHeader(cells) ||
      isFormalScriptTableHeader(cells)
    ) {
      if (rows.length >= 2) break;
      headers = cells;
      rows.length = 0;
      continue;
    }

    const idxCol = colIndex(headers, ["镜号", "序号", "镜头", "分镜"]);
    const durCol = colIndex(headers, ["时间切片", "时长", "时间"]);
    const refCol = colIndex(headers, [
      "参考素材",
      "素材",
      "对应素材",
      "素材映射",
      "参考素材图",
      "参考图",
      "画面素材",
    ]);
    const camCol = colIndex(headers, ["运镜", "运镜方式", "运镜参数", "运镜手法"]);
    const mergedSceneCamCol = colIndex(headers, [
      "画面描述与运镜",
      "画面描述及运镜",
      "画面与运镜",
    ]);
    const sceneCol = colIndex(headers, [
      "画面设计",
      "画面描述",
      "画面细节描述",
      "画面细节渲染",
      "镜头描述",
      "画面",
    ]);
    const fxCol = colIndex(headers, ["画面特效", "转场", "特效", "画面特效/转场"]);
    const voCol = colIndex(headers, ["口播文案", "口播", "口播/音效", "台词"]);
    const promptCol = colIndex(headers, [
      "AI视频生成提示词",
      "AI 视频生成提示词",
      "AI提示词参考",
      "AI生成参考",
      "AI 生成参考",
      "视频提示词",
      "提示词",
    ]);

    const index = parseStoryboardRowIndex(
      idxCol >= 0 ? tableCellText(cells, idxCol) : tableCellText(cells, 0),
    );
    if (!Number.isFinite(index) || index <= 0) continue;

    let sceneRaw =
      tableCellText(cells, sceneCol) || tableCellText(cells, fxCol);
    let camRaw = tableCellText(cells, camCol);
    if (mergedSceneCamCol >= 0 && !sceneRaw && !camRaw) {
      const merged = tableCellText(cells, mergedSceneCamCol);
      sceneRaw = merged;
      camRaw = inferCameraMoveFromScene(merged);
    }

    rows.push(
      normalizeDraftRow({
        index,
        duration: tableCellText(cells, durCol),
        refLabel: tableCellText(cells, refCol),
        cameraMove: camRaw || inferCameraMoveFromScene(sceneRaw),
        sceneDescription: sceneRaw,
        voiceover: tableCellText(cells, voCol, Math.max(0, cells.length - 2)),
        aiPrompt: tableCellText(cells, promptCol, Math.max(0, cells.length - 1)),
      }),
    );
  }

  return rows.sort((a, b) => a.index - b.index);
}

export function buildFallbackVideoPrompt(row: SeedVideoStoryboardDraftRow): string {
  const ref = normalizeSeedVideoRefLabel(row.refLabel);
  const parts = [row.sceneDescription, row.cameraMove].map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return ref ? `参考${ref}` : "";
  return `参考${ref}，${parts.join("，")}`;
}

/** 从助手分镜执行表 / 正式脚本 Markdown 解析可编辑行 */
export function parseStoryboardExecutionTable(markdown: string): SeedVideoStoryboardDraftRow[] {
  if (!markdown.trim()) return [];

  const formalSection = markdown.match(
    /(?:##?\s*)?正式脚本[：:][^\n]*[\s\S]*?(?=\n##\s|\n---\n|$)/i,
  );
  if (formalSection?.[0]) {
    const rows = parseDraftRowsFromLines(formalSection[0].split("\n"), { formalOnly: true });
    if (rows.length >= 2) return rows;
  }

  const sectionMatch = markdown.match(
    /(?:##?\s*)?(?:视频)?分镜执行表[\s\S]*?(?=\n##\s|\n---\n|$)/i,
  );
  if (sectionMatch?.[0]) {
    const rows = parseDraftRowsFromLines(sectionMatch[0].split("\n"));
    if (rows.length >= 2) return rows;
  }

  return parseDraftRowsFromLines(markdown.split("\n"));
}

export function findFormalScriptMarkdown(project: {
  chatHistory: Array<{ role: string; content: string }>;
  meta?: { lastAssistantRaw?: unknown; storyboardDraft?: unknown } | null;
}): string {
  const fromMeta =
    typeof project.meta?.lastAssistantRaw === "string" ? project.meta.lastAssistantRaw.trim() : "";

  const candidates: string[] = [];
  if (fromMeta && isScriptTableMarkdown(fromMeta)) candidates.push(fromMeta);

  for (const m of [...project.chatHistory].reverse()) {
    const text = m.content.trim();
    if (!isScriptTableMarkdown(text)) continue;
    if (/正式脚本|运镜参数|逐镜参数/.test(text)) {
      candidates.unshift(text);
    }
  }

  for (const text of candidates) {
    if (parseStoryboardExecutionTable(text).length >= 2) return text;
  }
  return "";
}

export function findStoryboardMarkdownForEdit(project: {
  chatHistory: Array<{ role: string; content: string }>;
  meta?: { lastAssistantRaw?: unknown; storyboardDraft?: unknown } | null;
}): string {
  const formal = findFormalScriptMarkdown(project);
  if (formal) return formal;

  const fromMeta =
    typeof project.meta?.lastAssistantRaw === "string" ? project.meta.lastAssistantRaw.trim() : "";

  const candidates: string[] = [];
  if (fromMeta) candidates.push(fromMeta);

  for (const m of [...project.chatHistory].reverse()) {
    if (m.role !== "assistant") continue;
    const text = m.content.trim();
    if (isSeedVideoScriptProposalMarkdown(text)) continue;
    if (/分镜执行表|视频分镜执行表/.test(m.content)) {
      candidates.unshift(text);
    } else if (/\|/.test(text) && /画面描述|口播文案|运镜|镜号|分镜/.test(text)) {
      candidates.push(text);
    }
  }

  for (const text of candidates) {
    if (parseStoryboardExecutionTable(text).length >= 2) return text;
  }

  return fromMeta;
}

export function resolveStoryboardDraftRows(
  project: Pick<SeedVideoProject, "chatHistory" | "meta"> & {
    plan?: Pick<NonNullable<SeedVideoProject["plan"]>, "shots"> | null;
  },
): SeedVideoStoryboardDraftRow[] {
  if (!isSeedVideoProductionWorkspaceReady(project)) {
    return [];
  }

  const saved = readStoryboardDraftFromMeta(project.meta);
  if (saved.length >= 2) return saved;

  const formalMd = findFormalScriptMarkdown(project);
  if (formalMd) {
    const rows = parseStoryboardExecutionTable(formalMd);
    if (rows.length >= 2) return rows;
  }

  const shots = project.plan?.shots ?? [];
  if (shots.length >= 2) {
    return shots
      .map((s) =>
        normalizeDraftRow({
          index: s.index,
          duration: s.timeSlice,
          refLabel: s.refImageLabel,
          sceneDescription: s.sceneDescription,
          cameraMove: inferCameraMoveFromScene(s.sceneDescription),
          voiceover: s.voiceover,
          aiPrompt: s.videoPrompt,
        }),
      )
      .sort((a, b) => a.index - b.index);
  }

  return parseStoryboardExecutionTable(findStoryboardMarkdownForEdit(project));
}

/** 将会话中的任意脚本表 Markdown 规范化为统一表头/列结构 */
export function canonicalizeFormalScriptMarkdown(markdown: string): string {
  if (!/\|/.test(markdown)) return markdown;
  if (/脚本一|脚本二|脚本三|请选择.*脚本|方案一|方案二|方案三/.test(markdown)) {
    if (!/正式脚本|分镜执行表|运镜参数|逐镜参数/.test(markdown)) return markdown;
  }
  const rows = parseStoryboardExecutionTable(markdown);
  if (rows.length < 2) return markdown;
  if (!isScriptTableMarkdown(markdown) && !/口播|运镜|画面描述|镜头描述/.test(markdown)) {
    return markdown;
  }
  return serializeFormalScriptTable(rows);
}

/** 会话区渲染：编辑态优先用 meta.storyboardDraft（与中间编辑区同源） */
export function resolveChatFormalScriptMarkdown(
  markdown: string,
  meta: SeedVideoProjectMetaLike | null | undefined,
): string {
  const draft = readStoryboardDraftFromMeta(meta);
  if (
    draft.length >= 2 &&
    isScriptTableMarkdown(markdown) &&
    Boolean(meta?.workflow?.editingStoryboard)
  ) {
    return serializeFormalScriptTable(draft);
  }
  return canonicalizeFormalScriptMarkdown(markdown);
}

/** 输出与 Skill / 中间工作区一致的正式脚本表（一步到位，不再重复分镜执行表） */
export function serializeFormalScriptTable(rows: SeedVideoStoryboardDraftRow[]): string {
  const normalized = rows.map((r) => normalizeDraftRow(r));
  const header = `| ${SEED_VIDEO_FORMAL_SCRIPT_TABLE_HEADERS.join(" | ")} |`;
  const sep = `| ${SEED_VIDEO_FORMAL_SCRIPT_TABLE_HEADERS.map(() => "---").join(" | ")} |`;
  const body = normalized
    .map((r) => {
      const ref = normalizeSeedVideoRefLabel(r.refLabel);
      const prompt = r.aiPrompt.trim() || buildFallbackVideoPrompt(r);
      const scene = [r.cameraMove.trim(), r.sceneDescription.trim()].filter(Boolean).join("，");
      const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
      return `| ${r.index} | ${esc(r.duration)} | ${esc(ref)} | ${esc(scene)} | ${esc(prompt)} | ${esc(r.voiceover)} |`;
    })
    .join("\n");
  return `## 正式脚本：逐镜参数表\n\n${header}\n${sep}\n${body}\n\n请确认逐镜参数表：`;
}

/** @deprecated 仅用于旧流程回显；新流程请用 serializeFormalScriptTable */
export function serializeStoryboardExecutionTable(rows: SeedVideoStoryboardDraftRow[]): string {
  return serializeFormalScriptTable(rows);
}

export function readStoryboardDraftFromMeta(
  meta: SeedVideoProjectMetaLike | null | undefined,
): SeedVideoStoryboardDraftRow[] {
  const raw = meta?.storyboardDraft;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const index = parseInt(String(r.index ?? ""), 10);
      if (!Number.isFinite(index) || index <= 0) return null;
      return normalizeDraftRow({
        index,
        duration: String(r.duration ?? ""),
        refLabel: String(r.refLabel ?? ""),
        cameraMove: String(r.cameraMove ?? ""),
        sceneDescription: String(r.sceneDescription ?? r.visualFx ?? ""),
        voiceover: String(r.voiceover ?? ""),
        aiPrompt: String(r.aiPrompt ?? ""),
        visualFx: String(r.visualFx ?? ""),
      });
    })
    .filter(Boolean) as SeedVideoStoryboardDraftRow[];
}

type SeedVideoProjectMetaLike = SeedVideoProject["meta"];

function parseDurationSecFromSlice(raw: string): number {
  const m = raw.match(/(\d+(?:\.\d+)?)/);
  if (!m) return 8;
  const n = parseFloat(m[1]!);
  return Number.isFinite(n) && n > 0 ? Math.max(3, Math.min(15, Math.round(n))) : 8;
}

function buildRefLabelToIdMap(references: SeedVideoReference[]): Map<string, string> {
  const map = new Map<string, string>();
  references.forEach((r, i) => {
    map.set(`图${i + 1}`, r.id);
    map.set(`图片${i + 1}`, r.id);
    map.set(r.label, r.id);
  });
  return map;
}

export function seedVideoDraftRowsToShots(
  rows: SeedVideoStoryboardDraftRow[],
  references: SeedVideoReference[],
): SeedVideoShot[] {
  const refMap = buildRefLabelToIdMap(references);
  return rows
    .map((r) => {
      const refLabel = normalizeSeedVideoRefLabel(r.refLabel);
      const refImageId = refMap.get(refLabel) ?? references[0]?.id ?? "";
      const sceneDescription = [r.cameraMove, r.sceneDescription].filter(Boolean).join(" · ");
      return {
        index: r.index,
        timeSlice: r.duration,
        refImageId,
        refImageLabel: refLabel,
        sceneDescription,
        videoPrompt: r.aiPrompt.trim() || buildFallbackVideoPrompt(r),
        voiceover: r.voiceover,
        durationSec: parseDurationSecFromSlice(r.duration),
      };
    })
    .sort((a, b) => a.index - b.index);
}

/** 刷新后恢复中间工作区：plan.shots 优先，否则从 meta / 会话草稿还原 */
export function resolveSeedVideoProductionShots(project: SeedVideoProject): SeedVideoShot[] {
  if (!isSeedVideoProductionWorkspaceReady(project)) {
    return [];
  }

  const fromPlan = project.plan?.shots ?? [];
  const planByIndex = new Map(fromPlan.map((s) => [s.index, s]));

  let base: SeedVideoShot[];
  if (fromPlan.length >= 2) {
    base = fromPlan;
  } else {
    const rows = resolveStoryboardDraftRows(project);
    if (rows.length >= 2) {
      base = seedVideoDraftRowsToShots(rows, project.references);
    } else {
      return fromPlan;
    }
  }

  return base.map((s) => {
    const saved = planByIndex.get(s.index);
    if (!saved) return s;
    return {
      ...s,
      ...saved,
      videoUrl: saved.videoUrl ?? s.videoUrl,
      ttsUrl: saved.ttsUrl ?? s.ttsUrl,
      videoTaskId: saved.videoTaskId ?? s.videoTaskId,
    };
  });
}

export function resolvePendingFormalShotsPreview(project: SeedVideoProject): SeedVideoShot[] {
  const ws = resolveSeedVideoMiddleWorkspaceContent(project);
  return ws.mode === "fine" ? ws.shots : [];
}

export type SeedVideoMiddleWorkspaceContent = {
  mode: "direct" | "fine" | null;
  directPlan: SeedVideoDirectPlan | null;
  shots: SeedVideoShot[];
  needsConfirm: boolean;
};

function collectAssistantProductionTexts(project: SeedVideoProject): string[] {
  const out: string[] = [];
  const fromMeta =
    typeof project.meta?.lastAssistantRaw === "string" ? project.meta.lastAssistantRaw.trim() : "";
  if (fromMeta) out.push(fromMeta);
  for (const m of [...project.chatHistory].reverse()) {
    if (m.role !== "assistant") continue;
    const t = m.content.trim();
    if (!t || out.includes(t)) continue;
    out.push(t);
  }
  return out;
}

/** 中间工作区展示：已同步 plan 优先，否则从助手 JSON/Markdown 解析预览（不依赖 workspaceReady） */
export function resolveSeedVideoMiddleWorkspaceContent(
  project: SeedVideoProject,
): SeedVideoMiddleWorkspaceContent {
  const empty: SeedVideoMiddleWorkspaceContent = {
    mode: null,
    directPlan: null,
    shots: [],
    needsConfirm: false,
  };

  const productionMode = project.meta?.workflow?.productionMode;
  const planShots = project.plan?.shots ?? [];

  if (productionMode === "fine" && planShots.length > 0) {
    return {
      mode: "fine",
      directPlan: null,
      shots: planShots,
      needsConfirm: !project.meta?.workflow?.planSynced,
    };
  }

  if (
    hasSeedVideoDirectPlanReady(project.plan?.directVideo) &&
    productionMode !== "fine"
  ) {
    return {
      mode: "direct",
      directPlan: project.plan!.directVideo!,
      shots: [],
      needsConfirm: false,
    };
  }

  if (productionMode === "direct") {
    for (const text of collectAssistantProductionTexts(project)) {
      if (isSeedVideoScriptProposalMarkdown(text)) continue;
      const patch = extractSeedVideoStructuredPatch(text);
      if (patch?.step === "directPlan" || patch?.directPlan || hasStructuredDirectPlan(text)) {
        const directPlan = resolveDirectPlanFromAssistantText(text);
        if (directPlan) {
          return { mode: "direct", directPlan, shots: [], needsConfirm: false };
        }
      }
      if (/请确认成片参数|直接连贯成片参数/.test(text)) {
        const directPlan = resolveDirectPlanFromAssistantText(text);
        if (directPlan) {
          return { mode: "direct", directPlan, shots: [], needsConfirm: !project.meta?.workflow?.planSynced };
        }
      }
    }
    if (planShots.length >= 1) {
      const directPlan = buildSeedVideoDirectPlanFromShots(planShots, {
        settings: project.settings,
        stylePack: project.plan?.stylePack,
      });
      if (directPlan) {
        return { mode: "direct", directPlan, shots: planShots, needsConfirm: false };
      }
    }
  }

  if (planShots.length > 0) {
    return { mode: "fine", directPlan: null, shots: planShots, needsConfirm: false };
  }

  const needsConfirm = !project.meta?.workflow?.planSynced;

  for (const text of collectAssistantProductionTexts(project)) {
    if (isSeedVideoScriptProposalMarkdown(text)) continue;

    const patch = extractSeedVideoStructuredPatch(text);
    if (patch?.step === "formalShots" || (patch?.shots?.length ?? 0) >= 2) {
      const shots = resolveFormalShotsFromAssistantText(text);
      if (shots.length >= 2) {
        return { mode: "fine", directPlan: null, shots, needsConfirm };
      }
    }

    if (/正式脚本|请确认逐镜参数表/.test(text) || hasSeedVideoShotsTableMarkdown(text)) {
      const rows = parseStoryboardExecutionTable(text);
      if (rows.length >= 2) {
        return {
          mode: "fine",
          directPlan: null,
          shots: seedVideoDraftRowsToShots(rows, project.references),
          needsConfirm,
        };
      }
    }

    if (patch?.step === "directPlan" || patch?.directPlan || hasStructuredDirectPlan(text)) {
      const directPlan = resolveDirectPlanFromAssistantText(text);
      if (directPlan) {
        return { mode: "direct", directPlan, shots: [], needsConfirm };
      }
    }

    if (/请确认成片参数|直接连贯成片参数/.test(text)) {
      const directPlan = resolveDirectPlanFromAssistantText(text);
      if (directPlan) {
        return { mode: "direct", directPlan, shots: [], needsConfirm };
      }
    }
  }

  const fromDraft = resolveSeedVideoProductionShots(project);
  if (fromDraft.length >= 2) {
    return { mode: "fine", directPlan: null, shots: fromDraft, needsConfirm: false };
  }

  return empty;
}

export function hasSeedVideoProductionContent(project: SeedVideoProject): boolean {
  const ws = resolveSeedVideoMiddleWorkspaceContent(project);
  if (ws.mode === "direct" && ws.directPlan) return true;
  if (ws.mode === "fine" && ws.shots.length >= 2) return true;
  if (readStoryboardDraftFromMeta(project.meta).length >= 2) return true;
  if (resolveStoryboardDraftRows(project).length >= 2) return true;
  return Boolean(project.meta?.workflow?.editingStoryboard);
}
