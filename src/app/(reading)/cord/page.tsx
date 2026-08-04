import Link from "next/link";
import { notFound } from "next/navigation";
import { readFileSync } from "fs";
import path from "path";

import { isCordPrototypeEnabled, type CordFeed } from "@/lib/cord";

export const dynamic = "force-dynamic";

function loadFeed(): CordFeed {
  try {
    const raw = readFileSync(path.join(process.cwd(), "public", "cord", "feed.json"), "utf8");
    return JSON.parse(raw) as CordFeed;
  } catch {
    return { updatedAt: new Date().toISOString(), posts: [] };
  }
}

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function CordFeedPage() {
  if (!isCordPrototypeEnabled()) return notFound();

  const feed = loadFeed();

  return (
    <div className="p3-cord">
      <header className="p3-cord__header">
        <p className="p3-cord__kicker">Telamon</p>
        <h1 className="p3-cord__title">Chord</h1>
        <p className="p3-cord__lede">Short dispatches — where I am, what I’m thinking. Public read. Owner write.</p>
        <p className="p3-cord__actions">
          <Link className="p3-cord-btn p3-cord-btn--primary" href="/cord/compose/">
            Compose
          </Link>
        </p>
      </header>

      <ol className="p3-cord__feed">
        {feed.posts.length === 0 ? (
          <li className="p3-cord__empty">No dispatches yet.</li>
        ) : (
          feed.posts.map((post) => (
            <li key={post.id} className="p3-cord__item">
              <time className="p3-cord__when" dateTime={post.createdAt}>
                {formatWhen(post.createdAt)}
              </time>
              <p className="p3-cord__body">{post.body}</p>
            </li>
          ))
   