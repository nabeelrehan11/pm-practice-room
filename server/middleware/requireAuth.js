const { verifyToken } = require('../auth');
const db = require('../db');

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: 'Not logged in.' });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId);
  if (!user) {
    return res.status(401).json({ error: 'Account not found.' });
  }
  req.user = user;
  next();
}

module.exports = requireAuth;
