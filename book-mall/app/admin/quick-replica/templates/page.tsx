import { redirect } from "next/navigation";

export default function AdminQuickReplicaTemplatesRedirect() {
  redirect("/admin/templates?tab=quick-replica");
}
