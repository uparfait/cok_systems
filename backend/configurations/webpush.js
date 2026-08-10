const webpush = require('web-push');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BKGmeh6P2X5Ywc5Me7FiMz81Ml8uENv17gU_1t_9CSL7Bic1VWHcqI7jnl71IpBW-itqkpDjBPHyG7FNhz53cqs';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '6rtH31nmQnWXwFRWS_TCvNZAn4NZmLhFkiYe-6CO9iU';
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
