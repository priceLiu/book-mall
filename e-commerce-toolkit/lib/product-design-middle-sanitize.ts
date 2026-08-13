/**
 * 中间工作区 Markdown 展示净化：去掉思考过程、交互引导、与 Section 重复的步骤标题，只保留结论。
 */

function normalizeSectionKey(line: string): string {
  return line
    .replace(/^#+\s*/, "")
    .replace(/\*\*/g, "")
    .trim()
    .toLowerCase();
}

function isStepTitleLine(t: string, stepNo?: number): boolean {
  if (/^#{1,4}\s*(?:Step\s*\d+|步骤\s*\d+)/i.test(t)) return true;
  if (/^Step\s*\d+\s*[|·:：\|]/i.test(t)) return true;
  if (stepNo != null && new RegExp(`^#{0,4}\\s*Step\\s*${stepNo}\\b`, "i").test(t)) return true;
  return false;
}

function isInteractiveLine(t: string): boolean {
  if (!t.trim()) return false;
  return (
    /请点击|点\s*【|请点\s*界面|确认后点|继续至\s*Step|界面按钮|界面会渲染|不要在中间工作区/i.test(t) ||
    /已同步到中间工作区|本步结构化内容已同步|可直接编辑.*下一步|与会话区同源解析/i.test(t) ||
    /^\*{0,2}重新生成\*{0,2}\s*$|^已完成\s*$/.test(t)
  );
}

function isReasoningIntroLine(t: string): boolean {
  if (!t.trim() || t.startsWith("|") || /^#{1,4}\s*\d+\./.test(t)) return false;
  return (
    /^基于您选定|^基于以上|^在对产品|^我们将产品|^这套逻辑|^接下来我会|^已选定【方案|^为强化产品|^我们为您|^我们已为您|^我们根据|^在此方案下|^结合选定的|^基于以上营销方案|^以强化产品的市场竞争力/i.test(
      t,
    ) ||
    /^💡|^🧠|^>\s*思考|^>\s*分析/i.test(t)
  );
}

function isResultStartLine(t: string): boolean {
  return (
    t.startsWith("|") ||
    /^#{1,4}\s*\d+\./.test(t) ||
    /^#{1,4}\s*(?:方案总结|卖点转化|主图分层|详情页|购买理由矩阵)/i.test(t)
  );
}

function trimLeadingProseBeforeResults(text: string): string {
  const lines = text.split("\n");
  const idx = lines.findIndex((l) => isResultStartLine(l.trim()));
  if (idx <= 0) return text.trim();
  return lines.slice(idx).join("\n").trim();
}

export type SanitizeMiddlePanelOptions = {
  stepNo?: number;
  dropStepTitles?: boolean;
};

export function sanitizeMiddlePanelMarkdown(
  raw: string,
  opts: SanitizeMiddlePanelOptions = {},
): string {
  if (!raw.trim()) return "";

  const dropStepTitles = opts.dropStepTitles !== false;
  const lines = raw.split("\n");
  const kept: string[] = [];
  const seenSectionTitles = new Set<string>();
  let inThinkBlock = false;
  let foundResult = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const t = line.trim();

    if (/^#{1,4}\s*Thinking\b|^<\/?think>|^💡\s*Thinking|^🧠\s*Thinking/i.test(t)) {
      inThinkBlock = true;
      continue;
    }
    if (inThinkBlock) {
      if (/^#{1,4}\s/.test(t) && !/Thinking/i.test(t)) inThinkBlock = false;
      else continue;
    }

    if (dropStepTitles && isStepTitleLine(t, opts.stepNo)) continue;
    if (isInteractiveLine(t)) continue;
    if (/^[-—_*]{3,}\s*$/.test(t)) continue;

    const resultLine = isResultStartLine(t);
    if (!foundResult && isReasoningIntroLine(t) && !resultLine) continue;
    if (resultLine) foundResult = true;

    if (/^#{1,4}\s/.test(t)) {
      const key = normalizeSectionKey(t);
      if (seenSectionTitles.has(key)) continue;
      seenSectionTitles.add(key);
    }

    kept.push(line);
  }

  return trimLeadingProseBeforeResults(kept.join("\n"));
}

export function sanitizeStep3MiddleMarkdown(raw: string): string {
  return sanitizeMiddlePanelMarkdown(raw, { stepNo: 3 });
}
