import { describe, expect, it } from "vitest";
import {
  fallbackEvidence,
  fallbackEvidenceFromIncident,
  incidentRecord,
  scenarios,
} from "@/lib/scenarios";
import {
  buildRiskPrompt,
  deterministicAnalysis,
  fallbackMemoriesForDemo,
} from "@/lib/risk-engine";

describe("SCAR deterministic risk engine", () => {
  it("approves the first change when organizational memory is empty", () => {
    const analysis = deterministicAnalysis(
      scenarios["payment-retry-incident"],
      fallbackMemoriesForDemo(false),
    );

    expect(analysis.verdict).toBe("APPROVE");
    expect(analysis.citedMemoryIds).toHaveLength(0);
    expect(analysis.riskScore).toBeLessThan(50);
  });

  it("blocks the unrelated recurrence after the incident is learned", () => {
    const analysis = deterministicAnalysis(
      scenarios["notification-retry-recurrence"],
      fallbackEvidence,
    );

    expect(analysis.verdict).toBe("BLOCK");
    expect(analysis.citedMemoryIds).toHaveLength(fallbackEvidence.length);
    expect(analysis.riskScore).toBeGreaterThan(90);
    expect(analysis.explanation).toContain("different service");
  });

  it("does not fabricate memories before the corrective event", () => {
    expect(fallbackMemoriesForDemo(false)).toEqual([]);
    expect(fallbackMemoriesForDemo(true)).toEqual(fallbackEvidence);
  });

  it("does not leak a bundled lesson into the cold-start model prompt", () => {
    const prompt = buildRiskPrompt(
      scenarios["notification-retry-recurrence"],
      [],
    );

    expect(prompt).toContain("RECALLED MEMORIES: []");
    expect(prompt).not.toContain("REFERENCE LESSON");
    expect(prompt).not.toContain(incidentRecord.rootCause);
  });

  it("does not block a deployment because of unrelated retained memory", () => {
    const unrelatedMemory = {
      ...fallbackEvidence[0],
      id: "memory-unrelated-css-incident",
      text: "A missing design token caused a low-contrast button in the settings page.",
      context: "Frontend accessibility correction",
      entities: ["settings-page", "design-token", "contrast"],
    };

    const analysis = deterministicAnalysis(
      scenarios["notification-retry-recurrence"],
      [unrelatedMemory],
    );

    expect(analysis.verdict).toBe("APPROVE");
    expect(analysis.citedMemoryIds).toHaveLength(0);
    expect(analysis.explanation).toContain("none share enough causal evidence");
  });

  it("ignores an unrelated judge-authored incident end to end", () => {
    const unrelatedIncident = {
      ...incidentRecord,
      id: "JUDGE-INC-NEGATIVE-CONTROL",
      rootCause: "A missing design token caused low contrast in a settings button.",
      resolution: "The team restored the design token and added a visual regression test.",
      futureGuardrails: ["Run visual regression tests before publishing interface changes"],
      causalChain: ["Design token missing", "Button contrast becomes too low"],
    };

    const analysis = deterministicAnalysis(
      scenarios["notification-retry-recurrence"],
      fallbackEvidenceFromIncident(unrelatedIncident),
    );

    expect(analysis.verdict).toBe("APPROVE");
    expect(analysis.citedMemoryIds).toHaveLength(0);
  });
});
