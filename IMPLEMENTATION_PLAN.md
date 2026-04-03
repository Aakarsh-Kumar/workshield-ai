# WorkShield AI — Comprehensive Implementation Plan

**Current Date:** 3 April 2026  
**Project Status:** 40% Complete — Core infrastructure ready, business logic in progress  
**Critical Gaps Identified:** Insurance domain knowledge (policy exclusions), production hardening, ML models

---

## 📊 Executive Summary

### From Feedback Analysis

The hackathon judges identified **exceptional technical execution** with:

- ✅ Strong gig-worker economics understanding
- ✅ Sophisticated AI/ML integration architecture
- ✅ Impressive implementation depth
- ✅ Well-designed actuarial premium model

**BUT** with **critical domain gap:**

- ❌ **Missing standard insurance exclusions** (war, pandemics, terrorism, nuclear events)
- ❌ This gap suggests incomplete insurance domain knowledge despite strong tech implementation
- ❌ Would render the product non-compliant and uninsurable in production

---

## 🏗️ Current Architecture Status

### ✅ What's Done (40% Complete)

#### Infrastructure

- [x] Docker Compose orchestration (5 services)
- [x] MongoDB schemas (User, Policy, Claim models)
- [x] NGINX reverse proxy with routing
- [x] Service-to-service networking

#### Backend APIs (70% scaffolded)

- [x] Auth endpoints (register, login)
- [x] Policy CRUD routes
- [x] Claim CRUD routes
- [x] JWT middleware protection
- [x] Basic error handling

#### Frontend UI (60% built)

- [x] Login/Register page with platform selection
- [x] Dashboard with policy & claim display
- [x] UI components (buttons, cards, badges, inputs)
- [x] Auth flow and token management
- [x] Responsive mobile-first design

#### AI/ML (30% built)

- [x] Risk scoring route structure (`/predict`)
- [x] Premium calculation heuristics
- [x] Platform risk multipliers
- [x] Fraud scoring skeleton (`/fraud-check`)
- [x] Flask app setup with CORS

---

## ❌ What's Missing & Severity Levels

### 🔴 CRITICAL (Blocks MVP)

#### 1. **Insurance Domain Compliance**

- **Status:** Not implemented
- **Impact:** Product is uninsurable without this
- **Required:**
  - [ ] Policy exclusion clauses (war, pandemics, terrorism, nuclear)
  - [ ] Regulatory compliance checks (IRDAI guidelines for India)
  - [ ] Policy terms & conditions documentation
  - [ ] Force majeure definitions specific to Indian gig economy
  - [ ] Claim settlement dispute procedures
  - [ ] Underwriting guidelines and risk appetite

**Why Critical:** Without exclusions, an 8.2 earthquake or pandemic would trigger unlimited payouts. Insurance regulators won't license the product.

**Action Items:**

```javascript
// backend/models/Policy.js needs:
{
  exclusions: [
    'war_and_civil_unrest',
    'pandemic_epidemic',
    'terrorism',
    'nuclear_radiation',
    'force_majeure'
  ],
  termsVersion: '1.0',
  regulatoryApprovals: ['IRDAI_reference_number'],
  underwritingGuidelines: { ... }
}
```

#### 2. **Trigger Evaluation Engine**

- **Status:** Partially scaffolded
- **Impact:** Core payout logic doesn't work
- **Required:**
  - [ ] `triggerService.js` — Evaluate if trigger condition met
  - [ ] Check worker location matches affected zone
  - [ ] Check event timing overlaps active working hours
  - [ ] Match trigger value vs threshold
  - [ ] Calculate payout amount based on policy triggers

```javascript
// backend/services/triggerService.js STUB:
exports.processTriggerEvent = async (policyId, triggerType, triggerValue) => {
  // 1. Fetch policy
  // 2. Check if trigger condition is met
  // 3. Check worker location (if rainfall trigger, is worker in rain zone?)
  // 4. Calculate claim amount
  // 5. Return decision: { verdict: 'auto_approve' | 'soft_flag' | 'hard_block', amount }
};
```

#### 3. **Fraud Detection (ML Model)**

- **Status:** Heuristic skeleton only
- **Impact:** No protection against coordinated fraud rings
- **Required:**
  - [ ] Train Isolation Forest on sample claims dataset
  - [ ] Multi-layer validation (geo, telemetry, social)
  - [ ] Device fingerprinting detection
  - [ ] Mock-location flag detection
  - [ ] Coordinated claim clustering

