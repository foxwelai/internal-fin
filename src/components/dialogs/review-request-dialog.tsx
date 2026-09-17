"use client";

import * as React from "react";
import { Check, Copy, Loader2, Mail, MessageCircle, MessageSquare, Share2, UserRound, Users } from "lucide-react";
import { toast } from "sonner";

import { createReviewLink } from "@/app/actions/reviews";
import { IDLE, type ActionState } from "@/app/actions/state";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/finance/form-kit";
import { whatsappNumber } from "@/lib/phone";
import { cn } from "@/lib/utils";

type Recipient = "CLIENT" | "POINT_OF_CONTACT";

export type ReviewContacts = {
  companyName: string;
  clientName: string | null;
  clientPhone: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  email: string | null;
};

/**
 * Makes a new review link each time it is used, then offers every way to get
 * it to the client from wherever the team is — WhatsApp and SMS on a phone,
 * email, the share sheet, or a plain copy.
 */
export function ReviewRequestDialog({
  children,
  project,
  contacts,
}: {
  children: React.ReactNode;
  project: { id: string; name: string };
  contacts: ReviewContacts;
}) {
  const [open, setOpen] = React.useState(false);
  const [recipient, setRecipient] = React.useState<Recipient>("CLIENT");
  const [link, setLink] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [canShare, setCanShare] = React.useState(false);

  const [state, formAction, pending] = React.useActionState(
    async (previous: ActionState, formData: FormData) => {
      const result = await createReviewLink(previous, formData);
      if (result.status === "success" && result.createdId) {
        setLink(`${window.location.origin}/review/${result.createdId}`);
        setCopied(false);
      }
      return result;
    },
    IDLE,
  );

  const people = {
    CLIENT: { label: "Client", name: contacts.clientName, phone: contacts.clientPhone, icon: UserRound },
    POINT_OF_CONTACT: {
      label: "Point of contact",
      name: contacts.contactPerson,
      phone: contacts.contactPhone,
      icon: Users,
    },
  } as const;
  const chosen = people[recipient];
  const firstName = (chosen.name ?? contacts.companyName).split(/\s+/)[0];
  const message = link
    ? `Hi ${firstName}, thank you for working with Foxwel on ${project.name}. We'd really value your feedback — it takes about a minute: ${link}`
    : "";
  const whatsapp = whatsappNumber(chosen.phone);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setLink(null);
      setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success("Message and link copied.");
    } catch {
      toast.error("Couldn't copy — select the link and copy it by hand.");
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: "Share your feedback with Foxwel", text: message });
    } catch {
      /* dismissed */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ask for a client review</DialogTitle>
          <DialogDescription>
            {project.name} · {contacts.companyName}. Each link works once and expires in 30 days.
          </DialogDescription>
        </DialogHeader>

        {link === null ? (
          <form action={formAction} className="contents">
            <input type="hidden" name="projectId" value={project.id} />
            <input type="hidden" name="recipient" value={recipient} />
            <DialogBody className="space-y-3">
              <FormAlert state={state} />
              <p className="text-[13px] font-medium text-muted-foreground">Who should review?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(people) as Recipient[]).map((key) => {
                  const person = people[key];
                  const Icon = person.icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setRecipient(key)}
                      aria-pressed={recipient === key}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors",
                        recipient === key
                          ? "border-brand-line bg-brand/10"
                          : "border-border bg-surface-2 hover:border-border-strong",
                      )}
                    >
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint-foreground">
                        <Icon className="size-3.5" />
                        {person.label}
                      </span>
                      <span className="mt-1 block text-[14px] font-medium">
                        {person.name ?? <span className="text-muted-foreground">Not recorded</span>}
                      </span>
                      <span className="block font-mono tabular text-[12px] text-muted-foreground">
                        {person.phone ?? "No phone"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : null}
                Create review link
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <DialogBody className="space-y-4">
              <div className="rounded-lg border border-border bg-surface-2 p-3">
                <p className="text-[12px] text-muted-foreground">
                  For {chosen.label.toLowerCase()} <span className="text-foreground">{chosen.name ?? contacts.companyName}</span>
                </p>
                <p className="mt-1.5 break-all font-mono text-[12px] leading-relaxed text-foreground">{link}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {whatsapp ? (
                  <Button asChild variant="outline" className="justify-start">
                    <a
                      href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="text-positive" />
                      WhatsApp
                    </a>
                  </Button>
                ) : null}
                {chosen.phone ? (
                  <Button asChild variant="outline" className="justify-start">
                    <a href={`sms:${chosen.phone.replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(message)}`}>
                      <MessageSquare />
                      SMS
                    </a>
                  </Button>
                ) : null}
                {contacts.email ? (
                  <Button asChild variant="outline" className="justify-start">
                    <a
                      href={`mailto:${contacts.email}?subject=${encodeURIComponent(`Your feedback on ${project.name}`)}&body=${encodeURIComponent(message)}`}
                    >
                      <Mail />
                      Email
                    </a>
                  </Button>
                ) : null}
                {canShare ? (
                  <Button type="button" variant="outline" className="justify-start" onClick={share}>
                    <Share2 />
                    Share…
                  </Button>
                ) : null}
                <Button type="button" variant="outline" className="justify-start" onClick={copy}>
                  {copied ? <Check className="text-positive" /> : <Copy />}
                  {copied ? "Copied" : "Copy message"}
                </Button>
              </div>
              <p className="text-[12px] leading-relaxed text-faint-foreground">
                The review appears under Client reviews on this project as soon as it&rsquo;s sent.
              </p>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setLink(null)}>
                New link
              </Button>
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
