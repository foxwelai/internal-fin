import { z } from "zod";

import { ROLE_ORDER } from "@/lib/permissions";

import { idField, requiredText } from "./common";

const roleField = z.enum(ROLE_ORDER as [string, ...string[]]);

/** Password rules, in one place so create and reset cannot drift apart. */
export const passwordField = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(200, "That password is too long")
  .refine((value) => value.trim().length > 0, "Enter a password");

export const createUserSchema = z
  .object({
    name: requiredText("Name", 120),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Email is required")
      .max(160)
      .refine((value) => z.email().safeParse(value).success, "Enter a valid email address"),
    role: roleField,
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "The two passwords do not match",
    path: ["confirmPassword"],
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

export const resetPasswordSchema = z
  .object({
    id: idField,
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "The two passwords do not match",
    path: ["confirmPassword"],
  });
