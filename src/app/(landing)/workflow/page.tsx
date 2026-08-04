import { notFound } from "next/navigation";

import { getContentBuildTier } from "@/lib/content-tier";
import { getWorkflowContext, tierLabel } from "@/lib/publishing-workflow";

function badge(on: boolean) {
  return (
    <span
      className={
        on
          ? "inline-flex min-w-12 justify-center rounded border border-emerald-500/50 bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300"
          : "inline-flex min-w-12 justify-center rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs font-medium text-zinc-500"
      }
    >
      {on ? "yes" : "no"}
    </span>
  );
}

function tierChip(label: string, on: boolean) {
  return (
    <span
      className={
        on
          ? "inline-flex items-center rounded border border-emerald-500/45 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-emerald-300"
          : "inline-flex items-center rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500"
      }
    >
      {label}
    </span>
  );
}

export default function WorkflowPage() {
  const tier = getContentBuildTier();
  if (tier === "global") return notFound();

  const { rows, counts } = getWorkflowContext();

  return (
    <div className="p3-narrative-canvas">
      <article className="p3-narrative-article">
        <header className="p3-narrative-article__header">
          <h1 className="p3-narrative-article__title">Publication Signal</h1>
          <span className="p3-narrative-article__rule" aria-hidden="true" />
          <p className="mt-3 text-sm text-zinc-400">
            A live signal map of what is still being shaped, what is in refinement, and what is already public.
          </p>
          <p className="mt-2 text-xs tracking-[0.22em] uppercase text-emerald-300">
            Active lens: {tierLabel(tier)}
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Studio</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-100">{counts.writing}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Refinement</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-100">{counts.editing}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Released</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-100">{counts.published}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Archive</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-100">{counts.canonical}</p>
          </div>
        </section>

        <section className="mt-6 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/50">
          <p className="border-b border-zinc-800 px-4 py-2 text-xs text-zinc-500">
            <span className="font-medium uppercase tracking-[0.12em] text-zinc-400">
              Presence
            </span>
            {" — "}
            <span className="text-emerald-400/90">dev</span> (
            <code className="rounded bg-zinc-900 px-1 text-zinc-300">next dev</code>
            ): all stages.{" "}
            <span className="text-emerald-400/90">preprod</span>:{" "}
            <code className="rounded bg-zinc-900 px-1 text-zinc-300">stage: review</code>{" "}
            or published — bump from <code className="rounded bg-zinc-900 px-1 text-zinc-300">draft</code>{" "}
            when ready to smoke-test an artifact.{" "}
            <span className="text-emerald-400/90">global</span>:{" "}
            <code className="rounded bg-zinc-900 px-1 text-zinc-300">published</code> / canonical only.
          </p>
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-800 text-xs uppercase tracking-[0.15em] text-zinc-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Signal</th>
                <th className="px-4 py-3">Presence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.slug} className="border-b border-zinc-900/80 align-top">
                  <td className="px-4 py-3 text-zinc-100">{row.title}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">{row.slug}</td>
                  <td className="px-4 py-3 text-zinc-300">{row.stage}</td>
                  <td className="px-4 py-3 text-zinc-300">{row.lane}</td>
                  <td className="px-4 py-3">{badge(row.showInNav)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {tierChip("preprod", row.visibleInPreprod)}
                      {tierChip("global", row.visibleInGlobal)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </article>
    </div>
  );
}
