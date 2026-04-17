import { Badge } from '@/components/ui/badge';

const STATUS_THEME: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  under_review: 'bg-orange-100 text-orange-800 border-orange-200',
  soft_flag: 'bg-orange-100 text-orange-800 border-orange-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-rose-100 text-rose-800 border-rose-200',
  hard_block: 'bg-rose-100 text-rose-800 border-rose-200',
  provider_success: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  callback_confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  retry_scheduled: 'bg-amber-100 text-amber-800 border-amber-200',
  failed_terminal: 'bg-rose-100 text-rose-800 border-rose-200',
  failed_transient: 'bg-orange-100 text-orange-800 border-orange-200',
  conflict: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  verified: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  manual_review: 'bg-orange-100 text-orange-800 border-orange-200',
  threshold_not_met: 'bg-amber-100 text-amber-800 border-amber-200',
  evidence_pending: 'bg-slate-100 text-slate-700 border-slate-200',
  blocked: 'bg-rose-100 text-rose-800 border-rose-200',
  not_scored: 'bg-slate-100 text-slate-700 border-slate-200',
  cleared: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  review_hold: 'bg-orange-100 text-orange-800 border-orange-200',
  ready: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  not_ready: 'bg-slate-100 text-slate-700 border-slate-200',
};

export function StatusChip({ status }: { status: string }) {
  const normalized = String(status || 'pending').toLowerCase();
  const label = normalized.replaceAll('_', ' ');
  const style = STATUS_THEME[normalized] || 'bg-slate-100 text-slate-700 border-slate-200';

  return <Badge className={`border text-xs capitalize ${style}`}>{label}</Badge>;
}
