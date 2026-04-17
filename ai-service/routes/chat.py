from flask import Blueprint, jsonify, request

from services.chat_assistant import generate_chat_response

chat_bp = Blueprint('chat', __name__)


@chat_bp.route('/chat', methods=['POST'])
def chat():
    payload = request.get_json(force=True, silent=True) or {}
    messages = payload.get('messages', [])
    user_context = payload.get('user_context', {})
    intent_context = payload.get('intent_context', {})

    if not isinstance(messages, list):
        return jsonify({
            'reply': 'I could not read that chat request.',
            'suggested_actions': ['open_dashboard'],
            'model': 'fallback',
        }), 400

    response = generate_chat_response(messages, user_context, intent_context)
    return jsonify(response)
