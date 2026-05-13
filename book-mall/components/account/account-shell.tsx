import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AccountHeaderActions } from "@/components/account/account-header-actions";

export function AccountShell({
  profile,
  isAdmin,
  showCoursesCta,
  showToolsCta,
  canLaunchTools,
  children,
}: {
  profile: { image: string | null; name: string | null; email: string | null };
  isAdmin: boolean;
  showCoursesCta: boolean;
  showToolsCta: boolean;
  canLaunchTools: boolean;
  children: React.ReactNode;
}) {
  const initial = (profile.name?.[0] || profile.email?.[0] || "?").toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/85">
        <div className="container mx-auto flex max-w-screen-xl min-h-14 flex-wrap items-center gap-3 px-4 py-2">
          <Avatar className="h-9 w-9 shrink-0 border border-border">
            {profile.image ? (
              <AvatarImage src={profile.image} alt="" referrerPolicy="no-referrer" />
            ) : null}
            <AvatarFallback className="text-sm font-medium">{initial}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">个人中心</p>
            {profile.email ? (
              <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
            ) : null}
          </div>
          <AccountHeaderActions
            isAdmin={isAdmin}
            showCoursesCta={showCoursesCta}
            showToolsCta={showToolsCta}
            canLaunchTools={canLaunchTools}
          />
        </div>
      </header>
      <div className="container w-full max-w-screen-xl px-4 mx-auto">{children}</div>
    </div>
  );
}
