"use client";

import * as React from "react";

import {
  DESKTOP_QUERY,
  SIDEBAR_CLASSES,
  SIDEBAR_COOKIE,
  SIDEBAR_COOKIE_MAX_AGE,
  type SidebarMode,
} from "@/lib/sidebar";

/**
 * Whether the sidebar is full-width or an icon rail.
 *
 * "auto" means the person has never chosen: a rail on tablets (768–1023px),
 * full on desktop. Once they toggle, their choice sticks at every width. The
 * preference lives in a cookie so the server renders the right width on the
 * first paint — localStorage would flash the wrong layout before hydrating.
 *
 * Every width decision is plain responsive CSS derived from the mode, so no
 * JavaScript has to measure the screen before the page can lay out.
 */

type SidebarContextValue = {
  mode: SidebarMode;
  classes: (typeof SIDEBAR_CLASSES)[SidebarMode];
  toggle: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function SidebarProvider({
  initialMode,
  children,
}: {
  initialMode: SidebarMode;
  children: React.ReactNode;
}) {
  const [mode, setMode] = React.useState<SidebarMode>(initialMode);

  const toggle = React.useCallback(() => {
    setMode((current) => {
      // In auto mode the sidebar's look depends on the screen, so toggling
      // means "the opposite of what I'm looking at right now".
      const showingFull =
        current === "expanded" ||
        (current === "auto" && window.matchMedia(DESKTOP_QUERY).matches);
      const next: SidebarMode = showingFull ? "collapsed" : "expanded";
      document.cookie = `${SIDEBAR_COOKIE}=${next}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`;
      return next;
    });
  }, []);

  // ⌘B / Ctrl+B, the shortcut most sidebars use. Ignored while typing.
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "b" || !(event.metaKey || event.ctrlKey)) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const value = React.useMemo(
    () => ({ mode, classes: SIDEBAR_CLASSES[mode], toggle }),
    [mode, toggle],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarContextValue {
  const value = React.useContext(SidebarContext);
  if (!value) throw new Error("useSidebar must be used inside SidebarProvider");
  return value;
}

/** The content column, offset by however wide the sidebar currently is. */
export function SidebarOffset({ children }: { children: React.ReactNode }) {
  const { classes } = useSidebar();
  return (
    <div className={`transition-[padding] duration-200 ease-out ${classes.offset}`}>{children}</div>
  );
}
