"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  configuredSolanaRpcUrl,
  parseSolanaRpcUrl,
  probeSolanaRpc,
  SOLANA_RPC_STORAGE_KEY,
  type SolanaRpcProbe,
} from "@/lib/solana-rpc";

export type SolanaRpcStatus = "idle" | "probing" | "ok" | "error";

function readStoredRpcUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(SOLANA_RPC_STORAGE_KEY);
    if (!stored) return null;
    const parsed = parseSolanaRpcUrl(stored);
    return parsed.ok ? parsed.url : null;
  } catch {
    return null;
  }
}

function persistRpcUrl(url: string | null): boolean {
  try {
    if (url) {
      window.localStorage.setItem(SOLANA_RPC_STORAGE_KEY, url);
    } else {
      window.localStorage.removeItem(SOLANA_RPC_STORAGE_KEY);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Browser RPC selection: env default, optional localStorage override, live probe.
 */
export function useSolanaRpc(ownerAddress?: string) {
  const configured = useMemo(() => configuredSolanaRpcUrl(), []);
  const [customUrl, setCustomUrl] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<SolanaRpcStatus>("idle");
  const [probe, setProbe] = useState<SolanaRpcProbe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const probeSeq = useRef(0);

  const activeUrl = customUrl ?? configured;
  const usingCustom = customUrl !== null;

  useEffect(() => {
    const stored = readStoredRpcUrl();
    const frame = window.requestAnimationFrame(() => {
      setCustomUrl(stored);
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const probeActive = useCallback(async (url: string) => {
    const seq = ++probeSeq.current;
    setStatus("probing");
    setError(null);
    try {
      const next = await probeSolanaRpc(url, ownerAddress);
      if (seq !== probeSeq.current) {
        return { ok: true as const, probe: next };
      }
      setProbe(next);
      setStatus("ok");
      return { ok: true as const, probe: next };
    } catch (err) {
      const message = err instanceof Error ? err.message : "RPC probe failed";
      if (seq !== probeSeq.current) {
        return { ok: false as const, error: message };
      }
      setProbe(null);
      setStatus("error");
      setError(message);
      return { ok: false as const, error: message };
    }
  }, [ownerAddress]);

  useEffect(() => {
    if (!hydrated) return;
    const frame = window.requestAnimationFrame(() => {
      void probeActive(activeUrl);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeUrl, hydrated, probeActive]);

  const applyCustom = useCallback(async (raw: string) => {
    const parsed = parseSolanaRpcUrl(raw);
    if (!parsed.ok) {
      setError(parsed.error);
      setStatus("error");
      return parsed;
    }
    if (!persistRpcUrl(parsed.url)) {
      setError("Could not save RPC URL in this browser");
      setStatus("error");
      return { ok: false as const, error: "Could not save RPC URL in this browser" };
    }
    setCustomUrl(parsed.url);
    return { ok: true as const, url: parsed.url };
  }, []);

  const resetToConfigured = useCallback(() => {
    persistRpcUrl(null);
    setCustomUrl(null);
    setError(null);
  }, []);

  return {
    configuredUrl: configured,
    activeUrl,
    usingCustom,
    hydrated,
    status,
    probe,
    error,
    applyCustom,
    resetToConfigured,
    refresh: () => probeActive(activeUrl),
  };
}
