'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import apiClient, {
  type Claim,
  type Team2AuditLog,
  type Team2OpsSummary,
  type Team2PayoutAttempt,
  type Team2SchedulerStatus,
} from '@/lib/apiClient';
import { clearToken, isAuthenticated } from '@/lib/auth';
import { useAppStore } from '@/store';
import { BarList } from '@/components/workshield/bar-list';
import { StatusChip } from '@/components/workshield/status-chip';
import { AdminClaimsTable, type AdminClaimRow } from '@/components/workshield/admin-claims-table';

const BACKFILL_TARGETS = [
  { value: 'pending', label: 'Pending' },
  { value: 'soft_flag', label: 'Review hold' },
  { value: 'hard_block', label: 'Blocked' },
  { value: 'approved', label: 'Approved' },
];

export default function Team2OpsPage() {
  const router = useRouter();
  const { currentUser, logout } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runningCycle, setRunningCycle] = useState(false);
  const [runningReconcile, setRunningReconcile] = useState(false);
  const [runningBackfill, setRunningBackfill] = useState(false);

  const [summary, setSummary] = useState<Team2OpsSummary | null>(null);
  const [scheduler, setScheduler] = useState<Team2SchedulerStatus | null>(null);
  const [reviewQueue, setReviewQueue] = useState<Claim[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [attempts, setAttempts] = useState<Team2PayoutAttempt[]>([]);
  const [auditLogs, setAuditLogs] = useState<Team2AuditLog[]>([]);

  const [selectedBackfillTargets, setSelectedBackfillTargets] = useState<string[]>(['pending']);
  const [includeScoredClaims, setIncludeScoredClaims] = useState(false);
  const [olderThanHours, setOlderThanHours] = useState(6);

  const ensureAccess = useCallback(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return false;
    }

    if (currentUser?.role !== 'admin') {
      toast.error('Admin access required');
      router.replace('/dashboard');
      return false;
    }

    return true;
  }, [currentUser?.role, router]);

  const load = useCallback(
    async (silent = false) => {
      if (!ensureAccess()) return;

      if (silent) setRefreshing(true);
      else setLoading(true);

      try {
        const [summaryRes, schedulerRes, queueRes, claimsRes, attemptsRes, auditRes] = await Promise.all([
          apiClient.getTeam2OpsSummary(),
          apiClient.getTeam2SchedulerStatus(),
          apiClient.getTeam2ReviewQueue(40),
          apiClient.getAdminClaims(),
          apiClient.getTeam2PayoutAttempts(undefined, 60),
          apiClient.getTeam2AuditLogs(25),
        ]);

        setSummary(summaryRes.summary);
        setScheduler(schedulerRes.scheduler);
        setReviewQueue(queueRes.queue);
        setClaims(claimsRes.claims);
        setAttempts(attemptsRes.attempts);
        setAuditLogs(auditRes.logs);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not load admin data');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [ensureAccess],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const statusBars = useMemo(() => {
    const pairs = Object.entries(summary?.payoutAttempts || {});
    return pairs.map(([key, value]) => ({
      id: key,
      label: key.replaceAll('_', ' '),
      value: Number(value),
      barClass: pickBarColor(key),
      trackClass: 'bg-slate-100',
    }));
  }, [summary?.payoutAttempts]);

  const claimRows = useMemo<AdminClaimRow[]>(() => {
    const fromClaims: AdminClaimRow[] = claims.map((claim) => {
      const worker = typeof claim.userId === 'object' && claim.userId ? claim.userId : null;

      return {
        id: claim._id,
        triggerType: claim.triggerType,
        verificationState: claim.verificationState,
        status: claim.settlementStatus || claim.status,
        amount: Number(claim.approvedAmount || claim.claimAmount || 0),
        fraudScore: claim.fraudScore ?? null,
        fraudModelVersion: claim.fraudModelVersion,
        reasonCode: claim.reasonCode,
        updatedAt: claim.processedAt || claim.createdAt,
        source: 'claim',
        workerLabel: worker?.name || worker?.email || 'Latest claim',
      };
    });

    const fromQueue: AdminClaimRow[] = reviewQueue.map((claim) => ({
      id: claim._id,
      triggerType: claim.triggerType,
      verificationState: claim.verificationState,
      status: claim.settlementStatus || claim.status,
      amount: Number(claim.claimAmount || 0),
      fraudScore: claim.fraudScore ?? null,
      fraudModelVersion: claim.fraudModelVersion,
      reasonCode: claim.reasonCode,
      updatedAt: claim.processedAt || claim.createdAt,
      source: 'review',
    }));

    const fromAttempts: AdminClaimRow[] = attempts.map((attempt) => {
      const claim = attempt.claimId;
      const claimId = claim?._id || attempt._id;
      const amount = Number(claim?.approvedAmount || claim?.claimAmount || 0);

      return {
        id: claimId,
        triggerType: 'rainfall',
        verificationState: undefined,
        status: attempt.status,
        amount,
        fraudScore: null,
        fraudModelVersion: undefined,
        reasonCode: claim?.reasonCode,
        updatedAt: attempt.updatedAt,
        source: 'payout',
        attemptCount: attempt.attemptCount,
        providerReference: attempt.providerReference,
      };
    });

    const dedup = new Map<string, AdminClaimRow>();
    [...fromAttempts, ...fromClaims, ...fromQueue].forEach((row) => {
      const existing = dedup.get(row.id);
      const priority = row.source === 'review' ? 3 : row.source === 'claim' ? 2 : 1;
      const existingPriority = existing ? (existing.source === 'review' ? 3 : existing.source === 'claim' ? 2 : 1) : 0;

      if (!existing || priority >= existingPriority) {
        dedup.set(row.id, row);
      }
    });

    return Array.from(dedup.values()).sort(
      (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
    );
  }, [attempts, claims, reviewQueue]);

  const fraudAlerts = useMemo(() => {
    return reviewQueue.filter((claim) => {
      const score = claim.fraudScore ?? 0;
      const status = claim.settlementStatus || claim.status;
      return score >= 0.7 || status === 'hard_block';
    });
  }, [reviewQueue]);

  const playbookGroups = useMemo(() => {
    const grouped = new Map<string, string[]>();
    [...reviewQueue, ...claims].forEach((claim) => {
      if (!Array.isArray(claim.reviewerPlaybook) || claim.reviewerPlaybook.length === 0) return;
      if (grouped.has(claim.triggerType)) return;
      grouped.set(claim.triggerType, claim.reviewerPlaybook.map((item) => item.step));
    });
    return Array.from(grouped.entries()).slice(0, 4);
  }, [claims, reviewQueue]);

  const handleLogout = () => {
    clearToken();
    logout();
    router.push('/login');
  };

  const openClaim = (id: string) => {
    router.push(`/team2/claims/${id}`);
  };

  const toggleBackfillTarget = (value: string) => {
    setSelectedBackfillTargets((prev) => {
      const exists = prev.includes(value);
      if (exists) {
        return prev.length === 1 ? prev : prev.filter((item) => item !== value);
      }
      return [...prev, value];
    });
  };

  const runCycle = async () => {
    setRunningCycle(true);
    try {
      const result = await apiClient.runTeam2PayoutCycle(120);
      toast.success(`Payout cycle checked ${result.scanned} claims`);
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not run payout cycle');
    } finally {
      setRunningCycle(false);
    }
  };

  const runReconcile = async () => {
    setRunningReconcile(true);
    try {
      const result = await apiClient.runTeam2Reconciliation();
      toast.success(`Reconciliation done. Conflicts: ${result.summary.conflictCount}`);
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not run reconciliation');
    } finally {
      setRunningReconcile(false);
    }
  };

  const runBackfill = async () => {
    setRunningBackfill(true);
    try {
      const result = await apiClient.runTeam2FraudBackfill({
        limit: 100,
        settlementStatuses: selectedBackfillTargets,
        unscoredOnly: !includeScoredClaims,
        olderThanHours,
      });
      toast.success(`Rescored ${result.rescored} claims across ${result.requestedStatuses?.join(', ') || 'selected states'}`);
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not rescore legacy claims');
    } finally {
      setRunningBackfill(false);
    }
  };

  return (
    <div className="min-h-screen finance-grid">
      <header className="sticky top-0 z-20 border-b border-slate-300/40 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Admin dashboard</p>
            <p className="text-sm font-semibold text-slate-900">Claims, fraud alerts, and system health</p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>Worker view</Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>Sign out</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-5">
        <Card className="border-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
            <div>
              <p className="text-sm text-slate-100">Keep payouts fast, catch fraud early, and monitor live events in one place.</p>
              <p className="mt-1 text-xs text-slate-300">
                Scheduler: {scheduler?.started ? 'Running' : 'Stopped'}
                {scheduler?.startedAt ? ` · started ${new Date(scheduler.startedAt).toLocaleTimeString('en-IN')}` : ''}
              </p>
              <p className="mt-1 text-xs text-slate-300">
                Stale pending rescoring every {Math.max(1, Math.round(Number(scheduler?.intervals.stalePendingRescoringMs || 0) / 60000))} min
                {' '}after {scheduler?.intervals.stalePendingAgeHours || 0}h idle
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={runCycle} disabled={runningCycle} className="bg-white text-slate-900 hover:bg-slate-100">
                {runningCycle ? 'Running cycle...' : 'Run payout cycle'}
              </Button>
              <Button variant="outline" onClick={runReconcile} disabled={runningReconcile} className="border-white/40 bg-white/10 text-white hover:bg-white/20">
                {runningReconcile ? 'Reconciling...' : 'Run reconciliation'}
              </Button>
              <Button variant="outline" onClick={runBackfill} disabled={runningBackfill} className="border-white/40 bg-white/10 text-white hover:bg-white/20">
                {runningBackfill ? 'Rescoring...' : 'Run claim rescoring'}
              </Button>
              <Button variant="outline" onClick={() => load(true)} disabled={refreshing} className="border-white/40 bg-white/10 text-white hover:bg-white/20">
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="ws-card border-0">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Legacy rescoring controls</h2>
                  <p className="mt-1 text-sm text-slate-600">Target pending claims or older review states without forcing a broad re-run.</p>
                </div>
                <StatusChip status={includeScoredClaims ? 'under_review' : 'approved'} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {BACKFILL_TARGETS.map((target) => {
                  const active = selectedBackfillTargets.includes(target.value);
                  return (
                    <button
                      key={target.value}
                      type="button"
                      onClick={() => toggleBackfillTarget(target.value)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {target.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <span className="block text-xs uppercase tracking-wide text-slate-500">Minimum age</span>
                  <input
                    type="number"
                    min={0}
                    max={720}
                    value={olderThanHours}
                    onChange={(event) => setOlderThanHours(Number(event.target.value || 0))}
                    className="mt-2 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 outline-none"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setIncludeScoredClaims((prev) => !prev)}
                  className={`rounded-xl border p-3 text-left transition ${includeScoredClaims ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}
                >
                  <p className="text-xs uppercase tracking-wide text-slate-500">Scored claims</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {includeScoredClaims ? 'Include already-scored claims' : 'Only backfill unscored claims'}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">Use this when older review outcomes need a fresh model pass.</p>
                </button>
              </div>
            </CardContent>
          </Card>

          <Card className="ws-card border-0">
            <CardContent className="p-4">
              <h2 className="text-base font-semibold text-slate-900">Reviewer playbooks</h2>

              {loading ? (
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              ) : playbookGroups.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                  Playbooks will appear as claims enter review with enriched lifecycle metadata.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {playbookGroups.map(([triggerType, steps]) => (
                    <article key={triggerType} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium capitalize text-slate-900">{triggerType.replaceAll('_', ' ')}</p>
                        <StatusChip status="under_review" />
                      </div>
                      <div className="mt-2 space-y-1">
                        {steps.slice(0, 3).map((step) => (
                          <p key={step} className="text-xs text-slate-700">{step}</p>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="ws-card border-0">
            <CardContent className="p-4">
              <h2 className="text-base font-semibold text-slate-900">Payout status overview</h2>
              {loading ? <Skeleton className="mt-3 h-24 w-full rounded-xl" /> : <div className="mt-3"><BarList items={statusBars} /></div>}
            </CardContent>
          </Card>

          <Card className="ws-card border-0">
            <CardContent className="p-4">
              <h2 className="text-base font-semibold text-slate-900">Fraud alerts</h2>

              {loading ? (
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-12 w-full rounded-xl" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                </div>
              ) : fraudAlerts.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                  No high-risk fraud alerts right now.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {fraudAlerts.slice(0, 4).map((alert) => (
                    <article
                      key={alert._id}
                      className="cursor-pointer rounded-xl border border-rose-200 bg-rose-50 p-3"
                      onClick={() => openClaim(alert._id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-rose-800">Claim {alert._id.slice(-8)}</p>
                        <StatusChip status={alert.settlementStatus || alert.status} />
                      </div>
                      <p className="mt-1 text-xs text-rose-700">
                        Fraud score: {(alert.fraudScore ?? 0).toFixed(2)} · {alert.reasonCode || 'No code'}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <AdminClaimsTable rows={claimRows} loading={loading} onOpen={openClaim} />

        <Card className="ws-card border-0">
          <CardContent className="p-4">
            <h2 className="text-base font-semibold text-slate-900">Real-time events</h2>

            {loading ? (
              <div className="mt-3 space-y-2">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            ) : auditLogs.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                No events available.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {auditLogs.slice(0, 8).map((event) => (
                  <article key={event._id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">{event.method} {event.path}</p>
                      <StatusChip status={event.success ? 'approved' : 'rejected'} />
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      role {event.actorRole} · status {event.statusCode} · latency {event.latencyMs || 0}ms · {new Date(event.createdAt).toLocaleTimeString('en-IN')}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function pickBarColor(key: string) {
  if (key.includes('success') || key.includes('confirmed')) return 'bg-emerald-500';
  if (key.includes('retry') || key.includes('processing')) return 'bg-amber-500';
  if (key.includes('failed') || key.includes('conflict')) return 'bg-rose-500';
  return 'bg-slate-500';
}
