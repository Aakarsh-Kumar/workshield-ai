const { GoogleGenerativeAI } = require('@google/generative-ai');
const ChatSession = require('../models/ChatSession');
const Policy = require('../models/Policy');
const Claim = require('../models/Claim');
const { createPolicy } = require('../services/policyService');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ---------------- SYSTEM PROMPT ----------------
const SYSTEM_INSTRUCTIONS = `
You are WorkShield AI, an intelligent assistant inside an insurance application for gig workers.

Your role is to help users:
- understand parametric insurance
- choose the right plan
- guide them to buy plans
- guide them to file claims
- answer insurance-related questions clearly

----------------------------------------

IMPORTANT BEHAVIOR RULES:

1. PRODUCT CONTEXT
- This is NOT a general chatbot.
- Only talk about WorkShield insurance.
- Do NOT ask what kind of plan the user means.
- Assume the user is referring to WorkShield plans.

2. AVAILABLE PLANS
- Basic Plan → ₹1000/week
- Plus Plan → ₹2500/week
- Pro Plan → ₹5000/week

Each plan protects against:
- rainfall
- vehicle accidents
- platform outages
- hospitalization

3. WHEN USER WANTS TO BUY
If user says things like:
- "plus plan"
- "buy plus"
- "i want plus"

Respond like:
"Great choice. The Plus Plan offers ₹2500 weekly coverage. You can activate it now."

DO NOT say:
- "Which service?"
- "What do you mean?"

4. WHEN USER TALKS ABOUT CLAIMS
Explain briefly:
"Claims are triggered automatically based on real-world events like rainfall or accidents."

If user gives an event:
- "rainfall 60mm"
- "vehicle accident"
→ guide them to file claim

5. KEEP RESPONSES SHORT
- Max 2–3 lines
- Clear and direct
- No long paragraphs

6. DO NOT:
- Ask unnecessary clarification questions
- Talk about unrelated topics
- Mention being an AI model
- Give generic ChatGPT-style answers

7. TONE
- Friendly
- Confident
- Professional
- Helpful

----------------------------------------

EXAMPLES:

User: "plus plan"
→ "The Plus Plan gives ₹2500 weekly coverage. You can activate it now."

User: "what is parametric insurance?"
→ "Parametric insurance pays automatically when a condition is met, like heavy rainfall or an accident."

User: "rainfall 70mm"
→ "That qualifies for a claim based on rainfall. You can proceed to file it."

----------------------------------------

Always behave like a smart assistant inside an insurance product.
`;

// ---------------- UTIL ----------------
const ALL_TRIGGERS = [
  "rainfall",
  "vehicle_accident",
  "platform_outage",
  "hospitalization"
];

// ---------------- TOOL EXECUTION ----------------
const runTool = async (userId, call) => {
  try {
    const { name, args } = call;

    // ---------- CREATE POLICY ----------
    if (name === "create_insurance_policy") {
      const policy = await createPolicy(userId, {
        type: "weekly",
        coverageAmount: args.coverageAmount,
        triggerConfig: args.triggerTypes.map(t => ({
          type: t,
          threshold: 0,
          payoutRatio: 1,
        })),
        status: "active"
      });

      return {
        success: true,
        policyNumber: policy.policyNumber
      };
    }

    // ---------- FILE CLAIM ----------
    if (name === "file_claim") {

      // 🔥 IMPORTANT FIX (no status filter)
      const policies = await Policy.find({ userId, status: "active" })
        .sort({ createdAt: -1 });

      if (!policies) {
        return { success: false, error: "No policy found" };
      }

      const claim = await Claim.create({
        userId,
        policyId: policy._id,
        triggerType: args.triggerType,
        observedValue: args.observedValue,
        notes: args.notes || "",
        status: "pending"
      });

      return {
        success: true,
        claimId: claim._id
      };
    }

    return { success: false, error: "Unknown tool" };

  } catch (err) {
    console.error("❌ TOOL ERROR:", err);
    return { success: false, error: err.message };
  }
};

