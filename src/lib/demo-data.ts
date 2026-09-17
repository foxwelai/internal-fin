/**
 * The demo dataset.
 *
 * Every row it writes carries `isDemo: true`, so it can be removed in one
 * action without touching real company data. It is never loaded automatically;
 * `npm run db:seed:demo` or the button in Settings puts it in.
 *
 * The figures are built relative to the current month so the dashboard always
 * looks live, and are internally consistent: receipts never exceed a budget,
 * and scheduled amounts never exceed what is left of a contract.
 */

import { addMonths, currentMonthKey, dayInMonth, monthStart } from "@/lib/dates";
import { rupees } from "@/lib/money";
import type { PrismaClient } from "@/generated/prisma";

type Db = Pick<
  PrismaClient,
  | "client"
  | "project"
  | "paymentSchedule"
  | "receipt"
  | "receiptAllocation"
  | "monthlyExpense"
  | "expensePayment"
  | "recurringExpenseTemplate"
  | "cashMovement"
  | "appSettings"
>;

const NOW = () => currentMonthKey();

/** `at(-2, 15)` is the 15th of the month two months back. */
function at(monthOffset: number, day: number): Date {
  return dayInMonth(addMonths(NOW(), monthOffset), day);
}

function period(monthOffset: number) {
  const key = addMonths(NOW(), monthOffset);
  return { periodYear: key.year, periodMonth: key.month };
}

