const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// Creates a Stripe Checkout session for the monthly subscription.
router.post('/create-checkout-session', requireAuth, async (req, res) => {
  if (!stripe || !process.env.STRIPE_PRICE_ID) {
    return res.status(500).json({ error: 'Stripe is not configured on the server yet.' });
  }
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      customer_email: req.user.email,
      client_reference_id: String(req.user.id),
      success_url: `${CLIENT_URL}/?checkout=success`,
      cancel_url: `${CLIENT_URL}/?checkout=cancelled`
    });
    res.json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Raw-body webhook handler — mounted separately in server.js before the JSON body parser.
async function webhookHandler(req, res) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).send('Stripe webhook not configured.');
  }
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.client_reference_id;
    if (userId) {
      db.prepare(
        'UPDATE users SET is_subscribed = 1, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?'
      ).run(session.customer, session.subscription, userId);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    db.prepare(
      'UPDATE users SET is_subscribed = 0 WHERE stripe_subscription_id = ?'
    ).run(sub.id);
  }

  res.json({ received: true });
}

module.exports = { router, webhookHandler };
