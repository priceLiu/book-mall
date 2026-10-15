import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  KNOWLEDGE_ALLOWLIST,
  KNOWLEDGE_ALLOWLIST_PATHS,
} from "@/lib/platform-assistant/knowledge-allowlist";

const REPO_ROOT = path.resolve(process.cwd(), "..");

describe("KNOWLEDGE_ALLOWLIST paths", () => {
  it("has unique paths", () => {
    expect(KNOWLEDGE_ALLOWLIST_PATHS.length).toBe(KNOWLEDGE_ALLOWLIST.length);
  });

  it("every allowlisted file exists on disk", () => {
    const missing: string[] = [];
    for (const src of KNOWLEDGE_ALLOWLIST) {
      const abs = path.join(REPO_ROOT, src.path);
      if (!existsSync(abs)) missing.push(src.path);
    }
    expect(missing, `missing files:\n${missing.join("\n")}`).toEqual([]);
  });
});
