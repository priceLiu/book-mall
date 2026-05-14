import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseCanonicalPricingCsv } from "@/lib/pricing/canonical-csv";
import { parsePriceMdChinaMainlandTokenTables } from "@/lib/pricing/price-md-china-parser";
import {
  createPricingVersionAndSetCurrent,
  loadCurrentPricingDrafts,
  mergeCsvImportIntoCurrent,
  mergeMarkdownTokenImport,
  tokenRowsToDraftRows,
} from "@/lib/pricing/pricing-import-service";

export const dynamic = "force-dynamic";

/**
 * ADMIN：multipart `kind` = markdown | csv，`file` = 价目正文。
 * CSV 须为可解析的规范列（见 `lib/pricing/canonical-csv.ts`），否则 400 并提示 normalize 脚本。
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json({ error: "须 multipart/form-data（kind + file）" }, { status: 400 });
  }

  const form = await req.formData();
  const kind = String(form.get("kind") ?? "");
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少 file" }, { status: 400 });
  }

  const text = await file.text();
  const userId = session.user.id;
  const label = `upload:${file.name || "untitled"}`;

  if (kind === "markdown") {
    const extracted = parsePriceMdChinaMainlandTokenTables(text, {
      sourceRelativePath: file.name || "upload.md",
    });
    const tokenDrafts = tokenRowsToDraftRows(extracted.rows);
    const prev = await loadCurrentPricingDrafts(prisma);
    if (prev.length === 0) {
      return NextResponse.json(
        {
          error:
            "库中无价目版本；请先在 book-mall 运行 pnpm pricing:bootstrap（见 tool-web 文档 learning-pricing-solution.md §5.7）",
        },
        { status: 409 },
      );
    }
    const merged = mergeMarkdownTokenImport(tokenDrafts, prev);
    const { versionId } = await createPricingVersionAndSetCurrent(prisma, {
      kind: "markdown_upload",
      sourceSha256: extracted.meta.sourceSha256,
      label,
      importedByUserId: userId,
      parseWarnings: extracted.meta.warnings,
      lines: merged,
    });
    return NextResponse.json({
      versionId,
      rowCount: merged.length,
      warnings: extracted.meta.warnings,
    });
  }

  if (kind === "csv") {
    const parsed = parseCanonicalPricingCsv(text);
    if (!parsed.ok) {
      return NextResponse.json(
        {
          error: parsed.error,
          hint: "可执行: cd book-mall && pnpm pricing:normalize-upload-csv -- <in.csv> [out.csv] 生成规范列序后再导入",
        },
        { status: 400 },
      );
    }
    const prev = await loadCurrentPricingDrafts(prisma);
    if (prev.length === 0) {
      return NextResponse.json(
        {
          error:
            "库中无价目版本；请先 pnpm pricing:bootstrap（见 learning-pricing-solution.md §5.7）",
        },
        { status: 409 },
      );
    }
    const merged = mergeCsvImportIntoCurrent(prev, parsed.rows);
    const sha = createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
    const { versionId } = await createPricingVersionAndSetCurrent(prisma, {
      kind: "csv_upload",
      sourceSha256: sha,
      label,
      importedByUserId: userId,
      lines: merged,
    });
    return NextResponse.json({ versionId, rowCount: merged.length });
  }

  return NextResponse.json({ error: "kind 须为 markdown 或 csv" }, { status: 400 });
}
