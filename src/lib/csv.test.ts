import { describe, expect, it } from "vitest";

import { parseCsv, toCsv } from "./csv";
import {
  buildImportPreview,
  guessMapping,
  matchCategory,
} from "./finance/import";

describe("CSV parsing", () => {
  it("handles quoted fields, embedded commas and escaped quotes", () => {
    const parsed = parseCsv(
      'Name,Amount,Notes\r\n"Rent, office","65,000","Says ""paid"" on the invoice"\r\n',
    );
    expect(parsed.headers).toEqual(["Name", "Amount", "Notes"]);
    expect(parsed.rows).toEqual([["Rent, office", "65,000", 'Says "paid" on the invoice']]);
  });

  it("strips the BOM Excel writes and copes with bare newlines", () => {
    const parsed = parseCsv("﻿Name,Amount\nSalaries,360000\nRent,65000");
    expect(parsed.headers).toEqual(["Name", "Amount"]);
    expect(parsed.rows).toHaveLength(2);
  });

  it("keeps a newline inside a quoted field", () => {
    const parsed = parseCsv('Name,Notes\n"Rent","line one\nline two"');
    expect(parsed.rows[0][1]).toBe("line one\nline two");
  });

  it("round-trips through the writer", () => {
    const rows = [
      ["Name", "Amount"],
      ['A "quoted" name', "1,25,000"],
      ["Comma, inside", "500"],
    ];
    expect(parseCsv(toCsv(rows)).rows).toEqual(rows.slice(1));
  });
});

describe("import mapping", () => {
  it("guesses columns from header names", () => {
    const mapping = guessMapping(["Particulars", "Head", "Debit amount", "Due Date", "Remarks"]);
    expect(mapping.name).toBe("Particulars");
    expect(mapping.category).toBe("Head");
    expect(mapping.planned).toBe("Debit amount");
    expect(mapping.dueDate).toBe("Due Date");
    expect(mapping.notes).toBe("Remarks");
  });

  it("matches category labels and enum names, loosely", () => {
    expect(matchCategory("Rent")).toBe("RENT");
    expect(matchCategory("office rent")).toBe("RENT");
    expect(matchCategory("SALARIES")).toBe("SALARIES");
    expect(matchCategory("Software & AI")).toBe("SOFTWARE");
    expect(matchCategory("something odd")).toBeNull();
  });

  const headers = ["Name", "Category", "Amount", "Due date"];

  it("flags unusable rows and lets warnings through", () => {
    const preview = buildImportPreview({
      headers,
      rows: [
        ["Salaries", "Salaries", "3,60,000", "2026-10-01"],
        ["", "Rent", "65000", ""],
        ["Broadband", "Utilities", "not a number", ""],
        ["Sundry", "Nonsense category", "1200", ""],
        ["Travel", "Travel", "22000", "31/10/2026"],
      ],
      mapping: guessMapping(headers),
      existing: [],
    });

    expect(preview[0]).toMatchObject({ blocked: false, duplicate: false, plannedPaise: 36_000_000 });
    expect(preview[1].blocked).toBe(true);
    expect(preview[2].blocked).toBe(true);

    // Unknown category imports as Miscellaneous rather than failing the row.
    expect(preview[3].blocked).toBe(false);
    expect(preview[3].category).toBe("MISC");
    expect(preview[3].problems[0]).toContain("not recognised");

    // A non-ISO date is a warning; the row still imports without a due date.
    expect(preview[4].blocked).toBe(false);
    expect(preview[4].dueDate).toBeNull();
    expect(preview[4].problems[0]).toContain("not YYYY-MM-DD");
  });

  it("detects duplicates against the month and within the file itself", () => {
    const preview = buildImportPreview({
      headers,
      rows: [
        ["Office rent", "Rent", "65000", ""],
        ["office  rent", "Rent", "65000", ""],
        ["Salaries", "Salaries", "360000", ""],
      ],
      mapping: guessMapping(headers),
      existing: [{ name: "Salaries", category: "SALARIES" }],
    });

    expect(preview[0].duplicate).toBe(false);
    // Same name modulo case and spacing.
    expect(preview[1].duplicate).toBe(true);
    // Already budgeted for the target month.
    expect(preview[2].duplicate).toBe(true);
  });
});
