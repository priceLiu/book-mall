/**
 * Keep in sync with canvas-web/lib/canvas/remap-cloned-graph-refs.ts
 * 复制画布 JSON 后重写 @ 引用与 nodeId 字段。
 */

const TOKEN_RE = /@<([^>\s]+)>/g;

export const CLONED_GRAPH_MENTION_REF_PREFIXES = [
  "",
  "up-style-",
  "up-img-",
  "up-outline-",
  "up-outline-data-",
  "up-text-",
  "up-tag-",
  "up-script-",
  "up-frame-img-",
  "sbv1-ref-",
  "sbv1-text-",
  "sbv1-motion-",
] as const;

const NODE_ID_FIELD_KEYS = new Set([
  "hubNodeId",
  "scriptHubId",
  "frameColumnId",
  "pro2HubNodeId",
  "pro2ControllerNodeId",
  "pro2GroupId",
  "directorDeskNodeId",
  "styleNodeId",
  "imageNodeId",
  "mediaNodeId",
  "canvasNodeId",
  "crewTaskForkedFromNodeId",
  "sourceNodeId",
]);

const NODE_ID_ARRAY_FIELD_KEYS = new Set([
  "clipOrderNodeIds",
  "audioOrderNodeIds",
  "referencedNodeIds",
  "videoReferencedNodeIds",
]);

function mentionRefIdForNode(prefix: string, nodeId: string): string {
  return `${prefix}${nodeId}`;
}

export function remapMentionRefId(
  refId: string,
  idMap: Map<string, string>,
): string {
  for (const [oldId, newId] of idMap) {
    for (const prefix of CLONED_GRAPH_MENTION_REF_PREFIXES) {
      const oldRef = mentionRefIdForNode(prefix, oldId);
      if (refId === oldRef) {
        return mentionRefIdForNode(prefix, newId);
      }
    }
  }
  return refId;
}

export function remapMentionTokensInString(
  value: string,
  idMap: Map<string, string>,
): string {
  if (!value.includes("@<") || idMap.size === 0) return value;
  let out = value;
  for (const [oldId, newId] of idMap) {
    for (const prefix of CLONED_GRAPH_MENTION_REF_PREFIXES) {
      const oldRef = mentionRefIdForNode(prefix, oldId);
      const newRef = mentionRefIdForNode(prefix, newId);
      if (oldRef === newRef || !out.includes(`@<${oldRef}>`)) continue;
      out = out.split(`@<${oldRef}>`).join(`@<${newRef}>`);
    }
  }
  return out;
}

function remapNodeIdScalar(value: string, idMap: Map<string, string>): string {
  return idMap.get(value) ?? value;
}

function remapDockRefImages(
  refs: unknown,
  idMap: Map<string, string>,
): unknown {
  if (!Array.isArray(refs)) return refs;
  return refs.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    const ref = item as Record<string, unknown>;
    if (typeof ref.id !== "string") return item;
    const nextId = remapMentionRefId(ref.id, idMap);
    if (nextId === ref.id) return item;
    return { ...ref, id: nextId };
  });
}

export function remapClonedNodeData(
  data: Record<string, unknown> | undefined | null,
  idMap: Map<string, string>,
): Record<string, unknown> {
  if (!data || typeof data !== "object" || idMap.size === 0) {
    return data && typeof data === "object" ? { ...data } : {};
  }
  return remapNodeDataValue(data, idMap) as Record<string, unknown>;
}

function remapNodeDataValue(value: unknown, idMap: Map<string, string>): unknown {
  if (typeof value === "string") {
    return value.includes("@<")
      ? remapMentionTokensInString(value, idMap)
      : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => remapNodeDataValue(item, idMap));
  }
  if (!value || typeof value !== "object") return value;

  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(obj)) {
    if (NODE_ID_FIELD_KEYS.has(key) && typeof raw === "string") {
      out[key] = remapNodeIdScalar(raw, idMap);
      continue;
    }
    if (NODE_ID_ARRAY_FIELD_KEYS.has(key) && Array.isArray(raw)) {
      out[key] = raw.map((item) =>
        typeof item === "string" ? remapNodeIdScalar(item, idMap) : item,
      );
      continue;
    }
    if (key === "dockRefImages") {
      out[key] = remapDockRefImages(raw, idMap);
      continue;
    }
    if (key === "rows" && Array.isArray(raw)) {
      out[key] = raw.map((row) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return row;
        const r = { ...(row as Record<string, unknown>) };
        if (typeof r.prompt === "string") {
          r.prompt = remapMentionTokensInString(r.prompt, idMap);
        }
        if (typeof r.videoPrompt === "string") {
          r.videoPrompt = remapMentionTokensInString(r.videoPrompt, idMap);
        }
        if (typeof r.aiImagePrompt === "string") {
          r.aiImagePrompt = remapMentionTokensInString(r.aiImagePrompt, idMap);
        }
        if (typeof r.frameImagePrompt === "string") {
          r.frameImagePrompt = remapMentionTokensInString(
            r.frameImagePrompt,
            idMap,
          );
        }
        if (Array.isArray(r.refImages)) {
          r.refImages = remapDockRefImages(r.refImages, idMap);
        }
        return r;
      });
      continue;
    }
    out[key] = remapNodeDataValue(raw, idMap);
  }
  return out;
}

export function clonedPromptMentionIdsStillValid(
  prompt: string,
  idMap: Map<string, string>,
): boolean {
  const ids: string[] = [];
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(prompt)) !== null) {
    if (m[1]) ids.push(m[1]);
  }
  const newNodeIds = new Set(idMap.values());
  return ids.every((refId) => {
    if (refId.startsWith("ref-char-") || refId.startsWith("ref-asset-")) {
      return true;
    }
    if (refId.startsWith("ref-scene-")) return true;
    if (refId.startsWith("wiz-")) return true;
    for (const nodeId of newNodeIds) {
      for (const prefix of CLONED_GRAPH_MENTION_REF_PREFIXES) {
        if (refId === mentionRefIdForNode(prefix, nodeId)) return true;
      }
    }
    return false;
  });
}
