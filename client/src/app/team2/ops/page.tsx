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

export default function Team2OpsPage() {
  const router = useRouter();
  const { currentUser, logout } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runningCycle, setRunningCycle] = useState(false);
  const [runningReconcile, setRunningReconcile] = useState(false);

  const [summary, setSummary] = useState<Team2OpsSummary | null>(null);
  const [scheduler, setScheduler] = useState<Team2SchedulerStatus | null>(null);
  const [reviewQueue, setReviewQueue] = useState<Claim[]>([]);
  const [attempts, setAttempts] = useState<Team2PayoutAttempt[]>([]);
  const [auditLogs, setAuditLogs] = useState<Team2AuditLog[]>([]);

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
        const [summaryRes, schedulerRes, queueRes, attemptsRes, auditRes] = await Promise.all([
          apiClient.getTeam2OpsSummary(),
          apiClient.getTeam2SchedulerStatus(),
          apiClient.getTeam2ReviewQueue(40),
          apiClient.getTeam2PayoutAttempts(undefined, 60),
          apiClient.getTeam2AuditLogs(25),
        ]);

        setSummary(summaryRes.summary);
        setScheduler(schedulerRes.scheduler);
        setReviewQueue(queueRes.queue);
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
    const fromQueue: AdminClaimRow[] = reviewQueue.map((claim) => ({
      id: claim._id,
      triggerType: claim.triggerType,
      status: claim.settlementStatus || claim.status,
      amount: Number(claim.claimAmount || 0),
      fraudScore: claim.fraudScore ?? null,
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
        status: attempt.status,
        amount,
        fraudScore: null,
        reasonCode: claim?.reasonCode,
        updatedAt: attempt.updatedAt,
        source: 'payout',
        attemptCount: attempt.attemptCount,
        providerReference: attempt.providerReference,
      };
    });

    const dedup = new Map<string, AdminClaimRow>();
    [...fromAttempts, ...fromQueue].forEach((row) => {
      if (!dedup.has(row.id) || row.source === 'review') {
        dedup.set(row.id, row);
      }
    });

    return Array.from(dedup.values());
  }, [attempts, reviewQueue]);

  const fraudAlerts = useMemo(() => {
    return reviewQueue.filter((claim) => {
      const score = claim.fraudScore ?? 0;
      const status = claim.settlementStatus || claim.status;
      return score >= 0.7 || status === 'hard_block';
    });
  }, [reviewQueue]);

  const handleLogout = () => {
    clearToken();
    logout();
    router.push('/login');
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

  const onApprove = async (id: string) => {
    try {
      await apiClient.decideTeam2Review(id, { action: 'approve', remarks: 'Approved from admin dashboard' });
      toast.success('Claim approved');
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approve failed');
    }
  };

  const onReject = async (id: string) => {
    try {
      await apiClient.decideTeam2Review(id, { action: 'reject', remarks: 'Rejected from admin dashboard' });
      toast.success('Claim rejected');
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reject failed');
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
            </div>

            <div className="flex gap-2">
              <Button onClick={runCycle} disabled={runningCycle} className="bg-white text-slate-900 hover:bg-slate-100">
                {runningCycle ? 'Running cycle...' : 'Run payout cycle'}
              </Button>
              <Button variant="outline" onClick={runReconcile} disabled={runningReconcile} className="border-white/40 bg-white/10 text-white hover:bg-white/20">
                {runningReconcile ? 'Reconciling...' : 'Run reconciliation'}
              </Button>
              <Button variant="outline" onClick={() => load(true)} disabled={refreshing} className="border-white/40 bg-white/10 text-white hover:bg-white/20">
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </CardContent>
        </Card>

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
                    <article key={alert._id} className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-rose-800">Claim {alert._id.slice(-8)}</p>
                        <StatusChip status={alert.settlementStatus || alert.status} />
                      </div>
                      <p className="mt-1 text-xs text-rose-700">Fraud score: {(alert.fraudScore ?? 0).toFixed(2)} · {alert.reasonCode || 'No code'}</p>
                    </article>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <AdminClaimsTable rows={claimRows} loading={loading} onApprove={onApprove} onReject={onReject} />

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
