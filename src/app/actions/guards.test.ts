import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Server Actions are public HTTP endpoints. Every one that reads or writes
 * business data must authorise on the server, and it is easy to add a new
 * action and forget. This walks the action files and fails if any exported
 * action lacks a `requireUser()` or `requirePermission(...)` call.
 */

const ACTIONS_DIR = path.join(process.cwd(), "src", "app", "actions");

/** Files that hold no actions, or whose auth is inherently different. */
const NOT_ACTIONS = new Set(["helpers.ts", "state.ts", "guards.test.ts"]);

/** Signing in is the one thing you may do while signed out. */
const PUBLIC_ACTIONS = new Set(["signInWithCredentials", "signOutAction"]);

function actionFiles(): string[] {
  return readdirSync(ACTIONS_DIR)
    .filter((name) => name.endsWith(".ts") && !NOT_ACTIONS.has(name))
    .sort();
}

/** Splits a module's source into one chunk per exported async function. */
function exportedActions(source: string): { name: string; body: string }[] {
  const matches = [...source.matchAll(/export async function (\w+)\s*\(/g)];
  return matches.map((match, index) => {
    const start = match.index!;
    const end = index + 1 < matches.length ? matches[index + 1].index! : source.length;
    return { name: match[1], body: source.slice(start, end) };
  });
}

describe("server action authorisation", () => {
  const files = actionFiles();

  it("finds the action modules", () => {
    expect(files.length).toBeGreaterThan(5);
    expect(files).toContain("receipts.ts");
    expect(files).toContain("users.ts");
  });

  for (const file of files) {
    const source = readFileSync(path.join(ACTIONS_DIR, file), "utf8");

    it(`${file}: every exported action authorises before doing anything`, () => {
      const unguarded = exportedActions(source)
        .filter((action) => !PUBLIC_ACTIONS.has(action.name))
        .filter(
          (action) =>
            !action.body.includes("await requirePermission(") &&
            !action.body.includes("await requireUser("),
        )
        .map((action) => action.name);

      expect(unguarded).toEqual([]);
    });
  }

  it("gates every user-management action behind users:manage", () => {
    const source = readFileSync(path.join(ACTIONS_DIR, "users.ts"), "utf8");
    for (const action of exportedActions(source)) {
      expect(action.body).toContain('await requirePermission("users:manage")');
    }
  });

  it("gates deletions behind finance:delete, not merely finance:write", () => {
    const expected: Record<string, string[]> = {
      "clients.ts": ["deleteClient"],
      "projects.ts": ["deleteProject"],
      "receipts.ts": ["deleteReceipt"],
      "schedules.ts": ["deleteSchedule"],
      "expenses.ts": ["deleteExpense", "deleteExpensePayment", "deleteTemplate"],
      "settings.ts": ["deleteCashMovement"],
    };

    for (const [file, actions] of Object.entries(expected)) {
      const source = readFileSync(path.join(ACTIONS_DIR, file), "utf8");
      const byName = new Map(exportedActions(source).map((a) => [a.name, a.body]));
      for (const name of actions) {
        expect(byName.get(name), `${file}:${name} missing`).toBeDefined();
        expect(byName.get(name)).toContain('await requirePermission("finance:delete")');
      }
    }
  });
});

/** Strips comments so a rule cannot be tripped by prose that merely names it. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("auth redirects", () => {
  const source = readFileSync(path.join(ACTIONS_DIR, "auth.ts"), "utf8");
  const code = codeOnly(source);

  /**
   * `redirectTo` makes Auth.js build an absolute URL from AUTH_URL, which is
   * how a leftover local value sends people on the deployed site to localhost.
   * Redirecting with Next's own `redirect()` keeps the browser on whichever
   * host served the request.
   */
  it("never hands redirectTo to Auth.js", () => {
    expect(code).not.toMatch(/redirectTo\s*:/);
  });

  it("opts out of Auth.js redirects and navigates itself", () => {
    expect(code).toContain("redirect: false");
    expect(code).toContain("redirect(AFTER_SIGN_IN)");
    expect(code).toContain("redirect(AFTER_SIGN_OUT)");
  });

  it("redirects to paths, never absolute URLs", () => {
    const targets = [...code.matchAll(/^const AFTER_SIGN_(?:IN|OUT) = "([^"]+)";$/gm)].map(
      (match) => match[1],
    );
    expect(targets).toEqual(["/overview", "/login"]);
    for (const target of targets) expect(target.startsWith("/")).toBe(true);
  });
});

describe("production environment guard", () => {
  it("refuses to boot with a localhost AUTH_URL in production", () => {
    const source = readFileSync(path.join(process.cwd(), "src", "lib", "auth.ts"), "utf8");
    expect(source).toContain('process.env.NODE_ENV === "production"');
    expect(source).toContain("NEXTAUTH_URL");
    expect(source).toMatch(/localhost\|127\\\.0\\\.0\\\.1/);
  });
});
