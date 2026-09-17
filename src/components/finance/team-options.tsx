"use client";

import * as React from "react";

import type { TeamOption } from "@/components/finance/options";

const TeamOptionsContext = React.createContext<TeamOption[]>([]);

/**
 * Foxwel's team list, loaded once by the app shell. Project dialogs open from
 * half a dozen places; reading the list from here saves threading it through
 * every one of them.
 */
export function TeamOptionsProvider({
  team,
  children,
}: {
  team: TeamOption[];
  children: React.ReactNode;
}) {
  return <TeamOptionsContext.Provider value={team}>{children}</TeamOptionsContext.Provider>;
}

export function useTeamOptions(): TeamOption[] {
  return React.useContext(TeamOptionsContext);
}
