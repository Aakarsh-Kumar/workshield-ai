import { getToken } from './auth';

function resolveServiceBase(envValue: string | undefined, fallbackPath: '/api' | '/ai') {
  const configuredBase = envValue?.trim();

  if (!configuredBase) {
    return fallbackPath;
  }

  if (typeof window !== 'undefined') {
    try {
      const currentOrigin = window.location.origin;
      const targetUrl = new URL(configuredBase, currentOrigin);
      const isConfiguredLocalhost = ['localhost', '127.0.0.1'].includes(targetUrl.hostname);
      const isCurrentLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

      if (isConfiguredLocalhost && !isCurrentLocalhost) {
        return fallbackPath;
      }
    } catch {
      return fallbackPath;
    }
  }

  return configuredBase;
}

const API_BASE = resolveServiceBase(process.env.NEXT_PUBLIC_API_BASE, '/api');
const AI_BASE = resolveServiceBase(process.env.NEXT_PUBLIC_AI_BASE, '/ai');

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  platform: 'swiggy' | 'zomato' | 'blinkit' | 'dunzo' | 'other';
  weeklyDeliveries: number;
  riskScore: number;
  kycVerified: boolean;
  role: 'worker' | 'admin';
}

export interface Policy {
  _id: string;
  policyNumber: string;
  type: 'weekly' | 'daily';
  coverageAmount: number;
  premium: number;
  status: 'active' | 'expired' | 'cancelled' | 'claimed';
  startDate: string;
  endDate: string;
  platform: string;
  aiRiskScore: number;
  triggers: Array<{
    type: string;
    threshold: number;
    payoutRatio: number;
  }>;
  createdAt: string;
}

export interface Claim {
  _id: string;
  policyId: string | Policy;
  userId?: string | {
    _id: string;
    name?: string;
    email?: string;
    platform?: string;
  };
  triggerType: 'rainfall' | 'vehicle_accident' | 'platform_outage' | 'hospitalization' | 'traffic_congestion';
  triggerValue: number;
  claimAmount: number;
  approvedAmount?: number;
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'paid';
  fraudScore: number;
  isFraudulent: boolean;
  fraudVerdict?: 'auto_approve' | 'soft_flag' | 'hard_block';
  fraudSignals?: string[];
  fraudModelVersion?: string;
  reasonCode?: string;
  reasonDetail?: string;
  settlementStatus?: 'pending' | 'approved' | 'soft_flag' | 'hard_block' | 'paid';
  payoutEligibility?: boolean;
  evaluationMeta?: Record<string, unknown>;
  responseContractVersion?: string;
  remarks?: string;
  processedAt?: string;
  createdAt: string;
  documents?: Array<{
    content_base64?: string;
    mime_type?: string;
    file_name?: string;
  }>;
  verificationState?: 'verified' | 'manual_review' | 'blocked' | 'threshold_not_met' | 'evidence_pending';
  fraudState?: 'not_scored' | 'cleared' | 'soft_flag' | 'hard_block';
  payoutState?: 'paid' | 'ready' | 'review_hold' | 'blocked' | 'not_ready';
  reviewerReasons?: Array<{
    type: string;
    label: string;
    detail: string;
    code?: string;
  }>;
  reviewerPlaybook?: Array<{
    id: string;
    step: string;
  }>;
  fraudTimeline?: Array<{
    id: string;
    stage: string;
    at?: string;
    title: string;
    detail: string;
  }>;
  lifecycle?: {
    eventVerification: string;
    fraudReview: string;
    payoutOrchestration: string;
  };
}

export interface ClaimDocumentPayload {
  content_base64: string;
  mime_type: string;
  file_name?: string;
}

export interface PremiumPrediction {
  premium: number;
  currency: string;
  breakdown: Record<string, unknown>;
}

export interface HazardZoneSummary {
  zoneId: string;
  name: string;
  city?: string;
  notes?: string;
  hazardType: 'FLOOD' | 'CYCLONE' | 'HEATWAVE' | 'LANDSLIDE';
  riskMultiplier: number;
  isActive: boolean;
  boundary?: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: unknown;
  };
  updatedAt?: string;
  createdAt?: string;
}

