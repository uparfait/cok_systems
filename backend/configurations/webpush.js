const webpush = require('web-push');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_MAILTO = process.env.VAPID_MAILTO || 'coksystems@kigalicity.gov.rw';

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  throw new Error('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set in environment variables');
}

webpush.setVapidDetails(
  `mailto:${VAPID_MAILTO}`,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

module.exports = { webpush, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_MAILTO };
