'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import apiClient, { type Claim, type Policy } from '@/lib/apiClient';
import { clearToken, isAuthenticated } from '@/lib/auth';
import { useAppStore } from '@/store';
import { formatRelativeTime } from '@/utils';
import { BarList } from '@/components/workshield/bar-list';
import { StatusChip } from '@/components/workshield/status-chip';

const EVENT_VIEW: Record<string, { label: string; icon: string; barClass: string; trackClass: string }> = {
  rainfall: { label: 'Rain', icon: '🌧️', barClass: 'bg-sky-500', trackClass: 'bg-sky-100' },
  platform_outage: { label: 'App down', icon: '📵', barClass: 'bg-amber-500', trackClass: 'bg-amber-100' },
  vehicle_accident: { label: 'Accident', icon: '🚗', barClass: 'bg-rose-500', trackClass: 'bg-rose-100' },
  hospitalization: { label: 'Hospital', icon: '🏥', barClass: 'bg-emerald-500', trackClass: 'bg-emerald-100' },
};

export default function DashboardPage() {
  const router = useRouter();
  const { currentUser, logout } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }

    const load = async () => {
      try {
        const [policyRes, claimRes] = await Promise.all([apiClient.getPolicies(), apiClient.getClaims()]);
        setPolicies(policyRes.policies);
        setClaims(claimRes.claims);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not load dashboard');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  const activePolicies = policies.filter((policy) => policy.status === 'active');
  const activePlan = activePolicies[0] || null;
  const totalProtected = activePolicies.reduce((sum, policy) => sum + policy.coverageAmount, 0);

  const claimTrack = useMemo(() => {
    const pending = claims.filter((claim) => (claim.settlementStatus || claim.status) === 'pending').length;
    const review = claims.filter((claim) => {
      const status = claim.settlementStatus || claim.status;
      return status === 'under_review' || status === 'soft_flag';
    }).length;
    const approved = claims.filter((claim) => (claim.settlementStatus || claim.status) === 'approved').length;
    const paid = claims.filter((claim) => (claim.settlementStatus || claim.status) === 'paid').length;

    return [
      { id: 'pending', label: 'Checking', value: pending, barClass: 'bg-amber-500', trackClass: 'bg-amber-100' },
      { id: 'review', label: 'Review', value: review, barClass: 'bg-orange-500', trackClass: 'bg-orange-100' },
      { id: 'approved', label: 'Approved', value: approved, barClass: 'bg-emerald-400', trackClass: 'bg-emerald-100' },
      { id: 'paid', label: 'Paid', value: paid, barClass: 'bg-emerald-600', trackClass: 'bg-emerald-100' },
    ];
  }, [claims]);

  const eventTrack = useMemo(() => {
    const keys = ['rainfall', 'platform_outage', 'vehicle_accident', 'hospitalization'] as const;
    return keys.map((key) => ({
      id: key,
      label: `${EVENT_VIEW[key].icon} ${EVENT_VIEW[key].label}`,
      value: claims.filter((claim) => claim.triggerType === key).length,
      barClass: EVENT_VIEW[key].barClass,
      trackClass: EVENT_VIEW[key].trackClass,
    }));
  }, [claims]);

  const recentPayouts = claims.filter((claim) => (claim.settlementStatus || claim.status) === 'paid').slice(0, 4);

  const handleLogout = () => {
    clearToken();
    logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen finance-grid">
      <header className="sticky top-0 z-20 border-b border-slate-300/40 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Worker dashboard</p>
            <p className="text-sm font-semibold text-slate-900">Hello {currentUser?.name || 'Worker'}</p>
          </div>

          <div className="flex items-center gap-2">
            {currentUser?.role === 'admin' && (
              <Button variant="outline" size="sm" onClick={() => router.push('/team2/ops')}>
                Admin view
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-5">
        <Card className="border-0 bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 text-white">
          <CardContent className="p-5 sm:p-6">
            <p className="text-xs uppercase tracking-[0.16em] text-sky-200">Earnings protected</p>
            <p className="mt-2 text-3xl font-semibold sm:text-4xl">INR {totalProtected.toLocaleString('en-IN')}</p>

            <p className="mt-3 max-w-xl text-sm text-slate-200">
              Your income cover is active for weekly work. If rain, app outage, accident, or hospital event happens, file a claim and track payout here.
            </p>

            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="ws-chip-rain rounded-full px-3 py-1">Rain</span>
              <span className="ws-chip-outage rounded-full px-3 py-1">App down</span>
              <span className="ws-chip-accident rounded-full px-3 py-1">Accident</span>
              <span className="ws-chip-health rounded-full px-3 py-1">Hospital</span>
            </div>

            <div className="mt-4 flex gap-2">
              <Button size="sm" className="bg-white text-slate-900 hover:bg-slate-100" onClick={() => router.push('/policies/new')}>
                Buy weekly plan
              </Button>
              <Button size="sm" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20" onClick={() => router.push('/claims/new')}>
                File claim
              </Button>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="ws-card border-0">
            <CardContent className="p-4">
              <h2 className="text-base font-semibold text-slate-900">Active plan</h2>

              {loading ? (
                <Skeleton className="mt-3 h-20 w-full rounded-xl" />
              ) : activePlan ? (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{activePlan.policyNumber}</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">INR {activePlan.coverageAmount.toLocaleString('en-IN')} cover</p>
                  <p className="mt-1 text-sm text-slate-600">Plan ends on {new Date(activePlan.endDate).toLocaleDateString('en-IN')}</p>
                  <p className="mt-2 text-xs text-slate-500">Weekly premium: INR {activePlan.premium}</p>
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-sm text-slate-600">
                  No active plan yet. Tap "Buy weekly plan" to start protection.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="ws-card border-0">
            <CardContent className="p-4">
              <h2 className="text-base font-semibold text-slate-900">Claim status tracker</h2>
              <p className="mt-1 text-sm text-slate-600">See what stage your claims are in.</p>
              <div className="mt-3">
                <BarList items={claimTrack} />
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="ws-card border-0">
            <CardContent className="p-4">
              <h2 className="text-base font-semibold text-slate-900">Event triggers</h2>
              <p className="mt-1 text-sm text-slate-600">Events that have caused claims.</p>
              <div className="mt-3">
                <BarList items={eventTrack} />
              </div>
            </CardContent>
          </Card>

          <Card className="ws-card border-0">
            <CardContent className="p-4">
              <h2 className="text-base font-semibold text-slate-900">Recent payouts</h2>

              {loading ? (
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                </div>
              ) : recentPayouts.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-sm text-slate-600">
                  No payout yet. Paid claims will show here.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {recentPayouts.map((claim) => (
                    <article key={claim._id} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900">
                          {(EVENT_VIEW[claim.triggerType]?.icon || '🧾')} {EVENT_VIEW[claim.triggerType]?.label || claim.triggerType}
                        </p>
                        <StatusChip status={claim.settlementStatus || claim.status} />
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        INR {Number(claim.approvedAmount || claim.claimAmount || 0).toLocaleString('en-IN')} · {formatRelativeTime(claim.createdAt)}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
