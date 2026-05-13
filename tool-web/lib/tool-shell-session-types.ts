/** 工具站壳层会话（纯类型；客户端与服务端共用，避免循环依赖） */
export type ToolShellSession = {
  active: boolean;
  email: string | null;
  name: string | null;
  /** 主站 User.image（OAuth 等）；邮箱注册用户多为空 */
  image: string | null;
  /** introspect / JWT 的 subject（邮箱缺失时为稳定标识） */
  sub: string | null;
  toolsRole: string | null;
  /** 主站下发的可用工具套件 navKey；管理员侧栏仍展示全集（由壳层处理） */
  toolsNavKeys: string[] | null;
};

export const GUEST_TOOL_SHELL_SESSION: ToolShellSession = {
  active: false,
  email: null,
  name: null,
  image: null,
  sub: null,
  toolsRole: null,
  toolsNavKeys: null,
};
