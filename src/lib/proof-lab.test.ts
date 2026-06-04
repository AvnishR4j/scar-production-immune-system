import { describe, expect, it } from "vitest";
import { analyzeSchema, retainIncidentSchema } from "@/lib/api";
import { fallbackEvidenceFromIncident, incidentRecord, scenarios } from "@/lib/scenarios";

const session = {
  bankId: "scar-demo-proof-bank",
  sessionToken: "x".repeat(40),
};

describe("SCAR interactive proof lab", () => {
  it("accepts a judge-authored deployment challenge", () => {
    const result = analyzeSchema.safeParse({
      ...session,
      customScenario: {
        ...scenarios["notification-retry-recurrence"],
        id: "judge-challenge-report-worker",
        service: "report-worker",
      },
      memoryLearned: false,
    });

    expect(result.success).toBe(true);
  });

  it("requires a scenario for every analysis", () => {
    const result = analyzeSchema.safeParse({
      ...session,
      memoryLearned: false,
    });

    expect(result.success).toBe(false);
  });

  it("retains and exposes the judge-authored correction as evidence", () => {
    const customIncident = {
      ...incidentRecord,
      id: "JUDGE-INC-001",
      rootCause: "A judge-authored root cause that was not bundled with the app.",
      resolution: "A judge-authored resolution that fixed the incident.",
    };

    expect(retainIncidentSchema.safeParse({ ...session, incident: customIncident }).success).toBe(true);

    const evidence = fallbackEvidenceFromIncident(customIncident);
    expect(evidence).toHaveLength(2);
    expect(evidence[0].text).toBe(customIncident.rootCause);
    expect(evidence[0].documentId).toBe(customIncident.id);
    expect(evidence[1].text).toContain(customIncident.resolution);
  });
});
