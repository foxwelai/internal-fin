import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";

import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthShell
      title="Foxwel Finance"
      subtitle="Sign in to continue. New here? Create an account and a super admin will approve your access."
      switchPrompt="Don't have an account?"
      switchHref="/sign-up"
      switchLabel="Sign up"
    >
      <SignIn />
    </AuthShell>
  );
}
