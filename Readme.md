<div align="center">

```

██╗    ██╗ ██████╗ ██████╗ ██╗  ██╗███████╗██╗  ██╗██╗███████╗██╗     ██████╗
██║    ██║██╔═══██╗██╔══██╗██║ ██╔╝██╔════╝██║  ██║██║██╔════╝██║     ██╔══██╗
██║ █╗ ██║██║   ██║██████╔╝█████╔╝ ███████╗███████║██║█████╗  ██║     ██║  ██║
██║███╗██║██║   ██║██╔══██╗██╔═██╗ ╚════██║██╔══██║██║██╔══╝  ██║     ██║  ██║
╚███╔███╔╝╚██████╔╝██║  ██║██║  ██╗███████║██║  ██║██║███████╗███████╗██████╔╝
╚══╝╚══╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚═════╝

```

**AI-powered parametric income protection for India’s gig economy**

_Automated risk. Instant payouts. Zero friction._

---

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)

</div>

---

# Problem

```

╔════════════════════════════════════════════════════════════════════════════╗
║  GIG WORKERS FACE UNPREDICTABLE INCOME LOSS                                ║
╠════════════════════════════════════════════════════════════════════════════╣
║  External disruptions → Reduced working hours → Immediate income drop      ║
║  Peak-hour dependency amplifies financial impact                           ║
║  No structured income protection exists today                              ║
╚════════════════════════════════════════════════════════════════════════════╝

```

Traditional insurance systems are not compatible with gig workers due to:

- High claim latency (days to weeks)
- Manual and subjective verification pipelines
- Monthly pricing models misaligned with weekly earnings

---

# Solution

WorkShield is an **AI-driven parametric insurance platform** that automates income protection.

Instead of claim-based validation:

> Deterministic, data-driven triggers initiate claims and payouts automatically.

This removes:

- Human dependency
- Processing delays
- Subjective decision layers

---

# System Flow

```

╔════════════════════════════════════════════════════════════════════════════╗
║  END-TO-END FLOW                                                          ║
╠════════════════════════════════════════════════════════════════════════════╣
║  Onboarding → Risk Engine → Policy → Trigger Engine → Fraud Engine → Payout║
╚════════════════════════════════════════════════════════════════════════════╝

```

### Execution Pipeline

1. Worker registers and defines working profile
2. AI computes **risk score + weekly premium**
3. Policy is instantiated and stored
4. Trigger engine continuously evaluates external signals
5. Event threshold breach generates claim
6. Fraud engine evaluates claim asynchronously
7. Settlement service executes payout

---

# Key Features

## Weekly Pricing Model

```

Premium = E(Loss) + Risk Buffer + Margin

```

\[
E(Loss) = \sum P(event) \times income_rate \times duration \times time_weight
\]

### Technical Details

- Time-weighted risk modeling (peak vs off-peak hours)
- Dynamic feature inputs: location, historical disruptions, working slots
- AI fallback logic if model inference unavailable

---

## Parametric Trigger Engine

```

Rainfall > Threshold        → Trigger
AQI / Temperature Spike    → Trigger
Platform Downtime          → Trigger
Zone Restriction           → Trigger

```

### Implementation

- Event-driven trigger evaluation service
- API-integrated or simulated data feeds
- Threshold-based deterministic execution
- Idempotent trigger handling to avoid duplicate claims

---

## AI Risk & Pricing Engine

- Exposed via `/ai/predict`
- Model-backed inference (with fallback heuristics)

### Inputs:

- Location
- Working hours
- Income patterns

### Outputs:

- Risk score
- Weekly premium
- Feature-level breakdown

---

## Intelligent Fraud Detection

```

Layer 1: ML Model (Anomaly Detection)
Layer 2: Rule Engine (Location + Eligibility)
Layer 3: Behavioral Validation

```

### Technical Implementation

- Isolation Forest / statistical anomaly detection
- Claim consistency checks (time, location, trigger alignment)
- Duplicate claim detection
- Contract-based decision outputs

### Decision Buckets:

- Auto approve (< 0.3)
- Soft flag (0.3–0.7)
- Hard block (> 0.7)

---

## Zero-Touch Claim Lifecycle

- Automatic claim creation via trigger service
- Async fraud scoring pipeline
- State machine–based claim transitions:

```

pending → approved → paid
pending → soft_flag → review
pending → hard_block

```

- Payout orchestration with retry handling

---

# Architecture

```

```

                      CLIENT (Next.js)
                              |
                              v
                     NGINX (Reverse Proxy)
                              |
    +-------------------------+-------------------------+
    |                                                   |
    v                                                   v

```

BACKEND (Node.js)                                   AI SERVICE (Flask)
|                                                   |
|                                                   |
v                                                   v
DATABASE (MongoDB)

```

---

## Backend Design

- REST API (Express.js)
- Modular services:
  - Policy Service
  - Claim Service
  - Trigger Service
  - Fraud Service
  - Settlement Service

### Key Patterns

- Service-layer abstraction
- Contract-driven responses
- Async processing for AI workflows

---

## Data Models

- **User** → profile, role, activity
- **Policy** → coverage, premium, duration
- **Claim** → trigger type, status, fraud score
- **PayoutAttempt** → retries, status tracking
- **AuditLog** → system-level traceability

---

# Core Functionality

### User Side

- Authentication (JWT-based)
- Dynamic premium generation
- Policy lifecycle management
- Automated claim triggering
- Claim tracking

### Admin Side

- Ops dashboard (`/team2/ops`)
- Fraud review queue
- Payout execution + reconciliation
- Audit logs

---

# API Overview

```

POST /api/auth/register
POST /api/auth/login

POST /api/policies/quote
POST /api/policies
GET  /api/policies

POST /api/claims
GET  /api/claims/:id

POST /ai/predict
POST /ai/fraud-check

```

---

# Demo Flow

1. Register user
2. Generate premium via AI
3. Create policy
4. Simulate disruption trigger
5. Auto-create claim
6. Run fraud validation
7. Process payout

---

# Tech Stack

| Layer    | Technology               |
| -------- | ------------------------ |
| Frontend | Next.js, Tailwind CSS    |
| Backend  | Node.js, Express         |
| AI       | Python, Flask, ML models |
| Database | MongoDB                  |
| DevOps   | Docker, NGINX            |

---

# Design Principles

- Parametric over claim-based insurance
- Weekly pricing alignment with gig economy
- AI-assisted automation with fallback safety
- Event-driven architecture
- Separation of concerns via microservices

---

# Conclusion

WorkShield converts insurance from a delayed, manual system into a:

- Real-time
- Automated
- Data-driven

platform capable of protecting gig workers from income volatility at scale.

---

<div align="center">

Guidewire DEVTrails 2026 Submission

</div>
```
