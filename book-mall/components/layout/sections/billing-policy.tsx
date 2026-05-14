/** 第七章：用户知情权·计费与提现公示（落地页可锚点 #billing-policy） */
export function BillingPolicySection() {
  return (
    <section
      id="billing-policy"
      className="container w-full py-16 sm:py-24 scroll-mt-24"
    >
      <div className="mx-auto max-w-screen-xl rounded-2xl border border-secondary bg-card p-8 md:p-12">
        <h2 className="text-2xl md:text-3xl font-bold mb-2">计费、余额与提现说明</h2>
        <p className="text-sm text-muted-foreground mb-8">
          以下为产品规则摘要，具体以订单协议及后台公示为准；订阅相关提现与余额提现规则<strong>相互独立</strong>。
        </p>
        <div className="max-w-none space-y-6 text-muted-foreground text-sm leading-relaxed">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">订阅与余额的边界</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-foreground">订阅费</strong>
                为周期性权益（月/年），用于解锁<strong>普通型</strong>内容/工具；<strong>不可用账户余额抵扣</strong>。
              </li>
              <li>
                <strong className="text-foreground">账户余额</strong>
                用于<strong>高阶型</strong>与<strong>按量计费</strong>（如大模型、高阶工具）；与订阅费分账管理。
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">最低余额线与使用</h3>
            <p>
              使用依赖余额的高阶/按量能力前，可用余额须不低于平台设定的<strong>最低余额线</strong>（默认约
              20 元人民币，以前台与个人中心展示为准）。低于该线时将<strong>停止使用</strong>相关能力，<strong>有效订阅下的普通型权益不受影响</strong>。
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">按量计费（概要）</h3>
            <p>
              大模型等能力一般按 <strong>Token、调用次数或时长</strong>{" "}
              等维度计费；具体单价以产品页、下单页及个人中心说明为准，并可在运营需要时通过后台配置调整。
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">余额提现</h3>
            <p>
              用户不再继续使用时，可申请将账户<strong>余额提现</strong>。平台在<strong>结清应扣未扣</strong>
              （已发生尚未入账的用量费用等）后，对<strong>剩余可提现金额</strong>办理提现；实际到账路径、时效与手续费（若有）以会员中心/帮助中心为准。
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">订阅与订单提现</h3>
            <p>
              <strong>订阅类订单</strong>是否允许提现结束时结算结余、条件与时限与余额提现<strong>分别约定</strong>
              ，请以订阅时展示的条款及客服指引为准。
            </p>
          </div>
          <p className="text-xs pt-4 border-t border-secondary">
            法务合规：正式对外服务前，请由法务审定文案并与
            <code className="rounded bg-muted px-1">doc/product/07-operations.md</code>{" "}
            保持一致更新。
          </p>
        </div>
      </div>
    </section>
  );
}
