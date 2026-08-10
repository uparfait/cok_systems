const webpush = require('web-push');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BOr0k1J6x3z5y8a9b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'c1d2e3f4g5h6i7j8k9l0m1n2o3p4q5r6s7t8u9v0w1x2y3z4a5b6c7d8e9f0g1h2';
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
