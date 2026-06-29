/** Dock / 画布 @ 引用 token 解析（纯函数，供单测与 run 链路共用） */

const TOKEN_RE = /@<([^>\s]+)>/g;

export function parseReferencedIds(value: string): string[] {
  const seen: Record<string, boolean> = {};
  const out: string[] = [];
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(value)) !== null) {
    if (m[1] && !seen[m[1]]) {
      seen[m[1]] = true;
      out.push(m[1]);
    }
  }
  return out;
}
