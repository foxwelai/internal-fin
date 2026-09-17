import Image from "next/image";
import type { Metadata } from "next";

import { ReviewForm } from "@/components/review/review-form";
import { prisma } from "@/lib/db";
import { hashReviewToken, isWellFormedReviewToken } from "@/lib/review-link";

/**
 * The page a client opens from their review link. Public — no sign-in — so it
 * shows nothing beyond the project's name and who it was sent to: no figures,
 * no other clients, nothing from the finance side.
 */

export const metadata: Metadata = {
  title: "Share your feedback",
  // The token is in the URL; don't hand it to any site linked from here.
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const request = isWellFormedReviewToken(token)
    ? await prisma.clientReview.findUnique({
        where: { tokenHash: hashReviewToken(token) },
        select: {
          recipientName: true,
          submittedAt: true,
          revokedAt: true,
          expiresAt: true,
          project: { select: { name: true, client: { select: { name: true } } } },
        },
      })
    : null;

  let body: React.ReactNode;
  if (!request || request.revokedAt) {
    body = (
      <Notice
        title="This link isn't valid"
        text="It may have been replaced by a newer one. Ask your Foxwel contact to send a fresh link."
      />
    );
  } else if (request.submittedAt) {
    body = (
      <Notice
        title="Thank you!"
        text="Your review has reached the Foxwel team. We really appreciate you taking the time — you can close this page."
      />
    );
  } else if (request.expiresAt <= new Date()) {
    body = (
      <Notice
        title="This link has expired"
        text="Ask your Foxwel contact to send a new one — it only takes them a moment."
      />
    );
  } else {
    body = (
      <>
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight">How did we do?</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            Hi {request.recipientName.split(/\s+/)[0]}, thank you for working with Foxwel on{" "}
            <span className="text-foreground">{request.project.name}</span> for{" "}
            {request.project.client.name}. A minute of honest feedback helps us a lot.
          </p>
        </div>
        <ReviewForm token={token} defaultName={request.recipientName} />
      </>
    );
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center overflow-hidden px-4 py-10 sm:py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid opacity-[0.35]" />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(244,85,29,0.16),transparent_65%)] blur-2xl"
      />
      <div className="relative w-full max-w-[520px] space-y-6">
        <div className="flex justify-center">
          <Image src="/logo-lockup.png" alt="foxwel.ai" width={200} height={159} priority className="h-14 w-auto" />
        </div>
        <div className="space-y-6 rounded-2xl border border-border bg-card p-5 sm:p-7">{body}</div>
        <p className="text-center text-[12px] text-faint-foreground">
          Sent to you by the Foxwel team · foxwel.ai
        </p>
      </div>
    </main>
  );
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="py-4 text-center">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}
