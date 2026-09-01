/**
 * Dev-only routes — testing utilities that must NEVER be reachable in production.
 *
 * SECURITY GUARANTEE
 * ---------------------------------------------------------------------------
 * This router is only mounted when NODE_ENV !== 'production' (see index.js).
 * In the deployed build, the route does not exist at all — Express has no
 * handler for /api/dev/*, so every request returns 404. There is no runtime
 * check inside this file that could be bypassed; the gate is structural.
 *
 * These routes are completely separate from the admin role's UI and permissions.
 * Nothing a judge or evaluator could see or interact with. The normal login
 * page stays exactly as it is — this is invisible scaffolding for the dev team.
 */

import { Router } from 'express';
import { config } from '../config/env.js';
import { store } from '../store/memoryStore.js';
import { DEMO_ACCOUNTS, ROLE_DATA_TIER } from '../access/roles.js';
import { SPEAKER } from '../domain/records.js';
import { buildPersonaCases } from '../data/personas.js';

export const devRouter = Router();

// ── Gate: reject immediately if somehow reached in production ──────────────
devRouter.use((req, res, next) => {
  if (!config.isDev) {
    return res.status(404).json({ error: 'Not found.' });
  }
  next();
});

/**
 * GET /api/dev/personas — list all 8 personas with case metadata.
 *
 * Lets the dev switcher show every persona's name, locale, case stage,
 * priority tags, and key — information the real login page deliberately
 * does not expose.
 */
devRouter.get('/personas', (req, res) => {
  const personaCases = buildPersonaCases();
  const personas = personaCases.map(({ caseRecord: c, history }) => ({
    key: c.key,
    caseId: c.caseId,
    pseudonym: c.pseudonym,
    victimUsername: c.victimUsername,
    locale: c.preferredLocale,
    district: c.district,
    state: c.state,
    caseStage: c.caseStage,
    monthsSinceRegistration: c.monthsSinceRegistration,
    priorityTags: [...c.priorityTags],
    contextNote: c.contextNote,
    checkInCount: history.length,
  }));

  // Also include counsellor and admin roles.
  const roles = DEMO_ACCOUNTS.filter((a) => a.role !== 'victim').map((a) => ({
    key: a.username,
    caseId: null,
    pseudonym: a.displayName,
    victimUsername: null,
    locale: null,
    district: null,
    state: null,
    caseStage: null,
    monthsSinceRegistration: null,
    priorityTags: [],
    contextNote: null,
    checkInCount: null,
    role: a.role,
    scope: a.scope,
  }));

  res.json({ personas, roles });
});

/**
 * POST /api/dev/login — sign in as any persona or role by key.
 *
 * Uses the same session mechanism as the real login route, so the session
 * is indistinguishable from a normal login. The server-side role is set
 * correctly — the two-tier guarantees still hold.
 *
 * Body: { key: string } — persona key (A–H), 'victim', 'case-c',
 *        'counsellor', or 'admin'.
 */
devRouter.post('/login', (req, res) => {
  const { key } = req.body ?? {};

  if (!key || typeof key !== 'string') {
    return res.status(400).json({ error: 'Provide a persona key (A–H, counsellor, or admin).' });
  }

  // Try persona keys first (A–H).
  const upperKey = key.toUpperCase();
  const personaCases = buildPersonaCases();
  const persona = personaCases.find(({ caseRecord }) => caseRecord.key === upperKey);

  if (persona) {
    const username = persona.caseRecord.victimUsername;
    const account = DEMO_ACCOUNTS.find((a) => a.username === username);
    if (!account) {
      return res.status(404).json({ error: `No demo account for persona ${upperKey}.` });
    }

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: 'Could not start a session.' });
      req.session.user = {
        username: account.username,
        role: account.role,
        displayName: account.displayName,
        scope: account.scope,
        ...(account.caseId ? { caseId: account.caseId } : {}),
      };
      res.json({
        ok: true,
        user: {
          username: account.username,
          role: account.role,
          displayName: account.displayName,
          scope: account.scope,
          dataTier: ROLE_DATA_TIER[account.role],
          ...(account.caseId ? { caseId: account.caseId } : {}),
        },
      });
    });
    return;
  }

  // Try role-based accounts (counsellor, admin).
  const account = DEMO_ACCOUNTS.find(
    (a) => a.username === key || a.role === key,
  );
  if (!account) {
    return res.status(404).json({ error: `Unknown persona key: ${key}` });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Could not start a session.' });
    req.session.user = {
      username: account.username,
      role: account.role,
      displayName: account.displayName,
      scope: account.scope,
      ...(account.caseId ? { caseId: account.caseId } : {}),
    };
    res.json({
      ok: true,
      user: {
        username: account.username,
        role: account.role,
        displayName: account.displayName,
        scope: account.scope,
        dataTier: ROLE_DATA_TIER[account.role],
        ...(account.caseId ? { caseId: account.caseId } : {}),
      },
    });
  });
});

/**
 * POST /api/dev/reset — reset the store to initial seed state.
 *
 * Removes all live check-ins added during testing. The eight persona
 * histories are rebuilt from their authored declarations.
 */
devRouter.post('/reset', (req, res) => {
  store.reset();
  res.json({ ok: true, message: 'Store reset to seed state.' });
});

/**
 * POST /api/dev/checkin — add a synthetic check-in to any case.
 *
 * For testing specific scenarios: crisis triggers, escalation paths,
 * engagement patterns, channel switches, etc.
 *
 * Body: {
 *   caseId: string,
 *   text: string,           — the person's reply
 *   channel?: string,       — app (default), web, sms, ivrs
 *   locale?: string,        — en (default), hi
 *   sentiment?: number,     — override surface sentiment (0–100)
 *   crisis?: boolean,       — inject crisisDetected flag
 *   missed?: boolean,       — record as missed (no reply)
 * }
 */
devRouter.post('/checkin', (req, res) => {
  const { caseId, text, channel, locale, sentiment, crisis, missed } = req.body ?? {};

  if (!caseId || typeof caseId !== 'string') {
    return res.status(400).json({ error: 'Provide a caseId.' });
  }

  const caseRecord = store.getCase(caseId);
  if (!caseRecord) {
    return res.status(404).json({ error: `Case not found: ${caseId}` });
  }

  const checkInLocale = locale || caseRecord.preferredLocale || 'en';

  if (missed) {
    const assessment = store.appendCheckIn(caseId, {
      turns: [],
      locale: checkInLocale,
      channel: channel || 'app',
      status: 'missed',
    });
    return res.json({ ok: true, assessment });
  }

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Provide a text string for the check-in.' });
  }

  const turns = [
    { speaker: SPEAKER.SYSTEM, text: 'How have things been since we last checked in?' },
    { speaker: SPEAKER.PERSON, text },
  ];

  const assessment = store.appendCheckIn(caseId, {
    turns,
    locale: checkInLocale,
    channel: channel || 'app',
    surfaceSentiment: typeof sentiment === 'number' ? sentiment : undefined,
    crisisDetected: crisis === true,
    crisisMetadata: crisis === true ? {
      category: 'explicit_intent',
      categoryLabel: 'Synthetic crisis (dev injection)',
      urgency: 'high',
      matchedText: text,
    } : null,
    immediateReviewRequested: crisis === true,
  });

  res.json({ ok: true, assessment });
});
