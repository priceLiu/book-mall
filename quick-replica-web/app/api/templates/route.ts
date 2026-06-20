import { listBuiltinTemplates } from "@/lib/load-builtin-templates";
import type { QrCategory } from "@/lib/qr-template-types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category") as QrCategory | null;
  const kind = url.searchParams.get("kind");
  const toolKey = url.searchParams.get("toolKey");

  const templates = listBuiltinTemplates({ category, kind, toolKey });
  return Response.json({ templates });
}
