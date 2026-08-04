import type { ReactNode } from "react";

import { WebMcpTools } from "@/components/agent/WebMcpTools";
import { Header } from "@/components/layout/Header";

/** Home + workflow: landing hero header (server-rendered — no client pathname switch). */
export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col" style={{ minHeight: "100svh" }}>
      <WebMcpTools />
      <Header />
      <main className="p3-landing-main w-full flex-1 flex flex-col">{children}</main>
    </div>
  );
}
