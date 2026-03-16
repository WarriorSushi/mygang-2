# Setting Up Sentry Error Monitoring — Beginner Guide

## What is Sentry?

Think of Sentry as a security camera for your app. Right now, if something breaks in your app, you'd never know unless a user tells you. Sentry automatically catches every error and sends you a notification — like getting a text when your doorbell camera sees something.

**Why you need it:** Your app handles real payments. If a billing webhook fails or a user's subscription doesn't activate, you want to know *immediately* — not days later when someone complains.

---

## Step-by-step Setup

### Step 1: Create a Sentry Account (2 minutes)

1. Go to **https://sentry.io/signup/**
2. Sign up with your email or GitHub
3. **Choose the Free plan** — it's more than enough (5,000 errors/month, 1 user)
4. When asked to create a project, choose **Next.js** as the platform
5. Give it a name like `mygang`
6. **Copy the DSN** it shows you — it looks like:
   ```
   https://abc123def456@o789.ingest.sentry.io/12345
   ```
   Save this somewhere, you'll need it in Step 3.

---

### Step 2: Install the Package (1 minute)

Open your terminal in the project folder and run:

```bash
pnpm add @sentry/nextjs
```

---

### Step 3: Run the Setup Wizard (3 minutes)

This is the easiest part — Sentry has a wizard that does most of the work:

```bash
npx @sentry/wizard@latest -i nextjs
```

The wizard will ask you:
- **Are you using the App Router?** → Yes
- **Do you want to create example pages?** → No (you don't need demo pages)
- **Paste your DSN** → Paste the one you copied in Step 1

The wizard automatically creates these files:
- `sentry.client.config.ts` — catches errors in the browser
- `sentry.server.config.ts` — catches errors on the server
- `sentry.edge.config.ts` — catches errors in edge functions
- Updates your `next.config.ts` to wrap with `withSentryConfig`

---

### Step 4: Add Environment Variables to Vercel (2 minutes)

Go to your Vercel dashboard:

1. Click your project → **Settings** → **Environment Variables**
2. Add these two:

| Name | Value | Where to find it |
|------|-------|-------------------|
| `SENTRY_DSN` | `https://abc123...` | From Step 1 |
| `SENTRY_AUTH_TOKEN` | `sntrys_...` | Sentry → Settings → Auth Tokens → Create New Token |

For the auth token:
1. Go to https://sentry.io/settings/auth-tokens/
2. Click **Create New Token**
3. Give it a name like `vercel-deploy`
4. Copy the token and paste it in Vercel

---

### Step 5: Test It Works (2 minutes)

After deploying:

1. Open your app in Chrome
2. Open the browser console (F12 → Console tab)
3. Type this and press Enter:
   ```js
   throw new Error('Sentry test from MyGang')
   ```
4. Go to your Sentry dashboard (https://sentry.io)
5. You should see the error appear within 30 seconds!

If you see it — congrats, Sentry is working! 🎉

---

### Step 6: Set Up Email Alerts (2 minutes)

By default Sentry shows errors in the dashboard, but you want **email alerts** so you don't have to check manually:

1. In Sentry, go to **Alerts** (left sidebar)
2. Click **Create Alert Rule**
3. Choose **Issues** → **New Issue**
4. Set: "When there are more than **1** new issue in **1 hour**"
5. Action: **Send a notification to** → your email
6. Save

Now you'll get an email the moment something breaks.

---

## What Sentry Catches Automatically

Once set up, Sentry catches **everything** without you writing any extra code:

- ❌ Server crashes in API routes (chat, webhooks, checkout)
- ❌ Client-side JavaScript errors (React crashes, undefined errors)
- ❌ Unhandled promise rejections
- ❌ Failed network requests
- ⏱️ Slow API routes (performance monitoring)

---

## Cost

**Free plan includes:**
- 5,000 errors per month
- 10,000 performance transactions per month
- 1 team member
- 30 days of data retention

This is more than enough for MyGang at current scale. You'd only need to upgrade if you're getting 5,000+ errors per month — and if that happens, you have bigger problems to fix first! 😄

---

## Quick Reference

| What | Where |
|------|-------|
| Dashboard | https://sentry.io |
| Alert settings | Sentry → Alerts |
| Auth tokens | Sentry → Settings → Auth Tokens |
| DSN | Sentry → Settings → Projects → MyGang → Client Keys |
| Docs | https://docs.sentry.io/platforms/javascript/guides/nextjs/ |
