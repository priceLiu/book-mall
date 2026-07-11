/**
 * 积分清零与退款规则公示（积分清零 1.0，锚点 #credit-expiry）。
 * 正文对齐 docs/积分清零.md；与后端批次到期实现（CreditLot）一致。
 */
export function CreditExpiryPolicySection({ embedded = false }: { embedded?: boolean }) {
  return (
    <section
      id="credit-expiry"
      className={embedded ? "space-y-4 scroll-mt-24" : "mt-12 space-y-4 scroll-mt-24"}
    >
      <div className="rounded-2xl border border-secondary bg-card p-6 md:p-8">
        <h2 className="mb-2 text-lg font-semibold md:text-xl">五、积分有效期与清零规则</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          积分为平台内虚拟服务权益，不具现金价值、不可提现/转让/折现。会员付费周期与积分清零周期相互独立，规则如下。
        </p>

        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">
              会员服务有效期（付费准入）
            </h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong className="text-foreground">月付</strong>：自支付成功时刻起{" "}
                <strong className="text-foreground">31 天</strong>（固定天数、点到点，非自然月）。
                例：7 月 10 日 14:00 购买 → 服务至 8 月 10 日 14:00。
              </li>
              <li>
                <strong className="text-foreground">年付</strong>：自支付成功时刻起{" "}
                <strong className="text-foreground">365 天</strong>（固定天数、点到点，非自然年）。
                例：7 月 10 日 14:00 购买 → 服务至次年 7 月 10 日 14:00。
              </li>
              <li>
                续费：会员<strong className="text-foreground">未过期</strong>时从当前截止时刻顺延对应天数；已过期则从续费成功时刻重新起算。
              </li>
              <li>
                会员服务到期后：不再发放新的订阅套餐积分；当期已到账积分仍可用至本积分周期结束；充值积分与活动赠送积分按各自规则独立计算。
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">
              一、订阅套餐赠送积分（会员额度）
            </h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                自发放/刷新到账起<strong className="text-foreground">31 天有效</strong>（固定天数，非自然月）；
                每满 31 天自动刷新下一期额度，上一期未用完的订阅积分<strong className="text-foreground">自动清零、不结转</strong>。
              </li>
              <li>中途取消续费：当前 31 天积分周期内剩余订阅积分可用至本周期结束，到期依旧清零，不折现。</li>
              <li>
                年付会员：在 365 天付费有效期内，套餐赠送积分仍按<strong className="text-foreground">每 31 天</strong>刷新（约 12 期）；付费期满后不再刷新。
              </li>
              <li>
                消耗顺序：系统<strong className="text-foreground">优先消耗最先到期</strong>的积分（一般为即将到期的订阅积分），再依次消耗其它积分。
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">
              二、单独充值积分（付费加量包）
            </h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                自到账起<strong className="text-foreground">有效期 12 个月</strong>，有效期内可累积、叠加使用。
              </li>
              <li>超出 12 个月未使用的充值积分自动清零；会员到期不影响充值积分有效期，充值积分可独立使用至过期。</li>
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">
              三、活动 / 注册赠送积分（免费额度）
            </h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                注册赠送、拉新、节日等营销赠送积分：自到账起<strong className="text-foreground">30 天有效</strong>，过期未使用自动清零。
              </li>
              <li>免费积分不参与任何退款、折现补偿。</li>
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">四、退款规则（概要）</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                订阅会员：开通后 7 个自然日内、且<strong className="text-foreground">未消耗任何订阅赠送积分</strong>，可申请全额退订阅费；一旦产生任意消耗即视为服务已交付，不予退款。超 7 天不支持无理由退款。
              </li>
              <li>充值积分：一经到账无质量问题不支持无理由退款；重复扣款/未到账/金额错误等异常订单，可 72 小时内凭证申请、核实后原路退还；已消耗部分不退。</li>
              <li>因平台故障导致无法使用的，可按未履约周期比例退费或由平台补偿。</li>
              <li>积分已过期清零、周期已结束、违规封禁、赠送/补偿积分等情形不支持退款。</li>
            </ul>
          </div>

          <p className="border-t border-secondary pt-4 text-xs">
            平台有权按运营规则调整积分政策，变更前已获取的积分按原规则执行；争议可通过在线客服提交凭证申诉。最终解释权归本平台，未尽事宜参照《用户服务协议》。
          </p>
        </div>
      </div>
    </section>
  );
}
