"use client";

import { useEffect, useState } from "react";
import {
  crewCollaborationAccessFromIntrospect,
  type CrewCollaborationAccess,
} from "@/lib/canvas/crew-collaboration-access";
import { useOptionalCanvasShellSessionContext } from "@/components/auth/canvas-shell-session-provider";
import { fetchCanvasToolsSessionFull } from "@/lib/canvas-tools-session-fetch";
import { getCachedToolsSession } from "@/lib/tools-session-client-cache";

const DEFAULT_ACCESS: CrewCollaborationAccess = {
  isTeamTenant: false,
  isPlatformAdmin: false,
  canUseCrewBulletin: false,
  canPublishScript: false,
  canTeamShareOnPublish: false,
};

function accessFromPayload(introspect: unknown): CrewCollaborationAccess | null {
  if (!introspect || typeof introspect !== "object") return null;
  return crewCollaborationAccessFromIntrospect(
    introspect as Record<string, unknown>,
  );
}

async function fetchCollaborationAccess(
  cachedIntro?: unknown,
): Promise<CrewCollaborationAccess> {
  if (cachedIntro) {
    const fromCache = accessFromPayload(cachedIntro);
    if (fromCache) return fromCache;
  }
  const cached = getCachedToolsSession();
  if (cached?.active && cached.introspect) {
    const fromMem = accessFromPayload(cached.introspect);
    if (fromMem) return fromMem;
  }
  try {
    const parsed = await fetchCanvasToolsSessionFull();
    if (parsed.introspect) {
      return crewCollaborationAccessFromIntrospect(
        parsed.introspect as Record<string, unknown>,
      );
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_ACCESS;
}

/** 客户端 · 剧组协同权限（团队空间 / 发布剧本 / 公告条） */
export function useCrewCollaborationAccess(): CrewCollaborationAccess {
  const shared = useOptionalCanvasShellSessionContext();
  const [access, setAccess] = useState<CrewCollaborationAccess>(() => {
    const intro =
      shared?.payload?.introspect ?? getCachedToolsSession()?.introspect;
    if (intro) {
      return accessFromPayload(intro) ?? DEFAULT_ACCESS;
    }
    return DEFAULT_ACCESS;
  });

  useEffect(() => {
    if (shared?.payload?.introspect) {
      setAccess(accessFromPayload(shared.payload.introspect) ?? DEFAULT_ACCESS);
    }
  }, [shared?.payload?.introspect]);

  useEffect(() => {
    let cancelled = false;
    void fetchCollaborationAccess(shared?.payload?.introspect).then((next) => {
      if (!cancelled) setAccess(next);
    });
    const onRefresh = () => {
      void fetchCollaborationAccess(shared?.payload?.introspect).then((next) => {
        if (!cancelled) setAccess(next);
      });
    };
    window.addEventListener("canvas:tools-session-refreshed", onRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener("canvas:tools-session-refreshed", onRefresh);
    };
  }, [shared?.payload?.introspect]);

  return access;
}
