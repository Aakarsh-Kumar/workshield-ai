'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { StatusChip } from '@/components/workshield/status-chip';
import apiClient, { type Claim, type Team2AdminClaimDetail } from '@/lib/apiClient';
import { clearToken, isAuthenticated } from '@/lib/auth';
import { useAppStore } from '@/store';

type ReviewAction = 'approve' | 'reject';

export default function Team2ClaimDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { currentUser, logout } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Team2AdminClaimDetail | null>(null);
  const [submittingAction, setSubmittingAction] = useState<ReviewAction | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const claimId = String(params.id || '');

  const load = useCallback(async (showErrorToast = true) => {
    try {
      const response = await apiClient.getTeam2ClaimDetail(claimId);
      setDetail(response);
      setReviewNote(response.claim.remarks || '');
    } catch (err) {
      if (showErrorToast) {
        toast.error(err instanceof Error ? err.message : 'Failed to load admin claim detail');
      }
      router.replace('/team2/ops');
    } finally {
      setLoading(false);
    }
  }, [claimId, router]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }

    if (currentUser?.role && currentUser.role !== 'admin') {
      router.replace('/dashboard');
      return;
    }

    if (!claimId) {
      toast.error('Missing claim id');
      router.replace('/team2/ops');
      return;
    }

    load(false);
  }, [claimId, currentUser?.role, load, router]);

  const handleLogout = () => {
    clearToken();
    logout();
    router.push('/login');
  };

  const claim = detail?.claim;
  const payoutAttempt = detail?.payoutAttempt;
  const reviewActions = detail?.manualReviewActions || [];
  const canTakeReviewAction = Boolean(
    claim && ['pending', 'soft_flag'].includes(claim.settlementStatus || claim.status || 'pending'),
  );

  const reviewSummary = useMemo(() => {
    if (!claim) return null;

    if ((claim.settlementStatus || claim.status) === 'soft_flag') {
      return {
        title: 'Manual review required',
        detail: 'This claim has been flagged for human review. Open the evidence below, then approve or reject it once you are satisfied.',
      };
    }

    if ((claim.settlementStatus || claim.status) === 'pending') {
      return {
        title: 'Verification pending',
        detail: 'This claim is waiting on manual confirmation. Review the claim details and attached evidence, then decide whether to approve or reject it.',
      };
    }

    return {
      title: 'Decision completed',
      detail: 'This claim already has a final review outcome recorded below.',
    };
  }, [claim]);

  const submitDecision = async (action: ReviewAction) => {
    if (!claim) return;
    setSubmittingAction(action);
    try {
      await apiClient.decideTeam2Review(claim._id, {
        action,
        remarks: reviewNote.trim() || (action === 'approve' ? 'Approved by admin reviewer' : 'Rejected by admin reviewer'),
        approvedAmount: action === 'approve' ? Number(claim.claimAmount || 0) : undefined,
      });
      toast.success(action === 'approve' ? 'Claim approved' : 'Claim rejected');
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save review decision');
    } finally {
      setSubmittingAction(null);
    }
  };

  return (
    <div className="min-h-screen finance-grid">
      <header className="sticky top-0 z-20 border-b border-slate-300/40 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/team2/ops')}>Back to ops</Button>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Admin review workspace</p>
              <p className="text-sm font-semibold text-slate-900">Claim {claim?._id?.slice(-8) || '...'}</p>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={handleLogout}>Sign out</Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-80 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        ) : claim ? (
          <>
            <Card className="border-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white">
              <CardContent className="space-y-4 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-amber-200">Manual review workspace</p>
                    <h1 className="mt-1 text-2xl font-semibold">{claim.triggerType.replaceAll('_', ' ')} claim</h1>
                    <p className="mt-2 max-w-3xl text-sm text-slate-200">{reviewSummary?.detail}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusChip status={claim.verificationState || 'pending'} />
                    <StatusChip status={claim.fraudState || 'pending'} />
                    <StatusChip status={claim.payoutState || 'pending'} />
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-4">
                  <HeroMetric label="Claim amount" value={`INR ${Number(claim.claimAmount || 0).toLocaleString('en-IN')}`} />
                  <HeroMetric label="Fraud score" value={claim.fraudModelVersion ? Number(claim.fraudScore || 0).toFixed(2) : 'NA'} />
                  <HeroMetric label="Verification" value={(claim.verificationState || 'pending').replaceAll('_', ' ')} />
                  <HeroMetric label="Current status" value={(claim.settlementStatus || claim.status || 'pending').replaceAll('_', ' ')} />
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <Card className="ws-card border-0">
                <CardContent className="p-5">
                  <h2 className="text-lg font-semibold text-slate-900">Claim review</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Reviewers should open this page from Team 2 Ops, inspect the claim, then record one final decision here.
                  </p>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">{reviewSummary?.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{reviewSummary?.detail}</p>

                    <label className="mt-4 block">
                      <span className="text-xs uppercase tracking-wide text-slate-500">Reviewer note</span>
                      <textarea
                        value={reviewNote}
                        onChange={(event) => setReviewNote(event.target.value)}
                        placeholder="Add why you are approving or rejecting this claim."
                        className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-500"
                      />
                    </label>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        onClick={() => submitDecision('approve')}
                        disabled={!canTakeReviewAction || submittingAction !== null}
                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        {submittingAction === 'approve' ? 'Approving...' : 'Approve Claim'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => submitDecision('reject')}
                        disabled={!canTakeReviewAction || submittingAction !== null}
                        className="border-rose-300 text-rose-700 hover:bg-rose-50"
                      >
                        {submittingAction === 'reject' ? 'Rejecting...' : 'Reject Claim'}
                      </Button>
                    </div>

                    {!canTakeReviewAction ? (
                      <p className="mt-3 text-xs text-slate-500">This claim already has a final decision, so the review buttons are locked.</p>
                    ) : (
                      <p className="mt-3 text-xs text-slate-500">Only one decision is needed. Approve moves the claim into payout flow; reject blocks it.</p>
                    )}
                  </div>

                  <Separator className="my-5" />

                  <h3 className="text-sm font-semibold text-slate-900">Claim details</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <InfoRow label="Worker" value={typeof claim.userId === 'object' ? (claim.userId.name || claim.userId.email || claim.userId._id) : 'Unknown'} />
                    <InfoRow label="Policy" value={typeof claim.policyId === 'object' ? (claim.policyId.policyNumber || claim.policyId._id) : String(claim.policyId)} />
                    <InfoRow label="Trigger" value={claim.triggerType.replaceAll('_', ' ')} />
                    <InfoRow label="Trigger value" value={String(claim.triggerValue ?? 'NA')} />
                    <InfoRow label="Reason code" value={claim.reasonCode || 'NA'} mono />
                    <InfoRow label="Claim filed" value={new Date(claim.createdAt).toLocaleString('en-IN')} />
                  </div>

                  <div className="mt-5">
                    <h3 className="text-sm font-semibold text-slate-900">Attached documents</h3>
                    <div className="mt-3 space-y-3">
                      {claim.documents && claim.documents.length > 0 ? (
                        claim.documents.map((doc, index) => (
                          <DocumentCard key={`${doc.file_name || 'doc'}-${index}`} doc={doc} />
                        ))
                      ) : (
                        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                          No documents were attached to this claim.
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className="ws-card border-0">
                  <CardContent className="p-5">
                    <h2 className="text-lg font-semibold text-slate-900">Reviewer guidance</h2>
                    <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-1">
                      <SignalBox label="Event verification" value={claim.lifecycle?.eventVerification || claim.verificationState || 'unknown'} />
                      <SignalBox label="Fraud review" value={claim.lifecycle?.fraudReview || claim.fraudState || 'unknown'} />
                      <SignalBox label="Payout orchestration" value={claim.lifecycle?.payoutOrchestration || claim.payoutState || 'unknown'} />
                    </div>

                    <div className="mt-5">
                      <h3 className="text-sm font-semibold text-slate-900">Playbook</h3>
                      <div className="mt-3 space-y-2">
                        {(claim.reviewerPlaybook || []).map((item) => (
                          <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            {item.step}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5">
                      <h3 className="text-sm font-semibold text-slate-900">Fraud and verification timeline</h3>
                      <div className="mt-3 space-y-2">
                        {(claim.fraudTimeline || []).map((event) => (
                          <article key={event.id} className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-slate-900">{event.title}</p>
                              <p className="text-xs text-slate-500">{event.at ? new Date(event.at).toLocaleString('en-IN') : 'Pending'}</p>
                            </div>
                            <p className="mt-1 text-xs text-slate-600">{event.detail}</p>
                          </article>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="ws-card border-0">
                  <CardContent className="p-5">
                    <h2 className="text-lg font-semibold text-slate-900">Payout and review history</h2>
                    {!payoutAttempt ? (
                      <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                        No payout attempt exists for this claim yet.
                      </p>
                    ) : (
                      <>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <InfoRow label="Attempt status" value={payoutAttempt.status.replaceAll('_', ' ')} />
                          <InfoRow label="Attempt count" value={String(payoutAttempt.attemptCount)} />
                          <InfoRow label="Provider ref" value={payoutAttempt.providerReference || 'NA'} mono />
                          <InfoRow label="Next retry" value={payoutAttempt.nextRetryAt ? new Date(payoutAttempt.nextRetryAt).toLocaleString('en-IN') : 'None'} />
                        </div>

                        <div className="mt-4 space-y-2">
                          {(payoutAttempt.timeline || []).map((item, index) => (
                            <article key={`${item.event}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-slate-900">{item.event.replaceAll('_', ' ')}</p>
                                <p className="text-xs text-slate-500">{item.at ? new Date(item.at).toLocaleString('en-IN') : 'Pending'}</p>
                              </div>
                              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-600">
                                {JSON.stringify(item.detail || {}, null, 2)}
                              </pre>
                            </article>
                          ))}
                        </div>
                      </>
                    )}

                    <Separator className="my-5" />

                    <h3 className="text-sm font-semibold text-slate-900">Manual review actions</h3>
                    <div className="mt-3 space-y-2">
                      {reviewActions.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                          No manual reviewer actions recorded yet.
                        </p>
                      ) : (
                        reviewActions.map((action) => (
                          <article key={action._id} className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium capitalize text-slate-900">{action.action}</p>
                              <p className="text-xs text-slate-500">{new Date(action.createdAt).toLocaleString('en-IN')}</p>
                            </div>
                            <p className="mt-1 text-xs text-slate-600">By {action.actorUserLabel || 'Admin reviewer'}</p>
                            <p className="mt-2 text-sm text-slate-700">{action.reason || 'No reviewer note provided.'}</p>
                            {action.approvedAmount != null ? (
                              <p className="mt-2 text-xs text-slate-600">Approved amount: INR {Number(action.approvedAmount).toLocaleString('en-IN')}</p>
                            ) : null}
                          </article>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/10 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-300">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function SignalBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold capitalize text-slate-900">{value.replaceAll('_', ' ')}</p>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-sm text-slate-900 ${mono ? 'finance-mono break-all' : 'font-medium'}`}>{value}</p>
    </div>
  );
}

function DocumentCard({ doc }: { doc: NonNullable<Claim['documents']>[number] }) {
  const dataUrl = doc.content_base64 && doc.mime_type ? `data:${doc.mime_type};base64,${doc.content_base64}` : null;
  const isImage = Boolean(doc.mime_type?.startsWith('image/'));
  const safeName = doc.file_name || 'attachment';

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-900">{safeName}</p>
          <p className="text-xs text-slate-500">{doc.mime_type || 'unknown file type'}</p>
        </div>
        {dataUrl ? (
          <a
            href={dataUrl}
            download={safeName}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Download
          </a>
        ) : null}
      </div>

      {isImage && dataUrl ? (
        <Image
          src={dataUrl}
          alt={safeName}
          width={1200}
          height={800}
          unoptimized
          className="mt-3 max-h-64 w-full rounded-lg border border-slate-200 object-contain"
        />
      ) : (
        <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          Preview unavailable for this file type. Use download to inspect it.
        </p>
      )}
    </article>
  );
}
