"use client";

import { useEffect, useState } from "react";

import { ModelManager } from "./model-manager";
import type { CatalogGroup, CredentialRow, ModelTab } from "./types";

type CatalogResponse = {
  groups: CatalogGroup[];
  totalCount: number;
  boundKinds: string[];
  tabs?: Record<ModelTab, CatalogGroup[]>;
};

type CredentialsResponse = {
  credentials: CredentialRow[];
  platformPoolDelegate?: { canonicalOwnerEmail: string } | null;
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      catalog: CatalogResponse;
      credentials: CredentialRow[];
      platformPoolDelegate: CredentialsResponse["platformPoolDelegate"];
    };

async function fetchJson<T>(path: string): Promise<{ ok: boolean; data: T | null; error?: string }> {
  try {
    const res = await fetch(path, { credentials: "include", cache: "no-store" });
    const data = (await res.json().catch(() => null)) as T | null;
    if (!res.ok) {
      return {
        ok: false,
        data: null,
        error:
          (data as { error?: string } | null)?.error ??
          `请求失败（HTTP ${res.status}）`,
      };
    }
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      data: null,
      error: e instanceof Error ? e.message : "网络错误",
    };
  }
}

function ModelsPageSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 w-72 rounded-lg bg-white/5" />
      <div className="h-10 w-full max-w-md rounded-lg bg-white/5" />
      <div className="h-11 w-full max-w-xl rounded-lg bg-white/5" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="gw-card h-36 bg-white/[0.02]" />
        ))}
      </div>
    </div>
  );
}

export function ModelsPageClient() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [catalogRes, credRes] = await Promise.all([
        fetchJson<CatalogResponse>("/api/book-mall/api/gateway/models"),
        fetchJson<CredentialsResponse>("/api/book-mall/api/gateway/credentials"),
      ]);

      if (cancelled) return;

      if (!catalogRes.ok || !catalogRes.data) {
        setState({
          status: "error",
          message: catalogRes.error ?? "无法加载模型目录",
        });
        return;
      }

      setState({
        status: "ready",
        catalog: catalogRes.data,
        credentials: credRes.data?.credentials ?? [],
        platformPoolDelegate: credRes.data?.platformPoolDelegate ?? null,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return <ModelsPageSkeleton />;
  }

  if (state.status === "error") {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-6 text-sm text-red-200">
        <p className="font-medium">模型目录加载失败</p>
        <p className="mt-2 text-red-200/80">{state.message}</p>
        <button
          type="button"
          className="gw-btn-secondary mt-4"
          onClick={() => window.location.reload()}
        >
          重试
        </button>
      </div>
    );
  }

  const tabGroups: Record<ModelTab, CatalogGroup[]> = state.catalog.tabs ?? {
    text: state.catalog.groups ?? [],
    image: [],
    video: [],
    function: [],
  };

  return (
    <>
      {state.platformPoolDelegate ? (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-[var(--gw-accent)]">
          正在代管平台共用凭证池（canonical:{" "}
          <span className="font-mono text-xs">
            {state.platformPoolDelegate.canonicalOwnerEmail}
          </span>
          ）。此处增删改会直接影响平台代付用户的 AI 调用。
        </div>
      ) : null}

      <ModelManager
        initialGroups={state.catalog.groups ?? []}
        initialCredentials={state.credentials}
        tabGroups={tabGroups}
      />
    </>
  );
}
