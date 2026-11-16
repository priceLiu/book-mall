/** 从 LLM 文本中提取第一个完整 JSON 对象（支持 markdown 围栏、忽略后续说明文字） */
export function extractFirstJsonObjectFromLlmText(
  text: string,
  emptyMessage = "模型未返回有效 JSON",
): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new Error(emptyMessage);

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const bodies = fence?.[1] ? [fence[1].trim(), trimmed] : [trimmed];

  for (const body of bodies) {
    const parsed = tryParseFirstJsonObject(body);
    if (parsed !== undefined) return parsed;
  }

  throw new Error(emptyMessage);
}

function tryParseFirstJsonObject(body: string): unknown | undefined {
  const start = body.indexOf("{");
  if (start < 0) return undefined;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < body.length; i++) {
    const ch = body[i]!;
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(body.slice(start, i + 1));
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}