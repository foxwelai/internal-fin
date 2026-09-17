"use client";

import * as React from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { setPersonAccess } from "@/app/actions/users";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/permissions";
import type { AccessLevel, Person, PersonState } from "@/lib/people";
import { IDLE, type ActionState } from "@/app/actions/state";

/** Serialisable person — dates travel as ISO strings. */
export type PersonRow = Omit<Person, "signedUpAt" | "lastSignInAt"> & {
  signedUpAt: string | null;
  lastSignInAt: string | null;
  isSelf: boolean;
  isLastSuperAdmin: boolean;
};

const ACCESS_OPTIONS: { value: AccessLevel; label: string }[] = [
  { value: "NONE", label: "No access" },
  { value: "VIEWER", label: ROLE_LABELS.VIEWER },
  { value: "ADMIN", label: ROLE_LABELS.ADMIN },
  { value: "SUPER_ADMIN", label: ROLE_LABELS.SUPER_ADMIN },
];

const STATE_BADGE: Record<PersonState, { label: string; variant: "warning" | "positive" | "outline" | "default" }> = {
  "needs-access": { label: "Waiting for access", variant: "warning" },
  approved: { label: "Has access", variant: "positive" },
  invited: { label: "Not signed up yet", variant: "outline" },
  "no-access": { label: "No access", variant: "default" },
};

function formatWhen(iso: string | null): string {
  if (!iso) return "never";
  const date = new Date(iso);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

/**
 * Everyone who has signed up, with their access as a dropdown. Changing it
 * saves immediately. Granting Super Admin — root access — asks first.
 */
export function PeopleList({ people }: { people: PersonRow[] }) {
  if (people.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-[13px] text-muted-foreground sm:px-5">
        Nobody has signed up yet. Share the sign-in link and people appear here as soon as they do.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {people.map((person) => (
        <PersonItem key={person.key} person={person} />
      ))}
    </ul>
  );
}

function PersonItem({ person }: { person: PersonRow }) {
  const [value, setValue] = React.useState<AccessLevel>(person.access);
  const [pendingSuperAdmin, setPendingSuperAdmin] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  // The result is handled where it arrives, not in an effect: a refused change
  // snaps the dropdown straight back to what the server holds.
  const [, formAction, isPending] = React.useActionState(
    async (previous: ActionState, formData: FormData) => {
      const result = await setPersonAccess(previous, formData);
      if (result.status === "success") {
        if (result.message) toast.success(result.message);
      } else {
        if (result.message) toast.error(result.message);
        setValue(person.access);
      }
      return result;
    },
    IDLE,
  );

  // The server's answer wins: keep the dropdown in step when the page
  // re-renders after a save, and snap back if a change was refused.
  const [syncedAccess, setSyncedAccess] = React.useState(person.access);
  if (syncedAccess !== person.access) {
    setSyncedAccess(person.access);
    setValue(person.access);
  }


  const submit = (next: AccessLevel) => {
    setValue(next);
    // Let React commit the new hidden value before the form is read.
    requestAnimationFrame(() => formRef.current?.requestSubmit());
  };

  const locked = person.isSelf || person.isLastSuperAdmin;
  const lockReason = person.isSelf
    ? "This is you — another super admin must change your access."
    : person.isLastSuperAdmin
      ? "The only active super admin can't be changed until someone else is made one."
      : null;

  const badge = STATE_BADGE[person.state];
  const initials =
    person.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";

  return (
    <li
      className={cn(
        "flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5",
        person.state === "needs-access" && "bg-warning-soft/40",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {person.imageUrl ? (
          <Image
            src={person.imageUrl}
            alt=""
            width={36}
            height={36}
            className="size-9 shrink-0 rounded-full border border-border object-cover"
          />
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-3 text-[12px] font-semibold text-muted-foreground">
            {initials}
          </span>
        )}
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium">
            <span className="truncate">{person.name}</span>
            {person.isSelf ? <span className="text-[11px] font-normal text-faint-foreground">you</span> : null}
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </p>
          <p className="truncate font-mono tabular text-[12px] text-muted-foreground">
            {person.email ?? "no email"}
          </p>
          <p className="mt-0.5 text-[11px] text-faint-foreground">
            {person.signedUpAt ? `Signed up ${formatWhen(person.signedUpAt)}` : "Hasn't signed up"}
            {person.signedUpAt ? ` · last sign-in ${formatWhen(person.lastSignInAt)}` : ""}
          </p>
        </div>
      </div>

      <form ref={formRef} action={formAction} className="flex shrink-0 items-center gap-2 sm:justify-end">
        {person.userId ? <input type="hidden" name="userId" value={person.userId} /> : null}
        {person.clerkUserId ? <input type="hidden" name="clerkUserId" value={person.clerkUserId} /> : null}
        <input type="hidden" name="access" value={value} />

        {isPending ? <Loader2 className="size-4 animate-spin text-faint-foreground" aria-label="Saving" /> : null}

        <label className="sr-only" htmlFor={`access-${person.key}`}>
          Access for {person.name}
        </label>
        <select
          id={`access-${person.key}`}
          value={value}
          disabled={locked || isPending}
          title={lockReason ?? undefined}
          onChange={(event) => {
            const next = event.target.value as AccessLevel;
            if (next === "SUPER_ADMIN") {
              setPendingSuperAdmin(true);
              return;
            }
            submit(next);
          }}
          className={cn(
            "h-9 w-full rounded-md border bg-surface-2 px-2.5 text-[13px] text-foreground sm:w-40",
            "hover:border-border-strong focus-visible:border-brand-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35",
            "disabled:cursor-not-allowed disabled:opacity-60",
            value === "NONE" ? "border-border" : "border-brand-line",
          )}
        >
          {ACCESS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </form>

      {lockReason ? <p className="text-[11px] text-faint-foreground sm:hidden">{lockReason}</p> : null}

      <AlertDialog open={pendingSuperAdmin} onOpenChange={setPendingSuperAdmin}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Make {person.name} a Super Admin?</AlertDialogTitle>
            <AlertDialogDescription>
              Super Admin is root access: {person.name} will be able to see and change everything,
              approve or remove anyone — including you — and edit company settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-brand text-brand-foreground hover:bg-brand-hover"
              onClick={() => submit("SUPER_ADMIN")}
            >
              Give root access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
