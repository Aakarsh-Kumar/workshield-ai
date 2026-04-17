'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import apiClient from '@/lib/apiClient';
import { useAppStore } from '@/store';

const WEEKLY_PLANS = [
  { id: 'basic', cover: 1000, label: 'Basic', note: 'Good for light weekly support', services: ['Rainfall', 'Platform outage'] },
  { id: 'plus', cover: 2500, label: 'Plus', note: 'Best balance for active workers', services: ['Rainfall', 'Platform outage', 'Vehicle accident', 'Hospitalization'] },
  { id: 'pro', cover: 5000, label: 'Pro', note: 'High income protection', services: ['Rainfall', 'Platform outage', 'Vehicle accident', 'Hospitalization', 'Traffic congestion'] },
] as const;

type WeeklyPlan = (typeof WEEKLY_PLANS)[number];

const TRIGGERS = [
  { name: 'Rain', detail: 'Heavy rain in your work zone', style: 'ws-chip-rain' },
  { name: 'App down', detail: 'Platform outage for long hours', style: 'ws-chip-outage' },
  { name: 'Accident', detail: 'Verified vehicle incident', style: 'ws-chip-accident' },
  { name: 'Hospital', detail: 'Inpatient hospitalization event', style: 'ws-chip-health' },
  { name: 'Traffic', detail: 'Severe congestion delay', style: 'bg-fuchsia-100 text-fuchsia-700' },
];

export default function NewPolicyPage() {
  const router = useRouter();
  const currentUser = useAppStore((state) => state.currentUser);

  const [selectedPlan, setSelectedPlan] = useState<WeeklyPlan>(WEEKLY_PLANS[1]);
  const [quote, setQuote] = useState<number | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const effectiveDeliveries = currentUser?.weeklyDeliveries ?? 0;
  const effectivePlatform = currentUser?.platform ?? 'other';
  const effectiveRisk = currentUser?.riskScore ?? 0.5;

  const priceHint = useMemo(() => {
    if (effectiveRisk >= 0.7) return 'Higher risk week, premium may increase';
    if (effectiveRisk >= 0.3) return 'Medium risk week, normal premium band';
    return 'Lower risk week, better premium band';
  }, [effectiveRisk]);

  const tierBadge = selectedPlan.id === 'basic'
    ? 'Essential triggers'
    : selectedPlan.id === 'plus'
      ? 'Expanded protection'
      : 'Full trigger access';

  const handleQuote = async () => {
    setQuoteLoading(true);
    try {
      const result = await apiClient.getQuote(
        effectiveDeliveries,
        effectivePlatform,
        selectedPlan.cover,
        effectiveRisk,
      );
      setQuote(result.premium);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not get quote');
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleBuy = async () => {
    setCreating(true);
    try {
      const response = await apiClient.createPolicy({
        type: 'weekly',
        coverageAmount: selectedPlan.cover,
      });
      toast.success(`Plan active: ${response.policy.policyNumber}`);
      router.push('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not buy plan');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen finance-grid">
      <header className="sticky top-0 z-20 border-b border-slate-300/40 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Weekly plans</p>
            <h1 className="text-sm font-semibold text-slate-900">Pick your weekly protection</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>Back</Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-5">
        <Card className="border-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white">
          <CardContent className="p-5">
            <p className="text-sm text-slate-100">
              All plans are weekly. Claims are checked automatically from trigger data. You can always see status in dashboard.
            </p>

            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {TRIGGERS.map((item) => (
                <span key={item.name} className={`${item.style} rounded-full px-3 py-1`}>
                  {item.name}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-3 sm:grid-cols-3">
          {WEEKLY_PLANS.map((plan) => {
            const selected = selectedPlan.id === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedPlan(plan)}
                className={`rounded-2xl border p-4 text-left transition ${selected
                    ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                    : 'border-slate-200 bg-white hover:border-slate-400'
                  }`}
              >
                <p className={`text-xs uppercase tracking-[0.16em] ${selected ? 'text-slate-300' : 'text-slate-500'}`}>{plan.label}</p>
                <p className={`mt-1 text-2xl font-semibold ${selected ? 'text-white' : 'text-slate-900'}`}>
                  INR {plan.cover.toLocaleString('en-IN')}
                </p>
                <p className={`mt-2 text-sm ${selected ? 'text-slate-200' : 'text-slate-600'}`}>{plan.note}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {plan.services.map((service) => (
                    <span
                      key={`${plan.id}-${service}`}
                      className={`rounded-full px-2 py-1 ${selected ? 'bg-white/10 text-slate-100' : 'bg-slate-100 text-slate-700'}`}
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </section>

        <Card className="ws-card border-0">
          <CardContent className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Plan selected</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{selectedPlan.label} · INR {selectedPlan.cover.toLocaleString('en-IN')}</p>
                <p className="mt-1 text-xs font-medium text-slate-700">{tierBadge}</p>
                <p className="mt-1 text-xs text-slate-600">Coverage refreshes every 7 days.</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Premium band hint</p>
                <p className="mt-1 text-sm font-medium text-slate-800">{priceHint}</p>
                <p className="mt-1 text-xs text-slate-600">Based on activity and risk profile.</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Included claim triggers</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedPlan.services.map((service) => (
                  <span key={`selected-${service}`} className="rounded-full bg-white px-3 py-1 text-xs text-slate-700">
                    {service}
                  </span>
                ))}
              </div>
            </div>

            {quote != null ? (
              <div className="rounded-xl bg-emerald-50 p-4 text-center">
                <p className="text-xs uppercase tracking-[0.12em] text-emerald-700">Weekly premium</p>
                <p className="mt-1 text-3xl font-semibold text-emerald-700">INR {quote}</p>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-sm text-slate-600">
                Tap &quot;Get weekly quote&quot; to see premium.
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleQuote} disabled={quoteLoading} className="h-11">
                {quoteLoading ? 'Getting quote...' : 'Get weekly quote'}
              </Button>
              <Button onClick={handleBuy} disabled={creating} className="h-11 bg-slate-900 text-white hover:bg-slate-800">
                {creating ? 'Buying...' : 'Buy now'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
