import { NextResponse } from "next/server";
import { z } from "zod";

export const sessionSchema = z.object({
  bankId: z.string().min(8).max(120).regex(/^scar-demo-[a-zA-Z0-9-]+$/),
  sessionToken: z.string().min(40).max(160),
});

export const analyzeSchema = sessionSchema.extend({
  scenarioId: z.enum(["payment-retry-incident", "notification-retry-recurrence"]),
  memoryLearned: z.boolean().default(false),
});

export function apiError(message: string, status = 400) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
