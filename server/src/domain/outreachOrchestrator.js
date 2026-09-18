/**
 * Outreach Orchestrator & Multi-Channel Abstraction for SIH26094.
 *
 * CONTINUOUS MONITORING WORKFLOW
 * -------------------------------------------------------------------------
 * Periodic interaction with victims requires multi-channel orchestration
 * supporting Web, Native App, SMS, and IVRS (Interactive Voice Response System).
 *
 * In a hackathon / offline demonstration environment, SMS and IVRS adapters
 * operate in high-fidelity simulation mode with realistic gateway payloads
 * and failure/retry behaviors.
 *
 * STATE MACHINE
 * -------------------------------------------------------------------------
 * Happy Path:
 *   CHECKIN_DUE -> DELIVERY_ATTEMPTED -> DELIVERED -> RESPONDED
 *
 * Unreachable / Fallback Path:
 *   CHECKIN_DUE -> DELIVERY_ATTEMPTED -> NOT_DELIVERED -> RETRY (up to 2)
 *   -> ALTERNATE_CHANNEL -> COUNSELLOR_FLAG (human intervention required)
 */

import { config } from '../config/env.js';
import { CONSENT_PURPOSE } from './consent.js';

export const OUTREACH_STATE = Object.freeze({
  CHECKIN_DUE: 'CHECKIN_DUE',
  DELIVERY_ATTEMPTED: 'DELIVERY_ATTEMPTED',
  DELIVERED: 'DELIVERED',
  RESPONDED: 'RESPONDED',
  NOT_DELIVERED: 'NOT_DELIVERED',
  RETRY: 'RETRY',
  ALTERNATE_CHANNEL: 'ALTERNATE_CHANNEL',
  COUNSELLOR_FLAG: 'COUNSELLOR_FLAG',
});

export const CHANNELS = Object.freeze({
  WEB: 'web',
  APP: 'app',
  SMS: 'sms',
  IVRS: 'ivrs',
});

const MAX_DELIVERY_ATTEMPTS = 2;

/**
 * Base Channel Adapter
 */
export class ChannelAdapter {
  constructor(channelName) {
    this.channelName = channelName;
  }

  /**
   * Dispatch an outreach payload to the victim via this channel.
   * @param {object} params
   * @param {string} params.caseId
   * @param {string} params.recipientIdentifier (e.g., phone, app user ID)
   * @param {string} params.message
   * @param {string} params.locale
   * @returns {Promise<{ success: boolean, gatewayMessageId: string, timestamp: string, error?: string }>}
   */
  async dispatch({ caseId, recipientIdentifier, message, locale }) {
    throw new Error('dispatch() must be implemented by concrete channel adapter');
  }
}

export class WebAdapter extends ChannelAdapter {
  constructor() {
    super(CHANNELS.WEB);
  }

  async dispatch({ caseId, recipientIdentifier, message, locale }) {
    return {
      success: true,
      channel: CHANNELS.WEB,
      gatewayMessageId: `web-push-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      metadata: { target: 'in-app-notification', locale },
    };
  }
}

export class AppAdapter extends ChannelAdapter {
  constructor() {
    super(CHANNELS.APP);
  }

  async dispatch({ caseId, recipientIdentifier, message, locale }) {
    return {
      success: true,
      channel: CHANNELS.APP,
      gatewayMessageId: `fcm-push-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      metadata: { priority: 'high', title: 'Sahara Well-being Check-in' },
    };
  }
}

export class SMSAdapter extends ChannelAdapter {
  constructor() {
    super(CHANNELS.SMS);
  }

  async dispatch({ caseId, recipientIdentifier, message, locale }) {
    // Simulated National Informatics Centre (NIC) / C-DAC SMS Gateway
    return {
      success: true,
      channel: CHANNELS.SMS,
      gatewayMessageId: `nic-sms-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      metadata: { dltTemplateId: 'DLT-POA-14566-V1', senderId: 'GOV-SAHARA' },
    };
  }
}

export class IVRSAdapter extends ChannelAdapter {
  constructor() {
    super(CHANNELS.IVRS);
  }

  async dispatch({ caseId, recipientIdentifier, message, locale }) {
    // Simulated Telephony Voice Server outbound call session
    return {
      success: true,
      channel: CHANNELS.IVRS,
      gatewayMessageId: `ivrs-call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      metadata: { voicePromptId: locale === 'hi' ? 'VP-HI-DAILY-01' : 'VP-EN-DAILY-01', callDurationEstimateSec: 45 },
    };
  }
}

