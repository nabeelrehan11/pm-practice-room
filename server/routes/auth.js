const express = require('express');
const router = express.Router();
const db = require('../db');
const { hashPassword, verifyPassword, signToken } = require('../auth');
const requireAuth = require('../middleware/requireAuth');

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
};

router.post('/signup', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }
  const hash = hashPassword(password);
  const result = db.prepare(
    'INSERT INTO users (email, password_hash) VALUES (?, ?)'
  ).run(email.toLowerCase(), hash);

  const token = signToken(result.lastInsertRowid);
  res.cookie('token', token, COOKIE_OPTS);
  res.json({ email: email.toLowerCase(), is_subscribed: false, free_sessions_used: 0 });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  const token = signToken(user.id);
  res.cookie('token', token, COOKIE_OPTS);
  res.json({
    email: user.email,
    is_subscribed: !!user.is_subscribed,
    free_sessions_used: user.free_sessions_used
  });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, secure: COOKIE_OPTS.secure, sameSite: COOKIE_OPTS.sameSite });
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const sessions = db.prepare(
    'SELECT category, scores, created_at FROM practice_sessions WHERE user_id = ? ORDER BY created_at ASC'
  ).all(req.user.id);

  res.json({
    email: req.user.email,
    is_subscribed: !!req.user.is_subscribed,
    free_sessions_used: req.user.free_sessions_used,
    sessions_count: sessions.length,
    sessions: sessions.map(s => ({ ...s, scores: JSON.parse(s.scores) }))
  });
});

module.exports = router;
