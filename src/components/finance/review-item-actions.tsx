"use client";

import * as React from "react";
import { Ban, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/finance/confirm-action";
import { deleteClientReview, revokeReviewLink } from "@/app/actions/reviews";

export function ReviewItemActions({
  id,
  name,
  submitted,
}: {
  id: string;
  name: string;
  submitted: boolean;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label={submitted ? `Delete review from ${name}` : `Cancel link sent to ${name}`}
        title={submitted ? "Delete review" : "Cancel link"}
      >
        {submitted ? <Trash2 /> : <Ban />}
      </Button>
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        action={submitted ? deleteClientReview : revokeReviewLink}
        hidden={{ id }}
        title={submitted ? `Delete ${name}'s review?` : `Cancel the link sent to ${name}?`}
        description={
          submitted
            ? "The review is removed permanently."
            : "The link stops working. You can always send a new one."
        }
        confirmLabel={submitted ? "Delete review" : "Cancel link"}
      />
    </>
  );
}