/**
 * Outreach Service managing state transitions and channel fallback
 */
export class OutreachService {
  constructor(store, options = {}) {
    this.store = store;
    this.options = options;
    this.retryDelayMs = options.retryDelayMs ?? config?.outreach?.retryDelayMs ?? 15 * 60_000;
    this.nowFn = typeof options.nowFn === 'function' ? options.nowFn : () => Date.now();
    this.adapters = {
      [CHANNELS.WEB]: new WebAdapter(),
      [CHANNELS.APP]: new AppAdapter(),
      [CHANNELS.SMS]: new SMSAdapter(),
      [CHANNELS.IVRS]: new IVRSAdapter(),
    };
  }

  /**
   * Determine next fallback channel when a delivery fails, filtered by authorized channels.
   *
   * @param {string} currentChannel
   * @param {string[]} [allowedChannels] - Active victim-consented channels
   * @returns {string|null}
   */
  getNextFallbackChannel(currentChannel, allowedChannels = []) {
    const candidateMap = {
      [CHANNELS.APP]: [CHANNELS.SMS, CHANNELS.IVRS],
      [CHANNELS.WEB]: [CHANNELS.SMS, CHANNELS.IVRS],
      [CHANNELS.SMS]: [CHANNELS.IVRS],
      [CHANNELS.IVRS]: [],
    };

    const candidates = candidateMap[currentChannel] || [];
    for (const candidate of candidates) {
      if (allowedChannels.includes(candidate) && this.adapters[candidate]) {
        return candidate;
      }
    }
    return null;
  }

  /**
   * Schedule or update a check-in outreach for a case
   */
  scheduleCheckin(caseId, { nextCheckInDate, preferredChannel } = {}) {
    const existing = this.store.getOutreachSchedule(caseId);
    const now = this.nowFn();
    const channel = preferredChannel || existing?.preferredChannel || CHANNELS.APP;
    const schedule = {
      caseId,
      nextCheckInDate: nextCheckInDate || new Date(now + 7 * 86_400_000).toISOString().split('T')[0],
      preferredChannel: channel,
      channel,
      lastSuccessfulChannel: existing?.lastSuccessfulChannel || null,
      lastAttemptedChannel: null,
      deliveryState: OUTREACH_STATE.CHECKIN_DUE,
      state: OUTREACH_STATE.CHECKIN_DUE,
      attemptCount: 0,
      attemptNumber: 0,
      attemptedAt: null,
      nextAttemptAt: null,
      failureReason: null,
      lastError: null,
      responseState: 'PENDING',
      missedStreak: existing?.missedStreak || 0,
      attemptedChannels: [],
      updatedAt: new Date(now).toISOString(),
    };
    return this.store.saveOutreachSchedule(schedule);
  }

