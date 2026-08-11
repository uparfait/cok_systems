const NotificationSubscription = require('../../models/notificationSubscription');
const { webpush } = require('../../configurations/webpush');
const User = require('../../models/user');

async function subscribe(req, res) {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Please login to subscribe' });
    }

    const { endpoint, keys, userAgent } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ success: false, message: 'Invalid subscription data' });
    }

    const user = await User.findById(userId).populate('department');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const departmentName = user.department?.department_name || user.department_unit || '';
    const departmentId = user.department?._id?.toString() || user.department_id || '';

    const existing = await NotificationSubscription.findOne({ endpoint });
    if (existing) {
      existing.user_id = userId;
      existing.keys = keys;
      existing.user_agent = userAgent || existing.user_agent;
      existing.user_info = {
        full_name: user.full_name,
        email: user.email,
        telephone: user.telephone || '',
        role: user.roles?.role_name || '',
        department: departmentName,
        department_id: departmentId
      };
      existing.is_active = true;
      existing.subscribed_at = new Date();
      await existing.save();

      await sendWelcomeNotification({ endpoint, keys });

      return res.status(200).json({ success: true, message: 'Subscription updated successfully', data: existing });
    }

    const subscription = new NotificationSubscription({
      user_id: userId,
      endpoint,
      keys,
      user_agent: userAgent || '',
      user_info: {
        full_name: user.full_name,
        email: user.email,
        telephone: user.telephone || '',
        role: user.roles?.role_name || '',
        department: departmentName,
        department_id: departmentId
      },
      is_active: true
    });

    await subscription.save();

    await sendWelcomeNotification({ endpoint, keys });

    res.status(201).json({ success: true, message: 'Subscribed successfully', data: subscription });
  } catch (error) {
    console.error('Error subscribing:', error);
    res.status(500).json({ success: false, message: 'Failed to subscribe', error: error.message });
  }
}

async function sendWelcomeNotification(subscription) {
  try {
    const payload = JSON.stringify({
      title: 'Welcome to IKAZE',
      body: 'You have successfully subscribed to notification updates.',
      icon: '/LOGO_COK.png',
      badge: '/favicon.png',
      tag: 'welcome',
      data: {
        url: process.env.CLIENT_URL_SET || '/',
      }
    });
    await webpush.sendNotification(subscription, payload);
  } catch (error) {
    console.error('Error sending welcome notification:', error.message);
  }
}

module.exports = { subscribe };
