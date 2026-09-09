import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { permissionsFor } from "@/lib/permissions";
import { PermissionProvider } from "@/components/auth/permission-provider";
import { ReadOnlyBanner } from "@/components/auth/read-only-banner";
import { currentMonthKey, todayInIST, toDateInputValue } from "@/lib/dates";
import { loadPickerOptions } from "@/lib/finance/view-data";
import { MobileNav, Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

/**
 * The authenticated shell.
 *
 * This redirect is the front door, but it is not the lock: every server action
 * and protected read calls `requireUser()` itself, because Server Actions are
 * reachable over HTTP whether or not a page rendered them.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Read from the database, not the token: an account deactivated or deleted
  // mid-session is turned away on its very next request.
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login");

  const { clients, projects } = await loadPickerOptions();
  const currentMonth = currentMonthKey();

  return (
    <PermissionProvider
      viewer={{
        id: viewer.id,
        name: viewer.name,
        email: viewer.email,
        role: viewer.role,
        permissions: permissionsFor(viewer.role),
      }}
    >
      <div className="min-h-dvh">
        <Sidebar />
        <div className="lg:pl-60">
          <Topbar
            currentMonth={currentMonth}
            clients={clients}
            projects={projects}
            today={toDateInputValue(todayInIST())}
            user={viewer}
          />
          <main className="mx-auto w-full max-w-[1400px] px-4 pb-24 pt-5 sm:px-6 sm:pb-10 lg:pb-12">
            <ReadOnlyBanner />
            {children}
          </main>
        </div>
        <MobileNav />
      </div>
    </PermissionProvider>
  );
}
