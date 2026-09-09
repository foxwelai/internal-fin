import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { csvAttachmentHeaders, toCsv, withBom } from "@/lib/csv";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/finance/labels";

/** A filled-in sample so the expected columns are obvious at a glance. */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not authorised" }, { status: 401 });

  const csv = toCsv([
    ["Name", "Category", "Planned amount", "Due date", "Notes"],
    ["Salaries", EXPENSE_CATEGORY_LABELS.SALARIES, "3,60,000", "2026-09-01", "Team of six"],
    ["Office rent", EXPENSE_CATEGORY_LABELS.RENT, "65000", "2026-09-05", ""],
    ["Software & AI subscriptions", EXPENSE_CATEGORY_LABELS.SOFTWARE, "38000.50", "2026-09-03", "Model APIs and design tools"],
    ["Performance marketing", EXPENSE_CATEGORY_LABELS.MARKETING, "45000", "", "Optional due date"],
  ]);

  return new NextResponse(withBom(csv), {
    headers: csvAttachmentHeaders("foxwel-expenses-template.csv"),
  });
}
