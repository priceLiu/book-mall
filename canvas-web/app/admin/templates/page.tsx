import type { Metadata } from "next";
import { TemplatesAdminClient } from "./templates-admin-client";

export const metadata: Metadata = {
  title: "模板管理",
};

export default function AdminTemplatesPage() {
  return <TemplatesAdminClient />;
}
