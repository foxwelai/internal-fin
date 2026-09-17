import { redirect } from "next/navigation";

import { getAccount } from "@/lib/auth";
import { permissionsFor } from "@/lib/permissions";
import { PermissionProvider } from "@/components/auth/permission-provider";
import { ReadOnlyBanner } from "@/components/auth/read-only-banner";
import { AccessGate } from "@/components/auth/access-gate";
import { currentMonthKey, todayInIST, toDateInputValue } from "@/lib/dates";
import { loadPickerOptions } from "@/lib/finance/view-data";
import { MobileNav, Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

/**
 * The authenticated shell.
 *
 * Clerk says who someone is; our `users` table says whether they get in. The
 * gate runs here, before a single financial query: an unapproved person is
 * handed the waiting screen and the page's data is never loaded, rather than
 * the dashboard being rendered and hidden behind a popup.
 *
 * This is still the front door, not the lock. Every server action and export
 * route re-checks with `requireUser()`, because those are reachable over HTTP
 * whether or not this layout ran.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccount();

  if (account.state === "signed-out") redirect("/sign-in");
  if (account.state === "unlinked") return <AccessGate reason={account.reason} email={account.email} />;
  if (account.state !== "approved") {
    return <AccessGate reason={account.state} email={account.user.email} />;
  }

  const viewer = account.user;
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
