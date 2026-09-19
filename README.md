# 🕵️ BlackBox

> **When production breaks, find out why.**

BlackBox is an AI-powered incident investigation platform that helps engineers understand **what happened, when it happened, and why it happened** during production incidents.

Instead of manually jumping between GitHub, Sentry, logs, deployments, and monitoring tools, BlackBox brings the available evidence together, reconstructs the incident timeline, correlates related events, and produces an evidence-backed investigation.

**🔗 Live Demo:** [https://blackboxai-8z7m.onrender.com/](https://blackboxai-8z7m.onrender.com/)

---

## Table of Contents

- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [Why BlackBox?](#why-blackbox)
- [What BlackBox Produces](#what-blackbox-produces)
- [Innovation & Uniqueness](#innovation--uniqueness)
- [Evidence Sources](#evidence-sources)
- [Architecture](#architecture)
- [Core Design Decisions](#core-design-decisions)
- [User Flow](#user-flow)
- [Technology Stack](#technology-stack)
- [Reliability Philosophy](#reliability-philosophy)
- [Example Investigation](#example-investigation)
- [What Makes BlackBox Different?](#what-makes-blackbox-different)
- [Running Locally](#running-locally)
- [Environment Variables](#environment-variables)
- [Future Scope](#future-scope)
- [Project Philosophy](#project-philosophy)

---

## The Problem

When a production system breaks, the difficult part is usually not finding the error — it's figuring out **how all the different signals are connected.**

A typical incident might involve:

| Source | Signal |
|---|---|
| **GitHub** | A deployment / code change |
| **Sentry** | A sudden increase in exceptions |
| **Application Logs** | Database connection errors |
| **Monitoring** | Latency and error rate spikes |
| **Third-party services** | A possible external outage |

Each of these signals may exist independently. An engineer is then left to manually answer questions like:

- What happened first?
- Did the incident start after a deployment?
- Which errors are actually related?
- Which code change could have caused the failure?
- Is the database the cause, or merely a symptom?
- What evidence supports the suspected root cause — and what contradicts it?
- What information is still missing?

This investigation can take significant time, especially in a large system with an incident actively unfolding.

**The real problem:** production incidents aren't just a monitoring problem — they're a **correlation and reasoning problem.** The evidence is scattered across different systems, formats, and timelines. BlackBox is designed to solve that.

---

## The Solution

BlackBox turns fragmented production signals into a structured investigation:

```
Data Sources → Normalize Evidence → Build Timeline → Correlate Events
     → Build Evidence Graph → AI Investigation → Evidence-backed Explanation
```

It collects available evidence from different sources, converts it into a common format, analyzes relationships between events, builds a timeline, and lets an AI investigator examine the structured evidence to produce a human-readable report.

The goal is **not** this:

> "The database probably failed."

The goal is this:

> "The database connection pool became exhausted shortly after deployment X. The first related application errors appeared at this point, followed by increasing request failures. Evidence E12 and E19 support this hypothesis, while no contradictory evidence was found in the available logs."

---

## Why BlackBox?

Traditional observability tools are excellent at showing individual signals. BlackBox focuses on the step that comes **after** observing those signals: connecting them together.

An engineer shouldn't have to manually switch between five different systems just to reconstruct one incident. BlackBox provides a unified investigation workflow:

```
Collect → Understand → Correlate → Investigate → Challenge → Explain
```

This makes the investigation process faster, more structured, and easier to audit.

---

## What BlackBox Produces

### 1. Incident Timeline

A chronological view of relevant events:

```
10:02:11  Deployment started
10:03:42  Deployment completed
10:04:08  Database connection errors begin
10:04:51  API latency increases
10:05:17  Error rate spikes
10:06:02  Service becomes partially unavailable
```

### 2. Evidence Graph

BlackBox represents relationships between events as an evidence graph:

```
Deployment → Configuration Change → Database Connections
  → Connection Pool Exhaustion → API Errors → Service Degradation
```

Instead of looking at isolated events, engineers can see how the incident *developed*.

### 3. Root-Cause Hypotheses

The investigator generates structured hypotheses, each containing:

- Suspected cause
- Supporting evidence
- Contradictory evidence
- Confidence score
- Affected components
- Timeline relationships
- Missing information

### 4. Evidence References

BlackBox doesn't let the AI make a plausible-sounding statement without backing it up — every investigation references the underlying evidence:

```
Hypothesis: Database connection pool exhaustion

Supporting Evidence:
  - E17: Connection timeout spike
  - E21: Pool utilization reached maximum
  - E24: API failures increased immediately afterward

Contradictory Evidence:
  - No corresponding database CPU spike

Missing Evidence:
  - Detailed connection pool metrics
```

This makes the reasoning easy to inspect and trust.

---

## Innovation & Uniqueness

BlackBox is **not** simply an LLM placed on top of logs. The core idea is combining deterministic incident analysis with AI reasoning.

### 1. Evidence-Backed AI

The AI investigator receives structured evidence rather than an unorganized stream of logs, so its conclusions stay tied to specific evidence events — reducing the risk of convincing-sounding explanations with no real connection to the incident data.

### 2. Challenge Conclusion

An investigation shouldn't stop at the first plausible explanation. BlackBox actively challenges its own hypothesis:

```
Initial Hypothesis
   → Search for Supporting Evidence
   → Search for Contradictory Evidence
   → Identify Missing Evidence
   → Re-evaluate
   → Updated Investigation
```

This makes the AI behave more like an investigator than a summarizer.

### 3. Deterministic + AI Reasoning

The pipeline performs deterministic processing first — normalization, timeline construction, correlation, evidence graph — and only *then* hands things off to the AI for higher-level reasoning and explanation. If the AI layer fails, the underlying incident analysis still works.

### 4. Missing Evidence Awareness

A major failure mode of AI systems is filling gaps with assumptions. BlackBox explicitly tracks missing information instead of pretending an unavailable metric exists:

```
Database CPU: Unknown
→ "Database CPU metrics were not available. This hypothesis cannot be fully confirmed."
```

### 5. Graceful Fallbacks

The pipeline supports multiple evidence paths so a missing integration never fully breaks the product:

```
Live Connectors → Deterministic Investigation → Precomputed Demo Evidence
```

The product keeps working even if GitHub is unavailable, Sentry is unavailable, an API key is missing, an external API times out, or the LLM request fails.

---

## Evidence Sources

| Source | Evidence Types |
|---|---|
| **GitHub** | Commits, pull requests, deployments, code changes, timestamps, authors |
| **Sentry** | Exceptions, stack traces, error frequency, affected services, timestamps |
| **Logs** | Errors, warnings, request failures, database failures, service events |
| **Uploaded Data** | Structured evidence supplied as files, for use when live integrations are unavailable |

**Demo Incidents** included for showcasing the workflow: database connection pool exhaustion, memory leak after deployment, and third-party API outage.

---

## Architecture

```
                    ┌──────────────────────┐
                    │     BlackBox UI      │
                    │   React + Vite       │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │     Express API       │
                    │       Node.js         │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                 │
              ▼                ▼                 ▼
         ┌─────────┐      ┌─────────┐      ┌─────────┐
         │ GitHub  │      │ Sentry  │      │  Logs   │
         └────┬────┘      └────┬────┘      └────┬────┘
              │                │                 │
              └────────────────┼─────────────────┘
                               ▼
                    ┌──────────────────────┐
                    │  Evidence Normalizer  │
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │  Event Correlation    │
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │   Evidence Graph      │
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │   AI Investigator     │
                    │       Gemini          │
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │     Investigation     │
                    │  Timeline + Findings  │
                    └──────────────────────┘
```

---

## Core Design Decisions

**Normalize before reasoning** — different systems represent information differently, so every event (GitHub, Sentry, log, monitoring) is converted into a common `EvidenceEvent` structure before anything else happens.

**Correlate before LLM reasoning** — raw data is never dumped straight into the model:

```
Raw Data → Normalize → Filter → Correlate → Build Context → LLM
```

This reduces noise and gives the model a structured representation of the incident instead of a wall of logs.

**Structured AI output** — the investigator returns structured results, not free-form text:

```json
{
  "hypothesis": "...",
  "confidence": 0.82,
  "supportingEvidence": [],
  "contradictingEvidence": [],
  "missingEvidence": [],
  "affectedComponents": [],
  "timeline": []
}
```

This makes the output easy for the frontend to visualize and easy for the system to validate.

---

## User Flow

1. Select an incident
2. Connect or upload evidence
3. BlackBox collects evidence
4. Evidence is normalized
5. Timeline is reconstructed
6. Related events are correlated
7. Evidence graph is generated
8. AI investigator analyzes evidence
9. Engineer reviews hypotheses
10. Challenge conclusion
11. Identify next investigation steps

The interface is built as an **incident investigation workspace**, not a generic chatbot — with an incident dashboard, investigation workspace, timeline, evidence graph, hypotheses panel, and challenge-conclusion flow.

---

## Technology Stack

| Layer | Stack |
|---|---|
| **Frontend** | React, TypeScript, Vite, Tailwind CSS, React Flow |
| **Backend** | Node.js, Express, TypeScript |
| **AI** | Google Gemini API |
| **Integrations** | GitHub, Sentry, File-based evidence, Demo evidence |
| **Deployment** | Render |

---

## Reliability Philosophy

BlackBox follows a simple principle: **the investigation should degrade gracefully instead of completely failing.**

```
Live Evidence
   → AI Analysis
       → (if unavailable) Deterministic Investigation
           → (if evidence unavailable) Demo / Precomputed Investigation
```

This matters especially in a hackathon environment, where external services, credentials, network access, and APIs can't always be guaranteed.

---

## Example Investigation

An application suddenly starts returning errors. BlackBox reconstructs:

```
10:02  New deployment
10:03  Database configuration changed
10:04  Connection pool reaches capacity
10:04  Database timeout errors increase
10:05  API latency increases
10:06  Request failures spike
```

Instead of simply displaying *"There are database errors,"* BlackBox explains:

> The incident appears correlated with the deployment and subsequent database connection exhaustion.
>
> **Supporting evidence:** deployment occurred immediately before the first failures · connection timeout events increased afterward · API errors followed the database failures
>
> **Missing evidence:** detailed database connection pool metrics

The engineer can then dig into the relevant evidence instead of manually reconstructing the entire sequence.

---

## What Makes BlackBox Different?

Most monitoring systems answer: **"What is failing?"**

BlackBox is designed around: **"What happened, how is it connected, and what evidence supports the explanation?"**

| Observability | BlackBox |
|---|---|
| Signals | Signals + Timeline + Correlation + Evidence Graph + Hypotheses + Contradictions + Missing Evidence |

The difference is the investigation layer.

---

## Running Locally

```bash
# Clone the repository
git clone <repository-url>
cd blackbox

# Install dependencies
npm install

# Create an environment file
touch .env
```

Add the required environment variable(s):

```env
GEMINI_API_KEY=your_gemini_api_key
```

Then start the development server:

```bash
npm run dev
```

For a production build:

```bash
npm run build
npm start
```

---

## Environment Variables

Depending on the enabled integrations, BlackBox can use:

```env
GEMINI_API_KEY=
GITHUB_TOKEN=
SENTRY_AUTH_TOKEN=
```

> Not every integration is required for the core investigation workflow — BlackBox falls back to deterministic and demo evidence when a connector isn't configured.

---

## Future Scope

- **More observability integrations** — Datadog, Grafana, Prometheus, AWS CloudWatch, Kubernetes, PagerDuty
- **Automated remediation** — suggest rollback, configuration changes, scaling actions, feature flag changes, service isolation
- **Continuous incident monitoring** — detect emerging incident patterns before a full outage, rather than only investigating after the fact
- **Historical incident learning** — compare a current incident against past incidents to surface similar patterns and additional context
- **Team collaboration** — let multiple engineers annotate evidence and record a final resolution together

---

## Project Philosophy

BlackBox is built around three ideas:

```
COLLECT → CORRELATE → INVESTIGATE → EXPLAIN
```

1. **Collect** — bring fragmented incident evidence together
2. **Correlate** — understand how individual events relate to one another
3. **Investigate** — use structured reasoning to turn evidence into an explanation

### Hackathon Focus

BlackBox was built around a simple principle: **build something that demonstrates a complete workflow, not just an AI feature.** The project combines AI reasoning, software engineering, observability, data normalization, event correlation, graph-based investigation, interactive visualization, graceful failure handling, and real-world developer experience — the AI is only one part of the system.

### Vision

Production incidents will never disappear completely. But the time engineers spend manually reconstructing what happened *can* be reduced.

BlackBox aims to become the investigation layer between raw observability data and engineering decisions. It does not try to replace the engineer — it tries to give the engineer a clearer picture of the incident, backed by the evidence that actually exists.

---

<p align="center"><b>BlackBox</b><br/>Collect. Correlate. Investigate. Explain.</p>
