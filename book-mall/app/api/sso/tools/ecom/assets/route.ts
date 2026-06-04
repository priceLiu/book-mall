import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";
import { deleteManagedOssObjectByUrl } from "@/lib/oss-delete-object";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const url = new URL(req.url);
  const module = url.searchParams.get("module")?.trim();
  const items = await prisma.ecomAsset.findMany({
    where: {
      userId: auth.userId,
      ...(module ? { module } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ items });
}

export async function DELETE(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }
  const row = await prisma.ecomAsset.findFirst({
    where: { id, userId: auth.userId },
  });
  if (!row) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }
  await deleteManagedOssObjectByUrl(row.ossUrl).catch(() => undefined);
  if (row.thumbnailUrl && row.thumbnailUrl !== row.ossUrl) {
    await deleteManagedOssObjectByUrl(row.thumbnailUrl).catch(() => undefined);
  }
  await prisma.ecomAsset.delete({ where: { id: row.id } });
  return NextResponse.json({ ok: true });
}
