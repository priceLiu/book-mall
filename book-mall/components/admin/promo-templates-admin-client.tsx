"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createRechargePromoTemplateAction,
  deleteRechargePromoTemplateAction,
  updateRechargePromoTemplateAction,
  updateRechargePromoTemplateSlugAction,
} from "@/app/actions/recharge-promo-admin";
import { formatPointsAsYuan, formatPointsIntegerCn } from "@/lib/currency";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AdminPromoTemplateRow = {
  id: string;
  slug: string;
  title: string;
  paidAmountPoints: number;
  bonusPoints: number;
  active: boolean;
  claimableFromLocal: string;
  claimableToLocal: string;
  validDaysAfterClaim: number;
  maxClaimsPerUser: number;
  sortOrder: number;
  note: string | null;
  issuedCount: number;
};

export function PromoTemplatesAdminClient({
  templates,
}: {
  templates: AdminPromoTemplateRow[];
}) {
  const router = useRouter();
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-10">
      <Card>
        <CardHeader>
          <CardTitle>新建优惠模板</CardTitle>
          <CardDescription>
            与「工具管理 → 按次单价」同一口径：<strong className="text-foreground">100 点 = 1 元</strong>
            ；下方实付/赠送均按<strong className="text-foreground">点</strong>保存（用户收银台与核销快照一致）。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              setCreateErr(null);
              const fd = new FormData(e.currentTarget);
              setCreating(true);
              void (async () => {
                try {
                  await createRechargePromoTemplateAction(fd);
                  (e.target as HTMLFormElement).reset();
                  router.refresh();
                } catch (err) {
                  setCreateErr(err instanceof Error ? err.message : "保存失败");
                } finally {
                  setCreating(false);
                }
              })();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="new-slug">slug（唯一）</Label>
              <Input id="new-slug" name="slug" required placeholder="e.g. recharge_200_bonus_500" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-title">展示标题</Label>
              <Input id="new-title" name="title" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-paid">实付档位（点）</Label>
              <Input id="new-paid" name="paidAmountPoints" type="number" min={1} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-bonus">赠送点</Label>
              <Input id="new-bonus" name="bonusPoints" type="number" min={0} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-from">领取开始（本地时间）</Label>
              <Input id="new-from" name="claimableFrom" type="datetime-local" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-to">领取结束（本地时间）</Label>
              <Input id="new-to" name="claimableTo" type="datetime-local" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-valid-days">领取后有效天数</Label>
              <Input id="new-valid-days" name="validDaysAfterClaim" type="number" min={1} defaultValue={7} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-max">每用户最多领几次</Label>
              <Input id="new-max" name="maxClaimsPerUser" type="number" min={1} defaultValue={1} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-sort">排序（小在前）</Label>
              <Input id="new-sort" name="sortOrder" type="number" min={0} defaultValue={0} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="new-note">备注（可选）</Label>
              <Input id="new-note" name="note" />
            </div>
            <div className="md:col-span-2 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="active" defaultChecked />
                上架（可领取）
              </label>
              <Button type="submit" disabled={creating}>
                {creating ? "创建中…" : "创建"}
              </Button>
              {createErr ? <span className="text-sm text-destructive">{createErr}</span> : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">已有模板</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          {templates.map((t) => (
            <PromoTemplateEditCard key={t.id} template={t} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PromoTemplateEditCard({ template: t }: { template: AdminPromoTemplateRow }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [slugErr, setSlugErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="space-y-3 border-b border-border/60 bg-muted/15 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg leading-snug">{t.title}</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2 font-mono text-xs">
              {t.slug}
              {t.active ? (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 font-sans text-[0.65rem] font-semibold text-primary">
                  上架
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 font-sans text-[0.65rem] font-medium text-muted-foreground">
                  下架
                </span>
              )}
            </CardDescription>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-border/80 bg-card p-3 shadow-sm">
            <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
              实付档位
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums leading-none">
              {formatPointsIntegerCn(t.paidAmountPoints)}
              <span className="text-sm font-semibold text-muted-foreground"> 点</span>
            </p>
            <p className="mt-1 text-xs tabular-nums text-muted-foreground">
              ¥{formatPointsAsYuan(t.paidAmountPoints)}
            </p>
          </div>
          <div className="rounded-lg border border-border/80 bg-card p-3 shadow-sm">
            <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
              赠送
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums leading-none text-emerald-700 dark:text-emerald-400">
              +{formatPointsIntegerCn(t.bonusPoints)}
              <span className="text-sm font-semibold opacity-80"> 点</span>
            </p>
            <p className="mt-1 text-xs tabular-nums text-muted-foreground">
              ¥{formatPointsAsYuan(t.bonusPoints)}
            </p>
          </div>
          <div className="rounded-lg border border-border/80 bg-card p-3 shadow-sm">
            <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
              已发券
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums leading-none">{t.issuedCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">张（含已核销/过期）</p>
          </div>
          <div className="rounded-lg border border-border/80 bg-card p-3 shadow-sm">
            <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
              领后有效
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums leading-none">{t.validDaysAfterClaim}</p>
            <p className="mt-1 text-xs text-muted-foreground">天内需核销</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col space-y-6 pt-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">编辑字段</p>
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setErr(null);
            const fd = new FormData(e.currentTarget);
            setBusy(true);
            void (async () => {
              try {
                await updateRechargePromoTemplateAction(fd);
                router.refresh();
              } catch (er) {
                setErr(er instanceof Error ? er.message : "保存失败");
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          <input type="hidden" name="id" value={t.id} />
          <div className="space-y-2 md:col-span-2">
            <Label>标题</Label>
            <Input name="title" defaultValue={t.title} required />
          </div>
          <div className="space-y-2">
            <Label>实付档位（点）</Label>
            <Input name="paidAmountPoints" type="number" min={1} defaultValue={t.paidAmountPoints} required />
          </div>
          <div className="space-y-2">
            <Label>赠送点</Label>
            <Input name="bonusPoints" type="number" min={0} defaultValue={t.bonusPoints} required />
          </div>
          <div className="space-y-2">
            <Label>领取开始</Label>
            <Input
              name="claimableFrom"
              type="datetime-local"
              defaultValue={t.claimableFromLocal}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>领取结束</Label>
            <Input name="claimableTo" type="datetime-local" defaultValue={t.claimableToLocal} required />
          </div>
          <div className="space-y-2">
            <Label>领取后有效天数</Label>
            <Input
              name="validDaysAfterClaim"
              type="number"
              min={1}
              defaultValue={t.validDaysAfterClaim}
            />
          </div>
          <div className="space-y-2">
            <Label>每用户最多领</Label>
            <Input name="maxClaimsPerUser" type="number" min={1} defaultValue={t.maxClaimsPerUser} />
          </div>
          <div className="space-y-2">
            <Label>排序</Label>
            <Input name="sortOrder" type="number" min={0} defaultValue={t.sortOrder} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>备注</Label>
            <Input name="note" defaultValue={t.note ?? ""} />
          </div>
          <div className="md:col-span-2 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={t.active} />
              上架
            </label>
            <Button type="submit" size="sm" disabled={busy}>
              保存修改
            </Button>
            {err ? <span className="text-sm text-destructive">{err}</span> : null}
          </div>
        </form>

        <form
          className="flex flex-wrap items-end gap-3 border-t border-border/60 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            setSlugErr(null);
            const fd = new FormData(e.currentTarget);
            void (async () => {
              try {
                await updateRechargePromoTemplateSlugAction(fd);
                router.refresh();
              } catch (er) {
                setSlugErr(er instanceof Error ? er.message : "修改失败");
              }
            })();
          }}
        >
          <input type="hidden" name="id" value={t.id} />
          <div className="space-y-2 flex-1 min-w-[12rem]">
            <Label>修改 slug（谨慎）</Label>
            <Input name="slug" defaultValue={t.slug} required />
          </div>
          <Button type="submit" variant="outline" size="sm">
            更新 slug
          </Button>
          {slugErr ? <span className="text-sm text-destructive w-full">{slugErr}</span> : null}
        </form>

        <div className="border-t border-border/60 pt-4">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={t.issuedCount > 0}
            title={t.issuedCount > 0 ? "已有领取记录，请改为下架" : "删除空模板"}
            onClick={() => {
              if (!window.confirm("确定删除该模板？仅当从未被领取时可删。")) return;
              void (async () => {
                try {
                  await deleteRechargePromoTemplateAction(t.id);
                  router.refresh();
                } catch (er) {
                  window.alert(er instanceof Error ? er.message : "删除失败");
                }
              })();
            }}
          >
            删除模板
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
