"use client";

import { useEffect, useMemo, useState } from "react";

import { AccountShell } from "@/components/account/account-shell";
import { buildAccountAppsMenuHint } from "@/lib/account-apps-menu-hint";
import type { BillingPersona } from "@prisma/client";

type ShellMeta = {
  hasMembership: boolean;
  canvasLaunch: { gatewayLinked: boolean; canvasOriginConfigured: boolean };
  ecomAccess: boolean;
  referralEligibility: { eligible: boolean; planLabel: string | null; reason: string | null };
};

type EnvConfig = {
  toolsSsoReady: boolean;
  ecomOriginConfigured: boolean;
  quickReplicaOriginConfigured: boolean;
  commonToolsOriginConfigured: boolean;
  publisherOriginConfigured: boolean;
};

type Props = {
  profile: { image: string | null; name: string | null; phone: string | null };
  isAdmin: boolean;
  billingPersona: BillingPersona | null;
  env: EnvConfig;
  children: React.ReactNode;
};

export function AccountShellLoader({
  profile,
  isAdmin,
  billingPersona,
  env,
  children,
}: Props) {
  const [meta, setMeta] = useState<ShellMeta | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/shell-meta", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as ShellMeta;
      })
      .then((data) => {
        if (!cancelled && data) setMeta(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const hasMembership = meta?.hasMembership ?? false;
  const gatewayLinked =
    meta?.canvasLaunch.gatewayLinked ?? billingPersona === "PLATFORM_CREDIT";
  const canvasOriginConfigured = meta?.canvasLaunch.canvasOriginConfigured ?? false;
  const ecomAccess = meta?.ecomAccess ?? false;
  const showReferral = meta?.referralEligibility.eligible ?? false;

  const canLaunchTools = env.toolsSsoReady && (isAdmin || hasMembership);
  const canLaunchCanvas = canLaunchTools;
  const canLaunchEcommerce = env.toolsSsoReady && ecomAccess;
  const canLaunchQuickReplica = canLaunchTools;
  const canLaunchCommonTools = canLaunchTools;

  const appsMenuHint = useMemo(
    () =>
      meta
        ? buildAccountAppsMenuHint({
            toolsSsoReady: env.toolsSsoReady,
            hasToolService: hasMembership,
            gatewayLinked,
            canvasOriginConfigured,
            canLaunchCanvas,
            ecomAccess,
            ecomOriginConfigured: env.ecomOriginConfigured,
            quickReplicaOriginConfigured: env.quickReplicaOriginConfigured,
            canLaunchQuickReplica,
            commonToolsOriginConfigured: env.commonToolsOriginConfigured,
            canLaunchCommonTools,
            isAdmin,
            billingPersona,
          })
        : null,
    [
      meta,
      env,
      hasMembership,
      gatewayLinked,
      canvasOriginConfigured,
      canLaunchCanvas,
      ecomAccess,
      canLaunchQuickReplica,
      canLaunchCommonTools,
      isAdmin,
      billingPersona,
    ],
  );

  return (
    <AccountShell
      profile={profile}
      isAdmin={isAdmin}
      showToolsCta={env.toolsSsoReady}
      canLaunchTools={canLaunchTools}
      canLaunchCanvas={canLaunchCanvas}
      canvasOriginConfigured={canvasOriginConfigured}
      gatewayLinked={gatewayLinked}
      canLaunchEcommerce={canLaunchEcommerce}
      ecomOriginConfigured={env.ecomOriginConfigured}
      canLaunchQuickReplica={canLaunchQuickReplica}
      quickReplicaOriginConfigured={env.quickReplicaOriginConfigured}
      canLaunchCommonTools={canLaunchCommonTools}
      commonToolsOriginConfigured={env.commonToolsOriginConfigured}
      publisherOriginConfigured={env.publisherOriginConfigured}
      appsMenuHint={appsMenuHint}
      billingPersona={billingPersona}
      showReferral={showReferral}
    >
      {children}
    </AccountShell>
  );
}