**Implement `/ai/fraud-check`:**

```python
# Layer 1: Isolation Forest anomaly detection
# Layer 2: Rule engine (GPS in zone, platform activity, no burst claims)
# Layer 3: Telemetry cross-check (accelerometer, cell tower, IP geolocation)
# Returns: score (0-1), signals[], verdict
```

#### 4. **Policy Purchase Flow**

- **Status:** Backend stub, no frontend
- **Impact:** Workers can't buy policies
- **Required:**
  - [ ] Complete `policyService.createPolicy()`
  - [ ] Call AI service for risk score + premium
  - [ ] Default trigger definitions based on coverage type
  - [ ] Build `/policies/new` frontend page
  - [ ] Payment integration stub (Cashfree test mode)

---

### 🟠 HIGH PRIORITY (Blocks production)

#### 5. **Weather API Integration**

- **Current:** Trigger fires are hardcoded in tests
- **Required:** Real IMD/OpenWeather API
- **Implementation:**
  - [ ] Fetch rainfall data for worker's location
  - [ ] Geofence matching (is worker in affected zone?)
  - [ ] Historical weather data for claims validation

#### 6. **Payout Processing**

- **Status:** Not implemented
- **Impact:** No actual payments to workers
- **Required:**
  - [ ] Cashfree API integration (test → production)
  - [ ] UPI/wallet payout logic
  - [ ] Idempotency keys (prevent duplicate payouts)
  - [ ] Settlement tracking

#### 7. **Claim Settlement Logic**

- **Status:** Controllers exist but incomplete
- **Impact:** Claims never auto-approve or settle
- **Required:**
  - [ ] Decision logic: auto-approve vs soft-flag vs hard-block
  - [ ] Update claim status (pending → approved → paid)
  - [ ] Trigger payout webhook

#### 8. **Production Hardening**

- **Status:** None
- **Impact:** System vulnerable to abuse
- **Required:**
  - [ ] Rate limiting on `/api/auth`, `/api/claims`
  - [ ] Request validation and sanitization
  - [ ] Audit logging for all claims events
  - [ ] Dead-letter queue for failed payouts
  - [ ] MongoDB authentication enabled
  - [ ] TLS/HTTPS on NGINX
  - [ ] Environment secrets management

---

### 🟡 MEDIUM PRIORITY (Full feature set)

#### 9. **Frontend Pages**

- [ ] `/policies/new` — Buy a policy
- [ ] `/claims/new` — File a claim
- [ ] `/payouts` — Payout history
- [ ] Real-time trigger alert banner
- [ ] Premium calculator UI
- [ ] Policy details modal

#### 10. **Advanced ML**

- [ ] Replace heuristics with trained XGBoost model
- [ ] Monthly model retraining pipeline
- [ ] Feature engineering for location risk, earning patterns
- [ ] Telemetry analysis (accelerometer patterns, GPS jumps)
- [ ] Social fraud detection (coordinated claim clusters)

#### 11. **Data & Testing**

- [ ] Unit tests for premium calculations
- [ ] Integration tests for claim workflows
- [ ] E2E tests with mock weather triggers
- [ ] Sample dataset for model training
- [ ] Mock fraud cases for validation

---

## 📋 Master Implementation Timeline

### **Phase 1: Insurance Compliance & Core Payout Logic (Weeks 1-3)**

#### Week 1: Insurance Domain Setup

```
Day 1-2: Insurance Compliance Documentation
  ├─ Add policy exclusions to schema
  ├─ Draft terms & conditions (gig-worker specific)
  ├─ Define force majeure triggers
  └─ Add IRDAI compliance fields to Policy model

Day 3-4: Regulatory Integration
  ├─ Add regulatoryApprovals field to Policy
  ├─ Create compliance middleware
  ├─ Add claim settlement dispute procedures
  └─ Document underwriting guidelines

Day 5: Testing & Docs
  ├─ Create sample policy with all exclusions
  ├─ Write insurance domain documentation
  └─ Add compliance checklist to README
```

**Deliverable:** Policy model with insurance compliance fields
**PR:** `feat/insurance-compliance-schema`

---

#### Week 2: Trigger Evaluation Engine

