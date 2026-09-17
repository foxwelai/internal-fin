import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";

import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <AuthShell
      title="Request access"
      subtitle="Creating an account does not grant access on its own. A super admin reviews every request and chooses your role."
      switchPrompt="Already have an account?"
      switchHref="/sign-in"
      switchLabel="Sign in"
    >
      <SignUp />
    </AuthShell>
  );
}
