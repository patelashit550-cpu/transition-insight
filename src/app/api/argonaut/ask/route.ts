import { NextResponse } from "next/server";

import { runArgonautAsk } from "@/lib/argonaut";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: { question?: unknown };
  try {
    payload = (await request.json()) as { question?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const outcome = await runArgonautAsk(payload.question);
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }
  return NextResponse.json(outcome.result);
}
