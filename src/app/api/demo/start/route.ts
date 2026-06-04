import { NextRequest } from "next/server";
import { createDemoBank } from "@/lib/hindsight";
import {
  createSessionToken,
  enforceRateLimit,
  enforceSameOrigin,
  noStoreJson,
} from "@/lib/security";
import type { DemoSession } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const crossOrigin = enforceSameOrigin(request);
  if (crossOrigin) return crossOrigin;

  const limited = enforceRateLimit(request, "demo-start", 20);
  if (limited) return limited;

  const bankId = `scar-demo-${crypto.randomUUID()}`;
  const sessionToken = createSessionToken(bankId);

  try {
    const memoryMode = await createDemoBank(bankId);
    const session: DemoSession = {
      bankId,
      sessionToken,
      memoryMode,
      startedAt: new Date().toISOString(),
    };

    return noStoreJson(session);
  } catch {
    const session: DemoSession = {
      bankId,
      sessionToken,
      memoryMode: "demo-fallback",
      startedAt: new Date().toISOString(),
    };

    return noStoreJson(session);
  }
}
