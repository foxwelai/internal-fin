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
cp .env.example .env          # set DATABASE_URL, AUTH_SECRET, OWNER_PASSWORD
npm run db:deploy             # create the schema
npm run db:seed               # bootstrap the first owner account
npm run dev
```

Then sign in at <http://localhost:3000/login> with the `OWNER_EMAIL` and
`OWNER_PASSWORD` from your `.env`. That account is a **bootstrap only** —
everyone else is added from **Settings → Team**, and re-running the seed will
never touch an account that already exists.

To look around before entering real numbers:

```bash
npm run db:seed:demo          # labelled fictional dataset — removable in Settings
```

### Generating the secrets

```bash
openssl rand -base64 32
```

Put the result in `AUTH_SECRET`. Set `OWNER_PASSWORD` to something at least 12
characters long — the seed refuses to create an account without it, and there is
no default password anywhere in the codebase.

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
| `npm run verify:auth` | Confirm the owner account's password hash accepts the right password and rejects the wrong one |
| `npm run dev:session` | Mint a session cookie for an account, to exercise the UI without a password (development only) |

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
| Planned monthly expenses | Expense budgets attributed to the month |
| Actual cash outflow | Expense payments dated inside the month, whichever month the expense was budgeted to |
| Projected cash outflow | Actual outflow + still-unpaid balance of the month's budget |
| Actual cash surplus / deficit | Money received − actual cash outflow |
| Projected cash surplus / deficit | Projected collections − projected cash outflow |
| Cash surplus margin | Actual surplus ÷ actual collections. Rendered `—` when collections are zero |

Pending and on-hold projects sit in a separate **potential pipeline** and never
enter a forecast. Receipts against them still count as collections, because the
money genuinely arrived.

Funding, owner contributions and withdrawals are recorded as **cash movements**.
They move the cash balance and are deliberately excluded from collections,
expenses and the operating surplus.

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
    auth.ts               Auth.js v5 + requireUser()
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

Nothing about who may do what lives in code or in an environment variable.
Accounts, their roles and whether they are active are rows in the `users` table,
managed from **Settings → Team** by anyone with the Owner role.

| Role | Can |
| --- | --- |
| **Owner** | Everything, including adding people, changing roles and editing company settings |
| **Admin** | Record and edit everything financial. Not people, not settings |
| **Viewer** | See every figure, change nothing |

The mapping from role to permission is the one deliberate exception: it lives in
[`src/lib/permissions.ts`](src/lib/permissions.ts), because what a role *means*
is policy that deserves review and tests, while *who holds it* is data. Change a
role in the app and it takes effect on that person's very next request — no
deploy, no sign-out.

**The session token carries an id and nothing that grants anything.** Role and
active status are read from the database on every request, so:

- deactivating someone ends their access immediately, even mid-session;
- deleting an account does the same;
- a stale cookie for a deleted account lands on the sign-in form rather than
  bouncing between `/login` and `/overview`.

Deactivating is preferred over deleting: it revokes access while keeping the
record of who added what. The last active owner cannot be demoted, deactivated
or deleted — otherwise nobody could manage people or settings, and the only way
back would be a database console.

### Security

- Auth.js v5, email + password (bcrypt, cost 12), JWT sessions.
- No self sign-up. The seed bootstraps one owner when the table is empty and
  never touches an existing account — in particular it cannot silently reset a
  password someone has changed in the app.
- The `(app)` layout redirects unauthenticated visitors, but that is the front
  door, not the lock: **every server action calls `requireUser()` or
  `requirePermission(...)` itself**, because server actions are reachable over
  HTTP whether or not a page rendered them. A test walks the action files and
  fails if any exported action is missing its guard.
- Hiding a button is presentation only. Every check is repeated on the server
  against the role read fresh from the database.
- All mutations validate with Zod before touching the database.
- Receipt allocation, schedule edits and expense payments run inside database
  transactions, so a partial write cannot leave allocations that do not add up.

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

The build fails loudly if `DATABASE_URL` is missing, rather than shipping an app
that breaks on its first request. So set the variables **before** the first
deploy, under **Project Settings → Environment Variables**, ticking Production,
Preview and Development:

| Variable | Required | Value |
| --- | --- | --- |
| `DATABASE_URL` | yes | Your **pooled** connection string. On Neon that is the host containing `-pooler`. Serverless functions open a pool each, so the pooler is what keeps you inside the connection limit. |
| `AUTH_SECRET` | yes | `openssl rand -base64 32`. Use a different value from your local one. |
| `DIRECT_URL` | no | Only if you run `prisma migrate deploy` from CI. Not used at runtime. |
| `AUTH_URL` | no | Leave unset. The app sets `trustHost`, so it infers the URL from the request — which is what makes preview deployments work. |
| `OWNER_EMAIL` / `OWNER_PASSWORD` | no | Only read by the seed, which you run locally. Keeping them off the host keeps that password out of your deployment settings. |

Migrations are **not** run during the build, deliberately: a preview deployment
would otherwise migrate your production database. Apply them yourself when the
schema changes:

```bash
npm run db:deploy     # uses DIRECT_URL when set
```

Then bootstrap the first account once, against the same database:

```bash
npm run db:seed
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
- Password reset is done by an owner from the Team page. There is no
  self-service "forgot password" email flow.
- Resetting someone's password does not end their existing sessions; deactivate
  and reactivate the account to cut those off at once.
- Cash basis only. No accruals, GST/TDS handling, invoice numbering or PDF
  invoicing.
- The repository loads the full financial dataset per request. That is a handful
  of indexed queries at this scale; date-windowing the `findMany` calls in
  `repository.ts` is the seam to add if the book grows past a few thousand rows.
- Analytics charts link through to the underlying records at the metric and
  category level; individual bars are not yet click-through.
