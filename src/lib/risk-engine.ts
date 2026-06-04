import { fallbackEvidence, incidentRecord } from "@/lib/scenarios";
import type { ChangeScenario, RecalledMemory, RiskAnalysis } from "@/lib/types";

const similarityStopWords = new Set([
  "against",
  "because",
  "cause",
  "change",
  "confirmed",
  "deployment",
  "different",
  "does",
  "engineer",
  "failure",
  "from",
  "guardrail",
  "incident",
  "into",
  "judge",
  "known",
  "learned",
  "lesson",
  "memory",
  "previous",
  "production",
  "proposed",
  "provided",
  "recreate",
  "resolution",
  "root",
  "rollout",
  "service",
  "successful",
  "system",
  "team",
  "this",
  "what",
  "when",
  "with",
]);

const causalSignalFamilies: Record<string, string[]> = {
  "retry synchronization": [
    "backoff",
    "fixed interval",
    "fixed retry",
    "periodic attempt",
    "retry",
    "synchron",
    "thundering herd",
  ],
  "resource exhaustion": [
    "capacity",
    "connection",
    "concurrency",
    "exhaust",
    "overwhelm",
    "pool",
    "saturat",
    "shared resource",
  ],
  "dependency throttling": [
    "429",
    "rate limit",
    "rate-limit",
    "throttle",
  ],
  "environment blind spot": [
    "mock",
    "staging",
    "test environment",
  ],
  "safe retry guardrail": [
    "canary",
    "exponential",
    "jitter",
    "randomized",
  ],
};

function causalSignals(value: string) {
  const normalized = value.toLowerCase();
  return new Set(
    Object.entries(causalSignalFamilies)
      .filter(([, patterns]) => patterns.some((pattern) => normalized.includes(pattern)))
      .map(([signal]) => signal),
  );
}

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

export function evidenceTraceForScenario(
  scenario: ChangeScenario,
  memories: RecalledMemory[],
) {
  const scenarioValue = scenarioText(scenario);
  const scenarioTerms = terms(scenarioValue);
  const scenarioSignals = causalSignals(scenarioValue);
  const matchedSignals = new Set<string>();

  const relevantMemories = memories.filter((memory) => {
    const memoryValue = memoryText(memory);
    const memoryMatches: string[] = [];
    const signalMatches = [...causalSignals(memoryValue)].filter((signal) => scenarioSignals.has(signal));

    for (const term of terms(memoryValue)) {
      if (scenarioTerms.has(term)) memoryMatches.push(term);
    }

    if (memoryMatches.length >= 2 || signalMatches.length >= 2) {
      signalMatches.forEach((signal) => matchedSignals.add(signal));
      if (signalMatches.length < 2) {
        memoryMatches.forEach((term) => matchedSignals.add(term));
      }
      return true;
    }

    return false;
  });

  return {
    relevantMemories,
    matchedSignals: [...matchedSignals].sort().slice(0, 12),
  };
}

export function relevantMemoriesForScenario(
  scenario: ChangeScenario,
  memories: RecalledMemory[],
) {
  return evidenceTraceForScenario(scenario, memories).relevantMemories;
}

export function deterministicAnalysis(
  scenario: ChangeScenario,
  memories: RecalledMemory[],
): RiskAnalysis {
  const { relevantMemories, matchedSignals } = evidenceTraceForScenario(scenario, memories);
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
      decisionBasis: memories.length ? "insufficient-evidence" : "empty-memory",
      matchedSignals: [],
      analysisMode: "evidence-policy",
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
    decisionBasis: "causal-evidence",
    matchedSignals,
    analysisMode: "evidence-policy",
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
