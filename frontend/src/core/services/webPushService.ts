import { get, post } from './apiClient';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function getVapidPublicKey(): Promise<string> {
  const res = await get('/webpush/vapid-public-key');
  return res?.publicKey || VAPID_PUBLIC_KEY;
}

export async function subscribeToPush(registration: ServiceWorkerRegistration): Promise<any> {
  const publicKey = await getVapidPublicKey();
  if (!publicKey) {
    throw new Error('VAPID public key not available');
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource
  });

  const userAgent = navigator.userAgent;
  await post('/webpush/subscribe', {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.toJSON().keys?.p256dh || '',
      auth: subscription.toJSON().keys?.auth || ''
    },
    userAgent
  });

  return subscription;
}

export async function unsubscribeFromPush(subscription: PushSubscription): Promise<void> {
  await subscription.unsubscribe();
  await post('/webpush/unsubscribe', { endpoint: subscription.endpoint });
}

export async function getSubscriptionStatus(): Promise<{ subscribed: boolean; data: any }> {
  const res = await get('/webpush/subscription');
  return { subscribed: res?.subscribed || false, data: res?.data || null };
}

export async function sendTestNotification(): Promise<any> {
  return post('/webpush/test', {});
}

export async function sendNotificationToAll(data: { title: string; body: string; icon?: string; badge?: string; tag?: string; url?: string }): Promise<any> {
  return post('/webpush/send/all', data);
}

export async function sendNotificationToRole(role: string, data: { title: string; body: string; icon?: string; badge?: string; tag?: string; url?: string }): Promise<any> {
  return post(`/webpush/send/role/${encodeURIComponent(role)}`, data);
}

export async function sendNotificationToUser(userId: string, data: { title: string; body: string; icon?: string; badge?: string; tag?: string; url?: string }): Promise<any> {
  return post(`/webpush/send/user/${userId}`, data);
}

export { urlBase64ToUint8Array };
