/**
 * Automatic Outreach Scheduler for SIH26094.
 *
 * A lightweight, resilient in-process scheduler that periodically discovers
 * due outreach schedules and dispatches them through the OutreachService.
 *
 * Key Architectural Invariants:
 * 1. Backend-owned: Operates independently of client sessions or open browsers.
 * 2. Explicit lifecycle: Clean start() and stop() methods, graceful shutdown.
 * 3. Overlap guard: In-process mutex prevents concurrent/overlapping cycles.
 * 4. Idempotency: Explicit state transitions prevent duplicate deliveries or alerts.
 * 5. Robust date handling: Normalizes timestamps, handles invalid/future dates safely.
 * 6. Governed by consent: Checks communication consent before automated outreach.
 */

import { OUTREACH_STATE } from './outreachOrchestrator.js';
import { CONSENT_PURPOSE } from './consent.js';

export class OutreachScheduler {
  /**
   * @param {object} store - Store instance
   * @param {object} outreachService - OutreachService instance
   * @param {object} [options]
   * @param {boolean} [options.enabled=true] - Whether scheduler is enabled
   * @param {number} [options.intervalMs=60000] - Polling interval in ms
   * @param {() => number} [options.nowFn] - Clock function for deterministic testing
   */
  constructor(store, outreachService, options = {}) {
    this.store = store;
    this.outreachService = outreachService;
    this.enabled = options.enabled ?? true;
    this.intervalMs = options.intervalMs ?? 60_000;
    this.timer = null;
    this.running = false;
    this.nowFn = typeof options.nowFn === 'function' ? options.nowFn : () => Date.now();
  }

  /**
   * Start the scheduler interval.
   */
  start() {
    if (!this.enabled) return;
    if (this.timer) return; // Prevent duplicate timers

    this.timer = setInterval(() => {
      this.tick();
    }, this.intervalMs);

    // Allow Node process to exit gracefully without timer keeping it open
    if (this.timer?.unref) {
      this.timer.unref();
    }
  }

  /**
   * Stop the scheduler cleanly, clearing timers.
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Execute one scheduler tick with concurrency protection.
   */
  async tick() {
    if (!this.enabled) return [];
    if (this.running) return [];

    this.running = true;
    try {
      return await this.processDueOutreach();
    } catch (err) {
      console.error('[OutreachScheduler error]', err?.message ?? err);
      return [];
    } finally {
      this.running = false;
    }
  }

  /**
   * Process all due outreach schedules idempotently.
   */
  async processDueOutreach() {
    if (!this.enabled) return [];

    const now = this.nowFn();
    const todayStr = new Date(now).toISOString().split('T')[0];

    const allCases = typeof this.store.listCases === 'function' ? this.store.listCases() : [];
    const results = [];

    for (const caseRecord of allCases) {
      const caseId = caseRecord.caseId;
      const schedule = this.store.getOutreachSchedule(caseId);
      if (!schedule) continue;

      // 1. Date Validation & Due Check
      if (schedule.deliveryState === OUTREACH_STATE.CHECKIN_DUE) {
        if (!schedule.nextCheckInDate) continue;
        const dueDate = new Date(schedule.nextCheckInDate);
        if (Number.isNaN(dueDate.getTime())) {
          // Invalid date string -> skip
          continue;
        }

        const dueStr = dueDate.toISOString().split('T')[0];
        if (dueStr > todayStr) {
          // Future outreach -> skip
          continue;
        }
      }


      // 2. State Eligibility Check
      // Only process schedules that are due or actively retrying/falling back
      const eligibleStates = [
        OUTREACH_STATE.CHECKIN_DUE,
        OUTREACH_STATE.RETRY,
        OUTREACH_STATE.ALTERNATE_CHANNEL,
      ];

      if (!eligibleStates.includes(schedule.deliveryState)) {
        continue;
      }

      // 3. Retry / Fallback Timing Check (Fix #3)
      if (
        schedule.deliveryState === OUTREACH_STATE.RETRY ||
        schedule.deliveryState === OUTREACH_STATE.ALTERNATE_CHANNEL
      ) {
        if (schedule.nextAttemptAt) {
          const nextAttemptTime = new Date(schedule.nextAttemptAt).getTime();
          if (!Number.isNaN(nextAttemptTime) && now < nextAttemptTime) {
            // Not yet time to retry or attempt fallback channel -> skip!
            continue;
          }
        }
      }

      // 4. Consent Verification (Fix #1 & Fix #2)
      // Re-evaluate current communication consent before dispatch
      const consentRecord = typeof this.store.getConsent === 'function' ? this.store.getConsent(caseId) : null;
      const isCommConsented = Boolean(
        consentRecord && !consentRecord.revokedAt && consentRecord.purposes?.[CONSENT_PURPOSE.COMMUNICATION] === true
      );

      // If communication consent is missing, revoked, or has no allowed channels -> do not dispatch
      if (!isCommConsented || !Array.isArray(consentRecord?.channelsAllowed) || consentRecord.channelsAllowed.length === 0) {
        continue;
      }

      // 5. Initiate Delivery
      const result = await this.outreachService.attemptDelivery(caseId);
      results.push({
        caseId,
        result,
      });
    }

    return results;
  }
}
