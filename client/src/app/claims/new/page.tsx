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
  value: TriggerType; label: string; unit: string; icon: string;
  threshold: string; example: string;
}> = [
  { value: 'rainfall',         label: 'Heavy Rainfall',    unit: 'mm observed',     icon: '🌧️', threshold: '>50mm', example: 'e.g. 65' },
  { value: 'vehicle_accident', label: 'Vehicle Accident',  unit: 'severity (1-3)',  icon: '🚗', threshold: 'Any',   example: 'e.g. 1' },
  { value: 'platform_outage',  label: 'Platform Outage',   unit: 'hours of outage', icon: '📵', threshold: '>4hrs', example: 'e.g. 5' },
  { value: 'hospitalization',  label: 'Hospitalization',   unit: 'days admitted',   icon: '🏥', threshold: 'Any',   example: 'e.g. 1' },
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
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="mx-auto max-w-2xl flex items-center gap-3 px-4 h-14">
          <button type="button" onClick={() => router.back()}
            className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors">
            ←
          </button>
          <h1 className="font-bold text-gray-900">File a Claim</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-5">
        <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 flex gap-3">
          <span className="text-xl">⚡</span>
          <div>
            <p className="text-sm font-semibold text-sky-800">Parametric payout — no paperwork needed</p>
            <p className="text-xs text-sky-600 mt-0.5">Just report the trigger event and observed value. Payout is auto-verified and processed within 24 hours.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Policy ID */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 space-y-3">
              <div>
                <label className="text-sm font-semibold text-gray-900 block mb-1">Policy ID or Policy Number</label>
                <p className="text-xs text-gray-400 mb-2">Use Mongo ID or policy number (WSP-...) from dashboard</p>
                <Input
                  placeholder="e.g. 6848ab3c1f2d4e... or WSP-..."
                  value={form.policyId}
                  onChange={(e) => setForm((p) => ({ ...p, policyId: e.target.value }))}
                  required
                  className="h-11 font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* Trigger event picker */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <label className="text-sm font-semibold text-gray-900 block mb-3">What happened?</label>
              <div className="grid grid-cols-2 gap-3">
                {TRIGGER_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, triggerType: t.value, triggerValue: '' }))}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      form.triggerType === t.value
                        ? 'border-sky-500 bg-sky-50'
                        : 'border-gray-100 bg-white hover:border-gray-200'
                    }`}
                  >
                    <div className="text-2xl mb-2">{t.icon}</div>
                    <div className={`font-semibold text-sm ${
                      form.triggerType === t.value ? 'text-sky-700' : 'text-gray-900'
                    }`}>{t.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">Trigger: {t.threshold}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Observed value */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-900 block mb-1">
                  {currentTrigger.icon} Observed value ({currentTrigger.unit})
                </label>
                <p className="text-xs text-gray-400 mb-2">Trigger activates at: {currentTrigger.threshold}</p>
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
                <label className="text-sm font-semibold text-gray-900 block mb-1">Additional details (optional)</label>
                <Textarea
                  placeholder="Describe what happened — photos, FIR number, hospital name, etc."
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={submitting} className="w-full h-12 bg-sky-500 hover:bg-sky-600 text-white font-semibold text-base">
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Submitting claim…
              </span>
            ) : 'Submit Claim'}
          </Button>

          <p className="text-xs text-gray-400 text-center">
            Claims are AI-verified for fraud detection. Approved claims are paid within 24 hours.
          </p>
        </form>
      </main>
    </div>
  );
}
