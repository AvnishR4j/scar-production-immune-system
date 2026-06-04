import { NextRequest } from "next/server";
import { analyzeSchema, apiError } from "@/lib/api";
import { analyzeWithGroq, groqConfigured } from "@/lib/groq";
import { hindsightConfigured, recallRiskMemories } from "@/lib/hindsight";
import { fallbackMemoriesForDemo } from "@/lib/risk-engine";
import { fallbackEvidenceFromIncident, getScenario } from "@/lib/scenarios";
import {
  enforceRateLimit,
  enforceSameOrigin,
  noStoreJson,
  parseJsonBody,
  verifySessionToken,
} from "@/lib/security";
import type { RecalledMemory } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const crossOrigin = enforceSameOrigin(request);
  if (crossOrigin) return crossOrigin;

  const limited = enforceRateLimit(request, "analyze", 30);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, analyzeSchema);
  if ("response" in parsed) return parsed.response;
  if (!verifySessionToken(parsed.data.bankId, parsed.data.sessionToken)) {
    return apiError("Invalid or expired demo session.", 403);
  }

  const scenario = parsed.data.customScenario ?? getScenario(parsed.data.scenarioId ?? "");
  if (!scenario) return apiError("Unknown scenario.", 404);

  let memoryMode: "hindsight-cloud" | "demo-fallback" = hindsightConfigured()
    ? "hindsight-cloud"
    : "demo-fallback";
  let memories: RecalledMemory[] = [];

  try {
    memories = await recallRiskMemories(parsed.data.bankId, scenario.riskQuery);
  } catch {
    memoryMode = "demo-fallback";
  }

  if (memoryMode === "demo-fallback") {
    memories = parsed.data.memoryLearned && parsed.data.fallbackIncident
      ? fallbackEvidenceFromIncident(parsed.data.fallbackIncident)
      : fallbackMemoriesForDemo(parsed.data.memoryLearned);
  }

  const analysis = await analyzeWithGroq(scenario, memories);

  return noStoreJson({
    scenario,
    analysis,
    memories,
    integration: {
      hindsight: memoryMode === "hindsight-cloud" ? "connected" : "demo-fallback",
      groq: groqConfigured() ? "connected" : "deterministic",
    },
  });
}
