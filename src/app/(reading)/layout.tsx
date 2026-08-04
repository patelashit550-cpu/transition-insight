import type { ReactNode } from "react";

import NarrativeHeader from "@/components/layout/NarrativeHeader";

/** Essays + hubs: fixed narrative banner (server-rendered on static export). */
export default function ReadingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col" style={{ minHeight: "100svh" }}>
      <NarrativeHeader />
      <main className="p3-reading-main">{children}</main>
    </div>
  );
}
