# Foxwel Finance

Internal financial command centre for **foxwel.ai** — client projects, expected
payments, money actually received, and monthly expenses, in one cash-based view.

Open it in the morning and the Overview answers, in about thirty seconds:

- How much money have we received this month?
- How much more are we expecting?
- What are our monthly expenses?
- Are we running at a surplus or a deficit?
- Which client payments need chasing?

---

## Quick start

Requires Node 20+ (built and tested on Node 24).

```bash
npm install
cp .env.example .env          # set DATABASE_URL, the two Clerk keys, SUPER_ADMIN_EMAIL
npm run db:deploy             # create the schema
npm run db:seed               # approve SUPER_ADMIN_EMAIL as the first super admin
npm run dev
```

Then open <http://localhost:3000/sign-in> and sign in (or sign up) with
`SUPER_ADMIN_EMAIL`. Once Clerk has verified that address you are in as super
admin. Everyone after that signs up, waits on an approval screen, and is
approved with a role from **Settings → Team**.

To look around before entering real numbers:

```bash
npm run db:seed:demo          # labelled fictional dataset — removable in Settings
```

---

## Database

The app targets **PostgreSQL 14+** through Prisma 7's `pg` driver adapter.
Prisma 7 keeps the connection URL out of `schema.prisma`: the CLI reads it from
`prisma.config.ts`, and the runtime client gets it via the adapter in
[`src/lib/db.ts`](src/lib/db.ts).

### Two URLs, when the host pools connections

```bash
# What the app uses at runtime. Pooled is right here.
DATABASE_URL="postgresql://...-pooler.<region>.aws.neon.tech/neondb?sslmode=require"

# What Prisma Migrate uses. Must be the direct endpoint.
DIRECT_URL="postgresql://....<region>.aws.neon.tech/neondb?sslmode=require"
```

Migrations take advisory locks and set session state, neither of which survives
a transaction pooler — so Neon, Supabase and anything else fronted by PgBouncer
need the **direct** endpoint for `db:deploy` and the **pooled** one for serving.
On Neon the direct host is the same string with the `-pooler` suffix removed.

For a plain PostgreSQL instance, leave `DIRECT_URL` unset and both paths use
`DATABASE_URL`.

```bash
npm run db:deploy             # applies migrations without prompting
npm run db:seed               # bootstraps the first owner if none exists
npm run db:inspect            # what DATABASE_URL points at, and its tables
npm run build && npm start
```

### No local Postgres?

`npm run db:start` boots a real PostgreSQL 17 server into `./.devdb` using the
`embedded-postgres` package, so the project runs on a machine with no system
Postgres, Docker or Homebrew. Development convenience only — point
`DATABASE_URL` at it and skip `DIRECT_URL`.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest — the financial rules |
| `npm run db:start` | Local PostgreSQL into `./.devdb`, when there is no other one |
| `npm run db:inspect` | What `DATABASE_URL` points at, and which tables exist |
| `npm run db:migrate` | Create/apply a migration in development |
| `npm run db:deploy` | Apply migrations in production |
| `npm run db:seed` | Owner account and app settings |
| `npm run db:seed:demo` | The above plus the demo dataset |
| `npm run db:studio` | Prisma Studio |
| `npm run verify:data` | Print the month summary and check every project reconciles |

---

## How the numbers work

This is a **cash-based management view**, labelled as such throughout. The
result is money that actually arrived less money that actually left, in the
month it moved — not accounting net profit. There are no accruals, no
depreciation and no tax.

Two rules underpin everything:

1. **Expected money and received money are different things.** A scheduled
   payment is an expectation; a receipt is cash. Only receipts are ever counted
   as collected.
2. **An advance is part of the project budget, not extra revenue.** A project's
   remaining balance is always `budget − receipts`; the payment schedule is a
   separate breakdown of that same balance.

| Figure | Definition |
| --- | --- |
| Money received | Receipts dated inside the selected month, whatever the project's status |
| Expected additional collections | Unpaid portions of scheduled payments due inside the month, **approved projects only** |
| Projected collections | Received + expected additional |
| Remaining contract balance | Project budget − all receipts for that project |
| Amount scheduled / unscheduled | Unpaid schedule total, and the remainder of the balance with no date yet |
| Overdue receivables | Unpaid scheduled amounts past their due date. Amounts from earlier months are reported separately and **never** added to a later month's forecast until explicitly rescheduled |
| Referral commission | A share of money **actually collected** (never of the contract value, so nothing is owed on an unpaid invoice), or a flat fee. Rates are stored as basis points — 12.5% is 1250 — so the arithmetic stays in integers |
| Planned monthly expenses | Expense budgets attributed to the month |
| Actual cash outflow | Expense payments dated inside the month, whichever month the expense was budgeted to |
| Projected cash outflow | Actual outflow + still-unpaid balance of the month's budget |
| Actual cash outflow | Expense payments **plus** referral commissions paid, both dated by when the money left |
| Actual cash surplus / deficit | Money received − actual cash outflow |
| Projected cash surplus / deficit | Projected collections − projected cash outflow |
| Cash surplus margin | Actual surplus ÷ actual collections. Rendered `—` when collections are zero |

