import { getToken } from './auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const AI_BASE = process.env.NEXT_PUBLIC_AI_BASE ?? '/ai';

// ── Types ──────────────────────────────────────────────────────────────────────

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
  triggerType: 'rainfall' | 'vehicle_accident' | 'platform_outage' | 'hospitalization';
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
}

export interface PremiumPrediction {
  premium: number;
  currency: string;
  breakdown: Record<string, unknown>;
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
    healthCheckMs: number;
    reconciliationMs: number;
    batchLimit: number;
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
  lastError?: {
    code?: string;
    message?: string;
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

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

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

// ── API client ────────────────────────────────────────────────────────────────

const apiClient = {
  // ── Auth ──────────────────────────────────────────────────────────────────

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

  // ── Policies ──────────────────────────────────────────────────────────────

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

  getQuote: (weeklyDeliveries: number, platform: string, riskScore = 0.5) =>
    request<{ success: boolean; premium: number; currency: string }>(
      `${API_BASE}/policies/quote`,
      { method: 'POST', body: JSON.stringify({ weeklyDeliveries, platform, riskScore }) },
    ),

  // ── Claims ────────────────────────────────────────────────────────────────

  getClaims: (status?: string) =>
    request<{ success: boolean; claims: Claim[] }>(
      `${API_BASE}/claims${status ? `?status=${status}` : ''}`,
    ),

  getClaim: (id: string) =>
    request<{ success: boolean; claim: Claim }>(`${API_BASE}/claims/${id}`),

  createClaim: (payload: {
    policyId: string;
    triggerType: string;
    triggerValue: number;
    documents?: string[];
  }) =>
    request<{ success: boolean; claim: Claim }>(
      `${API_BASE}/claims`,
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  // ── AI Service (via NGINX /ai proxy) ──────────────────────────────────────
  // Frontend calls /ai/predict → NGINX strips /ai prefix → Flask sees /predict

  predictPremium: (weeklyDeliveries: number, platform: string, riskScore: number) =>
    request<PremiumPrediction>(
      `${AI_BASE}/predict`,
      {
        method: 'POST',
        body: JSON.stringify({ weekly_deliveries: weeklyDeliveries, platform, risk_score: riskScore }),
      },
    ),

  // ── Team 2 Ops (admin only) ─────────────────────────────────────────────

  getTeam2OpsSummary: () =>
    request<{ success: boolean; summary: Team2OpsSummary }>(`${API_BASE}/team2/ops/summary`),

  getTeam2SchedulerStatus: () =>
    request<{ success: boolean; scheduler: Team2SchedulerStatus }>(`${API_BASE}/team2/ops/scheduler`),

  runTeam2PayoutCycle: (limit = 50) =>
    request<{ success: boolean; scanned: number; summary: Record<string, number> }>(
      `${API_BASE}/team2/payouts/run`,
      {
        method: 'POST',
        body: JSON.stringify({ limit }),
      },
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

  getTeam2ReviewQueue: (limit = 50) =>
    request<{ success: boolean; queue: Claim[] }>(`${API_BASE}/team2/review-queue?limit=${limit}`),

  decideTeam2Review: (
    claimId: string,
    payload: { action: 'approve' | 'reject'; approvedAmount?: number; remarks?: string },
  ) =>
    request<{ success: boolean; claim: Claim }>(
      `${API_BASE}/team2/review/${claimId}/decision`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
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
};

export default apiClient;
