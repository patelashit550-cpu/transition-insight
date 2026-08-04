import Link from "next/link";
import { notFound } from "next/navigation";

import { CordComposeForm } from "@/components/cord/CordComposeForm";
import { isCordPrototypeEnabled } from "@/lib/cord";

export const dynamic = "force-dynamic";

export default function CordComposePage() {
  if (!isCordPrototypeEnabled()) return notFound();

  return (
    <div className="p3-cord">
      <header className="p3-cord__header">
        <p className="p3-cord__kicker">Compose</p>
        <h1 className="p3-cord__title">Chord</h1>
        <p className="p3-cord__lede">
          Connect Phantom with the published Solana owner key, sign the dispatch, post. Everyone else only sees the{" "}
          <Link href="/cord/" className="p3-cord__inline-link">
            feed
          </Link>
          .
        </p>
      </header>
     