import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** 工具站服务端拉取左侧菜单可见性；无需登录。 */
export async function GET() {
  try {
    const rows = await prisma.toolNavVisibility.findMany({
      orderBy: { sortOrder: "asc" },
      select: { navKey: true, label: true, visible: true },
    });
    return NextResponse.json({ entries: rows });
  } catch (e) {
    console.error("[nav-visibility]", e);
    return NextResponse.json(
      { error: "nav_visibility_unavailable", entries: [] },
      { status: 503 },
    );
  }
}
