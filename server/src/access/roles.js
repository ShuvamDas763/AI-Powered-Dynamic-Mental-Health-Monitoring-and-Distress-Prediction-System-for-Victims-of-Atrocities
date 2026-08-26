/**
 * Roles and data tiers — the two-tier access control model.
 *
 * This file is the single source of truth for "who is allowed to see what".
 * Read this before touching any route.
 *
 *
 * THE MODEL IN ONE PARAGRAPH
 * -------------------------------------------------------------------------
 * There are two DIFFERENT DATA PRODUCTS built from the same underlying store,
 * not one dataset with more or less of it revealed:
 *
 *   Tier 1 (IDENTIFIED)  — welfare / counselling staff. Sees a specific
 *                          person: their case record, check-in history, each
 *                          distress score with the signals that drove it,
 *                          their trend line, their recommended interventions.
 *                          Exists so a human can act on an individual.
 *
 *   Tier 2 (AGGREGATE)   — district / State / national administrators. Sees
 *                          only counts, distributions and cohort trends.
 *                          Never a name, never a case id that resolves to one
 *                          person, never a single check-in's text, never one
 *                          individual's trend line.
 *
 * Admin is NOT a downgraded counsellor. Admin never touches the identified
 * store at all.
 *
 *
 * THE INVARIANT (what makes this real rather than decorative)
 * -------------------------------------------------------------------------
 * 1. Enforcement is server-side, at the data boundary. Tier 2 is served by
 *    different endpoints that only ever emit aggregate rows. Individual
 *    records are never serialised into a Tier 2 response, so there is nothing
 *    for a devtools network tab or a hand-crafted request to find.
 *
 * 2. Cross-tier requests are REFUSED, not filtered. An admin session hitting
 *    an individual-case endpoint gets 403. It does not get a redacted page.
 *
 * 3. Aggregates are small-cell suppressed (see config.privacy.minCellSize).
 *    "1 high-risk case in this block" re-identifies someone even with no name
 *    attached, so thin buckets render as "<n" instead of an exact count.
 *
 * 4. Role is a server-side session fact, never a client-supplied value. The
 *    browser cannot self-elevate by flipping a variable or editing a header.
 *
 * Requirement traceability: spec Section 4 ("Critical design principle"),
 * Section 5 (privacy row), Section 9 (the anti-surveillance jury answer).
 */

/** Every role that can hold a session. */
export const ROLES = Object.freeze({
  /** A victim/complainant doing their own check-ins. Sees only their own thread. */
  VICTIM: 'victim',
  /** Welfare / counselling staff. The only role permitted individual-level access. */
  COUNSELLOR: 'counsellor',
  /** District / State / national administrator. Aggregate data only, always. */
  ADMIN: 'admin',
});

/** The two data products. */
export const DATA_TIER = Object.freeze({
  IDENTIFIED: 'identified',
  AGGREGATE: 'aggregate',
});

/**
 * Which data tier each role may read.
 *
 * VICTIM maps to null deliberately: a victim is not a tier at all. They read
 * their own conversation through a self-scoped route and can never enumerate
 * other people, so granting them a tier would misrepresent the model.
 */
export const ROLE_DATA_TIER = Object.freeze({
  [ROLES.VICTIM]: null,
  [ROLES.COUNSELLOR]: DATA_TIER.IDENTIFIED,
  [ROLES.ADMIN]: DATA_TIER.AGGREGATE,
});

/**
 * Administrative scope levels, per spec Section 5's
 * "drill-down from national -> state -> district".
 *
 * IMPORTANT: this drill-down is GEOGRAPHIC and stays inside the aggregate
 * tier. Narrowing national -> state -> district reaches smaller and smaller
 * aggregate buckets; it never bottoms out at a person. Because the buckets get
 * small as you narrow, small-cell suppression matters most at DISTRICT level.
 */
export const ADMIN_SCOPE = Object.freeze({
  DISTRICT: 'district',
  STATE: 'state',
  NATIONAL: 'national',
});

/** True when `role` is permitted to read individual-level (identified) data. */
export function canReadIdentifiedData(role) {
  return ROLE_DATA_TIER[role] === DATA_TIER.IDENTIFIED;
}

/** True when `role` is restricted to aggregate data. */
export function isAggregateOnlyRole(role) {
  return ROLE_DATA_TIER[role] === DATA_TIER.AGGREGATE;
}

/** True when `role` is a role this system recognises at all. */
export function isKnownRole(role) {
  return Object.values(ROLES).includes(role);
}

/**
 * Demo accounts.
 *
 * A hackathon prototype does not need real credential management, but the role
 * MUST become a server-side session fact rather than a client-side toggle —
 * otherwise invariant #4 above is a claim rather than a guarantee. So we keep a
 * real (if trivial) login step that the server, not the browser, decides.
 *
 * These are obviously-fake local demo credentials, not secrets.
 */
export const DEMO_ACCOUNTS = Object.freeze([
  Object.freeze({
    username: 'counsellor',
    passcode: 'demo',
    role: ROLES.COUNSELLOR,
    displayName: 'Welfare Officer (District Counselling Unit)',
    scope: null,
  }),
  Object.freeze({
    username: 'admin',
    passcode: 'demo',
    role: ROLES.ADMIN,
    displayName: 'Administrator (National Monitoring Cell)',
    scope: ADMIN_SCOPE.NATIONAL,
  }),
]);
