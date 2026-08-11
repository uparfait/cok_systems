const NotificationSubscription = require('../../models/notificationSubscription');

async function unsubscribe(req, res) {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ success: false, message: 'Endpoint is required' });
    }

    const result = await NotificationSubscription.deleteOne({ user_id: userId, endpoint });
    if (result.deletedCount === 0) {
      return res.status(200).json({ success: true, message: 'Subscription not found but you can proceed.' });
    }

    res.json({ success: true, message: 'Unsubscribed successfully' });
  } catch (error) {
    console.error('Error unsubscribing:', error);
    res.status(500).json({ success: false, message: 'Failed to unsubscribe', error: error.message });
  }
}

module.exports = { unsubscribe };
