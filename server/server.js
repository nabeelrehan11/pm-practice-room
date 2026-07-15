require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const authRoutes = require('./routes/auth');
const interviewRoutes = require('./routes/interview');
const { router: stripeRoutes, webhookHandler } = require('./routes/stripe');

const app = express();
const PORT = process.env.PORT || 3000;

// Stripe webhook needs the raw request body for signature verification,
// so it must be registered BEFORE express.json().
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), webhookHandler);

app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/interview', interviewRoutes);
app.use('/api/stripe', stripeRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

// Serve the frontend
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`PM Practice Room server running on port ${PORT}`);
});
