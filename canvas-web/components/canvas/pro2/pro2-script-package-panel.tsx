"use client";

import { useMemo, useState } from "react";
import { Copy, Package } from "lucide-react";
import {
  CREW_PRODUCTION_PHASE_LABELS,
  CREW_PRODUCTION_PHASE_ORDER,
  type CrewProductionPhaseId,
} from "@/lib/canvas/crew-bulletin-phases";
import type { CrewTaskKind } from "@/lib/canvas/crew-bulletin-types";
import { canvasNotify } from "@/lib/canvas/canvas-notify";
import {
  scriptPackageSnapshotKindLabel,
  spawnScriptPackageSnapshotOnCanvas,
  type ScriptPackageSnapshot,
  type ScriptPackageSnapshotsByKind,
} from "@/lib/canvas/script-package-snapshots";
import { cn } from "@/lib/utils";

const SNAPSHOT_KIND_ORDER: CrewTaskKind[] = CREW_PRODUCTION_PHASE_ORDER.filter(
  (id): id is CrewTaskKind => id !== "script" && id !== "scriptPackage",
);

function phaseLabelForKind(kind: CrewTaskKind): string {
  const phaseId = kind as CrewProductionPhaseId;
  return CREW_PRODUCTION_PHASE_LABELS[phaseId] ?? scriptPackageSnapshotKindLabel(kind);
}

type ScriptPackagePanelProps = {
  snapshots: ScriptPackageSnapshotsByKind;
  scriptTitle?: string;
  contentScale?: number;
  fullscreen?: boolean;
  hubNodeId?: string;
  onCopySnapshot: (snapshot: ScriptPackageSnapshot) => void;
};

