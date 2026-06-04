# I Made Production Incidents Change Future Deployment Decisions

Most engineering teams already possess the knowledge required to prevent many of their recurring incidents. The problem is that the knowledge is trapped in postmortems, Slack threads, and the memories of engineers who may not review the next risky deployment.

I built SCAR to test a different model: what if an incident became part of an agent’s permanent judgment?

SCAR is a deployment-risk agent that learns causal lessons from production incidents. It does not simply search old postmortems for matching keywords. It recalls previous experiences, reflects on why failures happened, and applies those lessons when reviewing future changes.

## The Failure Pattern I Wanted to Capture

Consider a payment service that retries requests after an external provider returns an error. An engineer changes randomized exponential backoff to a fixed one-second interval, expecting faster recovery.

The tests pass. The code looks simple. A traditional review might approve it.

In production, the provider starts returning HTTP 429 responses. Thousands of requests retry simultaneously. That synchronized retry wave exhausts a shared database connection pool, and checkout becomes unavailable.

The team rolls back the change and writes a postmortem. The key lesson is not “be careful with the payment API.” It is broader:

> Aggressive deterministic retries against a constrained dependency can synchronize workers and exhaust downstream resources.

That lesson should matter when a different team later proposes fixed retries for a notification worker. Traditional search struggles because the service names, files, and symptoms are different. The causal mechanism is the same.

## Building an Agent That Learns the Mechanism

SCAR uses [Hindsight persistent agent memory](https://github.com/vectorize-io/hindsight) as its organizational memory layer. Hindsight provides three operations that map directly to the learning loop I needed:

- `retain` stores the incident and extracts facts, experiences, entities, and relationships.
- `reflect` generalizes the raw incident into a reusable production-safety lesson.
- `recall` retrieves that lesson when a future deployment has a causally similar risk.

When an engineer resolves an incident, SCAR retains more than the final fix:

```ts
await client.retain(bankId, content, {
  context: "Engineer-confirmed production incident and corrective event",
  documentId: "INC-104",
  tags: ["incident", "retry-policy", "production-safety"],
  entities: [
    { text: "payment-api", type: "service" },
    { text: "HTTP 429", type: "failure-signal" },
    { text: "fixed-interval retry", type: "failure-mechanism" },
    { text: "connection pool", type: "resource" },
  ],
});
```

The retained content includes the incorrect diagnosis, true root cause, successful resolution, environmental blind spot, and future guardrails. Preserving the incorrect diagnosis matters because it prevents the agent from repeating an attractive but ineffective response.

After retention, SCAR asks Hindsight to reflect:

```ts
const reflection = await client.reflect(
  bankId,
  "Generalize the reusable production safety lesson from INC-104 so it can prevent a similar failure in a different service.",
);
```

Reflection turns a service-specific incident into a mental model the agent can apply elsewhere.

## Proving That Memory Changes Behavior

The guided SCAR demo uses two deployment scenarios and a fresh isolated memory bank.

During the first analysis, the bank contains no relevant incidents. SCAR reports that automated checks pass and approves the payment retry-policy change. The controlled deployment simulator then shows the outage.

An engineer supplies the correction. Hindsight retains and reflects on it.

The second proposed deployment changes an unrelated notification worker:

```diff
- backoff: randomized(30, 90)
- concurrency: 50
+ backoff: fixed(2)
+ concurrency: 500
```

SCAR recalls the payment incident and blocks the deployment. Its explanation does not claim that notification delivery resembles checkout. Instead, it identifies the shared mechanism: a constrained dependency can throttle requests, fixed retries can synchronize 500 workers, and the resulting retry wave can exhaust shared resources.

The important behavior change is explicit:

- Before memory: approve because no known recurrence evidence exists.
- After memory: block because a previous incident proves the mechanism is dangerous.

This is the difference between a system that stores history and an agent that learns from it.

## Why I Added a Deterministic Safety Engine

An LLM can explain causal similarities well, but production policy should not depend entirely on unconstrained generation. SCAR therefore combines memory-backed reasoning with a deterministic safety state machine.

When Hindsight returns no evidence, SCAR cannot invent organizational history. When a known high-risk recurrence is supported by retained evidence, SCAR blocks the change and cites the memories that changed its decision.

The application also includes a deterministic fallback mode. If an external provider becomes unavailable during a demonstration, the four-step learning story still works and the interface clearly labels the fallback. This is useful for demonstrations, but the larger design principle applies in production: graceful degradation should remain visible rather than silently changing behavior.

## What I Learned

First, long-term memory is most compelling when it changes a consequential decision. Remembering a preference is useful; preventing a repeated outage is undeniable.

Second, storing only successful resolutions loses valuable information. Incorrect diagnoses and failed fixes teach the agent which tempting actions not to repeat.

Third, causal abstraction matters more than keyword similarity. The strongest memory systems help agents transfer lessons across superficially different situations.

Finally, memory-backed decisions must remain explainable. SCAR shows the recalled evidence, extracted entities, generalized lesson, and predicted causal chain. An engineer can inspect why the agent changed its recommendation.

## Every Incident Should Raise the Baseline

Postmortems are valuable, but a document cannot intervene when a risky deployment appears. An agent with persistent memory can.

SCAR is an early implementation of that idea: every failure, correction, and resolution becomes part of the organization’s future judgment. The result is not an agent that merely remembers what happened. It is an agent that becomes harder to fool with the same mistake twice.

For implementation details, explore the [Hindsight documentation](https://hindsight.vectorize.io/) and Vectorize’s explanation of [agent memory systems](https://vectorize.io/what-is-agent-memory).
