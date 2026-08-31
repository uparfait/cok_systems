import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './assets/styles/globals.css'
import App from './App.tsx'

const APP_VERSION = '2.0.0';

interface ServiceWorkerVersionMessage extends MessageEvent {
  data: { version: string };
}

const registerWebPushServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    console.log('[IKAZE] Service workers not supported in this browser');
    return;
  }

  try {
    await navigator.serviceWorker.ready.catch(() => {
      /*
       * It is okay if there is currently no active service worker.
       */
    });

    /*
     * Get ALL service-worker registrations belonging to this origin.
     */
    const registrations = await navigator.serviceWorker.getRegistrations();

    /*
     * Unregister every existing service worker.
     */
    for (const registration of registrations) {
      try {
        await registration.unregister();
        console.log('[IKAZE] Old service worker unregistered');
      } catch (error) {
        console.error('[IKAZE] Could not unregister service worker:', error);
      }
    }

    /*
     * Register the new IKAZE service worker.
     */
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    console.log(`[IKAZE] Service worker registered successfully:`, registration.scope);

    /*
     * Ask the browser to check the server for a newer service-worker.js.
     */
    await registration.update();

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[IKAZE] New content available, please refresh.');
            window.dispatchEvent(new CustomEvent('sw-update-available'));
          }
        });
      }
    });

  } catch (error) {
    console.error('[IKAZE] Service worker registration failed:', error);
  }
};

// PWA Install Prompt Handler
let deferredPrompt: any = null;

const setupInstallPrompt = () => {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.dispatchEvent(new CustomEvent('pwa-install-available', { detail: { prompt: deferredPrompt } }));
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App was installed successfully');
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent('pwa-installed'));
  });
};

registerWebPushServiceWorker();
setupInstallPrompt();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
