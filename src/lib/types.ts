export type DemoPhase = "cold-start" | "outage" | "learning" | "protected";

export type Verdict = "APPROVE" | "BLOCK";

export type DiffLine = {
  kind: "context" | "add" | "remove";
  content: string;
};

export type ChangeScenario = {
  id: "payment-retry-incident" | "notification-retry-recurrence";
  sequence: number;
  service: string;
  title: string;
  pullRequest: string;
  author: string;
  description: string;
  files: string[];
  diff: DiffLine[];
  riskQuery: string;
};

export type RecalledMemory = {
  id: string;
  text: string;
  type: string;
  context: string;
  entities: string[];
  relevance: number;
};

export type RiskAnalysis = {
  verdict: Verdict;
  riskScore: number;
  confidence: number;
  headline: string;
  explanation: string;
  causalChain: string[];
  recommendations: string[];
  citedMemoryIds: string[];
  analysisMode: "groq" | "deterministic";
};

export type IncidentRecord = {
  id: string;
  title: string;
  service: string;
  incorrectDiagnosis: string;
  rootCause: string;
  resolution: string;
  futureGuardrails: string[];
  causalChain: string[];
};

export type RetainResult = {
  retained: boolean;
  memoryMode: "hindsight-cloud" | "demo-fallback";
  itemsCount: number;
  generalizedLesson: string;
  evidence: RecalledMemory[];
};

export type DemoSession = {
  bankId: string;
  sessionToken: string;
  memoryMode: "hindsight-cloud" | "demo-fallback";
  startedAt: string;
};

export type IntegrationStatus = {
  hindsight: "connected" | "demo-fallback";
  groq: "connected" | "deterministic";
};
