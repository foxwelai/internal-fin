import Image from "next/image";
import { SignOutButton } from "@clerk/nextjs";
import { Clock, ShieldX, UserX } from "lucide-react";

import { Button } from "@/components/ui/button";

type GateReason =
  | "pending"
  | "declined"
  | "deactivated"
  | "unverified-email"
  | "no-email"
  | "email-owned-by-another-account";

const COPY: Record<
  GateReason,
  { icon: typeof Clock; tone: "wait" | "stop"; title: string; body: string }
> = {
  pending: {
    icon: Clock,
    tone: "wait",
    title: "Waiting for approval",
    body: "You're signed in. A super admin needs to approve your access before you can see anything here. There's nothing else to do — reload this page once they have.",
  },
  declined: {
    icon: ShieldX,
    tone: "stop",
    title: "Access not approved",
    body: "A super admin has declined this request. If you think that's a mistake, contact them directly.",
  },
  deactivated: {
    icon: UserX,
    tone: "stop",
    title: "Access switched off",
    body: "Your account has been deactivated by a super admin. Contact them if you need access again.",
  },
  "unverified-email": {
    icon: ShieldX,
    tone: "stop",
    title: "Verify your email first",
    body: "Your email address hasn't been verified yet, so access can't be granted to it. Verify it from your Clerk account, then reload.",
  },
  "no-email": {
    icon: ShieldX,
    tone: "stop",
    title: "An email address is needed",
    body: "This sign-in has no email address, and access is granted by email. Add one to your account, then reload.",
  },
  "email-owned-by-another-account": {
    icon: ShieldX,
    tone: "stop",
    title: "This email is already linked",
    body: "Access for this email belongs to a different sign-in. Sign out and use the account it was set up with, or ask a super admin.",
  },
};

/**
 * What a signed-in but unapproved person sees, instead of the app.
 *
 * Rendered by the layout *before* any financial data is loaded, so nothing
 * reaches the browser — this is not an overlay drawn on top of the dashboard.
 */
export function AccessGate({ reason, email }: { reason: GateReason; email: string | null }) {
  const copy = COPY[reason];
  const Icon = copy.icon;

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-12">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid opacity-[0.3]" />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(244,85,29,0.14),transparent_65%)] blur-2xl"
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="gate-title"
        aria-describedby="gate-body"
        className="relative w-full max-w-sm rounded-2xl border border-border-strong bg-elevated p-6 text-center shadow-[0_24px_64px_-24px_rgba(0,0,0,0.95)]"
      >
        <Image
          src="/logo-mark.png"
          alt="foxwel.ai"
          width={30}
          height={37}
          className="mx-auto h-8 w-auto"
          priority
        />

        <div
          className={
            copy.tone === "wait"
              ? "mx-auto mt-5 flex size-11 items-center justify-center rounded-full border border-warning/35 bg-warning-soft"
              : "mx-auto mt-5 flex size-11 items-center justify-center rounded-full border border-negative/35 bg-negative-soft"
          }
        >
          <Icon className={copy.tone === "wait" ? "size-5 text-warning" : "size-5 text-negative"} />
        </div>

        <h1 id="gate-title" className="mt-4 text-lg font-semibold tracking-tight">
          {copy.title}
        </h1>
        <p id="gate-body" className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {copy.body}
        </p>

        {email ? (
          <p className="mt-4 rounded-md border border-border bg-surface-2 px-3 py-2 font-mono tabular text-[12px] text-muted-foreground">
            {email}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          {copy.tone === "wait" ? (
            <Button asChild>
              <a href="/overview">Check again</a>
            </Button>
          ) : null}
          <SignOutButton redirectUrl="/sign-in">
            <Button variant="outline">Sign out</Button>
          </SignOutButton>
        </div>
      </div>
    </main>
  );
}
