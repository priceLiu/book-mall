-- 平台 AI 导览助手：删除 ivfflat 近似向量索引。
-- 语料规模仅数百块，lists=100 + 默认 probes=1 会把召回压缩到极少候选（只返回 2~3 条），
-- 导致「AI 画布」「有哪些应用」等问题检索不到最相关块。
-- 此规模用精确 KNN（顺序扫描 + 距离排序）即毫秒级且召回准确；待语料增长到数万级再改用 HNSW。
DROP INDEX IF EXISTS "PlatformDocChunk_embedding_idx";
