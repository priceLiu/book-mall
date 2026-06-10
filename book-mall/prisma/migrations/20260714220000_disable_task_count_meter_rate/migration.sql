-- 预充值模式暂不向用户收取 TASK_COUNT 调度资源费
UPDATE "ResourceMeterRate"
SET "coefficientYuan" = 0, "updatedAt" = NOW()
WHERE "resourceType" = 'TASK_COUNT';
