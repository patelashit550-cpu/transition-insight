"use client";

import { FormEvent, useState } from "react";

import { useSolanaRpc } from "@/lib/use-solana-rpc";

type Props = {
  ownerAddress?: string;
  variant?: "cord";
};

function hostLabel(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function SolanaRpcPanel({ ownerAddress, variant = "cord" }: Props) {
  const rpc = useSolanaRpc(ownerAddress);
  const [draft, setDraft] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await rpc.applyCustom(draft);
    if (result.ok) {
      setDraft("");
    }
  };

  const statusText =
    rpc.status === "probing"
      ? "probing…"
      : rpc.status === "ok" && rpc.probe
        ? `epoch ${rpc.probe.epoch} · slot ${rpc.probe.absoluteSlot.toLocaleString("en-US")}`
        : rpc.error || "offline";

  const balanceText =
    rpc.status === "ok" && rpc.probe?.sol != null ? `${rpc.probe.sol} SOL` : null;

  return (
    <details className={`p3-solana-rpc p3-solana-rpc--${variant}`}>
      <summary className="p3-solana-rpc__summary">
        <span className="p3-solana-rpc__kicker">RPC</span>
        <span className="p3-solana-rpc__host">{hostLabel(rpc.activeUrl)}</span>
        {rpc.usingCustom ? <span className="p3-solana-rpc__tag p3-solana-rpc__tag--custom">custom</span> : null}
        {rpc.usingPublicGateway && !rpc.usingCustom ? (
          <span className="p3-solana-rpc__tag p3-solana-rpc__tag--public">public</span>
        ) : null}
      </summary>

      <p className="p3-solana-rpc__status" role="status">
        {statusText}
        {balanceText ? ` · ${balanceText}` : null}
      </p>

      <form className="p3-solana-rpc__form" onSubmit={onSubmit}>
        <label className="p3-solana-rpc__label" htmlFor={`solana-rpc-url-${variant}`}>
          Custom JSON-RPC
        </label>
        <input
          id={`solana-rpc-url-${variant}`}
          className="p3-solana-rpc__input"
          type="url"
          name="rpc"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://your-rpc.example"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className="p3-solana-rpc__actions">
          <button type="submit" className="p3-cord-btn p3-cord-btn--primary" disabled={!draft.trim()}>
            Use
          </button>
          <button
            type="button"
            className="p3-cord-btn"
            onClick={() => {
              setDraft("");
              rpc.resetToConfigured();
            }}
            disabled={!rpc.usingCustom}
          >
            Reset
          </button>
        </div>
      </form>

      <p className="p3-solana-rpc__hint">
        PublicNode is a shared CORS gateway — epoch and slot only. Paste a Helius, QuickNode, or validator RPC to read
        balance; stored in this browser, not in the published site.
      </p>
    </details>
  );
}
