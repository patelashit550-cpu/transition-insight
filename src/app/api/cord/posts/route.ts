import { NextResponse } from "next/server";

import {
  cordOwnerAddress,
  isCordPrototypeEnabled,
  readCordFeed,
  verifyCordSignature,
  writeCordFeed,
  type CordPost,
} from "@/lib/cord";

export const runtime = "nodejs";

export async function GET() {
  if (!isCordPrototypeEnabled()) {
    return NextResponse.json({ error: "Chord write prototype is local-only" }, { status: 404 });
  }
  return NextResponse.json(readCordFeed());
}

export async function POST(request: Request) {
  if (!isCordPrototypeEnabled()) {
    return NextResponse.json({ error: "Chord write prototype is local-only" }, { status: 404 });
  }

  let payload: {
    body?: unknown;
    address?: unknown;
    timestamp?: unknown;
    signature?: unknown;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = typeof payload.body === "string" ? payload.body : "";
  const address = typeof payload.address === "string" ? payload.address : "";
  const signature = typeof payload.signature === "string" ? payload.signature : "";
  const timestamp = typeof payload.timestamp === "number" ? payload.timestamp : Number(payload.timestamp);

  const verified = verifyCordSignature({
    address,
    timestamp,
    body,
    signatureBase58: signature,
  });
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 401 });
  }

  const feed = readCordFeed();
  const post: CordPost = {
    id: `p-${Date.now().toString(36)}`,
    body: body.trim(),
    createdAt: new Date().toISOString(),
    address: cordOwnerAddress(),
  };
  feed.posts = [post, ...feed.posts].slice(0, 100);
  feed.updatedAt = post.createdAt;
  writeCordFeed(feed);

  return NextResponse.json({ ok: true, post, feed });
}
