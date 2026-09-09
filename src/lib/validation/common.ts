import { z } from "zod";

import { MoneyParseError, parseRupeesToPaise, type Paise } from "@/lib/money";
import { parseDateInput, parseMonthKey } from "@/lib/dates";

/** Trimmed, non-empty text with a friendly message. */
export const requiredText = (label: string, max = 200) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

export const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .catch(null);

export const optionalEmail = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .refine(
    (value) => value === null || z.email().safeParse(value).success,
    "Enter a valid email address",
  );

/** Parses "1,25,000" / "₹1,25,000.50" straight into integer paise. */
export const moneyField = (label: string, options: { min?: Paise; allowZero?: boolean } = {}) =>
  z.string().transform((value, ctx): Paise => {
    try {
      const paise = parseRupeesToPaise(value);
      const floor = options.min ?? (options.allowZero ? 0n : 1n);
      if (paise < floor) {
        ctx.addIssue({
          code: "custom",
          message: options.allowZero
            ? `${label} cannot be negative`
            : `${label} must be greater than zero`,
        });
        return z.NEVER;
      }
      if (paise > 100_000_000_000_00n) {
        ctx.addIssue({ code: "custom", message: `${label} looks too large — check the amount` });
        return z.NEVER;
      }
      return paise;
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof MoneyParseError ? error.message : `Enter a valid ${label.toLowerCase()}`,
      });
      return z.NEVER;
    }
  });

export const dateField = (label: string) =>
  z.string().transform((value, ctx) => {
    const parsed = parseDateInput(value);
    if (!parsed) {
      ctx.addIssue({ code: "custom", message: `${label} must be a valid date` });
      return z.NEVER;
    }
    return parsed;
  });

export const optionalDateField = (label: string) =>
  z.string().transform((value, ctx) => {
    if (value.trim() === "") return null;
    const parsed = parseDateInput(value);
    if (!parsed) {
      ctx.addIssue({ code: "custom", message: `${label} must be a valid date` });
      return z.NEVER;
    }
    return parsed;
  });

export const monthField = z.string().transform((value, ctx) => {
  const parsed = parseMonthKey(value);
  if (!parsed) {
    ctx.addIssue({ code: "custom", message: "Choose a valid month" });
    return z.NEVER;
  }
  return parsed;
});

export const idField = z.string().trim().min(1, "Missing record reference").max(64);

/** Checkboxes arrive as "on" or are absent entirely. */
export const checkboxField = z
  .union([z.string(), z.undefined(), z.null()])
  .transform((value) => value === "on" || value === "true" || value === "1");

/** Money that may be left blank entirely (opening balance, optional fields). */
export const optionalMoneyField = (label: string) =>
  z.string().transform((value, ctx): Paise | null => {
    if (value.trim() === "") return null;
    try {
      return parseRupeesToPaise(value);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof MoneyParseError ? error.message : `Enter a valid ${label.toLowerCase()}`,
      });
      return z.NEVER;
    }
  });
