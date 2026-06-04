import { fallbackEvidence, generalizedLesson, incidentRecord } from "@/lib/scenarios";
import type { ChangeScenario, RecalledMemory, RiskAnalysis } from "@/lib/types";

export function deterministicAnalysis(
  scenario: ChangeScenario,
  memories: RecalledMemory[],
): RiskAnalysis {
  const hasRelevantMemory = memories.length > 0;

  if (!hasRelevantMemory) {
    return {
      verdict: "APPROVE",
      riskScore: 18,
      confidence: 72,
      headline: "No known recurrence risk",
      explanation:
        "Automated checks pass and SCAR has no organizational memory connecting this retry-policy change to a previous production failure.",
      causalChain: [
        "Tests pass",
        "No matching incident memory",
        "Standard rollout approved",
      ],
      recommendations: [
        "Monitor provider error rate during rollout",
        "Keep rollback controls ready",
      ],
      citedMemoryIds: [],
      analysisMode: "deterministic",
    };
  }

  return {
    verdict: "BLOCK",
    riskScore: 94,
    confidence: 96,
    headline: "Known failure mechanism detected",
    explanation:
      "This change affects a different service, but it recreates the deterministic retry and high-concurrency mechanism learned from INC-104. A constrained notification provider could synchronize workers and exhaust shared resources.",
    causalChain: [
      "Dependency throttles requests",
      "Fixed retries synchronize 500 workers",
      "Retry wave amplifies dependency pressure",
      "Shared worker resources are exhausted",
      "Notification delivery stalls",
    ],
    recommendations: incidentRecord.futureGuardrails,
    citedMemoryIds: memories.map((memory) => memory.id),
    analysisMode: "deterministic",
  };
}

export function buildRiskPrompt(
  scenario: ChangeScenario,
  memories: RecalledMemory[],
) {
  return [
    "Analyze this proposed deployment as a skeptical production safety agent.",
    "Only block when the supplied organizational memories provide evidence of recurrence.",
    "Identify causal similarity rather than matching service names.",
    "",
    `CHANGE: ${JSON.stringify(scenario)}`,
    `RECALLED MEMORIES: ${JSON.stringify(memories)}`,
    `REFERENCE LESSON: ${generalizedLesson}`,
    "",
    "Return JSON with verdict (APPROVE or BLOCK), riskScore (0-100), confidence (0-100), headline, explanation, causalChain (array), recommendations (array), and citedMemoryIds (array).",
  ].join("\n");
}

export function fallbackMemoriesForDemo(memoryLearned: boolean) {
  return memoryLearned ? fallbackEvidence : [];
}
