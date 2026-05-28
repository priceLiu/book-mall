"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") throw new Error("无权限");
}

export async function createSsoClientAction(formData: FormData) {
  await requireAdmin();
  const clientId = (formData.get("clientId") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  const redirectUrisRaw = (formData.get("redirectUris") as string)?.trim() ?? "";
  const navKeysRaw = (formData.get("allowedNavKeys") as string)?.trim() ?? "";

  if (!clientId || !name) throw new Error("clientId 与名称必填");

  const redirectUris = redirectUrisRaw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (redirectUris.length === 0) throw new Error("至少一条 redirect URI");

  const allowedNavKeys = navKeysRaw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  await prisma.ssoClient.create({
    data: { clientId, name, redirectUris, allowedNavKeys },
  });
  revalidatePath("/admin/sso-clients");
}

export async function toggleSsoClientAction(formData: FormData) {
  await requireAdmin();
  const id = (formData.get("id") as string)?.trim();
  const active = formData.get("active") === "true";
  if (!id) throw new Error("缺少 id");
  await prisma.ssoClient.update({ where: { id }, data: { active } });
  revalidatePath("/admin/sso-clients");
}
