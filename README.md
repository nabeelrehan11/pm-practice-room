# PM Interview Practice Room

A working full-stack app: accounts, a free-session paywall, Stripe subscriptions, and an AI-powered
mock interview engine covering Product Sense, Execution & Metrics, Strategy, and Behavioral rounds.

This has been tested locally and works. To make it a real, live product, you need to deploy it and
connect three external services: Anthropic (for the AI), Stripe (for payments), and a hosting
platform. None of these require coding — just following the steps below.

---

## What's in here

```
server/       — the backend (Node.js + Express + SQLite)
public/       — the frontend (plain HTML/JS, no build step needed)
```

The backend serves the frontend itself, so this deploys as a single service.

---

## Step 1 — Get an Anthropic API key

1. Go to https://console.anthropic.com and sign up / log in.
2. Go to **API Keys** and create a new key.
3. Copy it — you'll paste it into your hosting platform's environment variables in Step 3.

**Note on cost:** unlike using Claude.ai directly, this key is billed per API call at Anthropic's
API rates. Each mock interview uses about 4 short model calls. Check current pricing at
https://www.anthropic.com/pricing before launching, and keep an eye on usage early on.

## Step 2 — Set up Stripe

1. Go to https://dashboard.stripe.com and create an account.
2. Under **Product catalog**, create a product (e.g. "Practice Room Unlimited") with a recurring
   monthly price. Copy the **Price ID** (starts with `price_...`).
3. Under **Developers → API keys**, copy your **Secret key** (starts with `sk_...`).
4. Under **Developers → Webhooks**, add an endpoint pointing to:
   `https://YOUR-DEPLOYED-URL/api/stripe/webhook`
   Subscribe it to these events: `checkout.session.completed`, `customer.subscription.deleted`.
   Copy the **Signing secret** (starts with `whsec_...`) — you'll need it in Step 3.
   (You can only get the real webhook URL after Step 3, since you need to know your deployed URL first —
   it's fine to come back and finish this part after deploying.)

## Step 3 — Deploy

The easiest option for a first launch is **Railway** (railway.app) — it has a free trial tier and
handles a Node.js app with a file-based database with no configuration.

1. Push this project to a GitHub repository (create a free GitHub account if you don't have one,
   create a new repository, and upload this folder — GitHub's website lets you drag-and-drop files,
   no command line required).
2. Go to https://railway.app, sign up, and choose **Deploy from GitHub repo**. Select your repo.
3. Railway will detect the `server` folder — set the **Root Directory** to `server` in the service
   settings, and the **Start Command** to `npm install && npm start`.
4. In the service's **Variables** tab, add all the variables from `server/.env.example`:
   - `JWT_SECRET` — any long random string
   - `ANTHROPIC_API_KEY` — from Step 1
   - `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` — from Step 2
   - `CLIENT_URL` — your Railway-provided public URL (e.g. `https://your-app.up.railway.app`)
   - `NODE_ENV` — `production`
5. Deploy. Railway will give you a public URL — that's your live app.
6. Go back to Stripe's webhook settings (Step 2) and finish adding the webhook endpoint using
   your real deployed URL.

**Important:** the SQLite database file lives on disk inside the container. On Railway's free tier,
this is fine to start, but the file can be wiped on redeploys. Once you have real paying users,
migrate to a proper hosted database (e.g. Railway's own Postgres add-on) — ask me and I can help
adapt the code when you're ready for that.

## Step 4 — Test it live

1. Visit your deployed URL, sign up for a test account, and run through a mock interview.
2. Use Stripe's test mode (test card number `4242 4242 4242 4242`, any future date/CVC) to test
   the upgrade flow before going live with real payments.
3. Once it works, switch your Stripe keys from test mode to live mode in the dashboard.

---

## Local development

```bash
cd server
cp .env.example .env   # then fill in your real keys
npm install
npm start
```

Visit http://localhost:3000

---

## What's intentionally simple right now (and fine for a v1 launch)

- Free tier: 3 mock interview sessions total per account (not tracked monthly yet)
- No password reset flow — email me if you want this added
- No admin dashboard — check subscribers directly in Stripe's dashboard for now