// ---------------- MAIN CONTROLLER ----------------
const sendMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const message = req.body.message;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message required"
      });
    }

    const lower = message.toLowerCase().trim();

    // =========================================================
    // ================= PLAN HANDLING ==========================
    // =========================================================

    if (lower.includes("plus")) {
      await runTool(userId, {
        name: "create_insurance_policy",
        args: {
          coverageAmount: 2500,
          triggerTypes: ALL_TRIGGERS
        }
      });

      return res.json({
        success: true,
        reply: "Plus plan activated (₹2500/week)."
      });
    }

    if (lower.includes("basic")) {
      await runTool(userId, {
        name: "create_insurance_policy",
        args: {
          coverageAmount: 1000,
          triggerTypes: ALL_TRIGGERS
        }
      });

      return res.json({
        success: true,
        reply: "Basic plan activated (₹1000/week)."
      });
    }

    if (lower.includes("pro")) {
      await runTool(userId, {
        name: "create_insurance_policy",
        args: {
          coverageAmount: 5000,
          triggerTypes: ALL_TRIGGERS
        }
      });

      return res.json({
        success: true,
        reply: "Pro plan activated (₹5000/week)."
      });
    }

    // =========================================================
    // ================= CLAIM HANDLING =========================
    // =========================================================

    if (lower.includes("accident") && !lower.match(/\d+/)) {
      return res.json({
        success: true,
        reply: "Provide value (e.g., 'vehicle accident 1')"
      });
    }
    // ---------------- CLAIM WITHOUT NUMBER ----------------
    if (lower.includes("hospital") && !lower.match(/\d+/)) {
      return res.json({
        success: true,
        reply: "Please provide value (e.g., 'hospital 1 day')."
      });
    }

    if ((lower.includes("rain") || lower.includes("accident") || lower.includes("app") || lower.includes("hospital"))
      && !lower.match(/\d+/)) {
      return res.json({
        success: true,
        reply: "Please include a value (e.g., 'rainfall 60', 'accident 1')."
      });
    }
    const numberMatch = lower.match(/\d+/);

    if (numberMatch) {
      const value = parseInt(numberMatch[0]);

      let triggerType = null;

      if (lower.includes("rain")) triggerType = "rainfall";
      else if (lower.includes("accident")) triggerType = "vehicle_accident";
      else if (lower.includes("app") || lower.includes("outage")) triggerType = "platform_outage";
      else if (lower.includes("hospital")) triggerType = "hospitalization";

      if (triggerType) {
        const result = await runTool(userId, {
          name: "file_claim",
          args: {
            triggerType,
            observedValue: value
          }
        });

        if (!result.success) {
          return res.json({
            success: false,
            reply: result.error
          });
        }

        return res.json({
          success: true,
          reply: `Claim filed for ${triggerType.replace("_", " ")} (${value})`
        });
      }
    }

    // =========================================================
    // ================= SESSION ================================
    // =========================================================

    let session = await ChatSession.findOne({ userId });

    if (!session) {
      session = await ChatSession.create({
        userId,
        messages: []
      });
    }

    const history = session.messages.map(m => ({
      role: m.role,
      parts: m.parts
    }));

    // =========================================================
    // ================= GEMINI ================================
    // =========================================================

    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-lite",
        systemInstruction: SYSTEM_INSTRUCTIONS
      });

      const chat = model.startChat({ history });

      const result = await chat.sendMessage(message);
      const response = result.response;
      const text = response.text() || "Done.";

      // -------- SAVE HISTORY --------
      session.messages.push({
        role: "user",
        parts: [{ text: message }]
      });

      session.messages.push({
        role: "model",
        parts: [{ text }]
      });

      if (session.messages.length > 20) {
        session.messages = session.messages.slice(-20);
      }

      await session.save();

      return res.json({
        success: true,
        reply: text
      });

    } catch (err) {
      console.error("❌ GEMINI ERROR:", err);

      return res.json({
        success: true,
        reply: "Ask about plans or claims."
      });
    }

  } catch (err) {
    console.error("❌ CONTROLLER ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ---------------- HISTORY ----------------
const getHistory = async (req, res) => {
  try {
    const session = await ChatSession.findOne({
      userId: req.user.id
    }).lean();

    return res.json({
      success: true,
      messages: session?.messages || []
    });

  } catch (err) {
    console.error("❌ HISTORY ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch history"
    });
  }
};

module.exports = {
  sendMessage,
  getHistory
};