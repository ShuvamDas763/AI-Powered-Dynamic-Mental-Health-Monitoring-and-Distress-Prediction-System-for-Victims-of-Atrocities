/**
 * Centralized Case Authorization Helper.
 *
 * Implements strict case-scoping rules across all routes:
 * 1. ADMIN: Aggregate only. Forbidden from accessing or mutating any identified case record (403).
 * 2. VICTIM: Own case only. Forbidden from viewing or modifying any other victim's case (403).
 * 3. COUNSELLOR: Identified Tier 1 access. May only access or act upon valid cases that exist in the store (404 if invalid).
 *
 * Prevents client-controlled caseId parameter manipulation and privilege escalation.
 */

import { ROLES } from './roles.js';
import { store } from '../store/memoryStore.js';

/**
 * Resolve and authorize access to a specific case for an authenticated user.
 *
 * @param {object} actor - The user object from req.session.user
 * @param {string} requestedCaseId - The caseId requested in params, query, or body
 * @param {object} [options]
 * @param {boolean} [options.allowCounsellor=true] - Whether counsellors are permitted on this route
 * @returns {{ authorized: boolean, status?: number, error?: string, caseId?: string, caseRecord?: object }}
 */
export function resolveAuthorizedCase(actor, requestedCaseId, options = {}) {
  const { allowCounsellor = true } = options;

  if (!actor || !actor.role) {
    return { authorized: false, status: 401, error: 'Not signed in.' };
  }

  // Tier 2: Admin cannot access or mutate identified case records
  if (actor.role === ROLES.ADMIN) {
    return {
      authorized: false,
      status: 403,
      error: 'Administrators cannot access identified case records.',
    };
  }

  // Victim: Strictly scoped to own case
  if (actor.role === ROLES.VICTIM) {
    const victimCaseId = actor.caseId;
    if (!victimCaseId) {
      return { authorized: false, status: 403, error: 'Victim profile is not associated with an active case.' };
    }

    // If client supplied a caseId, it MUST match the victim's own caseId
    if (requestedCaseId && requestedCaseId !== victimCaseId) {
      return {
        authorized: false,
        status: 403,
        error: 'You can only access or modify your own case.',
      };
    }

    const caseRecord = store.getCase(victimCaseId);
    if (!caseRecord) {
      return { authorized: false, status: 404, error: 'Case not found.' };
    }

    return { authorized: true, caseId: victimCaseId, caseRecord };
  }

  // Counsellor: Tier 1 access
  if (actor.role === ROLES.COUNSELLOR) {
    if (!allowCounsellor) {
      return {
        authorized: false,
        status: 403,
        error: 'This operation is not permitted for counsellors.',
      };
    }

    if (!requestedCaseId) {
      return { authorized: false, status: 400, error: 'Counsellors must specify a caseId parameter.' };
    }

    const caseRecord = store.getCase(requestedCaseId);
    if (!caseRecord) {
      return { authorized: false, status: 404, error: `Case ${requestedCaseId} not found.` };
    }

    return { authorized: true, caseId: requestedCaseId, caseRecord };
  }

  return { authorized: false, status: 403, error: 'Role not authorized for this operation.' };
}