  /**
   * Execute or simulate a delivery attempt
   */
  async attemptDelivery(caseId, { channelOverride, simulateFailure = false } = {}) {
    const schedule = this.store.getOutreachSchedule(caseId);
    if (!schedule) throw new Error(`No outreach schedule found for case ${caseId}`);

    const now = this.nowFn();
    const caseRecord = this.store.getCase(caseId);
    const consentRecord = typeof this.store.getConsent === 'function' ? this.store.getConsent(caseId) : null;
    const isCommConsented = Boolean(
      consentRecord && !consentRecord.revokedAt && consentRecord.purposes?.[CONSENT_PURPOSE.COMMUNICATION] === true
    );
    const allowedChannels = isCommConsented && Array.isArray(consentRecord?.channelsAllowed)
      ? consentRecord.channelsAllowed
      : [];

    let channelToUse = channelOverride || schedule.preferredChannel || CHANNELS.APP;

    // Check if channelToUse is authorized by active communication consent
    if (!allowedChannels.includes(channelToUse)) {
      schedule.lastAttemptedChannel = channelToUse;
      schedule.channel = channelToUse;
      schedule.attemptedAt = new Date(now).toISOString();
      schedule.attemptCount = (schedule.attemptCount || 0) + 1;
      schedule.attemptNumber = schedule.attemptCount;
      schedule.deliveryState = OUTREACH_STATE.DELIVERY_ATTEMPTED;
      schedule.state = schedule.deliveryState;
      this.store.updateOutreachSchedule(caseId, schedule);
      return this.handleDeliveryFailure(caseId, `Channel ${channelToUse} not authorized by user communication consent`);
    }

    const adapter = this.adapters[channelToUse] || this.adapters[CHANNELS.APP];

    schedule.lastAttemptedChannel = channelToUse;
    schedule.channel = channelToUse;
    schedule.attemptCount = (schedule.attemptCount || 0) + 1;
    schedule.attemptNumber = schedule.attemptCount;
    schedule.attemptedAt = new Date(now).toISOString();
    schedule.deliveryState = OUTREACH_STATE.DELIVERY_ATTEMPTED;
    schedule.state = schedule.deliveryState;
    schedule.attemptedChannels = schedule.attemptedChannels || [];
    if (!schedule.attemptedChannels.includes(channelToUse)) {
      schedule.attemptedChannels.push(channelToUse);
    }

    this.store.updateOutreachSchedule(caseId, schedule);

    // Simulate gateway failure if requested
    if (simulateFailure) {
      return this.handleDeliveryFailure(caseId, `Simulated gateway error on ${channelToUse}`);
    }

    try {
      const isHindi = caseRecord?.preferredLocale === 'hi';
      const promptMessage = isHindi
        ? 'सहारा संबल: आपका नियमित संवाद उपलब्ध है। आप जब चाहें तब जुड़ सकते हैं।'
        : 'Sahara Well-being: Your regular check-in is open. You can check in whenever you are ready.';

      const dispatchResult = await adapter.dispatch({
        caseId,
        recipientIdentifier: caseRecord?.victimUsername || 'victim',
        message: promptMessage,
        locale: caseRecord?.preferredLocale || 'en',
      });

      if (dispatchResult.success) {
        schedule.deliveryState = OUTREACH_STATE.DELIVERED;
        schedule.state = schedule.deliveryState;
        schedule.lastSuccessfulChannel = channelToUse;
        schedule.gatewayMessageId = dispatchResult.gatewayMessageId;
        schedule.nextAttemptAt = null;
        schedule.failureReason = null;
        schedule.lastError = null;
        this.store.updateOutreachSchedule(caseId, schedule);

        this.store.logAccess({
          userId: 'system-outreach',
          role: 'system',
          action: 'outreach_delivered',
          caseId,
          details: { channel: channelToUse, gatewayId: dispatchResult.gatewayMessageId },
        });

        return { ok: true, state: OUTREACH_STATE.DELIVERED, dispatchResult };
      } else {
        return this.handleDeliveryFailure(caseId, dispatchResult.error);
      }
    } catch (err) {
      return this.handleDeliveryFailure(caseId, err.message);
    }
  }

