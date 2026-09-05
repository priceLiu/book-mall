import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { AiSpaceComposeTaskFloat } from "@/components/ai-space/ai-space-compose-task-float";
import { AiSpaceComposeTasksProvider } from "@/components/ai-space/ai-space-compose-tasks-context";
import { AiSpaceShell } from "@/components/ai-space/ai-space-shell";
import { listAiSpaceComposeTasks } from "@/lib/ai-space/ai-space-compose-query";
import { authOptions } from "@/lib/auth";

export default async function AiSpaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const initialTasks = await listAiSpaceComposeTasks(session.user.id);

  return (
    <AiSpaceComposeTasksProvider initialTasks={initialTasks}>
      <Suspense fallback={null}>
        <AiSpaceShell>{children}</AiSpaceShell>
      </Suspense>
      <AiSpaceComposeTaskFloat />
    </AiSpaceComposeTasksProvider>
  );
}