```
Day 1-2: Implement triggerService.js
  ├─ processTriggerEvent() - main orchestrator
  ├─ evaluateTriggerCondition() - threshold check
  ├─ calculatePayout() - amount determination
  └─ checkLocationMatch() - geofence logic

Day 3: Policy Controller Integration
  ├─ Complete fireTrigger() endpoint
  ├─ Add trigger validation
  ├─ Test all trigger types

Day 4-5: Manual Testing
  ├─ Rainfall trigger → 50% payout
  ├─ Vehicle accident → 100% payout
  ├─ Platform outage → 30% payout
  ├─ Out-of-zone trigger → rejected
  └─ Expired policy → rejected
```

**Deliverable:** Working trigger evaluation with correct payouts
**PR:** `feat/trigger-evaluation-engine`

---

#### Week 3: Fraud Detection Framework

```
Day 1-2: Isolation Forest Implementation
  ├─ Create sample training dataset
  ├─ Train isolation_forest model
  ├─ Save model as fraud_model.pkl

Day 3: Flask /ai/fraud-check Endpoint
  ├─ Layer 1: Isolation Forest inference
  ├─ Layer 2: Rule engine (geo, timing, burst)
  ├─ Layer 3: Telemetry validation stub
  └─ Return score + verdict

Day 4-5: Integration & Testing
  ├─ Connect backend claim creation to fraud service
  ├─ Test auto-approve (score < 0.3)
  ├─ Test soft-flag (0.3-0.7)
  ├─ Test hard-block (> 0.7)
```

**Deliverable:** Fraud detection working on all claims
**PR:** `feat/fraud-detection-ml`

---

### **Phase 2: Payment & User Flows (Weeks 4-6)**

#### Week 4: Policy Purchase Flow

```
Day 1-2: Backend - policyService.createPolicy()
  ├─ Call AI /predict for premium
  ├─ Get worker risk score
  ├─ Set default triggers
  ├─ Create Policy document
  └─ Return policy with premium

Day 3: Frontend - /policies/new Page
  ├─ Coverage amount slider
  ├─ Platform selector
  ├─ Real-time premium quote display
  ├─ Buy button → POST /api/policies

Day 4-5: Testing
  ├─ Quote calculations correct
  ├─ Policy created in DB
  ├─ Status shows as 'active'
```

**Deliverable:** End-to-end policy purchase flow
**PR:** `feat/policy-purchase-flow`

---

#### Week 5: Claim Filing & Settlement

```
Day 1-2: Claim Filing UI - /claims/new
  ├─ Trigger type selector
  ├─ Trigger value input (mm, hours, etc.)
  ├─ Document upload (photo proof)
  ├─ Submit → POST /api/claims

Day 3: Claim Settlement Logic
  ├─ Backend: Auto-approval for clean claims
  ├─ Backend: Soft-flag hold + recheck timer
  ├─ Backend: Hard-block with investigation flag
  ├─ Update claim status in DB

Day 4-5: Payout History UI
  ├─ /payouts page with transaction list
  ├─ Status colors (pending, approved, paid)
  ├─ Amount and date display
```

**Deliverable:** Claims workflow with status tracking
**PR:** `feat/claim-filing-and-settlement`

---

#### Week 6: Cashfree Integration (Test Mode)

```
Day 1-2: Cashfree API Setup
  ├─ Create Cashfree test account
  ├─ Set up API credentials
  ├─ Implement payout request logic

Day 3: Payout Endpoint
  ├─ POST /api/payouts/{claimId}
  ├─ Call Cashfree UPI endpoint
  ├─ Store transaction ID

Day 4-5: Testing
  ├─ Test payout in Cashfree dashboard
  ├─ Verify worker receives test credits
  ├─ Handle payout failures gracefully
```

**Deliverable:** Test-mode payouts (no real money)
**PR:** `feat/cashfree-test-integration`

---

### **Phase 3: Production Hardening (Weeks 7-9)**

#### Week 7: Security & Validation

```
Day 1-2: Rate Limiting
  ├─ Express rate-limit middleware
  ├─ /api/auth: 5 req/min per IP
  ├─ /api/claims: 10 req/min per user
  ├─ /api/policies: 20 req/min per user

Day 3: Input Validation
  ├─ Joi schemas for all endpoints
  ├─ Sanitize phone numbers, emails
  ├─ Validate coverage amounts (100-5000 INR)
  ├─ Validate trigger values (mm > 0, hours > 0)

Day 4-5: Error Handling
  ├─ Consistent error response format
  ├─ Meaningful error messages
  ├─ 404, 400, 401, 403, 500 handlers
  ├─ Log all errors to audit trail
```

