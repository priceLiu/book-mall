"use client";

import { Clapperboard, Loader2 } from "lucide-react";

import { EcomAssistantBottomDock } from "@/components/layout/ecom-assistant-bottom-dock";
import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import {
  ECOM_ASSISTANT_BUBBLE_CLASS,
  ECOM_ASSISTANT_MESSAGE_BUBBLE_BASE,
} from "@/lib/ecom-assistant-chat-styles";
import type { FilmPullBottomDockMode } from "@/lib/film-pull-production-workflow";
import { cn } from "@/lib/utils";

type IdleThreadProps = {
  mode: FilmPullBottomDockMode;
  welcome: string;
};

export function FilmPullReplicaIdleThread({ mode, welcome }: IdleThreadProps) {
  return (
    <section className="space-y-3" aria-label="复刻引导">
      <div className="flex w-full justify-start">
        <div className={cn(ECOM_ASSISTANT_MESSAGE_BUBBLE_BASE, ECOM_ASSISTANT_BUBBLE_CLASS)}>
          <p className="whitespace-pre-wrap leading-relaxed">{welcome}</p>
        </div>
      </div>
    </section>
  );
}

type IdleComposerProps = {
  mode: FilmPullBottomDockMode;
  busy?: boolean;
  hint: string;
  onStartReplica?: () => void | Promise<void>;
};

export function FilmPullReplicaIdleComposer({ mode, busy, hint, onStartReplica }: IdleComposerProps) {
  return (
    <EcomAssistantBottomDock
      composer={
        <div className="flex min-h-[2.25rem] flex-1 items-center gap-3">
          <p className="min-w-0 flex-1 truncate text-sm text-[#86868b]">{hint}</p>
          {mode === "ready" && onStartReplica ? (
            <EcomButtonPrimary type="button" size="sm" className="shrink-0" disabled={busy} onClick={() => void onStartReplica()}>
              {busy ? (
                <>
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  准备中…
                </>
              ) : (
                <>
                  <Clapperboard className="mr-1 h-3.5 w-3.5" />
                  一键复刻
                </>
              )}
            </EcomButtonPrimary>
          ) : null}
        </div>
      }
    />
  );
}
