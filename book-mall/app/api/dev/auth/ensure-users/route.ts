import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import {
  allowDevMockAuth,
  DEV_AUTH_PASSWORD,
  DEV_AUTH_PHONES,
} from "@/lib/dev-mock-auth";
import { deriveEcomBillingMode } from "@/lib/billing/billing-persona";
import { prisma } from "@/lib/prisma";
import { createTeamTenant } from "@/lib/tenant/tenant-service";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!allowDevMockAuth()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const passwordHash = await bcrypt.hash(DEV_AUTH_PASSWORD, 10);

  async function upsertDevUser(input: {
    phone: string;
    name: string;
    role?: "USER" | "ADMIN";
    billingPersona?: "PLATFORM_CREDIT" | "BYOK";
  }) {
    const verifiedAt = new Date();
    const user = await prisma.user.upsert({
      where: { phone: input.phone },
      create: {
        phone: input.phone,
        phoneVerifiedAt: verifiedAt,
        passwordHash,
        name: input.name,
        role: input.role ?? "USER",
        billingPersona: input.billingPersona ?? "PLATFORM_CREDIT",
        billingPersonaLockedAt: verifiedAt,
        ecomBillingMode: deriveEcomBillingMode(input.billingPersona ?? "PLATFORM_CREDIT"),
      },
      update: {
        phoneVerifiedAt: verifiedAt,
        passwordHash,
        name: input.name,
        ...(input.role ? { role: input.role } : {}),
      },
    });
    await prisma.wallet.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
    return user;
  }

  const personal = await upsertDevUser({
    phone: DEV_AUTH_PHONES.personal,
    name: "Dev 个人",
  });

  const owner = await upsertDevUser({
    phone: DEV_AUTH_PHONES.team_owner,
    name: "Dev 团队 Owner",
  });

  await upsertDevUser({
    phone: DEV_AUTH_PHONES.team_member,
    name: "Dev 团队成员",
  });

  await upsertDevUser({
    phone: DEV_AUTH_PHONES.admin,
    name: "Dev 管理员",
    role: "ADMIN",
  });

  const existingTeam = await prisma.tenantMember.findFirst({
    where: {
      userId: owner.id,
      role: "OWNER",
      tenant: { type: "TEAM", status: "ACTIVE" },
    },
  });

  if (!existingTeam) {
    const tenant = await createTeamTenant({
      ownerUserId: owner.id,
      name: "Dev 测试团队",
      seatLimit: 5,
    });
    const memberUser = await prisma.user.findUnique({
      where: { phone: DEV_AUTH_PHONES.team_member },
    });
    if (memberUser) {
      await prisma.tenantMember.upsert({
        where: {
          tenantId_userId: { tenantId: tenant.id, userId: memberUser.id },
        },
        create: {
          tenantId: tenant.id,
          userId: memberUser.id,
          role: "MEMBER",
          status: "ACTIVE",
        },
        update: { status: "ACTIVE", role: "MEMBER" },
      });
    }
  }

  await prisma.user.update({
    where: { id: personal.id },
    data: { primaryTenantId: personal.primaryTenantId },
  });

  return NextResponse.json({ ok: true });
}