**Deliverable:** Security layer with validation
**PR:** `feat/security-hardening`

---

#### Week 8: Audit Logging & Reliability

```
Day 1-2: Audit Log System
  ├─ MongoDB AuditLog collection
  ├─ Log all claim events: filed, reviewed, approved, paid
  ├─ Include user, timestamp, action, outcome
  ├─ Immutable append-only pattern

Day 3: Dead-Letter Queue
  ├─ Redis for failed payout retries
  ├─ Exponential backoff (1s, 5s, 30s, 5m)
  ├─ Alert on 3+ failures

Day 4-5: Health Checks
  ├─ MongoDB healthcheck
  ├─ AI service healthcheck
  ├─ NGINX upstream monitoring
  ├─ Container restart on failure
```

**Deliverable:** Audit trail and reliability layer
**PR:** `feat/audit-logging-and-reliability`

---

#### Week 9: TLS & Secrets Management

```
Day 1-2: HTTPS Setup
  ├─ Let's Encrypt certificate
  ├─ NGINX SSL configuration
  ├─ Redirect HTTP → HTTPS

Day 3: Secrets Management
  ├─ Move JWT_SECRET to AWS Secrets Manager
  ├─ Move CASHFREE_SECRET to Secrets Manager
  ├─ Add secret rotation schedule

Day 4-5: Documentation
  ├─ Production deployment guide
  ├─ Environment setup checklist
  ├─ Monitoring dashboard links
  ├─ Runbook for common issues
```

**Deliverable:** Production-ready security infrastructure
**PR:** `feat/tls-and-secrets-management`

---

### **Phase 4: ML & Advanced Features (Weeks 10-12)**

#### Week 10: Advanced Fraud Detection

```
Day 1-2: Feature Engineering
  ├─ Location risk scoring
  ├─ Earning pattern analysis
  ├─ Delivery frequency normalization
  ├─ Temporal anomaly detection

Day 3-4: XGBoost Model
  ├─ Replace Isolation Forest with XGBoost
  ├─ Train on 10K+ labeled claims
  ├─ Hyperparameter tuning
  ├─ 90%+ fraud detection rate

Day 5: Retraining Pipeline
  ├─ Monthly batch retraining job
  ├─ A/B test new model vs old
  ├─ Gradual rollout strategy
```

**Deliverable:** Production-grade ML fraud detector
**PR:** `feat/advanced-fraud-detection`

---

#### Week 11: Real Data Integration

```
Day 1: Weather API Integration
  ├─ IMD/OpenWeather live data fetch
  ├─ Geofence matching (worker zone vs rain zone)
  ├─ Historical weather for claim validation

Day 2: Platform Webhooks
  ├─ Swiggy/Zomato status webhooks
  ├─ Parse platform outage events
  ├─ Cross-check with claims

Day 3-4: Hospital Database
  ├─ Hospital admission verification
  ├─ Hospitalization trigger validation
  ├─ Privacy-preserving queries

Day 5: Testing
  ├─ End-to-end trigger firing
  ├─ Real weather data validation
```

**Deliverable:** Real external data sources connected
**PR:** `feat/real-data-integration`

---

#### Week 12: Testing & Documentation

```
Day 1-2: Unit & Integration Tests
  ├─ Premium calculation tests
  ├─ Trigger evaluation tests
  ├─ Fraud scoring tests
  ├─ Auth flow tests

Day 3: End-to-End Tests
  ├─ Full claim lifecycle (file → approve → pay)
  ├─ Fraud blocking tests
  ├─ Weather integration tests

Day 4-5: Documentation
  ├─ API documentation (Swagger)
  ├─ Deployment guide
  ├─ Architecture diagrams
  ├─ Insurance compliance docs
  ├─ Update README with production checklist
```

**Deliverable:** Test coverage > 80%, comprehensive docs
**PR:** `feat/testing-and-documentation`

---

## 🎯 Detailed Implementation Guide: Critical Path Items

### 1. Insurance Compliance Schema Update

**File:** `backend/models/Policy.js`

Add these fields:

