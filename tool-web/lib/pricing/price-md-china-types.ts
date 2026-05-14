/** 从 `doc/price.md` 中国内地章节表格解析出的「元/百万 Token」行（留痕/上架用，非在线扣费真源）。 */

export type PriceMdChinaTokenRow = {
  /** 文档中的二级标题，如「文本生成-千问」 */
  sectionH2: string;
  /** 三级标题，如「千问Plus」 */
  sectionH3: string;
  /** 表格「模型名称」列原文（已去链接/HTML，保留 `>` 别名文案） */
  modelRaw: string;
  /** 从 modelRaw 抽到的疑似 id（小写、取 `>` 前主名或首个 token） */
  modelKeys: string[];
  /** 阶梯/范围列，如 0<Token≤256K */
  tierRaw: string;
  inputYuanPerMillion: number;
  outputYuanPerMillion: number;
  /** 1-based 行号（便于人工打开 price.md 核对） */
  sourceLine: number;
};

export type PriceMdChinaExtractMeta = {
  generatedAt: string;
  sourceRelativePath: string;
  sourceSha256: string;
  rowCount: number;
  warnings: string[];
};

export type PriceMdChinaExtract = {
  meta: PriceMdChinaExtractMeta;
  rows: PriceMdChinaTokenRow[];
};

/** 未来：用户上传价目表解析后的统一结构（与 extract 行对齐字段，便于合并）。 */
export type PriceSheetImportRow = {
  region: "china_mainland";
  modelKey: string;
  modelLabel?: string;
  tierRaw?: string;
  inputYuanPerMillion: number;
  outputYuanPerMillion: number;
  sourceFileName: string;
  importedAt: string;
};

/** 未来：上传价目解析结果。 */
export type PriceSheetImportResult =
  | { ok: true; rows: PriceSheetImportRow[]; warnings: string[] }
  | { ok: false; error: string };
