import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeWithGroq } from "@/lib/groq";
import { fallbackEvidence, scenarios } from "@/lib/scenarios";

function groqResponse(verdict: "APPROVE" | "BLOCK", citedMemoryIds: string[]) {
  return {
    ok: true,
    json: async () => ({
      choices: [{
        message: {
          content: JSON.stringify({
            verdict,
            riskScore: verdict === "BLOCK" ? 95 : 10,
            confidence: 90,
            headline: "Model verdict",
            explanation: "Model explanation",
            causalChain: ["Model causal step"],
            recommendations: ["Model recommendation"],
            citedMemoryIds,
          }),
        },
      }],
    }),
  };
}

describe("Groq evidence gate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GROQ_API_KEY;
  });

  it("does not let a model approve a causally verified recurrence", async () => {
    process.env.GROQ_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => groqResponse("APPROVE", [])));

    const analysis = await analyzeWithGroq(
      scenarios["notification-retry-recurrence"],
      fallbackEvidence,
    );

    expect(analysis.verdict).toBe("BLOCK");
    expect(analysis.decisionBasis).toBe("causal-evidence");
    expect(analysis.analysisMode).toBe("evidence-policy");
  });

  it("does not let a model block without recalled causal evidence", async () => {
    process.env.GROQ_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => groqResponse("BLOCK", ["invented-memory"])));

    const analysis = await analyzeWithGroq(
      scenarios["notification-retry-recurrence"],
      [],
    );

    expect(analysis.verdict).toBe("APPROVE");
    expect(analysis.citedMemoryIds).toHaveLength(0);
    expect(analysis.decisionBasis).toBe("empty-memory");
  });
});
