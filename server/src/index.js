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

const app = express();

app.use(express.json({ limit: '256kb' }));

// CORS — allow the deployed frontend origin. In development the Vite proxy
// makes requests same-origin, so this is only exercised in production.
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
if (allowedOrigins.length > 0) {
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }));
}

// Trust proxy for HTTPS behind Render/Railway load balancer.
app.set('trust proxy', 1);

app.use(
  session({
    name: 'sih26094.sid',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // not readable by client-side JS
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production', // HTTPS in production
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
  });
});

app.use('/api/auth', authRouter);
app.use('/api/checkin', checkinRouter);

// TIER 1 — individual-level data. Guarded inside the router.
app.use('/api/counsellor', counsellorRouter);

// TIER 2 — aggregate data only. Guarded inside the router.
app.use('/api/admin', adminRouter);

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

app.listen(config.port, () => {
  console.log(`\n  SIH26094 distress-monitoring server`);
  for (const line of describeConfig()) console.log(`    ${line}`);
  console.log(`\n  listening on http://localhost:${config.port}\n`);
});
