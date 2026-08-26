/**
 * Authentication routes.
 *
 * The login step exists for one architectural reason: the role must be a
 * SERVER-SIDE session fact. A client-side role toggle would make the two-tier
 * guarantee unverifiable, because the browser could simply claim to be a
 * counsellor. See invariant #4 in `access/roles.js`.
 *
 * Credential handling itself is intentionally trivial (fixed demo accounts, no
 * hashing, no user store). That is a scoped prototype decision, not a claim
 * about production auth — the README says so explicitly.
 */

import { Router } from 'express';
import { DEMO_ACCOUNTS, ROLE_DATA_TIER } from '../access/roles.js';
import { currentUser } from '../access/requireRole.js';

export const authRouter = Router();

/** Shape the session user into the safe payload the client is allowed to know. */
function publicUser(user) {
  return {
    username: user.username,
    role: user.role,
    displayName: user.displayName,
    scope: user.scope,
    // Exposed so the UI can label which tier it is showing. It is a description
    // of what the server already decided, never an input to that decision.
    dataTier: ROLE_DATA_TIER[user.role],
  };
}

authRouter.post('/login', (req, res) => {
  const { username, passcode } = req.body ?? {};

  const account = DEMO_ACCOUNTS.find(
    (candidate) => candidate.username === username && candidate.passcode === passcode,
  );

  if (!account) {
    // Same message for unknown user and wrong passcode, so the response does
    // not confirm which usernames exist.
    return res.status(401).json({ error: 'Those sign-in details were not recognised.' });
  }

  // Regenerate the session on privilege change to avoid session fixation.
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Could not start a session.' });

    req.session.user = {
      username: account.username,
      role: account.role,
      displayName: account.displayName,
      scope: account.scope,
    };
    res.json({ user: publicUser(req.session.user) });
  });
});

authRouter.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('sih26094.sid');
    res.json({ ok: true });
  });
});

/** Who am I? Returns null rather than 401 so the client can render a login page. */
authRouter.get('/me', (req, res) => {
  const user = currentUser(req);
  res.json({ user: user ? publicUser(user) : null });
});