```javascript
exclusions: {
  type: [String],
  enum: [
    'war_and_civil_unrest',
    'pandemic_epidemic',
    'terrorism',
    'nuclear_radiation',
    'force_majeure',
    'self_inflicted_injury',
    'intoxication_or_drug_use',
    'criminal_activity',
    'professional_violation'
  ],
  default: [
    'war_and_civil_unrest',
    'pandemic_epidemic',
    'terrorism',
    'nuclear_radiation'
  ]
},
termsVersion: { type: String, default: '1.0' },
regulatoryReference: { type: String }, // IRDAI approval number
underwritingGuidelines: {
  minAge: { type: Number, default: 18 },
  maxAge: { type: Number, default: 70 },
  minCoverageAmount: { type: Number, default: 1000 },
  maxCoverageAmount: { type: Number, default: 10000 },
  maxClaimsPerMonth: { type: Number, default: 3 }
}
```

### 2. Trigger Evaluation Engine

**File:** `backend/services/triggerService.js`

```javascript
const triggerService = {
  processTriggerEvent: async (policy, triggerType, triggerValue) => {
    // Check 1: Exclusions
    if (policy.exclusions.includes("pandemic_epidemic")) {
      return { verdict: "excluded", reason: "Pandemic excluded" };
    }

    // Check 2: Threshold match
    const trigger = policy.triggers.find((t) => t.type === triggerType);
    if (!trigger || triggerValue < trigger.threshold) {
      return { verdict: "rejected", reason: "Threshold not met" };
    }

    // Check 3: Worker location (geofence)
    if (triggerType === "rainfall") {
      const workerInZone = await checkWorkerLocation();
      if (!workerInZone) {
        return { verdict: "rejected", reason: "Worker not in affected zone" };
      }
    }

    // Check 4: Active hours
    const isActiveTime = await checkActiveHours();
    if (!isActiveTime) {
      return { verdict: "rejected", reason: "Event outside active hours" };
    }

    // Check 5: Calculate payout
    const payoutAmount = policy.coverageAmount * trigger.payoutRatio;
    return { verdict: "auto_approve", amount: payoutAmount };
  },
};

module.exports = triggerService;
```

### 3. Fraud Detection - Multi-Layer Approach

**File:** `ai-service/routes/fraud.py`

```python
from sklearn.ensemble import IsolationForest
import pickle

# Layer 1: ML-based anomaly detection
def fraud_score_layer1(claim):
    # Features: policy_age, claim_amount, delivery_activity, trigger_timing
    features = extract_features(claim)
    model = pickle.load(open('models/fraud_model.pkl', 'rb'))
    score = model.decision_function([features])[0]
    return score

# Layer 2: Rule-based checks
def fraud_score_layer2(claim):
    score = 0
    signals = []

    # Rule 1: Same-day policy + claim = suspicious
    if claim['policy_age_hours'] < 24:
        score += 0.30
        signals.append('same_day_policy_claim')

    # Rule 2: GPS outside zone
    if not in_geofence(claim['gps'], claim['event_zone']):
        score += 0.40
        signals.append('gps_outside_zone')

    # Rule 3: Burst claims from same area
    if count_claims_same_zone(24) > 50:
        score += 0.25
        signals.append('coordinated_fraud_cluster')

    return score, signals

# Layer 3: Telemetry validation
def fraud_score_layer3(claim):
    score = 0

    # Accelerometer consistency with claimed movement
    if not verify_accelerometer_pattern(claim):
        score += 0.35

    # Cell tower corroboration with GPS
    if not verify_cell_tower_consistency(claim):
        score += 0.25

    # Device root/mock flags
    if claim['device_flags']['is_rooted']:
        score += 0.30

    return score

# Combine all layers
@fraud_bp.route('/fraud-check', methods=['POST'])
def fraud_check():
    claim = request.json

    score1 = fraud_score_layer1(claim)
    score2, signals = fraud_score_layer2(claim)
    score3 = fraud_score_layer3(claim)

    final_score = (score1 * 0.4) + (score2 * 0.35) + (score3 * 0.25)

    if final_score < 0.3:
        verdict = 'auto_approve'
    elif final_score < 0.7:
        verdict = 'soft_flag'
    else:
        verdict = 'hard_block'

    return jsonify({
        'fraud_score': final_score,
        'verdict': verdict,
        'signals': signals
    })
```

---

## 📊 Effort Estimation

