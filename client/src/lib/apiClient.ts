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
  remarks?: string;
  createdAt: string;
}

export interface PremiumPrediction {
  premium: number;
  currency: string;
  breakdown: Record<string, unknown>;
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
};

export default apiClient;
