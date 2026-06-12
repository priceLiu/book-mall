/**
 * 服务端 · 分镜静帧 imageInputs 组装（P-A2）
 */

import { resolveStoryRowRefUrls, parseMentionIds } from "./story-row-ref-urls";

export function buildStoryProFrameImageInputs(args: {
  row: Record<string, unknown>;
  nodeData: Record<string, unknown>;
  clientImageInputs?: string[];
}): { imageInputs: string[]; promptSuffix?: string } {
  const { row, nodeData } = args;
  const prompt = String(row.prompt ?? "");
  const mentioned = parseMentionIds(prompt);
  const clientUrls = (args.clientImageInputs ?? []).filter(
    (u): u is string => typeof u === "string" && /^https?:\/\//.test(u),
  );
  if (mentioned.length > 0 && clientUrls.length > 0) {
    return {
      imageInputs: clientUrls.slice(0, 8),
      promptSuffix:
        nodeData.injectStyleRefs === true
          ? "保持与风格参考图一致的色调、光影与渲染质感。"
          : undefined,
    };
  }
  const refUrls = resolveStoryRowRefUrls(row);
  const injectStyle = nodeData.injectStyleRefs === true;
  const styleUrls = Array.isArray(nodeData.styleRefImageUrls)
    ? nodeData.styleRefImageUrls.filter(
        (u): u is string => typeof u === "string" && /^https?:\/\//.test(u),
      )
    : [];

  const urls: string[] = [...refUrls];
  if (injectStyle && styleUrls.length) {
    for (const u of styleUrls.slice(0, 2)) {
      if (!urls.includes(u)) urls.push(u);
    }
  }

  return {
    imageInputs: urls.slice(0, 8),
    promptSuffix:
      injectStyle && styleUrls.length
        ? "保持与风格参考图一致的色调、光影与渲染质感。"
        : undefined,
  };
}
