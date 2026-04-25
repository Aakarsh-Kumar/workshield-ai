'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PolicyScoreCardProps {
  score?: number;
  className?: string;
}

/**
 * Determines the tier and styling for a policy score
 * Score ranges: 0-1000
 * Excellent: 850+
 * Good: 750-849
 * Fair: 650-749
 * Poor: 550-649
 * Very Poor: <550
 */
export function getPolicyScoreTier(score: number = 700) {
  if (score >= 850) return { tier: 'Excellent', color: 'bg-slate-900', textColor: 'text-slate-900', borderColor: 'border-slate-200' };
  if (score >= 750) return { tier: 'Good', color: 'bg-slate-900', textColor: 'text-slate-900', borderColor: 'border-slate-200' };
  if (score >= 650) return { tier: 'Fair', color: 'bg-slate-900', textColor: 'text-slate-900', borderColor: 'border-slate-200' };
  if (score >= 550) return { tier: 'Watchlist', color: 'bg-slate-900', textColor: 'text-slate-900', borderColor: 'border-slate-200' };
  return { tier: 'Critical', color: 'bg-slate-900', textColor: 'text-slate-900', borderColor: 'border-slate-200' };
}

export function PolicyScoreCard({ score = 700, className = '' }: PolicyScoreCardProps) {
  const { tier, color, textColor, borderColor } = getPolicyScoreTier(score);
  const percentage = (score / 1000) * 100;

  return (
    <Card className={`ws-card border-0 ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">Policy score</CardTitle>
            <CardDescription className="mt-1 text-sm text-slate-600">
              Updates based on approvals, rejections, and review outcomes.
            </CardDescription>
          </div>
          <span className={`rounded-full ${color} px-2.5 py-1 text-xs font-semibold text-white`}>
            {tier}
          </span>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-semibold ${textColor}`}>{score}</span>
            <span className="text-sm text-slate-500">/ 1000</span>
          </div>
          <p className="text-xs text-slate-500">{getScoreDescription(score)}</p>
        </div>

        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-slate-900" style={{ width: `${percentage}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-slate-500">
            <span>0</span>
            <span>1000</span>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-600">
          Higher scores generally unlock smoother approvals and better pricing bands.
        </p>
      </CardContent>
    </Card>
  );
}

function getScoreDescription(score: number): string {
  if (score >= 850) {
    return 'Excellent! Your claim approval history is outstanding. You qualify for better premiums and terms.';
  } else if (score >= 750) {
    return 'Good standing. Your claims are being approved consistently. Keep up the great work!';
  } else if (score >= 650) {
    return 'Fair score. Work on filing accurate claims to improve your position.';
  } else if (score >= 550) {
    return 'Low score. Consider reviewing past claim issues and filing more carefully.';
  } else {
    return 'Very low score. Your recent claims have had significant issues. We recommend careful documentation in future claims.';
  }
}
