"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { cn } from "@/lib/utils";
import { NAV_ITEMS, SECONDARY_NAV_ITEMS, isNavItemActive } from "@/lib/nav";
import { useSidebar } from "@/components/shell/sidebar-state";

/**
 * Desktop and tablet navigation. Full width shows labels; the rail shows icons
 * only, with each label kept for screen readers and as a hover tooltip.
 */
export function Sidebar() {
  const pathname = usePathname();
  const { classes, toggle, mode } = useSidebar();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col overflow-hidden border-r border-border bg-surface md:flex",
        "transition-[width] duration-200 ease-out",
        classes.width,
      )}
    >
      <div className={cn("flex h-14 shrink-0 items-center border-b border-border px-3", classes.center)}>
        <Link
          href="/overview"
          className="flex min-w-0 items-center gap-2.5 rounded-md p-1"
          aria-label="Foxwel Finance — Overview"
        >
          <Image
            src="/logo-mark.png"
            alt=""
            width={26}
            height={32}
            className="h-7 w-auto shrink-0"
            priority
          />
          <span className={cn("flex min-w-0 flex-col leading-none", classes.label)}>
            <span className="truncate text-[13px] font-semibold tracking-tight">Foxwel Finance</span>
            <span className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-faint-foreground">
              foxwel.ai
            </span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3" aria-label="Main">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={item.label}
                  className={cn(
                    "group relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
                    classes.center,
                    active
                      ? "bg-surface-3 text-foreground"
                      : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  {active ? (
                    <span
                      aria-hidden
                      className="absolute inset-y-1.5 -left-3 w-0.5 rounded-r-full bg-brand"
                    />
                  ) : null}
                  <item.icon
                    className={cn(
                      "size-4 shrink-0 transition-colors",
                      active ? "text-brand" : "text-faint-foreground group-hover:text-muted-foreground",
                    )}
                  />
                  <span className={cn("truncate", classes.label)}>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-border p-3">
        <button
          type="button"
          onClick={toggle}
          aria-label="Toggle sidebar"
          title="Toggle sidebar (⌘B)"
          className={cn(
            "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground",
            classes.center,
          )}
        >
          {/* Which icon depends on what is showing, which in auto mode is a matter of screen width. */}
          <PanelLeftClose className={cn("size-4 shrink-0", classes.wide)} />
          <PanelLeftOpen className={cn("size-4 shrink-0", classes.narrow)} />
          <span className={cn("truncate", classes.label)}>
            {mode === "collapsed" ? "Expand" : "Collapse"}
          </span>
        </button>
      </div>
    </aside>
  );
}

/**
 * The phone's bottom bar. Four destinations fit comfortably; everything else
 * lives behind "More" rather than being squeezed out of reach.
 */
export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const primary = NAV_ITEMS.filter((item) => item.primary);
  const secondaryActive = SECONDARY_NAV_ITEMS.some((item) => isNavItemActive(pathname, item.href));

  // Close the sheet when a link has taken us somewhere. Adjusting during
  // render rather than in an effect, so there is no flash of the open sheet
  // over the new page.
  const [sheetPathname, setSheetPathname] = React.useState(pathname);
  if (sheetPathname !== pathname) {
    setSheetPathname(pathname);
    setMoreOpen(false);
  }

  const itemClass = (active: boolean) =>
    cn(
      "flex w-full flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-[10px] font-medium transition-colors",
      active ? "text-brand" : "text-faint-foreground",
    );

  return (
    <>
      {moreOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-[2px] md:hidden"
          onClick={() => setMoreOpen(false)}
          aria-hidden
        />
      ) : null}

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md md:hidden"
      >
        {moreOpen ? (
          <ul className="border-b border-border p-2">
            {SECONDARY_NAV_ITEMS.map((item) => {
              const active = isNavItemActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[13px] font-medium",
                      active ? "bg-surface-3 text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <item.icon
                      className={cn("size-4", active ? "text-brand" : "text-faint-foreground")}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}

        <ul className="grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
          {primary.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={itemClass(active)}
                  onClick={() => setMoreOpen(false)}
                >
                  <item.icon className="size-[18px]" />
                  <span className="truncate">{item.shortLabel}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen((open) => !open)}
              aria-expanded={moreOpen}
              aria-label="More sections"
              className={itemClass(moreOpen || secondaryActive)}
            >
              <MoreHorizontal className="size-[18px]" />
              <span className="truncate">More</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
