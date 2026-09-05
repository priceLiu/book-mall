import { createHash, randomBytes } from "crypto";
import type { ClientDeviceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { issueToolsAccessTokenForUser } from "@/lib/issue-tools-access-token-for-user";

export const CLIENT_REFRESH_TTL_DAYS = 90;

export function hashRefreshToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

export function parseClientDeviceType(raw: unknown): ClientDeviceType | null {
  if (raw === "WEB" || raw === "EXTENSION" || raw === "DESKTOP") return raw;
  return null;
}

/** 同类型设备再登录：吊销旧设备并 bump 该类型的 sessionVersion */
export async function bumpDeviceSessionVersion(
  userId: string,
  deviceType: ClientDeviceType,
): Promise<number> {
  const now = new Date();
  await prisma.clientDevice.updateMany({
    where: {
      userId,
      deviceType,
      revokedAt: null,
    },
    data: { revokedAt: now },
  });

  const row = await prisma.userDeviceSessionVersion.upsert({
    where: { userId_deviceType: { userId, deviceType } },
    create: { userId, deviceType, sessionVersion: 1 },
    update: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  return row.sessionVersion;
}

export async function getDeviceSessionVersion(
  userId: string,
  deviceType: ClientDeviceType,
): Promise<number> {
  const row = await prisma.userDeviceSessionVersion.findUnique({
    where: { userId_deviceType: { userId, deviceType } },
    select: { sessionVersion: true },
  });
  return row?.sessionVersion ?? 0;
}

export type ClientSessionIssued = {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  deviceId: string;
  userId: string;
};

export async function issueClientSession(input: {
  userId: string;
  deviceType: ClientDeviceType;
  deviceName?: string | null;
  userAgent?: string | null;
}): Promise<ClientSessionIssued | { ok: false; error: string; status: number }> {
  const sessionVersion = await bumpDeviceSessionVersion(input.userId, input.deviceType);
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const now = new Date();
  const expiresAt = addDays(now, CLIENT_REFRESH_TTL_DAYS);

  const device = await prisma.clientDevice.create({
    data: {
      userId: input.userId,
      deviceType: input.deviceType,
      deviceName: input.deviceName?.trim() || null,
      refreshTokenHash,
      expiresAt,
      lastSeenAt: now,
      sessionVersion,
      userAgent: input.userAgent?.trim() || null,
    },
  });

  const issued = await issueToolsAccessTokenForUser(input.userId, {
    deviceContext: {
      deviceType: input.deviceType,
      deviceId: device.id,
      deviceSessionVersion: sessionVersion,
    },
  });

  if (!issued.ok) {
    await prisma.clientDevice.update({
      where: { id: device.id },
      data: { revokedAt: now },
    });
    return { ok: false, error: issued.error, status: issued.status };
  }

  return {
    accessToken: issued.accessToken,
    expiresIn: issued.expiresIn,
    refreshToken,
    deviceId: device.id,
    userId: input.userId,
  };
}

export async function refreshClientSession(refreshTokenRaw: string): Promise<
  | ClientSessionIssued
  | { ok: false; error: string; status: number; code?: string }
> {
  const hash = hashRefreshToken(refreshTokenRaw.trim());
  const device = await prisma.clientDevice.findUnique({ where: { refreshTokenHash: hash } });
  const now = new Date();

  if (!device || device.revokedAt) {
    return { ok: false, error: "无效或已吊销的设备凭证", status: 401 };
  }
  if (device.expiresAt < now) {
    await prisma.clientDevice.update({
      where: { id: device.id },
      data: { revokedAt: now },
    });
    return { ok: false, error: "设备凭证已过期，请重新登录", status: 401, code: "REFRESH_EXPIRED" };
  }

  const currentSv = await getDeviceSessionVersion(device.userId, device.deviceType);
  if (device.sessionVersion !== currentSv) {
    await prisma.clientDevice.update({
      where: { id: device.id },
      data: { revokedAt: now },
    });
    return {
      ok: false,
      error: "会话已在同类型设备登录，请重新登录",
      status: 401,
      code: "SESSION_REVOKED",
    };
  }

  const newRefresh = generateRefreshToken();
  const newHash = hashRefreshToken(newRefresh);
  const expiresAt = addDays(now, CLIENT_REFRESH_TTL_DAYS);

  await prisma.clientDevice.update({
    where: { id: device.id },
    data: {
      refreshTokenHash: newHash,
      expiresAt,
      lastSeenAt: now,
    },
  });

  const issued = await issueToolsAccessTokenForUser(device.userId, {
    deviceContext: {
      deviceType: device.deviceType,
      deviceId: device.id,
      deviceSessionVersion: device.sessionVersion,
    },
  });

  if (!issued.ok) {
    return { ok: false, error: issued.error, status: issued.status };
  }

  return {
    accessToken: issued.accessToken,
    expiresIn: issued.expiresIn,
    refreshToken: newRefresh,
    deviceId: device.id,
    userId: device.userId,
  };
}

export async function listUserClientDevices(userId: string) {
  return prisma.clientDevice.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: {
      id: true,
      deviceType: true,
      deviceName: true,
      lastSeenAt: true,
      expiresAt: true,
      createdAt: true,
      userAgent: true,
    },
  });
}

export async function revokeUserClientDevice(
  userId: string,
  deviceId: string,
): Promise<boolean> {
  const row = await prisma.clientDevice.findFirst({
    where: { id: deviceId, userId, revokedAt: null },
  });
  if (!row) return false;
  await prisma.clientDevice.update({
    where: { id: deviceId },
    data: { revokedAt: new Date() },
  });
  return true;
}
