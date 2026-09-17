import { describe, expect, it } from "vitest";

import {
  leadFlow,
  projectLeads,
  summarizeLeads,
  weightedValue,
  winRate,
  type PipelineLead,
} from "./leads";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const lead = (overrides: Partial<PipelineLead>): PipelineLead => ({
  stage: "JUST_SPOKE",
  quality: "WARM",
  source: null,
  expectedValuePaise: 100_000_00n,
  expectedCloseMonth: d("2026-09-01"),
  createdAt: new Date("2026-09-05T10:00:00Z"),
  closedOn: null,
  ...overrides,
});

describe("lead pipeline", () => {
  it("weights value by stage and quality, in whole paise", () => {
    expect(weightedValue(lead({ stage: "IN_PROCESS", quality: "HOT" }))).toBe(60_000_00n);
    expect(weightedValue(lead({ stage: "JUST_SPOKE", quality: "COLD", expectedValuePaise: 333n }))).toBe(16n);
    expect(weightedValue(lead({ stage: "LOST" }))).toBe(0n);
    expect(weightedValue(lead({ expectedValuePaise: null }))).toBe(0n);
  });

  it("projects open leads month by month, keeping slipped and undated ones visible", () => {
    const points = projectLeads(
      [
        lead({ expectedCloseMonth: d("2026-09-01"), stage: "IN_PROCESS" }), // 40%
        lead({ expectedCloseMonth: d("2026-10-01"), quality: "HOT" }), // 25%
        lead({ expectedCloseMonth: d("2026-07-01") }), // slipped
        lead({ expectedCloseMonth: null }), // unscheduled
        lead({ expectedCloseMonth: d("2027-06-01") }), // beyond the window
        lead({ stage: "WON", closedOn: d("2026-09-10") }), // not open
      ],
      { year: 2026, month: 9 },
      3,
    );

    expect(points.map((point) => point.key)).toEqual(["slipped", "2026-09", "2026-10", "2026-11", "unscheduled"]);
    expect(points[1]).toMatchObject({ count: 1, pipelinePaise: 100_000_00n, weightedPaise: 40_000_00n });
    expect(points[2]).toMatchObject({ count: 1, weightedPaise: 25_000_00n });
    expect(points[3]).toMatchObject({ count: 0, weightedPaise: 0n });
    expect(points[0].count).toBe(1);
    expect(points[4].count).toBe(1);
  });

  it("counts new leads by India's calendar month and closes by their close date", () => {
    const flow = leadFlow(
      [
        // 20:00 UTC on 31 Aug is already 1 Sep in India.
        lead({ createdAt: new Date("2026-08-31T20:00:00Z") }),
        lead({ createdAt: new Date("2026-08-10T10:00:00Z"), stage: "WON", closedOn: d("2026-09-02") }),
        lead({ createdAt: new Date("2026-08-11T10:00:00Z"), stage: "LOST", closedOn: d("2026-08-20") }),
      ],
      { year: 2026, month: 9 },
      2,
    );
    expect(flow).toEqual([
      { month: { year: 2026, month: 8 }, added: 2, won: 0, lost: 1, wonValuePaise: 0n },
      { month: { year: 2026, month: 9 }, added: 1, won: 1, lost: 0, wonValuePaise: 100_000_00n },
    ]);
  });

  it("measures quality by how leads actually close", () => {
    const summary = summarizeLeads([
      lead({ quality: "HOT", stage: "WON", source: "REFERRAL" }),
      lead({ quality: "HOT", stage: "WON", source: "REFERRAL" }),
      lead({ quality: "HOT", stage: "LOST", source: "WEBSITE" }),
      lead({ quality: "COLD", stage: "LOST" }),
      lead({ quality: "COLD", stage: "IN_PROCESS" }),
    ]);
    expect(summary.all).toMatchObject({ count: 5, open: 1, won: 2, lost: 2, weightedPaise: 20_000_00n });
    expect(winRate(summary.byQuality.HOT)).toBe(67);
    expect(winRate(summary.byQuality.COLD)).toBe(0);
    expect(winRate(summary.byQuality.WARM)).toBeNull();
    expect(winRate(summary.bySource.get("REFERRAL")!)).toBe(100);
    expect(summary.bySource.get("UNKNOWN")?.count).toBe(2);
  });
});
