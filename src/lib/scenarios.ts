import type { ChangeScenario, IncidentRecord, RecalledMemory } from "@/lib/types";

export const scenarios: Record<ChangeScenario["id"], ChangeScenario> = {
  "payment-retry-incident": {
    id: "payment-retry-incident",
    sequence: 1,
    service: "payment-api",
    title: "Accelerate provider recovery",
    pullRequest: "PR-4821",
    author: "maya@payments",
    description:
      "Reduce provider recovery time by replacing randomized backoff with a fixed retry interval.",
    files: ["services/payment/retry-policy.ts", "config/payment.yml"],
    diff: [
      { kind: "context", content: "export const providerRetryPolicy = {" },
      { kind: "remove", content: "  delay: exponentialBackoffWithJitter()," },
      { kind: "remove", content: "  maxRetries: 3," },
      { kind: "add", content: "  delay: fixedInterval(1000)," },
      { kind: "add", content: "  maxRetries: 5," },
      { kind: "context", content: "};" },
    ],
    riskQuery:
      "Does this payment API retry-policy change recreate a known production failure pattern? Focus on retry synchronization, rate limits, concurrency, and downstream resource exhaustion.",
  },
  "notification-retry-recurrence": {
    id: "notification-retry-recurrence",
    sequence: 2,
    service: "notification-worker",
    title: "Clear notification backlog faster",
    pullRequest: "PR-4997",
    author: "liam@messaging",
    description:
      "Increase worker concurrency and use fast fixed retries to drain delayed customer notifications.",
    files: ["workers/notification/dispatcher.ts", "config/workers.yml"],
    diff: [
      { kind: "context", content: "export const dispatcherPolicy = {" },
      { kind: "remove", content: "  backoff: randomized(30, 90)," },
      { kind: "remove", content: "  concurrency: 50," },
      { kind: "add", content: "  backoff: fixed(2)," },
      { kind: "add", content: "  concurrency: 500," },
      { kind: "context", content: "};" },
    ],
    riskQuery:
      "Does this notification worker change recreate any previously learned failure mechanism, even if the affected service and dependency are different?",
  },
};

export const incidentRecord: IncidentRecord = {
  id: "INC-104",
  title: "Checkout unavailable after provider rate limiting",
  service: "payment-api",
  incorrectDiagnosis:
    "The first diagnosis blamed insufficient database capacity and proposed increasing the connection pool.",
  rootCause:
    "Fixed-interval retries synchronized thousands of payment requests after the provider returned HTTP 429 responses. The retry wave exhausted the shared database connection pool. Staging missed the behavior because the provider mock never rate-limited requests.",
  resolution:
    "The team rolled back the change, restored randomized exponential backoff with jitter, capped concurrent retries, and added a rate-limited canary test.",
  futureGuardrails: [
    "Preserve randomized jitter in retry policies",
    "Cap concurrent retries against constrained dependencies",
    "Simulate provider rate limits before rollout",
    "Require a 5% canary for retry-policy changes",
  ],
  causalChain: [
    "Provider returns HTTP 429",
    "Fixed retries synchronize workers",
    "Retry wave saturates shared resources",
    "Database connection pool is exhausted",
    "Checkout becomes unavailable",
  ],
};

export const generalizedLesson =
  "Aggressive deterministic retries against a constrained dependency can synchronize workers and exhaust downstream resources, even when staging tests pass. Preserve jitter, cap concurrency, simulate rate limits, and use a canary.";

export const fallbackEvidence: RecalledMemory[] = [
  {
    id: "memory-inc-104-root-cause",
    text: incidentRecord.rootCause,
    type: "experience",
    context: "INC-104 root-cause analysis",
    entities: ["payment-api", "HTTP 429", "retry policy", "connection pool"],
    relevance: 0.97,
    mentionedAt: new Date().toISOString(),
    documentId: incidentRecord.id,
  },
  {
    id: "memory-inc-104-guardrail",
    text: generalizedLesson,
    type: "observation",
    context: "Generalized production safety lesson",
    entities: ["deterministic retries", "jitter", "concurrency", "canary"],
    relevance: 0.94,
    mentionedAt: new Date().toISOString(),
    documentId: incidentRecord.id,
  },
];

export function getScenario(id: string) {
  if (id === "payment-retry-incident" || id === "notification-retry-recurrence") {
    return scenarios[id];
  }

  return null;
}

export function fallbackEvidenceFromIncident(incident: IncidentRecord): RecalledMemory[] {
  const now = new Date().toISOString();
  const lesson = [
    incident.rootCause,
    `Successful resolution: ${incident.resolution}`,
    `Future guardrails: ${incident.futureGuardrails.join("; ")}`,
  ].join(" ");

  return [
    {
      id: `fallback-${incident.id.toLowerCase()}-experience`,
      text: incident.rootCause,
      type: "experience",
      context: `${incident.id} engineer-authored root cause`,
      entities: [incident.service, "root cause", "production incident"],
      relevance: 0.97,
      mentionedAt: now,
      documentId: incident.id,
    },
    {
      id: `fallback-${incident.id.toLowerCase()}-lesson`,
      text: lesson,
      type: "observation",
      context: "Generalized engineer-authored safety lesson",
      entities: [incident.service, "guardrail", "resolution"],
      relevance: 0.94,
      mentionedAt: now,
      documentId: incident.id,
    },
  ];
}
