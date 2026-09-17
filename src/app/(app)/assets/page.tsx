import Link from "next/link";
import type { Metadata } from "next";
import { FileText, MonitorSmartphone, Plus } from "lucide-react";

import { PageHeader } from "@/components/finance/page-header";
import { EmptyState } from "@/components/finance/empty-state";
import { Money } from "@/components/finance/money";
import { FilterChips, ParamSelect, SearchInput } from "@/components/finance/data-toolbar";
import { Pagination, paginate } from "@/components/finance/pagination";
import { AssetDialog } from "@/components/dialogs/asset-dialog";
import { AssetRowActions } from "@/components/finance/asset-row-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrap,
} from "@/components/ui/table";

import { requirePageUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  currentMonthKey,
  formatDay,
  formatMonthKey,
  formatMonthLabel,
  monthKeyOf,
  parseMonthKey,
  toDateInputValue,
} from "@/lib/dates";
import { toWire } from "@/lib/money";
import { loadAssets } from "@/lib/finance/repository";
import { readParam, withParams, type SearchParams } from "@/lib/finance/page-helpers";

export const metadata: Metadata = { title: "Assets" };

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = (readParam(params, "q") ?? "").trim().toLowerCase();
  const categoryFilter = readParam(params, "category");
  const boughtMonth = parseMonthKey(readParam(params, "bought"));
  const boughtKey = boughtMonth ? formatMonthKey(boughtMonth) : null;
  const page = Number(readParam(params, "page") ?? 1) || 1;

  const [viewer, { assets, categories }] = await Promise.all([requirePageUser(), loadAssets()]);
  const canWrite = can(viewer.role, "finance:write");
  const canDelete = can(viewer.role, "finance:delete");

  const categoryOptions = categories.map((category) => ({ id: category.id, name: category.name }));

  const rows = assets
    .filter((asset) => (categoryFilter ? asset.categoryId === categoryFilter : true))
    .filter((asset) =>
      boughtKey
        ? asset.purchasedOn !== null && formatMonthKey(monthKeyOf(asset.purchasedOn)) === boughtKey
        : true,
    )
    .filter((asset) =>
      query
        ? [asset.name, asset.specification, asset.serialNumber, asset.category.name, asset.notes]
            .filter(Boolean)
            .some((field) => field!.toLowerCase().includes(query))
        : true,
    );
  const view = paginate(rows, page);

  const totalValue = assets.reduce((sum, asset) => sum + (asset.costPaise ?? 0n), 0n);
  const missingBills = assets.filter((asset) => asset.bill === null).length;

  // What was bought each month, newest first — the basis for the month filter.
  const byMonth = new Map<string, { count: number; valuePaise: bigint }>();
  for (const asset of assets) {
    if (!asset.purchasedOn) continue;
    const key = formatMonthKey(monthKeyOf(asset.purchasedOn));
    const entry = byMonth.get(key) ?? { count: 0, valuePaise: 0n };
    entry.count += 1;
    entry.valuePaise += asset.costPaise ?? 0n;
    byMonth.set(key, entry);
  }
  const months = [...byMonth.entries()].sort(([a], [b]) => b.localeCompare(a));
  const focusKey = boughtKey ?? formatMonthKey(currentMonthKey());
  const focus = byMonth.get(focusKey) ?? { count: 0, valuePaise: 0n };
  const focusLabel = formatMonthLabel(parseMonthKey(focusKey)!);
  const filteredValue = rows.reduce((sum, asset) => sum + (asset.costPaise ?? 0n), 0n);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Assets"
        description="What the company owns, with specifications and the purchase bill. Add a category as you go and it's there to reuse next time."
        actions={
          canWrite ? (
            <AssetDialog categories={categoryOptions}>
              <Button size="sm">
                <Plus />
                Add asset
              </Button>
            </AssetDialog>
          ) : null
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Total asset value"
          value={<Money value={totalValue} className="text-[22px] font-semibold" />}
          footnote={`${assets.length} asset${assets.length === 1 ? "" : "s"} · ${categories.length} categor${categories.length === 1 ? "y" : "ies"}`}
        />
        <Stat
          label={`Bought in ${focusLabel}`}
          value={<Money value={focus.valuePaise} className="text-[22px] font-semibold" />}
          footnote={`${focus.count} asset${focus.count === 1 ? "" : "s"}`}
        />
        <Stat
          label={boughtKey || categoryFilter || query ? "Shown below" : "Months with purchases"}
          value={
            boughtKey || categoryFilter || query ? (
              <Money value={filteredValue} className="text-[22px] font-semibold" />
            ) : (
              String(months.length)
            )
          }
          footnote={
            boughtKey || categoryFilter || query
              ? `${rows.length} matching asset${rows.length === 1 ? "" : "s"}`
              : "Pick a month below to filter"
          }
        />
        <Stat
          label="Without a bill"
          value={String(missingBills)}
          tone={missingBills > 0 ? "warning" : "default"}
        />
      </section>

      {months.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px]">Bought by month</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2 overflow-x-auto pb-4">
            {months.map(([key, entry]) => {
              const active = key === boughtKey;
              return (
                <Link
                  key={key}
                  href={`/assets${withParams(params, { bought: active ? undefined : key, page: undefined })}`}
                  scroll={false}
                  aria-current={active ? "true" : undefined}
                  className={
                    active
                      ? "shrink-0 rounded-lg border border-brand-line bg-brand/10 px-3 py-2"
                      : "shrink-0 rounded-lg border border-border bg-surface-2 px-3 py-2 transition-colors hover:border-border-strong"
                  }
                >
                  <span className="block text-[12px] text-muted-foreground">
                    {formatMonthLabel(parseMonthKey(key)!)}
                  </span>
                  <Money value={entry.valuePaise} className="text-[14px] font-semibold" />
                  <span className="block text-[11px] text-faint-foreground">
                    {entry.count} asset{entry.count === 1 ? "" : "s"}
                  </span>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search name, spec, serial…" className="w-full sm:w-72" />
        <ParamSelect
          paramKey="bought"
          label="Month bought"
          defaultValue=""
          options={[
            { value: "", label: "All months" },
            ...months.map(([key]) => ({ value: key, label: formatMonthLabel(parseMonthKey(key)!) })),
          ]}
        />
        {categories.length > 0 ? (
          <FilterChips
            paramKey="category"
            options={categories.map((category) => ({
              value: category.id,
              label: category.name,
              count: category._count.assets,
            }))}
          />
        ) : null}
      </div>

      <Card className="overflow-hidden">
        {view.rows.length === 0 ? (
          <EmptyState
            icon={MonitorSmartphone}
            title={assets.length === 0 ? "No assets yet" : "No assets match"}
            description={
              assets.length === 0
                ? "Add the laptops, machines and phones the company owns — with the bill, so it's there when you need a warranty claim."
                : "Try a different search or category."
            }
            action={
              assets.length === 0 && canWrite ? (
                <AssetDialog categories={categoryOptions}>
                  <Button size="sm">
                    <Plus />
                    Add the first asset
                  </Button>
                </AssetDialog>
              ) : null
            }
          />
        ) : (
          <>
            <TableWrap>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead className="hidden md:table-cell">Specification</TableHead>
                    <TableHead className="hidden sm:table-cell">Purchased</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead>Bill</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {view.rows.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell className="min-w-[11rem]">
                        <span className="font-medium">{asset.name}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-muted-foreground">
                          <span className="rounded border border-border px-1 py-px text-[11px]">
                            {asset.category.name}
                          </span>
                          {asset.serialNumber ? (
                            <span className="font-mono text-faint-foreground">{asset.serialNumber}</span>
                          ) : null}
                        </span>
                        {asset.specification ? (
                          <span className="mt-1 block max-w-[16rem] truncate text-[12px] text-faint-foreground md:hidden">
                            {asset.specification.replace(/\s*\n\s*/g, " · ")}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="hidden max-w-[22rem] whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground md:table-cell">
                        {asset.specification ?? "—"}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap font-mono tabular text-[13px] text-muted-foreground sm:table-cell">
                        {asset.purchasedOn ? formatDay(asset.purchasedOn) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {asset.costPaise !== null ? (
                          <Money value={asset.costPaise} className="text-[13px]" />
                        ) : (
                          <span className="text-[13px] text-faint-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {asset.bill ? (
                          <a
                            href={`/api/assets/${asset.id}/bill`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] text-brand hover:underline"
                            title={asset.bill.fileName}
                          >
                            <FileText className="size-3.5" />
                            {asset.bill.contentType === "application/pdf" ? "PDF" : "Photo"}
                          </a>
                        ) : (
                          <span className="whitespace-nowrap text-[12px] text-warning">Missing</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <AssetRowActions
                          categories={categoryOptions}
                          canWrite={canWrite}
                          canDelete={canDelete}
                          asset={{
                            id: asset.id,
                            name: asset.name,
                            categoryId: asset.categoryId,
                            specification: asset.specification,
                            serialNumber: asset.serialNumber,
                            purchasedOn: toDateInputValue(asset.purchasedOn) || null,
                            costPaise: asset.costPaise === null ? null : toWire(asset.costPaise),
                            notes: asset.notes,
                            bill: asset.bill ? { fileName: asset.bill.fileName } : null,
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
            <Pagination {...view} basePath="/assets" params={params} noun="assets" />
          </>
        )}
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  footnote,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  footnote?: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-faint-foreground">{label}</p>
      <p
        className={
          tone === "warning"
            ? "mt-1.5 font-mono tabular text-[22px] font-semibold text-warning"
            : "mt-1.5 font-mono tabular text-[22px] font-semibold"
        }
      >
        {value}
      </p>
      {footnote ? <p className="mt-0.5 text-[12px] text-faint-foreground">{footnote}</p> : null}
    </div>
  );
}
