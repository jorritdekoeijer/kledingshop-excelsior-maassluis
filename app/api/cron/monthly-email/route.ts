import { NextResponse } from "next/server";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function GET(request: Request) {
  const expected = getEnv("CRON_SECRET");
  const got = request.headers.get("x-cron-secret") ?? "";
  if (got !== expected) return new NextResponse("Unauthorized", { status: 401 });

  return NextResponse.json({ ok: true });
}

