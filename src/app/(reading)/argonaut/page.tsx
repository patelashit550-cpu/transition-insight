import type { Metadata } from "next";

import { ArgonautAsk } from "@/components/argonaut/ArgonautAsk";

export const metadata: Metadata = {
  title: "Argonaut — Transition Insight",
  description: "JSON Intelligence",
};

export default function ArgonautPage() {
  return (
    <div className="p3-argonaut">
      <header className="p3-argonaut__header">
        <p className="p3-argonaut__kicker">Telamon // Firmitas</p>
        <h1 className="p3-argonaut__title">Argonaut</h1>
        <p className="p3-argonaut__lede">JSON Intelligence</p>
      </header>
      <ArgonautAsk />
    </div>
  );
}
