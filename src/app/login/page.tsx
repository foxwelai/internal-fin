import Image from "next/image";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/auth";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  // Checked against the database, not the token. A cookie left over from a
  // deleted or deactivated account must fall through to the form — bouncing it
  // to /overview would only bounce it straight back here.
  const viewer = await getCurrentUser();
  if (viewer) redirect("/overview");

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 py-12">
      {/* A quiet grid and a single warm glow — the terminal at rest. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid opacity-[0.35]" />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(244,85,29,0.16),transparent_65%)] blur-2xl"
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/logo-lockup.png"
            alt="foxwel.ai"
            width={200}
            height={159}
            priority
            className="h-20 w-auto"
          />
          <h1 className="mt-6 text-lg font-semibold tracking-tight">Foxwel Finance</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            Internal financial command centre. Accounts are provisioned by the owner — there is no
            self sign-up.
          </p>
        </div>

        <LoginForm />

        <p className="mt-6 text-center text-[11px] leading-relaxed text-faint-foreground">
          All figures are in Indian rupees and dated in Asia/Kolkata.
        </p>
      </div>
    </main>
  );
}
