"use client";

import { LogOut, Settings, User } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

import { signOutAction } from "@/app/actions/auth";
import { useViewer } from "@/components/auth/permission-provider";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({ user }: { user: { name?: string | null; email?: string | null } }) {
  const [pending, startTransition] = useTransition();
  const viewer = useViewer();

  const initials =
    (user.name ?? user.email ?? "?")
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full border border-border bg-surface-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
          aria-label="Account menu"
        >
          {initials}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          Signed in
          <Badge variant={viewer.role === "OWNER" ? "brand" : "default"}>
            {ROLE_LABELS[viewer.role]}
          </Badge>
        </DropdownMenuLabel>
        <div className="flex items-center gap-2 px-2.5 pb-2">
          <User className="size-4 text-faint-foreground" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">{user.name ?? "Account"}</p>
            <p className="truncate text-[11px] text-faint-foreground">{user.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          onSelect={(event) => {
            event.preventDefault();
            startTransition(() => {
              void signOutAction();
            });
          }}
        >
          <LogOut />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
