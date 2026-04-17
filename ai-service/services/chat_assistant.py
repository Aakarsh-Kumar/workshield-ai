import json
import os
from typing import Any

import google.generativeai as genai

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
GEMINI_CHAT_MODEL = os.environ.get('GEMINI_CHAT_MODEL', 'gemini-2.0-flash-lite')

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


def _latest_user_message(messages: list[dict[str, Any]]) -> str:
    for message in reversed(messages):
        if str(message.get('role', '')).lower() == 'user':
            return str(message.get('content', '')).strip()
    return ''


def _previous_user_message(messages: list[dict[str, Any]]) -> str:
    user_messages = [
        str(message.get('content', '')).strip()
        for message in messages
        if str(message.get('role', '')).lower() == 'user'
    ]
    if len(user_messages) < 2:
        return ''
    return user_messages[-2]


def _fallback_response(messages: list[dict[str, Any]], user_context: dict[str, Any] | None) -> dict[str, Any]:
    latest = _latest_user_message(messages).lower()
    previous = _previous_user_message(messages).lower()
    is_authenticated = bool((user_context or {}).get('is_authenticated'))
    claims = (user_context or {}).get('claims_summary') or []
    latest_claim = claims[0] if claims else None

    if 'flood' in latest and ('not' in latest or 'false' in latest or 'lying' in latest):
        return {
            'reply': 'A false flood claim should not be approved. WorkShield checks event-based claims against trusted signals like weather, GPS, status data, and documents. If the evidence does not match, the claim can be rejected, blocked for fraud, or sent to manual review. If you want, I can help you identify which claim type actually fits what happened.',
            'suggested_actions': [],
            'model': 'fallback',
        }

    if 'claim status' in latest or (latest == 'status') or ('status' in latest and 'claim' in latest):
        if is_authenticated and latest_claim:
            return {
                'reply': f"Your latest claim looks {latest_claim.get('status', 'pending')}. It was filed for {latest_claim.get('trigger_type', 'an event')}, and the current note says: {latest_claim.get('reason_detail', 'still being processed')}. If you want, I can also explain what that status means.",
                'suggested_actions': [],
                'model': 'fallback',
            }
        if is_authenticated:
            return {
                'reply': 'I do not see any claims on your account yet. If an event happened, I can help you figure out which claim type to file and what evidence you will need.',
                'suggested_actions': [],
                'model': 'fallback',
            }
        return {
            'reply': 'I can explain claim statuses, but I need you to be signed in to check your actual claim history. If you want, I can still explain what pending, review, approved, and paid mean.',
            'suggested_actions': [],
            'model': 'fallback',
        }

    if 'plan' in latest or 'premium' in latest or 'weekly' in latest:
        return {
            'reply': 'I can help with that. A weekly plan protects income against triggers like rainfall, outage, traffic, accident, or hospitalization. If you want, tell me your platform and how many deliveries you usually complete in a week, and I will explain what kind of plan makes sense before you buy.',
            'suggested_actions': [],
            'model': 'fallback',
        }

    if 'claim' in latest or 'file' in latest:
        if any(keyword in latest for keyword in ['rain', 'rainfall', 'flood']):
            return {
                'reply': 'This sounds like a weather-related claim. I need 3 things from you: what happened exactly, when it happened, and whether your location access was on at that time. If this was heavy rainfall, WorkShield will verify it from GPS and weather data rather than a manual claim amount.',
                'suggested_actions': [],
                'model': 'fallback',
            }
        if any(keyword in latest for keyword in ['outage', 'app down', 'swiggy down', 'zomato down', 'platform']):
            return {
                'reply': 'This sounds like a platform outage claim. Tell me which platform was affected and the approximate start and end time of the outage. I will then guide you on whether it fits the outage workflow.',
                'suggested_actions': [],
                'model': 'fallback',
            }
        if any(keyword in latest for keyword in ['traffic', 'congestion', 'jam']):
            return {
                'reply': 'This sounds like a traffic congestion claim. Tell me the city, the rough time window, and whether location tracking was on. WorkShield verifies congestion from route pings and traffic delay, so I can help you check whether it is likely to qualify.',
                'suggested_actions': [],
                'model': 'fallback',
            }
        if any(keyword in latest for keyword in ['accident', 'crash']):
            return {
                'reply': 'This sounds like an accident claim. Tell me when it happened and what proof you have, such as photos, FIR, repair estimate, or hospital documents. I can then guide you on the right claim path.',
                'suggested_actions': [],
                'model': 'fallback',
            }
        if any(keyword in latest for keyword in ['hospital', 'hospitalization', 'admitted', 'admission']):
            return {
                'reply': 'This sounds like a hospitalization claim. Tell me when you were admitted and what documents you have, like discharge summary, prescription, or bills. I will help you figure out the next step.',
                'suggested_actions': [],
                'model': 'fallback',
            }
        return {
            'reply': 'I can help file the right claim, but first I need to identify the event. Was it rainfall, platform outage, traffic congestion, vehicle accident, or hospitalization? Also tell me roughly when it happened.',
            'model': 'fallback',
            'suggested_actions': [],
        }

    if previous and ('claim' in previous or 'file' in previous):
        if any(keyword in latest for keyword in ['rain', 'rainfall', 'flood']):
            return {
                'reply': 'Understood. If you are saying this was rainfall, keep location access on and be ready to share when it happened. WorkShield checks rainfall from trusted weather data plus your recent GPS ping. If the weather signal does not match, the claim can be rejected. Tell me the time window next.',
                'suggested_actions': [],
                'model': 'fallback',
            }
        if any(keyword in latest for keyword in ['outage', 'platform', 'app down']):
            return {
                'reply': 'Understood. For an outage claim, I need the platform name and the start and end time of the outage. WorkShield compares that against platform status data, so the timing matters.',
                'suggested_actions': [],
                'model': 'fallback',
            }
        if any(keyword in latest for keyword in ['traffic', 'congestion', 'jam']):
            return {
                'reply': 'Understood. For a traffic claim, I need the city, the delayed time window, and whether tracking was active. The system verifies your extra delay from route pings and traffic baseline data.',
                'suggested_actions': [],
                'model': 'fallback',
            }

    return {
        'reply': 'I can help with plans, claims, and claim status. Tell me what happened, and I will guide you step by step instead of just sending you to another page.',
        'suggested_actions': [],
        'model': 'fallback',
    }


