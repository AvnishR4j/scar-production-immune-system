import { describe, expect, it } from "vitest";
import { fallbackEvidence, scenarios } from "@/lib/scenarios";
import { deterministicAnalysis, fallbackMemoriesForDemo } from "@/lib/risk-engine";

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
});