export interface PremiumQuote {
  success: boolean;
  premium: number;
  currency: string;
  locationRiskMultiplier: number;
  hazardZonesDetected: Array<{
    zoneId: string;
    hazardType: string;
    name: string;
  }>;
  note?: string;
}

export interface ZoneValidationResult {
  success: boolean;
  inZone: boolean | null;
  pingCount: number;
  matchedPing?: {
    _id: string;
    timestamp: string;
    accuracy: number;
    location: {
      type: 'Point';
      coordinates: [number, number];
    };
  } | null;
}

export interface LocationPingCountResult {
  success: boolean;
  pingCount: number;
  timeWindow: {
    start: string;
    end: string;
  };
}

export interface HazardEventResult {
  zoneId: string;
  triggerType: string;
  triggerValue: number;
  workersFound: number;
  workersWithPolicies: number;
  claimsCreated: number;
  claimsSkipped: number;
  errors: number;
  details: Array<{
    workerId: string | null;
    policyId: string | null;
    claimId: string | null;
    status: string;
    reason?: string;
    claimAmount?: number;
    settlementStatus?: string;
  }>;
}

export interface Team2OpsSummary {
  generatedAt: string;
  settlement: Record<string, number>;
  verdict: Record<string, number>;
  payoutAttempts: Record<string, number>;
  manualReviewQueueCount: number;
}

export interface Team2SchedulerStatus {
  enabled: boolean;
  started: boolean;
  startedAt: string | null;
  intervals: {
    payoutCycleMs: number;
    stalePendingRescoringMs?: number;
    healthCheckMs: number;
    reconciliationMs: number;
    batchLimit: number;
    stalePendingBatchLimit?: number;
    stalePendingAgeHours?: number;
  };
}

export interface Team2PayoutAttempt {
  _id: string;
  claimId?: {
    _id?: string;
    claimAmount?: number;
    approvedAmount?: number;
    settlementStatus?: string;
    payoutEligibility?: boolean;
    reasonCode?: string;
    reasonDetail?: string;
  };
  idempotencyKey: string;
  status: string;
  attemptCount: number;
  providerReference?: string;
  providerMode?: string;
  nextRetryAt?: string;
  updatedAt: string;
  timeline?: Array<{
    at?: string;
    event: string;
    detail?: Record<string, unknown>;
  }>;
  lastError?: {
    code?: string;
    message?: string;
  };
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
  timestamp: string;
}

export interface Team2ManualReviewAction {
  _id: string;
  action: 'approve' | 'reject';
  reason?: string;
  approvedAmount?: number;
  actorUserLabel?: string;
  createdAt: string;
  snapshot?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    reasonCode?: string;
    reasonDetail?: string;
  };
}

export interface Team2AuditLog {
  _id: string;
  actorUserId?: string | null;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  method: string;
  path: string;
  statusCode: number;
  success: boolean;
  latencyMs?: number;
  createdAt: string;
}

export interface Team2BackfillResult {
  success: boolean;
  requestedStatuses?: string[];
  scanned: number;
  rescored: number;
  errors: number;
  results: Array<{
    claimId: string;
    status: string;
    settlementStatus?: string;
    fraudScore?: number;
    verdict?: string;
    message?: string;
  }>;
}

export interface Team2AdminClaimDetail {
  success: boolean;
  claim: Claim;
  payoutAttempt: Team2PayoutAttempt | null;
  manualReviewActions: Team2ManualReviewAction[];
}

export interface ChatMessagePayload {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatAssistantResponse {
  reply: string;
  suggested_actions: string[];
  model: string;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const payload = data as Record<string, unknown> | null;
    const reasonDetail = payload?.reasonDetail;
    const reasonCode = payload?.reasonCode;
    const message = payload?.message
      ?? (typeof reasonDetail === 'string' ? reasonDetail : undefined)
      ?? (typeof reasonCode === 'string' ? `Request blocked: ${reasonCode}` : undefined)
      ?? `Request failed: ${res.status}`;

