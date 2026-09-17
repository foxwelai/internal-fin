"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  FolderPlus,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  RefreshCw,
  Trash2,
  Trophy,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LeadDialog, type LeadInitial } from "@/components/dialogs/lead-dialog";
import { ProjectDialog } from "@/components/dialogs/project-dialog";
import { ConfirmAction, InlineAction } from "@/components/finance/confirm-action";
import { convertLead, deleteLead, setLeadStage } from "@/app/actions/leads";
import type { ClientOption } from "@/components/finance/options";
import { whatsappNumber } from "@/lib/phone";

export function LeadRowActions({
  lead,
  clientId,
  clients,
  canWrite,
  canDelete,
}: {
  lead: LeadInitial;
  clientId: string | null;
  clients: ClientOption[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  const [confirm, setConfirm] = React.useState<null | "won" | "delete">(null);
  const editTrigger = React.useRef<HTMLButtonElement>(null);
  const projectTrigger = React.useRef<HTMLButtonElement>(null);
  const won = lead.stage === "WON";
  const whatsapp = whatsappNumber(lead.phone);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${lead.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem asChild>
            <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}>
              <Phone />
              Call {lead.clientName.split(/\s+/)[0]}
            </a>
          </DropdownMenuItem>
          {whatsapp ? (
            <DropdownMenuItem asChild>
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">
                <MessageCircle />
                WhatsApp
              </a>
            </DropdownMenuItem>
          ) : null}

          {won && clientId ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/clients/${clientId}`}>
                  <Building2 />
                  Open client
                </Link>
              </DropdownMenuItem>
              {canWrite ? (
                <DropdownMenuItem onSelect={() => setTimeout(() => projectTrigger.current?.click(), 0)}>
                  <FolderPlus />
                  Add project
                </DropdownMenuItem>
              ) : null}
            </>
          ) : null}

          {canWrite ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setTimeout(() => editTrigger.current?.click(), 0)}>
                <Pencil />
                Edit lead
              </DropdownMenuItem>
              {!won ? (
                <>
                  <DropdownMenuItem onSelect={() => setTimeout(() => setConfirm("won"), 0)}>
                    <Trophy className="text-positive" />
                    Mark as won → client
                  </DropdownMenuItem>
                  <DropdownMenuLabel>Move to</DropdownMenuLabel>
                  {(["JUST_SPOKE", "IN_PROCESS", "LOST"] as const)
                    .filter((stage) => stage !== lead.stage)
                    .map((stage) => (
                      <DropdownMenuItem key={stage} asChild>
                        <div>
                          <InlineAction action={setLeadStage} hidden={{ id: lead.id, stage }}>
                            {stage === "LOST" ? (
                              <XCircle className="size-4 text-negative" />
                            ) : (
                              <RefreshCw className="size-4 text-faint-foreground" />
                            )}
                            {stage === "JUST_SPOKE" ? "Just spoke" : stage === "IN_PROCESS" ? "In process" : "Closed — lost"}
                          </InlineAction>
                        </div>
                      </DropdownMenuItem>
                    ))}
                </>
              ) : null}
            </>
          ) : null}

          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setTimeout(() => setConfirm("delete"), 0)}>
                <Trash2 />
                Delete lead
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {canWrite ? (
        <LeadDialog initial={lead}>
          <button type="button" ref={editTrigger} className="sr-only" aria-hidden tabIndex={-1} />
        </LeadDialog>
      ) : null}

      {canWrite && won && clientId ? (
        <ProjectDialog clients={clients} defaultClientId={clientId}>
          <button type="button" ref={projectTrigger} className="sr-only" aria-hidden tabIndex={-1} />
        </ProjectDialog>
      ) : null}

      <ConfirmAction
        open={confirm === "won"}
        onOpenChange={(open) => setConfirm(open ? "won" : null)}
        action={convertLead}
        hidden={{ id: lead.id }}
        title={`Mark ${lead.name} as won?`}
        description="The lead closes as won and the company is added to Clients with all its contact details — or linked, if a client with that name already exists. You can then add their project straight from here."
        confirmLabel="Won — make client"
      />

      <ConfirmAction
        open={confirm === "delete"}
        onOpenChange={(open) => setConfirm(open ? "delete" : null)}
        action={deleteLead}
        hidden={{ id: lead.id }}
        title={`Delete the lead for ${lead.name}?`}
        description={
          won
            ? "Only the lead record is removed. The client and their projects stay exactly as they are."
            : "The lead is removed permanently and drops out of the projection."
        }
        confirmLabel="Delete lead"
      />
    </>
  );
}

/** Shown on a won lead that has no project yet — the obvious next step. */
export function AddProjectForLead({ clientId, clients }: { clientId: string; clients: ClientOption[] }) {
  return (
    <ProjectDialog clients={clients} defaultClientId={clientId}>
      <Button size="sm" variant="outline" className="h-7 px-2 text-[12px]">
        <FolderPlus />
        Add project
      </Button>
    </ProjectDialog>
  );
}