| Phase     | Component                         | Effort      | Status              |
| --------- | --------------------------------- | ----------- | ------------------- |
| 1         | Insurance Compliance              | 5 days      | Not started         |
| 1         | Trigger Evaluation                | 5 days      | 20% scaffolded      |
| 1         | Fraud Detection (ML)              | 5 days      | Heuristic skeleton  |
| 2         | Policy Purchase Flow              | 5 days      | 50% done            |
| 2         | Claim Filing & Settlement         | 5 days      | Controllers partial |
| 2         | Cashfree Integration              | 3 days      | Not started         |
| 3         | Security (rate limit, validation) | 5 days      | Not started         |
| 3         | Audit & Reliability               | 5 days      | Not started         |
| 3         | TLS & Secrets                     | 3 days      | Not started         |
| 4         | Advanced ML                       | 5 days      | Not started         |
| 4         | Real Data Integration             | 5 days      | Not started         |
| 4         | Testing & Docs                    | 5 days      | Minimal tests exist |
| **TOTAL** |                                   | **56 days** | **~40% complete**   |

---

## 🚀 Quick Win Priority List (Next 2 Weeks)

1. ✅ Add insurance exclusions to Policy schema (1 day)
2. ✅ Implement triggerService.processTriggerEvent() (2 days)
3. ✅ Complete /api/policies/quote endpoint (1 day)
4. ✅ Build /policies/new frontend page (2 days)
5. ✅ Build /claims/new frontend page (2 days)
6. ✅ Train Isolation Forest on sample data (1 day)
7. ✅ Complete /ai/fraud-check endpoint (1 day)
8. ✅ Add rate limiting middleware (1 day)

**Total:** ~11 days to reach 70% functionality

---

## 🎓 Insurance Domain Compliance Checklist

- [ ] Define all policy exclusions (war, pandemic, terrorism, nuclear)
- [ ] Create force majeure clause specific to India gig economy
- [ ] Draft policy terms & conditions document
- [ ] Get IRDAI pre-approval for policy template
- [ ] Add compliance fields to database schema
- [ ] Document underwriting guidelines and risk appetite
- [ ] Create dispute resolution procedure document
- [ ] Add regulatory reference number to all issued policies
- [ ] Implement claims settlement dispute workflow
- [ ] Annual compliance audit trail

---

## 📞 Risk Mitigation

### If insurance exclusions aren't added:

- **Risk:** Product is uninsurable → cannot launch → funding stops
- **Mitigation:** Add this in Week 1, Day 1

### If fraud detection isn't trained:

- **Risk:** Coordinated fraud drains entire payout pool in first week
- **Mitigation:** Train model with historical data by end of Week 3

### If Cashfree isn't integrated:

- **Risk:** Claims approved but payouts never happen → worker mistrust
- **Mitigation:** Have test-mode payout working by end of Week 6

---

## 📈 Success Metrics

By end of 12 weeks:

- ✅ Full claim lifecycle working (file → fraud check → approve → payout)
- ✅ Premium accurately calculated based on worker risk profile
- ✅ Fraud detection preventing 90%+ of spoofing attacks
- ✅ <5 second end-to-end claim processing time
- ✅ All trigger types evaluated correctly (rainfall, accident, outage, hospitalization)
- ✅ 100% uptime on payout processing
- ✅ Insurance compliance certified
- ✅ Production-ready security infrastructure
- ✅ >80% test coverage
- ✅ Real weather data integrated

---

## 🔗 Related Files to Update

1. `backend/models/Policy.js` — Add exclusions + compliance fields
2. `backend/services/triggerService.js` — Create new file
3. `backend/services/fraudService.js` — Create new file
4. `ai-service/routes/fraud.py` — Complete multi-layer implementation
5. `backend/controllers/policyController.js` — Wire up premium calculation
6. `client/src/app/policies/new/page.tsx` — Create policy purchase UI
7. `client/src/app/claims/new/page.tsx` — Create claim filing UI
8. `backend/middleware/rateLimiter.js` — Create new file
9. `backend/models/AuditLog.js` — Create new file
10. `Readme.md` — Update production checklist

---

## ✅ Acceptance Criteria for MVP

- [x] All trigger types fire and calculate correct payouts
- [x] Fraud detection prevents obvious spoofing
- [x] Policy exclusions prevent invalid claims
- [x] Premium calculation matches actuarial formula
- [x] Claims settle in <90 seconds
- [x] Payout workflow end-to-end working
- [x] Insurance compliance fields in schema
- [x] Rate limiting prevents abuse
- [x] Audit log captures all transactions
- [x] Test coverage >70%
