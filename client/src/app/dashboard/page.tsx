'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import apiClient, { type Policy, type Claim } from '@/lib/apiClient';
import { clearToken, isAuthenticated } from '@/lib/auth';
import { useAppStore } from '@/store';
import { formatRelativeTime } from '@/utils';

const STATUS_COLORS: Record<string, string> = {
  active:       'bg-emerald-100 text-emerald-800 border-emerald-200',
  expired:      'bg-gray-100 text-gray-600 border-gray-200',
  cancelled:    'bg-red-100 text-red-700 border-red-200',
  claimed:      'bg-blue-100 text-blue-800 border-blue-200',
  pending:      'bg-amber-100 text-amber-800 border-amber-200',
  under_review: 'bg-orange-100 text-orange-700 border-orange-200',
  approved:     'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected:     'bg-red-100 text-red-700 border-red-200',
  paid:         'bg-violet-100 text-violet-800 border-violet-200',
};

const TRIGGER_ICONS: Record<string, string> = {
  rainfall: '🌧️',
  vehicle_accident: '🚗',
  platform_outage: '📵',
  hospitalization: '🏥',
};

const PLATFORM_ICONS: Record<string, string> = {
  swiggy: '🟠', zomato: '🔴', blinkit: '🟡', dunzo: '🟢', other: '⚪',
};

