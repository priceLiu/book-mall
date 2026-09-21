import type { CanvasChatMessage } from "@/lib/canvas/providers/types";
import { drainEcomGwChat } from "@/lib/ecom/ecom-product-design-vision";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_DEFAULT_ASSISTANT_CHAT_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { z } from "zod";

import {
  buildDetailPageVisionClassifySystem,
  buildDetailPageVisionClassifyUserText,
} from "./classify-prompts";
import {
  chunkDetailPageVisionSegments,
  DETAIL_PAGE_VISION_CLASSIFY_BATCH_SIZE,
} from "./inventory-classify-batch";
import { DETAIL_PAGE_VISION_CLASSIFY_FENCE } from "./inventory-constants";
import {
  extractFenceJson,
  normalizeDetailPageVisionClassifyBatch,
  type DetailPageVisionClassifyBatch,
  type DetailPageVisionInventory,
  type ReplicaSegmentMapping,
} from "./inventory-schemas";

function isGatewayOrTransportError(e: unknown): boolean {
  if (e instanceof z.ZodError) return false;
  const msg = e instanceof Error ? e.message : String(e);
  if (/未返回有效 JSON|校验失败|schemaVersion|不支持|围栏|归类|item_key/.test(msg)) {
    return false;
  }
  return true;
}

export function replicaSegmentMappingFromClassifyBatch(
  batch: DetailPageVisionClassifyBatch,
): ReplicaSegmentMapping {
  const out: ReplicaSegmentMapping = {};
  for (const row of batch.mappings) {
    if (row.confidence === "high" && row.module_id) {
      out[row.item_key] = {
        module_id: row.module_id,
        source: "auto",
        confidence: "high",
      };
    } else {
      out[row.item_key] = {
        module_id: null,
        source: "auto",
        confidence: row.confidence,
      };
    }
  }
  return out;
}

export type RunDetailPageVisionClassifyOpts = {
  userId: string;
  inventory: DetailPageVisionInventory;
  chatModelKey?: string;
  clientPageAction: string;
  workspaceId: string;
  batchSize?: number;
  onBatchProgress?: (info: { batchIndex: number; batchTotal: number }) => void | Promise<void>;
};

async function runDetailPageVisionClassifyOnce(
  opts: RunDetailPageVisionClassifyOpts,
  segments: DetailPageVisionInventory["segments"],
): Promise<{ batch: DetailPageVisionClassifyBatch; mapping: ReplicaSegmentMapping }> {
  const keys = segments.map((s) => s.item_key);
  if (keys.length === 0) {
    return { batch: { mappings: [] }, mapping: {} };
  }

  const modelKey = opts.chatModelKey?.trim() || ECOM_DEFAULT_ASSISTANT_CHAT_MODEL;
  const segmentsPayload = JSON.stringify(
    segments.map((s) => ({
      item_key: s.item_key,
      item_label: s.item_label,
      layoutHint: s.layoutHint,
      referenceCopyHints: s.referenceCopyHints,
    })),
  );

  const classifyMaxTokens = Math.min(8192, Math.max(2048, keys.length * 180));

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await drainEcomGwChat(opts.userId, {
        modelKey,
        messages: [
          { role: "system", content: buildDetailPageVisionClassifySystem() },
          {
            role: "user",
            content: buildDetailPageVisionClassifyUserText(segmentsPayload),
          },
        ] as CanvasChatMessage[],
        clientPage: ecomClientPage(opts.userId, opts.workspaceId, opts.clientPageAction),
        params: { max_tokens: classifyMaxTokens },
      });
      const json = extractFenceJson(text, DETAIL_PAGE_VISION_CLASSIFY_FENCE);
      const batch = normalizeDetailPageVisionClassifyBatch(json, keys);
      if (batch.mappings.length !== keys.length) {
        throw new Error(
          `归类条数不匹配：期望 ${keys.length}，得到 ${batch.mappings.length}`,
        );
      }
      const mapping = replicaSegmentMappingFromClassifyBatch(batch);
      for (const key of keys) {
        if (!mapping[key]) {
          mapping[key] = { module_id: null, source: "auto", confidence: "low" };
        }
      }
      return { batch, mapping };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (!isGatewayOrTransportError(e)) throw lastErr;
    }
  }
  throw lastErr ?? new Error("自动归类失败");
}

/** 大清单按批归类，避免单次 Chat 输出过大触发上游超时 */
export async function runDetailPageVisionClassify(
  opts: RunDetailPageVisionClassifyOpts,
): Promise<{ batch: DetailPageVisionClassifyBatch; mapping: ReplicaSegmentMapping }> {
  const segments = opts.inventory.segments;
  if (segments.length === 0) {
    return { batch: { mappings: [] }, mapping: {} };
  }

  const batchSize = opts.batchSize ?? DETAIL_PAGE_VISION_CLASSIFY_BATCH_SIZE;
  const chunks = chunkDetailPageVisionSegments(segments, batchSize);
  if (chunks.length === 1) {
    return runDetailPageVisionClassifyOnce(opts, segments);
  }

  const mergedMappings: DetailPageVisionClassifyBatch["mappings"] = [];
  const mapping: ReplicaSegmentMapping = {};

  for (let i = 0; i < chunks.length; i++) {
    await opts.onBatchProgress?.({ batchIndex: i + 1, batchTotal: chunks.length });
    const part = await runDetailPageVisionClassifyOnce(opts, chunks[i]!);
    mergedMappings.push(...part.batch.mappings);
    Object.assign(mapping, part.mapping);
  }

  return { batch: { mappings: mergedMappings }, mapping };
}
