import { z } from "zod";

import { ROLE_ORDER } from "@/lib/permissions";

import { idField, requiredText } from "./common";

const roleField = z.enum(ROLE_ORDER as [string, ...string[]]);

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .max(160)
  .refine((value) => z.email().safeParse(value).success, "Enter a valid email address");

/** Let someone in before they have signed in: they get access on first sign-in. */
export const addUserSchema = z.object({
  name: requiredText("Name", 120),
  email: emailField,
  role: roleField,
});

export const approveUserSchema = z.object({
  id: idField,
  role: roleField,
});

export const updateUserSchema = z.object({
  id: idField,
  name: requiredText("Name", 120),
  role: roleField,
});

export const setUserActiveSchema = z.object({
  id: idField,
  active: z.enum(["true", "false"]),
});
