"use client";

import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleAlert,
  CloudCog,
  Code2,
  Database,
  GitPullRequest,
  LoaderCircle,
  MemoryStick,
  OctagonX,
  Play,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  TriangleAlert,
  Waypoints,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { incidentRecord, scenarios } from "@/lib/scenarios";
import type {
  ChangeScenario,
  DemoPhase,
  DemoSession,
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

type OutageResponse = {
  status: "OUTAGE";
  affectedUsers: string;
  checkoutSuccessRate: string;
  provider429Rate: string;
};

const phases: Array<{ id: DemoPhase; number: string; label: string; detail: string }> = [
  {
    id: "cold-start",
    number: "01",
    label: "Cold start",
    detail: "No relevant organizational memory",
  },
  {
    id: "outage",
    number: "02",
    label: "Corrective event",
    detail: "Engineer resolves the incident",
  },
  {
    id: "learning",
    number: "03",
    label: "Hindsight learns",
    detail: "Root cause becomes memory",
  },
  {
    id: "protected",
    number: "04",
    label: "Recurrence blocked",
    detail: "Lesson transfers across services",
  },
];

function phaseIndex(phase: DemoPhase) {
  return phases.findIndex((item) => item.id === phase);
}

function shortBankId(bankId: string) {
  return bankId ? `${bankId.slice(0, 17)}...${bankId.slice(-6)}` : "creating...";
}

export function ScarDashboard() {
  const [session, setSession] = useState<DemoSession | null>(null);
  const [phase, setPhase] = useState<DemoPhase>("cold-start");
  const [coldAnalysis, setColdAnalysis] = useState<AnalysisResponse | null>(null);
  const [protectedAnalysis, setProtectedAnalysis] = useState<AnalysisResponse | null>(null);
  const [outage, setOutage] = useState<OutageResponse | null>(null);
  const [retainResult, setRetainResult] = useState<RetainResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const startFreshDemo = useCallback(async () => {
    setBusy(true);
    setError("");
    setColdAnalysis(null);
    setProtectedAnalysis(null);
    setOutage(null);
    setRetainResult(null);
    setPhase("cold-start");

    try {
      const response = await fetch("/api/demo/start", { method: "POST" });
      if (!response.ok) throw new Error("Could not create a fresh demo memory bank.");
      setSession((await response.json()) as DemoSession);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start the demo.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/demo/start", { method: "POST" })
      .then((response) => {
        if (!response.ok) throw new Error("Could not create a fresh demo memory bank.");
        return response.json() as Promise<DemoSession>;
      })
      .then((demoSession) => {
        if (!cancelled) setSession(demoSession);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not start the demo.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function analyze(scenarioId: ChangeScenario["id"], memoryLearned: boolean) {
    if (!session) return;
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bankId: session.bankId,
        sessionToken: session.sessionToken,
        scenarioId,
        memoryLearned,
      }),
    });

    if (!response.ok) throw new Error("SCAR could not analyze this deployment.");
    return (await response.json()) as AnalysisResponse;
  }

  async function runPrimaryAction() {
    if (busy || !session) return;
    setBusy(true);
    setError("");

    try {
      if (!coldAnalysis) {
        setColdAnalysis(await analyze("payment-retry-incident", false) ?? null);
        return;
      }

      if (!outage) {
        const response = await fetch("/api/deploy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bankId: session.bankId,
            sessionToken: session.sessionToken,
            scenarioId: "payment-retry-incident",
          }),
        });
        if (!response.ok) throw new Error("The deployment simulation failed.");
        setOutage((await response.json()) as OutageResponse);
        setPhase("outage");
        return;
      }

      if (!retainResult) {
        const response = await fetch("/api/incident/retain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bankId: session.bankId,
            sessionToken: session.sessionToken,
          }),
        });
        if (!response.ok) throw new Error("Hindsight could not retain the incident.");
        setRetainResult((await response.json()) as RetainResult);
        setPhase("learning");
        return;
      }

      if (!protectedAnalysis) {
        setProtectedAnalysis(
          (await analyze("notification-retry-recurrence", true)) ?? null,
        );
        setPhase("protected");
        return;
      }

      await startFreshDemo();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The demo action failed.");
    } finally {
      setBusy(false);
    }
  }

  const currentScenario =
    retainResult || protectedAnalysis
      ? scenarios["notification-retry-recurrence"]
      : scenarios["payment-retry-incident"];
  const currentAnalysis = protectedAnalysis ?? (retainResult ? null : coldAnalysis);
  const memories = protectedAnalysis?.memories ?? retainResult?.evidence ?? coldAnalysis?.memories ?? [];
  const currentPhaseIndex = phaseIndex(phase);

  const action = useMemo(() => {
    if (!coldAnalysis) {
      return {
        label: "Analyze with empty memory",
        detail: "Step 1: prove the cold start",
        icon: <BrainCircuit size={18} />,
      };
    }
    if (!outage) {
      return {
        label: "Deploy approved change",
        detail: "Simulate the production consequence",
        icon: <Play size={18} />,
      };
    }
    if (!retainResult) {
      return {
        label: "Teach SCAR the resolution",
        detail: "Retain and reflect with Hindsight",
        icon: <MemoryStick size={18} />,
      };
    }
    if (!protectedAnalysis) {
      return {
        label: "Analyze unrelated deployment",
        detail: "Test whether the lesson transfers",
        icon: <ShieldCheck size={18} />,
      };
    }
    return {
      label: "Start fresh demo",
      detail: "Create another empty memory bank",
      icon: <RefreshCcw size={18} />,
    };
  }, [coldAnalysis, outage, protectedAnalysis, retainResult]);

  const integration = protectedAnalysis?.integration ?? coldAnalysis?.integration;
  const memoryMode =
    retainResult?.memoryMode ?? session?.memoryMode ?? "demo-fallback";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <ShieldCheck size={21} strokeWidth={2.4} />
          </div>
          <div>
            <div className="brand-name">SCAR</div>
            <div className="brand-subtitle">Production&apos;s immune system</div>
          </div>
        </div>

        <div className="topbar-center">
          <span className="live-dot" />
          JUDGE MODE
          <span className="slash">/</span>
          GUIDED MEMORY DEMO
        </div>

        <div className="integration-pills">
          <StatusPill
            active={memoryMode === "hindsight-cloud"}
            icon={<Database size={13} />}
            label={memoryMode === "hindsight-cloud" ? "Hindsight Cloud" : "Hindsight demo mode"}
          />
          <StatusPill
            active={integration?.groq === "connected"}
            icon={<Zap size={13} />}
            label={integration?.groq === "connected" ? "Groq reasoning" : "Deterministic reasoning"}
          />
        </div>
      </header>

      <section className="hero-strip">
        <div>
          <p className="kicker">Incident memory that changes future decisions</p>
          <h1>Every outage should make production <span>harder to break.</span></h1>
        </div>
        <div className="session-card">
          <div className="session-label">
            <span>ISOLATED MEMORY BANK</span>
            <span className={memoryMode === "hindsight-cloud" ? "connected" : "fallback"}>
              {memoryMode === "hindsight-cloud" ? "LIVE" : "DEMO"}
            </span>
          </div>
          <code>{shortBankId(session?.bankId ?? "")}</code>
          <button onClick={startFreshDemo} disabled={busy}>
            <RefreshCcw size={14} /> Reset memory
          </button>
        </div>
      </section>

      <section className="phase-rail" aria-label="Four-step Hindsight demo">
        {phases.map((item, index) => {
          const complete = index < currentPhaseIndex || phase === "protected";
          const active = index === currentPhaseIndex;
          return (
            <div className={`phase ${active ? "active" : ""} ${complete ? "complete" : ""}`} key={item.id}>
              <div className="phase-number">
                {complete ? <Check size={15} /> : item.number}
              </div>
              <div>
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </div>
              {index < phases.length - 1 ? <ChevronRight className="phase-arrow" size={16} /> : null}
            </div>
          );
        })}
      </section>

      {error ? (
        <div className="error-banner" role="alert">
          <TriangleAlert size={17} />
          {error}
        </div>
      ) : null}

      <section className="metric-grid">
        <MetricCard
          label="Production status"
          value={outage && !protectedAnalysis ? "Degraded" : "Healthy"}
          detail={outage && !protectedAnalysis ? "Checkout outage active" : "All systems operational"}
          tone={outage && !protectedAnalysis ? "danger" : "success"}
          icon={<Activity size={18} />}
        />
        <MetricCard
          label="Organizational memory"
          value={`${memories.length} ${memories.length === 1 ? "memory" : "memories"}`}
          detail={memories.length ? "Relevant incident knowledge found" : "No relevant incident history"}
          tone={memories.length ? "memory" : "neutral"}
          icon={<BrainCircuit size={18} />}
        />
        <MetricCard
          label="Current verdict"
          value={currentAnalysis?.analysis.verdict ?? "Not analyzed"}
          detail={currentAnalysis ? `${currentAnalysis.analysis.riskScore}% recurrence risk` : "Awaiting SCAR analysis"}
          tone={
            currentAnalysis?.analysis.verdict === "BLOCK"
              ? "danger"
              : currentAnalysis?.analysis.verdict === "APPROVE"
                ? "success"
                : "neutral"
          }
          icon={currentAnalysis?.analysis.verdict === "BLOCK" ? <OctagonX size={18} /> : <ShieldCheck size={18} />}
        />
        <MetricCard
          label="Services protected"
          value={protectedAnalysis ? "2 services" : "0 services"}
          detail={protectedAnalysis ? "Lesson transferred across domains" : "Learning loop not complete"}
          tone={protectedAnalysis ? "memory" : "neutral"}
          icon={<Waypoints size={18} />}
        />
      </section>

      <section className="workspace-grid">
        <div className="panel change-panel">
          <PanelHeader
            eyebrow={`Proposed deployment / ${currentScenario.pullRequest}`}
            title={currentScenario.title}
            icon={<GitPullRequest size={18} />}
            badge={currentScenario.service}
          />
          <div className="change-meta">
            <div>
              <span>Author</span>
              <strong>{currentScenario.author}</strong>
            </div>
            <div>
              <span>Checks</span>
              <strong className="checks-pass"><Check size={13} /> 18 passed</strong>
            </div>
            <div>
              <span>Files</span>
              <strong>{currentScenario.files.length} changed</strong>
            </div>
          </div>
          <p className="change-description">{currentScenario.description}</p>
          <div className="code-window">
            <div className="code-titlebar">
              <div><span /><span /><span /></div>
              <code>{currentScenario.files[0]}</code>
              <Code2 size={14} />
            </div>
            <div className="diff">
              {currentScenario.diff.map((line, index) => (
                <div className={`diff-line ${line.kind}`} key={`${line.content}-${index}`}>
                  <span>{index + 18}</span>
                  <code>{line.kind === "add" ? "+" : line.kind === "remove" ? "-" : " "}{line.content}</code>
                </div>
              ))}
            </div>
          </div>

          <div className="action-zone">
            <button className="primary-action" onClick={runPrimaryAction} disabled={busy || !session}>
              <span className="action-icon">
                {busy ? <LoaderCircle className="spin" size={18} /> : action.icon}
              </span>
              <span>
                <strong>{busy ? "SCAR is working..." : action.label}</strong>
                <small>{action.detail}</small>
              </span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>

        <div className="panel verdict-panel">
          <PanelHeader
            eyebrow="SCAR risk intelligence"
            title={currentAnalysis?.analysis.headline ?? "Awaiting deployment analysis"}
            icon={<ShieldCheck size={18} />}
            badge={currentAnalysis?.analysis.analysisMode ?? "ready"}
          />

          {!currentAnalysis ? (
            <EmptyVerdict />
          ) : (
            <>
              <div className={`verdict-hero ${currentAnalysis.analysis.verdict.toLowerCase()}`}>
                <div className="verdict-icon">
                  {currentAnalysis.analysis.verdict === "BLOCK" ? <OctagonX size={25} /> : <ShieldCheck size={25} />}
                </div>
                <div>
                  <span>DEPLOYMENT VERDICT</span>
                  <strong>{currentAnalysis.analysis.verdict}</strong>
                </div>
                <div className="risk-ring">
                  <strong>{currentAnalysis.analysis.riskScore}%</strong>
                  <span>risk</span>
                </div>
              </div>
              <p className="analysis-copy">{currentAnalysis.analysis.explanation}</p>
              <div className="section-label"><Waypoints size={14} /> Predicted causal chain</div>
              <div className="causal-chain">
                {currentAnalysis.analysis.causalChain.map((step, index) => (
                  <div key={step}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <p>{step}</p>
                    {index < currentAnalysis.analysis.causalChain.length - 1 ? <ArrowRight size={13} /> : null}
                  </div>
                ))}
              </div>
              <div className="section-label"><ShieldCheck size={14} /> Recommended safeguards</div>
              <ul className="recommendations">
                {currentAnalysis.analysis.recommendations.map((recommendation) => (
                  <li key={recommendation}><Check size={14} /> {recommendation}</li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="panel memory-panel">
          <PanelHeader
            eyebrow="Hindsight memory inspector"
            title={memories.length ? "Relevant experience recalled" : "Memory bank is empty"}
            icon={<BrainCircuit size={18} />}
            badge={`${memories.length} found`}
          />
          <div className="memory-pipeline">
            <PipelineNode label="RETAIN" active={Boolean(retainResult)} icon={<Database size={14} />} />
            <ChevronRight size={14} />
            <PipelineNode label="REFLECT" active={Boolean(retainResult)} icon={<Sparkles size={14} />} />
            <ChevronRight size={14} />
            <PipelineNode label="RECALL" active={Boolean(protectedAnalysis)} icon={<BrainCircuit size={14} />} />
          </div>

          {outage && !retainResult ? <CorrectionCard /> : null}

          {retainResult ? (
            <div className="lesson-card">
              <div><Sparkles size={15} /> GENERALIZED MENTAL MODEL</div>
              <p>{retainResult.generalizedLesson}</p>
            </div>
          ) : null}

          <div className="memory-list">
            {memories.length ? (
              memories.map((memory, index) => (
                <article className="memory-item" key={`${memory.id}-${index}`}>
                  <div className="memory-item-top">
                    <span className={`memory-type ${memory.type}`}>{memory.type}</span>
                    <strong>{Math.round(memory.relevance * 100)}% relevance</strong>
                  </div>
                  <p>{memory.text}</p>
                  <div className="entity-list">
                    {memory.entities.slice(0, 4).map((entity) => <span key={entity}>{entity}</span>)}
                  </div>
                  <code>{memory.id}</code>
                </article>
              ))
            ) : (
              <div className="empty-memory">
                <div><MemoryStick size={27} /></div>
                <strong>No relevant production experience</strong>
                <p>SCAR cannot apply lessons the organization has not retained.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {outage && !retainResult ? <OutageStrip outage={outage} /> : null}

      <footer>
        <div>
          <TerminalSquare size={15} />
          SCAR learns causal lessons, not just keywords.
        </div>
        <div>
          Powered by <strong>Hindsight persistent memory</strong>
        </div>
      </footer>
    </main>
  );
}

function StatusPill({ active, icon, label }: { active: boolean; icon: React.ReactNode; label: string }) {
  return <div className={`status-pill ${active ? "active" : ""}`}>{icon}<span>{label}</span></div>;
}

function MetricCard({
  label,
  value,
  detail,
  tone,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  tone: string;
  icon: React.ReactNode;
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <div className="metric-icon">{icon}</div>
      <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
    </article>
  );
}

function PanelHeader({
  eyebrow,
  title,
  icon,
  badge,
}: {
  eyebrow: string;
  title: string;
  icon: React.ReactNode;
  badge: string;
}) {
  return (
    <div className="panel-header">
      <div className="panel-heading-icon">{icon}</div>
      <div><span>{eyebrow}</span><h2>{title}</h2></div>
      <code>{badge}</code>
    </div>
  );
}

function PipelineNode({ label, active, icon }: { label: string; active: boolean; icon: React.ReactNode }) {
  return <div className={`pipeline-node ${active ? "active" : ""}`}>{icon}<span>{label}</span></div>;
}

function EmptyVerdict() {
  return (
    <div className="empty-verdict">
      <div className="radar">
        <span /><span /><span />
        <ShieldCheck size={30} />
      </div>
      <strong>Ready to inspect deployment risk</strong>
      <p>SCAR will compare the proposed change against every retained production lesson.</p>
    </div>
  );
}

function CorrectionCard() {
  return (
    <article className="correction-card">
      <div><CircleAlert size={15} /> ENGINEER CORRECTION READY</div>
      <strong>{incidentRecord.id}: {incidentRecord.title}</strong>
      <p>{incidentRecord.rootCause}</p>
    </article>
  );
}

function OutageStrip({ outage }: { outage: OutageResponse }) {
  return (
    <section className="outage-strip">
      <div className="outage-title">
        <TriangleAlert size={22} />
        <div><span>SIMULATED PRODUCTION INCIDENT</span><strong>INC-104 / Checkout unavailable</strong></div>
      </div>
      <div><span>Affected users</span><strong>{outage.affectedUsers}</strong></div>
      <div><span>Checkout success</span><strong>{outage.checkoutSuccessRate}</strong></div>
      <div><span>Provider 429 rate</span><strong>{outage.provider429Rate}</strong></div>
      <div className="outage-chain"><CloudCog size={16} /> Provider 429 <ArrowRight size={13} /> Retry wave <ArrowRight size={13} /> Pool exhausted</div>
    </section>
  );
}
