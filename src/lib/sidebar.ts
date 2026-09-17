/**
 * Sidebar preference: shared by the server layout (reading the cookie) and
 * the client provider (writing it). Deliberately not a client module — the
 * server cannot call functions exported from a "use client" file.
 */

export type SidebarMode = "auto" | "expanded" | "collapsed";

export const SIDEBAR_COOKIE = "foxwel-sidebar";
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const DESKTOP_QUERY = "(min-width: 1024px)";

export function parseSidebarMode(value: string | undefined): SidebarMode {
  return value === "expanded" || value === "collapsed" ? value : "auto";
}

/** Tailwind classes per mode. Below `md` there is no sidebar at all. */
export const SIDEBAR_CLASSES: Record<
  SidebarMode,
  { width: string; offset: string; label: string; center: string; wide: string; narrow: string }
> = {
  auto: {
    width: "md:w-16 lg:w-60",
    offset: "md:pl-16 lg:pl-60",
    // Screen-reader text stays in the rail; it is only hidden visually.
    label: "md:sr-only lg:not-sr-only",
    center: "md:justify-center lg:justify-start",
    wide: "md:hidden lg:flex",
    narrow: "md:flex lg:hidden",
  },
  expanded: {
    width: "md:w-60",
    offset: "md:pl-60",
    label: "",
    center: "justify-start",
    wide: "md:flex",
    narrow: "md:hidden",
  },
  collapsed: {
    width: "md:w-16",
    offset: "md:pl-16",
    label: "sr-only",
    center: "justify-center",
    wide: "md:hidden",
    narrow: "md:flex",
  },
};
