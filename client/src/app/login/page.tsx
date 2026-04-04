'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import apiClient from '@/lib/apiClient';
import { setToken } from '@/lib/auth';
import { useAppStore } from '@/store';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const loginSuccess = useAppStore((s) => s.loginSuccess);

  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });

  const set = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response =
        mode === 'login'
          ? await apiClient.login(form.email, form.password)
          : await apiClient.register({
              name: form.name,
              email: form.email,
              password: form.password,
              phone: form.phone || undefined,
              platform: 'other',
              weeklyDeliveries: 0,
            });

      setToken(response.token);
      loginSuccess(response.user);
      toast.success(mode === 'login' ? 'Signed in' : 'Account created');
      router.push('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not continue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-xl px-4 py-8 sm:py-14">
        <section className="animate-soft-rise">
          <div className="mb-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              WorkShield
            </div>

            <h1 className="mt-4 text-3xl font-semibold text-slate-900 sm:text-4xl">
              Protect weekly income in one simple app.
            </h1>

            <p className="mt-3 text-sm text-slate-600 sm:text-base">
              Buy weekly cover, file claims fast, and track payout status live.
            </p>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-700">Rain</span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">App down</span>
              <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700">Accident</span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Hospital</span>
            </div>
          </div>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                {(['login', 'register'] as Mode[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMode(item)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      mode === item ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {item === 'login' ? 'Sign in' : 'New user'}
                  </button>
                ))}
              </div>

              <h2 className="text-2xl font-semibold text-slate-900">{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {mode === 'login' ? 'Use email and password.' : 'Only basic details needed.'}
              </p>

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                {mode === 'register' && (
                  <Field label="Name">
                    <Input
                      value={form.name}
                      onChange={(e) => set('name', e.target.value)}
                      placeholder="Ravi Kumar"
                      required
                      className="h-11"
                    />
                  </Field>
                )}

                <Field label="Email">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    placeholder="worker@example.com"
                    required
                    className="h-11"
                  />
                </Field>

                <Field label="Password">
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    placeholder="Minimum 8 characters"
                    required
                    minLength={8}
                    className="h-11"
                  />
                </Field>

                {mode === 'register' && (
                  <Field label="Phone (optional)">
                    <Input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => set('phone', e.target.value)}
                      placeholder="+91 90000 00000"
                      className="h-11"
                    />
                  </Field>
                )}

                <Button type="submit" disabled={loading} className="h-11 w-full bg-slate-900 text-white hover:bg-slate-800">
                  {loading
                    ? mode === 'login'
                      ? 'Signing in...'
                      : 'Creating account...'
                    : mode === 'login'
                      ? 'Sign in'
                      : 'Create account'}
                </Button>
              </form>

              <p className="mt-4 text-center text-xs text-slate-500">
                Trusted payouts with clear status and audit trail.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}
