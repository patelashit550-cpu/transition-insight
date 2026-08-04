"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import bs58 from "bs58";

import {
  buildCordSignMessage,
  CORD_MAX_BODY,
  cordOwnerAddress,
  getPhantomProvider,
  isPhantomProviderAvailable,
  openPhantomInstall,
  PHANTOM_INSTALL_URL,
} from "@/lib/cord-client";

export function CordComposeForm() {
  const owner = useMemo(() => cordOwnerAddress(), []);
  const [phantomReady, setPhantomReady] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPhantomReady(isPhantomProviderAvailable());
  }, []);

  const connect = useCallback(async () => {
    setStatus(null);
    const phantom = getPhantomProvider();
    if (!phantom) {
      openPhantomInstall();
      setStatus("Phantom not detected — opened phantom.app. Install the extension, then refresh this page.");
      return;
    }
    try {
      const res = await phantom.connect();
      const next = res.publicKey.toString();
      setAddress(next);
      if (owner && next !== owner) {
        setStatus(`Connected ${next.slice(0, 4)}…${next.slice(-4)} — not the Chord owner. Flip to Ash’s wallet.`);
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Connect rejected");
    }
  }, [owner]);

  const post = useCallback(async () => {
    setStatus(null);
    const phantom = getPhantomProvider();
    if (!phantom?.publicKey) {
      setStatus("Connect Phantom first");
      return;
    }
    const from = phantom.publicKey.toString();
    if (!owner || from !== owner) {
      setStatus("Wrong wallet — Chord only accepts the published Solana owner address.");
      return;
    }
    const text = body.trim();
    if (!text) {
      setStatus("Write something first");
      return;
    }
    if (text.length > CORD_MAX_BODY) {
      setStatus(`Max ${CORD_MAX_BODY} characters`);
      return;
    }

    setBusy(true);
    try {
      const timestamp = Date.now();
      const message = buildCordSignMessage(from, timestamp, text);
      const encoded = new TextEncoder().encode(message);
      const { signature } = await phantom.signMessage(encoded, "utf8");
      const signatureBase58 = bs58.encode(signature);

      const res = await fetch("/api/cord/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          body: text,
          address: from,
          timestamp,
          signature: signatureBase58,
        }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setStatus(data.error || `Post failed (${res.status})`);
        return;
      }
      setBody("");
      setStatus("Posted. Back to the feed to see it.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Sign / post failed");
    } finally {
      setBusy(false);
    }
  }, [body, owner]);

  const isOwner = Boolean(address && owner && address === owner);

  return (
    <div className="p3-cord-compose">
      <p className="p3-cord-compose__hint">
        Owner wallet <code className="p3-cord-compose__code">{owner || "(set NEXT_PUBLIC_SOLANA_WALLET_ADDRESS)"}</code>
      </p>

      <div className="p3-cord-compose__row">
        <button type="button" className="p3-cord-btn" onClick={connect} disabled={busy}>
          {address ? `Connected ${address.slice(0, 4)}…${address.slice(-4)}` : "Connect Phantom"}
        </button>
        {isOwner ? <span className="p3-cord-compose__ok">Ash — can post</span> : null}
      </div>

      {!phantomReady && !address ? (
        <p className="p3-cord-compose__hint">
          Phantom extension not detected.{" "}
          <a className="p3-cord__inline-link" href={PHANTOM_INSTALL_URL} target="_blank" rel="noopener noreferrer">
            Install Phantom
          </a>
          , then refresh.
        </p>
      ) : null}

      <label className="p3-cord-compose__label" htmlFor="cord-body">
        Dispatch
      </label>
      <textarea
        id="cord-body"
        className="p3-cord-compose__input"
        rows={5}
        maxLength={CORD_MAX_BODY}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Where you are / what you’re thinking…"
        disabled={busy}
      />
      <div className="p3-cord-compose__meta">
        <span>
          {body.trim().length}/{CORD_MAX_BODY}
        </span>
        <button type="button" className="p3-cord-btn p3-cord-btn--primary" onClick={post} disabled={busy || !isOwner}>
          {busy ? "Signing…" : "Sign & post"}
        </button>
      </div>

      {status ? <p className="p3-cord-compose__status">{status}</p> : null}
    </div>
  );
}
