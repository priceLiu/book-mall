import { LegacyEmailBindPhoneForm } from "@/components/auth/legacy-email-bind-phone-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "邮箱账号绑定手机号 — AI Mall",
};

export default function LegacyBindPhonePage() {
  return <LegacyEmailBindPhoneForm />;
}
