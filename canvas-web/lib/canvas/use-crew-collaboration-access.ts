"use client";

import { useEffect, useState } from "react";
import {
  crewCollaborationAccessFromIntrospect,
  type CrewCollaborationAccess,
} from "@/lib/canvas/crew-collaboration-access";
import { parseToolsSessionPayload } from "@/lib/parse-tools-session-payload";
import { getCachedToolsSession } from "@/lib/tools-session-client-cache";

const DEFAULT_ACCESS: CrewCollaborationAccess = {
  isTeamTenant: false,
  isPlatformAdmin: false,
  canUseCrewBulletin: false,
  canPublishScript: false,
  canTeamShareOnPublish: false,
};

async function fetchCollaborationAccess(): Promise<CrewCollaborationAccess> {
  const cached = getCachedToolsSession();
  if (cached?.active && cached.introspect) {
    return crewCollaborationAccessFromIntrospect(
      cached.introspect as Record<string, unknown>,
    );
  }
  try {
    const r = await fetch("/api/tools-session", {
      cache: "no-store",
      credentials: "same-origin",
    });
    const raw = await r.json().catch(() => null);
    const parsed = parseToolsSessionPayload(raw);
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
  const [access, setAccess] = useState<CrewCollaborationAccess>(() => {
    const cached = getCachedToolsSession();
    if (cached?.active && cached.introspect) {
      return crewCollaborationAccessFromIntrospect(
        cached.introspect as Record<string, unknown>,
      );
    }
    return DEFAULT_ACCESS;
  });

  useEffect(() => {
    let cancelled = false;
    void fetchCollaborationAccess().then((next) => {
      if (!cancelled) setAccess(next);
    });
    const onRefresh = () => {
      void fetchCollaborationAccess().then((next) => {
        if (!cancelled) setAccess(next);
      });
    };
    window.addEventListener("canvas:tools-session-refreshed", onRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener("canvas:tools-session-refreshed", onRefresh);
    };
  }, []);

  return access;
}
