'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { clearToken, isAuthenticated } from '@/lib/auth';
import { getDecisionCopy, settlementProgress } from '@/lib/decisionCopy';
import apiClient, { type Claim } from '@/lib/apiClient';
import { useAppStore } from '@/store';

const STATUS_THEME: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  soft_flag: 'bg-orange-100 text-orange-800 border-orange-200',
  hard_block: 'bg-red-100 text-red-800 border-red-200',
  paid: 'bg-indigo-100 text-indigo-800 border-indigo-200',
};

export default function ClaimDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { currentUser, logout } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [claim, setClaim] = useState<Claim | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }

    const load = async () => {
      try {
        const claimId = String(params.id || '');
        if (!claimId) {
          toast.error('Missing claim id');
          router.replace('/dashboard');
          return;
        }

        const res = await apiClient.getClaim(claimId);
        setClaim(res.claim);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load claim details');
        router.replace('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [params.id, router]);

  const decision = useMemo(() => getDecisionCopy(claim?.reasonCode), [claim?.reasonCode]);
  const settlement = claim?.settlementStatus || claim?.status || 'pending';
  const progress = settlementProgress(settlement);
  const lifecycle = claim?.lifecycle;
  const reviewerReasons = claim?.reviewerReasons || [];
  const fraudTimeline = claim?.fraudTimeline || [];

  const handleLogout = () => {
    clearToken();
    logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen finance-grid">
      <header className="sticky top-0 z-20 border-b border-slate-300/40 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>Back</Button>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Relief decision detail</p>
              <span className="text-sm font-semibold text-slate-900">Claim Transparency Console</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentUser?.role === 'admin' && (
              <Button variant="outline" size="sm" onClick={() => router.push('/team2/ops')}>Team 2 Ops</Button>
            )}
            <Button variant="outline" size="sm" onClick={handleLogout}>Sign out</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-36 w-full" />
          </div>
        ) : claim ? (
          <>
            <Card className="finance-hero border-0">
              <CardContent className="space-y-3 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-amber-200">Current relief status</p>
                    <h1 className="mt-1 text-2xl font-semibold text-white">{decision.title}</h1>
                    <p className="mt-2 max-w-2xl text-sm text-slate-200">{decision.summary}</p>
                  </div>

                  <Badge className={`border text-xs ${STATUS_THEME[settlement] || STATUS_THEME.pending}`}>
                    {settlement.replace('_', ' ')}
                  </Badge>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <SignalCard label="Fraud score" value={claim.fraudModelVersion ? (claim.fraudScore ?? 0).toFixed(3) : 'NA'} />
                  <SignalCard label="Verification" value={claim.verificationState || 'unknown'} />
                  <SignalCard label="Decision code" value={claim.reasonCode || 'UNSPECIFIED'} mono />
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-[1fr_0.42fr]">
              <Card className="finance-card border-0">
                <CardContent className="p-5">
                  <h2 className="text-lg font-semibold text-slate-900">Lifecycle tracker</h2>
                  <p className="mt-1 text-sm text-slate-600">Stage-by-stage movement from disruption claim to final payout.</p>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <ProgressBox label="Filed" done={progress.filed} />
                    <ProgressBox label="Reviewed" done={progress.reviewed} />
                    <ProgressBox label="Payout ready" done={progress.payoutReady} />
                    <ProgressBox label="Paid" done={progress.paid} />
                  </div>

                  <div className="mt-4 grid gap-2 md:grid-cols-3">
                    <LifecycleTrack label="Event verification" value={lifecycle?.eventVerification || claim.verificationState || 'unknown'} />
                    <LifecycleTrack label="Fraud review" value={lifecycle?.fraudReview || claim.fraudState || 'unknown'} />
                    <LifecycleTrack label="Payout orchestration" value={lifecycle?.payoutOrchestration || claim.payoutState || 'unknown'} />
                  </div>

                  <Separator className="my-4" />

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Reason in plain language</p>
                    <p className="mt-1 text-sm text-slate-800">{decision.workerSafeReason}</p>
                    <p className="mt-2 text-xs text-slate-600">Recommended next action: {decision.nextStep}</p>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <MetaRow label="Claim ID" value={claim._id} mono />
                    <MetaRow label="Trigger" value={claim.triggerType.replace(/_/g, ' ')} />
                    <MetaRow label="Claim Amount" value={`INR ${Number(claim.claimAmount || 0).toLocaleString('en-IN')}`} />
                    <MetaRow label="Approved Amount" value={`INR ${Number(claim.approvedAmount || 0).toLocaleString('en-IN')}`} />
                    <MetaRow label="Created at" value={new Date(claim.createdAt).toLocaleString('en-IN')} />
                    <MetaRow label="Processed at" value={claim.processedAt ? new Date(claim.processedAt).toLocaleString('en-IN') : 'Pending'} />
                  </div>

                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-slate-900">Fraud and verification timeline</h3>
                    <div className="mt-3 space-y-2">
                      {fraudTimeline.map((event) => (
                        <div key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-slate-900">{event.title}</p>
                            <p className="text-xs text-slate-500">{event.at ? new Date(event.at).toLocaleString('en-IN') : 'Pending'}</p>
                          </div>
                          <p className="mt-1 text-xs text-slate-600">{event.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="finance-card border-0">
                <CardContent className="p-5">
                  <h2 className="text-lg font-semibold text-slate-900">Settlement notes</h2>
                  <p className="mt-1 text-sm text-slate-600">Worker-safe disclosure for fair and auditable claim handling.</p>

                  <div className="mt-4 space-y-2">
                    <AuditLine label="Verdict" value={claim.fraudVerdict || '--'} />
                    <AuditLine label="Reason code" value={claim.reasonCode || '--'} mono />
                    <AuditLine label="Contract version" value={claim.responseContractVersion || '--'} mono />
                    <AuditLine label="Payout eligibility" value={String(Boolean(claim.payoutEligibility))} />
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Reviewer rationale</p>
                    <div className="mt-2 space-y-2">
                      {reviewerReasons.length === 0 ? (
                        <p className="text-sm text-slate-600">No additional reviewer notes yet.</p>
                      ) : (
                        reviewerReasons.map((reason, index) => (
                          <div key={`${reason.type}-${index}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <p className="text-xs uppercase tracking-wide text-slate-500">{reason.label}</p>
                            <p className="mt-1 text-sm text-slate-800">{reason.detail}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-amber-700">Transparency boundary</p>
                    <p className="mt-1 text-sm text-amber-800">
                      Sensitive anti-fraud internals remain protected while worker-facing reasons and settlement actions stay explicit.
                    </p>
                  </div>

                  <Button className="mt-4 w-full bg-slate-900 text-white hover:bg-slate-800" onClick={() => router.push('/dashboard')}>
                    Return to dashboard
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}

function SignalCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-300">{label}</p>
      <p className={`mt-1 text-sm font-semibold text-white ${mono ? 'finance-mono text-xs' : ''}`}>{value}</p>
    </div>
  );
}

function ProgressBox({ label, done }: { label: string; done: boolean }) {
  return (
    <div className={`rounded-lg border p-2 text-center ${done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
      {label}
    </div>
  );
}

function LifecycleTrack({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold capitalize text-slate-900">{value.replaceAll('_', ' ')}</p>
    </div>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 text-slate-900 ${mono ? 'finance-mono text-xs break-all' : 'font-medium'}`}>{value}</p>
    </div>
  );
}

function AuditLine({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
      <p className="text-xs text-slate-600">{label}</p>
      <p className={`text-xs font-semibold text-slate-800 ${mono ? 'finance-mono' : ''}`}>{value}</p>
    </div>
  );
}
