/**
 * 解析 `tool-web/doc/price.md` 中 **「## 中国内地」** 块内的 Markdown 表格，抽取含
 * 「输入单价 / 输出单价（每百万Token）」的计费行，供上架留痕与成本导入（非运行时扣费）。
 */
import { createHash } from "crypto";
import type { PriceMdChinaExtract, PriceMdChinaTokenRow } from "./price-md-china-types";

function stripCell(s: string): string {
  return s
    .replace(/\*\*/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** 表格一行：去掉首尾空 pipe 段，得到各单元格 */
export function rowDataCells(line: string): string[] {
  const p = line.split("|").map((x) => stripCell(x));
  if (p.length > 0 && p[0] === "") p.shift();
  if (p.length > 0 && p[p.length - 1] === "") p.pop();
  return p;
}

function parseYuanCell(cell: string): number | null {
  const m = cell.match(/([\d.]+)\s*元/);
  if (!m) return null;
  const n = parseFloat(m[1]!);
  return Number.isFinite(n) ? n : null;
}

/** `>` 前主名 + 全文内 qwen-xxx / wanx-xxx 等 token */
export function deriveModelKeys(modelRaw: string): string[] {
  const t = modelRaw.toLowerCase();
  const keys: string[] = [];
  const add = (k: string) => {
    if (!keys.includes(k)) keys.push(k);
  };
  const main = t.split(">")[0]?.trim() ?? t;
  if (main.length > 0) add(main.replace(/\s+/g, ""));
  const re = /\b([a-z][a-z0-9._-]*\d[a-z0-9._-]*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const k = m[1]!;
    if (k.length >= 4 && /^qwen|^wanx|^paraformer|^glm|^deepseek/i.test(k)) add(k);
  }
  return keys;
}

const TIER_LIKE = /^(?:0<|(?:\d+)?K<)Token/i;

function isTableHeaderLine(line: string): boolean {
  return (
    line.includes("输入单价") &&
    line.includes("每百万Token") &&
    line.includes("模型名称")
  );
}

function isSeparatorLine(line: string): boolean {
  const compact = line.replace(/\s/g, "");
  return /^\|[\s:|-]+\|$/.test(line.trim()) || /^(\|\s*[:|-]+)+\|?$/.test(compact);
}

function mapColumns(headerCells: string[]): {
  model: number;
  tier: number;
  input: number;
  output: number;
} | null {
  const idx = (pred: (c: string) => boolean) => headerCells.findIndex(pred);
  const model = idx((c) => c.includes("模型名称"));
  if (model < 0) return null;
  const input = idx((c) => c.includes("输入单价") && c.includes("百万"));
  if (input < 0) return null;
  const outputIdxs = headerCells
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.includes("输出单价") && c.includes("百万"));
  if (outputIdxs.length === 0) return null;
  const output = outputIdxs[outputIdxs.length - 1]!.i;
  const tierGuess = headerCells.findIndex(
    (c) =>
      c.includes("Token") &&
      (c.includes("范围") || c.includes("输入Token") || c.includes("Token数")),
  );
  const tier = tierGuess >= 0 ? tierGuess : model + 1;
  if (output === input) return null;
  return { model, tier, input, output };
}

/**
 * 自 price.md 全文解析中国内地 Token 计价表行。
 */
export function parsePriceMdChinaMainlandTokenTables(
  markdown: string,
  opts?: { sourceRelativePath?: string },
): PriceMdChinaExtract {
  const warnings: string[] = [];
  const lines = markdown.split(/\r?\n/);
  let h2 = "";
  let h3 = "";
  let inChina = false;
  let lastModelRaw = "";
  let colMap: ReturnType<typeof mapColumns> = null;
  const rows: PriceMdChinaTokenRow[] = [];

  const pushRow = (
    modelRaw: string,
    tierRaw: string,
    input: number,
    output: number,
    lineNo: number,
  ) => {
    const mr = stripCell(modelRaw);
    const tr = stripCell(tierRaw);
    if (!mr || !Number.isFinite(input) || !Number.isFinite(output)) return;
    rows.push({
      sectionH2: h2,
      sectionH3: h3,
      modelRaw: mr,
      modelKeys: deriveModelKeys(mr),
      tierRaw: tr || "—",
      inputYuanPerMillion: input,
      outputYuanPerMillion: output,
      sourceLine: lineNo,
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!.trim();

    if (l.startsWith("## ") && !l.startsWith("###")) {
      const title = stripCell(l.replace(/^##\s+/, ""));
      if (title === "中国内地") {
        inChina = true;
        colMap = null;
      } else {
        inChina = false;
        colMap = null;
      }
      if (!inChina && l.match(/^##\s+/)) {
        const t = title.replace(/^\*\*|\*\*$/g, "");
        if (
          t.includes("文本生成") ||
          t.includes("图像") ||
          t.includes("视频") ||
          t.includes("语音") ||
          t.includes("嵌入") ||
          t.includes("专项") ||
          t.includes("通用") ||
          t.includes("实时")
        ) {
          h2 = t;
        }
      }
      continue;
    }

    if (l.startsWith("### ")) {
      h3 = stripCell(l.replace(/^###\s+/, "").replace(/^\*\*|\*\*$/g, ""));
      continue;
    }

    if (!inChina || !l.startsWith("|")) continue;
    if (isSeparatorLine(l)) continue;

    if (isTableHeaderLine(l)) {
      const headerCells = rowDataCells(l);
      colMap = mapColumns(headerCells);
      if (!colMap) {
        warnings.push(`L${i + 1}: 表头无法映射列，跳过该表`);
      }
      continue;
    }

    if (!colMap) continue;

    const dataCells = rowDataCells(l);
    if (dataCells.length < 3) continue;

    const c0 = dataCells[0] ?? "";
    if ((c0.includes("非思考模式") || c0.includes("思考模式")) && c0.includes("**")) continue;

    if (
      dataCells.length === 3 &&
      lastModelRaw &&
      TIER_LIKE.test(c0) &&
      parseYuanCell(dataCells[1] ?? "") != null &&
      parseYuanCell(dataCells[2] ?? "") != null
    ) {
      pushRow(
        lastModelRaw,
        dataCells[0]!,
        parseYuanCell(dataCells[1]!)!,
        parseYuanCell(dataCells[2]!)!,
        i + 1,
      );
      continue;
    }

    const { model: mi, tier: ti, input: ii, output: oi } = colMap;
    if (mi >= dataCells.length || ti >= dataCells.length) continue;

    let modelRaw = dataCells[mi] ?? "";
    const tierRaw = dataCells[ti] ?? "";
    const inCell = dataCells[ii] ?? "";
    const outCell = dataCells[oi] ?? "";

    if (modelRaw && !TIER_LIKE.test(modelRaw)) {
      lastModelRaw = stripCell(modelRaw);
    } else if (!modelRaw && lastModelRaw) {
      modelRaw = lastModelRaw;
    }

    const input = parseYuanCell(inCell);
    const output = parseYuanCell(outCell);
    if (input == null || output == null) continue;
    if (!modelRaw && !lastModelRaw) continue;

    pushRow(modelRaw || lastModelRaw, tierRaw, input, output, i + 1);
  }

  const buf = Buffer.from(markdown, "utf8");
  const sourceSha256 = createHash("sha256").update(buf).digest("hex");
  return {
    meta: {
      generatedAt: new Date().toISOString(),
      sourceRelativePath: opts?.sourceRelativePath ?? "doc/price.md",
      sourceSha256,
      rowCount: rows.length,
      warnings,
    },
    rows,
  };
}
