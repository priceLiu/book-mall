"use client";

import { FinancePageShell, FinancePageState } from "@/components/finance-page-shell";
import Link from "next/link";

const sectionCls = "rounded border border-[#e8e8e8] bg-white p-5";
const h2 = "text-base font-medium text-[#262626]";
const p = "mt-2 text-sm leading-relaxed text-[#595959]";

export function FinanceHelpClient() {
  return (
    <FinancePageShell className="gap-5">
      <header>
        <h1 className="text-lg font-medium text-[#262626]">财务 2.0 使用说明</h1>
        <p className="mt-1 text-sm text-[#8c8c8c]">
          面向财务 / 超管 / 运营。说明积分换算口径、控制台入口与常见操作流程。
        </p>
      </header>

      <section className={sectionCls}>
        <h2 className={h2}>一、登录与角色</h2>
        <p className={p}>
          请先在主站 <code className="rounded bg-[#fafafa] px-1">book-mall</code> 登录，再打开本财务控制台（
          <code className="rounded bg-[#fafafa] px-1">:3002</code>）。侧栏按角色过滤菜单：
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[#595959]">
          <li>
            <strong>财务 / 超管 / ADMIN</strong>：可见模型成本、费用概览、盈亏预警、积分报价等敏感页
          </li>
          <li>
            <strong>运营 OPERATIONS</strong>：可提交调价测算提案，<em>不可</em>查看模型成本与厂商毛利
          </li>
          <li>
            <strong>普通用户</strong>：仅「个人 / 团队」账单，无系统管理入口
          </li>
        </ul>
      </section>

      <section className={sectionCls}>
        <h2 className={h2}>二、积分与 Token 怎么换算？</h2>
        <p className={p}>
          系统采用<strong>方案 B-refined（逐档单价派生）</strong>，不是全局固定「1 积分 = 1000 Token」，而是：
        </p>
        <ol className="mt-2 list-inside list-decimal space-y-2 text-sm text-[#595959]">
          <li>
            <strong>模型挂牌价（元）</strong> = 渠道净成本 × 系数 M（视频 M=4，文本/图默认 2.5）
          </li>
          <li>
            <strong>全局锚定</strong>（默认 ¥0.04/积分）用于报价计算器预览：
            <code className="mx-1 rounded bg-[#fafafa] px-1">积分/次 = round(挂牌价 ÷ 锚定)</code>
          </li>
          <li>
            <strong>用户实际扣分</strong>按所属套餐单价：
            <code className="mx-1 rounded bg-[#fafafa] px-1">扣分 = round(挂牌价 ÷ (套餐价÷月积分))</code>
            使各档位真实毛利尽量恒定（视频约 75%）
          </li>
          <li>
            <strong>文本 Token 计费单位</strong>：按<strong>千 Token</strong>计一次（
            <code className="rounded bg-[#fafafa] px-1">PER_KTOKEN</code>），用量 =
            <code className="rounded bg-[#fafafa] px-1">ceil(总Token ÷ 1000)</code>，再乘单次扣分
          </li>
        </ol>
        <p className="mt-3 text-sm text-[#8c8c8c]">
          产品文案中的「1 积分 ≈ 1000 Token（Turbo 基准）」是运营口径示意；实际以各模型已发布积分价为准。
        </p>
        <div className="mt-3 rounded border border-[#d6e4ff] bg-[#f0f6ff] p-3 text-sm text-[#262626]">
          <p className="font-medium">在哪里查看？</p>
          <ul className="mt-1 space-y-1 text-[#595959]">
            <li>
              用户对外：<Link href="/admin/pricing-disclosure" className="text-[#1890ff] hover:underline">价格公示</Link>{" "}
              / 主站 <code>/pricing</code>
            </li>
            <li>
              财务测算：<Link href="/admin/credit-pricing" className="text-[#1890ff] hover:underline">积分报价计算器</Link>
            </li>
            <li>
              上游成本：<Link href="/admin/model-cost" className="text-[#1890ff] hover:underline">模型成本</Link>
            </li>
            <li>
              测算验算：<Link href="/admin/scenario-lab" className="text-[#1890ff] hover:underline">Scenario Lab</Link>（30 模型 × 15s）
            </li>
            <li>
              业务测算：<Link href="/admin/test-cases" className="text-[#1890ff] hover:underline">财务测算</Link>（个人/团队 · 日/月消耗）
            </li>
          </ul>
        </div>
      </section>

      <section className={sectionCls}>
        <h2 className={h2}>三、视频专项规则（15 秒）</h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[#595959]">
          <li>单条最长 15 秒，按秒计费，超过 15 秒仍按 15 秒计</li>
          <li>视频系数 M 最低 4，毛利护栏 ≥ 75%</li>
          <li>先冻结视频池积分 → 渲染成功结算；厂商全失败才全额退还</li>
          <li>通用积分池与视频专用池隔离（账户配置了 videoMonthlyGrant 时启用双池）</li>
          <li>并发 2 / 队列 10 / 批量 ≤5 集 / 5 分钟 ≥10 条触发 15 分钟冷却</li>
        </ul>
      </section>

      <section className={sectionCls}>
        <h2 className={h2}>四、系统管理模块导航</h2>
        <table className="mt-2 w-full text-sm">
          <thead className="bg-[#fafafa] text-left text-xs text-[#8c8c8c]">
            <tr>
              <th className="px-2 py-2">模块</th>
              <th className="px-2 py-2">用途</th>
            </tr>
          </thead>
          <tbody className="text-[#595959]">
            {[
              ["/admin/usage-overview", "费用概览", "按月份/工具/模型/用户聚合工具站消耗"],
              ["/admin/pnl-alerts", "盈亏预警", "综合毛利、视频毛利、成本环比、损耗率"],
              ["/admin/plan-change", "调价审批", "运营提交 → 财务复核 → 超管终审"],
              ["/admin/model-cost", "模型成本", "厂商挂牌价与渠道折扣（仅财务）"],
              ["/admin/credit-pricing", "积分报价", "发布各模型对外积分价"],
              ["/admin/membership-plans", "会员套餐", "五档套餐与席位带"],
              ["/admin/reconciliation", "云账单对账", "上传阿里云 CSV 对账与补扣"],
              ["/admin/billing/users", "用户明细", "31 列费用明细（含成本/M）"],
            ].map(([href, title, desc]) => (
              <tr key={href} className="border-t">
                <td className="px-2 py-2">
                  <Link href={href} className="text-[#1890ff] hover:underline">
                    {title}
                  </Link>
                </td>
                <td className="px-2 py-2">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={sectionCls}>
        <h2 className={h2}>五、调价标准流程</h2>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-[#595959]">
          <li>运营在「调价测算与审批」创建提案，填写拟定套餐价 / 积分 / 视频 M</li>
          <li>系统自动六维测算（成本、扣分变动、毛利、月度成本上限、营收模拟、用户影响）</li>
          <li>毛利未达标 → 报告标红，无法推进审批</li>
          <li>财务复核反向验算（保本线 / 目标毛利反推）</li>
          <li>超管终审通过后生效；对外公示见价格公示页</li>
        </ol>
      </section>

      <section className={sectionCls}>
        <h2 className={h2}>六、相关文档</h2>
        <p className={p}>
          仓库内权威文档：<code>docs/财务 2.0</code>（产品需求）、<code>docs/定价与风控.md</code>（定价演算）、
          <code>docs/财务2.0-验收标准.md</code>（验收数字）、<code>docs/财务2.0-测试用例.md</code>。
          代码公式：<code>book-mall/lib/pricing/credit-pricing-formulas.ts</code>。
        </p>
      </section>
    </FinancePageShell>
  );
}
