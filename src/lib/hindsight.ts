import { HindsightClient } from "@vectorize-io/hindsight-client";
import {
  fallbackEvidenceFromIncident,
  generalizedLesson,
  incidentRecord,
} from "@/lib/scenarios";
import type { IncidentRecord, RecalledMemory, RetainResult } from "@/lib/types";

const HINDSIGHT_TIMEOUT_MS = 25_000;

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function isConfigured() {
  const baseUrl = process.env.HINDSIGHT_BASE_URL;
  if (!baseUrl || !process.env.HINDSIGHT_API_KEY) return false;

  try {
    const url = new URL(baseUrl);
    return (
      url.protocol === "https:" ||
      (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))
    );
  } catch {
    return false;
  }
}

function getClient() {
  if (!isConfigured()) return null;

  return new HindsightClient({
    baseUrl: process.env.HINDSIGHT_BASE_URL!,
    apiKey: process.env.HINDSIGHT_API_KEY!,
    userAgent: "scar-production-immune-system/0.1.0",
  });
}

function signal() {
  return AbortSignal.timeout(HINDSIGHT_TIMEOUT_MS);
}

export async function createDemoBank(bankId: string) {
  const client = getClient();
  if (!client) return "demo-fallback" as const;

  await client.createBank(bankId, {
    name: "SCAR Production Safety Memory",
    reflectMission:
      "Protect production by learning causal lessons from incidents, failed fixes, rollbacks, and engineer corrections. Transfer lessons across services when the underlying failure mechanism is similar.",
    retainMission:
      "Extract root causes, incorrect diagnoses, successful resolutions, environmental blind spots, causal chains, and future deployment guardrails.",
    enableObservations: true,
    observationsMission:
      "Generalize reusable production safety lessons across services and deployments.",
    dispositionSkepticism: 5,
    dispositionLiteralism: 2,
    dispositionEmpathy: 1,
    signal: signal(),
  });

  return "hindsight-cloud" as const;
}

export async function recallRiskMemories(
  bankId: string,
  query: string,
): Promise<RecalledMemory[]> {
  const client = getClient();
  if (!client) return [];

  const response = await client.recall(bankId, query, {
    budget: "mid",
    includeEntities: true,
    includeChunks: true,
    maxTokens: 2200,
    signal: signal(),
  });

  return response.results.slice(0, 6).map((result, index) => ({
    id: truncate(result.id, 180),
    text: truncate(result.text, 1_200),
    type: result.type ?? "memory",
    context: truncate(result.context ?? "Hindsight recall", 240),
    entities: (result.entities ?? []).slice(0, 8).map((entity) => truncate(entity, 100)),
    relevance: Math.max(0.72, 0.98 - index * 0.05),
    mentionedAt: result.mentioned_at ?? undefined,
    documentId: result.document_id ?? undefined,
  }));
}

export async function retainIncident(
  bankId: string,
  incident: IncidentRecord = incidentRecord,
): Promise<RetainResult> {
  const client = getClient();
  if (!client) {
    const evidence = fallbackEvidenceFromIncident(incident);
    return {
      retained: true,
      memoryMode: "demo-fallback",
      itemsCount: evidence.length,
      generalizedLesson: evidence[1].text,
      evidence,
    };
  }

  const content = [
    `Incident ${incident.id}: ${incident.title}`,
    `Service: ${incident.service}`,
    `Incorrect diagnosis: ${incident.incorrectDiagnosis}`,
    `Root cause: ${incident.rootCause}`,
    `Resolution: ${incident.resolution}`,
    `Causal chain: ${incident.causalChain.join(" -> ")}`,
    `Future guardrails: ${incident.futureGuardrails.join("; ")}`,
  ].join("\n");

  const retainResponse = await client.retain(bankId, content, {
    context: "Engineer-confirmed production incident and corrective event",
    documentId: incident.id,
    tags: ["incident", "production-safety", "engineer-correction"],
    entities: [
      { text: incident.service, type: "service" },
      { text: incident.id, type: "incident" },
      { text: "root cause", type: "knowledge-type" },
      { text: "deployment guardrail", type: "knowledge-type" },
    ],
    async: false,
    signal: signal(),
  });

  const reflection = await client.reflect(
    bankId,
    `Generalize the reusable production safety lesson from ${incident.id} so it can prevent a similar failure in a different service.`,
    {
      budget: "mid",
      factTypes: ["world", "experience", "observation"],
      signal: signal(),
    },
  );

  const evidence = await recallRiskMemories(
    bankId,
    `What root cause, successful resolution, and guardrails were learned from ${incident.id}?`,
  );

  return {
    retained: retainResponse.success,
    memoryMode: "hindsight-cloud",
    itemsCount: retainResponse.items_count,
    generalizedLesson: truncate(reflection.text || generalizedLesson, 2_500),
    evidence,
  };
}

export function hindsightConfigured() {
  return isConfigured();
}

export function fallbackRetainResult(incident: IncidentRecord = incidentRecord): RetainResult {
  const evidence = fallbackEvidenceFromIncident(incident);
  return {
    retained: true,
    memoryMode: "demo-fallback",
    itemsCount: evidence.length,
    generalizedLesson: evidence[1].text,
    evidence,
  };
}
