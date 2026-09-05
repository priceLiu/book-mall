import { redirect } from "next/navigation";

export default function WorkflowsIndexPage() {
  redirect("/workflows/drafts");
}
