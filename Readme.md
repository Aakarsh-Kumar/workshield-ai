<div align="center">

```
██╗    ██╗ ██████╗ ██████╗ ██╗  ██╗███████╗██╗  ██╗██╗███████╗██╗     ██████╗
██║    ██║██╔═══██╗██╔══██╗██║ ██╔╝██╔════╝██║  ██║██║██╔════╝██║     ██╔══██╗
██║ █╗ ██║██║   ██║██████╔╝█████╔╝ ███████╗███████║██║█████╗  ██║     ██║  ██║
██║███╗██║██║   ██║██╔══██╗██╔═██╗ ╚════██║██╔══██║██║██╔══╝  ██║     ██║  ██║
╚███╔███╔╝╚██████╔╝██║  ██║██║  ██╗███████║██║  ██║██║███████╗███████╗██████╔╝
 ╚══╝╚══╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚═════╝
```

**Parametric income protection for India's 15 million gig delivery workers.**

_Rain detected. Payout triggered. Wallet credited. No forms. No waiting. 90 seconds._

---

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)
![scikit-learn](https://img.shields.io/badge/scikit--learn-ML-F7931E?style=flat-square&logo=scikit-learn&logoColor=white)
![DevTrails](https://img.shields.io/badge/DevTrails-Hackathon_2025-FF6B35?style=flat-square)

</div>

---

## THE PROBLEM

```
╔════════════════════════════════════════════════════════════════════════════╗
║  GIG WORKER INCOME CURVE  --  WHERE THE MONEY ACTUALLY IS                  ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║    Rs/hr                                                                   ║
║     120 |                              ###### <-- DINNER RUSH              ║
║     100 |                        ##    ######     65% of daily income      ║
║      80 |                  ##    ####  ######  ##                          ║
║      60 |           ####   ####  ####  ######  ####                        ║
║      40 |    ####   ####   ####  ####  ######  ####  ####                  ║
║         +---------------------------------------------------               ║
║           9am  11am  1pm   3pm   5pm   7pm   9pm   11pm                    ║
║                                                                            ║
║    One rainstorm at 7pm  =  Rs 400-500 wiped out                           ║
║                          =  an entire week of margin gone                  ║
║                          =  zero recourse for the rider                    ║
║                                                                            ║
╠════════════════════════════════════════════════════════════════════════════╣
║  15 million riders  ·  No employer  ·  No sick leave  ·  No safety net     ║
╚════════════════════════════════════════════════════════════════════════════╝
```

Traditional insurance fails gig workers: manual claims, 7-30 day wait, subjective adjuster decisions.
WorkShield replaces all of that with a single rule -- **if the event happened, the payout fires. Automatically.**

---

## HOW IT WORKS

```
╔════════════════════════════════════════════════════════════════════════════╗
║  COMPLETE USER JOURNEY                                                     ║
╠════════════════════════════════════════════════════════════════════════════╣
║    1  ONBOARD        2  BUY POLICY     3  EVENT FIRES    4  PAYOUT         ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║    Name              Coverage          Rain > 50mm       Rs 2,500          ║
║    City              Rs 5,000          detected in       credited to       ║
║    Hours                               worker zone       wallet            ║
║    Income            Premium:          during active                       ║
║                      Rs 33 / week      hours             No form filed.    ║
║                                                          No call made.     ║
║    Takes 60s         One tap           AI verifies       90 seconds.       ║
║                                        in < 30 secs                        ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
```

---

## QUICK START

```bash
# One command starts all five services
git clone https://github.com/your-org/workshield-ai.git
cd workshield-ai

export JWT_SECRET=your_strong_secret_here

docker compose up --build
```

Open **http://localhost** -- the full application is live.

```
╔════════════════════════════════════════════════════════════════════════════╗
║  SERVICES                                                                  ║
╠════════════════════════════════════════════════════════════════════════════╣
║    PORT      SERVICE          ROLE                                         ║
╠════════════════════════════════════════════════════════════════════════════╣
║    :80       NGINX            Single entrypoint, routes all traffic        ║
║    :3000     Next.js PWA      Worker dashboard, policy buyer, history      ║
║    :4000     Express API      Auth, policies, claims, trigger engine       ║
║    :5001     Flask AI         Risk scoring, ML fraud detection             ║
║    :27017    MongoDB          Persistent store, full audit trail           ║
╚════════════════════════════════════════════════════════════════════════════╝
```

<details>
<summary>Run without Docker -- local development</summary>

```bash
# Backend
cd backend
cp .env.example .env
npm install
npm run dev                        # starts on :4000

# AI Service
cd ai-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python app.py                      # starts on :5001

# Frontend
cd client
bun install
bun dev                            # starts on :3000, proxies /api and /ai
```

</details>

---

## TEAM 1 INTEGRATION CONTRACT (FOR TEAM 2)

WorkShield exposes a stable fraud and settlement contract for Team 2 orchestration.

Integration behavior:
1. AI service attempts model-backed scoring when provisioned artifacts are available in runtime.
2. If artifacts are unavailable, service falls back to deterministic heuristic scoring.
3. Response contract fields remain stable across both paths.

Operational endpoints for Team 2:
1. `GET /health` returns fraud model mode and version.
2. `GET /fraud-model-status` returns model availability and active mode.
3. `GET /premium-model-status` returns premium model mode and artifact status.
4. `POST /fraud-check` returns both backward-compatible and Team 2-friendly fields:
  - `fraud_score`, `is_fraudulent`, `recommendation`
  - `verdict`, `signals`, `model_version`, `evaluation_meta`
  - `reasonCode`, `reasonDetail`, `fraudScore`
  - `settlementStatus`, `payoutEligibility`, `evaluationMeta`, `responseContractVersion`
5. `POST /predict` is model-backed for premium inference and returns:
  - `premium`, `currency`
  - `breakdown.mode` (`model` or fallback)
  - `breakdown.model_version`, `breakdown.predicted_risk_score`
6. `PATCH /api/claims/:id/paid` marks payout completion and enforces `approved -> paid` transition.

Reason code set (current):
1. `FRAUD_AUTO_APPROVE`
2. `FRAUD_SOFT_FLAG`
3. `FRAUD_HARD_BLOCK`
4. `POLICY_EXCLUSION_HIT`
5. `TRIGGER_THRESHOLD_NOT_MET`
6. `INVALID_TRANSITION`

Settlement transition contract (Team 2 consumed):
1. `pending -> approved`
2. `pending -> soft_flag`
3. `pending -> hard_block`
4. `approved -> paid`
5. Invalid transition returns structured error with `reasonCode=INVALID_TRANSITION`

Fraud score policy (balanced mode):
1. Runtime verdict buckets are fixed policy thresholds:
  - `auto_approve`: score < 0.30
  - `soft_flag`: 0.30 <= score < 0.70
  - `hard_block`: score >= 0.70
2. Runtime scoring remains normalized in [0, 1].

Current premium path status:
1. Fraud inference is model-backed (`/fraud-check`).
2. Premium inference is model-backed (`/predict`) using `lgb_weekly_premium` with deterministic feature synthesis and heuristic fallback safety.

CI automation:
1. GitHub Actions workflow `backend-tests` runs unit, contract, and integration tests on push and pull_request.

Team 1 handoff reference:
1. Full Team 2 contract and transition guide: `TEAM1_TEAM2_HANDOFF.md`

---

## ENVIRONMENT VARIABLES

```bash
cp backend/.env.example backend/.env
```

```
╔════════════════════════════════════════════════════════════════════════════╗
║  ENVIRONMENT VARIABLES                                                     ║
╠════════════════════════════════════════════════════════════════════════════╣
║    VARIABLE             REQ   DEFAULT                    PURPOSE           ║
╠════════════════════════════════════════════════════════════════════════════╣
║    JWT_SECRET           YES   dev-secret-change-me       Signs all auth tok║
║    MONGO_URI            no    mongo:27017/workshield      Database connecti║
║    CASHFREE_APP_ID      no    --                         Payout integration║
║    CASHFREE_SECRET      no    --                         Payout integration║
║    WEATHER_API_KEY      no    --                         Live trigger oracl║
║    FLASK_ENV            no    development                AI service mode   ║
║    PORT                 no    4000                       Backend port      ║
╚════════════════════════════════════════════════════════════════════════════╝
```

---

## SYSTEM ARCHITECTURE

```
                              BROWSER
                                 |
                    +------------v------------+
                    |        NGINX  :80       |
                    |     single entrypoint   |
                    +------------+------------+
                                 |
          +----------------------+----------------------+
          |  /                   |  /api                |  /ai
 +--------v--------+   +---------v--------+   +---------v--------+
 |  Next.js :3000  |   |  Express :4000   |   |   Flask :5001    |
 |                 |   |                  |   |                  |
 |  Dashboard      |   |  Auth (JWT)      |   |  Risk scoring    |
 |  Policy buyer   |   |  Policies        |   |  Fraud detect    |
 |  Payout history |   |  Trigger engine  |   |  ML inference    |
 |  PWA / offline  |   |  Claims          |   |  Isolation Forest|
 +-----------------+   +---------+--------+   +------------------+
                                 |
                      +----------v----------+
                      |    MongoDB :27017   |
                      |                     |
                      |  workers            |
                      |  policies           |
                      |  claims             |
                      |  triggers           |
                      |  payouts            |
                      |  audit_log          |
                      +---------------------+
```

| Service      | Stack                           | Role                                   |
| ------------ | ------------------------------- | -------------------------------------- |
| `client`     | Next.js 16, Tailwind, shadcn/ui | Mobile-first PWA, works offline        |
| `backend`    | Node.js, Express, Mongoose      | Core API + real-time trigger engine    |
| `ai-service` | Python, Flask, scikit-learn     | ML risk scoring + fraud detection      |
| `mongo`      | MongoDB 7                       | Data persistence with full audit trail |
| `nginx`      | NGINX 1.27                      | Reverse proxy, single-origin routing   |

---

## PARAMETRIC TRIGGERS

```
╔════════════════════════════════════════════════════════════════════════════╗
║  TRIGGER DECISION FLOW                                                     ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  Real-time data feeds                                                      ║
║       |                                                                    ║
║       +---- Weather API  ---- Rain > 50mm?                                 ║
║       +---- AQI Monitor  ---- Temp > 42C or AQI > 250?                     ║
║       +---- Platform API ---- Down > 4 hours?                              ║
║       +---- Hospital DB  ---- Inpatient admission logged?                  ║
║       +---- GPS + Report ---- Accident verified?                           ║
║                                     |                                      ║
║                            YES to any condition                            ║
║                                     |                                      ║
║                            Worker in affected zone?                        ║
║                            Event during active hours?                      ║
║                                     |                                      ║
║                            YES to both                                     ║
║                                     |                                      ║
║                       +-------------v-------------+                        ║
║                       |      AI FRAUD CHECK       |                        ║
║                       |    runs in < 30 seconds   |                        ║
║                       +---------------------------+                        ║
║                                     |                                      ║
║                +--------------------+--------------------+                 ║
║                |                    |                    |                 ║
║           Score < 0.3         Score 0.3-0.7        Score > 0.7             ║
║                |                    |                    |                 ║
║         [AUTO-APPROVE]        [SOFT-FLAG]         [HARD-BLOCK]             ║
║          Payout in 90s        Hold + recheck       Investigate             ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
```

| Trigger           | Threshold                                    | Payout               | Oracle            |
| ----------------- | -------------------------------------------- | -------------------- | ----------------- |
| Heavy rainfall    | > 50 mm in worker's zone during active hours | **50%** of coverage  | IMD / OpenWeather |
| Vehicle accident  | Any verified incident                        | **100%** of coverage | GPS + report      |
| Platform outage   | > 4 continuous hours                         | **30%** of coverage  | Status API        |
| Hospitalization   | Any inpatient admission                      | **100%** of coverage | Hospital record   |
| Heat / AQI stress | Temp > 42C OR AQI > 250                      | **40%** of coverage  | Weather / AQI API |

---

## PREMIUM ENGINE

No flat rates. Every worker gets a personalised premium calculated from time-weighted expected loss.

```
╔════════════════════════════════════════════════════════════════════════════╗
║  PREMIUM FORMULA                                                           ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  P  =  Expected Loss  +  Risk Buffer  +  Operational Margin                ║
║                                                                            ║
║  E(L)  =  SUM of  [  P(event)  x  income_per_hour                          ║
║                                x  lost_hours                               ║
║                                x  time_weight  ]                           ║
║                                                                            ║
╠════════════════════════════════════════════════════════════════════════════╣
║  TIME WEIGHT SCHEDULE          Rationale                                   ║
╠════════════════════════════════════════════════════════════════════════════╣
║  12pm - 3pm    0.6             Moderate lunch orders                       ║
║  3pm  - 6pm    0.3             Slow afternoon window                       ║
║  6pm  - 11pm   0.9  ***        PEAK -- 65% of daily income lives here      ║
║  11pm - 12am   0.5             Late night taper                            ║
║  12am - 12pm   0.1             Near-zero earning window                    ║
╠════════════════════════════════════════════════════════════════════════════╣
║  WORKED EXAMPLE  --  Ravi, dinner-shift rider, Mumbai                      ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  Event:          3hr rain during dinner rush  (peak weight 0.9)            ║
║  Loss:           Rs 100/hr  x  3hrs  x  0.9   =  Rs 270                    ║
║  P(rain/week):   8%                                                        ║
║  Expected loss:  Rs 270  x  0.08              =  Rs  21.60                 ║
║  Risk buffer:                                     Rs   6.00                ║
║  Platform margin:                                 Rs   5.00                ║
║                                                                            ║
║    --------------------------------------------------                      ║
║  WEEKLY PREMIUM:                                  Rs  33.00                ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
```

```
╔════════════════════════════════════════════════════════════════════════════╗
║  PREMIUM BREAKDOWN -- WHERE RS 33 GOES                                     ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  Expected Loss   ##############################   Rs 22   (66%)            ║
║  Risk Buffer     ############                     Rs  6   (18%)            ║
║  Margin          ##########                       Rs  5   (16%)            ║
║                  ------------------------------------------                ║
║  TOTAL                                            Rs 33 / week             ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
```

---

## AI AND ML LAYER

### Risk Scoring

```
╔════════════════════════════════════════════════════════════════════════════╗
║  RISK SCORING  --  /ai/predict                                             ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║    REQUEST                  MODEL                  RESPONSE                ║
╠════════════════════════════════════════════════════════════════════════════╣
║    location: Mumbai         Supervised             risk_score: 0.72        ║
║    hours: [18, 23]    -->   regression       -->   disruption_prob: 0.08   ║
║    avg_income: Rs 650       trained on:            coverage: Rs 5,000      ║
║    platform: swiggy         - weather history      weekly_premium: Rs 33   ║
║    weeks_active: 24         - location risk                                ║
║                             - earning patterns                             ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
```

### Fraud Detection

```
╔════════════════════════════════════════════════════════════════════════════╗
║  FRAUD DETECTION  --  /ai/fraud-check                                      ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  CLAIM ARRIVES                                                             ║
║       |                                                                    ║
║       v                                                                    ║
║  LAYER 1 -- ML  (Isolation Forest)                                         ║
║    Is this claim statistically anomalous vs learned patterns?              ║
║       |                                                                    ║
║       v                                                                    ║
║  LAYER 2 -- RULE ENGINE                                                    ║
║    [+] GPS coordinates inside confirmed disruption zone?                   ║
║    [+] Platform activity logged near incident time?                        ║
║    [+] No burst of 50+ claims from same neighbourhood?                     ║
║    [+] No mock-location / developer-mode / rooted device flag?             ║
║       |                                                                    ║
║       v                                                                    ║
║  LAYER 3 -- TELEMETRY CROSS-CHECK                                          ║
║    [+] Accelerometer pattern matches claimed movement?                     ║
║    [+] Cell tower + Wi-Fi fingerprint consistent with GPS?                 ║
║    [+] Order history corroborates claimed time + location?                 ║
║                                                                            ║
║       +------------------+------------------+                              ║
║       |                  |                  |                              ║
║    Score < 0.3     Score 0.3-0.7      Score > 0.7                          ║
║       |                  |                  |                              ║
║    [AUTO-APPROVE]  [SOFT-FLAG]      [HARD-BLOCK]                           ║
║     Payout 90s     Hold+recheck      Investigate                           ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
```

**Design principle:** False positives hurt honest workers in genuine disasters. The model is tuned
toward false-negative tolerance during severe-weather events -- provisional payouts go out for
soft-flagged claims with clean history, and full validation catches up when connectivity restores.

---

# Adversarial Defense & Anti-Spoofing Strategy

Simple GPS verification is not sufficient for a payout decision. WorkShield AI uses a multi-signal fraud decision layer that scores whether a worker is genuinely stranded in a disruption zone or is artificially simulating presence there.

---

### 1. The Differentiation

The platform differentiates genuine hardship from spoofing by comparing claimed location against behavioral, device, and environmental evidence in the same time window.

A legitimate stranded worker typically shows:

- A believable movement trail into the affected zone before the disruption escalates
- Deceleration or stoppage patterns that match worsening weather, blocked roads, or safety pauses
- Real work context such as accepted orders, route progress, or recent active sessions
- Network degradation patterns consistent with severe weather rather than a clean static device state
- Corroboration from nearby external signals such as radar intensity, flood alerts, or multiple independent users in the same area

A spoofing actor typically shows:

- GPS jumps without matching accelerometer, gyroscope, or route progression evidence
- Device motion that suggests the phone is stationary indoors while the reported path is moving outdoors
- Mock-location, emulator, rooted-device, or developer-setting indicators
- No recent delivery workflow activity despite claiming exposure to a red-alert zone
- Coordinated timing patterns where many users trigger similar claims from the same city cluster at nearly the same moment

The AI layer combines anomaly detection, sequence modeling, and graph-based fraud analysis. Instead of asking whether the GPS point is inside a danger zone, it asks whether the full story told by the device, the worker behavior, and the city-wide event data is internally consistent.

---

### 2. The Data

To detect both individual spoofing and coordinated fraud rings, the system analyzes data points beyond raw latitude and longitude.

Device and sensor signals:

- Accelerometer and gyroscope consistency with claimed movement
- Speed, heading changes, stop-start patterns, and route continuity
- Barometer, battery drain, and device temperature changes during severe weather exposure
- OS-level mock-location flags, developer-mode indicators, root or jailbreak status, and emulator fingerprints

Network and location-quality signals:

- Cell tower and Wi-Fi fingerprint consistency
- GNSS accuracy, satellite count, and timestamp reliability
- IP geolocation mismatch with reported device location
- Sudden SIM swaps, device ID churn, or repeated network identity changes

Work and platform context:

- Order acceptance and completion history near the incident window
- Pickup, drop, and route milestone timestamps
- App foreground activity, session continuity, and interaction cadence
- Historical working hours so the system knows whether the worker is normally active at that time

Fraud-ring detection signals:

- Multiple claims firing in synchronized bursts from the same micro-region
- Shared payment accounts, devices, bank endpoints, or referral links across accounts
- Repeated claim clusters tied to the same neighborhood, handset model mix, or operating-system build
- Social-pattern anomalies such as many new users surfacing with identical trigger timing during one weather event

External corroboration signals:

- Radar and hyperlocal weather severity
- Flood alerts, road closure feeds, and disruption notices
- Simulated demand collapse and platform-side order scarcity
- Nearby legitimate mobility slowdowns compared with normal traffic behavior

These features allow the system to identify not only fake coordinates, but also the organized behavior of a syndicate attempting to drain the pool at scale.

---

### 3. The UX Balance

The claim workflow is designed to stop fraud without treating every connectivity failure as suspicious.

The system uses three decision paths:

- Auto-approve when external conditions and worker telemetry strongly align
- Soft-flag when evidence is incomplete but not clearly fraudulent
- Hard-block only when there is high-confidence evidence of spoofing or organized abuse

For soft-flagged claims, the platform should not immediately reject the worker. Instead it can:

- Hold the payout briefly for secondary checks
- Request low-friction evidence already available in-app, such as recent task history or route continuity
- Use a grace window to wait for delayed telemetry caused by bad weather or network congestion
- Escalate to manual review only if contradictions remain after passive checks

To avoid unfairly penalizing honest workers, the model prioritizes false-positive reduction in severe weather windows. If a worker has a strong historical pattern of legitimate activity and the only missing signal is temporary connectivity, the system can release a provisional partial payout and complete full validation once the network stabilizes.

This creates a balanced workflow: honest workers are protected from harsh denials during genuine outages, while coordinated spoofing attacks are slowed, investigated, and prevented from triggering instant mass payouts.

---

---

## API REFERENCE

### Authentication

```bash
POST /api/auth/register
     Body: { "name": "Ravi Kumar", "phone": "9876543210",
             "city": "Mumbai", "platform": "swiggy" }

POST /api/auth/login
     Body: { "phone": "9876543210", "password": "yourpassword" }
     Returns: { "token": "eyJhbGci..." }
```

### Policies

```bash
POST /api/policies/quote            # AI-powered premium quote
POST /api/policies                  # Buy a policy
GET  /api/policies                  # List active policies
POST /api/policies/:id/trigger      # Fire a trigger event (test/demo mode)
```

### Claims and AI Service

```bash
POST /api/claims                    # File a claim
POST /ai/predict                    # Risk score + premium prediction
POST /ai/fraud-check                # Run fraud analysis on a claim
```

All `/api/policies` and `/api/claims` endpoints require:

```
Authorization: Bearer <token>
```

---

## DEMO -- FULL PAYOUT FLOW IN YOUR TERMINAL

Copy-paste this to simulate a complete rainfall-to-payout cycle:

```bash
BASE=http://localhost

# Step 1 -- Register a worker
curl -s -X POST $BASE/api/auth/register   -H "Content-Type: application/json"   -d '{"name":"Ravi Kumar","phone":"9876543210",
       "password":"test123","city":"Mumbai","platform":"swiggy"}'

# Step 2 -- Login, capture JWT
TOKEN=$(curl -s -X POST $BASE/api/auth/login   -H "Content-Type: application/json"   -d '{"phone":"9876543210","password":"test123"}' | jq -r '.token')

# Step 3 -- Get an AI premium quote
curl -s -X POST $BASE/api/policies/quote   -H "Authorization: Bearer $TOKEN"   -H "Content-Type: application/json"   -d '{"coverage_amount":5000,"working_hours":[18,23]}'
# --> { "weekly_premium": 33, "risk_score": 0.72 }

# Step 4 -- Buy the policy
POLICY_ID=$(curl -s -X POST $BASE/api/policies   -H "Authorization: Bearer $TOKEN"   -H "Content-Type: application/json"   -d '{"coverage_amount":5000,"duration_weeks":1}' | jq -r '._id')

# Step 5 -- Fire a 62mm rainfall trigger (above the 50mm threshold)
curl -s -X POST $BASE/api/policies/$POLICY_ID/trigger   -H "Authorization: Bearer $TOKEN"   -H "Content-Type: application/json"   -d '{"trigger_type":"rainfall","intensity_mm":62,"location":"Mumbai"}'
```

Expected response -- payout fires with zero human involvement:

```json
{
  "payout_id": "pw_8f3k2j9x",
  "status": "payout_initiated",
  "amount": 2500,
  "coverage_pct": 50,
  "trigger": "rainfall_threshold_exceeded",
  "fraud_score": 0.12,
  "verdict": "auto_approved",
  "eta_seconds": 90
}
```

---

## PROJECT STRUCTURE

```
  workshield-ai/
  |
  +-- client/                       Next.js PWA  (mobile-first)
  |   +-- app/
  |   |   +-- dashboard/            Worker home + live trigger alerts
  |   |   +-- policy/               Buy and manage coverage
  |   |   +-- claims/               Claim history and payout status
  |   +-- components/
  |       +-- TriggerAlert.tsx      Real-time event notification banner
  |       +-- PolicyCard.tsx        Coverage display card
  |       +-- PayoutHistory.tsx     Transaction history feed
  |
  +-- backend/                      Express REST API
  |   +-- routes/
  |   |   +-- auth.js               JWT registration and login
  |   |   +-- policies.js           Policy CRUD + AI quote engine
  |   |   +-- claims.js             Claim intake + status
  |   |   +-- triggers.js           Real-time trigger evaluation
  |   +-- models/
  |   |   +-- Worker.js
  |   |   +-- Policy.js
  |   |   +-- Claim.js
  |   +-- middleware/
  |   |   +-- auth.js               JWT verification middleware
  |   +-- .env.example              <-- start here
  |
  +-- ai-service/                   Flask ML microservice
  |   +-- app.py                    Routes: /predict + /fraud-check
  |   +-- models/
  |   |   +-- risk_model.pkl        Trained risk scorer
  |   |   +-- fraud_model.pkl       Isolation Forest anomaly detector
  |   +-- requirements.txt
  |
  +-- nginx/
  |   +-- nginx.conf                Proxy rules
  |
  +-- docker-compose.yml            <-- one command to start everything
```

---

## PRODUCTION CHECKLIST

```
  SECURITY
  ------------------------------------------------------------------------
  [ ] JWT_SECRET from secrets manager -- never committed to repo
  [ ] MongoDB authentication enabled  (--auth flag)
  [ ] TLS via Let's Encrypt / Certbot on NGINX
  [ ] Rate limiting:  /api/auth    <= 5 req/min
                      /api/claims  <= 10 req/min

  ML / AI
  ------------------------------------------------------------------------
  [ ] Replace heuristic fraud model with trained XGBoost
  [ ] Monthly model retraining on fresh weather + claim data
  [ ] Tune fraud thresholds -- minimize false positives during
      genuine disaster events

  INTEGRATIONS
  ------------------------------------------------------------------------
  [ ] Live IMD Weather API  (replace simulated oracle)
  [ ] Swiggy / Zomato platform status webhooks
  [ ] Cashfree: test mode --> live  (worker KYC required)

  RELIABILITY
  ------------------------------------------------------------------------
  [ ] Idempotency keys on all payout endpoints
  [ ] Append-only audit log for every claim event
  [ ] Dead-letter queue for failed trigger events
  [ ] Health checks on all Docker containers
```

---

## TECH STACK

| Layer    | Technology                | Why                                               |
| -------- | ------------------------- | ------------------------------------------------- |
| Frontend | Next.js 16 + Tailwind CSS | PWA support, offline-capable, mobile-first        |
| Backend  | Node.js + Express         | Lightweight, event-driven trigger processing      |
| ML / AI  | Python + scikit-learn     | Isolation Forest for anomaly, regression for risk |
| Database | MongoDB 7                 | Flexible schema for evolving claim structures     |
| Payments | Cashfree API              | India-first, UPI + wallet, instant settlement     |
| Proxy    | NGINX 1.27                | Single origin, clean routing                      |
| DevOps   | Docker Compose            | One-command start, dev/prod parity                |

---

## CONTRIBUTING

```bash
git checkout -b feat/your-feature
git commit -m "feat: describe your change"
git push origin feat/your-feature
# --> open a Pull Request
```

---

<div align="center">

```
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║  Built for the 15 million delivery riders of India who earn every          ║
║  rupee in the rain, the heat, and the dark.                                ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
```

**WorkShield AI** -- DevTrails Hackathon 2026

</div>
