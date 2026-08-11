const NotificationSubscription = require('../../models/notificationSubscription');

async function getSubscription(req, res) {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const subscriptions = await NotificationSubscription.find({ user_id: userId });
    
    res.json({
      success: true,
      subscribed: subscriptions.length > 0,
      data: subscriptions
    });
  } catch (error) {
    console.error('Error getting subscription:', error);
    res.status(500).json({ success: false, message: 'Failed to get subscription', error: error.message });
  }
}

module.exports = { getSubscription };