Pending and on-hold projects sit in a separate **potential pipeline** and never
enter a forecast. Receipts against them still count as collections, because the
money genuinely arrived.

Funding, owner contributions and withdrawals are recorded as **cash movements**,
and borrowing is recorded as **loans**. Both move the cash balance and are
deliberately excluded from collections, expenses and the operating surplus: a
loan arriving is not income, and repaying it is not a cost. They appear on
Overview under "What the business owes" so a healthy surplus is never mistaken
for money you get to keep.

Projects can be **one-off** or a **subscription** with a price per month,
quarter or year. The budget stays the total contract value; the recurring price
is shown alongside it and annualised, so retainers can be compared like for
like.

### Money and dates

Every amount is an integer number of **paise** held in a `bigint` — parsing,
arithmetic, aggregation and formatting are all integer operations, and no float
ever touches a monetary value. Floats appear only where a number is handed to a
chart library for pixel positioning.

Business dates are calendar dates stored as SQL `DATE` and compared in UTC, so
no timezone can shift a payment across a month boundary. "Today" is resolved in
**Asia/Kolkata**.

---

## Architecture

```
src/
  lib/
    money.ts              Integer-paise parsing, arithmetic, ₹ formatting with Indian grouping
    dates.ts              Calendar dates and months, anchored to Asia/Kolkata
    csv.ts                RFC 4180 reader/writer
    db.ts                 Prisma client via the pg driver adapter
    auth.ts               Clerk session -> approved account; requireUser()
    access.ts             Pure rules: approval states and account linking
    finance/
      types.ts            Domain types, independent of Prisma
      engine.ts           THE financial engine — every figure in the app
      engine.test.ts      The rules, pinned down
      insights.ts         Deterministic commentary
      recurring.ts        Idempotent month-generation planners
      import.ts           CSV column mapping and validation
      repository.ts       Loads one snapshot per request and hands it to the engine
  app/
    actions/              Server actions: auth check, Zod, transaction, revalidate
    (app)/                The authenticated shell and its pages
    api/export/           CSV exports that honour the page's active filters
  components/
    ui/                   shadcn/ui primitives
    finance/              Money, metric cards, tables, row actions
    charts/               Recharts wrappers
    dialogs/              Create/edit forms
```

**Everything numeric comes from `src/lib/finance/engine.ts`.** It is pure — no
Prisma, no React, no I/O — so the same function produces the Overview cards, the
charts, the tables and the CSV exports, and a figure cannot disagree with itself
across two screens. `repository.ts` loads one snapshot per request and
`indexDataset` resolves the cross-references once.

## People and access

**Clerk** handles sign-in, sign-up, passwords, sessions and two-step
verification. **The database** decides what anyone may see. A Clerk account on
its own grants nothing.

| Role | Can |
| --- | --- |
| **Super Admin** | Root access: everything, including approving people, changing roles and company settings |
| **Admin** | Record and edit everything financial. Not people, not settings |
| **Viewer** | See every figure, change nothing |

How someone gets in:

1. They sign up with Clerk. A row is recorded as a **pending request** and they
   see a "waiting for approval" screen. No financial data is loaded.
2. A super admin opens **Settings → Team → Pending requests** and approves them
   with a role, or declines.
3. Or a super admin uses **Give access** to approve an email ahead of time.

An email only ever claims an existing account once **Clerk has verified it** —
otherwise anyone could sign up with a super admin's address and inherit the role.

Access is read from the database on every request, so an approval, a role change
or a deactivation takes effect on the next click. The last active super admin
cannot be demoted, deactivated or removed.

### Security

- The check lives **where data is read** — every loader, server action and API
  route — not only in the layout. Next.js renders route segments independently,
  so a layout alone cannot stop a page from running. Tests fail if a loader or
  action loses its guard.
