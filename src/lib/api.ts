import { NextResponse } from "next/server";
import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);

export const incidentSchema = z.object({
  id: text(40).regex(/^[A-Za-z0-9-]+$/),
  title: text(160),
  service: text(100),
  incorrectDiagnosis: text(800),
  rootCause: text(1_500),
  resolution: text(1_500),
  futureGuardrails: z.array(text(240)).min(1).max(8),
  causalChain: z.array(text(240)).min(1).max(8),
});

export const customScenarioSchema = z.object({
  id: text(80).regex(/^[A-Za-z0-9-]+$/),
  sequence: z.number().int().min(1).max(99),
  service: text(100),
  title: text(160),
  pullRequest: text(40),
  author: text(100),
  description: text(1_500),
  files: z.array(text(180)).min(1).max(8),
  diff: z.array(z.object({
    kind: z.enum(["context", "add", "remove"]),
    content: text(300),
  })).min(1).max(20),
  riskQuery: text(1_500),
});

export const sessionSchema = z.object({
  bankId: z.string().min(8).max(120).regex(/^scar-demo-[a-zA-Z0-9-]+$/),
  sessionToken: z.string().min(40).max(160),
});

export const analyzeSchema = sessionSchema.extend({
  scenarioId: z.enum(["payment-retry-incident", "notification-retry-recurrence"]).optional(),
  customScenario: customScenarioSchema.optional(),
  memoryLearned: z.boolean().default(false),
  fallbackIncident: incidentSchema.optional(),
}).refine((value) => Boolean(value.scenarioId || value.customScenario), {
  message: "A scenario is required.",
});

export const retainIncidentSchema = sessionSchema.extend({
  incident: incidentSchema,
});

export function apiError(message: string, status = 400) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
