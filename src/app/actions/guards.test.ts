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

/** Sign-in and sign-out are Clerk's; no action here is public. */
const PUBLIC_ACTIONS = new Set<string>();

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

describe("approval gate", () => {
  const read = (...parts: string[]) => readFileSync(path.join(process.cwd(), ...parts), "utf8");

  /** One export's source, ending where the next export begins — never spilling into it. */
  const bodyOf = (source: string, declaration: string) => {
    const start = source.indexOf(declaration);
    if (start === -1) return null;
    const next = source.indexOf("\nexport ", start + declaration.length);
    return source.slice(start, next === -1 ? source.length : next);
  };

  it("guards every page-facing data loader, not only the layout", () => {
    // A layout does not stop route segments from rendering, so the check has
    // to live where the data is read.
    const repository = read("src", "lib", "finance", "repository.ts");
    for (const loader of ["loadFinanceIndex", "loadSettings", "loadClients", "hasDemoData", "loadLoans"]) {
      const body = bodyOf(repository, `export const ${loader}`);
      expect(body, `${loader} missing`).not.toBeNull();
      expect(body, `${loader} is unguarded`).toContain("await requirePageUser()");
    }
    expect(bodyOf(repository, "export const loadTeam")).toContain(
      'await requirePermission("users:manage")',
    );

    const viewData = read("src", "lib", "finance", "view-data.ts");
    expect(viewData).toContain("await requirePageUser()");
  });

  it("only lets an approved account through either guard", () => {
    const auth = read("src", "lib", "auth.ts");
    for (const guard of ["export async function requireUser", "export async function requirePageUser"]) {
      expect(bodyOf(auth, guard), guard).toContain('account.state !== "approved"');
    }
  });

  it("refuses the export API to anyone not approved", () => {
    for (const route of [
      ["src", "app", "api", "export", "[dataset]", "route.ts"],
      ["src", "app", "api", "template", "expenses", "route.ts"],
    ]) {
      expect(read(...route)).toContain("await getCurrentUser()");
    }
  });
});