    throw new Error(message as string);
  }

  return data as T;
}

const apiClient = {
  login: (email: string, password: string) =>
    request<{ success: boolean; token: string; user: User }>(
      `${API_BASE}/auth/login`,
      { method: 'POST', body: JSON.stringify({ email, password }) },
    ),

  register: (payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    platform: string;
    weeklyDeliveries: number;
  }) =>
    request<{ success: boolean; token: string; user: User }>(
      `${API_BASE}/auth/register`,
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  getMe: () =>
    request<{ success: boolean; user: User }>(`${API_BASE}/auth/me`),

  getPolicies: (status?: string) =>
    request<{ success: boolean; policies: Policy[] }>(
      `${API_BASE}/policies${status ? `?status=${status}` : ''}`,
    ),

  getPolicy: (id: string) =>
    request<{ success: boolean; policy: Policy }>(`${API_BASE}/policies/${id}`),

  createPolicy: (payload: {
    type: 'weekly' | 'daily';
    coverageAmount: number;
    triggerConfig?: Array<{ type: string; threshold: number; payoutRatio: number }>;
  }) =>
    request<{ success: boolean; policy: Policy }>(
      `${API_BASE}/policies`,
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  getQuote: (weeklyDeliveries: number, platform: string, coverageAmount: number, riskScore = 0.5) =>
    request<PremiumQuote>(
      `${API_BASE}/policies/quote`,
      { method: 'POST', body: JSON.stringify({ weeklyDeliveries, platform, coverageAmount, riskScore }) },
    ),

  getClaims: (status?: string) =>
    request<{ success: boolean; claims: Claim[] }>(
      `${API_BASE}/claims${status ? `?status=${status}` : ''}`,
    ),

  getAdminClaims: (status?: string) => {
    const query = new URLSearchParams({ scope: 'all' });
    if (status) query.set('status', status);
    return request<{ success: boolean; claims: Claim[] }>(`${API_BASE}/claims?${query.toString()}`);
  },

  getClaim: (id: string) =>
    request<{ success: boolean; claim: Claim }>(`${API_BASE}/claims/${id}`),

  createClaim: (payload: {
    policyId: string;
    triggerType: string;
    triggerValue?: number;
    documents?: ClaimDocumentPayload[];
    eventPolygon?: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
    timeWindow?: { start: string; end: string };
    weatherLookup?: { latitude: number; longitude: number; observedAt?: string };
  }) =>
    request<{ success: boolean; claim: Claim }>(
      `${API_BASE}/claims`,
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  predictPremium: (weeklyDeliveries: number, platform: string, riskScore: number) =>
    request<PremiumPrediction>(
      `${AI_BASE}/predict`,
      {
        method: 'POST',
        body: JSON.stringify({ weekly_deliveries: weeklyDeliveries, platform, risk_score: riskScore }),
      },
    ),

  chatAssistant: (payload: {
    messages: ChatMessagePayload[];
    user_context?: Record<string, unknown>;
    intent_context?: Record<string, unknown>;
  }) =>
    request<ChatAssistantResponse>(
      `${AI_BASE}/chat`,
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  getTeam2OpsSummary: () =>
    request<{ success: boolean; summary: Team2OpsSummary }>(`${API_BASE}/team2/ops/summary`),

  getTeam2SchedulerStatus: () =>
    request<{ success: boolean; scheduler: Team2SchedulerStatus }>(`${API_BASE}/team2/ops/scheduler`),

  runTeam2PayoutCycle: (limit = 50) =>
    request<{ success: boolean; scanned: number; summary: Record<string, number> }>(
      `${API_BASE}/team2/payouts/run`,
      { method: 'POST', body: JSON.stringify({ limit }) },
    ),

  runTeam2Reconciliation: () =>
    request<{
      success: boolean;
      summary: {
        generatedAt: string;
        staleProviderSuccess: number;
        retryOverdue: number;
        conflictCount: number;
        failedTerminal24h: number;
      };
    }>(`${API_BASE}/team2/ops/reconcile`, { method: 'POST', body: JSON.stringify({}) }),

  runTeam2FraudBackfill: (payload: {
    limit?: number;
    settlementStatuses?: string[];
    unscoredOnly?: boolean;
    olderThanHours?: number;
  } = {}) =>
    request<Team2BackfillResult>(
      `${API_BASE}/team2/ops/backfill-fraud`,
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  getTeam2ClaimDetail: (id: string) =>
    request<Team2AdminClaimDetail>(`${API_BASE}/team2/claims/${id}`),

  getTeam2ReviewQueue: (limit = 50) =>
    request<{ success: boolean; queue: Claim[] }>(`${API_BASE}/team2/review-queue?limit=${limit}`),

  decideTeam2Review: (
    claimId: string,
    payload: { action: 'approve' | 'reject'; approvedAmount?: number; remarks?: string },
  ) =>
    request<{ success: boolean; claim: Claim }>(
      `${API_BASE}/team2/review/${claimId}/decision`,
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  getTeam2PayoutAttempts: (status?: string, limit = 50) => {
    const query = new URLSearchParams();
    if (status) query.set('status', status);
    query.set('limit', String(limit));
    return request<{ success: boolean; attempts: Team2PayoutAttempt[] }>(
      `${API_BASE}/team2/payouts/attempts?${query.toString()}`,
    );
  },

  getTeam2AuditLogs: (limit = 50, action?: string) => {
    const query = new URLSearchParams();
    query.set('limit', String(limit));
    if (action) query.set('action', action);
    return request<{ success: boolean; logs: Team2AuditLog[] }>(
      `${API_BASE}/team2/ops/audit-logs?${query.toString()}`,
    );
  },

  // ── Chat ─────────────────────────────────────────────────────────────────

  getChatHistory: () =>
    request<{ success: boolean; messages: ChatMessage[] }>(`${API_BASE}/chat/history`),

  sendMessage: (message: string) =>
    request<{ success: boolean; reply: string }>(
      `${API_BASE}/chat/message`,
      { method: 'POST', body: JSON.stringify({ message }) },
    ),

  listHazardZones: (filters?: { hazardType?: string; isActive?: boolean }) => {
    const query = new URLSearchParams();
    if (filters?.hazardType) query.set('hazardType', filters.hazardType);
    if (filters?.isActive !== undefined) query.set('isActive', String(filters.isActive));
    return request<{ success: boolean; zones: HazardZoneSummary[] }>(
      `${API_BASE}/location/hazard-zones${query.toString() ? `?${query.toString()}` : ''}`,
    );
  },

  upsertHazardZone: (payload: {
    zoneId: string;
    name: string;
    hazardType: HazardZoneSummary['hazardType'];
    boundary: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
    riskMultiplier?: number;
    isActive?: boolean;
    city?: string;
    notes?: string;
  }) =>
    request<{ success: boolean; zone: HazardZoneSummary }>(
      `${API_BASE}/location/hazard-zones`,
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  validateWorkerZone: (payload: {
    workerId: string;
    eventPolygon: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
    timeWindow: { start: string; end: string };
  }) =>
    request<ZoneValidationResult>(
      `${API_BASE}/location/validate-zone`,
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  processHazardEvent: (payload: {
    zoneId: string;
    triggerType: Claim['triggerType'];
    triggerValue: number;
    timeWindow: { start: string; end: string };
    eventMeta?: Record<string, unknown>;
  }) =>
    request<{ success: boolean; result: HazardEventResult }>(
      `${API_BASE}/location/hazard-event`,
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  getLocationPingCount: (start: string, end: string) => {
    const query = new URLSearchParams({ start, end });
    return request<LocationPingCountResult>(`${API_BASE}/location/pings/count?${query.toString()}`);
  },
};

export default apiClient;
