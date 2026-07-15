const express = require('express');
const router = express.Router();
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const CATEGORIES = require('../categories');

const FREE_SESSION_LIMIT = 3;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-6';

async function callClaude(system, messages) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set on the server.');
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 1000, system, messages })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${body}`);
  }
  const data = await res.json();
  const textBlock = data.content.find(b => b.type === 'text');
  if (!textBlock) throw new Error('No text response from model.');
  return textBlock.text.trim();
}

function requireCategory(req, res, next) {
  const { category } = req.body || {};
  if (!category || !CATEGORIES[category]) {
    return res.status(400).json({ error: 'Invalid or missing category.' });
  }
  req.categoryCfg = CATEGORIES[category];
  next();
}

// Start a new mock interview question. Gated by free-session limit / subscription.
router.post('/question', requireAuth, requireCategory, async (req, res) => {
  const user = req.user;
  if (!user.is_subscribed && user.free_sessions_used >= FREE_SESSION_LIMIT) {
    return res.status(402).json({
      error: 'paywall',
      message: `You've used all ${FREE_SESSION_LIMIT} free sessions this month. Subscribe to keep practicing.`
    });
  }
  try {
    const question = await callClaude(req.categoryCfg.sysQuestion, [
      { role: 'user', content: 'Start the mock interview.' }
    ]);
    res.json({ question });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ask a follow-up question given the conversation so far.
router.post('/followup', requireAuth, requireCategory, async (req, res) => {
  const { conversation } = req.body || {};
  if (!Array.isArray(conversation) || conversation.length === 0) {
    return res.status(400).json({ error: 'Conversation history is required.' });
  }
  try {
    const followup = await callClaude(req.categoryCfg.sysFollowup, conversation);
    res.json({ followup });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Score the finished interview, save it, and increment free-session usage.
router.post('/feedback', requireAuth, requireCategory, async (req, res) => {
  const { conversation, category } = req.body || {};
  if (!Array.isArray(conversation) || conversation.length === 0) {
    return res.status(400).json({ error: 'Conversation history is required.' });
  }
  try {
   const raw = await callClaude(req.categoryCfg.sysFeedback, conversation);
      const cleaned = raw.replace(/```json|```/g, '').trim();
      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            parsed = JSON.parse(match[0]);
          } catch (secondErr) {
            throw new Error('Could not parse feedback from the model. Please try again.');
          }
        } else {
          throw new Error('Could not parse feedback from the model. Please try again.');
        }
      }

    db.prepare(
      'INSERT INTO practice_sessions (user_id, category, scores, strengths, improvement) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, category, JSON.stringify(parsed.scores), parsed.strengths, parsed.improvement);

    if (!req.user.is_subscribed) {
      db.prepare('UPDATE users SET free_sessions_used = free_sessions_used + 1 WHERE id = ?').run(req.user.id);
    }

    const updatedUser = db.prepare('SELECT free_sessions_used, is_subscribed FROM users WHERE id = ?').get(req.user.id);

    res.json({
      feedback: parsed,
      free_sessions_used: updatedUser.free_sessions_used,
      is_subscribed: !!updatedUser.is_subscribed
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
