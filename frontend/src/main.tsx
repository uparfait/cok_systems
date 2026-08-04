import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './assets/styles/globals.css'
import App from './App.tsx'

const APP_VERSION = '1.0.0';

interface ServiceWorkerVersionMessage extends MessageEvent {
  data: { version: string };
}

// PWA Service Worker Registration with version management
const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    console.log('[PWA] Service workers not supported in this browser');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw2.js', {
      scope: '/'
    });

    console.log(`[PWA] Service worker registered successfully:`, registration.scope);

    // Check if there's an existing active service worker with a different version
    if (navigator.serviceWorker.controller) {
      const existingVersion = await getServiceWorkerVersion();
      
      if (existingVersion && existingVersion !== APP_VERSION) {
        console.log(`[PWA] Version mismatch detected. Old: ${existingVersion}, New: ${APP_VERSION}`);
        console.log('[PWA] Clearing old service worker and caches...');
        
        // Force clear old service worker and caches
        await clearOldServiceWorker(registration);
        
        // Reload the page to pick up the new service worker
        console.log('[PWA] Reloading page to install new service worker...');
        window.location.reload();
        return;
      }
    }

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[PWA] New content available, please refresh.');
            window.dispatchEvent(new CustomEvent('sw-update-available'));
          }
        });
      }
    });

    // Listen for messages from the service worker
    if (navigator.serviceWorker.addEventListener) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'CACHE_CLEARED') {
          console.log('[PWA] Service worker reported caches cleared');
        }
      });
    }

  } catch (error) {
    console.error('[PWA] Service worker registration failed:', error);
  }
};

// Get the version of the currently active service worker
const getServiceWorkerVersion = (): Promise<string | null> => {
  return new Promise((resolve) => {
    if (!navigator.serviceWorker.controller) {
      resolve(null);
      return;
    }

    const messageChannel = new MessageChannel();
    
    messageChannel.port1.onmessage = (event: ServiceWorkerVersionMessage) => {
      resolve(event.data?.version || null);
    };

    navigator.serviceWorker.controller.postMessage(
      { type: 'GET_VERSION' },
      [messageChannel.port2]
    );

    // Timeout after 1 second
    setTimeout(() => {
      resolve(null);
    }, 1000);
  });
};

// Clear old service worker and all caches
const clearOldServiceWorker = async (registration: ServiceWorkerRegistration): Promise<void> => {
  try {
    // Send clear caches message to the active service worker
    if (navigator.serviceWorker.controller) {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = () => {
        console.log('[PWA] Old service worker acknowledged cache clear');
      };

      navigator.serviceWorker.controller.postMessage(
        { type: 'CLEAR_CACHES' },
        [messageChannel.port2]
      );
    }

    // Unregister the old service worker
    if (registration.waiting) {
      console.log('[PWA] Unregistering waiting service worker');
      await registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    // Unregister all service workers for this scope
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      console.log(`[PWA] Unregistering service worker:`, reg.scope);
      await reg.unregister();
    }

    // Clear all caches as a fallback
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      console.log(`[PWA] Clearing ${cacheNames.length} caches from main thread`);
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }

    console.log('[PWA] Old service worker and caches cleared successfully');
  } catch (error) {
    console.error('[PWA] Failed to clear old service worker:', error);
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

// Initialize PWA features
const initializePWA = () => {
  //registerServiceWorker();
  setupInstallPrompt();
};

// Only initialize PWA features in production or when not on localhost
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  initializePWA();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
