/**
 * Central notification dispatcher.
 *
 * Every targeted notification goes out as ONE socket event whose payload
 * carries `to`: an ARRAY of user id strings. The frontend shows a
 * notification only when the authenticated user id is inside `to`.
 * Payloads without `to` are broadcasts and every client shows them.
 *
 * Delivery rule: users who are online (User.is_active) receive the socket
 * event live. Users who are offline are sent a web push notification
 * instead, when they have an active push subscription.
 *
 * The full list of events, their audiences, and the reason each exists is
 * documented in events.socket.json at the backend root (mirrored on the
 * frontend at src/core/constants/events.socket.json).
 */

const User = require('../models/user');
const Department = require('../models/department');
const NotificationSubscription = require('../models/notificationSubscription');

// Web push is optional: the configuration module throws when VAPID keys are
// missing, and notifications must still work without push in that case.
let webpush = null;
try {
  ({ webpush } = require('../configurations/webpush'));
} catch (error) {
  console.error('Web push is not configured, offline users will not receive push notifications:', error.message);
}

const toIdStrings = (ids) => [...new Set((ids || []).filter(Boolean).map((id) => String(id)))];

/**
 * Send a web push notification to every active subscription of one user.
 * Silently does nothing when push is not configured or the user has no
 * subscription. Dead subscriptions (404/410) are deactivated.
 */
async function sendPushToUser(userId, { title, message, url = '/', tag = 'general' }) {
  if (!webpush) return false;
  try {
    const subscriptions = await NotificationSubscription.find({
      user_id: userId,
      is_active: true,
      endpoint: { $ne: '' },
    }).lean();
    if (subscriptions.length === 0) return false;

    const payload = JSON.stringify({
      title: title || 'Notification',
      body: message || '',
      icon: '/LOGO_COK.png',
      badge: '/favicon.png',
      tag,
      data: { url },
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
            payload
          );
          await NotificationSubscription.findByIdAndUpdate(sub._id, { last_notification_at: new Date() });
          return true;
        } catch (error) {
          if (error.statusCode === 404 || error.statusCode === 410) {
            await NotificationSubscription.findOneAndUpdate(
              { endpoint: sub.endpoint },
              { is_active: false, endpoint: '' }
            );
          } else {
            console.error(`Push error for user ${userId}:`, error.statusCode || error.message);
          }
          return false;
        }
      })
    );
    return results.some((r) => r.status === 'fulfilled' && r.value === true);
  } catch (error) {
    console.error(`Failed to push to user ${userId}:`, error.message);
    return false;
  }
}

/**
 * Notify a list of users.
 * - Emits ONE socket event with `to` as an array of user id strings; the
 *   frontend filters it against the authenticated user id.
 * - For every recipient who is offline (User.is_active is false), sends a
 *   web push notification instead, when a subscription exists.
 *
 * @param {object} options
 * @param {string} options.event - Socket event name (must exist in events.socket.json)
 * @param {Array} options.to - User ids that must receive this notification
 * @param {string} [options.type] - info | success | warning | error
 * @param {string} [options.title] - Short title shown in the notification list
 * @param {string} options.message - Plain message, simple English, no special symbols
 * @param {object} [options.data] - Extra structured details for the notification panel
 * @param {string} [options.url] - Frontend path opened from a push notification
 */
async function notifyUsers({ event, to = [], type = 'info', title = '', message = '', data = {}, url = '/' }) {
  const ids = toIdStrings(to);
  if (!event || ids.length === 0) return { sent: 0, pushed: 0 };

  const payload = {
    show_notif: true,
    type,
    title,
    message,
    to: ids,
    data,
    timestamp: new Date().toISOString(),
  };

  if (global.WebsocketIO) {
    global.WebsocketIO.emit(event, payload);
  }

  let pushed = 0;
  try {
    const users = await User.find({ _id: { $in: ids } }).select('is_active').lean();
    const offlineIds = users.filter((u) => u.is_active !== true).map((u) => String(u._id));
    const results = await Promise.allSettled(
      offlineIds.map((id) => sendPushToUser(id, { title: title || 'Notification', message, url, tag: event }))
    );
    pushed = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
  } catch (error) {
    console.error('Offline push fallback failed:', error.message);
  }

  return { sent: ids.length, pushed };
}

/**
 * Resolve who must be notified when a visitor is assigned:
 * - a specific employee (provider) is given: only that employee
 * - the target is a unit: only the users of that unit
 * - the target is a department: all users of that department and its units
 */
async function getDepartmentRecipients(departmentId, providerId = null) {
  if (providerId) return toIdStrings([providerId]);

  const dept = await Department.findById(departmentId)
    .select('employees department_leader leader is_unit')
    .lean();
  if (!dept) return [];

  const ids = new Set(toIdStrings(dept.employees));
  if (dept.department_leader) ids.add(String(dept.department_leader));
  if (dept.leader) ids.add(String(dept.leader));

  const departmentScope = [String(departmentId)];

  if (!dept.is_unit) {
    const units = await Department.find({ parent_department: departmentId })
      .select('employees department_leader leader')
      .lean();
    for (const unit of units) {
      toIdStrings(unit.employees).forEach((id) => ids.add(id));
      if (unit.department_leader) ids.add(String(unit.department_leader));
      if (unit.leader) ids.add(String(unit.leader));
      departmentScope.push(String(unit._id));
    }
  }

  // Users can belong to a department without being in its employees array
  const departmentUsers = await User.find({ department: { $in: departmentScope } })
    .select('_id')
    .lean();
  departmentUsers.forEach((u) => ids.add(String(u._id)));

  return [...ids];
}

/** All users whose role works at the gates (vehicle and entrance registrars). */
async function getGateRegistrarIds() {
  const users = await User.find({
    'roles.role_name': { $regex: /(gate|vehicle|entrance)/i },
  })
    .select('_id')
    .lean();
  return users.map((u) => String(u._id));
}

module.exports = {
  notifyUsers,
  sendPushToUser,
  getDepartmentRecipients,
  getGateRegistrarIds,
};
