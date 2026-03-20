# WorkShield AI

### Behavior-Aware Parametric Income Protection Platform for Gig Delivery Workers

---

## 1. Problem Definition

India’s gig delivery workforce operates on a high-frequency, low-margin income model where earnings are closely tied to time-of-day demand cycles and external environmental conditions.

Unlike salaried workers, delivery partners face:

- No guaranteed income floor
- High variability in earning windows
- Full exposure to external risks beyond their control

### Key Risk Categories

1. Environmental Risk
   Heavy rainfall, flooding, extreme heat, and hazardous air quality

2. Operational Risk
   Zone restrictions, curfews, roadblocks, and sudden demand drops

---

### Core Gap

Traditional insurance models are not suitable because:

- They rely on manual claims and verification
- Loss is difficult to validate objectively
- Processing time does not match daily income cycles

There is a need for a system that can detect loss events objectively and compensate workers in near real time.

---

## 2. Solution Overview

WorkShield AI is a parametric insurance platform designed to protect gig workers against income loss caused by external disruptions.

The system:

- Monitors real-time external data sources
- Evaluates predefined disruption conditions
- Calculates income loss algorithmically
- Triggers automatic payouts without manual claims

---

### Core Differentiation

The system incorporates behavioral earning patterns into both underwriting and claims processing. Payouts are aligned with actual working hours rather than generic daily averages.

---

## 3. Persona Modeling

### Primary Persona: PeakShift Rider

| Attribute              | Value                                        |
| ---------------------- | -------------------------------------------- |
| Work Type              | Part-time, peak-hour focused                 |
| Active Hours           | 12 PM to 3 PM, 6 PM to 11 PM                 |
| Income Distribution    | Approximately 65 percent during dinner hours |
| Average Daily Earnings | ₹500 to ₹800                                 |

---

### Underwriting Insight

Income is not evenly distributed throughout the day. A significant portion is concentrated during high-demand periods.

Risk exposure must therefore be modeled as a function of time-weighted earning potential rather than flat daily averages.

---

## 4. System Workflow

### Policy Lifecycle

1. Onboarding
   The user provides:
   - Location
   - Platform type
   - Working hours
   - Average earnings

2. Risk Profiling
   The system computes:
   - Probability of disruption
   - Time-based exposure

3. Premium Calculation
   A weekly premium is generated dynamically

4. Policy Activation
   Coverage begins immediately

---

### Real-Time Operations

External data is continuously ingested from:

- Weather sources
- Air quality data
- Zone restriction signals
- Simulated demand indicators

This data flows through:

1. Event normalization
2. Trigger evaluation
3. Loss estimation
4. Fraud validation
5. Payout execution

---

## 5. Weekly Premium Model

### Premium Structure

Weekly Premium (P) is defined as:

P = Expected Loss + Risk Loading + Operational Margin

Where:

- Expected Loss represents anticipated payouts
- Risk Loading accounts for variability and uncertainty
- Operational Margin ensures platform sustainability

---

### Expected Loss Calculation

Expected Loss is computed as:

E(L) = Sum of [Probability of Event × Impact of Event]

---

### Time-Weighted Exposure Model

Impact of an event is calculated as:

Impact = Hourly Income × Duration × Time Weight Factor

The Time Weight Factor reflects how critical a time slot is for earnings. Peak hours have higher weights.

---

### Example

| Parameter      | Value   |
| -------------- | ------- |
| Hourly income  | ₹100    |
| Event duration | 3 hours |
| Time weight    | 0.9     |

Impact = 100 × 3 × 0.9 = ₹270

---

### Final Premium Example

| Component     | Value |
| ------------- | ----- |
| Expected Loss | ₹22   |
| Risk Loading  | ₹6    |
| Margin        | ₹5    |

Final Premium = ₹33 per week

---

## 6. Parametric Trigger Framework

### Design Principles

Triggers are:

- Objective
- Measurable
- Independent of user input
- Resistant to manipulation

---

### Trigger Definitions

#### Rainfall Trigger

Activated when:

- Rainfall exceeds a defined threshold
- User location falls within the affected area
- Event occurs during the user’s active working hours

---

#### Heat Stress Trigger

Activated when:

- Temperature exceeds 42°C
- Air Quality Index exceeds 250

This assumes reduced working capacity and partial income loss.

---

#### Demand Collapse Trigger

Activated when:

- Order volume drops significantly, based on simulated platform data

This represents reduced earning opportunity despite availability.

---

#### Zone Restriction Trigger

Activated when:

- A location is flagged as restricted due to external conditions

This assumes full loss of working hours in that period.

---

## 7. Loss Estimation Engine

Loss is computed using:

Loss = Sum of (Hourly Income × Lost Hours × Time Weight)

This ensures:

- Accurate compensation
- No overpayment during inactive hours
- Alignment with actual earning behavior

---

## 8. AI and Machine Learning Integration

### Risk Prediction

A supervised learning model estimates the probability of disruption within a given week.

Inputs include:

- Historical weather patterns
- Location-based risk indicators
- Working hours

---

### Behavioral Modeling

The system learns:

- When the user typically works
- Which hours contribute most to earnings

This produces a time-weight profile used in both pricing and claims.

---

### Fraud Detection

A hybrid approach is used.

Machine learning:

- Isolation Forest to detect anomalous claim patterns

Rule-based checks:

- Location mismatch between user and event
- Claims without corresponding activity
- Repeated claims within short intervals

---

## 9. Adversarial Defense & Anti-Spoofing Strategy

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

## 10. Platform Choice

The system is designed as a mobile-first Progressive Web Application.

### Rationale

- Delivery workers primarily use mobile devices
- No installation barrier
- Works under low connectivity conditions
- Faster onboarding and accessibility

---

## 11. Technology Stack

Frontend:

- Next.js with PWA capabilities
- Tailwind CSS

Backend:

- Express.js

AI/ML:

- Python with Scikit-learn

Database:

- MongoDB or Supabase

Data Sources:

- Weather APIs
- Air quality APIs
- Simulated demand data

Payments:

- Cashfree in test mode

---

## 12. System Design Considerations

- Low latency trigger processing
- Idempotent payout handling
- Scalable event ingestion
- Audit logging for transparency and compliance

---

## 13. Conclusion

WorkShield AI introduces a parametric insurance framework tailored for gig workers by combining real-time data, behavioral modeling, and automated payouts.

The system ensures:

- Fair compensation
- Minimal user effort
- Scalable and transparent operations

---

## Final Proposition

This platform transforms insurance from a manual claims process into a real-time income protection system aligned with how gig workers actually earn.