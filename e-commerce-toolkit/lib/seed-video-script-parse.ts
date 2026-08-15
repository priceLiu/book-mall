import {
  extractSeedVideoStructuredPatch,
  scriptProposalsFromStructuredPatch,
} from "@/lib/seed-video-structured";

export type ParsedScriptProposal = {
  id: "script-1" | "script-2" | "script-3";
  index: number;
  angle: string;
  totalDurationSec: number;
  summary: string;
};

/** 从助手回复解析三套脚本（仅 ```seed-video` JSON，长度须 = 3） */
export function parseScriptProposalsFromMarkdown(markdown: string): ParsedScriptProposal[] {
  const patch = extractSeedVideoStructuredPatch(markdown);
  if (!patch?.scripts || patch.scripts.length !== 3) return [];
  return scriptProposalsFromStructuredPatch(patch).map((s) => ({
    id: s.id,
    index: s.index,
    angle: s.angle,
    totalDurationSec: 0,
    summary: s.summary,
  }));
}

export function scriptIdFromProposalIndex(index: number): ParsedScriptProposal["id"] {
  return `script-${index + 1}` as ParsedScriptProposal["id"];
}
