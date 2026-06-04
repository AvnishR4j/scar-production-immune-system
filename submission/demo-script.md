# SCAR Demo Script

## Target Length: 3 Minutes

### 0:00–0:25 — The Problem

**On screen:** SCAR dashboard, fresh isolated memory bank, zero memories.

“Production teams rarely fail because nobody ever discovered the answer. They fail because the lesson from the last incident is buried when the next risky change arrives. SCAR turns every incident into active deployment judgment.”

### 0:25–0:55 — Cold Start

**On screen:** Payment API retry-policy diff.

“This payment change replaces randomized backoff with fast fixed retries. All automated checks pass. Because SCAR has no relevant organizational memory, it approves the change.”

Click **Analyze with empty memory** and point to:

- `0 memories`
- `APPROVE`
- `No known recurrence risk`

### 0:55–1:20 — Corrective Event

Click **Deploy approved change**.

“The payment provider starts rate limiting. Fixed retries synchronize thousands of requests, exhaust the shared connection pool, and take checkout offline.”

Point to the outage metrics and causal chain.

### 1:20–2:00 — Hindsight Learns

Click **Teach SCAR the resolution**.

“The engineer corrects SCAR’s understanding. The problem was not database capacity. The true cause was deterministic retries. SCAR sends the incident to Hindsight, which extracts the experience, entities, relationships, and a generalized mental model.”

Point to:

- Retain, reflect, and recall pipeline
- Generalized mental model
- Extracted incident memories and entities

### 2:00–2:40 — The Magic Moment

Click **Analyze unrelated deployment**.

“Now a notification worker proposes fixed retries and much higher concurrency. It is a different service, different code, and different dependency. SCAR recalls the payment incident because the causal mechanism is the same.”

Point to:

- `BLOCK`
- `94% recurrence risk`
- Recalled INC-104 evidence
- Recommended safeguards

### 2:40–3:00 — Close

“SCAR did not merely retrieve a postmortem. It learned why production failed and transferred that lesson to a new situation. With Hindsight, every outage makes the organization harder to break.”
