"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { NavVisibilityPayload } from "@/lib/nav-visibility-shared";

const NavVisibilityContext = createContext<NavVisibilityPayload | null>(null);

export function NavVisibilityProvider({
  value,
  children,
}: {
  value: NavVisibilityPayload;
  children: ReactNode;
}) {
  return (
    <NavVisibilityContext.Provider value={value}>
      {children}
    </NavVisibilityContext.Provider>
  );
}

export function useNavVisibility(): NavVisibilityPayload | null {
  return useContext(NavVisibilityContext);
}
