'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import apiClient from '@/lib/apiClient';
import { useAppStore } from '@/store';

const COVERAGE_OPTIONS = [
  { value: 500,  label: 'â‚¹500',   desc: 'Starter cover' },
  { value: 1000, label: 'â‚¹1,000', desc: 'Basic cover' },
  { value: 2000, label: 'â‚¹2,000', desc: 'Standard cover' },
  { value: 3000, label: 'â‚¹3,000', desc: 'Enhanced cover' },
  { value: 5000, label: 'â‚¹5,000', desc: 'Maximum cover' },
] as const;

const TRIGGERS = [
  { icon: 'ðŸŒ§ï¸', event: 'Heavy Rainfall', condition: '>50mm', payout: '50%' },
  { icon: 'ðŸš—', event: 'Vehicle Accident', condition: 'Any incident', payout: '100%' },
  { icon: 'ðŸ“µ', event: 'Platform Outage', condition: '>4 hours', payout: '30%' },
  { icon: 'ðŸ¥', event: 'Hospitalization', condition: 'Any admission', payout: '100%' },
];

export default function NewPolicyPage() {
  const router = useRouter();
  const currentUser = useAppStore((s) => s.currentUser);

  const [form, setForm] = useState({
    type: 'weekly' as 'weekly' | 'daily',
    coverageAmount: 2000,
  });
  const [quote, setQuote] = useState<number | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleGetQuote = async () => {
    if (!currentUser) return;
    setQuoteLoading(true);
    try {
      const res = await apiClient.getQuote(
        currentUser.weeklyDeliveries,
        currentUser.platform,
        currentUser.riskScore,
      );
      setQuote(res.premium);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to get quote');
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await apiClient.createPolicy(form);
      toast.success(`Policy ${res.policy.policyNumber} is now active! ðŸŽ‰`);
      router.push('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create policy');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="mx-auto max-w-2xl flex items-center gap-3 px-4 h-14">
          <button type="button" onClick={() => router.back()}
            className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors">
            â†
          </button>
          <h1 className="font-bold text-gray-900">New Policy</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-5">
        {/* Policy configuration */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 space-y-5">
            <div>
              <h2 className="font-semibold text-gray-900 mb-1">Policy type</h2>
              <p className="text-xs text-gray-400 mb-3">Choose between weekly and daily cover</p>
              <div className="grid grid-cols-2 gap-3">
                {(['weekly', 'daily'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, type: t }))}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      form.type === t
                        ? 'border-sky-500 bg-sky-50'
                        : 'border-gray-100 bg-white hover:border-gray-200'
                    }`}
                  >
                    <div className="text-xl mb-1">{t === 'weekly' ? 'ðŸ“…' : 'â˜€ï¸'}</div>
                    <div className="font-semibold text-sm capitalize text-gray-900">{t}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{t === 'weekly' ? '7-day coverage' : '1-day coverage'}</div>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <h2 className="font-semibold text-gray-900 mb-1">Coverage amount</h2>
              <p className="text-xs text-gray-400 mb-3">Maximum payout on a full-cover trigger event</p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {COVERAGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, coverageAmount: opt.value }))}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      form.coverageAmount === opt.value
                        ? 'border-sky-500 bg-sky-50'
                        : 'border-gray-100 bg-white hover:border-gray-200'
                    }`}
                  >
                    <div className={`font-bold text-sm ${
                      form.coverageAmount === opt.value ? 'text-sky-600' : 'text-gray-900'
                    }`}>{opt.label}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trigger summary */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Covered triggers</h2>
            <div className="space-y-3">
              {TRIGGERS.map((t) => (
                <div key={t.event} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{t.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{t.event}</p>
                      <p className="text-xs text-gray-400">{t.condition}</p>
                    </div>
                  </div>
                  <Badge className="bg-sky-50 text-sky-700 border-sky-100 text-xs">
                    {t.payout} of â‚¹{form.coverageAmount.toLocaleString('en-IN')}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quote & buy */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 space-y-4">
            {quote !== null ? (
              <div className="rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white p-5 text-center">
                <p className="text-sky-100 text-xs uppercase tracking-wide mb-1">Your AI-calculated premium</p>
                <p className="text-4xl font-bold">â‚¹{quote}</p>
                <p className="text-sky-200 text-sm mt-1">per {form.type === 'weekly' ? 'week' : 'day'}</p>
              </div>
            ) : (
              <div className="rounded-xl bg-gray-50 border border-dashed border-gray-200 p-5 text-center">
                <p className="text-gray-400 text-sm">Click "Get Quote" to calculate your AI-powered premium</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={handleGetQuote} disabled={quoteLoading}
                className="h-11 border-sky-200 text-sky-600 hover:bg-sky-50">
                {quoteLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-sky-300 border-t-sky-600 rounded-full animate-spin" />
                    Calculatingâ€¦
                  </span>
                ) : 'ðŸ§  Get Quote'}
              </Button>
              <Button onClick={handleCreate} disabled={creating || !currentUser}
                className="h-11 bg-sky-500 hover:bg-sky-600 text-white font-semibold">
                {creating ? 'Activatingâ€¦' : 'ðŸ›¡ï¸ Buy Policy'}
              </Button>
            </div>
            <p className="text-xs text-gray-400 text-center">
              Premium is auto-calculated by our AI using your delivery history and risk profile.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

