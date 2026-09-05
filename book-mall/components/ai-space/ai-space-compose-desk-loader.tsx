"use client";

/**
 * 合成台选材加载器
 *
 * 选材列表改为客户端拉取（见 lib/ai-space/ai-space-compose-desk-data.ts 注释）：
 * 切到「合成台」tab 立刻出骨架，选材慢或数据库抖动只影响这块区域并可原地重试，
 * 不再出现整页卡住 / 报错的「打不开」。
 */

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { AiSpaceComposeDeskData } from "@/lib/ai-space/ai-space-compose-desk-data";

import { AiSpaceComposeDesk } from "./ai-space-compose-desk";

const OPTIONS_API = "/api/platform/v1/ai-space/compose-options";

export function AiSpaceComposeDeskLoader() {
  const [data, setData] = useState<AiSpaceComposeDeskData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(OPTIONS_API, { credentials: "include" });
      const body = (await res.json().catch(() => ({}))) as
        | (AiSpaceComposeDeskData & { error?: string })
        | { error?: string };
      if (!res.ok) throw new Error(("error" in body && body.error) || "读取选材失败");
      setData(body as AiSpaceComposeDeskData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "读取选材失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (data) {
    return (
      <AiSpaceComposeDesk
        digitalHumans={data.digitalHumans}
        audioAssets={data.audioAssets}
        backgrounds={data.backgrounds}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[#d0d7de] bg-white p-6 text-sm text-[#656d76]">
        <Loader2 className="h-4 w-4 animate-spin" />
        正在读取形象、口播音频与背景视频…
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-[#d0d7de] bg-white p-6">
      <p className="text-sm font-medium text-[#1f2328]">选材没读出来</p>
      <p className="text-sm text-[#656d76]">{error}</p>
      <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
        重新读取
      </Button>
    </div>
  );
}
