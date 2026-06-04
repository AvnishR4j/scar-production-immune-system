import { NextResponse } from "next/server";
import { createDemoBank } from "@/lib/hindsight";
import type { DemoSession } from "@/lib/types";

export const runtime = "nodejs";

export async function POST() {
  const bankId = `scar-demo-${crypto.randomUUID()}`;

  try {
    const memoryMode = await createDemoBank(bankId);
    const session: DemoSession = {
      bankId,
      memoryMode,
      startedAt: new Date().toISOString(),
    };

    return NextResponse.json(session);
  } catch {
    const session: DemoSession = {
      bankId,
      memoryMode: "demo-fallback",
      startedAt: new Date().toISOString(),
    };

    return NextResponse.json(session);
  }
}