function SnapshotCard({
  snapshot,
  versions,
  onCopy,
}: {
  snapshot: ScriptPackageSnapshot;
  versions?: ScriptPackageSnapshot[];
  onCopy: (snapshot: ScriptPackageSnapshot) => void;
}) {
  const [versionId, setVersionId] = useState(snapshot.id);
  const active =
    versions?.find((v) => v.id === versionId) ?? snapshot;
  const mediaUrl = active.previewUrl ?? active.videoUrl;
  const isVideo = Boolean(active.videoUrl && !active.previewUrl);
  const versionOptions = versions ?? [snapshot];

  return (
    <div className="flex gap-2 rounded-lg border border-black/35 bg-black/20 p-2">
      <div className="size-14 shrink-0 overflow-hidden rounded-md border border-black/30 bg-black/30">
        {mediaUrl ? (
          isVideo ? (
            <video
              src={mediaUrl}
              className="size-full object-cover"
              muted
              playsInline
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt="" className="size-full object-cover" />
          )
        ) : (
          <div className="grid size-full place-items-center text-[9px] text-white/35">
            无预览
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium text-white/85">
          {active.label}
        </p>
        <p className="text-[10px] text-white/45">
          {active.assigneeDisplayName ?? "—"}
          {active.episodeNo != null ? ` · 第 ${active.episodeNo} 集` : ""}
        </p>
        <p className="text-[9px] text-white/30">
          {new Date(active.completedAt).toLocaleString()}
          {active.supersededAt ? " · 历史版本" : ""}
        </p>
        {versionOptions.length > 1 ? (
          <select
            value={versionId}
            onChange={(e) => setVersionId(e.target.value)}
            className="mt-1 max-w-full rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[9px] text-white/70"
          >
            {versionOptions.map((v, i) => (
              <option key={v.id} value={v.id}>
                版本 {versionOptions.length - i}
                {v.supersededAt ? "（已取代）" : "（当前）"}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <button
        type="button"
        title="复制到画布"
        className="inline-flex h-8 shrink-0 items-center gap-1 self-start rounded-md border border-black/40 bg-black/25 px-2 text-[10px] text-white/80 transition hover:bg-black/35"
        onClick={() => {
          const picked =
            versions?.find((v) => v.id === versionId) ?? snapshot;
          onCopy(picked);
        }}
      >
        <Copy className="size-3" />
        复制
      </button>
    </div>
  );
}

export function Pro2ScriptPackagePanel({
  snapshots,
  scriptTitle,
  contentScale = 1,
  fullscreen = false,
  hubNodeId,
  onCopySnapshot,
}: ScriptPackagePanelProps) {
  const groupedByKind = useMemo(() => {
    const out: Partial<
      Record<CrewTaskKind, { taskId: string; versions: ScriptPackageSnapshot[] }[]>
    > = {};
    for (const kind of SNAPSHOT_KIND_ORDER) {
      const list = snapshots[kind];
      if (!list?.length) continue;
      const byTask = new Map<string, ScriptPackageSnapshot[]>();
      for (const s of list) {
        const arr = byTask.get(s.taskId) ?? [];
        arr.push(s);
        byTask.set(s.taskId, arr);
      }
      out[kind] = Array.from(byTask.entries()).map(([taskId, versions]) => ({
        taskId,
        versions: versions.sort(
          (a, b) =>
            new Date(b.completedAt).getTime() -
            new Date(a.completedAt).getTime(),
        ),
      }));
    }
    return out;
  }, [snapshots]);

  const total = SNAPSHOT_KIND_ORDER.reduce(
    (n, kind) => n + (groupedByKind[kind]?.length ?? 0),
    0,
  );

  return (
    <div
      className={cn(
        "overflow-y-auto overflow-x-auto bg-black/15 px-3 py-2",
        fullscreen ? "min-h-0 flex-1" : "max-h-[min(70vh,520px)]",
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <Package className="size-3.5 text-cyan-300/80" />
        <p className="text-[11px] font-medium text-white/85">
          {scriptTitle ? `${scriptTitle} · 剧本包` : "剧本包"}
        </p>
        <span className="text-[10px] text-white/40">{total} 项快照</span>
      </div>
      <p className="mb-3 text-[10px] leading-relaxed text-white/40">
        剧组点击「完成制作」后，产出按运行栏分类归档到当前剧本的剧本包；可复制到画布继续调整。
      </p>

      {total === 0 ? (
        <p className="text-[10px] text-white/40">
          暂无完成快照。领取任务并在节点顶栏提交「完成制作」后会自动出现在此处。
        </p>
      ) : (
        <div
          className="space-y-4"
          style={{ fontSize: `${Math.round(11 * contentScale)}px` }}
        >
          {SNAPSHOT_KIND_ORDER.map((kind) => {
            const groups = groupedByKind[kind];
            if (!groups?.length) return null;
            return (
              <section key={kind}>
                <h3 className="mb-1.5 text-[10px] font-medium text-cyan-200/80">
                  {phaseLabelForKind(kind)}
                  <span className="ml-1 font-normal text-white/35">
                    ({groups.length})
                  </span>
                </h3>
                <div className="space-y-1.5">
                  {groups.map(({ taskId, versions }) => {
                    const latest = versions[0]!;
                    return (
                      <SnapshotCard
                        key={taskId}
                        snapshot={latest}
                        versions={versions}
                        onCopy={(picked) => onCopySnapshot(picked)}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function useCopyScriptPackageSnapshot(args: {
  hubNodeId?: string;
  duplicateNode: (
    id: string,
    options?: { preserveContent?: boolean },
  ) => string | null;
  addNode: (
    type: string,
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  setNodes: (fn: (nodes: import("@/lib/canvas/types").CanvasFlowNode[]) => import("@/lib/canvas/types").CanvasFlowNode[]) => void;
  nodes: import("@/lib/canvas/types").CanvasFlowNode[];
}) {
  return (snapshot: ScriptPackageSnapshot) => {
    const newId = spawnScriptPackageSnapshotOnCanvas(snapshot, args, {
      hubNodeId: args.hubNodeId,
    });
    if (newId) {
      void canvasNotify({
        title: "已复制",
        message: "快照已复制到画布",
        variant: "info",
      });
    } else {
      void canvasNotify({
        title: "无法复制",
        message: "源节点已删除且缺少可还原的数据快照",
        variant: "error",
      });
    }
  };
}
