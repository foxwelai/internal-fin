import { addMonths, compareMonthKeys, formatMonthKey, monthKeyOf, todayInIST, type MonthKey } from "@/lib/dates";
import type { Paise } from "@/lib/money";

/**
 * The sales pipeline, worked out from plain lead records.
 *
 * A projection is only as honest as its weighting, so every open lead is
 * counted at a win probability set by how far it has got (stage) and how
 * likely it looked (quality) — never at its full value.
 */

export const LEAD_STAGES = ["JUST_SPOKE", "IN_PROCESS", "WON", "LOST"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];
export const OPEN_LEAD_STAGES = ["JUST_SPOKE", "IN_PROCESS"] as const satisfies readonly LeadStage[];

export const LEAD_QUALITIES = ["HOT", "WARM", "COLD"] as const;
export type LeadQuality = (typeof LEAD_QUALITIES)[number];

export const LEAD_SOURCES = [
  "REFERRAL",
  "WEBSITE",
  "SOCIAL",
  "OUTREACH",
  "EVENT",
  "EXISTING_CLIENT",
  "OTHER",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

/** Chance of closing, in whole percent. Won is certain; lost is nothing. */
export const WIN_PROBABILITY: Record<LeadStage, Record<LeadQuality, number>> = {
  JUST_SPOKE: { HOT: 25, WARM: 15, COLD: 5 },
  IN_PROCESS: { HOT: 60, WARM: 40, COLD: 20 },
  WON: { HOT: 100, WARM: 100, COLD: 100 },
  LOST: { HOT: 0, WARM: 0, COLD: 0 },
};

export type PipelineLead = {
  stage: LeadStage;
  quality: LeadQuality;
  source: LeadSource | null;
  expectedValuePaise: Paise | null;
  /** First of the month it should close in. */
  expectedCloseMonth: Date | null;
  createdAt: Date;
  closedOn: Date | null;
};

export const isOpenLead = (lead: { stage: LeadStage }) =>
  lead.stage === "JUST_SPOKE" || lead.stage === "IN_PROCESS";

export function winProbability(lead: Pick<PipelineLead, "stage" | "quality">): number {
  return WIN_PROBABILITY[lead.stage][lead.quality];
}

/** Expected value × probability, in whole paise (rounded down). */
export function weightedValue(lead: Pick<PipelineLead, "stage" | "quality" | "expectedValuePaise">): Paise {
  if (lead.expectedValuePaise === null) return 0n;
  return (lead.expectedValuePaise * BigInt(winProbability(lead))) / 100n;
}

export type ProjectionPoint = {
  key: string;
  month: MonthKey | null;
  kind: "slipped" | "month" | "unscheduled";
  count: number;
  pipelinePaise: Paise;
  weightedPaise: Paise;
};

/**
 * Open leads by the month they should close, from `from` for `months` months.
 * Leads whose month has already passed are gathered as "slipped" rather than
 * silently dropped, and leads with no month as "unscheduled".
 */
export function projectLeads(leads: readonly PipelineLead[], from: MonthKey, months = 6): ProjectionPoint[] {
  const slipped: ProjectionPoint = { key: "slipped", month: null, kind: "slipped", count: 0, pipelinePaise: 0n, weightedPaise: 0n };
  const unscheduled: ProjectionPoint = { key: "unscheduled", month: null, kind: "unscheduled", count: 0, pipelinePaise: 0n, weightedPaise: 0n };
  const window: ProjectionPoint[] = Array.from({ length: months }, (_, index) => {
    const month = addMonths(from, index);
    return { key: formatMonthKey(month), month, kind: "month", count: 0, pipelinePaise: 0n, weightedPaise: 0n };
  });
  const last = addMonths(from, months - 1);

  for (const lead of leads) {
    if (!isOpenLead(lead)) continue;
    let bucket: ProjectionPoint | undefined;
    if (!lead.expectedCloseMonth) bucket = unscheduled;
    else {
      const month = monthKeyOf(lead.expectedCloseMonth);
      if (compareMonthKeys(month, from) < 0) bucket = slipped;
      else if (compareMonthKeys(month, last) <= 0) bucket = window.find((point) => point.key === formatMonthKey(month));
    }
    if (!bucket) continue; // further out than the window
    bucket.count += 1;
    bucket.pipelinePaise += lead.expectedValuePaise ?? 0n;
    bucket.weightedPaise += weightedValue(lead);
  }

  return [...(slipped.count > 0 ? [slipped] : []), ...window, ...(unscheduled.count > 0 ? [unscheduled] : [])];
}

export type FlowPoint = {
  month: MonthKey;
  added: number;
  won: number;
  lost: number;
  wonValuePaise: Paise;
};

/** New, won and lost leads per month, for the `months` months ending at `to`. */
export function leadFlow(leads: readonly PipelineLead[], to: MonthKey, months = 6): FlowPoint[] {
  const points = Array.from({ length: months }, (_, index) => ({
    month: addMonths(to, index - (months - 1)),
    added: 0,
    won: 0,
    lost: 0,
    wonValuePaise: 0n,
  }));
  const find = (month: MonthKey) => points.find((point) => compareMonthKeys(point.month, month) === 0);

  for (const lead of leads) {
    // `createdAt` is an instant; the month it counts in is India's.
    const added = find(monthKeyOf(todayInIST(lead.createdAt)));
    if (added) added.added += 1;
    if (lead.closedOn && (lead.stage === "WON" || lead.stage === "LOST")) {
      const closed = find(monthKeyOf(lead.closedOn));
      if (closed && lead.stage === "WON") {
        closed.won += 1;
        closed.wonValuePaise += lead.expectedValuePaise ?? 0n;
      } else if (closed) closed.lost += 1;
    }
  }
  return points;
}

export type Tally = { count: number; open: number; won: number; lost: number; pipelinePaise: Paise; weightedPaise: Paise };

const emptyTally = (): Tally => ({ count: 0, open: 0, won: 0, lost: 0, pipelinePaise: 0n, weightedPaise: 0n });

/** Won ÷ decided, as a whole percent; null until something has closed. */
export function winRate(tally: Pick<Tally, "won" | "lost">): number | null {
  const decided = tally.won + tally.lost;
  return decided === 0 ? null : Math.round((tally.won / decided) * 100);
}

export function summarizeLeads(leads: readonly PipelineLead[]) {
  const all = emptyTally();
  const byStage = Object.fromEntries(LEAD_STAGES.map((stage) => [stage, emptyTally()])) as Record<LeadStage, Tally>;
  const byQuality = Object.fromEntries(LEAD_QUALITIES.map((quality) => [quality, emptyTally()])) as Record<LeadQuality, Tally>;
  const bySource = new Map<LeadSource | "UNKNOWN", Tally>();

  for (const lead of leads) {
    const source = lead.source ?? "UNKNOWN";
    if (!bySource.has(source)) bySource.set(source, emptyTally());
    for (const tally of [all, byStage[lead.stage], byQuality[lead.quality], bySource.get(source)!]) {
      tally.count += 1;
      if (isOpenLead(lead)) {
        tally.open += 1;
        tally.pipelinePaise += lead.expectedValuePaise ?? 0n;
        tally.weightedPaise += weightedValue(lead);
      } else if (lead.stage === "WON") tally.won += 1;
      else tally.lost += 1;
    }
  }

  return { all, byStage, byQuality, bySource };
}
