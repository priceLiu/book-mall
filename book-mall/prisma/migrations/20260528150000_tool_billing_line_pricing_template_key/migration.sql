-- 明细行：对内计价模板键（多云厂商各建模板并在代码 registry 注册）
ALTER TABLE "ToolBillingDetailLine"
ADD COLUMN "pricingTemplateKey" TEXT NOT NULL DEFAULT 'aliyun.consumedetail_bill_v2';