export async function seedDemoData(db: Db) {
  /* ------------------------------- Clients ------------------------------- */

  const northwind = await db.client.create({
    data: {
      name: "Northwind Retail Pvt Ltd",
      clientName: "Karan Malhotra",
      contactPerson: "Ananya Rao",
      contactPhone: "+91 98200 41122",
      email: "ananya.rao@northwind.example",
      phone: "+91 98200 41122",
      notes: "Demo data. Retail chain, 40 stores. Payments run on a 15-day approval cycle.",
      isDemo: true,
    },
  });

  const kettle = await db.client.create({
    data: {
      name: "Kettle & Co Coffee",
      clientName: "Rohan Mehta",
      contactPerson: "Rohan Mehta",
      contactPhone: "+91 99870 33410",
      email: "rohan@kettleandco.example",
      phone: "+91 99870 33410",
      notes: "Demo data. D2C coffee brand. Slow on design sign-offs.",
      isDemo: true,
    },
  });

  const suryan = await db.client.create({
    data: {
      name: "Suryan Logistics",
      clientName: "Meera Suryanarayan",
      contactPerson: "Vikram Iyer",
      contactPhone: "+91 90040 77812",
      email: "vikram.iyer@suryanlog.example",
      phone: "+91 90040 77812",
      notes: "Demo data. Largest account. Fleet AI pilot could extend into a retainer.",
      isDemo: true,
    },
  });

  const lumen = await db.client.create({
    data: {
      name: "Lumen Health",
      clientName: "Dr. Arjun Nair",
      contactPerson: "Dr. Priya Nair",
      contactPhone: "+91 93450 21188",
      email: "priya.nair@lumenhealth.example",
      phone: "+91 93450 21188",
      notes: "Demo data. Two clinics in Pune. Pays reliably on the due date.",
      isDemo: true,
    },
  });

  const tanvi = await db.client.create({
    data: {
      name: "Tanvi Studios",
      clientName: "Tanvi Deshpande",
      contactPerson: "Tanvi Deshpande",
      contactPhone: "+91 97300 55120",
      email: "hello@tanvistudios.example",
      phone: "+91 97300 55120",
      notes: "Demo data. Small, fast-moving design studio. Referral source.",
      isDemo: true,
    },
  });

  /* ------------------------------ Projects ------------------------------- */

  const makeProject = (data: Parameters<Db["project"]["create"]>[0]["data"]) =>
    db.project.create({ data: { ...data, isDemo: true } });

  const replatform = await makeProject({
    clientId: northwind.id,
    name: "Commerce replatform",
    description: "Headless storefront, catalogue migration and checkout rebuild.",
    budgetPaise: rupees(850_000),
    status: "APPROVED",
    startDate: at(-3, 5),
    expectedCompletionDate: at(1, 31),
    notes: "Four-stage billing agreed in the SOW.",
  });

  const analytics = await makeProject({
    clientId: northwind.id,
    name: "Store analytics dashboard",
    description: "Per-store margin and footfall reporting.",
    budgetPaise: rupees(220_000),
    status: "PENDING",
    startDate: at(1, 1),
    expectedCompletionDate: at(2, 28),
    notes: "Proposal sent. Awaiting purchase order — not counted in any forecast.",
  });

  const brandSite = await makeProject({
    clientId: kettle.id,
    name: "Brand site + CMS",
    description: "Marketing site rebuild with a headless CMS.",
    budgetPaise: rupees(340_000),
    status: "APPROVED",
    startDate: at(-1, 1),
    expectedCompletionDate: at(1, 15),
    notes: "Advance arrived before the milestone schedule was agreed.",
  });

  const loyalty = await makeProject({
    clientId: kettle.id,
    name: "Loyalty programme",
    description: "Points engine and companion mini-app.",
    budgetPaise: rupees(180_000),
    status: "PENDING",
    notes: "Scoping call done. No schedule yet.",
  });

  const fleetAi = await makeProject({
    clientId: suryan.id,
    name: "Fleet tracking AI pilot",
    description: "Route deviation detection and driver scoring pilot across 120 vehicles.",
    budgetPaise: rupees(1_200_000),
    status: "APPROVED",
    startDate: at(-2, 10),
    expectedCompletionDate: at(2, 30),
    notes: "₹1,80,000 of the contract is deliberately left unscheduled pending phase 3 scoping.",
  });

  const driverApp = await makeProject({
    clientId: suryan.id,
    name: "Driver app phase 2",
    description: "Offline-first trip capture and expense claims.",
    budgetPaise: rupees(650_000),
    status: "ON_HOLD",
    startDate: at(-1, 1),
    notes: "Paused at the client's request. The advance already collected stays on the books.",
  });

  const intake = await makeProject({
    clientId: lumen.id,
    name: "Patient intake automation",
    description: "Digital intake forms with HMS integration.",
    budgetPaise: rupees(475_000),
    status: "APPROVED",
    startDate: at(0, 1),
    expectedCompletionDate: at(2, 15),
  });

  const microsite = await makeProject({
    clientId: tanvi.id,
    name: "Portfolio microsite",
    description: "Single-page portfolio with a case-study CMS.",
    budgetPaise: rupees(95_000),
    status: "APPROVED",
    startDate: at(-1, 1),
    expectedCompletionDate: at(0, 5),
    notes: "Complete and fully collected.",
  });

  const landingPages = await makeProject({
    clientId: tanvi.id,
    name: "Campaign landing pages",
    description: "Six seasonal campaign pages with A/B variants.",
    budgetPaise: rupees(240_000),
    status: "APPROVED",
    startDate: at(-5, 1),
    expectedCompletionDate: at(-4, 25),
    notes: "Closed out.",
  });

  const clinicSite = await makeProject({
    clientId: lumen.id,
    name: "Clinic website",
    description: "Two-location clinic site with appointment booking.",
    budgetPaise: rupees(520_000),
    status: "APPROVED",
    startDate: at(-5, 1),
    expectedCompletionDate: at(-4, 30),
    notes: "Closed out.",
  });

  /* -------------------- Schedules, receipts, allocations ------------------ */

  /** Creates a schedule line and, when given, the receipt that settles part of it. */
  async function scheduleWithReceipt(input: {
    projectId: string;
    label: string;
    amount: bigint;
    dueDate: Date;
    notes?: string;
    receipt?: {
      amount: bigint;
      receivedOn: Date;
      method?: "BANK_TRANSFER" | "UPI" | "CHEQUE" | "CASH" | "CARD" | "OTHER";
      reference?: string;
    };
  }) {
    const schedule = await db.paymentSchedule.create({
      data: {
        projectId: input.projectId,
        label: input.label,
        amountPaise: input.amount,
        dueDate: input.dueDate,
        notes: input.notes ?? null,
      },
    });

    if (input.receipt) {
      const receipt = await db.receipt.create({
        data: {
          projectId: input.projectId,
          amountPaise: input.receipt.amount,
          receivedOn: input.receipt.receivedOn,
          method: input.receipt.method ?? "BANK_TRANSFER",
          reference: input.receipt.reference ?? null,
        },
      });
      await db.receiptAllocation.create({
        data: {
          receiptId: receipt.id,
          scheduleId: schedule.id,
          amountPaise: input.receipt.amount,
        },
      });
    }

    return schedule;
  }

  // Northwind — commerce replatform: paid, paid, part-paid & overdue, future.
  await scheduleWithReceipt({
    projectId: replatform.id,
    label: "Advance — 30%",
    amount: rupees(255_000),
    dueDate: at(-3, 10),
    receipt: { amount: rupees(255_000), receivedOn: at(-3, 12), reference: "NW/ADV/8841" },
  });
  await scheduleWithReceipt({
    projectId: replatform.id,
    label: "Design sign-off",
    amount: rupees(212_500),
    dueDate: at(-2, 25),
    receipt: { amount: rupees(212_500), receivedOn: at(-2, 29), reference: "NW/M2/9014" },
  });
  await scheduleWithReceipt({
    projectId: replatform.id,
    label: "UAT milestone",
    amount: rupees(212_500),
    dueDate: at(0, 5),
    notes: "Part payment received; balance chased with accounts.",
    receipt: { amount: rupees(100_000), receivedOn: at(0, 8), reference: "NW/M3/9210" },
  });
  await scheduleWithReceipt({
    projectId: replatform.id,
    label: "Go-live balance",
    amount: rupees(170_000),
    dueDate: at(1, 20),
  });

  // Northwind — analytics dashboard: pending work, so out of the forecast.
  await scheduleWithReceipt({
    projectId: analytics.id,
    label: "Advance — 40%",
    amount: rupees(88_000),
    dueDate: at(1, 5),
  });
  await scheduleWithReceipt({
    projectId: analytics.id,
    label: "Delivery",
    amount: rupees(132_000),
    dueDate: at(2, 20),
  });

  // Kettle & Co — advance banked before any schedule existed, so it is
  // unallocated; and a design sign-off that went overdue last month.
  await db.receipt.create({
    data: {
      projectId: brandSite.id,
      amountPaise: rupees(100_000),
      receivedOn: at(-1, 3),
      method: "UPI",
      reference: "KC/ADV/2201",
      notes: "Advance paid on handshake, before milestones were agreed.",
    },
  });
  await scheduleWithReceipt({
    projectId: brandSite.id,
    label: "Design approval",
    amount: rupees(120_000),
    dueDate: at(-1, 28),
    notes: "Overdue since last month. Needs rescheduling before it can be forecast.",
  });
  await scheduleWithReceipt({
    projectId: brandSite.id,
    label: "Content handover",
    amount: rupees(60_000),
    dueDate: at(0, 18),
  });
  await scheduleWithReceipt({
    projectId: brandSite.id,
    label: "Launch balance",
    amount: rupees(60_000),
    dueDate: at(1, 15),
  });

  // Suryan — fleet AI: part-paid current milestone, plus ₹1,80,000 unscheduled.
  await scheduleWithReceipt({
    projectId: fleetAi.id,
    label: "Advance — 30%",
    amount: rupees(360_000),
    dueDate: at(-2, 18),
    receipt: { amount: rupees(360_000), receivedOn: at(-2, 20), reference: "SL/PIL/1180" },
  });
  await scheduleWithReceipt({
    projectId: fleetAi.id,
    label: "Phase 1 delivery",
    amount: rupees(360_000),
    dueDate: at(0, 12),
    receipt: { amount: rupees(200_000), receivedOn: at(0, 6), reference: "SL/PIL/1244" },
  });
  await scheduleWithReceipt({
    projectId: fleetAi.id,
    label: "Phase 2 delivery",
    amount: rupees(300_000),
    dueDate: at(2, 15),
  });

  // Suryan — driver app: on hold, but its advance stays in the books.
  await scheduleWithReceipt({
    projectId: driverApp.id,
    label: "Advance — 20%",
    amount: rupees(130_000),
    dueDate: at(-1, 1),
    receipt: { amount: rupees(130_000), receivedOn: at(-1, 5), reference: "SL/DRV/7742" },
  });
  await scheduleWithReceipt({
    projectId: driverApp.id,
    label: "Build milestone",
    amount: rupees(260_000),
    dueDate: at(0, 30),
    notes: "Held out of the forecast while the project is on hold.",
  });

  // Lumen — intake automation: advance in, integration milestone part paid.
  await scheduleWithReceipt({
    projectId: intake.id,
    label: "Advance — 25%",
    amount: rupees(118_750),
    dueDate: at(0, 8),
    receipt: { amount: rupees(118_750), receivedOn: at(0, 8), method: "UPI", reference: "LH/INT/4410" },
  });
  await scheduleWithReceipt({
    projectId: intake.id,
    label: "Integration milestone",
    amount: rupees(190_000),
    dueDate: at(0, 30),
    receipt: { amount: rupees(90_000), receivedOn: at(0, 8), reference: "LH/INT/4418" },
  });
  await scheduleWithReceipt({
    projectId: intake.id,
    label: "Handover",
    amount: rupees(166_250),
    dueDate: at(2, 10),
  });

  // Tanvi — microsite: complete and fully collected.
  await scheduleWithReceipt({
    projectId: microsite.id,
    label: "Advance — 50%",
    amount: rupees(47_500),
    dueDate: at(-1, 5),
    receipt: { amount: rupees(47_500), receivedOn: at(-1, 5), method: "UPI" },
  });
  await scheduleWithReceipt({
    projectId: microsite.id,
    label: "Balance on launch",
    amount: rupees(47_500),
    dueDate: at(0, 2),
    receipt: { amount: rupees(47_500), receivedOn: at(0, 3), method: "UPI" },
  });

  // Two closed-out projects give the six-month chart real history.
  await scheduleWithReceipt({
    projectId: landingPages.id,
    label: "Advance — 50%",
    amount: rupees(120_000),
    dueDate: at(-5, 8),
    receipt: { amount: rupees(120_000), receivedOn: at(-5, 9) },
  });
  await scheduleWithReceipt({
    projectId: landingPages.id,
    label: "Balance",
    amount: rupees(120_000),
    dueDate: at(-4, 20),
    receipt: { amount: rupees(120_000), receivedOn: at(-4, 22) },
  });
  await scheduleWithReceipt({
    projectId: clinicSite.id,
    label: "Advance — 50%",
    amount: rupees(260_000),
    dueDate: at(-5, 5),
    receipt: { amount: rupees(260_000), receivedOn: at(-5, 5) },
  });
  await scheduleWithReceipt({
    projectId: clinicSite.id,
    label: "Balance on launch",
    amount: rupees(260_000),
    dueDate: at(-4, 28),
    receipt: { amount: rupees(260_000), receivedOn: at(-4, 30) },
  });

  await db.project.update({
    where: { id: loyalty.id },
    data: { notes: "Demo data. No schedule yet — sits in the potential pipeline only." },
  });

  /* --------------------------- Recurring templates ----------------------- */

  const templates = await Promise.all([
    db.recurringExpenseTemplate.create({
      data: {
        name: "Salaries",
        category: "SALARIES",
        amountPaise: rupees(360_000),
        dueDayOfMonth: 1,
        notes: "Team of six, paid on the first working day.",
        isDemo: true,
      },
    }),
    db.recurringExpenseTemplate.create({
      data: {
        name: "Office rent",
        category: "RENT",
        amountPaise: rupees(65_000),
        dueDayOfMonth: 5,
        isDemo: true,
      },
    }),
    db.recurringExpenseTemplate.create({
      data: {
        name: "Software & AI subscriptions",
        category: "SOFTWARE",
        amountPaise: rupees(38_000),
        dueDayOfMonth: 3,
        notes: "Model APIs, design tools, CI.",
        isDemo: true,
      },
    }),
    db.recurringExpenseTemplate.create({
      data: {
        name: "Internet & utilities",
        category: "UTILITIES",
        amountPaise: rupees(9_500),
        dueDayOfMonth: 7,
        isDemo: true,
      },
    }),
  ]);

  const [salariesTemplate, rentTemplate, softwareTemplate, utilitiesTemplate] = templates;

  /* -------------------------------- Expenses ----------------------------- */

  async function addExpense(input: {
    monthOffset: number;
    name: string;
    category: "SALARIES" | "RENT" | "SOFTWARE" | "UTILITIES" | "MARKETING" | "FREELANCERS" | "TRAVEL" | "MISC";
    planned: bigint;
    dueDay?: number;
    templateId?: string;
    notes?: string;
    payments?: { amount: bigint; paidOn: Date; reference?: string; notes?: string }[];
  }) {
    const expense = await db.monthlyExpense.create({
      data: {
        name: input.name,
        category: input.category,
        plannedPaise: input.planned,
        ...period(input.monthOffset),
        dueDate: input.dueDay ? at(input.monthOffset, input.dueDay) : null,
        isRecurring: Boolean(input.templateId),
        templateId: input.templateId ?? null,
        notes: input.notes ?? null,
        isDemo: true,
      },
    });

    for (const payment of input.payments ?? []) {
      await db.expensePayment.create({
        data: {
          expenseId: expense.id,
          amountPaise: payment.amount,
          paidOn: payment.paidOn,
          method: "BANK_TRANSFER",
          reference: payment.reference ?? null,
          notes: payment.notes ?? null,
        },
      });
    }

    return expense;
  }

  // Two lean months before the team grew.
  for (const offset of [-5, -4]) {
    await addExpense({
      monthOffset: offset,
      name: "Salaries",
      category: "SALARIES",
      planned: rupees(270_000),
      dueDay: 1,
      templateId: salariesTemplate.id,
      payments: [{ amount: rupees(270_000), paidOn: at(offset, 1) }],
    });
    await addExpense({
      monthOffset: offset,
      name: "Office rent",
      category: "RENT",
      planned: rupees(65_000),
      dueDay: 5,
      templateId: rentTemplate.id,
      payments: [{ amount: rupees(65_000), paidOn: at(offset, 5) }],
    });
    await addExpense({
      monthOffset: offset,
      name: "Software & AI subscriptions",
      category: "SOFTWARE",
      planned: rupees(26_000),
      dueDay: 3,
      templateId: softwareTemplate.id,
      payments: [{ amount: rupees(26_000), paidOn: at(offset, 3) }],
    });
    await addExpense({
      monthOffset: offset,
      name: "Internet & utilities",
      category: "UTILITIES",
      planned: rupees(8_800),
      dueDay: 7,
      templateId: utilitiesTemplate.id,
      payments: [{ amount: rupees(8_800), paidOn: at(offset, 7) }],
    });
  }

  // Three months back.
  await addExpense({
    monthOffset: -3,
    name: "Salaries",
    category: "SALARIES",
    planned: rupees(360_000),
    dueDay: 1,
    templateId: salariesTemplate.id,
    payments: [{ amount: rupees(360_000), paidOn: at(-3, 1) }],
  });
  await addExpense({
    monthOffset: -3,
    name: "Office rent",
    category: "RENT",
    planned: rupees(65_000),
    dueDay: 5,
    templateId: rentTemplate.id,
    payments: [{ amount: rupees(65_000), paidOn: at(-3, 5) }],
  });
  await addExpense({
    monthOffset: -3,
    name: "Software & AI subscriptions",
    category: "SOFTWARE",
    planned: rupees(36_000),
    dueDay: 3,
    templateId: softwareTemplate.id,
    payments: [{ amount: rupees(36_000), paidOn: at(-3, 3) }],
  });
  await addExpense({
    monthOffset: -3,
    name: "Internet & utilities",
    category: "UTILITIES",
    planned: rupees(9_200),
    dueDay: 7,
    templateId: utilitiesTemplate.id,
    payments: [{ amount: rupees(9_200), paidOn: at(-3, 7) }],
  });
  await addExpense({
    monthOffset: -3,
    name: "Team offsite & misc",
    category: "MISC",
    planned: rupees(12_000),
    payments: [{ amount: rupees(12_000), paidOn: at(-3, 18) }],
  });

  // Two months back.
  await addExpense({
    monthOffset: -2,
    name: "Salaries",
    category: "SALARIES",
    planned: rupees(360_000),
    dueDay: 1,
    templateId: salariesTemplate.id,
    payments: [{ amount: rupees(360_000), paidOn: at(-2, 1) }],
  });
  await addExpense({
    monthOffset: -2,
    name: "Office rent",
    category: "RENT",
    planned: rupees(65_000),
    dueDay: 5,
    templateId: rentTemplate.id,
    payments: [{ amount: rupees(65_000), paidOn: at(-2, 5) }],
  });
  await addExpense({
    monthOffset: -2,
    name: "Software & AI subscriptions",
    category: "SOFTWARE",
    planned: rupees(36_000),
    dueDay: 3,
    templateId: softwareTemplate.id,
    payments: [{ amount: rupees(36_000), paidOn: at(-2, 3) }],
  });
  await addExpense({
    monthOffset: -2,
    name: "Internet & utilities",
    category: "UTILITIES",
    planned: rupees(9_800),
    dueDay: 7,
    templateId: utilitiesTemplate.id,
    payments: [{ amount: rupees(9_800), paidOn: at(-2, 7) }],
  });
  await addExpense({
    monthOffset: -2,
    name: "Client visit — Bengaluru",
    category: "TRAVEL",
    planned: rupees(22_000),
    payments: [{ amount: rupees(22_000), paidOn: at(-2, 14) }],
  });
  await addExpense({
    monthOffset: -2,
    name: "Accounting & compliance",
    category: "MISC",
    planned: rupees(9_000),
    payments: [{ amount: rupees(9_000), paidOn: at(-2, 22) }],
  });

  // Last month — including the freelancer invoice settled this month.
  await addExpense({
    monthOffset: -1,
    name: "Salaries",
    category: "SALARIES",
    planned: rupees(360_000),
    dueDay: 1,
    templateId: salariesTemplate.id,
    payments: [{ amount: rupees(360_000), paidOn: at(-1, 1) }],
  });
  await addExpense({
    monthOffset: -1,
    name: "Office rent",
    category: "RENT",
    planned: rupees(65_000),
    dueDay: 5,
    templateId: rentTemplate.id,
    payments: [{ amount: rupees(65_000), paidOn: at(-1, 5) }],
  });
  await addExpense({
    monthOffset: -1,
    name: "Software & AI subscriptions",
    category: "SOFTWARE",
    planned: rupees(38_000),
    dueDay: 3,
    templateId: softwareTemplate.id,
    payments: [{ amount: rupees(38_000), paidOn: at(-1, 3) }],
  });
  await addExpense({
    monthOffset: -1,
    name: "Internet & utilities",
    category: "UTILITIES",
    planned: rupees(9_500),
    dueDay: 7,
    templateId: utilitiesTemplate.id,
    payments: [{ amount: rupees(9_500), paidOn: at(-1, 7) }],
  });
  await addExpense({
    monthOffset: -1,
    name: "Freelance motion designer",
    category: "FREELANCERS",
    planned: rupees(85_000),
    dueDay: 28,
    notes:
      "Budgeted to last month, settled in the current month — so it lands in this month's cash outflow, " +
      "not last month's.",
    payments: [{ amount: rupees(85_000), paidOn: at(0, 4), reference: "FRL/2291" }],
  });
  await addExpense({
    monthOffset: -1,
    name: "Accounting & compliance",
    category: "MISC",
    planned: rupees(14_000),
    payments: [{ amount: rupees(14_000), paidOn: at(-1, 20) }],
  });

  // Current month — a mix of paid, part-paid and not yet due.
  await addExpense({
    monthOffset: 0,
    name: "Salaries",
    category: "SALARIES",
    planned: rupees(360_000),
    dueDay: 1,
    templateId: salariesTemplate.id,
    payments: [{ amount: rupees(360_000), paidOn: at(0, 1) }],
  });
  await addExpense({
    monthOffset: 0,
    name: "Office rent",
    category: "RENT",
    planned: rupees(65_000),
    dueDay: 5,
    templateId: rentTemplate.id,
    notes: "Part paid while the landlord's revised invoice is confirmed.",
    payments: [{ amount: rupees(35_000), paidOn: at(0, 6) }],
  });
  await addExpense({
    monthOffset: 0,
    name: "Software & AI subscriptions",
    category: "SOFTWARE",
    planned: rupees(38_000),
    dueDay: 3,
    templateId: softwareTemplate.id,
    payments: [{ amount: rupees(38_000), paidOn: at(0, 3) }],
  });
  await addExpense({
    monthOffset: 0,
    name: "Internet & utilities",
    category: "UTILITIES",
    planned: rupees(9_500),
    dueDay: 7,
    templateId: utilitiesTemplate.id,
    payments: [{ amount: rupees(9_500), paidOn: at(0, 7) }],
  });
  await addExpense({
    monthOffset: 0,
    name: "Performance marketing",
    category: "MARKETING",
    planned: rupees(45_000),
    dueDay: 25,
  });
  await addExpense({
    monthOffset: 0,
    name: "Freelance backend contractor",
    category: "FREELANCERS",
    planned: rupees(85_000),
    dueDay: 28,
  });
  await addExpense({
    monthOffset: 0,
    name: "Client visit — Chennai",
    category: "TRAVEL",
    planned: rupees(22_000),
    dueDay: 20,
  });
  await addExpense({
    monthOffset: 0,
    name: "Accounting & compliance",
    category: "MISC",
    planned: rupees(12_000),
    dueDay: 26,
  });

  /* ----------------------- Non-operating cash movements ------------------- */

  await db.cashMovement.createMany({
    data: [
      {
        type: "FUNDING",
        label: "Working capital line drawdown",
        amountPaise: rupees(500_000),
        occurredOn: at(-3, 15),
        notes: "Bridge across the milestone gap. Not revenue.",
        isDemo: true,
      },
      {
        type: "OWNER_CONTRIBUTION",
        label: "Founder top-up",
        amountPaise: rupees(200_000),
        occurredOn: at(-1, 20),
        isDemo: true,
      },
      {
        type: "OWNER_WITHDRAWAL",
        label: "Owner draw",
        amountPaise: rupees(100_000),
        occurredOn: at(0, 5),
        isDemo: true,
      },
    ],
  });

  /* ------------------------------- Settings ------------------------------ */

  const existing = await db.appSettings.findUnique({ where: { id: "singleton" } });
  if (!existing || existing.openingBalancePaise === null) {
    await db.appSettings.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        companyName: "foxwel.ai",
        openingBalancePaise: rupees(650_000),
        openingBalanceDate: monthStart(addMonths(NOW(), -5)),
        openingBalanceIsDemo: true,
      },
      update: {
        openingBalancePaise: rupees(650_000),
        openingBalanceDate: monthStart(addMonths(NOW(), -5)),
        openingBalanceIsDemo: true,
      },
    });
  }

  return {
    clients: 5,
    projects: 10,
  };
}

/** Removes every demo row, leaving real data untouched. */
export async function clearDemoData(db: Db) {
  // Cascades handle schedules, receipts, allocations and expense payments.
  await db.project.deleteMany({ where: { isDemo: true } });
  await db.client.deleteMany({ where: { isDemo: true } });
  await db.monthlyExpense.deleteMany({ where: { isDemo: true } });
  await db.recurringExpenseTemplate.deleteMany({ where: { isDemo: true } });
  await db.cashMovement.deleteMany({ where: { isDemo: true } });

  await db.appSettings.updateMany({
    where: { openingBalanceIsDemo: true },
    data: { openingBalancePaise: null, openingBalanceDate: null, openingBalanceIsDemo: false },
  });
}
