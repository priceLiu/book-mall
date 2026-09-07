import { listBuiltinTemplates } from "@/lib/load-builtin-templates";
import { QR_HOME_CARD_CATEGORIES } from "@/lib/qr-home-feed";
import type { QrCategory } from "@/lib/qr-template-types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category") as QrCategory | null;
  const kind = url.searchParams.get("kind");
  const toolKey = url.searchParams.get("toolKey");

  if (url.searchParams.get("homeFeed") === "1") {
    const templatesByCategory = Object.fromEntries(
      QR_HOME_CARD_CATEGORIES.map((cat) => [
        cat,
        listBuiltinTemplates({ category: cat }),
      ]),
    );
    return Response.json({ templatesByCategory, homeFeed: true });
  }

  const templates = listBuiltinTemplates({ category, kind, toolKey });
  return Response.json({ templates });
}
