"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** 模拟单品订阅周期（天） */
const MOCK_PRODUCT_SUB_DAYS = 365;

export async function subscribeProductMock(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("请先登录");
  const userId = session.user.id;

  const productId = (formData.get("productId") as string)?.trim();
  if (!productId) throw new Error("缺少商品");

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.status !== "PUBLISHED") throw new Error("商品不可订阅");
  if (product.catalogUnavailable) throw new Error("该商品已暂停新订");

  if (product.kind === "TOOL") {
    if (!product.toolNavKey?.trim()) {
      throw new Error("后台未配置 toolNavKey，暂无法单品订阅该工具");
    }
  }

  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + MOCK_PRODUCT_SUB_DAYS);

  await prisma.$transaction(async (tx) => {
    await tx.userProductSubscription.upsert({
      where: {
        userId_productId: { userId, productId },
      },
      create: {
        userId,
        productId,
        status: "ACTIVE",
        currentPeriodStart: start,
        currentPeriodEnd: end,
      },
      update: {
        status: "ACTIVE",
        currentPeriodStart: start,
        currentPeriodEnd: end,
      },
    });

    await tx.order.create({
      data: {
        userId,
        type: "PRODUCT_SUBSCRIPTION",
        status: "PAID",
        amountMinor: 0,
        paidAt: new Date(),
        meta: {
          mock: true,
          productId,
          productSlug: product.slug,
          kind: product.kind,
        },
      },
    });
  });

  revalidatePath("/account");
  revalidatePath("/account/subscription");
  revalidatePath("/account/subscription/tools");
  revalidatePath("/account/subscription/courses");
}

export async function cancelProductSubscriptionMock(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("请先登录");
  const userId = session.user.id;

  const productId = (formData.get("productId") as string)?.trim();
  if (!productId) throw new Error("缺少商品");

  const now = new Date();
  const updated = await prisma.userProductSubscription.updateMany({
    where: {
      userId,
      productId,
      status: "ACTIVE",
      currentPeriodEnd: { gt: now },
    },
    data: { status: "CANCELLED" },
  });

  if (updated.count === 0) {
    throw new Error("未找到可取消的活跃订阅");
  }

  revalidatePath("/account");
  revalidatePath("/account/subscription");
  revalidatePath("/account/subscription/tools");
  revalidatePath("/account/subscription/courses");
}
