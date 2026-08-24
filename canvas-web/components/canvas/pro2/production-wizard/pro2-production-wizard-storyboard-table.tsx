"use client";

import { useMemo, useState, type MouseEvent } from "react";
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";
import {
  ensurePro2ProductionScriptSchemaVersion,
  isPro2ProductionScriptV2,
} from "@/lib/canvas/data/pro2-production-script-schema";
import { resolveShotPropNames } from "@/lib/canvas/pro2-production-script-render-md";
import { WizardPromptReadonly } from "@/components/canvas/mentions/wizard-prompt-readonly";
import {
  buildEntityHighlightMatchersForShot,
  formatWizardMentionsForDisplay,
  reconcileShotEntityLinks,
  resolveShotSceneName,
} from "@/lib/canvas/pro2-shot-entity-reconcile";
import {
  buildWizardAssetMentionables,
  entityHighlightClass,
  splitTextByEntityMatchers,
  type EntityHighlightMatcher,
  type Pro2ProductionScriptShot,
} from "@/lib/canvas/pro2-production-wizard-assets";
import { textHasWizardMentionTokens } from "@/lib/canvas/wizard-mention-chrome";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { cn } from "@/lib/utils";
import { Pro2ProductionWizardShotEditModal } from "./pro2-production-wizard-shot-edit-modal";

export type Pro2ProductionWizardStoryboardTableProps = {
  script: Pro2ProductionScript;
  scriptHubId: string;
  hubData: StoryProScriptHubNodeData;
  outlineMd?: string;
  className?: string;
  onShotSave: (
    shotIndex: number,
    patch: Partial<Pro2ProductionScriptShot>,
  ) => void;
};

const TH =
  "sticky top-0 z-10 border-b border-r border-white/10 bg-[#141416] px-3 py-2 text-left text-[11px] font-medium text-zinc-400 last:border-r-0";
const TD =
  "border-b border-r border-white/[0.06] px-3 py-2.5 align-top text-[12px] leading-relaxed text-zinc-300 last:border-r-0";

function stopCanvasHubBubble(e: MouseEvent) {
  e.stopPropagation();
  e.preventDefault();
}

function cellText(value: string | number | undefined | null): string {
  const t = value == null ? "" : String(value).trim();
  return t || "—";
}

function formatDuration(sec: number | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return "—";
  return `${sec}s`;
}

function HighlightedCell({
  text,
  matchers,
  rowKey,
  plainClassName,
  script,
}: {
  text: string;
  matchers: EntityHighlightMatcher[];
  rowKey: string;
  plainClassName?: string;
  script?: Pro2ProductionScript;
}) {
  if (!text.trim()) {
    return <span className="text-zinc-600">—</span>;
  }

  if (script && textHasWizardMentionTokens(text)) {
    return (
      <WizardPromptReadonly
        value={text}
        mentionables={buildWizardAssetMentionables(script, [])}
        className={cn("text-[12px] text-zinc-300", plainClassName)}
      />
    );
  }

  const displayText = script
    ? formatWizardMentionsForDisplay(text, script)
    : text;
  const segments = splitTextByEntityMatchers(displayText, matchers);
  return (
    <span className={cn("whitespace-pre-wrap break-words", plainClassName)}>
      {segments.map((seg, i) =>
        seg.type === "entity" ? (
          <span
            key={`${rowKey}-e-${i}`}
            className={entityHighlightClass(seg.entity.kind)}
            title={`${seg.entity.kind} · ${seg.entity.name}`}
          >
            {seg.value}
          </span>
        ) : (
          <span key={`${rowKey}-t-${i}`}>{seg.value}</span>
        ),
      )}
    </span>
  );
}

