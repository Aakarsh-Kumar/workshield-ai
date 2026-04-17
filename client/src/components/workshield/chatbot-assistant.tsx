'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Bot, MessageCircle, Send, Sparkles, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import apiClient, { type ChatMessagePayload, type Claim, type Policy } from '@/lib/apiClient';
import { isAuthenticated } from '@/lib/auth';
import { useAppStore } from '@/store';

type UiMessage = ChatMessagePayload & {
  id: string;
  actions?: string[];
};

const INITIAL_MESSAGE: UiMessage = {
  id: 'assistant-welcome',
  role: 'assistant',
  content: "Okay, I can help with that. Tell me what happened, when it happened, and whether you want help with filing a claim, checking claim status, or understanding your weekly plan.",
};

function buildClaimsSummary(claims: Claim[]) {
  return claims.slice(0, 5).map((claim) => ({
    id: claim._id,
    trigger_type: claim.triggerType,
    status: claim.settlementStatus || claim.status,
    amount: Number(claim.approvedAmount || claim.claimAmount || 0),
    reason_detail: claim.reasonDetail || claim.remarks || '',
    created_at: claim.createdAt,
  }));
}

function buildPolicySummary(policies: Policy[]) {
  return policies.slice(0, 3).map((policy) => ({
    id: policy._id,
    policy_number: policy.policyNumber,
    status: policy.status,
    coverage_amount: policy.coverageAmount,
    premium: policy.premium,
    end_date: policy.endDate,
  }));
}

export function ChatbotAssistant() {
  const router = useRouter();
  const pathname = usePathname();
  const currentUser = useAppStore((state) => state.currentUser);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [contextLoaded, setContextLoaded] = useState(false);

  useEffect(() => {
    if (!open || !isAuthenticated() || contextLoaded) return;

    const loadContext = async () => {
      try {
        const [claimsRes, policiesRes] = await Promise.all([
          apiClient.getClaims(),
          apiClient.getPolicies(),
        ]);
        setClaims(claimsRes.claims);
        setPolicies(policiesRes.policies);
      } finally {
        setContextLoaded(true);
      }
    };

    loadContext().catch(() => undefined);
  }, [contextLoaded, open]);

  const userContext = useMemo(() => ({
    is_authenticated: isAuthenticated(),
    current_user: currentUser ? {
      name: currentUser.name,
      platform: currentUser.platform,
      weekly_deliveries: currentUser.weeklyDeliveries,
    } : null,
    claims_summary: buildClaimsSummary(claims),
    policies_summary: buildPolicySummary(policies),
  }), [claims, currentUser, policies]);

  const intentContext = useMemo(() => ({
    current_page: pathname,
    available_actions: ['open_weekly_plan', 'open_new_claim', 'open_claims', 'open_dashboard'],
  }), [pathname]);

  const handleSuggestedAction = (action: string) => {
    if (action === 'open_weekly_plan') router.push('/policies/new');
    else if (action === 'open_new_claim') router.push('/claims/new');
    else router.push('/dashboard');
    setOpen(false);
  };

  const sendMessage = async (messageContent: string) => {
    const trimmed = messageContent.trim();
    if (!trimmed || sending) return;

    const nextUserMessage: UiMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    const nextMessages = [...messages, nextUserMessage];
    setMessages(nextMessages);
    setInput('');
    setSending(true);

    try {
      const response = await apiClient.chatAssistant({
        messages: nextMessages.map(({ role, content }) => ({ role, content })),
        user_context: userContext,
        intent_context: intentContext,
      });

      setMessages((prev) => [...prev, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        actions: Array.from(new Set(response.suggested_actions)),
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        id: `assistant-fallback-${Date.now()}`,
        role: 'assistant',
        content: 'I am having trouble right now, but I can still guide you manually. Tell me what happened and I will help step by step.',
      }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {open ? (
        <div className="fixed right-4 bottom-24 z-50 w-[min(92vw,480px)] overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
          <div className="bg-slate-950 px-5 py-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-sky-500/20 p-2 text-sky-300">
                  <Bot className="size-5" />
                </div>
                <div>
                  <p className="text-lg font-semibold">WorkShield AI</p>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-sky-200/80">Active support</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[58vh] space-y-4 overflow-y-auto bg-white px-4 py-4">
            {messages.map((message) => (
              <div key={message.id} className={message.role === 'user' ? 'flex justify-end' : 'flex items-start gap-3'}>
                {message.role === 'assistant' ? (
                  <div className="mt-1 rounded-full bg-sky-100 p-2 text-sky-600">
                    <Sparkles className="size-4" />
                  </div>
                ) : null}

                <div className={message.role === 'user' ? 'max-w-[82%]' : 'max-w-[84%] space-y-2'}>
                  <div
                    className={`rounded-[22px] px-4 py-3 text-sm leading-7 ${
                      message.role === 'user'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-700 shadow-[0_10px_25px_rgba(15,23,42,0.06)]'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  </div>

                  {message.actions && message.actions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {message.actions.map((action) => (
                        <button
                          key={`${message.id}-${action}`}
                          type="button"
                          onClick={() => handleSuggestedAction(action)}
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          {labelForAction(action)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {message.role === 'user' ? (
                  <div className="mt-1 rounded-full bg-slate-100 p-2 text-slate-500">
                    <User className="size-4" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage(input).catch(() => undefined);
            }}
            className="border-t border-slate-200 bg-white p-4"
          >
            <div className="flex items-center gap-3">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Type your message..."
                disabled={sending}
                className="h-12 rounded-full border-slate-200 px-5"
              />
              <Button
                type="submit"
                disabled={sending || !input.trim()}
                className="size-12 rounded-full bg-sky-400 text-white hover:bg-sky-500"
              >
                <Send className="size-4" />
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="fixed right-5 bottom-5 z-40 flex size-16 items-center justify-center rounded-full bg-slate-950 text-white shadow-[0_18px_40px_rgba(15,23,42,0.22)] transition hover:bg-slate-900"
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>
    </>
  );
}

function labelForAction(action: string) {
  if (action === 'open_weekly_plan') return 'Open weekly plan';
  if (action === 'open_new_claim') return 'Open claim form';
  if (action === 'open_claims') return 'Open dashboard';
  return 'Open dashboard';
}
