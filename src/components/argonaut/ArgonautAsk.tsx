"use client";

import { FormEvent, KeyboardEvent, useState } from "react";

import { withBasePath } from "@/lib/base-path";

type Grounded = { title: string; path?: string };

type WebState =
  | { status: "used"; sources: { title: string; url: string; snippet: string }[] }
  | { status: "unavailable"; reason: string }
  | { status: "empty"; reason: string };

type AskResponse = {
  answer?: string;
  stance?: "admit" | "defer" | "refuse";
  groundedIn?: Grounded[];
  notes?: string;
  web?: WebState;
  model?: { status: "used" | "unavailable"; id?: string; reason?: string };
  error?: string;
};

const ASK_PATH = withBasePath("/api/argonaut/ask/");

const EMPTY_COPY =
  "JSON Intelligence. The published ontology (Regnum Dei) filters first; Carta is the intro essay, not the product name. The open web is consulted only when configured — and never as doctrine. Gaps are named, not filled.";

function stanceLabel(stance: AskResponse["stance"]): string | null {
  if (stance === "admit") return "Grounded";
  if (stance === "defer") return "Deferred";
  if (stance === "refuse") return "Refused";
  return null;
}

export function ArgonautAsk() {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const text = question.replace(/\s+/g, " ").trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(ASK_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const data = (await res.json().catch(() => null)) as AskResponse | null;
      if (!res.ok) {
        if (res.status === 404) {
          setResult(null);
          setError(
            "Argonaut’s voyage runs in the local studio (`npm run dev`). The published static site has no ask route — same posture as Chord.",
          );
          return;
        }
        setResult(null);
        setError(data?.error || `Ask failed (${res.status}).`);
        return;
      }
      setResult(data);
    } catch {
      setResult(null);
      setError("Argonaut could not be reached. Use `npm run dev` on this machine.");
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const stance = stanceLabel(result?.stance);
  const grounded = result?.groundedIn ?? [];

  return (
    <div className="p3-argonaut-ask">
      <div className="p3-argonaut-ask__answer" role="status" aria-live="polite">
        {busy ? (
          <p className="p3-argonaut-ask__muted">Reading the corpus…</p>
        ) : error ? (
          <p className="p3-argonaut-ask__error">{error}</p>
        ) : result?.answer ? (
          <p className="p3-argonaut-ask__prose">{result.answer}</p>
        ) : (
          <p className="p3-argonaut-ask__muted">{EMPTY_COPY}</p>
        )}
      </div>

      <form className="p3-argonaut-ask__form" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="argonaut-q">
          Question for Argonaut
        </label>
        <textarea
          id="argonaut-q"
          className="p3-argonaut-ask__input"
          rows={3}
          maxLength={800}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="What is soundness, in Regnum Dei’s terms?"
          disabled={busy}
        />
        <button
          type="submit"
          className="p3-argonaut-ask__send"
          disabled={busy || question.trim().length < 3}
        >
          {busy ? "…" : "Ask"}
        </button>
      </form>

      {result ? (
        <p className="p3-argonaut-ask__meta">
          {stance ? <span className="p3-argonaut-ask__tag">{stance}</span> : null}
          {grounded.length > 0 ? (
            <span>Grounded in {grounded.map((g) => g.title).join(" · ")}</span>
          ) : (
            <span>No corpus footing named</span>
          )}
          {result.web?.status === "used" ? (
            <span> · web consulted</span>
          ) : result.web?.status === "unavailable" ? (
            <span title={result.web.reason}> · web unavailable</span>
          ) : result.web?.status === "empty" ? (
            <span> · web silent</span>
          ) : null}
          {result.model?.status === "unavailable" ? (
            <span title={result.model.reason}> · model unused</span>
          ) : null}
        </p>
      ) : null}
      {result?.notes ? <p className="p3-argonaut-ask__notes">{result.notes}</p> : null}
    </div>
  );
}
