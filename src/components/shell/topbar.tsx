import Image from "next/image";
import Link from "next/link";

import { MonthSelector } from "@/components/shell/month-selector";
import { QuickActions } from "@/components/shell/quick-actions";
import { UserMenu } from "@/components/shell/user-menu";
import type { ClientOption, ProjectOption } from "@/components/finance/options";
import type { MonthKey } from "@/lib/dates";

export function Topbar({
  currentMonth,
  clients,
  projects,
  today,
}: {
  currentMonth: MonthKey;
  clients: ClientOption[];
  projects: ProjectOption[];
  today: string;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-2 px-3 sm:px-6">
        {/* Brand for phones only — from tablet width up the sidebar carries it.
            Below `sm` the mark alone fits; the row is tight at 390px. */}
        <Link href="/overview" className="flex shrink-0 items-center gap-2 md:hidden">
          <Image src="/logo-mark.png" alt="foxwel.ai" width={22} height={27} className="h-6 w-auto" />
          <span className="hidden text-[13px] font-semibold tracking-tight sm:inline">Finance</span>
        </Link>

        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:flex-none sm:gap-2">
          <MonthSelector currentMonth={currentMonth} />
          <QuickActions
            clients={clients}
            projects={projects}
            fallbackMonth={currentMonth}
            today={today}
          />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
