/**
 * Notification routes — victim-facing endpoint for feedback loop.
 *
 * WHY THIS EXISTS
 * -------------------------------------------------------------------------
 * The problem statement requires the system to "strengthen victim confidence
 * in the justice delivery system." A victim who submits a check-in and never
 * hears back has no reason to trust the system. This route provides a simple
 * feedback loop: when a counsellor reviews a case, the victim sees a
 * notification that their input was seen and acted upon.
 *
 * The notification is deliberately simple — no clinical language, no case
 * details, just "Your check-in was reviewed by a welfare officer." This is
 * enough to close the feedback loop without exposing sensitive information.
 */

import { Router } from 'express';
import { requireVictim } from '../access/requireRole.js';
import { store } from '../store/memoryStore.js';

export const notificationsRouter = Router();

// Only the victim role may access their own notifications.
notificationsRouter.use(requireVictim);

/**
 * GET /api/notifications — get all notifications for the current victim.
 *
 * Returns notifications newest-first, plus unread count.
 */
notificationsRouter.get('/', (req, res) => {
  const victimUsername = req.victimUsername;
  const notifications = store.getNotifications(victimUsername);
  const unreadCount = store.getUnreadCount(victimUsername);

  res.json({
    notifications,
    unreadCount,
  });
});

/**
 * POST /api/notifications/read — mark all notifications as read.
 */
notificationsRouter.post('/read', (req, res) => {
  const victimUsername = req.victimUsername;
  store.markNotificationsRead(victimUsername);

  res.json({ ok: true });
});
