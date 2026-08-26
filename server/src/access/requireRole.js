/**
 * Access-control middleware.
 *
 * Every route in this application sits behind one of these guards. If you add
 * a route and it is not wrapped in a guard from this file, the two-tier model
 * has a hole in it — see `access/roles.js` for the invariant being protected.
 */

import { ROLES, canReadIdentifiedData, isKnownRole } from './roles.js';

/**
 * Read the authenticated session.
 *
 * Deliberately reads ONLY from the server-side session. It never consults a
 * header, query parameter or request body for the role, because any of those
 * would let the browser choose its own privileges — which is exactly the
 * failure this architecture exists to prevent.
 */
export function currentUser(req) {
  const user = req.session?.user;
  if (!user || !isKnownRole(user.role)) return null;
  return user;
}

/** 401 for "we don't know who you are", 403 for "we know, and no". */
function deny(res, status, message) {
  return res.status(status).json({ error: message });
}

/** Require any authenticated session. */
export function requireAuth(req, res, next) {
  if (!currentUser(req)) {
    return deny(res, 401, 'Not signed in.');
  }
  next();
}

/**
 * Require one of the listed roles.
 *
 * Note this REFUSES rather than filters. An administrator who requests an
 * individual case endpoint receives a 403 and no case data whatsoever — they
 * do not receive a redacted or partially-populated record. Refusing keeps the
 * guarantee auditable: there is no code path where individual data is loaded
 * for an admin and then trimmed, so there is no trimming bug to have.
 */
export function requireRole(...allowedRoles) {
  return function roleGuard(req, res, next) {
    const user = currentUser(req);
    if (!user) return deny(res, 401, 'Not signed in.');

    if (!allowedRoles.includes(user.role)) {
      // Kept role-neutral on purpose. This guard refuses in both directions
      // (a counsellor asking for an administrative view as well as an
      // administrator asking for a case view), so it must not assume which
      // direction was attempted. The reason-specific wording lives in
      // `requireIdentifiedDataAccess` below.
      return deny(res, 403, 'This view is not available to your role.');
    }
    next();
  };
}

/**
 * Guard for individual-level (Tier 1) data.
 *
 * Use this on every route that can return data about one identifiable person.
 * Prefer it over `requireRole(ROLES.COUNSELLOR)` at call sites: it expresses
 * the reason for the restriction rather than the current answer, so if the role
 * table in `roles.js` ever changes, the intent still holds.
 */
export function requireIdentifiedDataAccess(req, res, next) {
  const user = currentUser(req);
  if (!user) return deny(res, 401, 'Not signed in.');

  if (!canReadIdentifiedData(user.role)) {
    return deny(
      res,
      403,
      'Individual-level case data is restricted to welfare and counselling ' +
        'staff. Administrative roles have access to aggregate data only.',
    );
  }
  next();
}

/** Guard for a victim's own self-scoped routes. */
export function requireVictim(req, res, next) {
  return requireRole(ROLES.VICTIM)(req, res, next);
}
