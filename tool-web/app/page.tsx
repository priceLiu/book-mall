import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>AI 工具站</h1>
      <p>
        本目录为仓库内<strong>独立 Next 应用</strong>，默认端口 <code>3001</code>
        ，与主站分离进程运行。
      </p>
      <p>
        请从主站个人中心点击「打开试衣间」跳转至此（带 SSO <code>code</code>
        ）；或先登录主站并完成黄金会员条件后使用入口。
      </p>
      <ul>
        <li>
          <Link href="/fitting-room">试衣间占位页</Link>（需已通过 SSO 写入 Cookie）
        </li>
      </ul>
      <p style={{ fontSize: "0.9rem", color: "#555" }}>
        配置说明见本目录 <code>README.md</code> 与主站文档{" "}
        <code>book-mall/doc/tech/tools-sso-environment.md</code>
        。
      </p>
    </main>
  );
}
