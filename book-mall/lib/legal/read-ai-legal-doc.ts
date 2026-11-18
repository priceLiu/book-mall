import fs from "node:fs/promises";
import path from "node:path";

import {
  AI_LEGAL_DOC_BY_SLUG,
  type AiLegalDocSlug,
} from "@/lib/legal/ai-legal-catalog";

export async function readAiLegalMarkdown(slug: AiLegalDocSlug): Promise<string> {
  const meta = AI_LEGAL_DOC_BY_SLUG[slug];
  const filePath = path.join(process.cwd(), "content", "ai-legal", meta.fileName);
  return fs.readFile(filePath, "utf8");
}