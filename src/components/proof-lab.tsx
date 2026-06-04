"use client";

import {
  ArrowRight,
  BrainCircuit,
  Check,
  Database,
  FlaskConical,
  LoaderCircle,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import { incidentRecord, scenarios } from "@/lib/scenarios";
import type {
  ChangeScenario,
  DemoSession,
  IncidentRecord,
  IntegrationStatus,
  RecalledMemory,
  RetainResult,
  RiskAnalysis,
} from "@/lib/types";

type AnalysisResponse = {
  scenario: ChangeScenario;
  analysis: RiskAnalysis;
  memories: RecalledMemory[];
  integration: IntegrationStatus;
};

const initialChallenge = scenarios["notification-retry-recurrence"];

function fingerprint(value: unknown) {
  const input = JSON.stringify(value);
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `SCAR-${(hash >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

export function ProofLab() {
  const [session, setSession] = useState<DemoSession | null>(null);
  const [service, setService] = useState("report-worker");
  const [changeTitle, setChangeTitle] = useState("Drain reporting backlog faster");
  const [changeDescription, setChangeDescription] = useState(
    "Replace randomized backoff with fixed one-second retries and increase concurrency from 20 to 800.",
  );
  const [diff, setDiff] = useState(
    "- backoff: randomized(20, 90)\n- concurrency: 20\n+ backoff: fixed(1)\n+ concurrency: 800",
  );
  const [rootCause, setRootCause] = useState(incidentRecord.rootCause);
  const [resolution, setResolution] = useState(incidentRecord.resolution);
  const [before, setBefore] = useState<AnalysisResponse | null>(null);
  const [retained, setRetained] = useState<RetainResult | null>(null);
  const [after, setAfter] = useState<AnalysisResponse | null>(null);
  const [busy, setBusy] = useState<"start" | "before" | "retain" | "after" | "">("");
  const [error, setError] = useState("");

  const challenge = useMemo<ChangeScenario>(() => {
    const diffLines = diff
      .split("\n")
      .filter(Boolean)
      .slice(0, 20)
      .map((line) => ({
        kind: line.startsWith("+") ? "add" as const : line.startsWith("-") ? "remove" as const : "context" as const,
        content: line.replace(/^[+-]\s?/, ""),
      }));

    return {
      ...initialChallenge,
      id: `judge-challenge-${service.toLowerCase().replace(/[^a-z0-9-]/g, "-") || "service"}`,
      service,
      title: changeTitle,
      description: changeDescription,
      files: [`services/${service || "unknown"}/deployment-policy.ts`],
      diff: diffLines.length ? diffLines : initialChallenge.diff,
      riskQuery: `Does this proposed ${service} deployment recreate any failure mechanism learned from a previous incident? Proposed change: ${changeDescription}`,
    };
  }, [changeDescription, changeTitle, diff, service]);

  const correction = useMemo<IncidentRecord>(() => ({
    id: "JUDGE-INC-001",
    title: "Judge-authored production incident lesson",
    service: "judge-provided-incident",
    incorrectDiagnosis: "The initial diagnosis was replaced by the judge-authored root cause.",
    rootCause,
    resolution,
    futureGuardrails: [resolution.slice(0, 240)],
    causalChain: [rootCause.slice(0, 240)],
  }), [resolution, rootCause]);

  const challengeFingerprint = useMemo(() => fingerprint(challenge), [challenge]);
  const challengeLocked = Boolean(before);
  const correctionLocked = Boolean(retained);
  const fallbackObserved =
    session?.memoryMode === "demo-fallback" ||
    before?.integration.hindsight === "demo-fallback" ||
    retained?.memoryMode === "demo-fallback" ||
    after?.integration.hindsight === "demo-fallback";
  const proofMode = fallbackObserved
    ? "simulated-fallback"
    : after && retained && before
      ? "verified-hindsight"
      : "verification-pending";
  const verdictChanged = before?.analysis.verdict === "APPROVE" && after?.analysis.verdict === "BLOCK";
  const falsePositiveRejected =
    before?.analysis.verdict === "APPROVE" &&
    after?.analysis.verdict === "APPROVE" &&
    Boolean(after.memories.length);
  const proofOutcomeConfirmed = verdictChanged || falsePositiveRejected;
  const evidence = after?.memories ?? retained?.evidence ?? [];

  async function startProof() {
    setBusy("start");
    setError("");
    setBefore(null);
    setRetained(null);
    setAfter(null);

    try {
      const response = await fetch("/api/demo/start", { method: "POST" });
      if (!response.ok) throw new Error("Could not create an isolated proof memory bank.");
      const nextSession = (await response.json()) as DemoSession;
      setSession(nextSession);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start proof lab.");
    } finally {
      setBusy("");
    }
  }

  async function analyze(memoryLearned: boolean) {
    if (!session) throw new Error("Start an isolated proof bank first.");

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bankId: session.bankId,
        sessionToken: session.sessionToken,
        customScenario: challenge,
        memoryLearned,
        fallbackIncident: memoryLearned ? correction : undefined,
      }),
    });
    if (!response.ok) throw new Error("SCAR could not analyze the judge challenge.");
    return (await response.json()) as AnalysisResponse;
  }

  async function runBefore() {
    setBusy("before");
    setError("");
    try {
      setBefore(await analyze(false));
      setRetained(null);
      setAfter(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cold-start analysis failed.");
    } finally {
      setBusy("");
    }
  }

  async function teachCorrection() {
    if (!session || !before) return;
    setBusy("retain");
    setError("");
    try {
      const response = await fetch("/api/incident/retain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankId: session.bankId,
          sessionToken: session.sessionToken,
          incident: correction,
        }),
      });
      if (!response.ok) throw new Error("Could not retain the engineer-authored correction.");
      setRetained((await response.json()) as RetainResult);
      setAfter(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Retain operation failed.");
    } finally {
      setBusy("");
    }
  }

  async function runAfter() {
    setBusy("after");
    setError("");
    try {
      setAfter(await analyze(true));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Post-memory analysis failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="proof-lab">
      <div className="proof-lab-header">
        <div className="proof-title">
          <div><FlaskConical size={20} /></div>
          <div>
            <span>INTERACTIVE JUDGE CHALLENGE</span>
            <h2>Prove learning on the exact same unseen deployment</h2>
            <p>Edit the change and correction. SCAR must change its verdict only after memory exists.</p>
          </div>
        </div>
        <div className={`proof-mode ${proofMode}`}>
          {proofMode === "verified-hindsight" ? <ShieldCheck size={16} /> : proofMode === "verification-pending" ? <LoaderCircle size={16} /> : <TriangleAlert size={16} />}
          <div>
            <span>{proofMode === "verified-hindsight" ? "VERIFIED MEMORY" : proofMode === "verification-pending" ? "VERIFICATION PENDING" : "SIMULATION MODE"}</span>
            <strong>{proofMode === "verified-hindsight" ? "All Hindsight operations passed" : proofMode === "verification-pending" ? "Run all proof steps" : "Add Hindsight credentials for proof"}</strong>
          </div>
        </div>
      </div>

      {proofMode === "simulated-fallback" ? (
        <div className="proof-warning">
          <TriangleAlert size={16} />
          This mode demonstrates the behavior but is not proof of persistent learning. Connect Hindsight Cloud before judging.
        </div>
      ) : null}

      {error ? <div className="error-banner"><TriangleAlert size={16} />{error}</div> : null}

      <div className="proof-input-grid">
        <article className="proof-input-card">
          <div className="proof-card-label"><BrainCircuit size={14} /> UNSEEN DEPLOYMENT CHALLENGE</div>
          <label>Service<input value={service} onChange={(event) => setService(event.target.value)} maxLength={100} disabled={challengeLocked} /></label>
          <label>Change title<input value={changeTitle} onChange={(event) => setChangeTitle(event.target.value)} maxLength={160} disabled={challengeLocked} /></label>
          <label>Proposed behavior<textarea value={changeDescription} onChange={(event) => setChangeDescription(event.target.value)} maxLength={1500} rows={3} disabled={challengeLocked} /></label>
          <label>Diff<textarea className="mono-input" value={diff} onChange={(event) => setDiff(event.target.value)} maxLength={3000} rows={5} disabled={challengeLocked} /></label>
          <div className="proof-fingerprint"><span>LOCKED INPUT FINGERPRINT</span><code>{challengeFingerprint}</code></div>
        </article>

        <article className="proof-input-card">
          <div className="proof-card-label"><Database size={14} /> ENGINEER-AUTHORED INCIDENT LESSON</div>
          <label>Root cause<textarea value={rootCause} onChange={(event) => setRootCause(event.target.value)} maxLength={1500} rows={5} disabled={correctionLocked} /></label>
          <label>Successful resolution<textarea value={resolution} onChange={(event) => setResolution(event.target.value)} maxLength={1500} rows={5} disabled={correctionLocked} /></label>
          <div className="proof-bank">
            <span>PROOF BANK</span>
            <code>{session?.bankId ?? "Not created"}</code>
            <button onClick={startProof} disabled={Boolean(busy)}>
              {busy === "start" ? <LoaderCircle className="spin" size={14} /> : <RefreshCcw size={14} />}
              {session ? "New empty proof bank" : "Start proof bank"}
            </button>
          </div>
        </article>
      </div>

      <div className="proof-actions">
        <ProofAction
          number="01"
          label="Analyze before memory"
          detail="Must return zero evidence"
          disabled={!session || Boolean(busy)}
          busy={busy === "before"}
          onClick={runBefore}
        />
        <ArrowRight size={16} />
        <ProofAction
          number="02"
          label="Retain my correction"
          detail="Stores judge-authored lesson"
          disabled={!before || Boolean(busy)}
          busy={busy === "retain"}
          onClick={teachCorrection}
        />
        <ArrowRight size={16} />
        <ProofAction
          number="03"
          label="Re-analyze same change"
          detail="Must cite retained evidence"
          disabled={!retained || Boolean(busy)}
          busy={busy === "after"}
          onClick={runAfter}
        />
      </div>

      <div className="proof-results">
        <ProofVerdict title="Before memory" analysis={before?.analysis} evidenceCount={before?.memories.length ?? 0} />
        <div className={`proof-delta ${proofOutcomeConfirmed ? "changed" : ""}`}>
          {proofOutcomeConfirmed ? <Check size={20} /> : <ArrowRight size={20} />}
          <strong>{verdictChanged ? "Decision changed because relevant memory exists" : falsePositiveRejected ? "Unrelated memory correctly ignored" : "Run all three proof steps"}</strong>
          <span>{verdictChanged ? `${before?.analysis.verdict} → ${after?.analysis.verdict}` : falsePositiveRejected ? "No false-positive block without causal evidence" : "Compare identical input before and after retention"}</span>
          <code>{challengeFingerprint}</code>
        </div>
        <ProofVerdict title="After memory" analysis={after?.analysis} evidenceCount={after?.memories.length ?? 0} />
      </div>

      <div className="proof-evidence">
        <div className="proof-card-label"><Sparkles size={14} /> RAW RECALL EVIDENCE</div>
        {evidence.length ? (
          <div className="proof-evidence-grid">
            {evidence.map((memory, index) => (
              <article key={memory.id}>
                <div><span>{memory.type}</span><strong>recall #{index + 1}</strong></div>
                <p>{memory.text}</p>
                <code>{memory.id}</code>
                <small>{memory.documentId ?? "no document id"} · {memory.mentionedAt ?? "timestamp pending"}</small>
              </article>
            ))}
          </div>
        ) : (
          <p className="proof-empty">No memory has been retained or recalled yet.</p>
        )}
      </div>
    </section>
  );
}

function ProofAction({
  number,
  label,
  detail,
  disabled,
  busy,
  onClick,
}: {
  number: string;
  label: string;
  detail: string;
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} disabled={disabled}>
      <span>{busy ? <LoaderCircle className="spin" size={15} /> : number}</span>
      <div><strong>{label}</strong><small>{detail}</small></div>
    </button>
  );
}

function ProofVerdict({
  title,
  analysis,
  evidenceCount,
}: {
  title: string;
  analysis?: RiskAnalysis;
  evidenceCount: number;
}) {
  return (
    <article className={`proof-verdict ${analysis?.verdict.toLowerCase() ?? ""}`}>
      <span>{title}</span>
      <strong>{analysis?.verdict ?? "NOT RUN"}</strong>
      <small>{analysis ? `${analysis.riskScore}% risk · ${evidenceCount} memories cited` : "Awaiting analysis"}</small>
    </article>
  );
}