export function Pro2ProductionWizardStoryboardTable({
  script: scriptProp,
  scriptHubId,
  hubData,
  outlineMd,
  className,
  onShotSave,
}: Pro2ProductionWizardStoryboardTableProps) {
  const script = useMemo(
    () => ensurePro2ProductionScriptSchemaVersion(scriptProp),
    [scriptProp],
  );
  const shots = script.shots ?? [];
  const useV2 = isPro2ProductionScriptV2(script.schemaVersion);

  const [editingShot, setEditingShot] = useState<Pro2ProductionScriptShot | null>(
    null,
  );

  const openEdit = (shot: Pro2ProductionScriptShot) => setEditingShot(shot);

  return (
    <>
      <div
        className={cn(
          "nowheel flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0c0c0e]",
          className,
        )}
        onDoubleClick={stopCanvasHubBubble}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[960px] border-collapse table-fixed">
            <colgroup>
              <col style={{ width: "4%" }} />
              <col style={{ width: "4%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "5%" }} />
              {useV2 ? <col style={{ width: "8%" }} /> : null}
              <col style={{ width: "8%" }} />
              {useV2 ? (
                <>
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "7%" }} />
                </>
              ) : null}
              <col style={{ width: "12%" }} />
              {useV2 ? (
                <col style={{ width: "9%" }} />
              ) : (
                <>
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "11%" }} />
                </>
              )}
              <col style={{ width: useV2 ? "12%" : "11%" }} />
            </colgroup>
            <thead>
              <tr>
                <th className={cn(TH, "text-center")}>镜号</th>
                <th className={cn(TH, "text-center")}>时长</th>
                <th className={TH}>画面描述</th>
                <th className={TH}>景别</th>
                {useV2 ? <th className={TH}>光影</th> : null}
                <th className={TH}>运镜</th>
                {useV2 ? (
                  <>
                    <th className={TH}>场景</th>
                    <th className={TH}>道具</th>
                  </>
                ) : null}
                <th className={TH}>对白</th>
                {useV2 ? (
                  <th className={TH}>音效</th>
                ) : (
                  <>
                    <th className={TH}>AI生图</th>
                    <th className={TH}>AI视频</th>
                  </>
                )}
                <th className={TH}>口型/配音</th>
              </tr>
            </thead>
            <tbody>
              {shots.map((shot) => {
                const rowKey = `shot-${shot.index}`;
                const reconciledShot = reconcileShotEntityLinks(shot, script);
                const rowMatchers = buildEntityHighlightMatchersForShot(
                  reconciledShot,
                  script,
                );
                return (
                  <tr
                    key={shot.index}
                    className={cn(
                      "cursor-pointer transition-colors",
                      "hover:bg-violet-500/[0.07]",
                      editingShot?.index === shot.index && "bg-violet-500/10",
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(reconciledShot);
                    }}
                    onDoubleClick={stopCanvasHubBubble}
                  >
                    <td className={cn(TD, "text-center text-zinc-500")}>
                      {shot.index}
                    </td>
                    <td className={cn(TD, "text-center tabular-nums text-zinc-400")}>
                      {formatDuration(shot.durationSec)}
                    </td>
                    <td className={TD}>
                      <HighlightedCell
                        text={shot.sceneDescription ?? ""}
                        matchers={rowMatchers}
                        rowKey={`${rowKey}-scene`}
                        script={script}
                      />
                    </td>
                    <td className={TD}>{cellText(shot.shotSize)}</td>
                    {useV2 ? (
                      <td className={cn(TD, "whitespace-pre-wrap break-words")}>
                        <HighlightedCell
                          text={shot.lighting ?? ""}
                          matchers={rowMatchers}
                          rowKey={`${rowKey}-lighting`}
                          script={script}
                        />
                      </td>
                    ) : null}
                    <td className={cn(TD, "whitespace-pre-wrap break-words")}>
                      <HighlightedCell
                        text={shot.cameraMove ?? ""}
                        matchers={rowMatchers}
                        rowKey={`${rowKey}-camera`}
                        script={script}
                      />
                    </td>
                    {useV2 ? (
                      <>
                        <td className={TD}>
                          {cellText(resolveShotSceneName(reconciledShot, script))}
                        </td>
                        <td className={TD}>
                          {cellText(resolveShotPropNames(reconciledShot, script))}
                        </td>
                      </>
                    ) : null}
                    <td className={TD}>
                      <HighlightedCell
                        text={
                          shot.dialogue && shot.dialogue !== "—"
                            ? shot.dialogue
                            : ""
                        }
                        matchers={rowMatchers}
                        rowKey={`${rowKey}-dialogue`}
                        script={script}
                      />
                    </td>
                    {useV2 ? (
                      <td className={cn(TD, "text-zinc-400")}>
                        {cellText(shot.sfxNote)}
                      </td>
                    ) : (
                      <>
                        <td className={cn(TD, "font-mono text-[11px] text-zinc-500")}>
                          {cellText(shot.imagePrompt ?? shot.frameImagePrompt)}
                        </td>
                        <td className={cn(TD, "font-mono text-[11px] text-zinc-500")}>
                          {cellText(shot.videoPrompt)}
                        </td>
                      </>
                    )}
                    <td className={cn(TD, "text-zinc-400")}>
                      {cellText(shot.audioNote)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editingShot ? (
        <Pro2ProductionWizardShotEditModal
          open
          shot={editingShot}
          script={script}
          scriptHubId={scriptHubId}
          hubData={hubData}
          outlineMd={outlineMd}
          onClose={() => setEditingShot(null)}
          onSave={(patch) => {
            onShotSave(editingShot.index, patch);
            setEditingShot(null);
          }}
        />
      ) : null}
    </>
  );
}
