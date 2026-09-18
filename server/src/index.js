/**
 * Server entry point.
 *
 * Route mounting here is deliberately organised BY ACCESS TIER rather than by
 * feature, so the two-tier separation is visible at a glance:
 *
 *   /api/auth        - establishes the server-side role session
 *   /api/checkin     - submit check-in conversation, live LLM analysis
 *   /api/counsellor  - TIER 1, identified individual case data
 *   /api/admin       - TIER 2, aggregate data only
 *
 * If you add a router, put it under the tier it belongs to and guard it there.
 * See `access/roles.js` for the invariant.
 */

import express from 'express';
import session from 'express-session';
import cors from 'cors';
import { config, describeConfig } from './config/env.js';
import { authRouter } from './routes/auth.js';
import { checkinRouter } from './routes/checkin.js';
import { counsellorRouter } from './routes/counsellor.js';
import { adminRouter } from './routes/admin.js';
import { notificationsRouter } from './routes/notifications.js';
import { exportRouter } from './routes/export.js';
import { devRouter } from './routes/dev.js';
import { consentRouter } from './routes/consent.js';
import { outreachRouter } from './routes/outreach.js';
import { authLimiter, checkinLimiter } from './access/rateLimiter.js';
import { store } from './store/memoryStore.js';
import { OutreachService } from './domain/outreachOrchestrator.js';
import { OutreachScheduler } from './domain/outreachScheduler.js';

const app = express();

const outreachService = new OutreachService(store);
const outreachScheduler = new OutreachScheduler(store, outreachService, {
  enabled: config.outreach.schedulerEnabled,
  intervalMs: config.outreach.schedulerIntervalMs,
});

app.use(express.json({ limit: '256kb' }));

// CORS — explicit origin allowlist with credentials
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (same-origin, test runners, mobile agents)
    if (!origin) return callback(null, true);
    if (!config.isProduction || config.clientOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin denied by institutional policy.'));
  },
  credentials: true,
}));

// Trust proxy for HTTPS behind Render/Railway load balancer.
app.set('trust proxy', 1);

const isProduction = config.isProduction;

app.use(
  session({
    name: 'sih26094.sid',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // not readable by client-side JS
      sameSite: isProduction ? 'none' : 'lax', // 'none' required for cross-origin cookies
      secure: isProduction, // HTTPS in production (required when sameSite is 'none')
      maxAge: 1000 * 60 * 60 * 8, // one working day
    },
  }),
);

/** Liveness probe, and a quick way to see how the app is configured. */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    llmMode: config.llm.forceFallback ? 'cached-fallback' : 'live',
    model: config.llm.model,
    isDev: config.isDev,
  });
});

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/checkin', checkinLimiter, checkinRouter);
app.use('/api/consent', consentRouter);
app.use('/api/outreach', outreachRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/export', exportRouter);

// TIER 1 — individual-level data. Guarded inside the router.
app.use('/api/counsellor', counsellorRouter);

// TIER 2 — aggregate data only. Guarded inside the router.
app.use('/api/admin', adminRouter);

// Dev-only — testing utilities. NOT mounted in production (structural gate).
if (config.isDev) {
  app.use('/api/dev', devRouter);
}

// Express 5 requires named wildcards; bare '*' throws.
app.use('/api/*splat', (req, res) => {
  res.status(404).json({ error: 'Unknown endpoint.' });
});

/**
 * Error handler.
 *
 * Express 5 auto-forwards rejected promises from async handlers here, so route
 * handlers do not need their own try/catch to avoid an unhandled rejection.
 *
 * Responses stay deliberately generic: an error message must never leak case
 * content or identity, including to a role that would not otherwise see it.
 */
app.use((err, req, res, _next) => {
  console.error('[error]', err?.message ?? err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Something went wrong handling that request.' });
});

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`\n  SIH26094 distress-monitoring server`);
  for (const line of describeConfig()) console.log(`    ${line}`);
  console.log(`\n  listening on http://0.0.0.0:${config.port}\n`);

  if (config.outreach.schedulerEnabled) {
    outreachScheduler.start();
    console.log(`  [scheduler] automatic outreach scheduler running (every ${config.outreach.schedulerIntervalMs}ms)`);
  }
});

function gracefulShutdown(signal) {
  console.log(`\n  [shutdown] received ${signal}, closing server and stopping background scheduler...`);
  outreachScheduler.stop();
  server.close(() => {
    console.log('  [shutdown] HTTP server closed cleanly.');
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
