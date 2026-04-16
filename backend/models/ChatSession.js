const mongoose = require('mongoose');

/**
 * ChatSession — Stores chat history for a user to provide context to Gemini.
 */
const ChatSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    messages: [
      {
        role: { type: String, enum: ['user', 'model'], required: true },
        parts: [
          {
            text: { type: String, required: true },
          },
        ],
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

// We only keep one session per user for now, or we could have multiple IDs.
// For simplicity, we'll let the controller findOrCreate by userId.

module.exports = mongoose.model('ChatSession', ChatSessionSchema);
