import { NextRequest } from "next/server";
import { apiError, retainIncidentSchema } from "@/lib/api";
import { fallbackRetainResult, retainIncident } from "@/lib/hindsight";
import {
  enforceRateLimit,
  enforceSameOrigin,
  noStoreJson,
  parseJsonBody,
  verifySessionToken,
} from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const crossOrigin = enforceSameOrigin(request);
  if (crossOrigin) return crossOrigin;

  const limited = enforceRateLimit(request, "retain", 12);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, retainIncidentSchema);
  if ("response" in parsed) return parsed.response;
  if (!verifySessionToken(parsed.data.bankId, parsed.data.sessionToken)) {
    return apiError("Invalid or expired demo session.", 403);
  }

  try {
    return noStoreJson(await retainIncident(parsed.data.bankId, parsed.data.incident));
  } catch {
    return noStoreJson(fallbackRetainResult(parsed.data.incident));
  }
}