def _build_prompt(messages: list[dict[str, Any]], user_context: dict[str, Any] | None, intent_context: dict[str, Any] | None) -> str:
    return f"""
You are WorkShield Assistant, a concise product assistant for an Indian gig-worker insurance app.

Your job is to help users with:
- buying or understanding a weekly plan
- filing a claim
- checking claim status
- explaining app workflows

Rules:
- Be concise, warm, practical, and conversational.
- Do not act like a link bot.
- If the user wants to file a claim, first help identify the correct claim type and ask for the minimum missing details.
- For claims, guide step by step: identify event type, ask time window, ask whether location tracking was on, and ask what evidence/documents the user has when relevant.
- If the user asks a risky or false-claim question, explain that verification checks can reject or block mismatched claims.
- Only suggest navigation actions if the user explicitly asks to open a page or after you have already guided them and navigation is the natural next step.
- Ground claim-status answers only in the provided user_context.
- Do not invent policies, claims, or account state.
- If no reliable account context exists, say so plainly and guide the user to the right page.
- Keep replies under 120 words.
- Return ONLY valid JSON with this schema:
{{
  "reply": "string",
  "suggested_actions": ["open_claims" | "open_new_claim" | "open_weekly_plan" | "open_dashboard"]
}}

intent_context:
{json.dumps(intent_context or {}, ensure_ascii=True)}

user_context:
{json.dumps(user_context or {}, ensure_ascii=True)}

messages:
{json.dumps(messages, ensure_ascii=True)}
""".strip()


def generate_chat_response(messages: list[dict[str, Any]], user_context: dict[str, Any] | None, intent_context: dict[str, Any] | None) -> dict[str, Any]:
    if not GEMINI_API_KEY:
        return _fallback_response(messages, user_context)

    prompt = _build_prompt(messages, user_context, intent_context)

    try:
        model = genai.GenerativeModel(GEMINI_CHAT_MODEL)
        response = model.generate_content(prompt)
        raw_text = (response.text or '').strip()
        if raw_text.startswith('```'):
            lines = raw_text.splitlines()
            raw_text = '\n'.join(lines[1:-1]).strip()
        parsed = json.loads(raw_text)
        reply = str(parsed.get('reply', '')).strip()
        suggested_actions = parsed.get('suggested_actions', [])
        if not reply:
            raise ValueError('empty reply')
        if not isinstance(suggested_actions, list):
            suggested_actions = []
        return {
            'reply': reply,
            'suggested_actions': [str(action) for action in suggested_actions[:3]],
            'model': GEMINI_CHAT_MODEL,
        }
    except Exception:
        return _fallback_response(messages, user_context)
