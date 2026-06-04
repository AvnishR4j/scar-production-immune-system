import { NextRequest } from "next/server";
import { apiError, sessionSchema } from "@/lib/api";
import { incidentRecord } from "@/lib/scenarios";
import {
  enforceRateLimit,
  enforceSameOrigin,
  noStoreJson,
  parseJsonBody,
  verifySessionToken,
} from "@/lib/security";
import { z } from "zod";

const deploySchema = sessionSchema.extend({
  scenarioId: z.literal("payment-retry-incident"),
});

export async function POST(request: NextRequest) {
  const crossOrigin = enforceSameOrigin(request);
  if (crossOrigin) return crossOrigin;

  const limited = enforceRateLimit(request, "deploy", 30);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, deploySchema);
  if ("response" in parsed) return parsed.response;
  if (!verifySessionToken(parsed.data.bankId, parsed.data.sessionToken)) {
    return apiError("Invalid or expired demo session.", 403);
  }

  return noStoreJson({
    incident: incidentRecord,
    status: "OUTAGE",
    affectedUsers: "38,412",
    checkoutSuccessRate: "12.4%",
    provider429Rate: "87.1%",
    startedAt: new Date().toISOString(),
  });
}
