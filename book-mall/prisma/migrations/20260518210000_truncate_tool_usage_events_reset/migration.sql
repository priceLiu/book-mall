-- 产品重置：清空工具打点流水，从零累计；计费口径以文档为准（AI试衣仅在成片成功后的 try_on 事件计价）。
TRUNCATE TABLE "ToolUsageEvent";
