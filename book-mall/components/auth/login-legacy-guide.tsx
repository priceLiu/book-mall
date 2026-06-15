import Link from "next/link";

export function LoginLegacyGuide() {
  return (
    <p className="text-center text-sm text-neutral-600 dark:text-neutral-300">
      <Link
        href="/legacy/bind-phone"
        className="font-medium text-blue-600 outline-none hover:underline dark:text-blue-400"
      >
        邮箱账号绑定手机号
      </Link>
    </p>
  );
}