export default function DashboardPage() {
  const router = useRouter();
  const { currentUser, logout } = useAppStore();

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }

    const load = async () => {
      try {
        const [pRes, cRes] = await Promise.all([
          apiClient.getPolicies(),
          apiClient.getClaims(),
        ]);
        setPolicies(pRes.policies);
        setClaims(cRes.claims);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  const handleLogout = () => {
    clearToken();
    logout();
    router.push('/login');
  };

  const activePolicy = policies.find((p) => p.status === 'active');

  const totalCoverage = policies
    .filter((p) => p.status === 'active')
    .reduce((sum, p) => sum + p.coverageAmount, 0);
  const totalClaims = claims.length;
  const approvedClaims = claims.filter((c) => c.status === 'approved' || c.status === 'paid').length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Top navigation ─────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center text-white font-bold text-sm">W</div>
            <span className="font-bold text-gray-900 tracking-tight">WorkShield AI</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
              <span className="text-sm">{PLATFORM_ICONS[currentUser?.platform ?? 'other']}</span>
              <span className="text-sm font-medium text-gray-700">{currentUser?.name ?? 'Worker'}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} className="text-xs">
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">

        {/* ── Hero stats row ──────────────────────────────────────────────── */}
        {currentUser && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              emoji={PLATFORM_ICONS[currentUser.platform] ?? '⚪'}
              label="Platform"
              value={currentUser.platform.charAt(0).toUpperCase() + currentUser.platform.slice(1)}
            />
            <StatCard emoji="🛵" label="Weekly deliveries" value={String(currentUser.weeklyDeliveries)} />
            <StatCard
              emoji={currentUser.riskScore < 0.4 ? '🟢' : currentUser.riskScore < 0.7 ? '🟡' : '🔴'}
              label="Risk score"
              value={`${Math.round(currentUser.riskScore * 100)}%`}
              subText={currentUser.riskScore < 0.4 ? 'Low risk' : currentUser.riskScore < 0.7 ? 'Medium' : 'High risk'}
            />
            <StatCard
              emoji={currentUser.kycVerified ? '✅' : '⏳'}
              label="KYC status"
              value={currentUser.kycVerified ? 'Verified' : 'Pending'}
            />
          </div>
        )}

        {/* ── Active policy hero card ─────────────────────────────────────── */}
        {loading ? (
          <Skeleton className="h-36 w-full rounded-2xl" />
        ) : activePolicy ? (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white p-6">
            <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10" />
            <div className="absolute -right-4 bottom-0 w-24 h-24 rounded-full bg-white/5" />
            <div className="relative">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sky-200 text-xs font-medium uppercase tracking-wide mb-1">Active Coverage</p>
                  <p className="text-2xl font-bold">₹{activePolicy.coverageAmount.toLocaleString('en-IN')}</p>
                  <p className="text-sky-100 text-sm mt-1">{activePolicy.policyNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-sky-200 text-xs mb-1">Weekly premium</p>
                  <p className="text-xl font-bold">₹{activePolicy.premium}</p>
                </div>
              </div>
              <Separator className="my-4 bg-white/20" />
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex gap-3 text-xs text-sky-100">
                  <span>Expires {new Date(activePolicy.endDate).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}</span>
                  <span>•</span>
                  <span className="capitalize">{activePolicy.type}</span>
                  <span>•</span>
                  <span className="capitalize">{activePolicy.platform}</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => router.push('/claims/new')}
                  className="bg-white text-sky-600 hover:bg-sky-50 font-semibold text-xs"
                >
                  File a Claim
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-8 text-center">
            <div className="text-4xl mb-3">🛡️</div>
            <h3 className="font-semibold text-gray-900 mb-1">You're not covered yet</h3>
            <p className="text-sm text-gray-500 mb-4">Get a policy in under 60 seconds — from ₹45/week</p>
            <Button onClick={() => router.push('/policies/new')} className="bg-sky-500 hover:bg-sky-600">
              Get Covered Now
            </Button>
          </div>
        )}

        {/* ── Summary row ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <MiniStat label="Active coverage" value={`₹${totalCoverage.toLocaleString('en-IN')}`} />
          <MiniStat label="Total claims" value={String(totalClaims)} />
          <MiniStat label="Approved claims" value={String(approvedClaims)} accent />
        </div>

        {/* ── Policies ───────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">My Policies</h2>
            <Button variant="outline" size="sm" onClick={() => router.push('/policies/new')}
              className="text-xs border-sky-200 text-sky-600 hover:bg-sky-50">
              + New Policy
            </Button>
          </div>
          {loading ? <LoadingCards /> : policies.length === 0 ? (
            <EmptyState emoji="📋" message="No policies yet" sub="Tap + New Policy to get started" />
          ) : (
            <div className="space-y-2">
              {policies.map((p) => (
                <Card key={p._id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="flex items-center justify-between p-4 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-lg shrink-0">
                        {PLATFORM_ICONS[p.platform] ?? '🛡️'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{p.policyNumber}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          ₹{p.coverageAmount.toLocaleString('en-IN')} coverage · ₹{p.premium}/wk
                        </p>
                      </div>
                    </div>
                    <Badge className={`text-xs border ${STATUS_COLORS[p.status]} shrink-0`}>
                      {p.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* ── Recent Claims ───────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Recent Claims</h2>
            {activePolicy && (
              <Button variant="outline" size="sm" onClick={() => router.push('/claims/new')}
                className="text-xs border-sky-200 text-sky-600 hover:bg-sky-50">
                + File Claim
              </Button>
            )}
          </div>
          {loading ? <LoadingCards /> : claims.length === 0 ? (
            <EmptyState emoji="📂" message="No claims filed yet"
              sub={activePolicy ? 'File a claim if you experience a covered event' : 'Get a policy first'} />
          ) : (
            <div className="space-y-2">
              {claims.slice(0, 6).map((c) => (
                <Card key={c._id} className="border-0 shadow-sm">
                  <CardContent className="flex items-center justify-between p-4 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-lg shrink-0">
                        {TRIGGER_ICONS[c.triggerType] ?? '⚡'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm capitalize">
                          {c.triggerType.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          ₹{c.claimAmount?.toLocaleString('en-IN') ?? '—'} · {formatRelativeTime(c.createdAt)}
                        </p>
                      </div>
                    </div>
                    <Badge className={`text-xs border ${STATUS_COLORS[c.status]} shrink-0`}>
                      {c.status.replace('_', ' ')}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* ── Trigger coverage legend ─────────────────────────────────────── */}
        <section>
          <h2 className="font-semibold text-gray-900 mb-3">What you're covered for</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: '🌧️', event: 'Heavy Rainfall', cond: '>50mm', payout: '50%' },
              { icon: '🚗', event: 'Vehicle Accident', cond: 'Any incident', payout: '100%' },
              { icon: '📵', event: 'Platform Outage', cond: '>4 hours', payout: '30%' },
              { icon: '🏥', event: 'Hospitalization', cond: 'Any admission', payout: '100%' },
            ].map((t) => (
              <div key={t.event} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="text-2xl mb-2">{t.icon}</div>
                <p className="font-semibold text-sm text-gray-900">{t.event}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t.cond}</p>
                <p className="text-xs font-medium text-sky-600 mt-1">{t.payout} payout</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

// ── Sub-components ── ────────────────────────────────────────────────────────

function StatCard({ emoji, label, value, subText }: { emoji: string; label: string; value: string; subText?: string }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <div className="text-xl mb-2">{emoji}</div>
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="font-bold text-gray-900 mt-0.5 capitalize">{value}</p>
      {subText && <p className="text-xs text-gray-400 mt-0.5">{subText}</p>}
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-3 text-center border ${accent ? 'bg-sky-50 border-sky-100' : 'bg-white border-gray-100 shadow-sm'}`}>
      <p className={`text-lg font-bold ${accent ? 'text-sky-600' : 'text-gray-900'}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function LoadingCards() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-[68px] w-full rounded-xl" />
      ))}
    </div>
  );
}

function EmptyState({ emoji, message, sub }: { emoji: string; message: string; sub: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-white py-10 text-center">
      <div className="text-3xl mb-2">{emoji}</div>
      <p className="font-medium text-gray-700 text-sm">{message}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}
