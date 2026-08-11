const NotificationSubscription = require('../../models/notificationSubscription');
const { webpush, VAPID_PUBLIC_KEY } = require('../../configurations/webpush');

async function sendNotification(subscription, payload) {
  try {
    await webpush.sendNotification(subscription, payload);
    return true;
  } catch (error) {
    if (error.statusCode === 404 || error.statusCode === 410) {
      console.log(`Removing invalid subscription (${error.statusCode}): ${subscription.endpoint}`);
      await NotificationSubscription.findOneAndUpdate(
        { endpoint: subscription.endpoint },
        { is_active: false, endpoint: '' }
      );
    } else {
      console.error(`Push error for ${subscription.endpoint}:`, error.statusCode, error.body);
    }
    return false;
  }
}

async function sendToAll(req, res) {
  try {
    const { title, body, icon, badge, tag, url } = req.body;
    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'Title and body are required' });
    }

    const subscriptions = await NotificationSubscription.find({ is_active: true, endpoint: { $ne: '' } });
    if (subscriptions.length === 0) {
      return res.status(404).json({ success: false, message: 'No active subscribers found' });
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: icon || '/LOGO_COK.png',
      badge: badge || '/favicon.png',
      tag: tag || 'general',
      data: { url: url || '/' }
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const subObj = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth
          }
        };
        const sent = await sendNotification(subObj, payload);
        if (sent) {
          await NotificationSubscription.findByIdAndUpdate(sub._id, { last_notification_at: new Date() });
        }
        return { endpoint: sub.endpoint, user: sub.user_info?.full_name, sent };
      })
    );

    const sentCount = results.filter(r => r.status === 'fulfilled' && r.value.sent).length;
    const failedCount = results.length - sentCount;

    res.json({
      success: true,
      message: `Notification sent to ${sentCount} subscriber(s)`,
      data: { total: subscriptions.length, sent: sentCount, failed: failedCount }
    });
  } catch (error) {
    console.error('Error sending to all:', error);
    res.status(500).json({ success: false, message: 'Failed to send notifications', error: error.message });
  }
}

async function sendToRole(req, res) {
  try {
    const role = req.params.role;
    const { title, body, icon, badge, tag, url } = req.body;
    if (!role || !title || !body) {
      return res.status(400).json({ success: false, message: 'Role, title, and body are required' });
    }

    const subscriptions = await NotificationSubscription.find({ 
      is_active: true, 
      endpoint: { $ne: '' },
      'user_info.role': role
    });

    if (subscriptions.length === 0) {
      return res.status(404).json({ success: false, message: `No active subscribers found for role: ${role}` });
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: icon || '/LOGO_COK.png',
      badge: badge || '/favicon.png',
      tag: tag || 'role-specific',
      data: { url: url || '/' }
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const subObj = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }
        };
        const sent = await sendNotification(subObj, payload);
        if (sent) {
          await NotificationSubscription.findByIdAndUpdate(sub._id, { last_notification_at: new Date() });
        }
        return { endpoint: sub.endpoint, user: sub.user_info?.full_name, sent };
      })
    );

    const sentCount = results.filter(r => r.status === 'fulfilled' && r.value.sent).length;

    res.json({
      success: true,
      message: `Notification sent to ${sentCount} subscriber(s) in role: ${role}`,
      data: { role, total: subscriptions.length, sent: sentCount }
    });
  } catch (error) {
    console.error('Error sending to role:', error);
    res.status(500).json({ success: false, message: 'Failed to send notifications', error: error.message });
  }
}

async function sendToUser(req, res) {
  try {
    const userId = req.params.userId;
    const { title, body, icon, badge, tag, url } = req.body;
    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'Title and body are required' });
    }

    const subscriptions = await NotificationSubscription.find({ user_id: userId, is_active: true, endpoint: { $ne: '' } });
    if (subscriptions.length === 0) {
      return res.status(404).json({ success: false, message: 'No active subscription found for this user' });
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: icon || '/LOGO_COK.png',
      badge: badge || '/favicon.png',
      tag: tag || 'personal',
      data: { url: url || '/' }
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const subObj = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }
        };
        const sent = await sendNotification(subObj, payload);
        if (sent) {
          await NotificationSubscription.findByIdAndUpdate(sub._id, { last_notification_at: new Date() });
        }
        return { endpoint: sub.endpoint, sent };
      })
    );

    const sentCount = results.filter(r => r.status === 'fulfilled' && r.value.sent).length;

    res.json({
      success: true,
      message: `Notification sent to ${sentCount} device(s)`,
      data: { user: subscriptions[0].user_info?.full_name, devices: subscriptions.length, sent: sentCount }
    });
  } catch (error) {
    console.error('Error sending to user:', error);
    res.status(500).json({ success: false, message: 'Failed to send notification', error: error.message });
  }
}

async function sendTest(req, res) {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const subscription = await NotificationSubscription.findOne({ user_id: userId, is_active: true, endpoint: { $ne: '' } });
    if (!subscription) {
      return res.status(404).json({ success: false, message: 'No active subscription found for you' });
    }

    const payload = JSON.stringify({
      title: 'Test Notification',
      body: `Test at ${new Date().toLocaleTimeString()}`,
      icon: '/LOGO_COK.png',
      badge: '/favicon.png',
      tag: 'test',
      data: { url: '/' }
    });

    const subObj = {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth }
    };

    const sent = await sendNotification(subObj, payload);
    if (sent) {
      await NotificationSubscription.findByIdAndUpdate(subscription._id, { last_notification_at: new Date() });
    }

    res.json({ success: true, message: sent ? 'Test notification sent' : 'Failed to send test notification', sent });
  } catch (error) {
    console.error('Error sending test:', error);
    res.status(500).json({ success: false, message: 'Failed to send test notification', error: error.message });
  }
}

module.exports = { sendToAll, sendToRole, sendToUser, sendTest };