  /**
   * Handle failed delivery according to the state machine
   */
  handleDeliveryFailure(caseId, reason) {
    const schedule = this.store.getOutreachSchedule(caseId);
    if (!schedule) return null;

    const now = this.nowFn();
    const caseRecord = this.store.getCase(caseId);
    const consentRecord = typeof this.store.getConsent === 'function' ? this.store.getConsent(caseId) : null;
    const isCommConsented = Boolean(
      consentRecord && !consentRecord.revokedAt && consentRecord.purposes?.[CONSENT_PURPOSE.COMMUNICATION] === true
    );
    const allowedChannels = isCommConsented && Array.isArray(consentRecord?.channelsAllowed)
      ? consentRecord.channelsAllowed
      : [];

    schedule.attemptedAt = schedule.attemptedAt || new Date(now).toISOString();
    schedule.attemptNumber = schedule.attemptCount || 1;
    schedule.lastError = reason;
    schedule.failureReason = reason;

    // Can retry current channel only if attempts remaining AND current channel is still authorized
    const canRetryCurrentChannel = (
      schedule.attemptCount < MAX_DELIVERY_ATTEMPTS &&
      allowedChannels.includes(schedule.lastAttemptedChannel)
    );

    if (canRetryCurrentChannel) {
      // Step 1: Retry on same channel after configured retry delay
      schedule.deliveryState = OUTREACH_STATE.RETRY;
      schedule.state = schedule.deliveryState;
      schedule.nextAttemptAt = new Date(now + this.retryDelayMs).toISOString();
    } else {
      // Step 2: Try alternate channel from permitted channels
      const fallbackChannel = this.getNextFallbackChannel(schedule.lastAttemptedChannel, allowedChannels);
      if (fallbackChannel) {
        schedule.deliveryState = OUTREACH_STATE.ALTERNATE_CHANNEL;
        schedule.state = schedule.deliveryState;
        schedule.preferredChannel = fallbackChannel;
        schedule.channel = fallbackChannel;
        schedule.attemptCount = 0; // Reset count for fallback channel
        schedule.nextAttemptAt = new Date(now + this.retryDelayMs).toISOString();
      } else {
        // Step 3: All permitted channels exhausted -> raise counsellor flag gently
        schedule.deliveryState = OUTREACH_STATE.COUNSELLOR_FLAG;
        schedule.state = schedule.deliveryState;
        schedule.nextAttemptAt = null;
        schedule.missedStreak = (schedule.missedStreak || 0) + 1;

        // Gentle victim notification: Sahara remembers where you left off, no scolding
        if (caseRecord?.victimUsername) {
          this.store.addNotification(caseRecord.victimUsername, {
            caseId,
            type: 'outreach_gentle_missed',
            message: 'We missed you. You can check in whenever you are ready.',
          });
        }

        // Operational Counsellor Alert (P1-5): Contact continuity review
        const attemptedChannels = schedule.attemptedChannels?.length
          ? [...schedule.attemptedChannels]
          : [CHANNELS.APP, CHANNELS.SMS, CHANNELS.IVRS];

        if (this.store.createOperationalAlert) {
          this.store.createOperationalAlert({
            caseId,
            type: 'outreach_exhausted',
            reason: 'Repeated unsuccessful contact across configured outreach channels.',
            urgency: schedule.missedStreak >= 3 ? 'high' : 'medium',
            source: 'outreach_orchestrator',
            missedStreak: schedule.missedStreak,
            attemptedChannels,
            lastAttemptedChannel: schedule.lastAttemptedChannel,
            status: 'active',
          });
        }

        if (caseRecord) {
          this.store.logAccess({
            userId: 'system-outreach',
            role: 'system',
            action: 'outreach_counsellor_flag',
            caseId,
            details: {
              reason: 'Repeated unsuccessful contact across configured outreach channels.',
              missedStreak: schedule.missedStreak,
              lastAttemptedChannel: schedule.lastAttemptedChannel,
            },
          });
        }
      }
    }

    this.store.updateOutreachSchedule(caseId, schedule);
    return { ok: false, state: schedule.deliveryState, reason };
  }

  /**
   * Record that the victim responded to outreach
   */
  recordResponse(caseId, responseDetails = {}) {
    const schedule = this.store.getOutreachSchedule(caseId);
    if (!schedule) return null;

    const now = this.nowFn();
    schedule.deliveryState = OUTREACH_STATE.RESPONDED;
    schedule.state = schedule.deliveryState;
    schedule.responseState = 'RESPONDED';
    schedule.missedStreak = 0; // Reset streak upon response
    schedule.lastRespondedAt = new Date(now).toISOString();
    schedule.nextAttemptAt = null;
    schedule.failureReason = null;
    // Advance scheduled next check-in by 7 days
    const nextDate = new Date(now + 7 * 86_400_000);
    schedule.nextCheckInDate = nextDate.toISOString().split('T')[0];

    this.store.updateOutreachSchedule(caseId, schedule);
    return schedule;
  }
}
