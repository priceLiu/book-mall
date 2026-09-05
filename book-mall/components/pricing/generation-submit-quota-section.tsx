import {
  getSubmitQuotaTierRows,
  SUBMIT_WINDOW_SEC,
} from "@/lib/generation/submit-rate/constants";

type Props = {
  embedded?: boolean;
};

export function GenerationSubmitQuotaSection({ embedded = false }: Props) {
  const rows = getSubmitQuotaTierRows();

  return (
    <section className={embedded ? "space-y-4" : "mt-12 space-y-4"}>
      <h2 className="text-lg font-semibold">三、生成任务提交频率（参考）</h2>
      <p className="text-sm text-muted-foreground">
        经平台 Gateway 发起的<strong className="text-foreground">新生成请求</strong>，在任意连续{" "}
        <strong className="text-foreground">{SUBMIT_WINDOW_SEC} 秒</strong>内存在短时 burst 上限。
        超出上限时接口将返回「请稍后重试」，不计入成功扣费。个人项目按<strong className="text-foreground">个人空间</strong>
        计数；团队项目按<strong className="text-foreground">团队空间</strong>计数（同一团队内成员共享该上限）。
      </p>
      <div className="overflow-x-auto rounded-lg border border-secondary">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-secondary bg-muted/50">
            <tr>
              <th className="p-3 font-medium">档位</th>
              <th className="p-3 font-medium">
                {SUBMIT_WINDOW_SEC} 秒内新提交上限
              </th>
              <th className="p-3 font-medium">说明</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.tier} className="border-b border-secondary/80 last:border-0">
                <td className="p-3 font-medium text-foreground">{row.label}</td>
                <td className="p-3 tabular-nums">
                  {row.tier === "HEAVY" ? (
                    <>
                      平台核定（公示默认{" "}
                      <span className="font-medium text-foreground">{row.burstLimit}</span> 次，可上调）
                    </>
                  ) : (
                    <span className="font-medium text-foreground">{row.burstLimit} 次</span>
                  )}
                </td>
                <td className="p-3 text-muted-foreground">{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        档位由平台运营配置；未单独配置的账号在热路径按最差「普通」档处理。具体以实际调用时的接口提示为准。
      </p>
    </section>
  );
}
