import { fallbackEvidence, incidentRecord } from "@/lib/scenarios";
import type { ChangeScenario, RecalledMemory, RiskAnalysis } from "@/lib/types";

const similarityStopWords = new Set([
  "against",
  "because",
  "change",
  "deployment",
  "different",
  "does",
  "failure",
  "from",
  "incident",
  "into",
  "lesson",
  "memory",
  "previous",
  "production",
  "proposed",
  "recreate",
  "resolution",
  "root",
  "service",
  "this",
  "what",
  "when",
  "with",
]);

function terms(value: string) {
  const normalize = (term: string) => {
    if (term.endsWith("ies") && term.length > 5) return `${term.slice(0, -3)}y`;
    if (term.endsWith("ing") && term.length > 6) return term.slice(0, -3);
    if (term.endsWith("ed") && term.length > 5) return term.slice(0, -2);
    if (term.endsWith("s") && term.length > 5) return term.slice(0, -1);
    return term;
  };

  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length >= 4 && !similarityStopWords.has(term))
      .map(normalize),
  );
}

function scenarioText(scenario: ChangeScenario) {
  return [
    scenario.title,
    scenario.description,
    scenario.riskQuery,
    ...scenario.diff.map((line) => line.content),
  ].join(" ");
}

function memoryText(memory: RecalledMemory) {
  return [memory.text, memory.context, ...memory.entities].join(" ");
}

export function relevantMemoriesForScenario(
  scenario: ChangeScenario,
  memories: RecalledMemory[],
) {
  const scenarioTerms = terms(scenarioText(scenario));

  return memories.filter((memory) => {
    let overlap = 0;
    for (const term of terms(memoryText(memory))) {
      if (scenarioTerms.has(term)) overlap += 1;
      if (overlap >= 2) return true;
    }
    return false;
  });
}

export function deterministicAnalysis(
  scenario: ChangeScenario,
  memories: RecalledMemory[],
): RiskAnalysis {
  const relevantMemories = relevantMemoriesForScenario(scenario, memories);
  const hasRelevantMemory = relevantMemories.length > 0;
  const guidedRecurrence = scenario.id === "notification-retry-recurrence";

  if (!hasRelevantMemory) {
    return {
      verdict: "APPROVE",
      riskScore: 18,
      confidence: 72,
      headline: memories.length ? "Recalled memory is not causally relevant" : "No known recurrence risk",
      explanation: memories.length
        ? `SCAR recalled ${memories.length} organizational memories, but none share enough causal evidence with this proposed ${scenario.service} deployment to justify blocking it.`
        : "Automated checks pass and SCAR has no organizational memory connecting this proposed deployment to a previous production failure.",
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
      `This ${scenario.service} change affects a different service, but retained incident evidence identifies a causally similar failure mechanism. SCAR changed its decision because organizational memory now contains an engineer-confirmed root cause and guardrails.`,
    causalChain: [
      ...(guidedRecurrence
        ? [
            "Dependency throttles requests",
            "Fixed retries synchronize 500 workers",
            "Retry wave amplifies dependency pressure",
            "Shared worker resources are exhausted",
            "Notification delivery stalls",
          ]
        : [
            "Proposed change activates a mechanism found in retained evidence",
            "The mechanism can reproduce the cited incident conditions",
            `The ${scenario.service} deployment is exposed to recurrence`,
          ]),
    ],
    recommendations: guidedRecurrence
      ? incidentRecord.futureGuardrails
      : [
          "Apply the engineer-confirmed resolution from the cited memory before rollout",
          "Add a regression test for the recalled failure mechanism",
          "Use a staged rollout and monitor the cited failure signals",
        ],
    citedMemoryIds: relevantMemories.map((memory) => memory.id),
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
    "",
    "Return JSON with verdict (APPROVE or BLOCK), riskScore (0-100), confidence (0-100), headline, explanation, causalChain (array), recommendations (array), and citedMemoryIds (array).",
  ].join("\n");
}

export function fallbackMemoriesForDemo(memoryLearned: boolean) {
  return memoryLearned ? fallbackEvidence : [];
}
