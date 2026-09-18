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
  constructor(store) {
    this.store = store;
    this.adapters = {
      [CHANNELS.WEB]: new WebAdapter(),
      [CHANNELS.APP]: new AppAdapter(),
      [CHANNELS.SMS]: new SMSAdapter(),
      [CHANNELS.IVRS]: new IVRSAdapter(),
    };
  }

  /**
   * Determine next fallback channel when a delivery fails
   */
  getNextFallbackChannel(currentChannel) {
    const fallbackChain = {
      [CHANNELS.APP]: CHANNELS.SMS,
      [CHANNELS.WEB]: CHANNELS.SMS,
      [CHANNELS.SMS]: CHANNELS.IVRS,
      [CHANNELS.IVRS]: null, // End of automated chain -> requires counsellor flag
    };
    return fallbackChain[currentChannel] || null;
  }

  /**
   * Schedule or update a check-in outreach for a case
   */
  scheduleCheckin(caseId, { nextCheckInDate, preferredChannel }) {
    const existing = this.store.getOutreachSchedule(caseId);
    const schedule = {
      caseId,
      nextCheckInDate: nextCheckInDate || new Date(Date.now() + 7 * 86_400_000).toISOString().split('T')[0],
      preferredChannel: preferredChannel || existing?.preferredChannel || CHANNELS.APP,
      lastSuccessfulChannel: existing?.lastSuccessfulChannel || null,
      lastAttemptedChannel: null,
      deliveryState: OUTREACH_STATE.CHECKIN_DUE,
      attemptCount: 0,
      responseState: 'PENDING',
      missedStreak: existing?.missedStreak || 0,
      updatedAt: new Date().toISOString(),
    };
    return this.store.saveOutreachSchedule(schedule);
  }

  /**
   * Execute or simulate a delivery attempt
   */
  async attemptDelivery(caseId, { channelOverride, simulateFailure = false } = {}) {
    const schedule = this.store.getOutreachSchedule(caseId);
    if (!schedule) throw new Error(`No outreach schedule found for case ${caseId}`);

    const caseRecord = this.store.getCase(caseId);
    const channelToUse = channelOverride || schedule.preferredChannel || CHANNELS.APP;
    const adapter = this.adapters[channelToUse] || this.adapters[CHANNELS.APP];

    schedule.lastAttemptedChannel = channelToUse;
    schedule.attemptCount = (schedule.attemptCount || 0) + 1;
    schedule.deliveryState = OUTREACH_STATE.DELIVERY_ATTEMPTED;

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
        schedule.lastSuccessfulChannel = channelToUse;
        schedule.gatewayMessageId = dispatchResult.gatewayMessageId;
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

    const caseRecord = this.store.getCase(caseId);

    if (schedule.attemptCount < MAX_DELIVERY_ATTEMPTS) {
      // Step 1: Retry on same channel
      schedule.deliveryState = OUTREACH_STATE.RETRY;
    } else {
      // Step 2: Try alternate channel
      const fallbackChannel = this.getNextFallbackChannel(schedule.lastAttemptedChannel);
      if (fallbackChannel) {
        schedule.deliveryState = OUTREACH_STATE.ALTERNATE_CHANNEL;
        schedule.preferredChannel = fallbackChannel;
        schedule.attemptCount = 0; // Reset for fallback channel
      } else {
        // Step 3: All channels exhausted -> raise counsellor flag gently
        schedule.deliveryState = OUTREACH_STATE.COUNSELLOR_FLAG;
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
        const attemptedChannels = [CHANNELS.APP, CHANNELS.SMS, CHANNELS.IVRS];
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

        // Auto-notify assigned counsellor / create internal review task
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

    schedule.lastError = reason;
    this.store.updateOutreachSchedule(caseId, schedule);
    return { ok: false, state: schedule.deliveryState, reason };
  }

  /**
   * Record that the victim responded to outreach
   */
  recordResponse(caseId, responseDetails = {}) {
    const schedule = this.store.getOutreachSchedule(caseId);
    if (!schedule) return null;

    schedule.deliveryState = OUTREACH_STATE.RESPONDED;
    schedule.responseState = 'RESPONDED';
    schedule.missedStreak = 0; // Reset streak upon response
    schedule.lastRespondedAt = new Date().toISOString();
    // Advance scheduled next check-in by 7 days
    const nextDate = new Date(Date.now() + 7 * 86_400_000);
    schedule.nextCheckInDate = nextDate.toISOString().split('T')[0];

    this.store.updateOutreachSchedule(caseId, schedule);
    return schedule;
  }
}
