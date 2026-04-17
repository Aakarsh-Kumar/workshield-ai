const { GoogleGenerativeAI } = require('@google/generative-ai');
const ChatSession = require('../models/ChatSession');
const Policy = require('../models/Policy');
const Claim = require('../models/Claim');
const { createPolicy } = require('../services/policyService');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Define the system instructions for WorkShield AI Bot
const SYSTEM_INSTRUCTIONS = `
You are the WorkShield AI Assistant, a helpful and professional expert in parametric insurance for gig economy workers.
Your goal is to help workers protect their earnings from unpredictable events like heavy rain, platform outages, accidents, or hospitalization.

Capabilities:
1. YOU CAN LOOK UP THE USER'S POLICIES.
2. YOU CAN LOOK UP THE USER'S CLAIMS.
3. YOU CAN CREATE A NEW INSURANCE POLICY.

IMPORTANT RULES:
- When creating a policy, DO NOT use default values. You MUST ASK the user for:
    a) Policy Type (daily or weekly)
    b) Coverage Amount (in INR, minimum 100)
    c) Trigger Types they want (rainfall, vehicle_accident, platform_outage, hospitalization)
- Always use INR for currency.
- If the user asks general insurance questions, answer them based on parametric insurance principles (automatic payout based on data triggers).
- Be concise but friendly.
- If the user is confused, explain that parametric insurance pays out automatically when a trigger (like 50mm rainfall) is met.
`;

/**
 * Gemini Tools (Function Calling)
 */
const tools = [
  {
    functionDeclarations: [
      {
        name: 'list_my_policies',
        description: 'Get a list of the users active and past insurance policies.',
      },
      {
        name: 'list_my_claims',
        description: 'Get a list of the users insurance claims and their current status.',
      },
      {
        name: 'create_insurance_policy',
        description: 'Create a new insurance policy for the user. Requires all details to be gathered from the user first.',
        parameters: {
          type: 'OBJECT',
          properties: {
            type: { type: 'STRING', enum: ['daily', 'weekly'], description: 'The duration of the policy.' },
            coverageAmount: { type: 'NUMBER', description: 'The amount of coverage in INR.' },
            triggerTypes: {
              type: 'ARRAY',
              items: { type: 'STRING', enum: ['rainfall', 'vehicle_accident', 'platform_outage', 'hospitalization'] },
              description: 'The types of events that trigger a payout.'
            },
          },
          required: ['type', 'coverageAmount', 'triggerTypes'],
        },
      },
    ],
  },
];

/**
 * POST /api/chat/message
 */
exports.sendMessage = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message is required' });

    // Check for API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_actual_gemini_api_key_here') {
      const debugInfo = apiKey ? `Found dummy key (length: ${apiKey.length})` : 'Key is UNDEFINED';
      throw new Error(`GEMINI_API_KEY is missing. Debug: ${debugInfo}. Check Docker Compose environment mapping.`);
    }

    // 1. Get or create history
    let session = await ChatSession.findOne({ userId: req.user.id });
    if (!session) {
      session = await ChatSession.create({ userId: req.user.id, messages: [] });
    }

    // 1. Initialize Gemini using v1 (more stable for standard accounts)
    const model = genAI.getGenerativeModel(
      { model: 'gemini-2.5-flash-lite' },
      { apiVersion: 'v1' }
    );
    const chat = model.startChat({ history: [] });

    // 2. Send message
    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text() || "I heard you, but my response was empty.";

    res.json({ success: true, reply: text });
  } catch (err) {
    console.error('CRITICAL Chat Error:', err);
    res.status(500).json({
      success: false,
      message: `AI Error: ${err.message || 'Unknown error'}`
    });
  }
};

/**
 * GET /api/chat/history
 */
exports.getHistory = async (req, res) => {
  try {
    const session = await ChatSession.findOne({ userId: req.user.id }).lean();
    res.json({ success: true, messages: session?.messages || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch chat history' });
  }
};
