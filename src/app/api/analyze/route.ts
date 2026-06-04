import { NextRequest, NextResponse } from "next/server";
import { analyzeSchema, apiError } from "@/lib/api";
import { analyzeWithGroq, groqConfigured } from "@/lib/groq";
import { hindsightConfigured, recallRiskMemories } from "@/lib/hindsight";
import { fallbackMemoriesForDemo } from "@/lib/risk-engine";
import { getScenario } from "@/lib/scenarios";
import type { RecalledMemory } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const parsed = analyzeSchema.safeParse(await request.json());
  if (!parsed.success) return apiError("Invalid analysis request.");

  const scenario = getScenario(parsed.data.scenarioId);
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
    memories = fallbackMemoriesForDemo(parsed.data.memoryLearned);
  }

  const analysis = await analyzeWithGroq(scenario, memories);

  return NextResponse.json({
    scenario,
    analysis,
    memories,
    integration: {
      hindsight: memoryMode === "hindsight-cloud" ? "connected" : "demo-fallback",
      groq: groqConfigured() ? "connected" : "deterministic",
    },
  });
}
