/** 跨域拉 book-mall 失败时的登录指引（生产用主站公网域，本地用 localhost:3000） */
export function bookMallLoginHint(
  base: string,
  role: "admin" | "user",
): { loginUrl: string; text: string } {
  const loginUrl = base.trim() ? `${base.replace(/\/$/, "")}/login` : "https://book.ai-code8.com/login";
  const site = base.trim() || "https://book.ai-code8.com";
  if (role === "admin") {
    return {
      loginUrl,
      text: `请确认：① 主站 ${site} 可访问；② 同浏览器以管理员登录主站（打开 ${loginUrl}），再回到本页刷新。`,
    };
  }
  return {
    loginUrl,
    text: `请确认：① 主站 ${site} 可访问；② 同浏览器登录主站（${loginUrl}），再回到本页刷新。`,
  };
}
