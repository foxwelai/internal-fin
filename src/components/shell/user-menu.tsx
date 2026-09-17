"use client";

import { UserButton } from "@clerk/nextjs";
import { Settings } from "lucide-react";

import { useViewer } from "@/components/auth/permission-provider";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/permissions";

/**
 * Clerk's account button: profile, password, MFA and sign-out all live there.
 * The role beside it comes from our database, because Clerk does not decide
 * what anyone may see here.
 */
export function UserMenu() {
  const viewer = useViewer();

  return (
    <div className="flex items-center gap-2">
      <Badge
        variant={viewer.role === "SUPER_ADMIN" ? "brand" : "default"}
        className="hidden sm:inline-flex"
      >
        {ROLE_LABELS[viewer.role]}
      </Badge>
      <UserButton
        appearance={{ elements: { avatarBox: "size-8" } }}
      >
        <UserButton.MenuItems>
          <UserButton.Link label="Settings" labelIcon={<Settings className="size-4" />} href="/settings" />
        </UserButton.MenuItems>
      </UserButton>
    </div>
  );
}
