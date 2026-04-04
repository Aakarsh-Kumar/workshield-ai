'use client';

import { useState } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import apiClient from '@/lib/apiClient';
import type { TriggerType } from '@/types';

const TRIGGER_TYPES: Array<{
  value: TriggerType; label: string; unit: string; code: string;
  threshold: string; example: string;
}> = [
  { value: 'rainfall', label: 'Heavy Rainfall', unit: 'mm observed', code: 'RF', threshold: '50mm+', example: '65' },
  { value: 'vehicle_accident', label: 'Vehicle Accident', unit: 'severity (1-3)', code: 'AC', threshold: 'Any', example: '1' },
  { value: 'platform_outage', label: 'Platform Outage', unit: 'hours offline', code: 'PO', threshold: '4 hours+', example: '5' },
  { value: 'hospitalization', label: 'Hospitalization', unit: 'admission days', code: 'HS', threshold: 'Any', example: '1' },
];

export default function NewClaimPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    policyId: '',
    triggerType: 'rainfall' as TriggerType,
    triggerValue: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const query = new URLSearchParams(window.location.search);
    const policyIdFromQuery = query.get('policyId');
    if (policyIdFromQuery && !form.policyId) {
      setForm((p) => ({ ...p, policyId: policyIdFromQuery }));
    }
  }, [form.policyId]);

  const currentTrigger = TRIGGER_TYPES.find((t) => t.value === form.triggerType)!;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.policyId.trim()) { toast.error('Policy ID is required'); return; }
    setSubmitting(true);
    try {
      const res = await apiClient.createClaim({
        policyId: form.policyId.trim(),
        triggerType: form.triggerType,
        triggerValue: Number(form.triggerValue),
      });
      toast.success('Claim submitted! AI fraud check is running…');
      router.push('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to file claim');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen finance-grid">
      <header className="sticky top-0 z-20 border-b border-slate-300/40 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4">
          <button type="button" onClick={() => router.back()}
            className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 transition-colors">
            <span className="finance-mono text-xs">BACK</span>
          </button>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Claim intake desk</p>
            <h1 className="font-semibold text-slate-900">File New Claim</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-4xl gap-5 px-4 py-6 lg:grid-cols-[1fr_0.38fr]">
        <section className="space-y-5">
          <Card className="finance-hero border-0 animate-soft-rise">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-amber-200">Field-first claim workflow</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Built for disruption events where every minute of lost shift matters</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <StepChip title="01 Trigger match" text="Event values are checked against policy thresholds" />
                <StepChip title="02 Risk and fairness" text="Models evaluate fraud risk while avoiding harsh false positives" />
                <StepChip title="03 Relief routing" text="Claim moves to approve, review, or block with clear reasoning" />
              </div>
            </CardContent>
          </Card>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Card className="finance-card border-0">
              <CardContent className="space-y-3 p-6">
                <div>
                  <label className="text-sm font-semibold text-slate-900 block mb-1">Policy reference</label>
                  <p className="text-xs text-slate-500 mb-2">Use policy id or policy number from your protection ledger.</p>
                  <Input
                    placeholder="Example: WSP-2026-00125"
                    value={form.policyId}
                    onChange={(e) => setForm((p) => ({ ...p, policyId: e.target.value }))}
                    required
                    className="h-11 finance-mono text-sm"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="finance-card border-0">
              <CardContent className="p-6">
                <label className="text-sm font-semibold text-slate-900 block mb-3">Trigger category</label>
                <div className="grid grid-cols-2 gap-3">
                  {TRIGGER_TYPES.map((trigger) => (
                    <button
                      key={trigger.value}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, triggerType: trigger.value, triggerValue: '' }))}
                      className={`rounded-xl border-2 p-4 text-left transition-all ${
                        form.triggerType === trigger.value
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <p className="finance-mono text-xs uppercase tracking-[0.16em] opacity-80">{trigger.code}</p>
                      <p className={`mt-1 text-sm font-semibold ${form.triggerType === trigger.value ? 'text-white' : 'text-slate-900'}`}>
                        {trigger.label}
                      </p>
                      <p className={`mt-1 text-xs ${form.triggerType === trigger.value ? 'text-slate-300' : 'text-slate-500'}`}>
                        Threshold: {trigger.threshold}
                      </p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="finance-card border-0">
              <CardContent className="space-y-4 p-6">
                <div>
                  <label className="text-sm font-semibold text-slate-900 block mb-1">
                    Observed value ({currentTrigger.unit})
                  </label>
                  <p className="text-xs text-slate-500 mb-2">Required threshold: {currentTrigger.threshold}</p>
                  <Input
                    type="number"
                    min={0}
                    placeholder={currentTrigger.example}
                    value={form.triggerValue}
                    onChange={(e) => setForm((p) => ({ ...p, triggerValue: e.target.value }))}
                    required
                    className="h-11"
                  />
                </div>

                <Separator />

                <div>
                  <label className="text-sm font-semibold text-slate-900 block mb-1">Supporting notes</label>
                  <Textarea
                    placeholder="Optional: event timeline, reference numbers, field notes"
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-amber-700">Outcome preview</p>
                  <p className="text-sm text-amber-800 mt-1">
                    Clean event evidence can auto-route payouts. In weak connectivity scenarios, claims can enter soft review before final settlement.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Button type="submit" disabled={submitting} className="h-12 w-full bg-slate-900 text-white hover:bg-slate-800">
              {submitting ? 'Submitting claim...' : 'Submit claim'}
            </Button>
          </form>
        </section>

        <aside className="space-y-4">
          <Card className="finance-card border-0">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Intake checklist</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>1. Confirm active policy reference</li>
                <li>2. Select trigger category</li>
                <li>3. Enter observed trigger value</li>
                <li>4. Add optional evidence notes</li>
                <li>5. Submit even on weak network; status will sync when connectivity improves</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="finance-card border-0">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Expected processing</p>
              <p className="mt-2 text-sm text-slate-700">Most claims enter pending instantly, then move after trigger verification and risk checks complete.</p>
              <p className="mt-2 finance-mono text-xs text-slate-500">Settlement states: pending, approved, soft_flag, hard_block, paid</p>
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}

function StepChip({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-white/15 bg-white/10 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-300">{title}</p>
      <p className="mt-1 text-xs text-slate-200 sm:text-sm">{text}</p>
    </div>
  );
}
