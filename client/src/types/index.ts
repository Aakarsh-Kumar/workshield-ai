// Central type definitions for WorkShield AI frontend.
// Import from here instead of re-defining types across components.
// Re-exported from apiClient so there is a single source of truth.

export type { User, Policy, Claim, PremiumPrediction } from '@/lib/apiClient';

// ── UI-level types ─────────────────────────────────────────────────────────

export interface MatchProfile {
  id: string;
  name: string;
  platform: string;
  weeklyDeliveries: number;
  riskScore: number;
  suggestedPremium: number;
  coverageAmount: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export type TriggerType =
  | 'rainfall'
  | 'vehicle_accident'
  | 'platform_outage'
  | 'hospitalization';

export type PolicyStatus = 'active' | 'expired' | 'cancelled' | 'claimed';
export type ClaimStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'paid';
export type Platform = 'swiggy' | 'zomato' | 'blinkit' | 'dunzo' | 'other';
