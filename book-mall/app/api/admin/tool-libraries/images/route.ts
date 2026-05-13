import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteManagedOssObjectByUrl } from "@/lib/oss-delete-object";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireAdmin(): Promise<
  | { ok: true }
  | { ok: false; res: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return {
      ok: false,
      res: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  return { ok: true };
}

export async function GET() {
  const a = await requireAdmin();
  if (!a.ok) return a.res;

  try {
    const rows = await prisma.textToImageLibraryItem.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        userEmail: r.user.email,
        userName: r.user.name,
        imageUrl: r.imageUrl,
        prompt: r.prompt,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("[admin/tool-libraries/images] GET", e);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const a = await requireAdmin();
  if (!a.ok) return a.res;

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  try {
    const row = await prisma.textToImageLibraryItem.findUnique({
      where: { id },
      select: { id: true, imageUrl: true },
    });
    if (!row) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const oss = await deleteManagedOssObjectByUrl(row.imageUrl);
    if (!oss.ok) {
      return NextResponse.json({ error: oss.error }, { status: 502 });
    }

    await prisma.textToImageLibraryItem.delete({ where: { id: row.id } });
    return NextResponse.json({ ok: true, ossDeleted: oss.deleted });
  } catch (e) {
    console.error("[admin/tool-libraries/images] DELETE", e);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}
