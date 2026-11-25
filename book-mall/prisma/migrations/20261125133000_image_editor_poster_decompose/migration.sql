-- 商品卖点贴纸拆层缓存。全站按贴纸编号一份，不跟用户走。
CREATE TABLE "ImageEditorPosterDecompose" (
    "posterId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "pack" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageEditorPosterDecompose_pkey" PRIMARY KEY ("posterId")
);
