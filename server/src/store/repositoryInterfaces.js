/**
 * Abstract Repository Interfaces for SIH26094.
 *
 * ARCHITECTURAL PURPOSE
 * -------------------------------------------------------------------------
 * These interfaces define the contract for the data storage layer.
 * In this hackathon prototype, all interfaces are fulfilled in-memory via
 * `MemoryRepository` (in `memoryStore.js`), allowing zero-dependency,
 * fully offline execution for jury evaluations.
 *
 * For enterprise production, these same contracts can be backed by a
 * `PersistentRepository` (e.g., PostgreSQL with row-level security and
 * envelope encryption for sensitive victim records) without altering
 * downstream domain or route logic.
 */

/**
 * @typedef {Object} CaseRepository
 * @property {(caseId: string) => Promise<object|null>|object|null} getCase
 * @property {() => Promise<object[]>|object[]} listCases
 * @property {(caseId: string, username: string) => Promise<boolean>|boolean} isOwnedBy
 * @property {() => Promise<object[]>|object[]} prioritisedQueue
 * @property {() => Promise<object[]>|object[]} alerts
 * @property {() => Promise<object[]>|object[]} aggregateInputs
 */

/**
 * @typedef {Object} CheckinRepository
 * @property {(caseId: string) => Promise<object[]>|object[]} getHistory
 * @property {(caseId: string) => Promise<object[]>|object[]} getAssessmentSeries
 * @property {(caseId: string) => Promise<object|null>|object|null} getLatestAssessment
 * @property {(caseId: string, raw: object, options?: object) => Promise<object|null>|object|null} appendCheckIn
 */

/**
 * @typedef {Object} ConsentRepository
 * @property {(caseId: string) => Promise<object|null>|object|null} getConsent
 * @property {(consentRecord: object) => Promise<object>|object} saveConsent
 * @property {(caseId: string, reason?: string) => Promise<object|null>|object|null} revokeConsent
 * @property {(caseId: string, purpose: string) => Promise<boolean>|boolean} hasPurposeConsent
 */

/**
 * @typedef {Object} InterventionRepository
 * @property {(caseId: string) => Promise<object[]>|object[]} getInterventions
 * @property {(intervention: object) => Promise<object>|object} saveIntervention
 * @property {(id: string, updates: object) => Promise<object|null>|object|null} updateIntervention
 * @property {() => Promise<{ backlogCount: number, overdueCount: number, completedCount: number }>} getAggregateStats
 */

/**
 * @typedef {Object} OutreachRepository
 * @property {(caseId: string) => Promise<object|null>|object|null} getOutreachSchedule
 * @property {(schedule: object) => Promise<object>|object} saveOutreachSchedule
 * @property {(caseId: string, updates: object) => Promise<object|null>|object|null} updateOutreachSchedule
 * @property {() => Promise<object[]>|object[]} listPendingOutreaches
 */

/**
 * @typedef {Object} AuditRepository
 * @property {(entry: { userId: string, role: string, action: string, caseId?: string, details?: any }) => void} logAccess
 * @property {(limit?: number) => Promise<object[]>|object[]} getAuditLog
 */

export const REPOSITORY_TYPES = Object.freeze({
  CASE: 'CaseRepository',
  CHECKIN: 'CheckinRepository',
  CONSENT: 'ConsentRepository',
  INTERVENTION: 'InterventionRepository',
  OUTREACH: 'OutreachRepository',
  AUDIT: 'AuditRepository',
});
