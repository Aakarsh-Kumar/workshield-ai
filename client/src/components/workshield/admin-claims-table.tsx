'use client';

import { Fragment, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { StatusChip } from './status-chip';

export type AdminClaimRow = {
  id: string;
  triggerType: string;
  verificationState?: string;
  status: string;
  amount: number;
  fraudScore: number | null;
  fraudModelVersion?: string;
  reasonCode?: string;
  updatedAt?: string;
  source: 'review' | 'payout' | 'claim';
  attemptCount?: number;
  providerReference?: string;
  workerLabel?: string;
};

type TabKey = 'all' | 'flagged' | 'approved';

function isFlagged(status: string) {
  return ['under_review', 'soft_flag', 'hard_block', 'failed_terminal', 'failed_transient', 'conflict'].includes(status);
}

function isApproved(status: string) {
  return ['approved', 'paid', 'provider_success', 'callback_confirmed'].includes(status);
}

const SIMPLE_TRIGGER_LABEL: Record<string, string> = {
  rainfall: 'Rain',
  platform_outage: 'App down',
  traffic_congestion: 'Traffic',
  vehicle_accident: 'Accident',
  hospitalization: 'Hospital',
};

export function AdminClaimsTable({
  rows,
  loading,
  onOpen,
}: {
  rows: AdminClaimRow[];
  loading: boolean;
  onOpen: (id: string) => void;
}) {
  const [tab, setTab] = useState<TabKey>('all');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = rows;
    if (tab === 'flagged') result = result.filter((row) => isFlagged(row.status));
    if (tab === 'approved') result = result.filter((row) => isApproved(row.status));

    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter((row) => {
        const trigger = SIMPLE_TRIGGER_LABEL[row.triggerType] || row.triggerType;
        return (
          row.id.toLowerCase().includes(q)
          || trigger.toLowerCase().includes(q)
          || row.status.toLowerCase().includes(q)
          || String(row.reasonCode || '').toLowerCase().includes(q)
        );
      });
    }

    return result;
  }, [rows, tab, query]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-slate-900">Claims needing attention</h3>
          <p className="text-xs text-slate-500">Open a claim to review evidence and record one final decision.</p>
          <div className="flex flex-wrap gap-2">
            <TabButton active={tab === 'all'} onClick={() => setTab('all')} label="All" />
            <TabButton active={tab === 'flagged'} onClick={() => setTab('flagged')} label="Flagged" />
            <TabButton active={tab === 'approved'} onClick={() => setTab('approved')} label="Approved" />
          </div>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search claim"
          className="h-9 w-48 rounded-lg border border-slate-300 px-3 text-sm text-slate-700 outline-none transition focus:border-slate-500"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
              <th className="px-4 py-3">Claim</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Verification</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1, 2, 3, 4].map((i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-4 py-3" colSpan={7}>
                    <div className="h-7 w-full animate-pulse rounded bg-slate-100" />
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>No claims found</td>
              </tr>
            ) : (
              filtered.map((row) => {
                const expanded = expandedId === row.id;

                return (
                  <Fragment key={row.id}>
                    <tr className="border-t border-slate-100 hover:bg-slate-50/70">
                      <td className="px-4 py-3 align-top">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : row.id)}
                          className="text-left"
                        >
                          <p className="font-medium text-slate-900">{row.id.slice(-8)}</p>
                          <p className="text-xs text-slate-500">
                            {row.source === 'review' ? 'Manual review' : row.source === 'claim' ? (row.workerLabel || 'Latest claim') : 'Payout stream'}
                          </p>
                        </button>
                      </td>
                      <td className="px-4 py-3 align-top text-slate-700">{SIMPLE_TRIGGER_LABEL[row.triggerType] || row.triggerType}</td>
                      <td className="px-4 py-3 align-top">
                        <StatusChip status={row.verificationState || 'pending'} />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${riskTone(row.fraudScore)}`}>
                          {row.fraudScore == null || !row.fraudModelVersion ? 'NA' : row.fraudScore.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top"><StatusChip status={row.status} /></td>
                      <td className="px-4 py-3 align-top text-slate-700">INR {row.amount.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex gap-1">
                          <Button size="sm" className="h-8 px-2 text-xs" onClick={() => onOpen(row.id)}>
                            {row.source === 'review' ? 'Review claim' : 'Open'}
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => setExpandedId(expanded ? null : row.id)}>
                            {expanded ? 'Hide' : 'Quick view'}
                          </Button>
                        </div>
                      </td>
                    </tr>

                    {expanded && (
                      <tr className="border-t border-slate-100 bg-slate-50/60">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                            <InfoBox label="Reason code" value={row.reasonCode || 'NA'} />
                            <InfoBox label="Attempt count" value={String(row.attemptCount || 0)} />
                            <InfoBox label="Provider ref" value={row.providerReference || 'NA'} />
                            <InfoBox label="Updated" value={row.updatedAt ? new Date(row.updatedAt).toLocaleString('en-IN') : 'NA'} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
    >
      {label}
    </button>
  );
}

function riskTone(score: number | null) {
  if (score == null) return 'bg-slate-100 text-slate-600';
  if (score >= 0.7) return 'bg-rose-100 text-rose-700';
  if (score >= 0.3) return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 truncate font-medium text-slate-700">{value}</p>
    </div>
  );
}
