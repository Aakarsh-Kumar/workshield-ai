'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import apiClient from '@/lib/apiClient';
import { setToken } from '@/lib/auth';
import { useAppStore } from '@/store';

type Mode = 'login' | 'register';
const PLATFORMS = ['swiggy', 'zomato', 'blinkit', 'dunzo', 'other'] as const;

const FEATURES = [
  { icon: 'ðŸŒ§ï¸', label: 'Rainfall protection', desc: '>50mm auto-payout' },
  { icon: 'ðŸš—', label: 'Accident cover', desc: '100% coverage' },
  { icon: 'ðŸ“µ', label: 'Platform outage', desc: '>4hr income relief' },
  { icon: 'ðŸ¥', label: 'Hospitalization', desc: 'Full income cover' },
];

export default function LoginPage() {
  const router = useRouter();
  const loginSuccess = useAppStore((s) => s.loginSuccess);
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '',
    platform: 'swiggy', weeklyDeliveries: 20,
  });

  const set = (field: string, value: string | number) =>
    setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = mode === 'login'
        ? await apiClient.login(form.email, form.password)
        : await apiClient.register(form);
      setToken(res.token);
      loginSuccess(res.user);
      toast.success(`Welcome${res.user.name ? `, ${res.user.name}` : ''}! ðŸŽ‰`);
      router.push('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* â”€â”€ Left hero panel â€” hidden on mobile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-sky-600 via-sky-500 to-blue-600 flex-col justify-between p-12 text-white">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-xl font-bold">W</div>
            <span className="text-xl font-bold tracking-tight">WorkShield AI</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Income protection<br />built for gig workers
          </h1>
          <p className="text-sky-100 text-lg mb-10">
            Automatic payouts when life disrupts your deliveries â€” no forms, no waiting.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f.label} className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="text-2xl mb-2">{f.icon}</div>
                <div className="font-semibold text-sm">{f.label}</div>
                <div className="text-sky-200 text-xs mt-0.5">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-4">
          <div className="w-10 h-10 rounded-full bg-sky-300 flex items-center justify-center text-sky-900 font-bold shrink-0">R</div>
          <div>
            <p className="font-semibold text-sm">"Got â‚¹2,000 within hours of the flood. No questions asked."</p>
            <p className="text-sky-200 text-xs mt-1">Ravi K. â€” Swiggy delivery partner, Bengaluru</p>
          </div>
        </div>
      </div>

      {/* â”€â”€ Right form panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="flex lg:hidden items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-sky-500 flex items-center justify-center text-white text-xl font-bold">W</div>
            <span className="text-xl font-bold text-gray-900">WorkShield AI</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-gray-500 mt-1 text-sm">
              {mode === 'login' ? 'Sign in to manage your coverage' : 'Get covered in under 2 minutes'}
            </p>
          </div>

          <div className="flex p-1 bg-gray-200 rounded-xl mb-6">
            {(['login', 'register'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <Card className="border-0 shadow-xl shadow-gray-200/80">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Full name</label>
                    <Input placeholder="Ravi Kumar" value={form.name}
                      onChange={(e) => set('name', e.target.value)} required className="h-11" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Email address</label>
                  <Input type="email" placeholder="ravi@example.com" value={form.email}
                    onChange={(e) => set('email', e.target.value)} required className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Password</label>
                  <Input type="password" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" value={form.password}
                    onChange={(e) => set('password', e.target.value)} required minLength={6} className="h-11" />
                </div>

                {mode === 'register' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">Phone (optional)</label>
                      <Input type="tel" placeholder="+91 98765 43210" value={form.phone}
                        onChange={(e) => set('phone', e.target.value)} className="h-11" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Platform</label>
                        <Select value={form.platform} onValueChange={(v) => set('platform', v)}>
                          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PLATFORMS.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p.charAt(0).toUpperCase() + p.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Weekly deliveries</label>
                        <Input type="number" min={0} max={200} value={form.weeklyDeliveries}
                          onChange={(e) => set('weeklyDeliveries', Number(e.target.value))}
                          className="h-11" required />
                      </div>
                    </div>
                    <div className="bg-sky-50 border border-sky-100 rounded-lg p-3 text-xs text-sky-700">
                      Your delivery count is used to calculate a personalised weekly premium.
                    </div>
                  </>
                )}

                <Button type="submit" disabled={loading}
                  className="w-full h-11 bg-sky-500 hover:bg-sky-600 text-white font-semibold mt-2 text-base">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Please waitâ€¦
                    </span>
                  ) : (
                    mode === 'login' ? 'Sign In â†’' : 'Get Covered â†’'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-gray-400 mt-6">
            Parametric payouts â€” no claims forms, no waiting
          </p>
        </div>
      </div>
    </div>
  );
}