- `src/proxy.ts` only attaches Clerk's session. It makes no path-based access
  decisions: Clerk has deprecated those, and Next.js says proxy is not an
  authorization layer.
- All mutations validate with Zod; money-moving writes run in transactions.

### Guard rails

- Total receipts may not exceed a project's agreed budget.
- An allocation may exceed neither the receipt's unallocated remainder nor the
  schedule line's unpaid balance.
- Scheduling more than the remaining contract balance is refused.
- A budget cannot be cut below what has already been received or paid.
- Deleting a client, project or expense with financial history is refused —
  archive instead. Archiving never removes a receipt.
- Recurring generation and month-copying are idempotent by construction, and
  backed by a unique constraint on `(templateId, periodYear, periodMonth)`.

---

## Verification

`npm test` covers the financial rules directly — 45 assertions over the engine,
the money primitives, the CSV reader and the import mapper, including every case
called for in the brief:

| Case | Test |
| --- | --- |
| ₹1,00,000 project with ₹30,000 received leaves ₹70,000 | *verification case 1* |
| ₹40,000 this month + ₹30,000 next → only ₹40,000 in this month | *case 2* |
| A partial receipt reduces its schedule line without double counting | *case 3* |
| Pending and on-hold projects stay out of the forecast | *case 4* |
| Unscheduled balances never enter a monthly forecast | *case 5* |
| Prior-month overdue stays separate until rescheduled | *case 6* |
| A current-month payment for a prior-month expense hits current outflow | *case 7* |
| Recurring generation is idempotent | *case 8* |
| Zero-income months produce `—`, not NaN or Infinity | *case 9* |
| Receipts survive a project status change | *case 10* |
| Every role gets exactly the permissions it should, and no lower role exceeds a higher one | *permissions* |
| Every server action authorises before doing anything | *action guards* |
| Commission is charged on collections, not contract value, and a fractional rate stays exact | *referral commission* |
| Borrowing never touches the operating result, only the cash balance | *loans* |
| Money typed into a field regroups Indian-style and still parses | *live money input* |

`npm run verify:data` runs the engine against the live database and asserts that
`received + scheduled + unscheduled === budget` for every project.

---

## Demo data

`npm run db:seed:demo`, or the button in **Settings → Demo data**, loads five
fictional clients, ten projects and six months of expenses — advances, partial
receipts, an unallocated payment, an overdue milestone carried in from last
month, and a freelancer invoice budgeted to one month and paid in the next.

Every row it writes carries `isDemo: true`, so removing it deletes only the demo
records and leaves anything real untouched.


---

## Deploying to Vercel

Set these under **Project Settings → Environment Variables** before deploying.
Without the Clerk keys the build still succeeds, but every page fails at runtime.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Your **pooled** connection string (the Neon host containing `-pooler`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dashboard → API keys |
| `CLERK_SECRET_KEY` | Clerk dashboard → API keys. Server-only; never sent to the browser |

`AUTH_SECRET` and `AUTH_URL` belonged to the previous login system and can be
deleted. Clerk's development keys work on a `vercel.app` domain but show a
development banner; production keys need a domain you own.

Migrations are **not** run during the build — a preview deployment would
otherwise migrate your production database. Apply them yourself:

```bash
npm run db:deploy     # uses DIRECT_URL when set
```

### If you see the Next.js starter page after deploying

The deploy is building a commit that does not contain the application — almost
always because the work was never committed, or was pushed to a different
branch than the one Vercel is set to build. Check what the deployed commit
actually holds:

```bash
git log --oneline -3
git ls-tree -r HEAD --name-only | grep -c prisma
```

A count of `0` there means the application is not in that commit.

---

## Known limitations

- One organisation. No multi-tenancy and no client portal — clients are internal
  records with no login.
- Cash basis only. No accruals, GST/TDS handling, invoice numbering or PDF
  invoicing.
- The repository loads the full financial dataset per request. That is a handful
  of indexed queries at this scale; date-windowing the `findMany` calls in
  `repository.ts` is the seam to add if the book grows past a few thousand rows.
- Analytics charts link through to the underlying records at the metric and
  category level; individual bars are not yet click-through.
- A subscription's recurring price is descriptive: it is shown and annualised,
  but does not yet generate the payment schedule automatically.
- Loan interest is recorded for reference only. Repayments are entered as they
  happen rather than amortised into principal and interest.
- Commission payable is a standing liability rather than part of a month's
  forecast, because a commission has no due date of its own.
- Unsaved form input is kept in the browser's own storage, so it is per-device
  and per-browser.
