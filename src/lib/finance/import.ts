/**
 * CSV import mapping.
 *
 * Kept out of the dialog component so the rules that decide what is importable
 * — category matching, amount parsing, duplicate detection — can be tested
 * directly rather than through the UI.
 */

import { parseDateInput } from "@/lib/dates";
import { toWire, tryParseRupeesToPaise } from "@/lib/money";

import { EXPENSE_CATEGORY_LABELS } from "./labels";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "./types";

export type ImportFieldKey = "name" | "category" | "planned" | "dueDate" | "notes";

export const IMPORT_FIELDS: {
  key: ImportFieldKey;
  label: string;
  required: boolean;
  hints: string[];
}[] = [
  { key: "name", label: "Expense name", required: true, hints: ["name", "description", "item", "particular"] },
  { key: "category", label: "Category", required: false, hints: ["category", "type", "head"] },
  { key: "planned", label: "Planned amount", required: true, hints: ["amount", "planned", "budget", "value", "debit"] },
  { key: "dueDate", label: "Due date", required: false, hints: ["due", "date"] },
  { key: "notes", label: "Notes", required: false, hints: ["note", "remark", "comment"] },
];

const CATEGORY_LOOKUP = new Map<string, ExpenseCategory>(
  EXPENSE_CATEGORIES.flatMap((category) => [
    [category.toLowerCase(), category] as const,
    [EXPENSE_CATEGORY_LABELS[category].toLowerCase(), category] as const,
  ]),
);

/** "Rent", "office rent" and "RENT" all resolve to RENT; unknown gives null. */
export function matchCategory(raw: string): ExpenseCategory | null {
  const text = raw.trim().toLowerCase();
  if (!text) return null;
  const exact = CATEGORY_LOOKUP.get(text);
  if (exact) return exact;
  for (const [key, value] of CATEGORY_LOOKUP) {
    if (text.includes(key) || key.includes(text)) return value;
  }
  return null;
}

/** Best-guess column mapping from the file's own header names. */
export function guessMapping(headers: readonly string[]): Record<ImportFieldKey, string> {
  const mapping = { name: "", category: "", planned: "", dueDate: "", notes: "" } as Record<
    ImportFieldKey,
    string
  >;
  for (const field of IMPORT_FIELDS) {
    const found = headers.find((header) =>
      field.hints.some((hint) => header.toLowerCase().includes(hint)),
    );
    if (found) mapping[field.key] = found;
  }
  return mapping;
}

export type ImportPreviewRow = {
  index: number;
  name: string;
  category: ExpenseCategory;
  plannedPaise: number;
  dueDate: string | null;
  notes: string | null;
  /** Non-empty means the row is either unusable or will import with a fallback. */
  problems: string[];
  /** Blocks the row from importing at all. */
  blocked: boolean;
  /** Already present for the target month, or repeated within the file. */
  duplicate: boolean;
};

export function buildImportPreview(input: {
  headers: readonly string[];
  rows: readonly string[][];
  mapping: Record<ImportFieldKey, string>;
  existing: readonly { name: string; category: ExpenseCategory }[];
}): ImportPreviewRow[] {
  const columnOf = (key: ImportFieldKey) => input.headers.indexOf(input.mapping[key]);
  const seen = new Set(input.existing.map((row) => importKey(row.name, row.category)));

  return input.rows.map((cells, index) => {
    const read = (key: ImportFieldKey) => {
      const column = columnOf(key);
      return column === -1 ? "" : (cells[column] ?? "").trim();
    };

    const problems: string[] = [];
    let blocked = false;

    const name = read("name");
    if (!name) {
      problems.push("Missing name");
      blocked = true;
    }

    const rawAmount = read("planned");
    const paise = tryParseRupeesToPaise(rawAmount);
    if (paise === null) {
      problems.push(rawAmount ? `Amount "${rawAmount}" is not a number` : "Missing amount");
      blocked = true;
    } else if (paise < 0n) {
      problems.push("Amount is negative");
      blocked = true;
    }

    // An unrecognised category is a warning, not a blocker — it falls back to
    // Miscellaneous so one odd label does not stop the whole import.
    const rawCategory = read("category");
    const matched = matchCategory(rawCategory);
    const category = matched ?? "MISC";
    if (rawCategory && !matched) {
      problems.push(`Category "${rawCategory}" not recognised — will import as Miscellaneous`);
    }

    const rawDue = read("dueDate");
    const due = rawDue ? parseDateInput(rawDue) : null;
    if (rawDue && !due) problems.push(`Due date "${rawDue}" is not YYYY-MM-DD`);

    const key = importKey(name, category);
    const duplicate = Boolean(name) && seen.has(key);
    if (name) seen.add(key);

    return {
      index,
      name,
      category,
      plannedPaise: paise !== null && paise >= 0n ? toWire(paise) : 0,
      dueDate: due ? rawDue : null,
      notes: read("notes") || null,
      problems,
      blocked,
      duplicate,
    };
  });
}

export function importKey(name: string, category: ExpenseCategory): string {
  return `${category}::${name.trim().toLowerCase().replace(/\s+/g, " ")}`;
}
